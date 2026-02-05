import { pgTable, text, serial, integer, boolean, decimal, timestamp, date, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - Enhanced authentication with LINE support
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).unique(),
  password: varchar("password", { length: 255 }),
  email: varchar("email", { length: 100 }),
  fullName: varchar("full_name", { length: 100 }),
  role: varchar("role", { length: 20 }).default("user"), // 'admin', 'user1', 'user2'
  isActive: boolean("is_active").default(true),
  // Menu permissions - JSON object for flexible menu access control
  menuPermissions: jsonb("menu_permissions").default({}),
  lastLogin: timestamp("last_login"),
  // LINE Login fields
  lineUserId: varchar("line_user_id", { length: 100 }).unique(),
  lineDisplayName: varchar("line_display_name", { length: 100 }),
  linePictureUrl: varchar("line_picture_url", { length: 500 }),
  lineEmail: varchar("line_email", { length: 100 }),
  // Authentication metadata
  authProvider: varchar("auth_provider", { length: 20 }).default("local"), // 'local' or 'line'
  emailVerified: boolean("email_verified").default(false),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// LINE Configuration table - Dynamic LINE login settings
export const lineConfigs = pgTable("line_configs", {
  id: serial("id").primaryKey(),
  channelId: varchar("channel_id", { length: 255 }),
  channelSecret: varchar("channel_secret", { length: 255 }),
  callbackUrl: varchar("callback_url", { length: 500 }),
  isEnabled: boolean("is_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User types and permissions
// Notifications table - Real-time notification system
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'payment_due', 'payment_overdue', 'system', 'reminder'
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium"), // 'low', 'medium', 'high', 'critical'
  isRead: boolean("is_read").default(false),
  actionUrl: varchar("action_url", { length: 500 }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
  expiresAt: timestamp("expires_at"),
});

// Notification Settings table - User notification preferences
export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  emailEnabled: boolean("email_enabled").default(true),
  lineEnabled: boolean("line_enabled").default(false),
  browserEnabled: boolean("browser_enabled").default(true),
  paymentDueReminder: boolean("payment_due_reminder").default(true),
  paymentOverdueAlert: boolean("payment_overdue_alert").default(true),
  systemUpdates: boolean("system_updates").default(false),
  weeklyReport: boolean("weekly_report").default(true),
  dailyDigestTime: varchar("daily_digest_time", { length: 5 }).default("09:00"),
  weeklyReportDay: varchar("weekly_report_day", { length: 10 }).default("monday"),
  advanceWarningDays: integer("advance_warning_days").default(3),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = typeof notificationSettings.$inferInsert;

export const updateUserSchema = createInsertSchema(users).partial().omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Role-based menu permissions structure
export interface MenuPermissions {
  payment?: boolean;          // 付款管理
  loanInvestment?: boolean;   // 借貸投資
  household?: boolean;        // 家用記帳
  reports?: boolean;          // 分析報表
  system?: boolean;           // 系統管理
  templates?: boolean;        // 模板管理
  other?: boolean;           // 其他功能
}

// Default permission sets for different roles
export const DEFAULT_PERMISSIONS: Record<string, MenuPermissions> = {
  admin: {
    payment: true,
    loanInvestment: true,
    household: true,
    reports: true,
    system: true,
    templates: true,
    other: true,
  },
  user1: {
    payment: true,
    loanInvestment: true,
    household: true,
    reports: true,
    system: false,
    templates: false,
    other: true,
  },
  user2: {
    payment: false,
    loanInvestment: false,
    household: true,
    reports: false,
    system: false,
    templates: false,
    other: false,
  },
};

// Session storage for authentication
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
}, (table) => [
  index("IDX_session_expire").on(table.expire)
]);

