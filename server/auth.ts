import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SchemaUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SchemaUser {}
  }
}

declare module "express-session" {
  interface SessionData {
    userId: number;
    isAuthenticated: boolean;
    lineState: string;
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Session configuration
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-fallback-secret-key-for-dev",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Local strategy for username/password authentication
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          return done(null, false, { message: "用戶名或密碼錯誤" });
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return done(null, false, { message: "帳戶已被鎖定，請稍後再試" });
        }

        // Verify password
        if (!user.password || !(await comparePasswords(password, user.password))) {
          // Increment failed login attempts
          const attempts = (user.failedLoginAttempts || 0) + 1;
          const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : undefined; // Lock for 15 minutes after 5 failed attempts
          
          await storage.updateUserLoginAttempts(user.id, attempts, lockUntil);
          
          return done(null, false, { message: "用戶名或密碼錯誤" });
        }

        // Reset failed login attempts on successful login
        if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
          await storage.updateUserLoginAttempts(user.id, 0);
        }

        // Update last login
        await storage.updateUser(user.id, { lastLogin: new Date() });
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user || false);
    } catch (error) {
      done(error);
    }
  });

  // Registration endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, email, fullName } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "用戶名和密碼為必填項" });
      }

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "用戶名已存在" });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email: email || null,
        fullName: fullName || null,
        role: "user",
        isActive: true,
      });

      // Auto-login after registration
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "註冊失敗，請稍後再試" });
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "登入失敗" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        res.json({
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        });
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie('connect.sid');
        res.json({ message: "登出成功" });
      });
    });
  });

  // Get current user endpoint
  app.get("/api/user", async (req, res) => {
    // Check passport authentication first
    if (req.isAuthenticated() && req.user) {
      return res.json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role,
      });
    }
    
    // Check session-based authentication (for LINE login)
    if (req.session.userId && req.session.isAuthenticated) {
      try {
        const user = await storage.getUserById(req.session.userId);
        if (user) {
          return res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
          });
        }
      } catch (error) {
        console.error('Error fetching user from session:', error);
      }
    }
    
    return res.status(401).json({ message: "未登入" });
  });
}

// Middleware to check if user is authenticated
export function requireAuth(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  // Check passport authentication first
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  
  // Check session-based authentication (for LINE login)
  if (req.session.userId && req.session.isAuthenticated) {
    return next();
  }
  
  return res.status(401).json({ message: "需要登入才能訪問此資源" });
}

// Export hash function for initial admin user creation
export { hashPassword };