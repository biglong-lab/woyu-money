import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertDebtCategorySchema,
  insertPaymentProjectSchema, insertPaymentItemSchema, 
  insertPaymentRecordSchema,
  insertRentalContractSchema,
  insertRentalPriceTierSchema,
  insertContractDocumentSchema,
  insertInstallmentPlanSchema,
  insertHouseholdBudgetSchema,
  insertHouseholdExpenseSchema,

  debtCategories,
  paymentProjects,
  rentalContracts,
  rentalPriceTiers,
  contractDocuments,
  installmentPlans,

} from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";

// 確保上傳目錄存在
const uploadDir = path.join(process.cwd(), 'uploads');
const contractsDir = path.join(uploadDir, 'contracts');
const receiptsDir = path.join(uploadDir, 'receipts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(contractsDir)) {
  fs.mkdirSync(contractsDir, { recursive: true });
}
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

// 配置multer來處理檔案上傳
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
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

// Contract upload configuration  
const contractUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, contractsDir);
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
    // 支援圖片和 Excel 文件
    const imageTypes = /jpeg|jpg|png|gif/;
    const excelTypes = /xlsx|xls/;
    const extName = path.extname(file.originalname).toLowerCase();
    
    const isImage = imageTypes.test(extName) && imageTypes.test(file.mimetype);
    const isExcel = excelTypes.test(extName) || 
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel';
    
    if (isImage || isExcel) {
      return cb(null, true);
    } else {
      cb(new Error('只允許上傳圖片檔案或 Excel 檔案'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Static file serving for uploads
  app.use('/uploads', express.static(uploadDir));

  // Get all debt categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getDebtCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  
  // Create debt category
  app.post("/api/categories", async (req, res) => {
    try {
      const result = insertDebtCategorySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid category data", errors: result.error.errors });
      }
      const category = await storage.createDebtCategory(result.data);
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });
  },
  fileFilter: (req, file, cb) => {
    // 支援PDF、Word、圖片等格式
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});



export async function registerRoutes(app: Express): Promise<Server> {
  // 靜態檔案服務 - 用於提供上傳的圖片
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache
    next();
  });
  app.use('/uploads', express.static(uploadDir));

  // Categories routes - Core functionality
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/project", async (req, res) => {
    try {
      const includeUsage = req.query.includeUsage === 'true';
      const categories = await storage.getProjectCategories();
      
      if (includeUsage) {
        // 添加使用次數統計
        const categoriesWithUsage = await Promise.all(
          categories.map(async (category) => {
            const usageCount = await storage.getCategoryUsageCount(category.id);
            return { ...category, usageCount };
          })
        );
        res.json(categoriesWithUsage);
      } else {
        res.json(categories);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project categories" });
    }
  });

  // 獲取分類統計數據
  app.get("/api/categories/:type/stats", async (req, res) => {
    try {
      const { type } = req.params;
      const stats = await storage.getCategoryStats(type as "project" | "household");
      res.json(stats);
    } catch (error) {
      console.error("Error fetching category stats:", error);
      res.status(500).json({ message: "Failed to fetch category stats" });
    }
  });

  app.post("/api/categories/project", async (req, res) => {
    try {
      const categoryData = insertDebtCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create project category" });
      }
    }
  });

  app.patch("/api/categories/project/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = insertDebtCategorySchema.parse(req.body);
      const category = await storage.updateCategory(id, categoryData);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update project category" });
      }
    }
  });

  app.delete("/api/categories/project/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project category" });
    }
  });

  // Household category routes
  app.get("/api/categories/household", async (req, res) => {
    try {
      const categories = await storage.getHouseholdCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch household categories" });
    }
  });

  app.post("/api/categories/household", async (req, res) => {
    try {
      const categoryData = insertDebtCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create household category" });
      }
    }
  });

  app.patch("/api/categories/household/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = insertDebtCategorySchema.parse(req.body);
      const category = await storage.updateCategory(id, categoryData);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update household category" });
      }
    }
  });

  app.delete("/api/categories/household/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete household category" });
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
      const categoryData = insertDebtCategorySchema.parse(req.body);
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

  // Payment Projects routes
  app.get("/api/payment/projects", async (req, res) => {
    try {
      const projects = await storage.getPaymentProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
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
        res.status(500).json({ message: "Failed to create project" });
      }
    }
  });

  // Enhanced Payment Items routes with audit logging and soft delete
  app.get("/api/payment/items", async (req, res) => {
    try {
      const items = await storage.getPaymentItems();
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching payment items:", error);
      res.status(500).json({ message: "Failed to fetch payment items" });
    }
  });

  app.post("/api/payment/items", async (req, res) => {
    try {
      const { changeReason, userInfo, ...itemData } = req.body;
      
      // Handle empty date strings
      if (itemData.endDate === "") {
        itemData.endDate = undefined;
      }
      
      const validatedData = insertPaymentItemSchema.parse(itemData);
      const item = await storage.createPaymentItem(validatedData, userInfo || "系統管理員");
      res.status(201).json(item);
    } catch (error: any) {
      console.error("Error creating payment item:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create payment item" });
      }
    }
  });

  // Get single payment item
  app.get("/api/payment/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.getPaymentItem(id);
      if (!item) {
        return res.status(404).json({ message: "Payment item not found" });
      }
      res.json(item);
    } catch (error: any) {
      console.error("Error fetching payment item:", error);
      res.status(500).json({ message: "Failed to fetch payment item" });
    }
  });

  // Get payment records for a specific item
  app.get("/api/payment/items/:id/records", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const records = await storage.getPaymentRecordsByItemId(id);
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching payment records:", error);
      res.status(500).json({ message: "Failed to fetch payment records" });
    }
  });

  app.put("/api/payment/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { changeReason, userInfo, ...itemData } = req.body;
      
      // Handle empty date strings
      if (itemData.endDate === "") {
        itemData.endDate = undefined;
      }
      
      const validatedData = insertPaymentItemSchema.parse(itemData);
      const item = await storage.updatePaymentItem(
        id, 
        validatedData, 
        userInfo || "系統管理員", 
        changeReason || "更新項目資訊"
      );
      res.json(item);
    } catch (error: any) {
      console.error("Error updating payment item:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update payment item" });
      }
    }
  });

  app.patch("/api/payment/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { changeReason, userInfo, ...updateData } = req.body;
      
      // Handle regular updates
      if (updateData.endDate === "") {
        updateData.endDate = undefined;
      }
      
      // Convert totalAmount to string if it's a number
      if (typeof updateData.totalAmount === 'number') {
        updateData.totalAmount = updateData.totalAmount.toString();
      }
      
      // Get current item to merge with partial update
      const currentItem = await storage.getPaymentItem(id);
      const mergedData = { ...currentItem, ...updateData };
      
      const validatedData = insertPaymentItemSchema.parse(mergedData);
      const item = await storage.updatePaymentItem(
        id, 
        validatedData, 
        userInfo || "系統管理員", 
        changeReason || "更新項目資訊"
      );
      res.json(item);
    } catch (error: any) {
      console.error("Error updating payment item:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update payment item" });
      }
    }
  });

  app.delete("/api/payment/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { changeReason, userInfo } = req.body;
      await storage.deletePaymentItem(
        id, 
        userInfo || "系統管理員", 
        changeReason || "刪除項目"
      );
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting payment item:", error);
      res.status(500).json({ message: "Failed to delete payment item" });
    }
  });

  // Restore deleted payment item
  app.post("/api/payment/items/:id/restore", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { changeReason, userInfo } = req.body;
      const item = await storage.restorePaymentItem(
        id, 
        userInfo || "系統管理員", 
        changeReason || "恢復項目"
      );
      res.json(item);
    } catch (error: any) {
      console.error("Error restoring payment item:", error);
      res.status(500).json({ message: "Failed to restore payment item" });
    }
  });

  // Get audit logs for a specific payment item
  app.get("/api/audit-logs/:tableName/:recordId", async (req, res) => {
    try {
      const { tableName, recordId } = req.params;
      const logs = await storage.getAuditLogs(tableName, parseInt(recordId));
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Enhanced paginated payment items endpoint
  app.get("/api/payment/items/paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100); // Max 100 items per page
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

  // Bulk update payment items
  app.patch("/api/payment/items/bulk", async (req, res) => {
    try {
      const { itemIds, updates, userInfo } = req.body;
      
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ message: "itemIds must be a non-empty array" });
      }

      await storage.bulkUpdatePaymentItems(itemIds, updates, userInfo);
      res.json({ message: "Bulk update completed successfully" });
    } catch (error: any) {
      console.error("Error in bulk update:", error);
      res.status(500).json({ message: "Failed to perform bulk update" });
    }
  });

  // Payment summary by date range
  app.get("/api/payment/summary", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const summary = await storage.getPaymentSummaryByDateRange(
        startDate as string, 
        endDate as string
      );
      res.json(summary);
    } catch (error: any) {
      console.error("Error fetching payment summary:", error);
      res.status(500).json({ message: "Failed to fetch payment summary" });
    }
  });

  // Payment Records routes
  app.get("/api/payment/records", async (req, res) => {
    try {
      const records = await storage.getPaymentRecords();
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment records" });
    }
  });

  // Export payment records
  app.get("/api/payment/records/export", async (req, res) => {
    try {
      const { 
        dateFrom, 
        dateTo, 
        projectId, 
        categoryId, 
        includeReceipts, 
        format = 'excel' 
      } = req.query;

      // Build filter conditions
      const filters: any = {};
      if (dateFrom) filters.dateFrom = dateFrom as string;
      if (dateTo) filters.dateTo = dateTo as string;
      if (projectId && projectId !== 'all') filters.projectId = parseInt(projectId as string);
      if (categoryId && categoryId !== 'all') filters.categoryId = parseInt(categoryId as string);

      const records = await storage.getFilteredPaymentRecords(filters);

      if (format === 'csv') {
        // Generate CSV
        let csvContent = 'ID,項目名稱,付款金額,付款日期,付款方式,專案,分類,備註';
        if (includeReceipts === 'true') {
          csvContent += ',收據圖片';
        }
        csvContent += '\n';

        records.forEach((record: any) => {
          const row = [
            record.id,
            `"${record.itemName || ''}"`,
            record.amount,
            record.paymentDate,
            `"${record.paymentMethod || ''}"`,
            `"${record.projectName || ''}"`,
            `"${record.categoryName || ''}"`,
            `"${record.notes || ''}"`
          ];
          
          if (includeReceipts === 'true') {
            const receiptUrl = record.receiptImage ? `${req.protocol}://${req.get('host')}/uploads/${record.receiptImage}` : '';
            row.push(`"${receiptUrl}"`);
          }
          
          csvContent += row.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="payment-records.csv"');
        res.send('\ufeff' + csvContent); // Add BOM for proper UTF-8 encoding
      } else {
        // Generate Excel (simplified JSON format for now)
        const excelData = records.map((record: any) => {
          const row: any = {
            'ID': record.id,
            '項目名稱': record.itemName || '',
            '付款金額': parseFloat(record.amount),
            '付款日期': record.paymentDate,
            '付款方式': record.paymentMethod || '',
            '專案': record.projectName || '',
            '分類': record.categoryName || '',
            '備註': record.notes || ''
          };
          
          if (includeReceipts === 'true' && record.receiptImage) {
            row['收據圖片'] = `${req.protocol}://${req.get('host')}/uploads/${record.receiptImage}`;
          }
          
          return row;
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="payment-records.json"');
        res.json({
          metadata: {
            exportDate: new Date().toISOString(),
            totalRecords: records.length,
            filters: filters
          },
          records: excelData
        });
      }
    } catch (error: any) {
      console.error("Error exporting payment records:", error);
      res.status(500).json({ message: "Failed to export payment records" });
    }
  });

  // 詳細付款記錄查詢（包含完整專案歸屬資訊）
  app.get("/api/payment/records", async (req, res) => {
    try {
      console.log("Fetching payment records...");
      const records = await storage.getPaymentRecords();
      console.log("Found records:", records.length);
      res.json(records);
    } catch (error: any) {
      console.error("Payment records error:", error);
      res.status(500).json({ message: "Failed to fetch payment records", error: error.message });
    }
  });

  // Keep the old endpoint for backwards compatibility
  app.get("/api/payment/records/all", async (req, res) => {
    try {
      const records = await storage.getPaymentRecords();
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch detailed payment records" });
    }
  });

  app.post("/api/payment/records", upload.single('receiptImage'), async (req, res) => {
    try {
      const { itemId, amount, paymentDate, paymentMethod, notes } = req.body;
      const paymentAmount = parseFloat(amount);
      const itemIdNum = parseInt(itemId);
      
      // Check current payment status to prevent overpayment
      const paymentItem = await storage.getPaymentItem(itemIdNum);
      if (!paymentItem) {
        return res.status(404).json({ message: "Payment item not found" });
      }
      
      // Get current total paid amount
      const currentRecords = await storage.getPaymentRecordsByItemId(itemIdNum);
      const currentPaid = currentRecords.reduce((total, record) => total + parseFloat(record.amount || '0'), 0);
      const totalAmount = parseFloat(paymentItem.totalAmount || '0');
      
      // Prevent overpayment
      if (currentPaid + paymentAmount > totalAmount) {
        const remainingAmount = totalAmount - currentPaid;
        return res.status(400).json({ 
          message: `付款金額超過剩餘應付金額。剩餘應付：NT$${remainingAmount.toLocaleString()}，嘗試付款：NT$${paymentAmount.toLocaleString()}`,
          remainingAmount: remainingAmount,
          attemptedAmount: paymentAmount
        });
      }
      
      const recordData = {
        itemId: itemIdNum,
        amount: amount.toString(),
        paymentDate: paymentDate,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
        receiptImage: req.file ? req.file.filename : null
      };

      const validatedData = insertPaymentRecordSchema.parse(recordData);
      const record = await storage.createPaymentRecord(validatedData);
      
      // Update payment item status and paid amount
      await storage.updatePaymentItemAmounts(itemIdNum);
      
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Payment record creation error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create payment record", error: error.message });
      }
    }
  });

  app.put("/api/payment/records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const recordData = insertPaymentRecordSchema.parse(req.body);
      const record = await storage.updatePaymentRecord(id, recordData);
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update payment record" });
      }
    }
  });

  app.delete("/api/payment/records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePaymentRecord(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete payment record" });
    }
  });

  // Rental Management routes
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
      
      const contract = await storage.createRentalContract(validatedContract, priceTiers);
      res.status(201).json(contract);
    } catch (error: any) {
      console.error("Error creating rental contract:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create rental contract" });
      }
    }
  });

  app.put("/api/rental/contracts/:id", async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const { priceTiers, ...contractData } = req.body;
      const validatedContract = insertRentalContractSchema.partial().parse(contractData);
      
      const contract = await storage.updateRentalContract(contractId, validatedContract, priceTiers);
      res.json(contract);
    } catch (error: any) {
      console.error("Error updating rental contract:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update rental contract" });
      }
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

  // 租金數據遷移
  app.post("/api/rental/migrate", async (req, res) => {
    try {
      const { importExistingRentalData } = await import("./rental-import");
      const result = await importExistingRentalData();
      res.json(result);
    } catch (error: any) {
      console.error("Error migrating rental data:", error);
      res.status(500).json({ message: "Failed to migrate rental data", error: String(error) });
    }
  });

  // 獲取租金相關的付款項目
  app.get("/api/rental/payment-items", async (req, res) => {
    try {
      const items = await storage.getRentalPaymentItems();
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching rental payment items:", error);
      res.status(500).json({ message: "Failed to fetch rental payment items" });
    }
  });

  // 別名路由 - 獲取租金付款項目
  app.get("/api/rental/payments", async (req, res) => {
    try {
      console.log("Fetching rental payments...");
      const items = await storage.getRentalPaymentItems();
      console.log("Rental payments found:", items.length);
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching rental payments:", error);
      res.status(500).json({ message: "Failed to fetch rental payments", error: error.message });
    }
  });

  // Contract Document Management routes
  app.get("/api/rental/contracts/:contractId/documents", async (req, res) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const documents = await storage.getContractDocuments(contractId);
      res.json(documents);
    } catch (error: any) {
      console.error("Error fetching contract documents:", error);
      res.status(500).json({ message: "Failed to fetch contract documents" });
    }
  });

  app.post("/api/rental/contracts/:contractId/documents", contractUpload.single('document'), async (req, res) => {
    try {
      const contractId = parseInt(req.params.contractId);
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Properly decode the filename from UTF-8
      let originalName = req.file.originalname;
      try {
        // If the filename is garbled, try to decode it properly
        if (originalName && originalName.includes('â') || originalName.includes('é')) {
          // This indicates UTF-8 encoding issues, try to fix it
          const buffer = Buffer.from(originalName, 'latin1');
          originalName = buffer.toString('utf8');
        }
      } catch (e) {
        // If decoding fails, keep the original name
        console.warn("Failed to decode filename:", originalName);
      }

      const documentData = {
        contractId,
        fileName: req.file.filename,
        originalName: originalName,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        version: req.body.versionLabel || "原始版本",
        notes: req.body.description || null
      };

      const validatedData = insertContractDocumentSchema.parse(documentData);
      const document = await storage.createContractDocument(validatedData);
      
      res.status(201).json(document);
    } catch (error: any) {
      console.error("Error uploading contract document:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to upload document" });
      }
    }
  });

  app.delete("/api/rental/contracts/:contractId/documents/:documentId", async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const document = await storage.getContractDocument(documentId);
      
      if (document) {
        // 刪除檔案系統中的文件
        if (fs.existsSync(document.filePath)) {
          fs.unlinkSync(document.filePath);
        }
        
        await storage.deleteContractDocument(documentId);
      }
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting contract document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  app.get("/api/rental/contracts/:contractId/documents/:documentId/download", async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const document = await storage.getContractDocument(documentId);
      
      if (!document || !fs.existsSync(document.filePath)) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const encodedFilename = encodeURIComponent(document.originalName);
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"; filename*=UTF-8''${encodedFilename}`);
      res.setHeader('Content-Type', document.mimeType);
      res.sendFile(path.resolve(document.filePath));
    } catch (error: any) {
      console.error("Error downloading contract document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  // Payment Information Management routes
  app.put("/api/rental/contracts/:id/payment-info", async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const paymentInfo = {
        payeeName: req.body.payeeName,
        payeeUnit: req.body.payeeUnit,
        bankCode: req.body.bankCode,
        accountNumber: req.body.accountNumber,
        contractPaymentDay: req.body.contractPaymentDay
      };
      
      const contract = await storage.updateContractPaymentInfo(contractId, paymentInfo);
      res.json(contract);
    } catch (error: any) {
      console.error("Error updating payment info:", error);
      res.status(500).json({ message: "Failed to update payment information" });
    }
  });

  // Installment Plans routes
  app.post("/api/installment/plans", async (req, res) => {
    try {
      const planData = insertInstallmentPlanSchema.parse(req.body);
      const plan = await storage.createInstallmentPlan(planData);
      res.status(201).json(plan);
    } catch (error: any) {
      console.error("Error creating installment plan:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create installment plan" });
      }
    }
  });

  app.post("/api/installment/plans/:id/generate-payments", async (req, res) => {
    try {
      const planId = parseInt(req.params.id);
      const result = await storage.generateInstallmentPayments(planId);
      res.json(result);
    } catch (error: any) {
      console.error("Error generating installment payments:", error);
      res.status(500).json({ message: "Failed to generate installment payments" });
    }
  });

  // Statistics routes for payment planning
  app.get("/api/payment/home/stats", async (req, res) => {
    try {
      const stats = await storage.getPaymentHomeStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch home payment stats" });
    }
  });

  // 專案詳細統計 - 用於首頁專案卡片
  app.get("/api/payment/projects/stats", async (req, res) => {
    try {
      const projectStats = await storage.getProjectsWithStats();
      res.json(projectStats);
    } catch (error) {
      console.error("Error fetching project stats:", error);
      res.status(500).json({ message: "Failed to fetch project stats" });
    }
  });

  app.get("/api/payment/project/stats", async (req, res) => {
    try {
      const stats = await storage.getPaymentProjectStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project payment stats" });
    }
  });

  // Reports routes for payment analysis
  app.get("/api/payment/reports/monthly-trend", async (req, res) => {
    try {
      const trend = await storage.getMonthlyPaymentTrend();
      res.json(trend);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch monthly trend" });
    }
  });

  app.get("/api/payment/reports/top-categories", async (req, res) => {
    try {
      const categories = await storage.getTopPaymentCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch top categories" });
    }
  });

  app.get("/api/payment/reports/payment-methods", async (req, res) => {
    try {
      const methods = await storage.getPaymentMethodsReport();
      res.json(methods);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment methods report" });
    }
  });

  // 月度付款分析 API
  app.get("/api/payment/monthly-analysis", async (req, res) => {
    try {
      const { year, month } = req.query;
      const currentDate = new Date();
      const targetYear = year ? parseInt(year as string) : currentDate.getFullYear();
      const targetMonth = month ? parseInt(month as string) : currentDate.getMonth() + 1;
      
      const analysis = await storage.getMonthlyPaymentAnalysis(targetYear, targetMonth);
      res.json(analysis);
    } catch (error) {
      console.error("Monthly payment analysis error:", error);
      res.status(500).json({ message: "Failed to fetch monthly payment analysis", error: error.message });
    }
  });

  // Enhanced Household Budget System API
  // Category-based budgets
  app.get("/api/household/budgets", async (req, res) => {
    try {
      const { year, month } = req.query;
      const targetMonth = year && month ? `${year}-${month.toString().padStart(2, '0')}` : new Date().toISOString().slice(0, 7);
      const budgets = await storage.getHouseholdBudgets(targetMonth);
      res.json(budgets);
    } catch (error: any) {
      console.error("Household budgets fetch error:", error);
      res.status(500).json({ message: "Failed to fetch household budgets", error: error.message });
    }
  });

  app.post("/api/household/budgets", async (req, res) => {
    try {
      const budgetData = insertHouseholdBudgetSchema.parse(req.body);
      const budget = await storage.createOrUpdateHouseholdBudget(budgetData);
      res.status(201).json(budget);
    } catch (error: any) {
      console.error("Budget creation error:", error);
      res.status(500).json({ message: "Failed to create household budget", error: error.message });
    }
  });

  // Enhanced expenses with filtering and pagination
  app.get("/api/household/expenses", async (req, res) => {
    try {
      const { year, month, categoryId, page = 1, limit = 10 } = req.query;
      const filters: any = {};
      
      if (year && month) {
        const targetMonth = `${year}-${month.toString().padStart(2, '0')}`;
        filters.month = targetMonth;
      }
      
      if (categoryId) {
        filters.categoryId = parseInt(categoryId as string);
      }

      const pageNum = parseInt(page as string);
      const pageSize = parseInt(limit as string);
      
      const result = await storage.getHouseholdExpenses(filters, pageNum, pageSize);
      res.json(result);
    } catch (error: any) {
      console.error("Household expenses fetch error:", error);
      res.status(500).json({ message: "Failed to fetch household expenses", error: error.message });
    }
  });

  // Image upload endpoint for household expenses
  app.post("/api/upload/images", receiptUpload.array('images', 5), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files)) {
        return res.status(400).json({ message: "No images uploaded" });
      }

      const imageUrls = req.files.map((file: any) => `/uploads/receipts/${file.filename}`);
      res.json({ imageUrls });
    } catch (error: any) {
      console.error("Image upload error:", error);
      res.status(500).json({ message: "Failed to upload images", error: error.message });
    }
  });

  app.post("/api/household/expenses", async (req, res) => {
    try {
      const expenseData = insertHouseholdExpenseSchema.parse(req.body);
      const expense = await storage.createHouseholdExpense(expenseData);
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create household expense" });
      }
    }
  });

  app.get("/api/household/stats", async (req, res) => {
    try {
      const stats = await storage.getHouseholdStats();
      res.json(stats);
    } catch (error) {
      console.error("Household stats error:", error);
      res.status(500).json({ message: "Failed to fetch household stats", error: error.message });
    }
  });

  // Monthly Payment Analysis endpoint
  app.get("/api/payment/analysis/:year/:month", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: "Invalid year or month" });
      }
      
      const analysis = await storage.getMonthlyPaymentAnalysis(year, month);
      res.json(analysis);
    } catch (error) {
      console.error("Monthly payment analysis error:", error);
      res.status(500).json({ message: "Failed to fetch monthly payment analysis", error: error.message });
    }
  });

  // Subcategory Payment Management Routes
  app.get("/api/subcategory/status/:parentCategoryId", async (req, res) => {
    try {
      const parentCategoryId = parseInt(req.params.parentCategoryId);
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      
      const status = await storage.getSubcategoryStatus(parentCategoryId, projectId);
      res.json(status);
    } catch (error) {
      console.error("Error fetching subcategory status:", error);
      res.status(500).json({ message: "Failed to fetch subcategory status" });
    }
  });

  app.get("/api/subcategory/payment-priority/:subcategoryId", async (req, res) => {
    try {
      const subcategoryId = parseInt(req.params.subcategoryId);
      const items = await storage.getSubcategoryPaymentPriority(subcategoryId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching payment priority:", error);
      res.status(500).json({ message: "Failed to fetch payment priority" });
    }
  });

  app.post("/api/subcategory/process-payment", async (req, res) => {
    try {
      const { subcategoryId, amount, paymentDate, userInfo } = req.body;
      
      if (!subcategoryId || !amount || !paymentDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const result = await storage.processSubcategoryPayment(
        subcategoryId, 
        amount, 
        paymentDate, 
        userInfo || "系統管理員"
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error processing subcategory payment:", error);
      res.status(500).json({ message: "Failed to process payment" });
    }
  });

  // 統一付款管理路由
  app.get("/api/unified-payment/data", async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      
      if (!projectId && !categoryId) {
        return res.status(400).json({ message: "請至少選擇一個專案或分類" });
      }
      
      const data = await storage.getUnifiedPaymentData(projectId, categoryId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching unified payment data:", error);
      res.status(500).json({ message: "Failed to fetch unified payment data" });
    }
  });

  app.post("/api/unified-payment/execute", async (req, res) => {
    try {
      const { projectId, categoryId, amount, notes } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "請輸入有效的付款金額" });
      }
      
      if (!projectId && !categoryId) {
        return res.status(400).json({ message: "請至少選擇一個專案或分類" });
      }
      
      const result = await storage.executeUnifiedPayment(
        amount,
        projectId,
        categoryId,
        notes,
        "統一付款系統"
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error executing unified payment:", error);
      res.status(500).json({ message: "Failed to execute unified payment" });
    }
  });

  // Fixed Categories API Routes - 固定分類管理
  
  // 獲取所有固定分類
  app.get("/api/fixed-categories", async (req, res) => {
    try {
      const categories = await storage.getFixedCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching fixed categories:", error);
      res.status(500).json({ message: "Failed to fetch fixed categories", error: error.message });
    }
  });

  // 獲取指定專案的固定分類子選項
  // 根據分類ID和可選專案ID查詢固定分類子選項
  app.get("/api/fixed-categories/sub-options", async (req, res) => {
    try {
      const categoryId = parseInt(req.query.categoryId as string);
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      
      const subOptions = await storage.getFixedCategorySubOptions(projectId, categoryId);
      res.json(subOptions);
    } catch (error: any) {
      console.error("Error fetching fixed category sub options:", error);
      res.status(500).json({ message: "Failed to fetch fixed category sub options", error: error.message });
    }
  });

  // 根據專案ID查詢固定分類子選項
  app.get("/api/fixed-categories/sub-options/:projectId", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const fixedCategoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      
      const subOptions = await storage.getFixedCategorySubOptions(projectId, fixedCategoryId);
      res.json(subOptions);
    } catch (error: any) {
      console.error("Error fetching fixed category sub options:", error);
      res.status(500).json({ message: "Failed to fetch fixed category sub options", error: error.message });
    }
  });

  // 創建固定分類子選項
  app.post("/api/fixed-categories/sub-options", async (req, res) => {
    try {
      const subOption = await storage.createFixedCategorySubOption(req.body);
      res.status(201).json(subOption);
    } catch (error: any) {
      console.error("Error creating fixed category sub option:", error);
      res.status(500).json({ message: "Failed to create fixed category sub option", error: error.message });
    }
  });

  // 更新固定分類子選項
  app.patch("/api/fixed-categories/sub-options/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subOption = await storage.updateFixedCategorySubOption(id, req.body);
      res.json(subOption);
    } catch (error: any) {
      console.error("Error updating fixed category sub option:", error);
      res.status(500).json({ message: "Failed to update fixed category sub option", error: error.message });
    }
  });

  // 刪除固定分類子選項
  app.delete("/api/fixed-categories/sub-options/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFixedCategorySubOption(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting fixed category sub option:", error);
      res.status(500).json({ message: "Failed to delete fixed category sub option", error: error.message });
    }
  });

  // Document Management API Routes
  
  // 上傳合約文件
  app.post("/api/rental/documents", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "請選擇要上傳的文件" });
      }

      const { contractId, documentType, version, description } = req.body;
      
      if (!contractId) {
        return res.status(400).json({ message: "缺少合約ID" });
      }

      const document = await storage.createContractDocument({
        contractId: parseInt(contractId),
        fileName: req.file.originalname,
        originalName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        notes: description || '',
        version: version || 'v1.0',
        uploadedBy: '系統管理員'
      });

      res.json(document);
    } catch (error: any) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "文件上傳失敗", error: error.message });
    }
  });

  // 獲取合約文件列表
  app.get("/api/rental/documents/:contractId", async (req, res) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const documents = await storage.getContractDocuments(contractId);
      res.json(documents);
    } catch (error: any) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "獲取文件失敗", error: error.message });
    }
  });

  // 下載文件
  app.get("/api/rental/documents/:documentId/download", async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const document = await storage.getContractDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "文件未找到" });
      }

      res.download(document.filePath, document.fileName, (err) => {
        if (err) {
          console.error("Download error:", err);
          res.status(500).json({ message: "文件下載失敗" });
        }
      });
    } catch (error: any) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "文件下載失敗", error: error.message });
    }
  });

  // PDF預覽
  app.get("/api/rental/documents/:documentId/preview", async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const document = await storage.getContractDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "文件未找到" });
      }

      if (!document.mimeType?.includes('pdf')) {
        return res.status(400).json({ message: "此文件不支援預覽" });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
      res.sendFile(path.resolve(document.filePath));
    } catch (error: any) {
      console.error("Error previewing document:", error);
      res.status(500).json({ message: "文件預覽失敗", error: error.message });
    }
  });

  // 刪除文件
  app.delete("/api/rental/documents/:documentId", async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const document = await storage.getContractDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "文件未找到" });
      }

      // 刪除物理文件
      if (fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }

      // 刪除資料庫記錄
      await storage.deleteContractDocument(documentId);
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "文件刪除失敗", error: error.message });
    }
  });

  // 更新文件資訊
  app.put("/api/rental/documents/:documentId", async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const { documentType, version, description } = req.body;
      
      const document = await storage.updateContractDocument(documentId, {
        notes: description,
        version
      });

      res.json(document);
    } catch (error: any) {
      console.error("Error updating document:", error);
      res.status(500).json({ message: "文件更新失敗", error: error.message });
    }
  });

  // 付款分析與專案管理報表API
  
  // 月度趨勢分析
  app.get("/api/payment/reports/monthly-trend", async (req, res) => {
    try {
      const period = req.query.period as string || "6months";
      
      let monthsBack = 6;
      switch (period) {
        case "3months": monthsBack = 3; break;
        case "6months": monthsBack = 6; break;
        case "1year": monthsBack = 12; break;
        case "all": monthsBack = 24; break;
      }

      // 生成過去幾個月的數據
      const trendData = [];
      const now = new Date();
      
      for (let i = monthsBack - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = date.toISOString().slice(0, 7); // YYYY-MM format
        
        // 查詢該月份的付款記錄
        const monthlyRecords = await db.select({
          totalPaid: sql<number>`COALESCE(SUM(CAST(${paymentRecords.amount} AS DECIMAL)), 0)`,
          count: sql<number>`COUNT(*)`
        })
        .from(paymentRecords)
        .where(sql`DATE_TRUNC('month', ${paymentRecords.paymentDate}) = ${date.toISOString().slice(0, 10)}`);

        // 查詢該月份的計畫金額
        const monthlyPlanned = await db.select({
          totalPlanned: sql<number>`COALESCE(SUM(CAST(${paymentItems.totalAmount} AS DECIMAL)), 0)`
        })
        .from(paymentItems)
        .where(sql`DATE_TRUNC('month', ${paymentItems.startDate}) = ${date.toISOString().slice(0, 10)}`);

        trendData.push({
          month: `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月`,
          paid: Number(monthlyRecords[0]?.totalPaid || 0),
          planned: Number(monthlyPlanned[0]?.totalPlanned || 0),
          count: Number(monthlyRecords[0]?.count || 0)
        });
      }

      res.json(trendData);
    } catch (error: any) {
      console.error("Error fetching monthly trend:", error);
      res.status(500).json({ message: "獲取月度趨勢失敗", error: error.message });
    }
  });

  // 付款方式統計
  app.get("/api/payment/reports/payment-methods", async (req, res) => {
    try {
      const methodStats = await db.select({
        method: paymentRecords.paymentMethod,
        count: sql<number>`COUNT(*)`,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${paymentRecords.amount} AS DECIMAL)), 0)`
      })
      .from(paymentRecords)
      .groupBy(paymentRecords.paymentMethod)
      .orderBy(sql`COUNT(*) DESC`);

      const formattedStats = methodStats.map(stat => ({
        name: stat.method || "未指定",
        count: Number(stat.count),
        totalAmount: Number(stat.totalAmount)
      }));

      res.json(formattedStats);
    } catch (error: any) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ message: "獲取付款方式統計失敗", error: error.message });
    }
  });

  // 分類支出排行
  app.get("/api/payment/reports/top-categories", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      // 查詢固定分類統計
      const fixedCategoryStats = await db.select({
        categoryName: fixedCategories.categoryName,
        categoryType: sql<string>`'fixed'`,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${paymentRecords.amount} AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(*)`
      })
      .from(paymentRecords)
      .innerJoin(paymentItems, eq(paymentRecords.itemId, paymentItems.id))
      .innerJoin(fixedCategories, eq(paymentItems.fixedCategoryId, fixedCategories.id))
      .groupBy(fixedCategories.id, fixedCategories.categoryName);

      // 查詢專案分類統計
      const projectCategoryStats = await db.select({
        categoryName: projectCategories.categoryName,
        categoryType: sql<string>`'project'`,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${paymentRecords.amount} AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(*)`
      })
      .from(paymentRecords)
      .innerJoin(paymentItems, eq(paymentRecords.itemId, paymentItems.id))
      .innerJoin(projectCategories, eq(paymentItems.categoryId, projectCategories.id))
      .groupBy(projectCategories.id, projectCategories.categoryName);

      // 合併並排序
      const allCategories = [
        ...fixedCategoryStats.map(stat => ({
          categoryName: stat.categoryName,
          categoryType: stat.categoryType,
          totalAmount: Number(stat.totalAmount),
          count: Number(stat.count)
        })),
        ...projectCategoryStats.map(stat => ({
          categoryName: stat.categoryName,
          categoryType: stat.categoryType,
          totalAmount: Number(stat.totalAmount),
          count: Number(stat.count)
        }))
      ];

      const topCategories = allCategories
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, limit);

      res.json(topCategories);
    } catch (error: any) {
      console.error("Error fetching top categories:", error);
      res.status(500).json({ message: "獲取分類統計失敗", error: error.message });
    }
  });

  // 專案統計分析
  app.get("/api/payment/reports/project-analysis", async (req, res) => {
    try {
      const projectAnalysis = await db.select({
        projectId: projects.id,
        projectName: projects.projectName,
        totalPlanned: sql<number>`COALESCE(SUM(CAST(${paymentItems.plannedAmount} AS DECIMAL)), 0)`,
        totalPaid: sql<number>`COALESCE(SUM(CAST(${paymentRecords.amount} AS DECIMAL)), 0)`,
        itemCount: sql<number>`COUNT(DISTINCT ${paymentItems.id})`,
        paymentCount: sql<number>`COUNT(${paymentRecords.id})`
      })
      .from(projects)
      .leftJoin(paymentItems, eq(projects.id, paymentItems.projectId))
      .leftJoin(paymentRecords, eq(paymentItems.id, paymentRecords.itemId))
      .groupBy(projects.id, projects.projectName)
      .orderBy(sql`COALESCE(SUM(CAST(${paymentItems.plannedAmount} AS DECIMAL)), 0) DESC`);

      const formattedAnalysis = projectAnalysis.map(project => ({
        projectId: project.projectId,
        projectName: project.projectName,
        totalPlanned: Number(project.totalPlanned),
        totalPaid: Number(project.totalPaid),
        itemCount: Number(project.itemCount),
        paymentCount: Number(project.paymentCount),
        completionRate: project.totalPlanned > 0 ? 
          (Number(project.totalPaid) / Number(project.totalPlanned) * 100) : 0
      }));

      res.json(formattedAnalysis);
    } catch (error: any) {
      console.error("Error fetching project analysis:", error);
      res.status(500).json({ message: "獲取專案分析失敗", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}