// Categories - Unified classification system with template support
export const debtCategories = pgTable("debt_categories", {
  id: serial("id").primaryKey(),
  categoryName: varchar("category_name", { length: 255 }).notNull(),
  categoryType: varchar("category_type", { length: 20 }).notNull().default("project"), // project, household
  description: text("description"),
  isTemplate: boolean("is_template").default(false), // 是否為固定項目模板
  accountInfo: text("account_info"), // 帳號資訊（如電話號碼、電號等）
  templateNotes: text("template_notes"), // 模板說明
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment Projects - Core functionality for project management
export const paymentProjects = pgTable("payment_projects", {
  id: serial("id").primaryKey(),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  projectType: varchar("project_type", { length: 50 }).notNull().default("general"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Budget Plans - 專案預算規劃表（使用現有 budget_plans 表）
export const budgetPlans = pgTable("budget_plans", {
  id: serial("id").primaryKey(),
  planName: varchar("plan_name", { length: 255 }).notNull(),
  planType: varchar("plan_type", { length: 50 }).notNull().default("project"), // project, department, event
  projectId: integer("project_id").references(() => paymentProjects.id),
  budgetPeriod: varchar("budget_period", { length: 50 }).notNull().default("monthly"), // monthly, quarterly, yearly
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  totalBudget: decimal("total_budget", { precision: 12, scale: 2 }).notNull().default("0.00"),
  actualSpent: decimal("actual_spent", { precision: 12, scale: 2 }).default("0.00"),
  status: varchar("status", { length: 20 }).default("active"), // active, completed, over_budget, cancelled
  tags: jsonb("tags").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  projectIdIdx: index("budget_plans_project_id_idx").on(table.projectId),
  statusIdx: index("budget_plans_status_idx").on(table.status),
}));

// Budget Items - 預算項目表（預估費用）
export const budgetItems = pgTable("budget_items", {
  id: serial("id").primaryKey(),
  budgetPlanId: integer("budget_plan_id").notNull().references(() => budgetPlans.id),
  categoryId: integer("category_id").references(() => debtCategories.id),
  fixedCategoryId: integer("fixed_category_id").references(() => fixedCategories.id),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  description: text("description"),
  paymentType: varchar("payment_type", { length: 20 }).default("single"), // single, installment, monthly
  plannedAmount: decimal("planned_amount", { precision: 12, scale: 2 }).notNull(),
  actualAmount: decimal("actual_amount", { precision: 12, scale: 2 }),
  installmentCount: integer("installment_count"),
  installmentAmount: decimal("installment_amount", { precision: 12, scale: 2 }),
  monthlyAmount: decimal("monthly_amount", { precision: 12, scale: 2 }),
  monthCount: integer("month_count"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  priority: integer("priority").default(1),
  convertedToPayment: boolean("converted_to_payment").default(false),
  linkedPaymentItemId: integer("linked_payment_item_id").references(() => paymentItems.id),
  conversionDate: timestamp("conversion_date"),
  variance: decimal("variance", { precision: 12, scale: 2 }),
  variancePercentage: decimal("variance_percentage", { precision: 5, scale: 2 }),
  tags: jsonb("tags").default([]),
  notes: text("notes"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  budgetPlanIdIdx: index("budget_items_budget_plan_id_idx").on(table.budgetPlanId),
  paymentTypeIdx: index("budget_items_payment_type_idx").on(table.paymentType),
  convertedIdx: index("budget_items_converted_idx").on(table.convertedToPayment),
  linkedPaymentIdx: index("budget_items_linked_payment_idx").on(table.linkedPaymentItemId),
}));

// Project Category Templates - 專案特定分類模板（浯島文旅+電話費=088219194,948883776）
export const projectCategoryTemplates = pgTable("project_category_templates", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => paymentProjects.id),
  categoryId: integer("category_id").references(() => debtCategories.id),
  templateName: varchar("template_name", { length: 255 }).notNull(), // 088219194, 948883776, 電號09894790
  accountInfo: text("account_info"), // 額外的帳號資訊
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fixed Categories - 固定分類表（電話費、電費、水費等）
export const fixedCategories = pgTable("fixed_categories", {
  id: serial("id").primaryKey(),
  categoryName: varchar("category_name", { length: 100 }).notNull(),
  categoryType: varchar("category_type", { length: 50 }).notNull(), // phone, electricity, water, internet, other
  description: text("description"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Fixed Category Sub Options - 固定分類子選項表（電話號碼、電號、水號等）
export const fixedCategorySubOptions = pgTable("fixed_category_sub_options", {
  id: serial("id").primaryKey(),
  fixedCategoryId: integer("fixed_category_id").notNull().references(() => fixedCategories.id),
  projectId: integer("project_id").notNull().references(() => paymentProjects.id),
  subOptionName: varchar("sub_option_name", { length: 255 }).notNull(), // 電話號碼、電號、水號等具體值
  displayName: varchar("display_name", { length: 255 }), // 顯示名稱，如 "主線電話"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment Items - Core functionality for payment planning
export const paymentItems = pgTable("payment_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => debtCategories.id), // 自訂分類（可選）
  fixedCategoryId: integer("fixed_category_id").references(() => fixedCategories.id), // 固定分類（可選）
  fixedSubOptionId: integer("fixed_sub_option_id").references(() => fixedCategorySubOptions.id), // 固定子選項（可選）
  projectId: integer("project_id").references(() => paymentProjects.id),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  itemType: varchar("item_type", { length: 20 }).notNull().default("project"),
  paymentType: varchar("payment_type", { length: 20 }).notNull().default("single"),
  recurringInterval: integer("recurring_interval"),
  installmentCount: integer("installment_count"),
  installmentAmount: decimal("installment_amount", { precision: 10, scale: 2 }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0.00"),
  status: varchar("status", { length: 20 }).default("pending"),
  priority: integer("priority").default(1),
  notes: text("notes"),
  tags: text("tags"),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // 項目來源追蹤
  source: varchar("source", { length: 20 }).default("manual"), // 'manual' 手動新增, 'ai_scan' AI掃描歸檔
  sourceDocumentId: integer("source_document_id"), // 來源單據收件箱 ID
  documentUploadedAt: timestamp("document_uploaded_at"), // 原始單據上傳時間
  documentUploadedByUserId: integer("document_uploaded_by_user_id"), // 原始單據上傳者 ID
  documentUploadedByUsername: varchar("document_uploaded_by_username", { length: 255 }), // 原始單據上傳者名稱
  archivedByUserId: integer("archived_by_user_id"), // 歸檔操作者 ID
  archivedByUsername: varchar("archived_by_username", { length: 255 }), // 歸檔操作者名稱
  archivedAt: timestamp("archived_at"), // 歸檔時間
}, (table) => ({
  // 效能優化索引
  projectIdIdx: index("payment_items_project_id_idx").on(table.projectId),
  categoryIdIdx: index("payment_items_category_id_idx").on(table.categoryId),
  statusIdx: index("payment_items_status_idx").on(table.status),
  itemTypeIdx: index("payment_items_item_type_idx").on(table.itemType),
  startDateIdx: index("payment_items_start_date_idx").on(table.startDate),
  isDeletedIdx: index("payment_items_is_deleted_idx").on(table.isDeleted),
  sourceIdx: index("payment_items_source_idx").on(table.source),
  // 複合索引用於常見查詢
  statusNotDeletedIdx: index("payment_items_status_not_deleted_idx").on(table.status, table.isDeleted),
  projectStatusIdx: index("payment_items_project_status_idx").on(table.projectId, table.status),
  dateRangeIdx: index("payment_items_date_range_idx").on(table.startDate, table.endDate),
}));

// Payment Records - Core functionality for payment tracking
export const paymentRecords = pgTable("payment_records", {
  id: serial("id").primaryKey(),
  itemId: integer("payment_item_id").notNull().references(() => paymentItems.id),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  receiptImageUrl: varchar("receipt_image_url", { length: 500 }),
  receiptText: text("receipt_text"),
  isPartialPayment: boolean("is_partial_payment").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // 效能優化索引
  itemIdIdx: index("payment_records_item_id_idx").on(table.itemId),
  paymentDateIdx: index("payment_records_payment_date_idx").on(table.paymentDate),
  paymentMethodIdx: index("payment_records_payment_method_idx").on(table.paymentMethod),
  // 複合索引用於常見查詢
  itemDateIdx: index("payment_records_item_date_idx").on(table.itemId, table.paymentDate),
}));

// Payment Schedules - 給付款項時間計劃表
export const paymentSchedules = pgTable("payment_schedules", {
  id: serial("id").primaryKey(),
  paymentItemId: integer("payment_item_id").notNull().references(() => paymentItems.id),
  scheduledDate: date("scheduled_date").notNull(), // 預計給付日期
  originalDueDate: date("original_due_date"), // 原始到期日
  rescheduleCount: integer("reschedule_count").default(0), // 重新安排次數
  isOverdue: boolean("is_overdue").default(false), // 是否逾期
  overdueDays: integer("overdue_days").default(0), // 逾期天數
  scheduledAmount: decimal("scheduled_amount", { precision: 10, scale: 2 }).notNull(), // 預計給付金額
  status: varchar("status", { length: 20 }).default("scheduled"), // scheduled, completed, overdue, rescheduled
  notes: text("notes"), // 排程備註
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // 效能優化索引
  paymentItemIdIdx: index("payment_schedules_payment_item_id_idx").on(table.paymentItemId),
  scheduledDateIdx: index("payment_schedules_scheduled_date_idx").on(table.scheduledDate),
  statusIdx: index("payment_schedules_status_idx").on(table.status),
  isOverdueIdx: index("payment_schedules_is_overdue_idx").on(table.isOverdue),
  // 複合索引用於常見查詢
  dateStatusIdx: index("payment_schedules_date_status_idx").on(table.scheduledDate, table.status),
  overdueCountIdx: index("payment_schedules_overdue_count_idx").on(table.isOverdue, table.overdueDays),
}));

// Rental Contracts - 租約管理表
export const rentalContracts = pgTable("rental_contracts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => paymentProjects.id),
  contractName: varchar("contract_name", { length: 255 }).notNull(),
  // 承租人資訊
  tenantName: varchar("tenant_name", { length: 255 }),
  tenantPhone: varchar("tenant_phone", { length: 50 }),
  tenantAddress: text("tenant_address"),
  // 租約期間
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  totalYears: integer("total_years").notNull(),
  totalMonths: integer("total_months").notNull(), // 總月數，支援更精確的期間
  baseAmount: decimal("base_amount", { precision: 10, scale: 2 }).notNull(),
  // 匯款資訊
  payeeName: varchar("payee_name", { length: 255 }),
  payeeUnit: varchar("payee_unit", { length: 255 }),
  bankCode: varchar("bank_code", { length: 10 }),
  accountNumber: varchar("account_number", { length: 50 }),
  // 合約付款日
  contractPaymentDay: integer("contract_payment_day").default(1), // 每月幾號付款
  // 緩衝期設定
  hasBufferPeriod: boolean("has_buffer_period").default(false), // 是否有緩衝期
  bufferMonths: integer("buffer_months").default(0), // 緩衝期月數
  bufferIncludedInTerm: boolean("buffer_included_in_term").default(true), // 緩衝期是否包含在租期內
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contract Documents - 合約文件上傳管理表
export const contractDocuments = pgTable("contract_documents", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => rentalContracts.id),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  version: varchar("version", { length: 50 }).notNull().default("原始"),
  isLatest: boolean("is_latest").default(false),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  uploadedBy: varchar("uploaded_by", { length: 255 }),
  notes: text("notes"),
});

// Rental Price Tiers - 租金階段價格表
export const rentalPriceTiers = pgTable("rental_price_tiers", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => rentalContracts.id),
  yearStart: integer("year_start").notNull(),
  yearEnd: integer("year_end").notNull(),
  monthlyAmount: decimal("monthly_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Installment Plans - 分期付款計劃表
export const installmentPlans = pgTable("installment_plans", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => paymentItems.id),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  installmentCount: integer("installment_count").notNull(),
  monthlyAmount: decimal("monthly_amount", { precision: 10, scale: 2 }).notNull(),
  startDate: date("start_date").notNull(),
  startType: varchar("start_type", { length: 20 }).notNull().default("current_month"), // current_month, next_month
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment Item Notes - 項目備註記錄表
export const paymentItemNotes = pgTable("payment_item_notes", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => paymentItems.id),
  userId: integer("user_id").references(() => users.id),
  userInfo: varchar("user_info", { length: 255 }), // 備用欄位：用戶資訊
  noteText: text("note_text").notNull(),
  attachmentUrl: varchar("attachment_url", { length: 500 }), // 附件檔案路徑
  attachmentName: varchar("attachment_name", { length: 255 }), // 原始檔案名稱
  attachmentSize: integer("attachment_size"), // 檔案大小（bytes）
  attachmentType: varchar("attachment_type", { length: 100 }), // MIME類型
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audit Log - Track all changes to payment items
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tableName: varchar("table_name", { length: 50 }).notNull(),
  recordId: integer("record_id").notNull(),
  action: varchar("action", { length: 20 }).notNull(), // INSERT, UPDATE, DELETE, RESTORE
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  changedFields: text("changed_fields").array(),
  userId: integer("user_id"), // For future user authentication
  userInfo: varchar("user_info", { length: 255 }), // Temporary field for user identification
  changeReason: text("change_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const fixedCategoriesRelations = relations(fixedCategories, ({ many }) => ({
  subOptions: many(fixedCategorySubOptions),
  paymentItems: many(paymentItems),
}));

export const fixedCategorySubOptionsRelations = relations(fixedCategorySubOptions, ({ one, many }) => ({
  fixedCategory: one(fixedCategories, {
    fields: [fixedCategorySubOptions.fixedCategoryId],
    references: [fixedCategories.id],
  }),
  project: one(paymentProjects, {
    fields: [fixedCategorySubOptions.projectId],
    references: [paymentProjects.id],
  }),
  paymentItems: many(paymentItems),
}));

export const paymentItemsRelations = relations(paymentItems, ({ one, many }) => ({
  category: one(debtCategories, {
    fields: [paymentItems.categoryId],
    references: [debtCategories.id],
  }),
  fixedCategory: one(fixedCategories, {
    fields: [paymentItems.fixedCategoryId],
    references: [fixedCategories.id],
  }),
  fixedSubOption: one(fixedCategorySubOptions, {
    fields: [paymentItems.fixedSubOptionId],
    references: [fixedCategorySubOptions.id],
  }),
  project: one(paymentProjects, {
    fields: [paymentItems.projectId],
    references: [paymentProjects.id],
  }),
  records: many(paymentRecords),
  notes: many(paymentItemNotes),
  installmentPlan: one(installmentPlans),
}));

export const paymentRecordsRelations = relations(paymentRecords, ({ one }) => ({
  item: one(paymentItems, {
    fields: [paymentRecords.itemId],
    references: [paymentItems.id],
  }),
}));

export const paymentProjectsRelations = relations(paymentProjects, ({ many }) => ({
  items: many(paymentItems),
  rentalContracts: many(rentalContracts),
}));

export const rentalContractsRelations = relations(rentalContracts, ({ one, many }) => ({
  project: one(paymentProjects, {
    fields: [rentalContracts.projectId],
    references: [paymentProjects.id],
  }),
  priceTiers: many(rentalPriceTiers),
  documents: many(contractDocuments),
}));

export const contractDocumentsRelations = relations(contractDocuments, ({ one }) => ({
  contract: one(rentalContracts, {
    fields: [contractDocuments.contractId],
    references: [rentalContracts.id],
  }),
}));

export const rentalPriceTiersRelations = relations(rentalPriceTiers, ({ one }) => ({
  contract: one(rentalContracts, {
    fields: [rentalPriceTiers.contractId],
    references: [rentalContracts.id],
  }),
}));

export const installmentPlansRelations = relations(installmentPlans, ({ one }) => ({
  item: one(paymentItems, {
    fields: [installmentPlans.itemId],
    references: [paymentItems.id],
  }),
}));

export const paymentItemNotesRelations = relations(paymentItemNotes, ({ one }) => ({
  item: one(paymentItems, {
    fields: [paymentItemNotes.itemId],
    references: [paymentItems.id],
  }),
  user: one(users, {
    fields: [paymentItemNotes.userId],
    references: [users.id],
  }),
}));

// 簡化的家用記帳系統 - 支援年月預算管理
export const householdBudgets = pgTable("household_budgets", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull(),
  year: integer("year").notNull(), // 預算年份
  month: integer("month").notNull(), // 預算月份 (1-12)
  budgetAmount: decimal("budget_amount", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").default(true), // 是否啟用此預算
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const householdExpenses = pgTable("household_expenses", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  tags: jsonb("tags"),
  paymentMethod: varchar("payment_method", { length: 50 }),
  description: varchar("description", { length: 255 }),
  receiptImages: jsonb("receipt_images"), // Array of image URLs
  receiptText: text("receipt_text"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});



// Schema definitions
export const insertDebtCategorySchema = createInsertSchema(debtCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentProjectSchema = createInsertSchema(paymentProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentItemSchema = createInsertSchema(paymentItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  totalAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  paidAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export const insertPaymentRecordSchema = createInsertSchema(paymentRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRentalContractSchema = createInsertSchema(rentalContracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  baseAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()),
});

export const insertRentalPriceTierSchema = createInsertSchema(rentalPriceTiers).omit({
  id: true,
  createdAt: true,
}).extend({
  monthlyAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()),
});

export const insertContractDocumentSchema = createInsertSchema(contractDocuments).omit({
  id: true,
  uploadedAt: true,
});

export const insertInstallmentPlanSchema = createInsertSchema(installmentPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHouseholdBudgetSchema = createInsertSchema(householdBudgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHouseholdExpenseSchema = createInsertSchema(householdExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertFixedCategorySchema = createInsertSchema(fixedCategories).omit({
  id: true,
  createdAt: true,
});

export const insertFixedCategorySubOptionSchema = createInsertSchema(fixedCategorySubOptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentItemNoteSchema = createInsertSchema(paymentItemNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentScheduleSchema = createInsertSchema(paymentSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  scheduledAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()),
});

// Types
export type User = typeof users.$inferSelect;
export type DebtCategory = typeof debtCategories.$inferSelect;
export type InsertDebtCategory = z.infer<typeof insertDebtCategorySchema>;
export type PaymentProject = typeof paymentProjects.$inferSelect;
export type InsertPaymentProject = z.infer<typeof insertPaymentProjectSchema>;
export type PaymentItem = typeof paymentItems.$inferSelect;
export type InsertPaymentItem = z.infer<typeof insertPaymentItemSchema>;
export type PaymentRecord = typeof paymentRecords.$inferSelect;
export type InsertPaymentRecord = z.infer<typeof insertPaymentRecordSchema>;
export type RentalContract = typeof rentalContracts.$inferSelect;
export type InsertRentalContract = z.infer<typeof insertRentalContractSchema>;
export type RentalPriceTier = typeof rentalPriceTiers.$inferSelect;
export type InsertRentalPriceTier = z.infer<typeof insertRentalPriceTierSchema>;
export type ContractDocument = typeof contractDocuments.$inferSelect;
export type InsertContractDocument = z.infer<typeof insertContractDocumentSchema>;
export type InstallmentPlan = typeof installmentPlans.$inferSelect;
export type InsertInstallmentPlan = z.infer<typeof insertInstallmentPlanSchema>;
export type HouseholdBudget = typeof householdBudgets.$inferSelect;
export type InsertHouseholdBudget = z.infer<typeof insertHouseholdBudgetSchema>;
export type HouseholdExpense = typeof householdExpenses.$inferSelect;
export type InsertHouseholdExpense = z.infer<typeof insertHouseholdExpenseSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type FixedCategory = typeof fixedCategories.$inferSelect;
export type InsertFixedCategory = z.infer<typeof insertFixedCategorySchema>;
export type FixedCategorySubOption = typeof fixedCategorySubOptions.$inferSelect;
export type InsertFixedCategorySubOption = z.infer<typeof insertFixedCategorySubOptionSchema>;
export type PaymentItemNote = typeof paymentItemNotes.$inferSelect;
export type InsertPaymentItemNote = z.infer<typeof insertPaymentItemNoteSchema>;
export type PaymentSchedule = typeof paymentSchedules.$inferSelect;
export type InsertPaymentSchedule = z.infer<typeof insertPaymentScheduleSchema>;

// File Attachments - 檔案附件模組
export const fileAttachments = pgTable("file_attachments", {
  id: serial("id").primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(), // 'document', 'image', 'contract'
  entityType: varchar("entity_type", { length: 50 }).notNull(), // 'loan_investment', 'rental', 'payment'
  entityId: integer("entity_id").notNull(),
  uploadedBy: varchar("uploaded_by", { length: 100 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loan and Investment Records - 借貸資金紀錄模組
export const loanInvestmentRecords = pgTable("loan_investment_records", {
  id: serial("id").primaryKey(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  recordType: varchar("record_type", { length: 20 }).notNull(), // loan, investment
  
  // 基本資料：借方/資方資料
  partyName: varchar("party_name", { length: 255 }).notNull(),
  partyPhone: varchar("party_phone", { length: 50 }),
  partyRelationship: varchar("party_relationship", { length: 100 }),
  partyNotes: text("party_notes"), // 關於對方的備註
  
  // 金額和利息 - 所有計算都用年息
  principalAmount: decimal("principal_amount", { precision: 15, scale: 2 }).notNull(),
  annualInterestRate: decimal("annual_interest_rate", { precision: 5, scale: 2 }).notNull(), // 年息%
  
  // 時間安排
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  
  // 借貸特有欄位
  interestPaymentMethod: varchar("interest_payment_method", { length: 20 }), // yearly, monthly, agreed_date
  monthlyPaymentAmount: decimal("monthly_payment_amount", { precision: 15, scale: 2 }),
  agreedPaymentDay: integer("agreed_payment_day"), // 約定給付日期（每月幾號）
  annualPaymentDate: date("annual_payment_date"), // 一年付款一次的日期
  
  // 投資特有欄位
  fixedReturnRate: decimal("fixed_return_rate", { precision: 5, scale: 2 }), // 固定回饋%
  otherReturnPlan: text("other_return_plan"), // 其他方案文字描述
  hasAgreedReturn: boolean("has_agreed_return").default(false), // 約定返還：有
  returnMethod: varchar("return_method", { length: 20 }), // lump_sum（一次還款）, installment（分期給付）
  installmentCount: integer("installment_count"), // 分期數
  installmentAmount: decimal("installment_amount", { precision: 15, scale: 2 }), // 每期金額
  
  // 狀態和資金追蹤
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, completed, cancelled
  totalPaidAmount: decimal("total_paid_amount", { precision: 15, scale: 2 }).default("0"),
  isHighRisk: boolean("is_high_risk").default(false), // 15%以上利息標記
  
  // 合約和文件
  contractFileUrl: varchar("contract_file_url", { length: 500 }),
  documentNotes: text("document_notes"), // 文件相關備註
  
  // 備註
  notes: text("notes"), // 此資金狀況紀錄
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment Schedule - 付款計劃表
export const loanPaymentSchedule = pgTable("loan_payment_schedule", {
  id: serial("id").primaryKey(),
  recordId: integer("record_id").notNull().references(() => loanInvestmentRecords.id),
  scheduleType: varchar("schedule_type", { length: 20 }).notNull(), // interest, principal, installment
  dueDate: date("due_date").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false),
  paidDate: date("paid_date"),
  paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment History - 付款紀錄表 (強化版)
export const loanPaymentHistory = pgTable("loan_payment_history", {
  id: serial("id").primaryKey(),
  recordId: integer("record_id").notNull().references(() => loanInvestmentRecords.id),
  scheduleId: integer("schedule_id").references(() => loanPaymentSchedule.id),
  
  // 付款基本資訊
  paymentType: varchar("payment_type", { length: 20 }).notNull(), // interest, principal, full_repayment, partial_payment
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  
  // 付款方式和狀態
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // cash, bank_transfer, check, mobile_payment
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("completed"), // completed, pending, failed, cancelled
  isEarlyPayment: boolean("is_early_payment").default(false),
  isLatePayment: boolean("is_late_payment").default(false),
  
  // 文件和證明
  receiptFileUrl: varchar("receipt_file_url", { length: 500 }),
  hasReceipt: boolean("has_receipt").default(false),
  receiptNotes: text("receipt_notes"), // 收據/截圖相關說明
  
  // 詳細備註和記錄
  notes: text("notes"), // 一般備註
  communicationNotes: text("communication_notes"), // 與借款人溝通記錄
  riskNotes: text("risk_notes"), // 風險評估備註
  
  // 餘額計算
  remainingPrincipal: decimal("remaining_principal", { precision: 15, scale: 2 }),
  remainingInterest: decimal("remaining_interest", { precision: 15, scale: 2 }),
  
  // 系統記錄
  recordedBy: varchar("recorded_by", { length: 100 }), // 記錄人員
  verifiedBy: varchar("verified_by", { length: 100 }), // 驗證人員
  isVerified: boolean("is_verified").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const loanInvestmentRelations = relations(loanInvestmentRecords, ({ many }) => ({
  paymentSchedule: many(loanPaymentSchedule),
  paymentHistory: many(loanPaymentHistory),
  attachments: many(fileAttachments),
}));

export const fileAttachmentsRelations = relations(fileAttachments, ({ one }) => ({
  loanRecord: one(loanInvestmentRecords, {
    fields: [fileAttachments.entityId],
    references: [loanInvestmentRecords.id],
  }),
}));

export const loanPaymentScheduleRelations = relations(loanPaymentSchedule, ({ one, many }) => ({
  record: one(loanInvestmentRecords, {
    fields: [loanPaymentSchedule.recordId],
    references: [loanInvestmentRecords.id],
  }),
  payments: many(loanPaymentHistory),
}));

export const loanPaymentHistoryRelations = relations(loanPaymentHistory, ({ one }) => ({
  record: one(loanInvestmentRecords, {
    fields: [loanPaymentHistory.recordId],
    references: [loanInvestmentRecords.id],
  }),
  schedule: one(loanPaymentSchedule, {
    fields: [loanPaymentHistory.scheduleId],
    references: [loanPaymentSchedule.id],
  }),
}));

// Insert schemas
export const insertLoanInvestmentRecordSchema = createInsertSchema(loanInvestmentRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  principalAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  annualInterestRate: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  monthlyPaymentAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  fixedReturnRate: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  installmentAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  totalPaidAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  agreedPaymentDay: z.union([z.string(), z.number()]).transform((val) => parseInt(val.toString())).optional(),
  installmentCount: z.union([z.string(), z.number()]).transform((val) => parseInt(val.toString())).optional(),
});

export const insertLoanPaymentScheduleSchema = createInsertSchema(loanPaymentSchedule).omit({
  id: true,
  createdAt: true,
});

export const insertLoanPaymentHistorySchema = createInsertSchema(loanPaymentHistory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  amount: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  remainingPrincipal: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  remainingInterest: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
});

export const insertLineConfigSchema = createInsertSchema(lineConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFileAttachmentSchema = createInsertSchema(fileAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type LoanInvestmentRecord = typeof loanInvestmentRecords.$inferSelect;
export type InsertLoanInvestmentRecord = z.infer<typeof insertLoanInvestmentRecordSchema>;
export type LoanPaymentSchedule = typeof loanPaymentSchedule.$inferSelect;
export type InsertLoanPaymentSchedule = z.infer<typeof insertLoanPaymentScheduleSchema>;
export type LoanPaymentHistory = typeof loanPaymentHistory.$inferSelect;
export type InsertLoanPaymentHistory = z.infer<typeof insertLoanPaymentHistorySchema>;
export type FileAttachment = typeof fileAttachments.$inferSelect;
export type InsertFileAttachment = z.infer<typeof insertFileAttachmentSchema>;

// Project Category Templates Types
export const insertProjectCategoryTemplateSchema = createInsertSchema(projectCategoryTemplates);
export type ProjectCategoryTemplate = typeof projectCategoryTemplates.$inferSelect;
export type InsertProjectCategoryTemplate = z.infer<typeof insertProjectCategoryTemplateSchema>;

// User authentication types
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  password: z.string().min(8, "密碼至少需要8個字符").optional(),
  email: z.string().email("無效的電子郵件地址").optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1, "請輸入用戶名"),
  password: z.string().min(1, "請輸入密碼"),
});

export type LoginData = z.infer<typeof loginSchema>;

// Budget Plans Types and Schemas
export const insertBudgetPlanSchema = createInsertSchema(budgetPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  totalBudget: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  actualSpent: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
});

export const insertBudgetItemSchema = createInsertSchema(budgetItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  plannedAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  actualAmount: z.union([z.string(), z.number(), z.null()]).transform((val) => val !== null ? val.toString() : null).optional().nullable(),
  installmentAmount: z.union([z.string(), z.number(), z.null()]).transform((val) => val !== null ? val.toString() : null).optional().nullable(),
  monthlyAmount: z.union([z.string(), z.number(), z.null()]).transform((val) => val !== null ? val.toString() : null).optional().nullable(),
  variance: z.union([z.string(), z.number(), z.null()]).transform((val) => val !== null ? val.toString() : null).optional().nullable(),
  variancePercentage: z.union([z.string(), z.number(), z.null()]).transform((val) => val !== null ? val.toString() : null).optional().nullable(),
});

export type BudgetPlan = typeof budgetPlans.$inferSelect;
export type InsertBudgetPlan = z.infer<typeof insertBudgetPlanSchema>;
export type BudgetItem = typeof budgetItems.$inferSelect;
export type InsertBudgetItem = z.infer<typeof insertBudgetItemSchema>;

// Document Inbox - 單據收件箱 for quick capture and AI recognition
export const documentInbox = pgTable("document_inbox", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  documentType: varchar("document_type", { length: 20 }).notNull(), // 'bill', 'payment', 'invoice'
  status: varchar("status", { length: 20 }).default("pending"), // 'pending', 'processing', 'recognized', 'archived', 'failed'
  imagePath: varchar("image_path", { length: 500 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }),
  
  // AI Recognition Results
  aiRecognized: boolean("ai_recognized").default(false),
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }),
  aiExtractedData: jsonb("ai_extracted_data").default({}), // Stores recognized fields
  aiRawResponse: text("ai_raw_response"),
  
  // Recognized fields (parsed from AI)
  recognizedVendor: varchar("recognized_vendor", { length: 200 }),
  recognizedAmount: decimal("recognized_amount", { precision: 15, scale: 2 }),
  recognizedDate: date("recognized_date"),
  recognizedDescription: text("recognized_description"),
  recognizedCategory: varchar("recognized_category", { length: 100 }),
  recognizedInvoiceNumber: varchar("recognized_invoice_number", { length: 100 }),
  
  // User corrections/confirmations
  userConfirmed: boolean("user_confirmed").default(false),
  confirmedVendor: varchar("confirmed_vendor", { length: 200 }),
  confirmedAmount: decimal("confirmed_amount", { precision: 15, scale: 2 }),
  confirmedDate: date("confirmed_date"),
  confirmedDescription: text("confirmed_description"),
  confirmedCategory: varchar("confirmed_category", { length: 100 }),
  
  // Archive reference (links to created records)
  archivedToType: varchar("archived_to_type", { length: 20 }), // 'payment_item', 'payment_record', 'invoice_record'
  archivedToId: integer("archived_to_id"),
  archivedAt: timestamp("archived_at"),
  archivedByUserId: integer("archived_by_user_id").references(() => users.id),
  archivedByUsername: varchar("archived_by_username", { length: 100 }),
  
  // Upload tracking
  uploadedByUsername: varchar("uploaded_by_username", { length: 100 }),
  
  // Edit tracking
  editedByUserId: integer("edited_by_user_id").references(() => users.id),
  editedByUsername: varchar("edited_by_username", { length: 100 }),
  editedAt: timestamp("edited_at"),
  
  // Metadata
  notes: text("notes"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("document_inbox_user_idx").on(table.userId),
  index("document_inbox_status_idx").on(table.status),
  index("document_inbox_type_idx").on(table.documentType),
]);

// Invoice Records - 發票記錄 for tax purposes
export const invoiceRecords = pgTable("invoice_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  
  // Invoice details
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  invoiceDate: date("invoice_date").notNull(),
  vendorName: varchar("vendor_name", { length: 200 }),
  vendorTaxId: varchar("vendor_tax_id", { length: 20 }),
  buyerName: varchar("buyer_name", { length: 200 }),
  buyerTaxId: varchar("buyer_tax_id", { length: 20 }),
  
  // Amounts
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  
  // Category and description
  category: varchar("category", { length: 100 }),
  description: text("description"),
  
  // Invoice type
  invoiceType: varchar("invoice_type", { length: 20 }).default("expense"), // 'expense', 'income'
  
  // Links to payment records
  paymentItemId: integer("payment_item_id").references(() => paymentItems.id),
  paymentRecordId: integer("payment_record_id").references(() => paymentRecords.id),
  
  // Document reference
  documentInboxId: integer("document_inbox_id").references(() => documentInbox.id),
  imagePath: varchar("image_path", { length: 500 }),
  
  // Tax period for reporting
  taxYear: integer("tax_year"),
  taxMonth: integer("tax_month"),
  
  // Status
  status: varchar("status", { length: 20 }).default("active"), // 'active', 'voided', 'reported'
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("invoice_records_user_idx").on(table.userId),
  index("invoice_records_date_idx").on(table.invoiceDate),
  index("invoice_records_vendor_idx").on(table.vendorName),
  index("invoice_records_tax_period_idx").on(table.taxYear, table.taxMonth),
]);

// Document Inbox schemas and types
export const insertDocumentInboxSchema = createInsertSchema(documentInbox).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  recognizedAmount: z.union([z.string(), z.number(), z.null()]).transform((val) => val !== null ? val.toString() : null).optional().nullable(),
  confirmedAmount: z.union([z.string(), z.number(), z.null()]).transform((val) => val !== null ? val.toString() : null).optional().nullable(),
  aiConfidence: z.union([z.string(), z.number(), z.null()]).transform((val) => val !== null ? val.toString() : null).optional().nullable(),
});

export const insertInvoiceRecordSchema = createInsertSchema(invoiceRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  subtotal: z.union([z.string(), z.number(), z.null()]).transform((val) => val !== null ? val.toString() : null).optional().nullable(),
  taxAmount: z.union([z.string(), z.number(), z.null()]).transform((val) => val !== null ? val.toString() : null).optional().nullable(),
  totalAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()),
});

export type DocumentInbox = typeof documentInbox.$inferSelect;
export type InsertDocumentInbox = z.infer<typeof insertDocumentInboxSchema>;
export type InvoiceRecord = typeof invoiceRecords.$inferSelect;
export type InsertInvoiceRecord = z.infer<typeof insertInvoiceRecordSchema>;

// ============================================================
// 人事費管理模組
// ============================================================

// 員工資料表
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeName: varchar("employee_name", { length: 100 }).notNull(),
  position: varchar("position", { length: 100 }),
  monthlySalary: decimal("monthly_salary", { precision: 10, scale: 2 }).notNull(),
  insuredSalary: decimal("insured_salary", { precision: 10, scale: 2 }),
  hireDate: date("hire_date").notNull(),
  terminationDate: date("termination_date"),
  dependentsCount: integer("dependents_count").default(0),
  voluntaryPensionRate: decimal("voluntary_pension_rate", { precision: 3, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 月度人事費彙總表
export const monthlyHrCosts = pgTable("monthly_hr_costs", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  baseSalary: decimal("base_salary", { precision: 10, scale: 2 }),
  insuredSalary: decimal("insured_salary", { precision: 10, scale: 2 }),
  // 雇主負擔
  employerLaborInsurance: decimal("employer_labor_insurance", { precision: 10, scale: 2 }),
  employerHealthInsurance: decimal("employer_health_insurance", { precision: 10, scale: 2 }),
  employerPension: decimal("employer_pension", { precision: 10, scale: 2 }),
  employerEmploymentInsurance: decimal("employer_employment_insurance", { precision: 10, scale: 2 }),
  employerAccidentInsurance: decimal("employer_accident_insurance", { precision: 10, scale: 2 }),
  employerTotal: decimal("employer_total", { precision: 10, scale: 2 }),
  // 員工負擔
  employeeLaborInsurance: decimal("employee_labor_insurance", { precision: 10, scale: 2 }),
  employeeHealthInsurance: decimal("employee_health_insurance", { precision: 10, scale: 2 }),
  employeePension: decimal("employee_pension", { precision: 10, scale: 2 }),
  employeeTotal: decimal("employee_total", { precision: 10, scale: 2 }),
  // 實際
  netSalary: decimal("net_salary", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  // 狀態
  isPaid: boolean("is_paid").default(false),
  insurancePaid: boolean("insurance_paid").default(false),
  paymentRecordId: integer("payment_record_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueYearMonthEmployee: index("monthly_hr_costs_unique_idx").on(table.year, table.month, table.employeeId),
  yearMonthIdx: index("monthly_hr_costs_year_month_idx").on(table.year, table.month),
}));

// 員工關聯
export const employeesRelations = relations(employees, ({ many }) => ({
  monthlyCosts: many(monthlyHrCosts),
}));

export const monthlyHrCostsRelations = relations(monthlyHrCosts, ({ one }) => ({
  employee: one(employees, {
    fields: [monthlyHrCosts.employeeId],
    references: [employees.id],
  }),
}));

// Schema 和型別
export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  monthlySalary: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  insuredSalary: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  voluntaryPensionRate: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  dependentsCount: z.union([z.string(), z.number()]).transform((val) => parseInt(val.toString())).optional(),
});

export const insertMonthlyHrCostSchema = createInsertSchema(monthlyHrCosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type MonthlyHrCost = typeof monthlyHrCosts.$inferSelect;
export type InsertMonthlyHrCost = z.infer<typeof insertMonthlyHrCostSchema>;

// Final consolidated types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LineConfig = typeof lineConfigs.$inferSelect;
export type InsertLineConfig = z.infer<typeof insertLineConfigSchema>;
