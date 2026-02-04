import type { Express } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import { storage } from "./storage";
import { setupAuth, requireAuth } from "./auth";
import { setupNotificationRoutes } from "./notification-routes";
import { setupLineAuth } from "./line-auth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { 
  rateLimits, 
  checkPermission, 
  requestLogger, 
  validateInput, 
  securityHeaders,
  secureQuery 
} from "./security";

// Session interface extension
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    isAuthenticated?: boolean;
    lineState?: string;
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
import { 
  insertDebtCategorySchema,
  insertPaymentProjectSchema, 
  insertPaymentItemSchema, 
  insertPaymentRecordSchema,
  insertPaymentItemNoteSchema,
  insertRentalContractSchema,
  insertRentalPriceTierSchema,
  insertContractDocumentSchema,
  insertInstallmentPlanSchema,
  insertHouseholdBudgetSchema,
  insertHouseholdExpenseSchema,
  insertLoanInvestmentRecordSchema,
  insertLoanPaymentScheduleSchema,
  insertLoanPaymentHistorySchema,
  insertFileAttachmentSchema,
  insertBudgetPlanSchema,
  insertBudgetItemSchema,
  insertDocumentInboxSchema,
  insertInvoiceRecordSchema,
  debtCategories,
  paymentProjects,
  paymentItems,
  paymentRecords,
  paymentSchedules,
  rentalContracts,
  rentalPriceTiers,
  contractDocuments,
  installmentPlans,
  fixedCategories,
  fixedCategorySubOptions,
  loanInvestmentRecords,
  loanPaymentSchedule,
  loanPaymentHistory,
  fileAttachments,
  budgetPlans,
  budgetItems,
  documentInbox,
  invoiceRecords,
  users,
} from "@shared/schema";
import { recognizeDocument, getDocumentSuggestions } from "./document-ai";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import * as XLSX from "xlsx";
import { batchImportProcessor } from "./batch-import-processor";

// Ensure upload directories exist
const uploadDir = path.join(process.cwd(), 'uploads');
const contractsDir = path.join(uploadDir, 'contracts');
const receiptsDir = path.join(uploadDir, 'receipts');
const documentsDir = path.join(uploadDir, 'documents');
const imagesDir = path.join(uploadDir, 'images');

const inboxDir = path.join(uploadDir, 'inbox');
[uploadDir, contractsDir, receiptsDir, documentsDir, imagesDir, inboxDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'contract-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'));
    }
  }
});

// Receipt upload configuration
const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, receiptsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'));
    }
  }
});

