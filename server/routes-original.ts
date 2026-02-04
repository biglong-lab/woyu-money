import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertDebtSchema, insertDebtCategorySchema, insertVendorSchema, insertDebtPaymentSchema,
  insertKidsWishlistSchema, insertKidsSavingSchema, insertKidsLoanSchema, insertKidsScheduleSchema,
  insertFamilyMemberSchema, insertPaymentProjectSchema, insertPaymentItemSchema, 
  insertPaymentRecordSchema, insertPaymentTagSchema, insertBudgetPlanSchema,
  insertHouseholdBudgetSchema, insertHouseholdExpenseSchema,
  insertHouseholdCategorySchema, insertProjectCategorySchema,
  insertProjectBudgetSchema, insertProjectExpenseSchema,
  householdBudgets, householdExpenses, debtCategories, debts,
  householdCategories, projectCategories, projectBudgets, projectExpenses,
  paymentProjects
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Categories routes
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const categoryData = insertDebtCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create category" });
      }
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = insertDebtCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(id, categoryData);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update category" });
      }
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // 階層分類 API 路由
  app.get("/api/categories/hierarchy", async (req, res) => {
    try {
      const hierarchy = await storage.getCategoriesHierarchy();
      res.json(hierarchy);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories hierarchy" });
    }
  });

  app.get("/api/categories/main", async (req, res) => {
    try {
      const mainCategories = await storage.getMainCategories();
      res.json(mainCategories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch main categories" });
    }
  });

  app.get("/api/categories/:parentId/subcategories", async (req, res) => {
    try {
      const parentId = parseInt(req.params.parentId);
      const subCategories = await storage.getSubCategories(parentId);
      res.json(subCategories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch subcategories" });
    }
  });

  // Vendors routes
  app.get("/api/vendors", async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.post("/api/vendors", async (req, res) => {
    try {
      const vendorData = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(vendorData);
      res.status(201).json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create vendor" });
      }
    }
  });

  app.put("/api/vendors/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vendorData = insertVendorSchema.partial().parse(req.body);
      const vendor = await storage.updateVendor(id, vendorData);
      res.json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update vendor" });
      }
    }
  });

  app.delete("/api/vendors/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteVendor(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete vendor" });
    }
  });

  // Debts routes
  app.get("/api/debts", async (req, res) => {
    try {
      const debts = await storage.getDebts();
      res.json(debts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch debts" });
    }
  });

  app.post("/api/debts", async (req, res) => {
    try {
      const debtData = insertDebtSchema.parse(req.body);
      const debt = await storage.createDebt(debtData);
      res.status(201).json(debt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create debt" });
      }
    }
  });

  app.put("/api/debts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const debtData = insertDebtSchema.partial().parse(req.body);
      const debt = await storage.updateDebt(id, debtData);
      res.json(debt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update debt" });
      }
    }
  });

  app.delete("/api/debts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDebt(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete debt" });
    }
  });

  // Debt payments routes
  app.get("/api/debts/:id/payments", async (req, res) => {
    try {
      const debtId = parseInt(req.params.id);
      const payments = await storage.getDebtPayments(debtId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/debts/:id/payments", async (req, res) => {
    try {
      const debtId = parseInt(req.params.id);
      const paymentData = insertDebtPaymentSchema.parse({
        ...req.body,
        debtId
      });
      const payment = await storage.createDebtPayment(paymentData);
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create payment" });
      }
    }
  });

  app.get("/api/payments", async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch all payments" });
    }
  });

  // Daily records routes
  app.get("/api/daily-records", async (req, res) => {
    try {
      const records = await storage.getDailyRecords();
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch daily records" });
    }
  });

  // Statistics routes
  app.get("/api/statistics", async (req, res) => {
    try {
      const stats = await storage.getStatistics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Parent Management Routes
  app.get("/api/parent/allowance-settings", async (req, res) => {
    try {
      const parentId = 17; // 使用正確的父母ID
      const allowanceSettings = await storage.getAllowanceSettings(parentId);
      res.json(allowanceSettings);
    } catch (error) {
      console.error("Error fetching allowance settings:", error);
      res.status(500).json({ message: "Failed to fetch allowance settings" });
    }
  });

  app.post("/api/parent/allowance-settings", async (req, res) => {
    try {
      const { childId, amount, frequency, description } = req.body;
      
      const allowanceSetting = await storage.createAllowanceSetting({
        childId,
        parentId: 17,
        amount: amount.toString(),
        frequency,
        nextPaymentDate: new Date(),
        isActive: true
      });
      
      res.status(201).json(allowanceSetting);
    } catch (error) {
      console.error("Error creating allowance setting:", error);
      res.status(500).json({ message: "Failed to create allowance setting" });
    }
  });

  app.patch("/api/parent/allowance-settings/:id", async (req, res) => {
    try {
      const allowanceId = parseInt(req.params.id);
      const updates = req.body;
      
      const updatedSetting = await storage.updateAllowanceSetting(allowanceId, updates);
      res.json(updatedSetting);
    } catch (error) {
      console.error("Error updating allowance setting:", error);
      res.status(500).json({ message: "Failed to update allowance setting" });
    }
  });

  app.post("/api/parent/allowance-payment/:id", async (req, res) => {
    try {
      const allowanceId = parseInt(req.params.id);
      const allowance = await storage.getAllowanceSettingById(allowanceId);
      
      if (!allowance) {
        return res.status(404).json({ message: "Allowance not found" });
      }
      
      const payment = await storage.createAllowancePayment({
        childId: allowance.childId,
        amount: allowance.amount,
        parentId: 17,
        allowanceId: allowanceId,
        paymentDate: new Date()
      });
      
      res.json(payment);
    } catch (error) {
      console.error("Error creating allowance payment:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  app.get("/api/parent/loan-requests", async (req, res) => {
    try {
      const parentId = 17;
      const loanRequests = await storage.getLoanRequests(undefined, parentId);
      
      const loanRequestsWithChildInfo = await Promise.all(
        loanRequests.map(async (loan) => {
          const child = await storage.getFamilyMemberById(loan.childId);
          return {
            ...loan,
            childName: child?.name || 'Unknown',
            amount: parseFloat(loan.amount),
            interestRate: parseFloat(loan.interestRate || '0'),
          };
        })
      );
      
      res.json(loanRequestsWithChildInfo);
    } catch (error) {
      console.error("Error fetching loan requests:", error);
      res.status(500).json({ message: "Failed to fetch loan requests" });
    }
  });

  app.patch('/api/parent/loan-requests/:id/approve', async (req, res) => {
    try {
      const loanId = parseInt(req.params.id);
      const { status, notes, approvedDate } = req.body;
      
      const updatedLoan = await storage.updateLoanRequest(loanId, {
        status,
        approvedDate: approvedDate ? new Date(approvedDate) : new Date()
      });
      
      // Create parent approval record
      await storage.createParentApproval({
        childId: updatedLoan.childId,
        parentId: 17,
        action: status === 'approved' ? 'approve_loan' : 'reject_loan',
        requestType: 'loan',
        requestId: loanId,
        notes
      });
      
      res.json(updatedLoan);
    } catch (error) {
      console.error("Error approving loan:", error);
      res.status(500).json({ message: "Failed to approve loan" });
    }
  });

  app.get("/api/parent/children", async (req, res) => {
    try {
      const parentId = 17;
      const children = await storage.getFamilyMembers(parentId);
      res.json(children);
    } catch (error) {
      console.error("Error fetching children:", error);
      res.status(500).json({ message: "Failed to fetch children" });
    }
  });

  app.post("/api/parent/children", async (req, res) => {
    try {
      const { name, age, avatarUrl } = req.body;
      
      const child = await storage.createFamilyMember({
        parentId: 1,
        name,
        age,
        role: 'child',
        avatarUrl: avatarUrl || null
      });
      
      res.status(201).json(child);
    } catch (error) {
      console.error("Error creating child:", error);
      res.status(500).json({ message: "Failed to create child" });
    }
  });

  app.post("/api/parent/children/:id/avatar", async (req, res) => {
    try {
      const childId = parseInt(req.params.id);
      // Handle avatar upload logic here
      const avatarUrl = `/uploads/avatar_${childId}.jpg`;
      
      const updatedChild = await storage.updateFamilyMember(childId, {
        avatarUrl
      });
      
      res.json(updatedChild);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      res.status(500).json({ message: "Failed to upload avatar" });
    }
  });

  // Kids Management Routes
  app.get("/api/kids/wishlist/:childId", async (req, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const wishlist = await storage.getKidsWishlist(childId);
      res.json(wishlist);
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  app.post("/api/kids/wishlist", async (req, res) => {
    try {
      const wishlistData = insertKidsWishlistSchema.parse(req.body);
      const wishlistItem = await storage.createKidsWishlist(wishlistData);
      res.status(201).json(wishlistItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create wishlist item" });
      }
    }
  });

  app.get("/api/kids/savings/:childId", async (req, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const savings = await storage.getKidsSavings(childId);
      res.json(savings);
    } catch (error) {
      console.error("Error fetching savings:", error);
      res.status(500).json({ message: "Failed to fetch savings" });
    }
  });

  app.post("/api/kids/savings", async (req, res) => {
    try {
      const savingData = insertKidsSavingSchema.parse(req.body);
      const saving = await storage.createKidsSaving(savingData);
      res.status(201).json(saving);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create saving" });
      }
    }
  });

  app.get("/api/kids/loans/:childId", async (req, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const loans = await storage.getKidsLoans(childId);
      res.json(loans);
    } catch (error) {
      console.error("Error fetching loans:", error);
      res.status(500).json({ message: "Failed to fetch loans" });
    }
  });

  app.post("/api/kids/loans", async (req, res) => {
    try {
      const loanData = insertKidsLoanSchema.parse(req.body);
      const loan = await storage.createKidsLoan(loanData);
      res.status(201).json(loan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create loan" });
      }
    }
  });

  app.get("/api/kids/schedule/:childId", async (req, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const schedule = await storage.getKidsSchedule(childId);
      res.json(schedule);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  app.post("/api/kids/schedule", async (req, res) => {
    try {
      const scheduleData = insertKidsScheduleSchema.parse(req.body);
      const scheduleItem = await storage.createKidsSchedule(scheduleData);
      res.status(201).json(scheduleItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create schedule item" });
      }
    }
  });

  // 兒童個別登入系統 API
  app.get("/api/children/accounts", async (req, res) => {
    try {
      const accounts = await storage.getChildAccounts();
      res.json(accounts.map(account => ({
        id: account.childId,
        name: account.childName,
        age: account.childAge,
        avatarUrl: account.avatarUrl,
        memberType: account.memberType
      })));
    } catch (error) {
      console.error("Failed to fetch child accounts:", error);
      res.status(500).json({ message: "Failed to fetch child accounts" });
    }
  });

  app.post("/api/children/login", async (req, res) => {
    try {
      const { childId, pinCode } = req.body;
      
      if (!childId || !pinCode) {
        return res.status(400).json({ message: "childId and pinCode are required" });
      }

      const account = await storage.authenticateChild(childId, pinCode);
      
      if (!account) {
        return res.status(401).json({ message: "Invalid credentials or account locked" });
      }

      // 生成session token
      const sessionToken = `child_${childId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小時後過期

      await storage.updateChildSession(account.id, sessionToken, expiresAt);

      res.json({
        success: true,
        token: sessionToken,
        expiresAt: expiresAt.toISOString(),
        child: {
          id: account.childId,
          name: account.childName || "小朋友"
        }
      });
    } catch (error) {
      console.error("Login failed:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/children/validate-session", async (req, res) => {
    try {
      const { sessionToken } = req.body;
      
      if (!sessionToken) {
        return res.status(400).json({ message: "Session token required" });
      }

      const session = await storage.validateChildSession(sessionToken);
      
      if (!session) {
        return res.status(401).json({ message: "Invalid or expired session" });
      }

      res.json({
        valid: true,
        child: {
          id: session.childId,
          name: session.childName
        }
      });
    } catch (error) {
      console.error("Session validation failed:", error);
      res.status(500).json({ message: "Session validation failed" });
    }
  });

  // 兒童專屬資料API - 只能看到自己的資料
  app.get("/api/children/:childId/wishlist", async (req, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const wishlistItems = await storage.getKidsWishlist(childId);
      res.json(wishlistItems);
    } catch (error) {
      console.error("Failed to fetch child wishlist:", error);
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  app.get("/api/children/:childId/savings", async (req, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const savings = await storage.getKidsSavings(childId);
      res.json(savings);
    } catch (error) {
      console.error("Failed to fetch child savings:", error);
      res.status(500).json({ message: "Failed to fetch savings" });
    }
  });

  app.get("/api/children/:childId/loans", async (req, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const loans = await storage.getKidsLoans(childId);
      res.json(loans);
    } catch (error) {
      console.error("Failed to fetch child loans:", error);
      res.status(500).json({ message: "Failed to fetch loans" });
    }
  });

  app.get("/api/children/:childId/schedule", async (req, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const schedule = await storage.getKidsSchedule(childId);
      res.json(schedule);
    } catch (error) {
      console.error("Failed to fetch child schedule:", error);
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  // 父母管理兒童帳戶 API
  app.get("/api/parent/child-accounts", async (req, res) => {
    try {
      const accounts = await storage.getChildAccounts();
      res.json(accounts);
    } catch (error) {
      console.error("Failed to fetch child accounts for parent:", error);
      res.status(500).json({ message: "Failed to fetch child accounts" });
    }
  });

  app.post("/api/parent/child-accounts", async (req, res) => {
    try {
      const { childId, username, pinCode } = req.body;
      
      if (!childId || !username || !pinCode) {
        return res.status(400).json({ message: "childId, username, and pinCode are required" });
      }

      // 檢查PIN碼格式（4位數字）
      if (!/^\d{4}$/.test(pinCode)) {
        return res.status(400).json({ message: "PIN碼必須是4位數字" });
      }

      const account = await storage.createChildAccount({
        childId,
        username,
        pinCode,
        isActive: true
      });

      res.status(201).json(account);
    } catch (error) {
      console.error("Failed to create child account:", error);
      res.status(500).json({ message: "Failed to create child account" });
    }
  });

  app.put("/api/parent/child-accounts/:childId/pin", async (req, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const { newPinCode } = req.body;
      
      if (!newPinCode) {
        return res.status(400).json({ message: "新PIN碼是必需的" });
      }

      // 檢查PIN碼格式（4位數字）
      if (!/^\d{4}$/.test(newPinCode)) {
        return res.status(400).json({ message: "PIN碼必須是4位數字" });
      }

      const success = await storage.updateChildPin(childId, newPinCode);
      
      if (!success) {
        return res.status(404).json({ message: "找不到該兒童帳戶" });
      }

      res.json({ message: "PIN碼更新成功" });
    } catch (error) {
      console.error("Failed to update child PIN:", error);
      res.status(500).json({ message: "Failed to update PIN" });
    }
  });

  app.post("/api/parent/child-accounts/:childId/unlock", async (req, res) => {
    try {
      const childId = parseInt(req.params.childId);
      
      const success = await storage.unlockChildAccount(childId);
      
      if (!success) {
        return res.status(404).json({ message: "找不到該兒童帳戶" });
      }

      res.json({ message: "帳戶解鎖成功" });
    } catch (error) {
      console.error("Failed to unlock child account:", error);
      res.status(500).json({ message: "Failed to unlock account" });
    }
  });

  // Project Management API Routes
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/stats", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      const totalProjects = projects.length;
      const activeProjects = projects.filter(p => p.status === 'active').length;
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      const totalTasks = 0; // Will be calculated when tasks are implemented
      
      res.json({
        totalProjects,
        activeProjects,
        completedProjects,
        totalTasks
      });
    } catch (error) {
      console.error("Failed to fetch project stats:", error);
      res.status(500).json({ message: "Failed to fetch project stats" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProjectById(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Failed to fetch project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const project = await storage.createProject(req.body);
      res.status(201).json(project);
    } catch (error) {
      console.error("Failed to create project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.updateProject(id, req.body);
      res.json(project);
    } catch (error) {
      console.error("Failed to update project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Project Tasks API Routes
  app.get("/api/projects/:projectId/tasks", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const tasks = await storage.getProjectTasks(projectId);
      res.json(tasks);
    } catch (error) {
      console.error("Failed to fetch project tasks:", error);
      res.status(500).json({ message: "Failed to fetch project tasks" });
    }
  });

  app.post("/api/projects/:projectId/tasks", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const task = await storage.createProjectTask({
        ...req.body,
        projectId
      });
      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create project task:", error);
      res.status(500).json({ message: "Failed to create project task" });
    }
  });

  app.put("/api/projects/:projectId/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.updateProjectTask(id, req.body);
      res.json(task);
    } catch (error) {
      console.error("Failed to update project task:", error);
      res.status(500).json({ message: "Failed to update project task" });
    }
  });

  // Project Tasks (General API Routes)
  app.get("/api/projects/tasks", async (req, res) => {
    try {
      const projectId = req.query.projectId;
      
      // If no projectId provided, return empty array
      if (!projectId || projectId === 'undefined' || projectId === 'NaN') {
        return res.json([]);
      }
      
      const parsedProjectId = parseInt(projectId as string);
      if (isNaN(parsedProjectId)) {
        return res.json([]);
      }
      
      const tasks = await storage.getProjectTasks(parsedProjectId);
      res.json(tasks);
    } catch (error) {
      console.error("Failed to fetch project tasks:", error);
      res.status(500).json({ message: "Failed to fetch project tasks" });
    }
  });

  // 新分類系統 API 端點
  // 家用分類管理
  app.get("/api/household/categories", async (req, res) => {
    try {
      const categories = await db.select().from(householdCategories).orderBy(householdCategories.level, householdCategories.categoryName);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching household categories:", error);
      res.status(500).json({ message: "Failed to fetch household categories" });
    }
  });

  app.post("/api/household/categories", async (req, res) => {
    try {
      const categoryData = insertHouseholdCategorySchema.parse(req.body);
      const [category] = await db.insert(householdCategories).values(categoryData).returning();
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating household category:", error);
      res.status(500).json({ message: "Failed to create household category" });
    }
  });

  // 專案分類管理
  app.get("/api/project/categories", async (req, res) => {
    try {
      const categories = await db.select().from(projectCategories).orderBy(projectCategories.level, projectCategories.categoryName);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching project categories:", error);
      res.status(500).json({ message: "Failed to fetch project categories" });
    }
  });

  app.post("/api/project/categories", async (req, res) => {
    try {
      const categoryData = insertProjectCategorySchema.parse(req.body);
      const [category] = await db.insert(projectCategories).values(categoryData).returning();
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating project category:", error);
      res.status(500).json({ message: "Failed to create project category" });
    }
  });

  // 家用支出管理
  app.get("/api/household/expenses", async (req, res) => {
    try {
      const expenses = await db.select({
        id: householdExpenses.id,
        amount: householdExpenses.amount,
        date: householdExpenses.date,
        description: householdExpenses.description,
        paymentMethod: householdExpenses.paymentMethod,
        categoryId: householdExpenses.categoryId,
        categoryName: householdCategories.categoryName,
        categoryColor: householdCategories.color
      })
      .from(householdExpenses)
      .leftJoin(householdCategories, eq(householdExpenses.categoryId, householdCategories.id))
      .orderBy(desc(householdExpenses.date));
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching household expenses:", error);
      res.status(500).json({ message: "Failed to fetch household expenses" });
    }
  });

  app.post("/api/household/expenses", async (req, res) => {
    try {
      const expenseData = insertHouseholdExpenseSchema.parse(req.body);
      const [expense] = await db.insert(householdExpenses).values(expenseData).returning();
      res.status(201).json(expense);
    } catch (error) {
      console.error("Error creating household expense:", error);
      res.status(500).json({ message: "Failed to create household expense" });
    }
  });

  // 專案支出管理
  app.get("/api/project/expenses", async (req, res) => {
    try {
      const { projectId } = req.query;
      let query = db.select({
        id: projectExpenses.id,
        amount: projectExpenses.amount,
        date: projectExpenses.date,
        description: projectExpenses.description,
        paymentMethod: projectExpenses.paymentMethod,
        projectId: projectExpenses.projectId,
        categoryId: projectExpenses.categoryId,
        categoryName: projectCategories.categoryName,
        categoryColor: projectCategories.color,
        projectName: paymentProjects.projectName
      })
      .from(projectExpenses)
      .leftJoin(projectCategories, eq(projectExpenses.categoryId, projectCategories.id))
      .leftJoin(paymentProjects, eq(projectExpenses.projectId, paymentProjects.id));

      if (projectId) {
        query = query.where(eq(projectExpenses.projectId, parseInt(projectId as string)));
      }

      const expenses = await query.orderBy(desc(projectExpenses.date));
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching project expenses:", error);
      res.status(500).json({ message: "Failed to fetch project expenses" });
    }
  });

  app.post("/api/project/expenses", async (req, res) => {
    try {
      const expenseData = insertProjectExpenseSchema.parse(req.body);
      const [expense] = await db.insert(projectExpenses).values(expenseData).returning();
      res.status(201).json(expense);
    } catch (error) {
      console.error("Error creating project expense:", error);
      res.status(500).json({ message: "Failed to create project expense" });
    }
  });

  // 家用支出統計
  app.get("/api/household/stats", async (req, res) => {
    try {
      const { month } = req.query;
      const currentMonth = month || new Date().toISOString().slice(0, 7);
      
      const stats = await db.select({
        categoryId: householdExpenses.categoryId,
        categoryName: householdCategories.categoryName,
        totalAmount: sql<number>`sum(${householdExpenses.amount})`,
        count: sql<number>`count(*)`
      })
      .from(householdExpenses)
      .leftJoin(householdCategories, eq(householdExpenses.categoryId, householdCategories.id))
      .where(sql`to_char(${householdExpenses.date}, 'YYYY-MM') = ${currentMonth}`)
      .groupBy(householdExpenses.categoryId, householdCategories.categoryName);

      res.json(stats);
    } catch (error) {
      console.error("Error fetching household stats:", error);
      res.status(500).json({ message: "Failed to fetch household stats" });
    }
  });

  // 專案支出統計
  app.get("/api/project/stats", async (req, res) => {
    try {
      const { projectId, month } = req.query;
      const currentMonth = month || new Date().toISOString().slice(0, 7);
      
      let whereCondition = sql`to_char(${projectExpenses.date}, 'YYYY-MM') = ${currentMonth}`;
      if (projectId) {
        whereCondition = and(whereCondition, eq(projectExpenses.projectId, parseInt(projectId as string)));
      }

      const stats = await db.select({
        projectId: projectExpenses.projectId,
        projectName: paymentProjects.projectName,
        categoryId: projectExpenses.categoryId,
        categoryName: projectCategories.categoryName,
        totalAmount: sql<number>`sum(${projectExpenses.amount})`,
        count: sql<number>`count(*)`
      })
      .from(projectExpenses)
      .leftJoin(projectCategories, eq(projectExpenses.categoryId, projectCategories.id))
      .leftJoin(paymentProjects, eq(projectExpenses.projectId, paymentProjects.id))
      .where(whereCondition)
      .groupBy(
        projectExpenses.projectId, 
        paymentProjects.projectName,
        projectExpenses.categoryId, 
        projectCategories.categoryName
      );

      res.json(stats);
    } catch (error) {
      console.error("Error fetching project stats:", error);
      res.status(500).json({ message: "Failed to fetch project stats" });
    }
  });

  // Project Budget Items API Routes
  app.get("/api/projects/budget", async (req, res) => {
    try {
      // Return empty array for now since we don't have global budget method
      res.json([]);
    } catch (error) {
      console.error("Failed to fetch all project budget items:", error);
      res.status(500).json({ message: "Failed to fetch project budget items" });
    }
  });

  app.get("/api/projects/budget/stats", async (req, res) => {
    try {
      // Return default stats for now
      res.json({
        totalBudget: 0,
        totalSpent: 0,
        totalItems: 0
      });
    } catch (error) {
      console.error("Failed to fetch project budget stats:", error);
      res.status(500).json({ message: "Failed to fetch project budget stats" });
    }
  });

  app.get("/api/projects/:projectId/budget", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const budgetItems = await storage.getProjectBudgetItems(projectId);
      res.json(budgetItems);
    } catch (error) {
      console.error("Failed to fetch project budget items:", error);
      res.status(500).json({ message: "Failed to fetch project budget items" });
    }
  });

  app.post("/api/projects/:projectId/budget", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const budgetItem = await storage.createProjectBudgetItem({
        ...req.body,
        projectId
      });
      res.status(201).json(budgetItem);
    } catch (error) {
      console.error("Failed to create project budget item:", error);
      res.status(500).json({ message: "Failed to create project budget item" });
    }
  });

  app.put("/api/projects/:projectId/budget/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const budgetItem = await storage.updateProjectBudgetItem(id, req.body);
      res.json(budgetItem);
    } catch (error) {
      console.error("Failed to update project budget item:", error);
      res.status(500).json({ message: "Failed to update project budget item" });
    }
  });

  // Project Notes API Routes
  app.get("/api/projects/notes", async (req, res) => {
    try {
      // Return empty array for now since we don't have global notes method
      res.json([]);
    } catch (error) {
      console.error("Failed to fetch all project notes:", error);
      res.status(500).json({ message: "Failed to fetch project notes" });
    }
  });

  app.post("/api/projects/notes", async (req, res) => {
    try {
      const projectId = parseInt(req.body.projectId);
      const note = await storage.createProjectNote({
        ...req.body,
        projectId,
        authorId: 1 // Default author ID
      });
      res.status(201).json(note);
    } catch (error) {
      console.error("Failed to create project note:", error);
      res.status(500).json({ message: "Failed to create project note" });
    }
  });

  app.put("/api/projects/notes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const note = await storage.updateProjectNote(id, req.body);
      res.json(note);
    } catch (error) {
      console.error("Failed to update project note:", error);
      res.status(500).json({ message: "Failed to update project note" });
    }
  });

  app.delete("/api/projects/notes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProjectNote(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete project note:", error);
      res.status(500).json({ message: "Failed to delete project note" });
    }
  });

  app.get("/api/projects/:projectId/notes", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const notes = await storage.getProjectNotes(projectId);
      res.json(notes);
    } catch (error) {
      console.error("Failed to fetch project notes:", error);
      res.status(500).json({ message: "Failed to fetch project notes" });
    }
  });

  app.post("/api/projects/:projectId/notes", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const note = await storage.createProjectNote({
        ...req.body,
        projectId,
        authorId: 1 // Default author ID
      });
      res.status(201).json(note);
    } catch (error) {
      console.error("Failed to create project note:", error);
      res.status(500).json({ message: "Failed to create project note" });
    }
  });

  app.put("/api/projects/:projectId/notes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const note = await storage.updateProjectNote(id, req.body);
      res.json(note);
    } catch (error) {
      console.error("Failed to update project note:", error);
      res.status(500).json({ message: "Failed to update project note" });
    }
  });

  // Project Comments API Routes
  app.get("/api/projects/:projectId/comments", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const comments = await storage.getProjectComments(projectId);
      res.json(comments);
    } catch (error) {
      console.error("Failed to fetch project comments:", error);
      res.status(500).json({ message: "Failed to fetch project comments" });
    }
  });

  app.post("/api/projects/:projectId/comments", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const comment = await storage.createProjectComment({
        ...req.body,
        projectId,
        authorId: 1 // Default author ID
      });
      res.status(201).json(comment);
    } catch (error) {
      console.error("Failed to create project comment:", error);
      res.status(500).json({ message: "Failed to create project comment" });
    }
  });

  // Project Comments (General API Routes)
  app.get("/api/projects/comments", async (req, res) => {
    try {
      // Return empty array for now since we don't have global comments method
      res.json([]);
    } catch (error) {
      console.error("Failed to fetch all project comments:", error);
      res.status(500).json({ message: "Failed to fetch project comments" });
    }
  });

  app.post("/api/projects/comments", async (req, res) => {
    try {
      const projectId = parseInt(req.body.projectId);
      const comment = await storage.createProjectComment({
        ...req.body,
        projectId,
        authorId: 1 // Default author ID
      });
      res.status(201).json(comment);
    } catch (error) {
      console.error("Failed to create project comment:", error);
      res.status(500).json({ message: "Failed to create project comment" });
    }
  });

  // Project Files API Routes
  app.get("/api/projects/files", async (req, res) => {
    try {
      // Return empty array for now since we don't have file management implemented
      res.json([]);
    } catch (error) {
      console.error("Failed to fetch all project files:", error);
      res.status(500).json({ message: "Failed to fetch project files" });
    }
  });

  app.post("/api/projects/files", async (req, res) => {
    try {
      // Return mock response for now since we don't have file management implemented
      const mockFile = {
        id: Date.now(),
        fileName: req.body.fileName,
        description: req.body.description,
        projectId: parseInt(req.body.projectId),
        uploadedAt: new Date(),
        uploaderName: 'User'
      };
      res.status(201).json(mockFile);
    } catch (error) {
      console.error("Failed to upload project file:", error);
      res.status(500).json({ message: "Failed to upload project file" });
    }
  });

  // 付款規劃系統 API Routes

  // 專案管理 API
  app.get("/api/payment/projects", async (req, res) => {
    try {
      const projects = await storage.getPaymentProjects();
      res.json(projects);
    } catch (error) {
      console.error("Failed to fetch payment projects:", error);
      res.status(500).json({ message: "Failed to fetch payment projects" });
    }
  });

  app.post("/api/payment/projects", async (req, res) => {
    try {
      const projectData = insertPaymentProjectSchema.parse(req.body);
      const project = await storage.createPaymentProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Failed to create payment project:", error);
        res.status(500).json({ message: "Failed to create payment project" });
      }
    }
  });

  // 付款項目 API
  app.get("/api/payment/items", async (req, res) => {
    try {
      const { type, projectId, status } = req.query;
      const items = await storage.getPaymentItems({
        type: type as string,
        projectId: projectId ? parseInt(projectId as string) : undefined,
        status: status as string
      });
      res.json(items);
    } catch (error) {
      console.error("Failed to fetch payment items:", error);
      res.status(500).json({ message: "Failed to fetch payment items" });
    }
  });

  app.post("/api/payment/items", async (req, res) => {
    try {
      const itemData = insertPaymentItemSchema.parse(req.body);
      const item = await storage.createPaymentItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Failed to create payment item:", error);
        res.status(500).json({ message: "Failed to create payment item" });
      }
    }
  });

  app.put("/api/payment/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const itemData = insertPaymentItemSchema.partial().parse(req.body);
      const item = await storage.updatePaymentItem(id, itemData);
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Failed to update payment item:", error);
        res.status(500).json({ message: "Failed to update payment item" });
      }
    }
  });

  // 付款記錄 API
  app.get("/api/payment/records/:itemId", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }
      const records = await storage.getPaymentRecords(itemId);
      res.json(records);
    } catch (error) {
      console.error("Failed to fetch payment records:", error);
      res.status(500).json({ message: "Failed to fetch payment records" });
    }
  });

  app.post("/api/payment/records", async (req, res) => {
    try {
      const recordData = insertPaymentRecordSchema.parse(req.body);
      const record = await storage.createPaymentRecord(recordData);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Failed to create payment record:", error);
        res.status(500).json({ message: "Failed to create payment record" });
      }
    }
  });

  // 獲取所有付款記錄（帶完整資訊）
  app.get("/api/payment/records/all", async (req, res) => {
    try {
      const records = await storage.getAllPaymentRecords();
      res.json(records);
    } catch (error) {
      console.error("Failed to fetch all payment records:", error);
      res.status(500).json({ message: "Failed to fetch all payment records" });
    }
  });

  // 統計報表 API 端點
  app.get("/api/payment/reports/monthly-trend", async (req, res) => {
    try {
      const period = req.query.period as string || "6months";
      const monthlyData = await storage.getMonthlyPaymentTrend(period);
      res.json(monthlyData);
    } catch (error) {
      console.error("Failed to fetch monthly trend:", error);
      res.status(500).json({ message: "Failed to fetch monthly trend" });
    }
  });

  app.get("/api/payment/reports/payment-methods", async (req, res) => {
    try {
      const methodStats = await storage.getPaymentMethodStats();
      res.json(methodStats);
    } catch (error) {
      console.error("Failed to fetch payment method stats:", error);
      res.status(500).json({ message: "Failed to fetch payment method stats" });
    }
  });

  app.get("/api/payment/reports/top-categories", async (req, res) => {
    try {
      const categoryStats = await storage.getTopCategoriesStats();
      res.json(categoryStats);
    } catch (error) {
      console.error("Failed to fetch category stats:", error);
      res.status(500).json({ message: "Failed to fetch category stats" });
    }
  });

  // 標籤管理 API
  app.get("/api/payment/tags", async (req, res) => {
    try {
      const tags = await storage.getPaymentTags();
      res.json(tags);
    } catch (error) {
      console.error("Failed to fetch payment tags:", error);
      res.status(500).json({ message: "Failed to fetch payment tags" });
    }
  });

  app.post("/api/payment/tags", async (req, res) => {
    try {
      const tagData = insertPaymentTagSchema.parse(req.body);
      const tag = await storage.createPaymentTag(tagData);
      res.status(201).json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Failed to create payment tag:", error);
        res.status(500).json({ message: "Failed to create payment tag" });
      }
    }
  });

  // 預算規劃 API
  app.get("/api/budget/plans", async (req, res) => {
    try {
      const { type, projectId } = req.query;
      const plans = await storage.getBudgetPlans({
        type: type as string,
        projectId: projectId ? parseInt(projectId as string) : undefined
      });
      res.json(plans);
    } catch (error) {
      console.error("Failed to fetch budget plans:", error);
      res.status(500).json({ message: "Failed to fetch budget plans" });
    }
  });

  app.post("/api/budget/plans", async (req, res) => {
    try {
      const planData = insertBudgetPlanSchema.parse(req.body);
      const plan = await storage.createBudgetPlan(planData);
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Failed to create budget plan:", error);
        res.status(500).json({ message: "Failed to create budget plan" });
      }
    }
  });

  // 家用管理統計 API
  app.get("/api/payment/home/stats", async (req, res) => {
    try {
      const { month, year } = req.query;
      const stats = await storage.getHomePaymentStats({
        month: month ? parseInt(month as string) : undefined,
        year: year ? parseInt(year as string) : undefined
      });
      res.json(stats);
    } catch (error) {
      console.error("Failed to fetch home payment stats:", error);
      res.status(500).json({ message: "Failed to fetch home payment stats" });
    }
  });

  // 專案管理統計 API
  app.get("/api/payment/project/stats", async (req, res) => {
    try {
      const { projectId, period } = req.query;
      const stats = await storage.getProjectPaymentStats({
        projectId: projectId ? parseInt(projectId as string) : undefined,
        period: period as string
      });
      res.json(stats);
    } catch (error) {
      console.error("Failed to fetch project payment stats:", error);
      res.status(500).json({ message: "Failed to fetch project payment stats" });
    }
  });

  // 付款標籤 API
  app.get("/api/payment/tags", async (req, res) => {
    try {
      const tags = await storage.getPaymentTags();
      res.json(tags);
    } catch (error) {
      console.error("Failed to fetch payment tags:", error);
      res.status(500).json({ message: "Failed to fetch payment tags" });
    }
  });

  app.post("/api/payment/tags", async (req, res) => {
    try {
      const tag = await storage.createPaymentTag(req.body);
      res.status(201).json(tag);
    } catch (error) {
      console.error("Failed to create payment tag:", error);
      res.status(500).json({ message: "Failed to create payment tag" });
    }
  });

  // Family Members API Route
  app.get("/api/family/members", async (req, res) => {
    try {
      // Return empty array for now since we don't have family member management
      res.json([]);
    } catch (error) {
      console.error("Failed to fetch family members:", error);
      res.status(500).json({ message: "Failed to fetch family members" });
    }
  });

  // 家用財務管理 API 端點
  // Household Budget endpoints
  app.get("/api/household/budgets", async (req, res) => {
    try {
      const { month } = req.query;
      const query = db.select().from(householdBudgets);
      
      if (month) {
        query.where(eq(householdBudgets.month, month as string));
      }
      
      const budgets = await query.orderBy(desc(householdBudgets.createdAt));
      res.json(budgets);
    } catch (error) {
      console.error("Failed to fetch household budgets:", error);
      res.status(500).json({ message: "Failed to fetch household budgets" });
    }
  });

  app.post("/api/household/budgets", async (req, res) => {
    try {
      console.log("Budget request body:", req.body);
      const budgetData = insertHouseholdBudgetSchema.parse(req.body);
      console.log("Parsed budget data:", budgetData);
      const [newBudget] = await db.insert(householdBudgets).values(budgetData).returning();
      res.status(201).json(newBudget);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Failed to create household budget:", error);
        res.status(500).json({ message: "Failed to create household budget" });
      }
    }
  });

  // Household Expense endpoints
  app.get("/api/household/expenses", async (req, res) => {
    try {
      const { month, categoryId, startDate, endDate } = req.query;
      const query = db.select().from(householdExpenses);
      const conditions = [];

      if (month) {
        const monthStart = `${month}-01`;
        const [year, monthNum] = (month as string).split('-');
        const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        const monthEnd = `${month}-${lastDay.toString().padStart(2, '0')}`;
        conditions.push(gte(householdExpenses.date, monthStart));
        conditions.push(lte(householdExpenses.date, monthEnd));
      }

      if (categoryId) {
        conditions.push(eq(householdExpenses.categoryId, parseInt(categoryId as string)));
      }

      if (startDate) {
        conditions.push(gte(householdExpenses.date, startDate as string));
      }

      if (endDate) {
        conditions.push(lte(householdExpenses.date, endDate as string));
      }

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      const expenses = await query.orderBy(desc(householdExpenses.date));
      res.json(expenses);
    } catch (error) {
      console.error("Failed to fetch household expenses:", error);
      res.status(500).json({ message: "Failed to fetch household expenses" });
    }
  });

  app.post("/api/household/expenses", async (req, res) => {
    try {
      const expenseData = insertHouseholdExpenseSchema.parse(req.body);
      const [newExpense] = await db.insert(householdExpenses).values(expenseData).returning();
      res.status(201).json(newExpense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Failed to create household expense:", error);
        res.status(500).json({ message: "Failed to create household expense" });
      }
    }
  });

  // Household Monthly Data endpoint - 預算vs實際對比
  app.get("/api/household/monthly", async (req, res) => {
    try {
      const { month } = req.query;
      const currentMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM格式

      // 獲取指定月份的預算
      const budgets = await db.select().from(householdBudgets)
        .where(eq(householdBudgets.month, currentMonth as string))
        .orderBy(desc(householdBudgets.createdAt));

      // 獲取指定月份的花費
      const monthStart = `${currentMonth}-01`;
      const [year, monthNum] = (currentMonth as string).split('-');
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const monthEnd = `${currentMonth}-${lastDay.toString().padStart(2, '0')}`;
      const expenses = await db.select().from(householdExpenses)
        .where(and(
          gte(householdExpenses.date, monthStart),
          lte(householdExpenses.date, monthEnd)
        ))
        .orderBy(desc(householdExpenses.date));

      // 計算總計
      const totalBudget = budgets.reduce((sum, budget) => sum + parseFloat(budget.budgetAmount), 0);
      const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
      const variance = totalBudget - totalExpenses;

      // 按類別分解
      const categories = await db.select().from(debtCategories).where(eq(debtCategories.isDeleted, false));
      const categoryBreakdown = [];

      for (const category of categories) {
        const categoryBudgets = budgets.filter(b => b.categoryId === category.id);
        const categoryExpenses = expenses.filter(e => e.categoryId === category.id);
        
        const budgetAmount = categoryBudgets.reduce((sum, budget) => sum + parseFloat(budget.budgetAmount), 0);
        const actualAmount = categoryExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        
        if (budgetAmount > 0 || actualAmount > 0) {
          categoryBreakdown.push({
            categoryId: category.id,
            categoryName: category.categoryName,
            budgetAmount,
            actualAmount,
            variance: budgetAmount - actualAmount
          });
        }
      }

      res.json({
        budgets,
        expenses,
        summary: {
          totalBudget,
          totalExpenses,
          variance,
          categoryBreakdown
        }
      });
    } catch (error) {
      console.error("Failed to fetch household monthly data:", error);
      res.status(500).json({ message: "Failed to fetch household monthly data" });
    }
  });

  // Household Budget vs Actual Comparison API
  app.get("/api/household/comparison", async (req, res) => {
    try {
      const { month } = req.query;
      const currentMonth = month || new Date().toISOString().slice(0, 7);

      // 獲取預算數據
      const budgets = await db.select({
        categoryId: householdBudgets.categoryId,
        budgetAmount: householdBudgets.budgetAmount,
        categoryName: debtCategories.categoryName
      })
      .from(householdBudgets)
      .leftJoin(debtCategories, eq(householdBudgets.categoryId, debtCategories.id))
      .where(eq(householdBudgets.month, currentMonth as string));

      // 獲取實際支出數據（從家用付款記錄）
      const monthStart = `${currentMonth}-01`;
      const [year, monthNum] = (currentMonth as string).split('-');
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const monthEnd = `${currentMonth}-${lastDay.toString().padStart(2, '0')}`;

      const actualExpenses = await db.select({
        categoryId: debts.categoryId,
        actualAmount: sql<number>`sum(${debts.paidAmount})`,
        categoryName: debtCategories.categoryName
      })
      .from(debts)
      .leftJoin(debtCategories, eq(debts.categoryId, debtCategories.id))
      .where(and(
        gte(debts.createdAt, new Date(monthStart)),
        lte(debts.createdAt, new Date(monthEnd)),
        eq(debts.isDeleted, 0)
      ))
      .groupBy(debts.categoryId, debtCategories.categoryName);

      // 合併預算和實際數據
      const allCategories = new Map();
      
      budgets.forEach(budget => {
        allCategories.set(budget.categoryId, {
          categoryId: budget.categoryId,
          categoryName: budget.categoryName,
          budget: parseFloat(budget.budgetAmount),
          actual: 0
        });
      });

      actualExpenses.forEach(expense => {
        const existing = allCategories.get(expense.categoryId) || {
          categoryId: expense.categoryId,
          categoryName: expense.categoryName,
          budget: 0,
          actual: 0
        };
        existing.actual = parseFloat(expense.actualAmount.toString());
        allCategories.set(expense.categoryId, existing);
      });

      const categories = Array.from(allCategories.values()).filter(cat => 
        cat.budget > 0 || cat.actual > 0
      );

      const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);
      const totalActual = categories.reduce((sum, cat) => sum + cat.actual, 0);

      res.json({
        categories,
        summary: {
          totalBudget,
          totalActual,
          variance: totalBudget - totalActual
        }
      });
    } catch (error) {
      console.error("Failed to fetch household comparison:", error);
      res.status(500).json({ message: "Failed to fetch household comparison" });
    }
  });

  // 家用分類管理 API
  app.get("/api/categories/household", async (req, res) => {
    try {
      const categories = await storage.getHouseholdCategories();
      res.json(categories);
    } catch (error) {
      console.error("Failed to fetch household categories:", error);
      res.status(500).json({ message: "Failed to fetch household categories" });
    }
  });

  app.post("/api/categories/household", async (req, res) => {
    try {
      const categoryData = req.body;
      const newCategory = await storage.createHouseholdCategory(categoryData);
      res.json(newCategory);
    } catch (error) {
      console.error("Failed to create household category:", error);
      res.status(500).json({ message: "Failed to create household category" });
    }
  });

  app.put("/api/categories/household/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = req.body;
      const updatedCategory = await storage.updateHouseholdCategory(id, categoryData);
      res.json(updatedCategory);
    } catch (error) {
      console.error("Failed to update household category:", error);
      res.status(500).json({ message: "Failed to update household category" });
    }
  });

  app.delete("/api/categories/household/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteHouseholdCategory(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete household category:", error);
      res.status(500).json({ message: "Failed to delete household category" });
    }
  });

  // 初始化家用生活分類
  app.post("/api/categories/household/initialize", async (req, res) => {
    try {
      await storage.initializeHouseholdCategories();
      res.json({ success: true, message: "家用生活分類已初始化" });
    } catch (error) {
      console.error("Failed to initialize household categories:", error);
      res.status(500).json({ message: "Failed to initialize household categories" });
    }
  });

  // 專案分類管理 API
  app.get("/api/categories/project", async (req, res) => {
    try {
      const categories = await storage.getProjectCategories();
      res.json(categories);
    } catch (error) {
      console.error("Failed to fetch project categories:", error);
      res.status(500).json({ message: "Failed to fetch project categories" });
    }
  });

  app.post("/api/categories/project", async (req, res) => {
    try {
      const categoryData = req.body;
      const newCategory = await storage.createProjectCategory(categoryData);
      res.json(newCategory);
    } catch (error) {
      console.error("Failed to create project category:", error);
      res.status(500).json({ message: "Failed to create project category" });
    }
  });

  app.put("/api/categories/project/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = req.body;
      const updatedCategory = await storage.updateProjectCategory(id, categoryData);
      res.json(updatedCategory);
    } catch (error) {
      console.error("Failed to update project category:", error);
      res.status(500).json({ message: "Failed to update project category" });
    }
  });

  app.delete("/api/categories/project/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProjectCategory(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete project category:", error);
      res.status(500).json({ message: "Failed to delete project category" });
    }
  });

  // 初始化專案分類
  app.post("/api/categories/project/initialize", async (req, res) => {
    try {
      await storage.initializeProjectCategories();
      res.json({ success: true, message: "專案分類已初始化" });
    } catch (error) {
      console.error("Failed to initialize project categories:", error);
      res.status(500).json({ message: "Failed to initialize project categories" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}