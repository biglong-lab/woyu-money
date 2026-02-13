import { pgTable, text, serial, integer, boolean, decimal, timestamp, date, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./base";
import { debtCategories, paymentProjects, fixedCategories, fixedCategorySubOptions } from "./category";

// 付款項目表
export const paymentItems = pgTable("payment_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => debtCategories.id),
  fixedCategoryId: integer("fixed_category_id").references(() => fixedCategories.id),
  fixedSubOptionId: integer("fixed_sub_option_id").references(() => fixedCategorySubOptions.id),
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
  source: varchar("source", { length: 20 }).default("manual"),
  sourceDocumentId: integer("source_document_id"),
  documentUploadedAt: timestamp("document_uploaded_at"),
  documentUploadedByUserId: integer("document_uploaded_by_user_id"),
  documentUploadedByUsername: varchar("document_uploaded_by_username", { length: 255 }),
  archivedByUserId: integer("archived_by_user_id"),
  archivedByUsername: varchar("archived_by_username", { length: 255 }),
  archivedAt: timestamp("archived_at"),
}, (table) => ({
  projectIdIdx: index("payment_items_project_id_idx").on(table.projectId),
  categoryIdIdx: index("payment_items_category_id_idx").on(table.categoryId),
  statusIdx: index("payment_items_status_idx").on(table.status),
  itemTypeIdx: index("payment_items_item_type_idx").on(table.itemType),
  startDateIdx: index("payment_items_start_date_idx").on(table.startDate),
  isDeletedIdx: index("payment_items_is_deleted_idx").on(table.isDeleted),
  sourceIdx: index("payment_items_source_idx").on(table.source),
  statusNotDeletedIdx: index("payment_items_status_not_deleted_idx").on(table.status, table.isDeleted),
  projectStatusIdx: index("payment_items_project_status_idx").on(table.projectId, table.status),
  dateRangeIdx: index("payment_items_date_range_idx").on(table.startDate, table.endDate),
}));

// 付款紀錄表
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
  itemIdIdx: index("payment_records_item_id_idx").on(table.itemId),
  paymentDateIdx: index("payment_records_payment_date_idx").on(table.paymentDate),
  paymentMethodIdx: index("payment_records_payment_method_idx").on(table.paymentMethod),
  itemDateIdx: index("payment_records_item_date_idx").on(table.itemId, table.paymentDate),
}));

// 給付款項時間計劃表
export const paymentSchedules = pgTable("payment_schedules", {
  id: serial("id").primaryKey(),
  paymentItemId: integer("payment_item_id").notNull().references(() => paymentItems.id),
  scheduledDate: date("scheduled_date").notNull(),
  originalDueDate: date("original_due_date"),
  rescheduleCount: integer("reschedule_count").default(0),
  isOverdue: boolean("is_overdue").default(false),
  overdueDays: integer("overdue_days").default(0),
  scheduledAmount: decimal("scheduled_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).default("scheduled"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  paymentItemIdIdx: index("payment_schedules_payment_item_id_idx").on(table.paymentItemId),
  scheduledDateIdx: index("payment_schedules_scheduled_date_idx").on(table.scheduledDate),
  statusIdx: index("payment_schedules_status_idx").on(table.status),
  isOverdueIdx: index("payment_schedules_is_overdue_idx").on(table.isOverdue),
  dateStatusIdx: index("payment_schedules_date_status_idx").on(table.scheduledDate, table.status),
  overdueCountIdx: index("payment_schedules_overdue_count_idx").on(table.isOverdue, table.overdueDays),
}));

// 分期付款計劃表
export const installmentPlans = pgTable("installment_plans", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => paymentItems.id),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  installmentCount: integer("installment_count").notNull(),
  monthlyAmount: decimal("monthly_amount", { precision: 10, scale: 2 }).notNull(),
  startDate: date("start_date").notNull(),
  startType: varchar("start_type", { length: 20 }).notNull().default("current_month"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 項目備註表
export const paymentItemNotes = pgTable("payment_item_notes", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => paymentItems.id),
  userId: integer("user_id").references(() => users.id),
  userInfo: varchar("user_info", { length: 255 }),
  noteText: text("note_text").notNull(),
  attachmentUrl: varchar("attachment_url", { length: 500 }),
  attachmentName: varchar("attachment_name", { length: 255 }),
  attachmentSize: integer("attachment_size"),
  attachmentType: varchar("attachment_type", { length: 100 }),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 預算規劃表
export const budgetPlans = pgTable("budget_plans", {
  id: serial("id").primaryKey(),
  planName: varchar("plan_name", { length: 255 }).notNull(),
  planType: varchar("plan_type", { length: 50 }).notNull().default("project"),
  projectId: integer("project_id").references(() => paymentProjects.id),
  budgetPeriod: varchar("budget_period", { length: 50 }).notNull().default("monthly"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  totalBudget: decimal("total_budget", { precision: 12, scale: 2 }).notNull().default("0.00"),
  actualSpent: decimal("actual_spent", { precision: 12, scale: 2 }).default("0.00"),
  status: varchar("status", { length: 20 }).default("active"),
  tags: jsonb("tags").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  projectIdIdx: index("budget_plans_project_id_idx").on(table.projectId),
  statusIdx: index("budget_plans_status_idx").on(table.status),
}));

// 預算項目表
export const budgetItems = pgTable("budget_items", {
  id: serial("id").primaryKey(),
  budgetPlanId: integer("budget_plan_id").notNull().references(() => budgetPlans.id),
  categoryId: integer("category_id").references(() => debtCategories.id),
  fixedCategoryId: integer("fixed_category_id").references(() => fixedCategories.id),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  description: text("description"),
  paymentType: varchar("payment_type", { length: 20 }).default("single"),
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

// 驗證 Schema
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

export const insertInstallmentPlanSchema = createInsertSchema(installmentPlans).omit({
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

// 型別匯出
export type PaymentItem = typeof paymentItems.$inferSelect;
export type InsertPaymentItem = z.infer<typeof insertPaymentItemSchema>;
export type PaymentRecord = typeof paymentRecords.$inferSelect;
export type InsertPaymentRecord = z.infer<typeof insertPaymentRecordSchema>;
export type PaymentSchedule = typeof paymentSchedules.$inferSelect;
export type InsertPaymentSchedule = z.infer<typeof insertPaymentScheduleSchema>;
export type InstallmentPlan = typeof installmentPlans.$inferSelect;
export type InsertInstallmentPlan = z.infer<typeof insertInstallmentPlanSchema>;
export type PaymentItemNote = typeof paymentItemNotes.$inferSelect;
export type InsertPaymentItemNote = z.infer<typeof insertPaymentItemNoteSchema>;
export type BudgetPlan = typeof budgetPlans.$inferSelect;
export type InsertBudgetPlan = z.infer<typeof insertBudgetPlanSchema>;
export type BudgetItem = typeof budgetItems.$inferSelect;
export type InsertBudgetItem = z.infer<typeof insertBudgetItemSchema>;