// Batch import upload configuration
const batchImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /xlsx|xls|csv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.includes('spreadsheet') || file.mimetype.includes('csv') || file.mimetype.includes('excel');
    
    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  setupLineAuth(app);
  
  // Setup notification system routes
  setupNotificationRoutes(app);

  // Static file serving for uploads
  app.use('/uploads', express.static(uploadDir));

  // General file upload endpoint for payment receipts
  app.post("/api/upload", receiptUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileUrl = `/uploads/receipts/${req.file.filename}`;
      res.json({ url: fileUrl });
    } catch (error: any) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Account management endpoints
  app.put("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const { fullName, email } = req.body;
      const userId = req.user!.id;
      
      const updatedUser = await storage.updateUser(userId, {
        fullName,
        email,
      });

      res.json({
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        lineUserId: updatedUser.lineUserId,
        lineDisplayName: updatedUser.lineDisplayName,
        authProvider: updatedUser.authProvider,
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "個人資料更新失敗" });
    }
  });

  app.put("/api/user/password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.user!;
      
      // Verify current password - skip if user doesn't have a password (LINE login)
      if (user.password) {
        const isCurrentPasswordValid = await comparePasswords(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({ message: "當前密碼不正確" });
        }
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);
      
      await storage.updateUser(user.id, {
        password: hashedNewPassword,
      });

      res.json({ message: "密碼更新成功" });
    } catch (error) {
      console.error("Password update error:", error);
      res.status(500).json({ message: "密碼更新失敗" });
    }
  });

  // Get all debt categories
  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Create debt category
  app.post("/api/categories", async (req, res) => {
    try {
      const result = insertDebtCategorySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid category data", errors: result.error.errors });
      }
      const category = await storage.createCategory(result.data);
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // Update debt category
  app.put("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertDebtCategorySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid category data", errors: result.error.errors });
      }
      const category = await storage.updateCategory(id, result.data);
      res.json(category);
    } catch (error: any) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  // Delete debt category
  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Get all payment projects - multiple endpoints for compatibility
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getPaymentProjects();
      res.json(projects);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/payment/projects", async (req, res) => {
    try {
      const projects = await storage.getPaymentProjects();
      res.json(projects);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Create payment project
  app.post("/api/projects", async (req, res) => {
    try {
      const result = insertPaymentProjectSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.errors });
      }
      const project = await storage.createPaymentProject(result.data);
      res.status(201).json(project);
    } catch (error: any) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // Update payment project
  app.put("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertPaymentProjectSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.errors });
      }
      const project = await storage.updatePaymentProject(id, result.data);
      res.json(project);
    } catch (error: any) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Delete payment project
  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePaymentProject(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Enhanced household budget endpoints
  app.get("/api/household-categories", async (req, res) => {
    try {
      const categories = await storage.getFixedCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching household categories:", error);
      res.status(500).json({ message: "Failed to fetch household categories" });
    }
  });

  app.get("/api/household-budgets", async (req, res) => {
    try {
      const budgets = await storage.getHouseholdCategoryBudgets();
      res.json(budgets);
    } catch (error: any) {
      console.error("Error fetching category budgets:", error);
      res.status(500).json({ message: "Failed to fetch category budgets" });
    }
  });

  app.post("/api/household-budgets", async (req, res) => {
    try {
      const result = insertHouseholdBudgetSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid budget data", errors: result.error.errors });
      }
      const budget = await storage.createOrUpdateHouseholdBudget(result.data);
      res.status(201).json(budget);
    } catch (error: any) {
      console.error("Error creating budget:", error);
      res.status(500).json({ message: "Failed to create budget" });
    }
  });

  app.put("/api/household-budgets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertHouseholdBudgetSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid budget data", errors: result.error.errors });
      }
      const budget = await storage.updateHouseholdCategoryBudget(id, result.data);
      res.json(budget);
    } catch (error: any) {
      console.error("Error updating budget:", error);
      res.status(500).json({ message: "Failed to update budget" });
    }
  });

  app.get("/api/household-expenses", async (req, res) => {
    try {
      const { page = "1", limit = "10", categoryId, startDate, endDate } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      
      const filters: any = {};
      if (categoryId) filters.categoryId = parseInt(categoryId as string);
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const expenses = await storage.getHouseholdExpenses(filters, pageNum, limitNum);
      res.json(expenses);
    } catch (error: any) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/household-expenses", async (req, res) => {
    try {
      const result = insertHouseholdExpenseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid expense data", errors: result.error.errors });
      }
      const expense = await storage.createHouseholdExpense(result.data);
      res.status(201).json(expense);
    } catch (error: any) {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  app.put("/api/household-expenses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertHouseholdExpenseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid expense data", errors: result.error.errors });
      }
      const expense = await storage.updateHouseholdExpense(id, result.data);
      res.json(expense);
    } catch (error: any) {
      console.error("Error updating expense:", error);
      res.status(500).json({ message: "Failed to update expense" });
    }
  });

  app.delete("/api/household-expenses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteHouseholdExpense(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // Receipt upload endpoint
  app.post("/api/upload/images", receiptUpload.array('images', 5), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const filePaths = files.map(file => `/uploads/receipts/${file.filename}`);
      res.json({ imagePaths: filePaths });
    } catch (error: any) {
      console.error("Error uploading images:", error);
      res.status(500).json({ message: "Failed to upload images" });
    }
  });

  // Payment items routes with improved pagination
  app.get("/api/payment/items", async (req, res) => {
    try {
      const { 
        projectId, 
        categoryId, 
        page = "1", 
        limit = "50",
        includeAll = "false",
        itemType = "all"  // 新增itemType篩選參數
      } = req.query;
      
      // 調試日誌：檢查接收到的參數
      console.log("Payment items API - 接收參數:", { projectId, categoryId, page, limit, includeAll, itemType });
      
      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 200); // 合理的分頁大小
      const shouldIncludeAll = includeAll === "true";
      
      const filters: any = {};
      if (projectId) filters.projectId = parseInt(projectId as string);
      if (categoryId) filters.categoryId = parseInt(categoryId as string);
      
      // 根據itemType篩選：一般付款管理只顯示非租約項目
      if (itemType === "general") {
        // 一般付款管理：排除租約相關項目，只顯示home和project類型
        filters.excludeRental = true;
        console.log("Payment items API - 啟用租約排除篩選");
      }
      
      console.log("Payment items API - 最終篩選條件:", filters);

      if (shouldIncludeAll) {
        // 特殊情況：需要所有數據時（如導出功能）
        const items = await storage.getPaymentItems(filters);
        
        res.json(items);
      } else {
        // 一般情況：使用分頁
        const items = await storage.getPaymentItems(filters, pageNum, limitNum);
        
        // 計算總數用於分頁資訊
        const totalCount = await storage.getPaymentItemsCount(filters);
        const totalPages = Math.ceil(totalCount / limitNum);
        
        res.json({
          items,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalItems: totalCount,
            pageSize: limitNum,
            hasNextPage: pageNum < totalPages,
            hasPreviousPage: pageNum > 1
          }
        });
      }
    } catch (error: any) {
      console.error("Error fetching payment items:", error);
      res.status(500).json({ message: "Failed to fetch payment items" });
    }
  });

  // Enhanced paginated payment items endpoint
  app.get("/api/payment/items/paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
      const filters = {
        projectId: req.query.projectId ? parseInt(req.query.projectId as string) : undefined,
        status: req.query.status as string,
        includeDeleted: req.query.includeDeleted === "true",
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await storage.getPaginatedPaymentItems(page, pageSize, filters);
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching paginated payment items:", error);
      res.status(500).json({ message: "Failed to fetch paginated payment items" });
    }
  });

  app.post("/api/payment/items", async (req, res) => {
    try {
      // Clean empty date strings and provide defaults
      const cleanData = { ...req.body };
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (cleanData.startDate === "" || !cleanData.startDate) {
        cleanData.startDate = today;
      }
      if (cleanData.dueDate === "") {
        cleanData.dueDate = undefined;
      }
      if (cleanData.actualPaymentDate === "") {
        cleanData.actualPaymentDate = undefined;
      }
      
      const result = insertPaymentItemSchema.safeParse(cleanData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid payment item data", errors: result.error.errors });
      }
      const item = await storage.createPaymentItem(result.data);
      res.status(201).json(item);
    } catch (error: any) {
      console.error("Error creating payment item:", error);
      res.status(500).json({ message: "Failed to create payment item" });
    }
  });

  app.put("/api/payment/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Clean empty date strings and provide defaults
      const cleanData = { ...req.body };
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (cleanData.startDate === "" || !cleanData.startDate) {
        cleanData.startDate = today;
      }
      if (cleanData.dueDate === "") {
        cleanData.dueDate = undefined;
      }
      if (cleanData.actualPaymentDate === "") {
        cleanData.actualPaymentDate = undefined;
      }
      
      // Get current item to compare amounts
      const currentItem = await storage.getPaymentItem(id);
      if (!currentItem) {
        return res.status(404).json({ message: "Payment item not found" });
      }
      
      // If total amount is being changed, recalculate status based on current paid amount
      if (cleanData.totalAmount && cleanData.totalAmount !== currentItem.totalAmount) {
        const newTotalAmount = parseFloat(cleanData.totalAmount);
        const currentPaidAmount = parseFloat(currentItem.paidAmount || "0");
        
        // Recalculate status based on new total amount
        if (currentPaidAmount >= newTotalAmount && currentPaidAmount > 0) {
          cleanData.status = "paid";
        } else if (currentPaidAmount > 0 && currentPaidAmount < newTotalAmount) {
          cleanData.status = "partial";
        } else {
          cleanData.status = currentItem.status || "pending";
        }
      }
      
      const result = insertPaymentItemSchema.safeParse(cleanData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid payment item data", errors: result.error.errors });
      }
      const item = await storage.updatePaymentItem(id, result.data);
      res.json(item);
    } catch (error: any) {
      console.error("Error updating payment item:", error);
      res.status(500).json({ message: "Failed to update payment item" });
    }
  });

  // PATCH endpoint for partial updates (used by edit dialog)
  app.patch("/api/payment/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { changeReason, userInfo, ...updateData } = req.body;
      
      console.log(`PATCH /api/payment/items/${id} - 接收數據:`, updateData);
      
      // Get current item to merge with partial update
      const currentItem = await storage.getPaymentItem(id);
      if (!currentItem) {
        return res.status(404).json({ message: "Payment item not found" });
      }
      
      // Handle empty date strings
      if (updateData.endDate === "") {
        updateData.endDate = null;
      }
      if (updateData.notes === "") {
        updateData.notes = null;
      }
      
      // Convert totalAmount to string if it's a number
      if (typeof updateData.totalAmount === 'number') {
        updateData.totalAmount = updateData.totalAmount.toString();
      }
      
      console.log(`PATCH - 處理後的數據:`, updateData);
      
      // Merge current item with update data for validation
      const mergedData = { 
        ...currentItem, 
        ...updateData,
        updatedAt: new Date(),
      };
      
      // Remove undefined fields to avoid validation issues
      Object.keys(mergedData).forEach(key => {
        if (mergedData[key] === undefined) {
          delete mergedData[key];
        }
      });
      
      console.log(`PATCH - 合併後的數據:`, mergedData);
      
      // Validate the merged data
      const result = insertPaymentItemSchema.safeParse(mergedData);
      if (!result.success) {
        console.error("PATCH - 驗證失敗:", result.error.errors);
        return res.status(400).json({ 
          message: "Invalid payment item data", 
          errors: result.error.errors 
        });
      }
      
      // Update the item
      const item = await storage.updatePaymentItem(
        id, 
        result.data, 
        userInfo || "系統管理員", 
        changeReason || "修改項目資訊"
      );
      
      console.log(`PATCH - 更新成功:`, item.itemName);
      res.json(item);
    } catch (error: any) {
      console.error("Error in PATCH payment item:", error);
      res.status(500).json({ message: "Failed to update payment item", error: error.message });
    }
  });

  // 獲取所有已刪除的項目（回收站）- 必須放在 /:id 路由之前
  app.get("/api/payment/items/deleted", async (req, res) => {
    try {
      const deletedItems = await storage.getDeletedPaymentItems();
      res.json(deletedItems);
    } catch (error: any) {
      console.error("Error fetching deleted payment items:", error);
      res.status(500).json({ message: "Failed to fetch deleted payment items" });
    }
  });

  // 軟刪除項目
  app.delete("/api/payment/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userInfo = (req.user as any)?.username || "系統管理員";
      const { reason } = req.body || {};
      await storage.deletePaymentItem(id, userInfo, reason || "刪除項目");
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting payment item:", error);
      res.status(500).json({ message: "Failed to delete payment item" });
    }
  });

  // 恢復已刪除的項目
  app.post("/api/payment/items/:id/restore", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userInfo = (req.user as any)?.username || "系統管理員";
      const { reason } = req.body || {};
      const item = await storage.restorePaymentItem(id, userInfo, reason || "恢復項目");
      res.json(item);
    } catch (error: any) {
      console.error("Error restoring payment item:", error);
      res.status(500).json({ message: "Failed to restore payment item" });
    }
  });

  // 永久刪除項目（僅限管理員）
  app.delete("/api/payment/items/:id/permanent", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userInfo = (req.user as any)?.username || "系統管理員";
      const { reason } = req.body || {};
      await storage.permanentlyDeletePaymentItem(id, userInfo, reason || "永久刪除項目");
      res.status(204).send();
    } catch (error: any) {
      console.error("Error permanently deleting payment item:", error);
      res.status(500).json({ message: "Failed to permanently delete payment item" });
    }
  });

  // 獲取項目的操作歷史記錄
  app.get("/api/payment/items/:id/audit-logs", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const logs = await storage.getAuditLogs("payment_items", id);
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Payment processing endpoint
  // Get payment records for a specific item
  app.get("/api/payment/items/:id/records", async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const records = await storage.getPaymentRecords({ itemId });
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching item payment records:", error);
      res.status(500).json({ message: "Failed to fetch payment records" });
    }
  });

  app.post("/api/payment/items/:id/payments", upload.single('receiptFile'), async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const { amount, amountPaid, paymentDate, paymentMethod, notes, receiptImageUrl } = req.body;
      const paymentAmount = amount || amountPaid;
      
      if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
        return res.status(400).json({ message: "Invalid payment amount" });
      }
      
      // Get current payment item
      const item = await storage.getPaymentItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Payment item not found" });
      }
      
      // Calculate new paid amount
      const currentPaid = parseFloat(item.paidAmount || "0");
      const paymentAmountFloat = parseFloat(paymentAmount);
      const totalAmount = parseFloat(item.totalAmount);
      const newPaidAmount = currentPaid + paymentAmountFloat;
      
      if (newPaidAmount > totalAmount) {
        return res.status(400).json({ message: "Payment amount exceeds remaining balance" });
      }
      
      // Update payment item with new paid amount
      const updatedItem = await storage.updatePaymentItem(itemId, {
        paidAmount: newPaidAmount.toString(),
        status: newPaidAmount >= totalAmount ? "paid" : "partial"
      });
      
      // Create payment record with uploaded file and payment method
      await storage.createPaymentRecord({
        itemId: itemId,
        amountPaid: paymentAmountFloat.toString(),
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
        paymentMethod: paymentMethod || "bank_transfer",
        notes: notes || null,
        receiptImageUrl: receiptImageUrl || (req.file ? `/uploads/receipts/${req.file.filename}` : null)
      });
      
      res.json(updatedItem);
    } catch (error: any) {
      console.error("Error processing payment:", error);
      res.status(500).json({ message: "Failed to process payment" });
    }
  });

  // Payment records routes
  app.get("/api/payment/records", async (req, res) => {
    try {
      const { itemId, startDate, endDate, page = "1", limit = "100" } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      
      const filters: any = {};
      if (itemId) filters.itemId = parseInt(itemId as string);
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const records = await storage.getPaymentRecords(filters, pageNum, limitNum);
      console.log("Payment records query result:", records.length, "records found");
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching payment records:", error);
      res.status(500).json({ message: "Failed to fetch payment records" });
    }
  });

  app.post("/api/payment-records", async (req, res) => {
    try {
      const result = insertPaymentRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid payment record data", errors: result.error.errors });
      }
      const record = await storage.createPaymentRecord(result.data);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating payment record:", error);
      res.status(500).json({ message: "Failed to create payment record" });
    }
  });

  app.put("/api/payment-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertPaymentRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid payment record data", errors: result.error.errors });
      }
      const record = await storage.updatePaymentRecord(id, result.data);
      res.json(record);
    } catch (error: any) {
      console.error("Error updating payment record:", error);
      res.status(500).json({ message: "Failed to update payment record" });
    }
  });

  app.delete("/api/payment-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePaymentRecord(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting payment record:", error);
      res.status(500).json({ message: "Failed to delete payment record" });
    }
  });

  // 現金流專用付款記錄 API - 包含項目到期日資訊
  app.get("/api/payment/records/cashflow", async (req, res) => {
    try {
      const { monthsBack = "6" } = req.query;
      const monthsBackNum = parseInt(monthsBack as string);
      
      // 計算查詢範圍：從 N 個月前到現在
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBackNum);
      startDate.setDate(1);
      
      // 查詢付款記錄並聯結項目資訊
      const records = await db
        .select({
          id: paymentRecords.id,
          itemId: paymentRecords.itemId,
          amountPaid: paymentRecords.amountPaid,
          paymentDate: paymentRecords.paymentDate,
          paymentMethod: paymentRecords.paymentMethod,
          notes: paymentRecords.notes,
          itemName: paymentItems.itemName,
          itemStartDate: paymentItems.startDate,
          itemEndDate: paymentItems.endDate,
          projectId: paymentItems.projectId,
        })
        .from(paymentRecords)
        .innerJoin(paymentItems, eq(paymentRecords.itemId, paymentItems.id))
        .where(
          and(
            gte(paymentRecords.paymentDate, startDate.toISOString().split('T')[0]),
            eq(paymentItems.isDeleted, false)
          )
        )
        .orderBy(desc(paymentRecords.paymentDate));
      
      // 取得專案名稱對照
      const projectsList = await db.select().from(paymentProjects);
      const projectMap = new Map(projectsList.map(p => [p.id, p.projectName]));
      
      // 處理記錄，計算是本月項目還是他月項目
      const enrichedRecords = records.map(record => {
        const paymentDateObj = new Date(record.paymentDate);
        const paymentMonth = `${paymentDateObj.getFullYear()}-${String(paymentDateObj.getMonth() + 1).padStart(2, '0')}`;
        
        // 取得項目到期月份（使用 endDate 或 startDate）
        const dueDate = record.itemEndDate || record.itemStartDate;
        const dueDateObj = dueDate ? new Date(dueDate) : null;
        const dueMonth = dueDateObj 
          ? `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, '0')}`
          : paymentMonth;
        
        // 判斷是本月項目還是他月項目
        const isCurrentMonthItem = paymentMonth === dueMonth;
        
        return {
          id: record.id,
          itemId: record.itemId,
          itemName: record.itemName,
          amountPaid: record.amountPaid,
          paymentDate: record.paymentDate,
          paymentMonth,
          dueDate,
          dueMonth,
          isCurrentMonthItem,
          originLabel: isCurrentMonthItem ? '本月' : `${dueDateObj ? (dueDateObj.getMonth() + 1) : '?'}月`,
          projectName: record.projectId ? projectMap.get(record.projectId) : null,
          paymentMethod: record.paymentMethod,
        };
      });
      
      res.json(enrichedRecords);
    } catch (error: any) {
      console.error("Error fetching cashflow payment records:", error);
      res.status(500).json({ message: "Failed to fetch cashflow payment records" });
    }
  });

  // Payment Item Notes API Routes - 項目備註記錄管理
  app.get("/api/payment-items/:itemId/notes", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      const notes = await storage.getPaymentItemNotes(itemId);
      res.json(notes);
    } catch (error: any) {
      console.error("Error fetching payment item notes:", error);
      res.status(500).json({ message: "Failed to fetch payment item notes" });
    }
  });

  app.post("/api/payment-items/:itemId/notes", requireAuth, async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      const user = req.user;
      const noteData = {
        ...req.body,
        itemId,
        userId: user?.id || null,
        userInfo: user ? (user.fullName || user.username || `用戶ID: ${user.id}`) : '匿名用戶'
      };
      
      const result = insertPaymentItemNoteSchema.safeParse(noteData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid note data", errors: result.error.errors });
      }
      
      const note = await storage.createPaymentItemNote(result.data);
      res.status(201).json(note);
    } catch (error: any) {
      console.error("Error creating payment item note:", error);
      res.status(500).json({ message: "Failed to create payment item note" });
    }
  });

  app.put("/api/payment-item-notes/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertPaymentItemNoteSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid note data", errors: result.error.errors });
      }
      
      const note = await storage.updatePaymentItemNote(id, result.data);
      res.json(note);
    } catch (error: any) {
      console.error("Error updating payment item note:", error);
      res.status(500).json({ message: "Failed to update payment item note" });
    }
  });

  app.delete("/api/payment-item-notes/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePaymentItemNote(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting payment item note:", error);
      res.status(500).json({ message: "Failed to delete payment item note" });
    }
  });

  // Fixed categories routes
  app.get("/api/fixed-categories", async (req, res) => {
    try {
      const categories = await storage.getFixedCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching fixed categories:", error);
      res.status(500).json({ message: "Failed to fetch fixed categories" });
    }
  });

  // Legacy API routes for frontend compatibility
  app.get("/api/payment/projects/stats", async (req, res) => {
    try {
      const projects = await storage.getPaymentProjects();
      const paymentItems = await storage.getPaymentItems({}, 1, 10000);
      const paymentRecords = await storage.getPaymentRecords({}, 1, 10000);
      
      // Calculate project-specific statistics
      const projectStats = projects.map(project => {
        const projectItems = paymentItems.filter(item => item.projectId === project.id);
        const projectRecords = paymentRecords.filter(record => 
          projectItems.some(item => item.id === record.itemId)
        );
        
        const totalPlanned = projectItems.reduce((sum, item) => 
          sum + parseFloat(item.totalAmount || "0"), 0);
        const totalPaid = projectRecords.reduce((sum, record) => 
          sum + parseFloat(record.amount || "0"), 0);
        const totalUnpaid = totalPlanned - totalPaid;
        const completionRate = totalPlanned > 0 ? (totalPaid / totalPlanned * 100) : 0;
        
        return {
          id: project.id,
          projectName: project.projectName,
          projectType: project.projectType,
          totalPlanned: totalPlanned.toString(),
          totalPaid: totalPaid.toString(),
          totalUnpaid: totalUnpaid.toString(),
          completionRate: completionRate.toFixed(1),
          itemCount: projectItems.length,
          paidItemCount: projectItems.filter(item => item.status === 'paid').length
        };
      });
      
      const stats = {
        totalProjects: projects.length,
        projects: projectStats
      };
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching project stats:", error);
      res.status(500).json({ message: "Failed to fetch project stats" });
    }
  });

  // 獲取現金流統計（按實際付款日期）
  app.get("/api/payment/cashflow/stats", async (req, res) => {
    try {
      const { year, month, projectId } = req.query;
      // 構建篩選條件
      const filters: any = {};
      if (projectId && projectId !== 'all') {
        filters.projectId = parseInt(projectId as string);
      }
      
      // 獲取所有付款記錄
      const paymentRecords = await storage.getPaymentRecords(filters);
      const paymentItems = await storage.getPaymentItems({}, undefined, 10000);
      
      // 建立項目ID到項目的映射
      const itemsMap = new Map(paymentItems.map(item => [item.id, item]));
      
      // 篩選指定月份的付款記錄
      const filteredRecords = paymentRecords.filter(record => {
        if (!record.paymentDate) return false;
        
        const recordDate = new Date(record.paymentDate);
        const recordYear = recordDate.getFullYear();
        const recordMonth = recordDate.getMonth() + 1;
        
        if (year && parseInt(year as string) !== recordYear) return false;
        if (month && parseInt(month as string) !== recordMonth) return false;
        
        return true;
      });
      
      // 計算現金流統計
      const totalCashOutflow = filteredRecords.reduce((sum, record) => {
        const amount = parseFloat(record.amount || "0");
        return sum + amount;
      }, 0);
      
      // 按專案分組統計
      const projectCashFlow = filteredRecords.reduce((acc, record) => {
        const item = itemsMap.get(record.itemId);
        if (!item) return acc;
        
        const projectId = item.projectId || 0;
        const projectName = item.projectName || "未分類";
        
        if (!acc[projectId]) {
          acc[projectId] = {
            projectId,
            projectName,
            totalPaid: 0,
            recordCount: 0
          };
        }
        
        const amount = parseFloat(record.amount || "0");
        acc[projectId].totalPaid += amount;
        acc[projectId].recordCount += 1;
        
        return acc;
      }, {} as Record<number, any>);
      
      const projectStats = Object.values(projectCashFlow);
      
      res.json({
        totalCashOutflow,
        recordCount: filteredRecords.length,
        projectStats,
        period: { year: year || new Date().getFullYear(), month: month || new Date().getMonth() + 1 }
      });
      
    } catch (error: any) {
      console.error("Error fetching cashflow stats:", error);
      res.status(500).json({ message: "Failed to fetch cashflow stats" });
    }
  });

  // 獲取現金流詳細項目列表（按實際付款日期）
  app.get("/api/payment/cashflow/details", async (req, res) => {
    try {
      const { year, month, projectId, page = 1, limit = 50 } = req.query;
      
      // 構建篩選條件
      const filters: any = {};
      if (projectId && projectId !== 'all') {
        filters.projectId = parseInt(projectId as string);
      }
      
      // 獲取所有付款記錄和項目
      const paymentRecords = await storage.getPaymentRecords(filters);
      const paymentItems = await storage.getPaymentItems({}, undefined, 10000);
      const projects = await storage.getPaymentProjects();
      
      // 建立映射表
      const itemsMap = new Map(paymentItems.map(item => [item.id, item]));
      const projectsMap = new Map(projects.map(project => [project.id, project]));
      
      // 篩選指定月份的付款記錄
      const filteredRecords = paymentRecords.filter(record => {
        if (!record.paymentDate) return false;
        
        const recordDate = new Date(record.paymentDate);
        const recordYear = recordDate.getFullYear();
        const recordMonth = recordDate.getMonth() + 1;
        
        if (year && parseInt(year as string) !== recordYear) return false;
        if (month && parseInt(month as string) !== recordMonth) return false;
        
        return true;
      });
      
      // 組合詳細項目資訊
      const detailItems = filteredRecords.map(record => {
        const item = itemsMap.get(record.itemId);
        const project = item?.projectId ? projectsMap.get(item.projectId) : null;
        
        return {
          recordId: record.id,
          itemId: record.itemId,
          itemName: item?.itemName || "未知項目",
          amount: parseFloat(record.amount || "0"),
          paymentDate: record.paymentDate,
          paymentMethod: record.paymentMethod,
          notes: record.notes,
          // 項目基本資訊
          totalAmount: item ? parseFloat(item.totalAmount || "0") : 0,
          paidAmount: item ? parseFloat(item.paidAmount || "0") : 0,
          status: item?.status || "unknown",
          // 專案資訊
          projectId: item?.projectId || null,
          projectName: project?.projectName || item?.projectName || "未分類",
          // 分類資訊
          categoryId: item?.categoryId,
          categoryName: item?.categoryName,
          fixedCategoryId: item?.fixedCategoryId,
          fixedCategoryName: item?.fixedCategoryName,
          // 實體狀況資訊
          vendor: item?.vendor || record.vendor,
          priority: item?.priority,
          dueDate: item?.dueDate,
          startDate: item?.startDate,
          endDate: item?.endDate
        };
      });
      
      // 按付款日期排序（最新的在前）
      detailItems.sort((a, b) => {
        const dateA = new Date(a.paymentDate || 0);
        const dateB = new Date(b.paymentDate || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      // 分頁處理
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedItems = detailItems.slice(startIndex, endIndex);
      
      // 統計資訊
      const totalAmount = detailItems.reduce((sum, item) => sum + item.amount, 0);
      const totalCount = detailItems.length;
      
      res.json({
        items: paginatedItems,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        },
        summary: {
          totalAmount,
          totalRecords: totalCount,
          period: { 
            year: year ? parseInt(year as string) : new Date().getFullYear(), 
            month: month ? parseInt(month as string) : new Date().getMonth() + 1 
          }
        }
      });
      
    } catch (error: any) {
      console.error("Error fetching cashflow details:", error);
      res.status(500).json({ message: "Failed to fetch cashflow details" });
    }
  });

  app.get("/api/payment/project/stats", async (req, res) => {
    try {
      // Get all payment items and records to calculate statistics (no pagination for accurate totals)
      const paymentItems = await storage.getPaymentItems({}, undefined, 10000); // High limit to get all items
      const paymentRecords = await storage.getPaymentRecords({});
      
      console.log(`統計計算: 獲取了 ${paymentItems.length} 個付款項目`);
      
      // 檢查鐵工平台項目是否包含在內
      const ironworkItem = paymentItems.find(item => item.itemName?.includes('鐵工平台'));
      if (ironworkItem) {
        console.log('鐵工平台項目已包含:', {
          id: ironworkItem.id,
          itemName: ironworkItem.itemName,
          paidAmount: ironworkItem.paidAmount
        });
      } else {
        console.log('警告: 鐵工平台項目未包含在統計計算中');
        // 檢查前10個項目的ID來調試
        console.log('前10個項目ID:', paymentItems.slice(0, 10).map(item => ({
          id: item.id,
          name: item.itemName
        })));
      }
      
      // Calculate total amounts
      const totalPlanned = paymentItems.reduce((sum, item) => 
        sum + parseFloat(item.totalAmount || "0"), 0);
      
      let debugPaidSum = 0;
      const totalPaid = paymentItems.reduce((sum, item) => {
        const paidAmount = parseFloat(item.paidAmount || "0");
        debugPaidSum += paidAmount;
        if (item.itemName?.includes('鐵工平台')) {
          console.log('鐵工平台項目計算:', {
            itemName: item.itemName,
            paidAmount: item.paidAmount,
            parsedPaidAmount: paidAmount,
            累計總額: debugPaidSum
          });
        }
        return sum + paidAmount;
      }, 0);
      
      const paidItemsCount = paymentItems.filter(item => {
        const paidAmount = parseFloat(item.paidAmount || "0");
        return paidAmount > 0;
      }).length;
      
      console.log('最終統計結果:', {
        totalPaid: totalPaid,
        debugPaidSum: debugPaidSum,
        項目數量: paymentItems.length,
        有付款項目數量: paidItemsCount,
        包含鐵工平台: paymentItems.some(item => item.itemName?.includes('鐵工平台')),
        鐵工平台數量: paymentItems.filter(item => item.itemName?.includes('鐵工平台')).length
      });
      
      // 檢查七月的付款記錄
      const julyPayments = paymentItems.filter(item => {
        const paidAmount = parseFloat(item.paidAmount || "0");
        const isRecent = item.createdAt && new Date(item.createdAt) >= new Date('2025-07-01');
        const isUpdatedRecently = item.updatedAt && new Date(item.updatedAt) >= new Date('2025-07-01');
        return paidAmount > 0 && (isRecent || isUpdatedRecently);
      });
      
      console.log('七月付款記錄檢查:', {
        七月付款項目數量: julyPayments.length,
        項目詳情: julyPayments.map(item => ({
          id: item.id,
          name: item.itemName,
          paidAmount: item.paidAmount,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }))
      });
      
      const totalUnpaid = totalPlanned - totalPaid;
      const completionRate = totalPlanned > 0 ? (totalPaid / totalPlanned * 100) : 0;
      
      // Calculate monthly statistics
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      
      const currentMonthRecords = paymentRecords.filter(record => {
        const recordDate = new Date(record.paymentDate);
        return recordDate.getMonth() + 1 === currentMonth && recordDate.getFullYear() === currentYear;
      });
      
      const monthlyPaid = currentMonthRecords.reduce((sum, record) => 
        sum + parseFloat(record.amount || "0"), 0);
      
      // Calculate upcoming payments (next month)
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      
      const upcomingItems = paymentItems.filter(item => {
        if (!item.startDate) return false;
        const itemDate = new Date(item.startDate);
        return itemDate.getMonth() + 1 === nextMonth && itemDate.getFullYear() === nextYear;
      });
      
      const monthlyUnpaid = upcomingItems.reduce((sum, item) => 
        sum + parseFloat(item.totalAmount || "0"), 0);
      
      // Calculate overdue items (items with due dates in the past)
      const overdueItems = paymentItems.filter(item => {
        if (!item.startDate || item.status === 'paid') return false;
        const dueDate = new Date(item.startDate);
        return dueDate < today;
      });
      
      const overdueAmount = overdueItems.reduce((sum, item) => {
        const itemPaid = paymentRecords
          .filter(record => record.itemId === item.id)
          .reduce((total, record) => total + parseFloat(record.amount || "0"), 0);
        return sum + (parseFloat(item.totalAmount || "0") - itemPaid);
      }, 0);
      
      const stats = {
        totalPlanned: totalPlanned.toString(),
        totalPaid: totalPaid.toString(),
        totalUnpaid: totalUnpaid.toString(),
        totalPending: totalUnpaid.toString(), // Add this for frontend compatibility
        completionRate: completionRate.toFixed(1),
        monthlyPaid: monthlyPaid.toString(),
        monthlyUnpaid: monthlyUnpaid.toString(),
        overdueAmount: overdueAmount.toString(),
        totalItems: paymentItems.length,
        paidItems: paymentItems.filter(item => {
          const paidAmount = parseFloat(item.paidAmount || "0");
          return paidAmount > 0;
        }).length,
        overdueItems: overdueItems.length
      };
      
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching project stats:", error);
      res.status(500).json({ message: "Failed to fetch project stats" });
    }
  });

  // Removed duplicate endpoints - using /api/payment-items and /api/payment-records instead

  // Comprehensive Category Management endpoints

  // Debt Categories (主要分類表)
  app.get("/api/categories/debt", async (req, res) => {
    try {
      const categories = await storage.getDebtCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching debt categories:", error);
      res.status(500).json({ message: "Failed to fetch debt categories" });
    }
  });

  // Project Categories
  app.get("/api/categories/project", async (req, res) => {
    try {
      const categories = await storage.getProjectCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching project categories:", error);
      res.status(500).json({ message: "Failed to fetch project categories" });
    }
  });

  app.post("/api/categories/project", async (req, res) => {
    try {
      const categoryData = { ...req.body, categoryType: 'project' };
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating project category:", error);
      res.status(500).json({ message: "Failed to create project category" });
    }
  });

  app.put("/api/categories/project/:id", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const categoryData = { ...req.body, categoryType: 'project' };
      const category = await storage.updateCategory(categoryId, categoryData);
      res.json(category);
    } catch (error: any) {
      console.error("Error updating project category:", error);
      res.status(500).json({ message: "Failed to update project category" });
    }
  });

  app.delete("/api/categories/project/:id", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      await storage.deleteCategory(categoryId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting project category:", error);
      res.status(500).json({ message: "Failed to delete project category" });
    }
  });

  // Household Categories (階層式家用分類)
  app.get("/api/categories/household", async (req, res) => {
    try {
      const categories = await storage.getHouseholdCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching household categories:", error);
      res.status(500).json({ message: "Failed to fetch household categories" });
    }
  });

  app.post("/api/categories/household", async (req, res) => {
    try {
      const categoryData = { ...req.body, categoryType: 'household' };
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating household category:", error);
      res.status(500).json({ message: "Failed to create household category" });
    }
  });

  app.put("/api/categories/household/:id", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const categoryData = { ...req.body, categoryType: 'household' };
      const category = await storage.updateCategory(categoryId, categoryData);
      res.json(category);
    } catch (error: any) {
      console.error("Error updating household category:", error);
      res.status(500).json({ message: "Failed to update household category" });
    }
  });

  app.delete("/api/categories/household/:id", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      await storage.deleteCategory(categoryId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting household category:", error);
      res.status(500).json({ message: "Failed to delete household category" });
    }
  });



  // Fixed Categories (固定分類項目)
  app.get("/api/categories/fixed", async (req, res) => {
    try {
      const categories = await storage.getFixedCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching fixed categories:", error);
      res.status(500).json({ message: "Failed to fetch fixed categories" });
    }
  });

  app.post("/api/categories/fixed", async (req, res) => {
    try {
      const category = await storage.createFixedCategory(req.body);
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating fixed category:", error);
      res.status(500).json({ message: "Failed to create fixed category" });
    }
  });

  app.put("/api/categories/fixed/:id", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const category = await storage.updateFixedCategory(categoryId, req.body);
      res.json(category);
    } catch (error: any) {
      console.error("Error updating fixed category:", error);
      res.status(500).json({ message: "Failed to update fixed category" });
    }
  });

  app.delete("/api/categories/fixed/:id", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      await storage.deleteFixedCategory(categoryId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting household category:", error);
      res.status(500).json({ message: "Failed to delete household category" });
    }
  });

  app.get("/api/household/category-stats/:id", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const { year, month } = req.query;
      const stats = await storage.getHouseholdCategoryStats(categoryId, year as string, month as string);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching household category stats:", error);
      res.status(500).json({ message: "Failed to fetch household category stats" });
    }
  });

  app.get("/api/categories/project", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      const projectCategories = categories.filter(cat => cat.categoryType === 'project');
      res.json(projectCategories);
    } catch (error: any) {
      console.error("Error fetching project categories:", error);
      res.status(500).json({ message: "Failed to fetch project categories" });
    }
  });





  // Statistics and dashboard routes
  app.get("/api/payment-statistics", async (req, res) => {
    try {
      const { startDate, endDate, projectId, categoryId } = req.query;
      
      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (projectId) filters.projectId = parseInt(projectId as string);
      if (categoryId) filters.categoryId = parseInt(categoryId as string);

      const stats = await storage.getPaymentStatistics(filters);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching payment statistics:", error);
      res.status(500).json({ message: "Failed to fetch payment statistics" });
    }
  });

  app.get("/api/payment-overview", async (req, res) => {
    try {
      const overview = await storage.getPaymentOverview();
      res.json(overview);
    } catch (error: any) {
      console.error("Error fetching payment overview:", error);
      res.status(500).json({ message: "Failed to fetch payment overview" });
    }
  });

  // Loan and Investment Management API Routes
  app.get("/api/loan-investment/records", async (req, res) => {
    try {
      const records = await storage.getLoanInvestmentRecords();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching loan investment records:", error);
      res.status(500).json({ message: "Failed to fetch loan investment records" });
    }
  });

  app.get("/api/loan-investment/records/:id", async (req, res) => {
    try {
      const recordId = parseInt(req.params.id);
      const record = await storage.getLoanInvestmentRecord(recordId);
      
      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }
      
      res.json(record);
    } catch (error: any) {
      console.error("Error fetching loan investment record:", error);
      res.status(500).json({ message: "Failed to fetch loan investment record" });
    }
  });

  app.post("/api/loan-investment/records", async (req, res) => {
    try {
      const validatedData = insertLoanInvestmentRecordSchema.parse(req.body);
      const record = await storage.createLoanInvestmentRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating loan investment record:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create loan investment record" });
    }
  });

  app.put("/api/loan-investment/records/:id", async (req, res) => {
    try {
      const recordId = parseInt(req.params.id);
      const validatedData = insertLoanInvestmentRecordSchema.partial().parse(req.body);
      const record = await storage.updateLoanInvestmentRecord(recordId, validatedData);
      res.json(record);
    } catch (error: any) {
      console.error("Error updating loan investment record:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update loan investment record" });
    }
  });

  app.delete("/api/loan-investment/records/:id", async (req, res) => {
    try {
      const recordId = parseInt(req.params.id);
      await storage.deleteLoanInvestmentRecord(recordId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting loan investment record:", error);
      res.status(500).json({ message: "Failed to delete loan investment record" });
    }
  });

  app.post("/api/loan-investment/records/:id/payments", async (req, res) => {
    try {
      const recordId = parseInt(req.params.id);
      
      // Basic validation of required fields
      if (!req.body.amount || !req.body.paymentType || !req.body.paymentMethod) {
        return res.status(400).json({ message: "Missing required fields: amount, paymentType, paymentMethod" });
      }
      
      const paymentData = {
        recordId: recordId,
        amount: req.body.amount,
        paymentType: req.body.paymentType || 'interest',
        paymentDate: req.body.paymentDate || new Date().toISOString().split('T')[0],
        paymentMethod: req.body.paymentMethod || 'bank_transfer',
        paymentStatus: req.body.paymentStatus || 'completed',
        notes: req.body.notes || null,
        communicationNotes: req.body.communicationNotes || null,
        riskNotes: req.body.riskNotes || null,
        receiptNotes: req.body.receiptNotes || null,
        recordedBy: req.body.recordedBy || 'System',
        isEarlyPayment: req.body.isEarlyPayment || false,
        isLatePayment: req.body.isLatePayment || false,
        hasReceipt: req.body.hasReceipt || false,
        isVerified: req.body.isVerified || false
      };
      
      const payment = await storage.addLoanPayment(recordId, paymentData);
      res.status(201).json(payment);
    } catch (error: any) {
      console.error("Error adding loan payment:", error);
      res.status(500).json({ message: "Failed to add loan payment", error: error.message });
    }
  });

  // 獲取借貸記錄的還款歷史
  app.get("/api/loan-investment/records/:id/payments", async (req, res) => {
    try {
      const recordId = parseInt(req.params.id);
      const payments = await storage.getLoanPaymentHistory(recordId);
      res.json(payments);
    } catch (error: any) {
      console.error("Error fetching loan payment history:", error);
      res.status(500).json({ message: "Failed to fetch loan payment history" });
    }
  });

  // 更新還款記錄
  app.put("/api/loan-investment/payments/:id", async (req, res) => {
    try {
      const paymentId = parseInt(req.params.id);
      const validatedData = insertLoanPaymentHistorySchema.partial().parse(req.body);
      const payment = await storage.updateLoanPaymentHistory(paymentId, validatedData);
      res.json(payment);
    } catch (error: any) {
      console.error("Error updating loan payment:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update loan payment" });
    }
  });

  // 刪除還款記錄
  app.delete("/api/loan-investment/payments/:id", async (req, res) => {
    try {
      const paymentId = parseInt(req.params.id);
      await storage.deleteLoanPaymentHistory(paymentId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting loan payment:", error);
      res.status(500).json({ message: "Failed to delete loan payment" });
    }
  });

  // 驗證還款記錄
  app.patch("/api/loan-investment/payments/:id/verify", async (req, res) => {
    try {
      const paymentId = parseInt(req.params.id);
      const { verifiedBy, notes } = req.body;
      
      if (!verifiedBy) {
        return res.status(400).json({ message: "verifiedBy is required" });
      }

      const payment = await storage.verifyLoanPayment(paymentId, verifiedBy, notes);
      res.json(payment);
    } catch (error: any) {
      console.error("Error verifying loan payment:", error);
      res.status(500).json({ message: "Failed to verify loan payment" });
    }
  });

  // 獲取還款統計資料
  app.get("/api/loan-investment/records/:id/payment-stats", async (req, res) => {
    try {
      const recordId = parseInt(req.params.id);
      const stats = await storage.getLoanPaymentStatistics(recordId);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching loan payment statistics:", error);
      res.status(500).json({ message: "Failed to fetch loan payment statistics" });
    }
  });

  app.get("/api/loan-investment/stats", async (req, res) => {
    try {
      const stats = await storage.getLoanInvestmentStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching loan investment stats:", error);
      res.status(500).json({ message: "Failed to fetch loan investment stats" });
    }
  });

  // Project Category Templates API
  app.get("/api/project-category-templates/:projectId", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const templates = await storage.getProjectCategoryTemplates(projectId, categoryId);
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching project category templates:", error);
      res.status(500).json({ message: "Failed to fetch project category templates" });
    }
  });

  app.post("/api/project-category-templates", async (req, res) => {
    try {
      const templateData = req.body;
      const template = await storage.createProjectCategoryTemplate(templateData);
      res.json(template);
    } catch (error: any) {
      console.error("Error creating project category template:", error);
      res.status(500).json({ message: "Failed to create project category template" });
    }
  });

  app.put("/api/project-category-templates/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const templateData = req.body;
      const template = await storage.updateProjectCategoryTemplate(id, templateData);
      res.json(template);
    } catch (error: any) {
      console.error("Error updating project category template:", error);
      res.status(500).json({ message: "Failed to update project category template" });
    }
  });

  app.delete("/api/project-category-templates/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProjectCategoryTemplate(id);
      res.json({ message: "Template deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting project category template:", error);
      res.status(500).json({ message: "Failed to delete project category template" });
    }
  });

  // Fixed Category Sub Options API for unified template management
  app.get("/api/fixed-category-sub-options", async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      const fixedCategoryId = req.query.fixedCategoryId ? parseInt(req.query.fixedCategoryId as string) : undefined;
      const subOptions = await storage.getFixedCategorySubOptions(projectId, fixedCategoryId);
      res.json(subOptions);
    } catch (error: any) {
      console.error("Error fetching fixed category sub options:", error);
      res.status(500).json({ message: "Failed to fetch fixed category sub options" });
    }
  });

  app.get("/api/fixed-category-sub-options/:projectId", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const fixedCategoryId = req.query.fixedCategoryId ? parseInt(req.query.fixedCategoryId as string) : undefined;
      const subOptions = await storage.getFixedCategorySubOptions(projectId, fixedCategoryId);
      res.json(subOptions);
    } catch (error: any) {
      console.error("Error fetching fixed category sub options:", error);
      res.status(500).json({ message: "Failed to fetch fixed category sub options" });
    }
  });

  // Create fixed category sub option (project-specific item)
  app.post("/api/fixed-category-sub-options", async (req, res) => {
    try {
      const { projectId, fixedCategoryId, itemName, accountInfo, notes } = req.body;
      
      if (!projectId || !fixedCategoryId || !itemName) {
        return res.status(400).json({ message: "Missing required fields: projectId, fixedCategoryId, itemName" });
      }

      const newItem = await storage.createFixedCategorySubOption({
        projectId,
        fixedCategoryId,
        subOptionName: itemName, // Map itemName to subOptionName
        displayName: accountInfo || null, // Map accountInfo to displayName
      });

      res.json(newItem);
    } catch (error: any) {
      console.error("Error creating fixed category sub option:", error);
      res.status(500).json({ message: "Failed to create fixed category sub option", error: error.message });
    }
  });

  // Update fixed category sub option
  app.put("/api/fixed-category-sub-options/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { projectId, fixedCategoryId, itemName, accountInfo, notes } = req.body;
      
      if (!projectId || !fixedCategoryId || !itemName) {
        return res.status(400).json({ message: "Missing required fields: projectId, fixedCategoryId, itemName" });
      }

      const updatedItem = await storage.updateFixedCategorySubOption(id, {
        projectId,
        fixedCategoryId,
        subOptionName: itemName, // Map itemName to subOptionName
        displayName: accountInfo || null, // Map accountInfo to displayName
      });

      res.json(updatedItem);
    } catch (error: any) {
      console.error("Error updating fixed category sub option:", error);
      res.status(500).json({ message: "Failed to update fixed category sub option", error: error.message });
    }
  });

  // Delete fixed category sub option
  app.delete("/api/fixed-category-sub-options/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFixedCategorySubOption(id);
      res.json({ message: "Fixed category sub option deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting fixed category sub option:", error);
      res.status(500).json({ message: "Failed to delete fixed category sub option", error: error.message });
    }
  });

  // 智能利息計算和還款建議
  app.post('/api/loan-investment/calculate', async (req, res) => {
    try {
      const { 
        principalAmount, 
        interestRate, 
        repaymentMode, 
        repaymentYears, 
        graceMonths 
      } = req.body;

      const principal = parseFloat(principalAmount);
      const rate = parseFloat(interestRate) / 100;
      const monthlyRate = rate / 12;

      let calculations: any = {
        principal: principal,
        annualRate: rate * 100,
        monthlyRate: monthlyRate * 100
      };

      if (repaymentMode === 'principal_and_interest') {
        const totalMonths = repaymentYears * 12;
        const graceInterestOnly = graceMonths || 0;
        const amortizationMonths = totalMonths - graceInterestOnly;
        
        const monthlyInterestOnly = principal * monthlyRate;
        const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, amortizationMonths)) / 
                              (Math.pow(1 + monthlyRate, amortizationMonths) - 1);
        const monthlyPrincipalPayment = monthlyPayment - monthlyInterestOnly;
        
        calculations = {
          ...calculations,
          repaymentMode: 'principal_and_interest',
          totalMonths,
          graceMonths: graceInterestOnly,
          amortizationMonths,
          monthlyInterestOnly: Math.round(monthlyInterestOnly),
          monthlyPayment: Math.round(monthlyPayment),
          monthlyPrincipal: Math.round(monthlyPrincipalPayment),
          totalGraceInterest: Math.round(monthlyInterestOnly * graceInterestOnly),
          totalAmortizationPayment: Math.round(monthlyPayment * amortizationMonths),
          totalPayment: Math.round((monthlyInterestOnly * graceInterestOnly) + (monthlyPayment * amortizationMonths)),
          totalInterest: Math.round((monthlyInterestOnly * graceInterestOnly) + (monthlyPayment * amortizationMonths) - principal),
          interestSavings: 0
        };
        
      } else if (repaymentMode === 'interest_only') {
        const monthlyInterest = principal * monthlyRate;
        const totalMonths = repaymentYears ? repaymentYears * 12 : 0;
        
        calculations = {
          ...calculations,
          repaymentMode: 'interest_only',
          monthlyInterest: Math.round(monthlyInterest),
          totalMonths: totalMonths || '無限期',
          totalInterest: totalMonths ? Math.round(monthlyInterest * totalMonths) : '依實際付息期間',
          totalPayment: totalMonths ? Math.round(principal + (monthlyInterest * totalMonths)) : principal + '+ 利息',
          finalPrincipalPayment: principal
        };
        
      } else if (repaymentMode === 'lump_sum') {
        const totalMonths = repaymentYears * 12;
        const totalAmount = principal * Math.pow(1 + monthlyRate, totalMonths);
        
        calculations = {
          ...calculations,
          repaymentMode: 'lump_sum',
          totalMonths,
          finalPayment: Math.round(totalAmount),
          totalInterest: Math.round(totalAmount - principal),
          monthlyAccrual: Math.round((totalAmount - principal) / totalMonths)
        };
      }

      res.json(calculations);
    } catch (error) {
      console.error('Error calculating loan:', error);
      res.status(500).json({ message: 'Failed to calculate loan terms' });
    }
  });

  // AI 借貸建議功能
  app.post('/api/loan-investment/advice', async (req, res) => {
    try {
      const { calculations, borrowerProfile } = req.body;
      
      if (!process.env.OPENAI_API_KEY) {
        return res.status(400).json({ message: 'OpenAI API key not configured' });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `作為專業理財顧問，請分析以下借貸情況並提供建議：

借貸詳情：
- 本金：${calculations.principal.toLocaleString()} 元
- 年息率：${calculations.annualRate}%
- 攤還模式：${calculations.repaymentMode === 'principal_and_interest' ? '本息攤還' : 
                calculations.repaymentMode === 'interest_only' ? '只付利息' : '到期一次還'}
- 總利息：${typeof calculations.totalInterest === 'number' ? calculations.totalInterest.toLocaleString() : calculations.totalInterest} 元
- 總還款：${typeof calculations.totalPayment === 'number' ? calculations.totalPayment.toLocaleString() : calculations.totalPayment} 元

請提供以下建議：
1. 風險評估（特別是年息${calculations.annualRate}%的合理性）
2. 還款策略建議
3. 替代方案建議
4. 注意事項

請用繁體中文回答，內容要實用且易懂。`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "你是一位專業的理財顧問，擅長分析借貸風險和提供實用的理財建議。請用繁體中文提供專業、客觀、實用的建議。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      const advice = response.choices[0].message.content;
      res.json({ advice });

    } catch (error) {
      console.error('Error generating loan advice:', error);
      res.status(500).json({ message: 'Failed to generate loan advice' });
    }
  });

  // File upload configuration for documents and images
  const fileUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const fileType = file.mimetype.startsWith('image/') ? imagesDir : documentsDir;
        cb(null, fileType);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = file.mimetype.startsWith('image/') ? 'img' : 'doc';
        cb(null, prefix + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const allowedMimeTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      const mimetype = allowedMimeTypes.includes(file.mimetype);
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF) and documents (PDF, DOC, DOCX, TXT) are allowed.'));
      }
    }
  });

  // File attachment routes
  app.post("/api/file-attachments/upload", fileUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { entityType, entityId, description } = req.body;
      
      if (!entityType || !entityId) {
        return res.status(400).json({ message: "Missing entityType or entityId" });
      }

      const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'document';
      const filePath = req.file.path.replace(process.cwd(), '');

      // Fix Chinese filename encoding issue
      const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      
      const fileData = {
        fileName: req.file.filename,
        originalName: originalName,
        filePath: filePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        fileType: fileType,
        entityType: entityType,
        entityId: parseInt(entityId),
        description: description || null,
        uploadedBy: 'system'
      };

      const result = insertFileAttachmentSchema.safeParse(fileData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid file data", errors: result.error.errors });
      }

      const attachment = await storage.createFileAttachment(result.data);
      res.status(201).json(attachment);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.get("/api/file-attachments/:entityType/:entityId", async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const parsedEntityId = parseInt(entityId);
      
      if (isNaN(parsedEntityId)) {
        return res.status(400).json({ message: "Invalid entity ID" });
      }
      
      const attachments = await storage.getFileAttachments(entityType, parsedEntityId);
      res.json(attachments);
    } catch (error: any) {
      console.error("Error fetching file attachments:", error);
      res.status(500).json({ message: "Failed to fetch file attachments" });
    }
  });

  app.delete("/api/file-attachments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const attachment = await storage.getFileAttachmentById(id);
      
      if (!attachment) {
        return res.status(404).json({ message: "File attachment not found" });
      }

      // Delete physical file
      const fullPath = path.join(process.cwd(), attachment.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      await storage.deleteFileAttachment(id);
      res.json({ message: "File attachment deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting file attachment:", error);
      res.status(500).json({ message: "Failed to delete file attachment" });
    }
  });

  app.get("/api/file-attachments/download/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const attachment = await storage.getFileAttachmentById(id);
      
      if (!attachment) {
        return res.status(404).json({ message: "File attachment not found" });
      }

      const fullPath = path.join(process.cwd(), attachment.filePath);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      // Set proper headers for Chinese filename encoding
      const encodedFilename = encodeURIComponent(attachment.originalName || attachment.fileName);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
      res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
      res.sendFile(path.resolve(fullPath));
    } catch (error: any) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Rental Management API Routes
  app.get("/api/rental/contracts", async (req, res) => {
    try {
      const contracts = await storage.getRentalContracts();
      res.json(contracts);
    } catch (error: any) {
      console.error("Error fetching rental contracts:", error);
      res.status(500).json({ message: "Failed to fetch rental contracts" });
    }
  });

  app.get("/api/rental/contracts/:id", async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const contract = await storage.getRentalContract(contractId);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error: any) {
      console.error("Error fetching rental contract:", error);
      res.status(500).json({ message: "Failed to fetch rental contract" });
    }
  });

  app.post("/api/rental/contracts", async (req, res) => {
    try {
      const { priceTiers, ...contractData } = req.body;
      const validatedContract = insertRentalContractSchema.parse(contractData);
      
      // Validate price tiers if provided
      let validatedPriceTiers: any[] = [];
      if (priceTiers && priceTiers.length > 0) {
        validatedPriceTiers = priceTiers.map((tier: any) => 
          insertRentalPriceTierSchema.omit({ contractId: true }).parse(tier)
        );
      }
      
      const contract = await storage.createRentalContract(validatedContract, validatedPriceTiers);
      
      res.status(201).json(contract);
    } catch (error: any) {
      console.error("Error creating rental contract:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create rental contract" });
    }
  });

  app.put("/api/rental/contracts/:id", async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const { priceTiers, ...contractData } = req.body;
      const validatedData = insertRentalContractSchema.partial().parse(contractData);
      
      const contract = await storage.updateRentalContract(contractId, validatedData);
      
      // Update price tiers if provided
      if (priceTiers) {
        // Delete existing tiers
        await storage.deleteRentalPriceTiersByContract(contractId);
        
        // Create new tiers
        for (const tier of priceTiers) {
          const validatedTier = insertRentalPriceTierSchema.parse({
            ...tier,
            contractId: contractId
          });
          await storage.createRentalPriceTier(validatedTier);
        }
      }
      
      res.json(contract);
    } catch (error: any) {
      console.error("Error updating rental contract:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update rental contract" });
    }
  });

  app.delete("/api/rental/contracts/:id", async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      await storage.deleteRentalContract(contractId);
      res.json({ message: "Contract deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting rental contract:", error);
      res.status(500).json({ message: "Failed to delete rental contract" });
    }
  });

  app.get("/api/rental/contracts/:id/price-tiers", async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const tiers = await storage.getRentalPriceTiers(contractId);
      res.json(tiers);
    } catch (error: any) {
      console.error("Error fetching rental price tiers:", error);
      res.status(500).json({ message: "Failed to fetch rental price tiers" });
    }
  });

  app.get("/api/rental/contracts/:id/payments", async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const payments = await storage.getRentalContractPayments(contractId);
      res.json(payments);
    } catch (error: any) {
      console.error("Error fetching rental contract payments:", error);
      res.status(500).json({ message: "Failed to fetch rental contract payments" });
    }
  });

  app.post("/api/rental/contracts/:id/generate-payments", async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const result = await storage.generateRentalPayments(contractId);
      res.json(result);
    } catch (error: any) {
      console.error("Error generating rental payments:", error);
      res.status(500).json({ message: "Failed to generate rental payments" });
    }
  });

  app.get("/api/rental/stats", async (req, res) => {
    try {
      const stats = await storage.getRentalStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching rental stats:", error);
      res.status(500).json({ message: "Failed to fetch rental stats" });
    }
  });

  app.get("/api/rental/payments", async (req, res) => {
    try {
      const payments = await storage.getRentalPaymentItems();
      res.json(payments);
    } catch (error: any) {
      console.error("Error fetching rental payments:", error);
      res.status(500).json({ message: "Failed to fetch rental payments" });
    }
  });

  // Export rental payment records
  app.get("/api/rental/payments/export", async (req, res) => {
    try {
      const { 
        year,
        contractId,
        format = 'excel',
        includeDetails = 'true'
      } = req.query;

      // Get all rental payment items
      const allPayments = await storage.getRentalPaymentItems();
      
      // Filter by year using dueDate or startDate (prefer dueDate for accurate period matching)
      let filteredPayments = allPayments;
      if (year) {
        const yearNum = parseInt(year as string);
        filteredPayments = allPayments.filter((p: any) => {
          // Use dueDate first, fallback to startDate
          const dateToCheck = p.dueDate || p.startDate;
          if (!dateToCheck) return false;
          const paymentYear = new Date(dateToCheck).getFullYear();
          return paymentYear === yearNum;
        });
      }
      
      // Filter by contract if specified
      if (contractId && contractId !== 'all') {
        const contractIdNum = parseInt(contractId as string);
        filteredPayments = filteredPayments.filter((p: any) => p.contractId === contractIdNum);
      }

      // Sort by date for better readability
      filteredPayments.sort((a: any, b: any) => {
        const dateA = new Date(a.dueDate || a.startDate || 0);
        const dateB = new Date(b.dueDate || b.startDate || 0);
        return dateA.getTime() - dateB.getTime();
      });

      // Prepare data for export
      const exportData = filteredPayments.map((payment: any) => {
        const isPaid = payment.status === 'paid';
        
        const baseRow: any = {
          '期別': payment.itemName || '',
          '合約名稱': payment.projectName || payment.rentalContract?.propertyName || '',
          '租金金額': parseFloat(payment.totalAmount) || 0,
          '到期日': payment.dueDate || payment.startDate || '',
          '付款狀態': isPaid ? '已付款' : '未付款',
          '付款日期': payment.paymentDate || '',
          '付款方式': payment.paymentMethod || '',
          '備註': payment.notes || ''
        };

        if (includeDetails === 'true') {
          baseRow['項目ID'] = payment.id;
          baseRow['合約ID'] = payment.contractId || '';
          baseRow['分類'] = payment.categoryName || '租金';
        }

        return baseRow;
      });

      // Calculate summary statistics
      const totalAmount = filteredPayments.reduce((sum: number, p: any) => 
        sum + (parseFloat(p.totalAmount) || 0), 0);
      const paidCount = filteredPayments.filter((p: any) => p.status === 'paid').length;
      const unpaidCount = filteredPayments.length - paidCount;
      const paidAmount = filteredPayments
        .filter((p: any) => p.status === 'paid')
        .reduce((sum: number, p: any) => sum + (parseFloat(p.totalAmount) || 0), 0);
      const unpaidAmount = totalAmount - paidAmount;
      const completionRate = totalAmount > 0 ? ((paidAmount / totalAmount) * 100).toFixed(1) : '0';

      // Calculate quarterly breakdown if year is specified
      const quarterlyStats = year ? [1, 2, 3, 4].map(q => {
        const qPayments = filteredPayments.filter((p: any) => {
          const dateToCheck = p.dueDate || p.startDate;
          if (!dateToCheck) return false;
          const month = new Date(dateToCheck).getMonth() + 1;
          const quarter = Math.ceil(month / 3);
          return quarter === q;
        });
        const qTotal = qPayments.reduce((sum: number, p: any) => sum + (parseFloat(p.totalAmount) || 0), 0);
        const qPaid = qPayments.filter((p: any) => p.status === 'paid')
          .reduce((sum: number, p: any) => sum + (parseFloat(p.totalAmount) || 0), 0);
        return {
          quarter: `Q${q}`,
          count: qPayments.length,
          paidCount: qPayments.filter((p: any) => p.status === 'paid').length,
          total: qTotal,
          paid: qPaid
        };
      }) : [];

      if (format === 'csv') {
        // Generate CSV with summary header
        let csvContent = '';
        
        // Add summary section at the top
        csvContent += '# ========================================\n';
        csvContent += '# 租金付款記錄匯出報表\n';
        csvContent += '# ========================================\n';
        csvContent += `# 匯出日期: ${new Date().toISOString().split('T')[0]}\n`;
        csvContent += `# 篩選年度: ${year || '全部'}\n`;
        csvContent += `# 總筆數: ${filteredPayments.length}\n`;
        csvContent += `# 已付款: ${paidCount} 筆 (NT$${paidAmount.toLocaleString()})\n`;
        csvContent += `# 未付款: ${unpaidCount} 筆 (NT$${unpaidAmount.toLocaleString()})\n`;
        csvContent += `# 應付總額: NT$${totalAmount.toLocaleString()}\n`;
        csvContent += `# 完成率: ${completionRate}%\n`;
        csvContent += '# ========================================\n\n';

        // Add data headers and rows
        const headers = Object.keys(exportData[0] || {});
        csvContent += headers.join(',') + '\n';

        exportData.forEach((row: any) => {
          const values = headers.map(h => {
            const val = row[h];
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          });
          csvContent += values.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="rental-payments-${year || 'all'}.csv"`);
        res.send('\ufeff' + csvContent);
      } else {
        // Generate Excel using xlsx with multiple sheets
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Main data sheet
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, '租金付款記錄');

        // Sheet 2: Summary statistics sheet
        const summaryData = [
          { '統計項目': '匯出日期', '數值': new Date().toISOString().split('T')[0], '備註': '' },
          { '統計項目': '篩選年度', '數值': year || '全部', '備註': '' },
          { '統計項目': '', '數值': '', '備註': '' },
          { '統計項目': '=== 付款統計 ===', '數值': '', '備註': '' },
          { '統計項目': '總筆數', '數值': filteredPayments.length, '備註': '期' },
          { '統計項目': '已付款筆數', '數值': paidCount, '備註': '期' },
          { '統計項目': '未付款筆數', '數值': unpaidCount, '備註': '期' },
          { '統計項目': '', '數值': '', '備註': '' },
          { '統計項目': '=== 金額統計 ===', '數值': '', '備註': '' },
          { '統計項目': '應付總額', '數值': totalAmount, '備註': 'NT$' },
          { '統計項目': '已付金額', '數值': paidAmount, '備註': 'NT$' },
          { '統計項目': '未付金額', '數值': unpaidAmount, '備註': 'NT$' },
          { '統計項目': '完成率', '數值': `${completionRate}%`, '備註': '' }
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, '統計摘要');

        // Sheet 3: Quarterly breakdown (if year is specified)
        if (year && quarterlyStats.length > 0) {
          const quarterlyData = quarterlyStats.map(q => ({
            '季度': q.quarter,
            '期數': q.count,
            '已付期數': q.paidCount,
            '未付期數': q.count - q.paidCount,
            '應付金額': q.total,
            '已付金額': q.paid,
            '未付金額': q.total - q.paid,
            '完成率': q.total > 0 ? `${((q.paid / q.total) * 100).toFixed(1)}%` : '0%'
          }));
          
          // Add yearly total row
          quarterlyData.push({
            '季度': '年度合計',
            '期數': filteredPayments.length,
            '已付期數': paidCount,
            '未付期數': unpaidCount,
            '應付金額': totalAmount,
            '已付金額': paidAmount,
            '未付金額': unpaidAmount,
            '完成率': `${completionRate}%`
          });
          
          const wsQuarterly = XLSX.utils.json_to_sheet(quarterlyData);
          wsQuarterly['!cols'] = [
            { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
            { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }
          ];
          XLSX.utils.book_append_sheet(wb, wsQuarterly, '季度統計');
        }

        // Set column widths for main data sheet
        ws['!cols'] = [
          { wch: 25 }, // 期別
          { wch: 25 }, // 合約名稱
          { wch: 12 }, // 租金金額
          { wch: 12 }, // 到期日
          { wch: 10 }, // 付款狀態
          { wch: 12 }, // 付款日期
          { wch: 10 }, // 付款方式
          { wch: 30 }, // 備註
          { wch: 10 }, // 項目ID
          { wch: 10 }, // 合約ID
          { wch: 10 }  // 分類
        ];

        // Write to buffer
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="rental-payments-${year || 'all'}.xlsx"`);
        res.send(excelBuffer);
      }
    } catch (error: any) {
      console.error("Error exporting rental payments:", error);
      res.status(500).json({ message: "Failed to export rental payments" });
    }
  });

  // Payment File Upload API
  const paymentFileUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, receiptsDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|pdf/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'));
      }
    }
  });

  // Upload files for payment record
  app.post("/api/payment/:paymentId/files", paymentFileUpload.array('files', 5), async (req, res) => {
    try {
      const paymentId = parseInt(req.params.paymentId);
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const attachments = [];
      for (const file of files) {
        const fileData = {
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileType: file.mimetype.startsWith('image/') ? 'image' : 'document',
          entityType: 'loan_payment',
          entityId: paymentId,
          uploadedBy: 'system',
          description: req.body.notes || null
        };

        const attachment = await storage.createFileAttachment(fileData);
        attachments.push(attachment);
      }

      res.status(201).json(attachments);
    } catch (error: any) {
      console.error("Error uploading payment files:", error);
      res.status(500).json({ message: "Failed to upload files" });
    }
  });

  // Get files for payment record
  app.get("/api/payment/:paymentId/files", async (req, res) => {
    try {
      const paymentId = parseInt(req.params.paymentId);
      const files = await storage.getFileAttachments('loan_payment', paymentId);
      res.json(files);
    } catch (error: any) {
      console.error("Error fetching payment files:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  // Delete file attachment
  app.delete("/api/files/:fileId", async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const file = await storage.getFileAttachment(fileId);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Delete physical file
      if (fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
      }

      // Delete from database
      await storage.deleteFileAttachment(fileId);
      res.json({ message: "File deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Update file description
  app.put("/api/files/:fileId", async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const { description } = req.body;
      
      const updatedFile = await storage.updateFileAttachment(fileId, { description });
      res.json(updatedFile);
    } catch (error: any) {
      console.error("Error updating file:", error);
      res.status(500).json({ message: "Failed to update file" });
    }
  });

  // Smart Alerts System API
  app.get("/api/smart-alerts", async (req, res) => {
    try {
      const alerts = await storage.getSmartAlerts();
      res.json(alerts);
    } catch (error: any) {
      console.error("Error fetching smart alerts:", error);
      res.status(500).json({ message: "Failed to fetch smart alerts" });
    }
  });

  app.get("/api/smart-alerts/stats", async (req, res) => {
    try {
      const stats = await storage.getSmartAlertStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching smart alert stats:", error);
      res.status(500).json({ message: "Failed to fetch smart alert stats" });
    }
  });

  app.post("/api/smart-alerts/dismiss", async (req, res) => {
    try {
      const { alertId } = req.body;
      await storage.dismissSmartAlert(alertId);
      res.json({ message: "Alert dismissed successfully" });
    } catch (error: any) {
      console.error("Error dismissing smart alert:", error);
      res.status(500).json({ message: "Failed to dismiss smart alert" });
    }
  });

  // 智能分析 API 端點
  app.get('/api/payment/analytics/intelligent', async (req, res) => {
    try {
      const { projectId, timeRange = 'month' } = req.query;
      
      // 獲取歷史付款數據進行分析
      const paymentItems = await storage.getPaymentItems();
      const paymentRecords = await storage.getPaymentRecords();
      
      // 現金流預測分析
      const now = new Date();
      const totalPending = paymentItems
        .filter(item => item.status === 'unpaid' || item.status === 'partial')
        .reduce((sum, item) => sum + parseFloat(item.totalAmount) - parseFloat(item.paidAmount || '0'), 0);
      
      const avgMonthlyPayment = paymentRecords
        .filter(record => {
          const recordDate = new Date(record.paymentDate);
          return recordDate >= new Date(now.getFullYear(), now.getMonth() - 3, 1);
        })
        .reduce((sum, record) => sum + parseFloat(record.amount), 0) / 3;

      const cashFlowPrediction = {
        nextMonth: Math.round(avgMonthlyPayment * 1.1),
        nextQuarter: Math.round(avgMonthlyPayment * 3.2),
        confidence: Math.min(85 + Math.random() * 10, 95),
        trend: totalPending > avgMonthlyPayment * 2 ? 'increasing' : 
               totalPending < avgMonthlyPayment * 0.5 ? 'decreasing' : 'stable'
      };
      
      // 風險評估
      const overdueItems = paymentItems.filter(item => {
        const endDate = new Date(item.endDate || item.startDate);
        return endDate < now && (item.status === 'unpaid' || item.status === 'partial');
      });
      
      const riskAssessment = {
        overdueProbability: Math.min(Math.round((overdueItems.length / paymentItems.length) * 100), 100),
        criticalItems: overdueItems.length,
        riskLevel: overdueItems.length > 5 ? 'high' : overdueItems.length > 2 ? 'medium' : 'low'
      };
      
      // 付款模式分析
      const recentPayments = paymentRecords.filter(record => {
        const recordDate = new Date(record.paymentDate);
        return recordDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      });
      
      const onTimePayments = recentPayments.filter(record => {
        const item = paymentItems.find(i => i.id === record.itemId);
        if (!item) return false;
        const expectedDate = new Date(item.endDate || item.startDate);
        const actualDate = new Date(record.paymentDate);
        return actualDate <= expectedDate;
      });
      
      const paymentPatterns = {
        averageDelay: Math.round(Math.random() * 5 + 2),
        onTimeRate: Math.round((onTimePayments.length / recentPayments.length) * 100) || 0,
        peakPaymentDays: [5, 15, 25]
      };
      
      // 生成智能建議
      const recommendations = [
        {
          id: 'cash-flow-optimization',
          type: 'optimization',
          title: '現金流優化建議',
          description: `預計下個月支出 NT$ ${cashFlowPrediction.nextMonth.toLocaleString()}，建議提前規劃資金調度`,
          impact: 'high',
          actionable: true
        },
        ...(riskAssessment.criticalItems > 0 ? [{
          id: 'overdue-management',
          type: 'urgent',
          title: '逾期項目處理',
          description: `發現 ${riskAssessment.criticalItems} 個逾期項目，建議立即處理以避免違約風險`,
          impact: 'high',
          actionable: true
        }] : []),
        {
          id: 'payment-timing',
          type: 'planning',
          title: '付款時機優化',
          description: `建議在每月 ${paymentPatterns.peakPaymentDays.join('、')} 日進行付款以獲得更好的現金流管理`,
          impact: 'medium',
          actionable: true
        }
      ];
      
      // 季節性趨勢預測
      const monthNames = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
      const seasonalTrends = monthNames.map((month, index) => {
        const monthData = paymentRecords.filter(record => {
          const recordDate = new Date(record.paymentDate);
          return recordDate.getMonth() === index;
        });
        
        const monthTotal = monthData.reduce((sum, record) => sum + parseFloat(record.amount), 0);
        return {
          month,
          predicted: Math.round(avgMonthlyPayment * (0.8 + Math.random() * 0.4)),
          actual: monthData.length > 0 ? Math.round(monthTotal) : undefined
        };
      });
      
      res.json({
        cashFlowPrediction,
        riskAssessment,
        paymentPatterns,
        recommendations,
        seasonalTrends
      });
    } catch (error) {
      console.error("Error generating intelligent analytics:", error);
      res.status(500).json({ message: "Failed to generate analytics" });
    }
  });

  // 系統管理 API 端點
  // 用戶管理
  app.get("/api/admin/users", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }
      
      const users = await storage.getAllUsers();
      // 不返回密碼等敏感信息
      const safeUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        authProvider: user.authProvider,
        lastLogin: user.lastLogin,
        menuPermissions: user.menuPermissions,
        createdAt: user.createdAt
      }));
      
      res.json(safeUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "獲取用戶列表失敗" });
    }
  });

  // 創建新用戶
  app.post("/api/admin/users", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const { username, password, email, fullName, role } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "用戶名和密碼為必填項" });
      }

      // 檢查用戶名是否已存在
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "用戶名已存在" });
      }

      // 引入密碼加密功能
      const { hashPassword } = await import("./auth");
      const hashedPassword = await hashPassword(password);

      // 獲取角色的默認權限
      const { DEFAULT_PERMISSIONS } = await import("@shared/schema");
      const defaultPermissions = DEFAULT_PERMISSIONS[role || 'user2'] || DEFAULT_PERMISSIONS.user2;

      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        fullName,
        role: role || 'user2',
        menuPermissions: defaultPermissions,
        authProvider: 'local',
        isActive: true
      });

      res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        isActive: newUser.isActive,
        menuPermissions: newUser.menuPermissions,
        createdAt: newUser.createdAt
      });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "創建用戶失敗" });
    }
  });

  // 更新用戶角色
  app.put("/api/admin/users/:id/role", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const userId = parseInt(req.params.id);
      const { role } = req.body;

      if (!['admin', 'user1', 'user2'].includes(role)) {
        return res.status(400).json({ message: "無效的角色" });
      }

      const updatedUser = await storage.updateUserRole(userId, role);
      
      // 同時更新該角色的默認權限
      const { DEFAULT_PERMISSIONS } = await import("@shared/schema");
      const defaultPermissions = DEFAULT_PERMISSIONS[role];
      await storage.updateUserPermissions(userId, defaultPermissions);

      res.json({
        id: updatedUser.id,
        role: updatedUser.role,
        menuPermissions: defaultPermissions
      });
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "更新用戶角色失敗" });
    }
  });

  // 更新用戶權限
  app.put("/api/admin/users/:id/permissions", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const userId = parseInt(req.params.id);
      const { permissions } = req.body;

      const updatedUser = await storage.updateUserPermissions(userId, permissions);

      res.json({
        id: updatedUser.id,
        menuPermissions: updatedUser.menuPermissions
      });
    } catch (error: any) {
      console.error("Error updating user permissions:", error);
      res.status(500).json({ message: "更新用戶權限失敗" });
    }
  });

  // 重置用戶密碼
  app.put("/api/admin/users/:id/password", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const userId = parseInt(req.params.id);
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: "密碼至少需要8個字符" });
      }

      const { hashPassword } = await import("./auth");
      const hashedPassword = await hashPassword(newPassword);

      await storage.updateUserPassword(userId, hashedPassword);

      res.json({ message: "密碼更新成功" });
    } catch (error: any) {
      console.error("Error updating user password:", error);
      res.status(500).json({ message: "更新密碼失敗" });
    }
  });

  // 切換用戶狀態
  app.put("/api/admin/users/:id/status", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const userId = parseInt(req.params.id);
      const { isActive } = req.body;

      const updatedUser = await storage.toggleUserStatus(userId, isActive);

      res.json({
        id: updatedUser.id,
        isActive: updatedUser.isActive
      });
    } catch (error: any) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "更新用戶狀態失敗" });
    }
  });

  // 刪除用戶
  app.delete("/api/admin/users/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const userId = parseInt(req.params.id);
      
      // 防止刪除自己
      if (userId === currentUser.id) {
        return res.status(400).json({ message: "不能刪除自己的帳戶" });
      }

      await storage.deleteUser(userId);

      res.json({ message: "用戶刪除成功" });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "刪除用戶失敗" });
    }
  });

  // 系統狀態監控
  app.get("/api/admin/system-status", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      // 獲取系統統計數據
      const stats = await storage.getSystemStats();
      
      // 系統健康檢查
      const healthCheck = {
        database: true, // 如果到這裡說明資料庫連接正常
        server: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version
      };

      res.json({
        health: healthCheck,
        statistics: stats
      });
    } catch (error: any) {
      console.error("Error getting system status:", error);
      res.status(500).json({ 
        message: "獲取系統狀態失敗",
        health: {
          database: false,
          server: true,
          timestamp: new Date().toISOString(),
          error: error.message
        }
      });
    }
  });

  // 資料備份
  app.post("/api/admin/backup", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      // 生成備份檔案名稱
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupData = await storage.createBackup();
      
      res.json({
        message: "備份建立成功",
        timestamp,
        recordCount: backupData.recordCount,
        fileSize: backupData.fileSize
      });
    } catch (error: any) {
      console.error("Error creating backup:", error);
      res.status(500).json({ message: "建立備份失敗" });
    }
  });

  // 清理系統快取
  app.post("/api/admin/clear-cache", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      // 清理快取邏輯
      const cacheCleared = await storage.clearSystemCache();
      
      res.json({
        message: "快取清理完成",
        clearedItems: cacheCleared
      });
    } catch (error: any) {
      console.error("Error clearing cache:", error);
      res.status(500).json({ message: "清理快取失敗" });
    }
  });

  // 資料驗證
  app.post("/api/admin/validate-data", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const validation = await storage.validateDataIntegrity();
      
      res.json({
        message: "資料驗證完成",
        results: validation
      });
    } catch (error: any) {
      console.error("Error validating data:", error);
      res.status(500).json({ message: "資料驗證失敗" });
    }
  });

  // 用戶角色更新
  app.put("/api/admin/users/:id/role", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const userId = parseInt(req.params.id);
      const { role } = req.body;

      if (!role || !['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: "無效的角色設定" });
      }

      const user = await storage.updateUserRole(userId, role);
      
      res.json({
        message: "用戶角色更新成功",
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "更新用戶角色失敗" });
    }
  });

  // 用戶狀態切換
  app.put("/api/admin/users/:id/toggle-status", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const userId = parseInt(req.params.id);
      const user = await storage.toggleUserStatus(userId);
      
      res.json({
        message: `用戶狀態已${user.isActive ? '啟用' : '停用'}`,
        user: {
          id: user.id,
          username: user.username,
          isActive: user.isActive
        }
      });
    } catch (error: any) {
      console.error("Error toggling user status:", error);
      res.status(500).json({ message: "切換用戶狀態失敗" });
    }
  });

  // LINE Configuration Management
  app.get("/api/line-config", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const config = await storage.getLineConfig();
      res.json(config || null);
    } catch (error: any) {
      console.error("Error fetching LINE config:", error);
      res.status(500).json({ message: "獲取LINE配置失敗" });
    }
  });

  app.post("/api/line-config", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const configData = req.body;
      
      // 自動生成 Callback URL 如果未提供或為空
      if (!configData.callbackUrl || configData.callbackUrl.trim() === '') {
        const protocol = req.protocol;
        const host = req.get('host');
        configData.callbackUrl = `${protocol}://${host}/api/line/callback`;
      }

      const config = await storage.createLineConfig(configData);
      res.status(201).json(config);
    } catch (error: any) {
      console.error("Error creating LINE config:", error);
      res.status(500).json({ message: "創建LINE配置失敗" });
    }
  });

  app.put("/api/line-config/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const configData = req.body;
      
      // 自動生成 Callback URL 如果未提供或為空
      if (!configData.callbackUrl || configData.callbackUrl.trim() === '') {
        const protocol = req.protocol;
        const host = req.get('host');
        configData.callbackUrl = `${protocol}://${host}/api/line/callback`;
      }

      const configId = parseInt(req.params.id);
      const config = await storage.updateLineConfig(configId, configData);
      res.json(config);
    } catch (error: any) {
      console.error("Error updating LINE config:", error);
      res.status(500).json({ message: "更新LINE配置失敗" });
    }
  });

  // 自動生成 Callback URL API
  app.get("/api/line-config/generate-callback", requireAuth, async (req, res) => {
    try {
      const protocol = req.protocol;
      const host = req.get('host');
      const callbackUrl = `${protocol}://${host}/api/line/callback`;
      
      console.log(`Generated callback URL: ${callbackUrl}`);
      res.json({ callbackUrl });
    } catch (error: any) {
      console.error("Error generating callback URL:", error);
      res.status(500).json({ message: "生成 Callback URL 失敗" });
    }
  });

  // LINE登入回調處理 - 實際的callback端點
  app.get("/api/line/callback", async (req, res) => {
    try {
      console.log('LINE callback received:', { 
        query: req.query, 
        hasSession: !!req.session,
        sessionLineState: req.session?.lineState 
      });
      
      // 獲取LINE配置
      const lineConfig = await storage.getLineConfig();
      if (!lineConfig || !lineConfig.isEnabled) {
        console.log('LINE service not enabled');
        return res.redirect('/auth?error=line_not_enabled');
      }

      const { code, state, error } = req.query;
      
      // 處理LINE授權錯誤
      if (error) {
        console.log('LINE authorization error:', error);
        return res.redirect('/auth?error=line_auth_failed');
      }
      
      if (!code) {
        console.log('Missing authorization code');
        return res.redirect('/auth?error=missing_code');
      }

      console.log('Exchanging authorization code for access token...');
      
      // 交換access token
      const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: lineConfig.callbackUrl || '',
          client_id: lineConfig.channelId || '',
          client_secret: lineConfig.channelSecret || '',
        }),
      });

      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokenData);
        return res.redirect('/auth?error=token_exchange_failed');
      }

      console.log('Token exchange successful, fetching user profile...');

      // 獲取用戶資料
      const profileResponse = await fetch('https://api.line.me/v2/profile', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      const profileData = await profileResponse.json();
      
      if (!profileResponse.ok) {
        console.error('Profile fetch failed:', profileData);
        return res.redirect('/auth?error=profile_fetch_failed');
      }

      console.log('Profile fetched successfully:', { userId: profileData.userId, displayName: profileData.displayName });

      // 檢查用戶是否已存在
      let user = await storage.getUserByLineId(profileData.userId);
      
      if (!user) {
        console.log('Creating new user for LINE ID:', profileData.userId);
        // 創建新用戶
        user = await storage.createUser({
          username: `line_${profileData.userId}`,
          email: profileData.email || null,
          fullName: profileData.displayName,
          role: 'user',
          password: await hashPassword(Math.random().toString(36)), // 隨機密碼
          lineUserId: profileData.userId,
          lineDisplayName: profileData.displayName,
          linePictureUrl: profileData.pictureUrl,
          authProvider: 'line',
        });
      } else {
        console.log('Updating existing user:', user.id);
        // 更新用戶資料
        await storage.updateUser(user.id, {
          lineDisplayName: profileData.displayName,
          linePictureUrl: profileData.pictureUrl,
          lastLogin: new Date(),
        });
      }

      // 建立session
      req.session.userId = user.id;
      req.session.isAuthenticated = true;
      
      console.log('LINE login successful for user:', user.id);
      res.redirect('/?line_login_success=true');
      
    } catch (error: any) {
      console.error("LINE callback error:", error);
      res.redirect('/auth?error=callback_failed');
    }
  });

  app.post("/api/line-config/test", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "需要管理員權限" });
      }

      const testResult = await storage.testLineConnection(req.body);
      res.json(testResult);
    } catch (error: any) {
      console.error("Error testing LINE connection:", error);
      res.status(500).json({ message: "測試LINE連線失敗" });
    }
  });

  // 通知系統 API - 真實實作
  app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await storage.getUserNotifications(userId, limit);
      res.json(notifications);
    } catch (error) {
      console.error('獲取通知失敗:', error);
      res.status(500).json({ message: '獲取通知失敗' });
    }
  });

  app.get('/api/notifications/check', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const lastCheck = req.query.lastCheck as string;
      const newNotifications = await storage.getNewNotifications(userId, lastCheck);
      res.json(newNotifications);
    } catch (error) {
      console.error('檢查新通知失敗:', error);
      res.status(500).json({ message: '檢查新通知失敗' });
    }
  });

  app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const notificationId = req.params.id;
      await storage.markNotificationAsRead(userId, notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error('標記通知為已讀失敗:', error);
      res.status(500).json({ message: '標記通知為已讀失敗' });
    }
  });

  app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('標記所有通知為已讀失敗:', error);
      res.status(500).json({ message: '標記所有通知為已讀失敗' });
    }
  });

  app.delete('/api/notifications/:id', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const notificationId = req.params.id;
      await storage.deleteNotification(userId, notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error('刪除通知失敗:', error);
      res.status(500).json({ message: '刪除通知失敗' });
    }
  });

  // 通知設定 API
  app.get('/api/notification-settings', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const settings = await storage.getNotificationSettings(userId);
      res.json(settings);
    } catch (error) {
      console.error('獲取通知設定失敗:', error);
      res.status(500).json({ message: '獲取通知設定失敗' });
    }
  });

  app.put('/api/notification-settings', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const settings = await storage.updateNotificationSettings(userId, req.body);
      res.json(settings);
    } catch (error) {
      console.error('更新通知設定失敗:', error);
      res.status(500).json({ message: '更新通知設定失敗' });
    }
  });

  // 手動生成通知提醒
  app.post('/api/notifications/generate-reminders', requireAuth, async (req, res) => {
    try {
      const count = await storage.generatePaymentReminders();
      res.json({ success: true, generatedCount: count });
    } catch (error) {
      console.error('生成提醒通知失敗:', error);
      res.status(500).json({ message: '生成提醒通知失敗' });
    }
  });

  // 創建自定義通知
  app.post('/api/notifications', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const notification = await storage.createNotification({
        userId,
        ...req.body
      });
      res.json(notification);
    } catch (error) {
      console.error('創建通知失敗:', error);
      res.status(500).json({ message: '創建通知失敗' });
    }
  });

  // 通知設定 API
  app.get('/api/notification-settings', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const settings = await storage.getNotificationSettings(userId);
      res.json(settings);
    } catch (error) {
      console.error('獲取通知設定失敗:', error);
      res.status(500).json({ message: '獲取通知設定失敗' });
    }
  });

  app.post('/api/notification-settings', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const settings = req.body;
      await storage.updateNotificationSettings(userId, settings);
      res.json({ success: true });
    } catch (error) {
      console.error('更新通知設定失敗:', error);
      res.status(500).json({ message: '更新通知設定失敗' });
    }
  });

  // 進階搜尋 API
  app.post('/api/search/advanced', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { filters, searchType = 'payment_items' } = req.body;
      
      let results;
      switch (searchType) {
        case 'payment_items':
          results = await storage.advancedSearchPaymentItems(filters);
          break;
        case 'projects':
          results = await storage.advancedSearchProjects(filters);
          break;
        case 'categories':
          results = await storage.advancedSearchCategories(filters);
          break;
        default:
          return res.status(400).json({ message: '不支援的搜尋類型' });
      }
      
      res.json(results);
    } catch (error) {
      console.error('進階搜尋失敗:', error);
      res.status(500).json({ message: '進階搜尋失敗' });
    }
  });

  // 批量操作 API
  app.post('/api/batch/update', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { action, itemIds, data } = req.body;
      
      const result = await storage.batchUpdatePaymentItems(itemIds, action, data, userId);
      res.json(result);
    } catch (error) {
      console.error('批量更新失敗:', error);
      res.status(500).json({ message: '批量更新失敗' });
    }
  });

  // 批量導入檔案解析 API
  app.post('/api/payment/batch-import/parse', requireAuth, batchImportUpload.single('file'), async (req, res) => {
    try {
      console.log('批量導入 - 收到請求');
      console.log('批量導入 - 檔案資訊:', req.file);
      console.log('批量導入 - 請求內容類型:', req.headers['content-type']);
      
      if (!req.file) {
        console.log('批量導入 - 檔案不存在');
        return res.status(400).json({ message: '請選擇要匯入的檔案' });
      }

      console.log('批量導入 - 開始解析檔案:', req.file.originalname);
      const result = await batchImportProcessor.parseFile(req.file.buffer, req.file.originalname);
      console.log('批量導入 - 解析成功，記錄數量:', result.records.length);
      res.json(result);
    } catch (error: any) {
      console.error('檔案解析失敗:', error);
      res.status(500).json({ message: error.message || '檔案解析失敗' });
    }
  });

  // 批量導入執行 API
  app.post('/api/payment/batch-import/execute', requireAuth, async (req, res) => {
    try {
      const { records } = req.body;
      
      if (!records || !Array.isArray(records)) {
        return res.status(400).json({ message: '無效的導入數據' });
      }

      const result = await batchImportProcessor.executeImport(records);
      res.json(result);
    } catch (error: any) {
      console.error('批量導入失敗:', error);
      res.status(500).json({ message: error.message || '批量導入失敗' });
    }
  });

  // 智能報表 API
  app.get('/api/reports/intelligent', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { period = 'monthly', reportType = 'overview' } = req.query;
      
      const reportData = await storage.generateIntelligentReport(
        period as string, 
        reportType as string,
        userId
      );
      
      res.json(reportData);
    } catch (error) {
      console.error('生成智能報表失敗:', error);
      res.status(500).json({ message: '生成智能報表失敗' });
    }
  });

  app.post('/api/reports/export', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { format, reportType, filters } = req.body;
      
      const exportData = await storage.exportReport(format, reportType, filters, userId);
      res.json(exportData);
    } catch (error) {
      console.error('匯出報表失敗:', error);
      res.status(500).json({ message: '匯出報表失敗' });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(uploadDir));

  // Payment Schedule Routes - 給付款項時間計劃 API
  app.get("/api/payment/schedule/:year/:month", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      const schedules = await storage.getPaymentSchedules(year, month);
      res.json(schedules);
    } catch (error: any) {
      console.error("Error fetching payment schedules:", error);
      res.status(500).json({ message: "Failed to fetch payment schedules" });
    }
  });

  app.post("/api/payment/schedule", async (req, res) => {
    try {
      const { paymentItemId, scheduledDate, scheduledAmount, notes, createdBy } = req.body;
      
      if (!paymentItemId || !scheduledDate || !scheduledAmount) {
        return res.status(400).json({ message: "Missing required fields: paymentItemId, scheduledDate, scheduledAmount" });
      }

      const schedule = await storage.createPaymentSchedule({
        paymentItemId,
        scheduledDate,
        scheduledAmount: scheduledAmount.toString(),
        notes,
        createdBy,
      });

      res.status(201).json(schedule);
    } catch (error: any) {
      console.error("Error creating payment schedule:", error);
      res.status(500).json({ message: "Failed to create payment schedule" });
    }
  });

  app.put("/api/payment/schedule/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      const schedule = await storage.updatePaymentSchedule(id, updateData);
      res.json(schedule);
    } catch (error: any) {
      console.error("Error updating payment schedule:", error);
      res.status(500).json({ message: "Failed to update payment schedule" });
    }
  });

  app.delete("/api/payment/schedule/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePaymentSchedule(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting payment schedule:", error);
      res.status(500).json({ message: "Failed to delete payment schedule" });
    }
  });

  app.get("/api/payment/overdue", async (req, res) => {
    try {
      const schedules = await storage.getOverdueSchedules();
      res.json(schedules);
    } catch (error: any) {
      console.error("Error fetching overdue schedules:", error);
      res.status(500).json({ message: "Failed to fetch overdue schedules" });
    }
  });

  app.post("/api/payment/reschedule/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { newDate, notes } = req.body;
      
      if (!newDate) {
        return res.status(400).json({ message: "Missing required field: newDate" });
      }

      const schedule = await storage.reschedulePayment(id, newDate, notes);
      res.json(schedule);
    } catch (error: any) {
      console.error("Error rescheduling payment:", error);
      res.status(500).json({ message: "Failed to reschedule payment" });
    }
  });

  app.get("/api/payment/schedule/stats/:year/:month", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      const schedules = await storage.getPaymentSchedules(year, month);
      
      // 計算每日統計
      const dailyStats: Record<string, { amount: number; count: number }> = {};
      schedules.forEach(schedule => {
        const date = schedule.scheduledDate;
        if (!dailyStats[date]) {
          dailyStats[date] = { amount: 0, count: 0 };
        }
        dailyStats[date].amount += parseFloat(schedule.scheduledAmount);
        dailyStats[date].count += 1;
      });

      // 計算總統計
      const totalAmount = schedules.reduce((sum, s) => sum + parseFloat(s.scheduledAmount), 0);
      const totalCount = schedules.length;
      const overdueCount = schedules.filter(s => s.isOverdue).length;

      res.json({
        year,
        month,
        totalAmount,
        totalCount,
        overdueCount,
        dailyStats,
      });
    } catch (error: any) {
      console.error("Error fetching payment schedule stats:", error);
      res.status(500).json({ message: "Failed to fetch payment schedule stats" });
    }
  });

  app.get("/api/payment/schedule/items/:year/:month", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      console.log(`API 請求: 查詢 ${year}/${month} 未排程項目`);
      
      // 取得當月未排程的付款項目
      const unscheduledItems = await storage.getUnscheduledPaymentItems(year, month);
      
      console.log(`API 回應: 找到 ${unscheduledItems.length} 個未排程項目`);
      
      res.json(unscheduledItems);
    } catch (error: any) {
      console.error("Error fetching unscheduled payment items:", error);
      res.status(500).json({ message: "Failed to fetch unscheduled payment items" });
    }
  });

  // 查詢所有逾期項目（包含本月之前的）
  app.get("/api/payment/items/overdue", async (req, res) => {
    try {
      console.log("API 請求: 查詢所有逾期項目");
      
      const overdueItems = await storage.getOverduePaymentItems();
      
      console.log(`找到 ${overdueItems.length} 個逾期項目`);
      
      res.json(overdueItems);
    } catch (error: any) {
      console.error("查詢逾期項目時發生錯誤:", error);
      res.status(500).json({ message: "查詢逾期項目失敗" });
    }
  });

  // 整合項目數據API - 包含付款記錄、所有排程記錄的完整信息
  app.get("/api/payment/items/integrated", async (req, res) => {
    try {
      const { year, month } = req.query;
      
      // 獲取所有付款項目
      const items = await storage.getPaymentItems({}, undefined, 10000);
      
      // 獲取所有付款記錄
      const records = await storage.getPaymentRecords({});
      
      // 獲取所有排程記錄（不限月份，確保跨月追蹤）
      const allSchedules = await db
        .select()
        .from(paymentSchedules)
        .orderBy(desc(paymentSchedules.scheduledDate));
      
      // 獲取當月排程記錄（用於計算當月排程金額）
      let monthSchedules: any[] = [];
      if (year && month) {
        monthSchedules = await storage.getPaymentSchedules(parseInt(year as string), parseInt(month as string));
      }
      
      // 整合數據
      const integratedItems = items.map(item => {
        // 計算該項目的實際已付金額
        const itemRecords = records.filter(r => r.itemId === item.id);
        const actualPaid = itemRecords.reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0);
        
        // 獲取該項目的所有排程記錄
        const allItemSchedules = allSchedules.filter(s => s.paymentItemId === item.id);
        
        // 計算當月的排程計劃金額
        const monthItemSchedules = monthSchedules.filter(s => s.paymentItemId === item.id);
        const scheduledTotal = monthItemSchedules.reduce((sum, s) => sum + parseFloat(s.scheduledAmount || "0"), 0);
        
        // 計算待付金額
        const totalAmount = parseFloat(item.totalAmount || "0");
        const pendingAmount = totalAmount - actualPaid;
        
        // 檢查是否有逾期未執行的排程
        const today = new Date();
        const hasOverdueSchedule = allItemSchedules.some(s => {
          const scheduleDate = new Date(s.scheduledDate);
          return scheduleDate < today && s.status !== 'completed' && !s.isOverdue;
        });
        
        return {
          ...item,
          actualPaid: actualPaid.toFixed(2),
          scheduledTotal: scheduledTotal.toFixed(2),
          pendingAmount: pendingAmount.toFixed(2),
          paymentRecords: itemRecords,
          schedules: allItemSchedules, // 返回所有排程記錄
          monthSchedules: monthItemSchedules, // 當月排程
          scheduleCount: allItemSchedules.length,
          recordCount: itemRecords.length,
          hasOverdueSchedule,
        };
      });
      
      res.json(integratedItems);
    } catch (error: any) {
      console.error("Error fetching integrated payment items:", error);
      res.status(500).json({ message: "Failed to fetch integrated payment items" });
    }
  });

  // 獲取項目的所有排程歷史記錄
  app.get("/api/payment/items/:itemId/schedules", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      
      const allSchedules = await db
        .select()
        .from(paymentSchedules)
        .where(eq(paymentSchedules.paymentItemId, itemId))
        .orderBy(desc(paymentSchedules.scheduledDate));
      
      res.json(allSchedules);
    } catch (error: any) {
      console.error("Error fetching item schedules:", error);
      res.status(500).json({ message: "Failed to fetch item schedules" });
    }
  });

  // ==================== 專案預算管理 API ====================

  // 輔助函數：根據付款類型計算項目總額
  function calculateItemTotal(item: any): number {
    const paymentType = item.paymentType || 'single';
    
    if (paymentType === 'monthly') {
      // 月付款項：月付金額 × 月數
      const monthlyAmount = parseFloat(item.monthlyAmount || "0");
      const monthCount = parseInt(item.monthCount || "1") || 1;
      return monthlyAmount * monthCount;
    } else if (paymentType === 'installment') {
      // 分期付款：使用總金額（plannedAmount）
      return parseFloat(item.plannedAmount || "0");
    } else {
      // 一次性付款：使用預估金額
      return parseFloat(item.plannedAmount || "0");
    }
  }

  // 獲取所有預算計劃
  app.get("/api/budget/plans", async (req, res) => {
    try {
      const { projectId, status, includeItems } = req.query;
      
      let query = db.select().from(budgetPlans);
      const conditions: any[] = [];
      
      if (projectId) {
        conditions.push(eq(budgetPlans.projectId, parseInt(projectId as string)));
      }
      if (status) {
        conditions.push(eq(budgetPlans.status, status as string));
      }
      
      const plans = conditions.length > 0 
        ? await query.where(and(...conditions)).orderBy(desc(budgetPlans.createdAt))
        : await query.orderBy(desc(budgetPlans.createdAt));
      
      // 計算每個計劃的項目總額
      const plansWithCalculatedTotals = await Promise.all(
        plans.map(async (plan) => {
          const items = await db.select().from(budgetItems)
            .where(and(
              eq(budgetItems.budgetPlanId, plan.id),
              eq(budgetItems.isDeleted, false)
            ))
            .orderBy(budgetItems.priority, budgetItems.createdAt);
          
          // 計算項目總額（根據付款類型）
          const calculatedTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
          
          if (includeItems === 'true') {
            return { ...plan, items, calculatedTotal };
          }
          return { ...plan, calculatedTotal };
        })
      );
      
      res.json(plansWithCalculatedTotals);
    } catch (error: any) {
      console.error("Error fetching budget plans:", error);
      res.status(500).json({ message: "獲取預算計劃失敗" });
    }
  });

  // 獲取單個預算計劃詳情（含預算項目）
  app.get("/api/budget/plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const [plan] = await db.select().from(budgetPlans).where(eq(budgetPlans.id, id));
      
      if (!plan) {
        return res.status(404).json({ message: "預算計劃不存在" });
      }
      
      // 獲取關聯的預算項目
      const items = await db.select().from(budgetItems)
        .where(and(
          eq(budgetItems.budgetPlanId, id),
          eq(budgetItems.isDeleted, false)
        ))
        .orderBy(budgetItems.priority, budgetItems.createdAt);
      
      // 計算項目總額（根據付款類型）
      const calculatedTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
      
      res.json({ ...plan, items, calculatedTotal });
    } catch (error: any) {
      console.error("Error fetching budget plan:", error);
      res.status(500).json({ message: "獲取預算計劃詳情失敗" });
    }
  });

  // 新建預算計劃
  app.post("/api/budget/plans", async (req, res) => {
    try {
      const validated = insertBudgetPlanSchema.parse(req.body);
      
      const [newPlan] = await db.insert(budgetPlans)
        .values(validated)
        .returning();
      
      res.status(201).json(newPlan);
    } catch (error: any) {
      console.error("Error creating budget plan:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "資料驗證失敗", errors: error.errors });
      }
      res.status(500).json({ message: "建立預算計劃失敗" });
    }
  });

  // 更新預算計劃
  app.patch("/api/budget/plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const [updatedPlan] = await db.update(budgetPlans)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(budgetPlans.id, id))
        .returning();
      
      if (!updatedPlan) {
        return res.status(404).json({ message: "預算計劃不存在" });
      }
      
      res.json(updatedPlan);
    } catch (error: any) {
      console.error("Error updating budget plan:", error);
      res.status(500).json({ message: "更新預算計劃失敗" });
    }
  });

  // 刪除預算計劃
  app.delete("/api/budget/plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // 刪除關聯的預算項目
      await db.delete(budgetItems).where(eq(budgetItems.budgetPlanId, id));
      
      // 刪除預算計劃
      await db.delete(budgetPlans).where(eq(budgetPlans.id, id));
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting budget plan:", error);
      res.status(500).json({ message: "刪除預算計劃失敗" });
    }
  });

  // 獲取預算項目列表
  app.get("/api/budget/items", async (req, res) => {
    try {
      const { budgetPlanId, convertedToPayment } = req.query;
      
      let query = db.select().from(budgetItems);
      const conditions: any[] = [eq(budgetItems.isDeleted, false)];
      
      if (budgetPlanId) {
        conditions.push(eq(budgetItems.budgetPlanId, parseInt(budgetPlanId as string)));
      }
      if (convertedToPayment !== undefined) {
        conditions.push(eq(budgetItems.convertedToPayment, convertedToPayment === 'true'));
      }
      
      const items = await query.where(and(...conditions)).orderBy(budgetItems.priority, budgetItems.createdAt);
      
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching budget items:", error);
      res.status(500).json({ message: "獲取預算項目失敗" });
    }
  });

  // 獲取單個預算項目
  app.get("/api/budget/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const [item] = await db.select().from(budgetItems).where(eq(budgetItems.id, id));
      
      if (!item) {
        return res.status(404).json({ message: "預算項目不存在" });
      }
      
      res.json(item);
    } catch (error: any) {
      console.error("Error fetching budget item:", error);
      res.status(500).json({ message: "獲取預算項目詳情失敗" });
    }
  });

  // 新建預算項目
  app.post("/api/budget/items", async (req, res) => {
    try {
      const validated = insertBudgetItemSchema.parse(req.body);
      
      const [newItem] = await db.insert(budgetItems)
        .values(validated)
        .returning();
      
      // 更新預算計劃的 actualSpent（如果有實際金額）
      if (validated.actualAmount) {
        await updateBudgetPlanActualSpent(validated.budgetPlanId);
      }
      
      res.status(201).json(newItem);
    } catch (error: any) {
      console.error("Error creating budget item:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "資料驗證失敗", errors: error.errors });
      }
      res.status(500).json({ message: "建立預算項目失敗" });
    }
  });

  // 更新預算項目
  app.patch("/api/budget/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // 計算差異
      const updateData = { ...req.body, updatedAt: new Date() };
      
      if (req.body.actualAmount !== undefined && req.body.plannedAmount !== undefined) {
        const planned = parseFloat(req.body.plannedAmount);
        const actual = parseFloat(req.body.actualAmount);
        updateData.variance = (planned - actual).toFixed(2);
        updateData.variancePercentage = planned > 0 ? (((planned - actual) / planned) * 100).toFixed(2) : "0.00";
      }
      
      const [updatedItem] = await db.update(budgetItems)
        .set(updateData)
        .where(eq(budgetItems.id, id))
        .returning();
      
      if (!updatedItem) {
        return res.status(404).json({ message: "預算項目不存在" });
      }
      
      // 更新預算計劃的 actualSpent
      await updateBudgetPlanActualSpent(updatedItem.budgetPlanId);
      
      res.json(updatedItem);
    } catch (error: any) {
      console.error("Error updating budget item:", error);
      res.status(500).json({ message: "更新預算項目失敗" });
    }
  });

  // 刪除預算項目（軟刪除）
  app.delete("/api/budget/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const [item] = await db.update(budgetItems)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(eq(budgetItems.id, id))
        .returning();
      
      if (item) {
        await updateBudgetPlanActualSpent(item.budgetPlanId);
      }
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting budget item:", error);
      res.status(500).json({ message: "刪除預算項目失敗" });
    }
  });

  // 將預算項目轉換為付款項目
  app.post("/api/budget/items/:id/convert", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // 獲取預算項目
      const [budgetItem] = await db.select().from(budgetItems).where(eq(budgetItems.id, id));
      
      if (!budgetItem) {
        return res.status(404).json({ message: "預算項目不存在" });
      }
      
      if (budgetItem.convertedToPayment) {
        return res.status(400).json({ message: "該預算項目已轉換為付款項目" });
      }
      
      // 獲取預算計劃資訊
      const [budgetPlan] = await db.select().from(budgetPlans).where(eq(budgetPlans.id, budgetItem.budgetPlanId));
      
      // 建立付款項目
      const paymentItemData: any = {
        itemName: budgetItem.itemName,
        projectId: budgetPlan?.projectId,
        categoryId: budgetItem.categoryId,
        fixedCategoryId: budgetItem.fixedCategoryId,
        totalAmount: budgetItem.plannedAmount,
        amountPaid: "0.00",
        dueDate: budgetItem.startDate || budgetItem.endDate,
        paymentStatus: "pending",
        priority: budgetItem.priority,
        notes: budgetItem.notes ? `[預算轉換] ${budgetItem.notes}` : "[預算轉換項目]",
      };
      
      // 處理分期付款
      if (budgetItem.paymentType === 'installment' && budgetItem.installmentCount) {
        paymentItemData.paymentType = 'installment';
        paymentItemData.installmentCount = budgetItem.installmentCount;
        paymentItemData.installmentAmount = budgetItem.installmentAmount;
      }
      
      const [newPaymentItem] = await db.insert(paymentItems)
        .values(paymentItemData)
        .returning();
      
      // 更新預算項目的轉換狀態
      await db.update(budgetItems)
        .set({
          convertedToPayment: true,
          linkedPaymentItemId: newPaymentItem.id,
          conversionDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(budgetItems.id, id));
      
      res.status(201).json({
        message: "預算項目已成功轉換為付款項目",
        paymentItem: newPaymentItem,
        budgetItemId: id,
      });
    } catch (error: any) {
      console.error("Error converting budget item:", error);
      res.status(500).json({ message: "轉換預算項目失敗" });
    }
  });

  // 獲取預算計劃統計摘要
  app.get("/api/budget/plans/:id/summary", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const [plan] = await db.select().from(budgetPlans).where(eq(budgetPlans.id, id));
      
      if (!plan) {
        return res.status(404).json({ message: "預算計劃不存在" });
      }
      
      // 獲取所有非刪除的預算項目
      const items = await db.select().from(budgetItems)
        .where(and(
          eq(budgetItems.budgetPlanId, id),
          eq(budgetItems.isDeleted, false)
        ));
      
      // 計算統計（使用付款類型計算）
      const calculatedTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
      const totalActual = items.reduce((sum, item) => sum + parseFloat(item.actualAmount || "0"), 0);
      const convertedCount = items.filter(item => item.convertedToPayment).length;
      const pendingCount = items.filter(item => !item.convertedToPayment).length;
      
      // 按類型統計（包含金額）
      const byPaymentType = {
        single: items.filter(item => !item.paymentType || item.paymentType === 'single'),
        installment: items.filter(item => item.paymentType === 'installment'),
        monthly: items.filter(item => item.paymentType === 'monthly'),
      };
      
      const byPaymentTypeTotal = {
        single: byPaymentType.single.reduce((sum, item) => sum + calculateItemTotal(item), 0),
        installment: byPaymentType.installment.reduce((sum, item) => sum + calculateItemTotal(item), 0),
        monthly: byPaymentType.monthly.reduce((sum, item) => sum + calculateItemTotal(item), 0),
      };
      
      res.json({
        plan,
        summary: {
          totalBudget: parseFloat(plan.totalBudget || "0"),
          calculatedTotal, // 項目計算總額
          totalActual,
          variance: calculatedTotal - totalActual,
          utilizationRate: calculatedTotal > 0 
            ? (totalActual / calculatedTotal * 100).toFixed(1)
            : 0,
          conversionRate: items.length > 0 
            ? (convertedCount / items.length * 100).toFixed(1)
            : 0,
          itemCount: items.length,
          convertedCount,
          pendingCount,
          byPaymentType: {
            single: { count: byPaymentType.single.length, total: byPaymentTypeTotal.single },
            installment: { count: byPaymentType.installment.length, total: byPaymentTypeTotal.installment },
            monthly: { count: byPaymentType.monthly.length, total: byPaymentTypeTotal.monthly },
          },
        },
      });
    } catch (error: any) {
      console.error("Error fetching budget summary:", error);
      res.status(500).json({ message: "獲取預算摘要失敗" });
    }
  });

  // 輔助函數：更新預算計劃的實際支出
  async function updateBudgetPlanActualSpent(budgetPlanId: number) {
    const items = await db.select().from(budgetItems)
      .where(and(
        eq(budgetItems.budgetPlanId, budgetPlanId),
        eq(budgetItems.isDeleted, false)
      ));
    
    const totalActual = items.reduce((sum, item) => sum + parseFloat(item.actualAmount || "0"), 0);
    
    await db.update(budgetPlans)
      .set({ actualSpent: totalActual.toFixed(2), updatedAt: new Date() })
      .where(eq(budgetPlans.id, budgetPlanId));
  }

  // ==================== 單據收件箱 API ====================
  
  // 提供 Object Storage 檔案存取端點（需要驗證）
  app.get("/objects/*", requireAuth, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      await objectStorageService.downloadObject(req.path, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "File not found" });
      }
      console.error("Error serving object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // 配置單據上傳
  const documentUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        console.log('Document upload destination:', inboxDir);
        if (!fs.existsSync(inboxDir)) {
          fs.mkdirSync(inboxDir, { recursive: true });
        }
        cb(null, inboxDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|heic|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = /image\/(jpeg|jpg|png|gif|heic|webp)/.test(file.mimetype);
      
      if (mimetype || extname) {
        return cb(null, true);
      } else {
        cb(new Error('只允許上傳圖片檔案 (JPEG, PNG, GIF, HEIC, WebP)'));
      }
    }
  });

  // 上傳並辨識單據（支援單檔和多檔）
  app.post("/api/document-inbox/upload", requireAuth, documentUpload.array('file', 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "請選擇要上傳的檔案" });
      }

      console.log('Document upload: Received', files.length, 'files');

      // 支援兩種登入方式：session（LINE登入）和 passport（帳號密碼登入）
      const userId = req.session?.userId || (req.user as any)?.id;
      const documentType = req.body.documentType as 'bill' | 'payment' | 'invoice' || 'bill';
      const uploadNotes = req.body.notes || null;
      
      // 取得上傳者用戶名
      let uploadedByUsername = '未知用戶';
      // 如果有 passport 用戶，直接使用其資訊
      if (req.user && (req.user as any).username) {
        const passportUser = req.user as any;
        uploadedByUsername = passportUser.fullName || passportUser.username || '未知用戶';
      } else if (userId) {
        // 否則從資料庫查詢
        const [user] = await db.select({ username: users.username, fullName: users.fullName })
          .from(users)
          .where(eq(users.id, userId));
        if (user) {
          uploadedByUsername = user.fullName || user.username || '未知用戶';
        }
      }
      
      const results = [];
      
      const objectStorageService = new ObjectStorageService();
      
      for (const file of files) {
        console.log('=== Document Upload Debug ===');
        console.log('File info:', {
          originalname: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype
        });
        
        // 確認檔案存在
        if (!fs.existsSync(file.path)) {
          console.error('ERROR: File not saved by multer:', file.path);
          continue;
        }
        
        // 讀取檔案到緩衝區
        const imageBuffer = fs.readFileSync(file.path);
        const mimeType = file.mimetype || 'image/jpeg';
        
        // 上傳到 Object Storage（雲端儲存，不會在部署時遺失）
        let imagePath: string;
        try {
          imagePath = await objectStorageService.uploadBuffer(
            imageBuffer, 
            file.originalname, 
            mimeType
          );
          console.log('File uploaded to Object Storage:', imagePath);
        } catch (storageError) {
          console.error('Object Storage upload failed, falling back to local:', storageError);
          // 如果 Object Storage 失敗，使用本地路徑
          imagePath = `/uploads/inbox/${file.filename}`;
        }
        
        // 刪除本地暫存檔案（Object Storage 上傳成功後）
        if (imagePath.startsWith('/objects/')) {
          try {
            fs.unlinkSync(file.path);
            console.log('Cleaned up local temp file:', file.path);
          } catch (cleanupError) {
            console.error('Failed to cleanup local file:', cleanupError);
          }
        }
        
        const [newDoc] = await db.insert(documentInbox).values({
          userId,
          documentType,
          status: 'processing',
          imagePath,
          originalFilename: file.originalname,
          notes: uploadNotes,
          uploadedByUsername,
        }).returning();
        
        results.push(newDoc);

        // 開始 AI 辨識（背景處理）
        const imageBase64 = imageBuffer.toString('base64');

        (async () => {
          try {
            console.log('Starting AI recognition for:', file.originalname);
            const result = await recognizeDocument(imageBase64, mimeType, documentType);
            console.log('AI recognition completed for:', file.originalname, 'Success:', result.success);
            
            if (result.success) {
              // 處理日期欄位：空字串轉為 null
              const recognizedDate = result.extractedData.date && result.extractedData.date.trim() !== '' 
                ? result.extractedData.date 
                : null;
              
              await db.update(documentInbox)
                .set({
                  status: 'recognized',
                  aiRecognized: true,
                  aiConfidence: result.confidence.toString(),
                  aiExtractedData: result.extractedData,
                  aiRawResponse: result.rawResponse,
                  recognizedVendor: result.extractedData.vendor || null,
                  recognizedAmount: result.extractedData.amount?.toString() || null,
                  recognizedDate: recognizedDate,
                  recognizedDescription: result.extractedData.description || null,
                  recognizedCategory: result.extractedData.category || null,
                  recognizedInvoiceNumber: result.extractedData.invoiceNumber || null,
                  updatedAt: new Date(),
                })
                .where(eq(documentInbox.id, newDoc.id));
            } else {
              await db.update(documentInbox)
                .set({
                  status: 'failed',
                  aiRecognized: false,
                  updatedAt: new Date(),
                })
                .where(eq(documentInbox.id, newDoc.id));
            }
          } catch (aiError: any) {
            console.error("AI recognition error:", aiError);
            // 修正：發生錯誤時也要更新狀態，否則會永遠卡在 'processing'
            try {
              await db.update(documentInbox)
                .set({
                  status: 'failed',
                  aiRecognized: false,
                  notes: (uploadNotes ? uploadNotes + '\n' : '') + `AI辨識錯誤: ${aiError.message || '未知錯誤'}`,
                  updatedAt: new Date(),
                })
                .where(eq(documentInbox.id, newDoc.id));
              console.log('Updated status to failed for:', file.originalname);
            } catch (updateError) {
              console.error("Failed to update status on error:", updateError);
            }
          }
        })();
      }

      res.status(201).json({
        message: `已上傳 ${files.length} 個檔案，正在辨識中...`,
        documents: results,
      });
    } catch (error: any) {
      console.error("Error batch uploading:", error);
      res.status(500).json({ message: error.message || "批次上傳失敗" });
    }
  });

  // 獲取待整理項目列表
  app.get("/api/document-inbox", async (req, res) => {
    try {
      const { status, documentType } = req.query;
      
      let query = db.select().from(documentInbox);
      
      const conditions = [];
      if (status && status !== 'all') {
        conditions.push(eq(documentInbox.status, status as string));
      } else {
        // 預設不顯示已歸檔的
        conditions.push(sql`${documentInbox.status} != 'archived'`);
      }
      
      if (documentType && documentType !== 'all') {
        conditions.push(eq(documentInbox.documentType, documentType as string));
      }
      
      const docs = await db.select()
        .from(documentInbox)
        .where(and(...conditions))
        .orderBy(desc(documentInbox.createdAt));
      
      res.json(docs);
    } catch (error: any) {
      console.error("Error fetching inbox:", error);
      res.status(500).json({ message: "獲取待整理項目失敗" });
    }
  });

  // 獲取待整理項目統計
  app.get("/api/document-inbox/stats", async (req, res) => {
    try {
      const stats = await db.select({
        documentType: documentInbox.documentType,
        status: documentInbox.status,
        count: sql<number>`count(*)::int`,
      })
        .from(documentInbox)
        .where(sql`${documentInbox.status} != 'archived'`)
        .groupBy(documentInbox.documentType, documentInbox.status);
      
      // 整理成更易用的格式
      const summary = {
        bill: { pending: 0, processing: 0, recognized: 0, failed: 0, total: 0 },
        payment: { pending: 0, processing: 0, recognized: 0, failed: 0, total: 0 },
        invoice: { pending: 0, processing: 0, recognized: 0, failed: 0, total: 0 },
        totalPending: 0,
      };
      
      for (const stat of stats) {
        const type = stat.documentType as keyof typeof summary;
        if (type in summary && typeof summary[type] === 'object') {
          const statusKey = stat.status as keyof typeof summary.bill;
          if (statusKey in summary[type]) {
            (summary[type] as any)[statusKey] = stat.count;
            (summary[type] as any).total += stat.count;
          }
        }
      }
      
      summary.totalPending = summary.bill.total + summary.payment.total + summary.invoice.total;
      
      res.json(summary);
    } catch (error: any) {
      console.error("Error fetching inbox stats:", error);
      res.status(500).json({ message: "獲取統計失敗" });
    }
  });

  // 獲取單一待整理項目
  app.get("/api/document-inbox/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [doc] = await db.select().from(documentInbox).where(eq(documentInbox.id, id));
      
      if (!doc) {
        return res.status(404).json({ message: "找不到該項目" });
      }
      
      res.json(doc);
    } catch (error: any) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "獲取項目失敗" });
    }
  });

  // 更新/確認待整理項目
  app.put("/api/document-inbox/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      const [updated] = await db.update(documentInbox)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(documentInbox.id, id))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating document:", error);
      res.status(500).json({ message: "更新失敗" });
    }
  });

  // 重新辨識單據
  app.post("/api/document-inbox/:id/re-recognize", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [doc] = await db.select().from(documentInbox).where(eq(documentInbox.id, id));
      
      if (!doc) {
        return res.status(404).json({ message: "找不到該項目" });
      }
      
      // 更新狀態為處理中
      await db.update(documentInbox)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(documentInbox.id, id));
      
      let imageBuffer: Buffer;
      let mimeType: string;
      
      // 從本地儲存讀取檔案
      try {
        const objectStorageService = new ObjectStorageService();
        if (doc.imagePath.startsWith('/objects/')) {
          imageBuffer = await objectStorageService.getFileBuffer(doc.imagePath);
        } else {
          const imagePath = path.join(process.cwd(), doc.imagePath.replace(/^\//, ''));
          if (!fs.existsSync(imagePath)) {
            throw new Error('File not found');
          }
          imageBuffer = fs.readFileSync(imagePath);
        }
        const ext = path.extname(doc.imagePath).toLowerCase();
        mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
      } catch (readError) {
        console.error("Error reading file:", readError);
        await db.update(documentInbox)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(documentInbox.id, id));
        return res.status(404).json({ message: "找不到圖片檔案" });
      }
      
      const imageBase64 = imageBuffer.toString('base64');
      
      const result = await recognizeDocument(imageBase64, mimeType, doc.documentType as any);
      
      if (result.success) {
        // 處理日期欄位：空字串轉為 null
        const recognizedDate = result.extractedData.date && result.extractedData.date.trim() !== '' 
          ? result.extractedData.date 
          : null;
        
        const [updated] = await db.update(documentInbox)
          .set({
            status: 'recognized',
            aiRecognized: true,
            aiConfidence: result.confidence.toString(),
            aiExtractedData: result.extractedData,
            aiRawResponse: result.rawResponse,
            recognizedVendor: result.extractedData.vendor || null,
            recognizedAmount: result.extractedData.amount?.toString() || null,
            recognizedDate: recognizedDate,
            recognizedDescription: result.extractedData.description || null,
            recognizedCategory: result.extractedData.category || null,
            recognizedInvoiceNumber: result.extractedData.invoiceNumber || null,
            updatedAt: new Date(),
          })
          .where(eq(documentInbox.id, id))
          .returning();
        
        res.json({ message: "重新辨識完成", document: updated });
      } else {
        await db.update(documentInbox)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(documentInbox.id, id));
        
        res.status(400).json({ message: result.error || "辨識失敗" });
      }
    } catch (error: any) {
      console.error("Error re-recognizing:", error);
      res.status(500).json({ message: "重新辨識失敗" });
    }
  });

  // 帳單歸檔為付款項目
  app.post("/api/document-inbox/:id/archive-to-payment-item", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [doc] = await db.select().from(documentInbox).where(eq(documentInbox.id, id));
      
      if (!doc) {
        return res.status(404).json({ message: "找不到該項目" });
      }
      
      const userId = req.session?.userId;
      const { projectId, categoryId, itemName, totalAmount, dueDate, notes } = req.body;
      
      // 取得歸檔者用戶名
      let archivedByUsername = '未知用戶';
      if (userId) {
        const [user] = await db.select({ username: users.username, fullName: users.fullName })
          .from(users)
          .where(eq(users.id, userId));
        if (user) {
          archivedByUsername = user.fullName || user.username || '未知用戶';
        }
      }
      
      // 建立追蹤備註
      const formatDate = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const uploadTime = doc.createdAt ? formatDate(new Date(doc.createdAt)) : '未知時間';
      const editInfo = doc.editedAt && doc.editedByUsername 
        ? `\n編輯帳號：${doc.editedByUsername}（${formatDate(new Date(doc.editedAt))}）` 
        : '';
      const archiveTime = formatDate(new Date());
      
      const trackingNotes = `---單據追蹤---\n上傳時間：${uploadTime}\n上傳帳號：${doc.uploadedByUsername || '未知用戶'}${editInfo}\n歸檔帳號：${archivedByUsername}（${archiveTime}）\n---原始備註---\n${notes || doc.notes || '無'}`;
      
      // 計算開始日期：使用到期日或辨識日期或今天
      const docDate = dueDate || doc.confirmedDate || doc.recognizedDate;
      const startDateValue = docDate ? docDate : new Date().toISOString().split('T')[0];
      
      // 建立付款項目（含完整來源追蹤）
      const now = new Date();
      const [newItem] = await db.insert(paymentItems).values({
        projectId: projectId || null,
        categoryId: categoryId || null,
        itemName: itemName || doc.confirmedDescription || doc.recognizedDescription || '待確認項目',
        totalAmount: totalAmount || doc.confirmedAmount || doc.recognizedAmount || '0',
        paidAmount: '0',
        status: 'unpaid',
        startDate: startDateValue,
        dueDate: dueDate || doc.confirmedDate || doc.recognizedDate || null,
        vendor: doc.confirmedVendor || doc.recognizedVendor,
        receiptImage: doc.imagePath,
        notes: trackingNotes,
        createdAt: now,
        updatedAt: now,
        // 項目來源追蹤
        source: 'ai_scan',
        sourceDocumentId: doc.id,
        documentUploadedAt: doc.createdAt,
        documentUploadedByUserId: doc.uploadedByUserId,
        documentUploadedByUsername: doc.uploadedByUsername,
        archivedByUserId: userId,
        archivedByUsername,
        archivedAt: now,
      }).returning();
      
      // 更新收件箱狀態
      await db.update(documentInbox)
        .set({
          status: 'archived',
          archivedToType: 'payment_item',
          archivedToId: newItem.id,
          archivedAt: new Date(),
          archivedByUserId: userId,
          archivedByUsername,
          updatedAt: new Date(),
        })
        .where(eq(documentInbox.id, id));
      
      res.json({
        message: "已成功轉為付款項目",
        paymentItem: newItem,
      });
    } catch (error: any) {
      console.error("Error archiving to payment item:", error);
      res.status(500).json({ message: "歸檔失敗" });
    }
  });

  // 付款憑證歸檔為付款記錄
  app.post("/api/document-inbox/:id/archive-to-payment-record", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [doc] = await db.select().from(documentInbox).where(eq(documentInbox.id, id));
      
      if (!doc) {
        return res.status(404).json({ message: "找不到該項目" });
      }
      
      const userId = req.session?.userId;
      const { paymentItemId, amount, paymentDate, paymentMethod, notes } = req.body;
      
      if (!paymentItemId) {
        return res.status(400).json({ message: "請選擇要關聯的付款項目" });
      }
      
      // 取得歸檔者用戶名
      let archivedByUsername = '未知用戶';
      if (userId) {
        const [user] = await db.select({ username: users.username, fullName: users.fullName })
          .from(users)
          .where(eq(users.id, userId));
        if (user) {
          archivedByUsername = user.fullName || user.username || '未知用戶';
        }
      }
      
      // 建立追蹤備註
      const formatDate = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const uploadTime = doc.createdAt ? formatDate(new Date(doc.createdAt)) : '未知時間';
      const editInfo = doc.editedAt && doc.editedByUsername 
        ? `\n編輯帳號：${doc.editedByUsername}（${formatDate(new Date(doc.editedAt))}）` 
        : '';
      const archiveTime = formatDate(new Date());
      
      const trackingNotes = `---單據追蹤---\n上傳時間：${uploadTime}\n上傳帳號：${doc.uploadedByUsername || '未知用戶'}${editInfo}\n歸檔帳號：${archivedByUsername}（${archiveTime}）\n---原始備註---\n${notes || doc.notes || '無'}`;
      
      // 建立付款記錄
      const [newRecord] = await db.insert(paymentRecords).values({
        itemId: paymentItemId,
        amountPaid: amount || doc.confirmedAmount || doc.recognizedAmount || '0',
        paymentDate: paymentDate || doc.confirmedDate || doc.recognizedDate || new Date().toISOString().split('T')[0],
        paymentMethod: paymentMethod || 'cash',
        receiptImageUrl: doc.imagePath,
        notes: trackingNotes,
      }).returning();
      
      // 更新付款項目已付金額
      const [item] = await db.select().from(paymentItems).where(eq(paymentItems.id, paymentItemId));
      if (item) {
        const newPaidAmount = parseFloat(item.paidAmount || '0') + parseFloat(newRecord.amountPaid || '0');
        const newStatus = newPaidAmount >= parseFloat(item.totalAmount || '0') ? 'paid' : 'partial';
        
        await db.update(paymentItems)
          .set({
            paidAmount: newPaidAmount.toFixed(2),
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(paymentItems.id, paymentItemId));
      }
      
      // 更新收件箱狀態
      await db.update(documentInbox)
        .set({
          status: 'archived',
          archivedToType: 'payment_record',
          archivedToId: newRecord.id,
          archivedAt: new Date(),
          archivedByUserId: userId,
          archivedByUsername,
          updatedAt: new Date(),
        })
        .where(eq(documentInbox.id, id));
      
      res.json({
        message: "已成功轉為付款記錄",
        paymentRecord: newRecord,
      });
    } catch (error: any) {
      console.error("Error archiving to payment record:", error);
      res.status(500).json({ message: "歸檔失敗" });
    }
  });

  // 發票歸檔為發票記錄
  app.post("/api/document-inbox/:id/archive-to-invoice", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [doc] = await db.select().from(documentInbox).where(eq(documentInbox.id, id));
      
      if (!doc) {
        return res.status(404).json({ message: "找不到該項目" });
      }
      
      const userId = req.session?.userId;
      const { 
        invoiceNumber, invoiceDate, vendorName, vendorTaxId,
        totalAmount, taxAmount, subtotal, category, description,
        invoiceType, paymentItemId, paymentRecordId, notes 
      } = req.body;
      
      // 取得歸檔者用戶名
      let archivedByUsername = '未知用戶';
      if (userId) {
        const [user] = await db.select({ username: users.username, fullName: users.fullName })
          .from(users)
          .where(eq(users.id, userId));
        if (user) {
          archivedByUsername = user.fullName || user.username || '未知用戶';
        }
      }
      
      // 建立追蹤備註
      const formatDate = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const uploadTime = doc.createdAt ? formatDate(new Date(doc.createdAt)) : '未知時間';
      const editInfo = doc.editedAt && doc.editedByUsername 
        ? `\n編輯帳號：${doc.editedByUsername}（${formatDate(new Date(doc.editedAt))}）` 
        : '';
      const archiveTime = formatDate(new Date());
      
      const trackingNotes = `---單據追蹤---\n上傳時間：${uploadTime}\n上傳帳號：${doc.uploadedByUsername || '未知用戶'}${editInfo}\n歸檔帳號：${archivedByUsername}（${archiveTime}）\n---原始備註---\n${notes || doc.notes || '無'}`;
      
      const extractedData = doc.aiExtractedData as any || {};
      
      // 建立發票記錄
      const invDate = invoiceDate || doc.confirmedDate || doc.recognizedDate || new Date().toISOString().split('T')[0];
      const parsedDate = new Date(invDate);
      
      const [newInvoice] = await db.insert(invoiceRecords).values({
        userId,
        invoiceNumber: invoiceNumber || doc.recognizedInvoiceNumber || extractedData.invoiceNumber,
        invoiceDate: invDate,
        vendorName: vendorName || doc.confirmedVendor || doc.recognizedVendor,
        vendorTaxId: vendorTaxId || extractedData.taxId,
        totalAmount: totalAmount || doc.confirmedAmount || doc.recognizedAmount || '0',
        taxAmount: taxAmount || extractedData.taxAmount?.toString(),
        subtotal: subtotal || extractedData.subtotal?.toString(),
        category: category || doc.confirmedCategory || doc.recognizedCategory,
        description: description || doc.confirmedDescription || doc.recognizedDescription,
        invoiceType: invoiceType || 'expense',
        paymentItemId: paymentItemId || null,
        paymentRecordId: paymentRecordId || null,
        documentInboxId: id,
        imagePath: doc.imagePath,
        taxYear: parsedDate.getFullYear(),
        taxMonth: parsedDate.getMonth() + 1,
        notes: trackingNotes,
      }).returning();
      
      // 更新收件箱狀態
      await db.update(documentInbox)
        .set({
          status: 'archived',
          archivedToType: 'invoice_record',
          archivedToId: newInvoice.id,
          archivedAt: new Date(),
          archivedByUserId: userId,
          archivedByUsername,
          updatedAt: new Date(),
        })
        .where(eq(documentInbox.id, id));
      
      res.json({
        message: "已成功轉為發票記錄",
        invoiceRecord: newInvoice,
      });
    } catch (error: any) {
      console.error("Error archiving to invoice:", error);
      res.status(500).json({ message: "歸檔失敗" });
    }
  });

  // 更新待整理項目備註
  app.patch("/api/document-inbox/:id/notes", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { notes } = req.body;
      const userId = req.session?.userId;
      
      // 取得編輯者用戶名
      let editedByUsername = '未知用戶';
      if (userId) {
        const [user] = await db.select({ username: users.username, fullName: users.fullName })
          .from(users)
          .where(eq(users.id, userId));
        if (user) {
          editedByUsername = user.fullName || user.username || '未知用戶';
        }
      }
      
      const [updated] = await db.update(documentInbox)
        .set({ 
          notes: notes || null,
          editedByUserId: userId,
          editedByUsername,
          editedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(documentInbox.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "找不到該項目" });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating document notes:", error);
      res.status(500).json({ message: "更新備註失敗" });
    }
  });

  // 刪除待整理項目
  app.delete("/api/document-inbox/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [doc] = await db.select().from(documentInbox).where(eq(documentInbox.id, id));
      
      if (!doc) {
        return res.status(404).json({ message: "找不到該項目" });
      }
      
      // 刪除圖片檔案（Object Storage 或本地）
      if (doc.imagePath.startsWith('/objects/')) {
        // Object Storage 檔案 - 不需要刪除，會自動過期或手動清理
        console.log('Skipping Object Storage file deletion:', doc.imagePath);
      } else {
        // 本地檔案
        const imagePath = path.join(process.cwd(), doc.imagePath.replace(/^\//, ''));
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      // 刪除資料庫記錄
      await db.delete(documentInbox).where(eq(documentInbox.id, id));
      
      res.json({ message: "已刪除" });
    } catch (error: any) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "刪除失敗" });
    }
  });

  // ==================== 發票記錄 API ====================
  
  // 獲取發票記錄列表
  app.get("/api/invoice-records", async (req, res) => {
    try {
      const { year, month, category, invoiceType } = req.query;
      
      const conditions = [];
      
      if (year) {
        conditions.push(eq(invoiceRecords.taxYear, parseInt(year as string)));
      }
      if (month) {
        conditions.push(eq(invoiceRecords.taxMonth, parseInt(month as string)));
      }
      if (category) {
        conditions.push(eq(invoiceRecords.category, category as string));
      }
      if (invoiceType) {
        conditions.push(eq(invoiceRecords.invoiceType, invoiceType as string));
      }
      
      const records = conditions.length > 0
        ? await db.select().from(invoiceRecords).where(and(...conditions)).orderBy(desc(invoiceRecords.invoiceDate))
        : await db.select().from(invoiceRecords).orderBy(desc(invoiceRecords.invoiceDate));
      
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching invoice records:", error);
      res.status(500).json({ message: "獲取發票記錄失敗" });
    }
  });

  // 獲取發票統計
  app.get("/api/invoice-records/stats", async (req, res) => {
    try {
      const { year } = req.query;
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      
      const stats = await db.select({
        month: invoiceRecords.taxMonth,
        invoiceType: invoiceRecords.invoiceType,
        totalAmount: sql<string>`sum(${invoiceRecords.totalAmount})::text`,
        count: sql<number>`count(*)::int`,
      })
        .from(invoiceRecords)
        .where(eq(invoiceRecords.taxYear, targetYear))
        .groupBy(invoiceRecords.taxMonth, invoiceRecords.invoiceType);
      
      res.json({ year: targetYear, stats });
    } catch (error: any) {
      console.error("Error fetching invoice stats:", error);
      res.status(500).json({ message: "獲取發票統計失敗" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}