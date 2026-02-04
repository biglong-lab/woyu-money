import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { handleDatabaseError } from './db';

// 安全錯誤類型定義
export class SecurityError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message);
    this.name = 'SecurityError';
  }
}

// 輸入驗證和清理
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    // 移除潛在的惡意字符
    return input
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
};

// 權限檢查中間件
export const checkPermission = (requiredPermission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        throw new SecurityError('未登入', 401);
      }

      // 管理員擁有所有權限
      if (user.role === 'admin') {
        return next();
      }

      // 檢查用戶權限
      const userPermissions = user.menuPermissions || {};
      
      if (!userPermissions[requiredPermission]) {
        console.warn(`[Security] User ${user.id} attempted to access ${requiredPermission} without permission`);
        throw new SecurityError('權限不足', 403);
      }

      next();
    } catch (error) {
      if (error instanceof SecurityError) {
        return res.status(error.statusCode).json({ 
          message: error.message,
          error: 'PermissionDenied'
        });
      }
      
      console.error('[Security] Permission check error:', error);
      res.status(500).json({ message: '權限檢查失敗' });
    }
  };
};

// API速率限制
export const createRateLimit = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: 'RateLimitExceeded', message },
    standardHeaders: true,
    legacyHeaders: false,
    // 自定義密鑰生成器
    keyGenerator: (req) => {
      const user = req.user as any;
      return user?.id ? `user:${user.id}` : req.ip || 'unknown';
    },
    // 錯誤處理
    handler: (req, res) => {
      console.warn(`[Security] Rate limit exceeded for ${req.ip}`);
      res.status(429).json({
        error: 'RateLimitExceeded',
        message: '請求過於頻繁，請稍後再試'
      });
    }
  });
};

// 常用的速率限制配置
export const rateLimits = {
  // 一般API請求：每分鐘100次
  general: createRateLimit(60 * 1000, 100, '請求過於頻繁'),
  
  // 登入嘗試：每15分鐘5次
  auth: createRateLimit(15 * 60 * 1000, 5, '登入嘗試過於頻繁'),
  
  // 檔案上傳：每小時10次
  upload: createRateLimit(60 * 60 * 1000, 10, '上傳過於頻繁'),
  
  // 資料匯出：每小時3次
  export: createRateLimit(60 * 60 * 1000, 3, '匯出請求過於頻繁')
};

// 請求日誌中間件
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const user = req.user as any;
  
  // 記錄請求開始
  console.log(`[API] ${req.method} ${req.path} - User: ${user?.id || 'anonymous'} - IP: ${req.ip}`);
  
  // 監聽回應完成
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    console[logLevel](`[API] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms - User: ${user?.id || 'anonymous'}`);
    
    // 記錄敏感操作
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      console.info(`[Audit] ${user?.username || 'anonymous'} performed ${req.method} on ${req.path}`);
    }
  });
  
  next();
};

// 輸入驗證中間件
export const validateInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    // 清理請求主體
    if (req.body) {
      req.body = sanitizeInput(req.body);
    }
    
    // 清理查詢參數
    if (req.query) {
      req.query = sanitizeInput(req.query);
    }
    
    next();
  } catch (error) {
    console.error('[Security] Input validation error:', error);
    res.status(400).json({ message: '無效的輸入格式' });
  }
};

// 安全頭部中間件
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // 防止點擊劫持
  res.setHeader('X-Frame-Options', 'DENY');
  
  // 防止MIME類型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS保護
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // 防止資訊洩露
  res.removeHeader('X-Powered-By');
  
  // HSTS (僅在HTTPS時)
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

// 資料庫查詢安全包裝器
export const secureQuery = async <T>(
  operation: () => Promise<T>,
  context: string,
  user?: any
): Promise<T> => {
  try {
    const start = Date.now();
    const result = await operation();
    const duration = Date.now() - start;
    
    // 記錄慢查詢
    if (duration > 1000) {
      console.warn(`[Performance] Slow query in ${context}: ${duration}ms - User: ${user?.id || 'system'}`);
    }
    
    return result;
  } catch (error) {
    console.error(`[Security] Database operation failed in ${context}:`, error);
    await handleDatabaseError(error, context);
    throw error;
  }
};