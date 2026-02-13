import { pgTable, text, serial, integer, boolean, decimal, timestamp, date, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// 檔案附件表
export const fileAttachments = pgTable("file_attachments", {
  id: serial("id").primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: integer("entity_id").notNull(),
  uploadedBy: varchar("uploaded_by", { length: 100 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 借貸資金紀錄表
export const loanInvestmentRecords = pgTable("loan_investment_records", {
  id: serial("id").primaryKey(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  recordType: varchar("record_type", { length: 20 }).notNull(),
  partyName: varchar("party_name", { length: 255 }).notNull(),
  partyPhone: varchar("party_phone", { length: 50 }),
  partyRelationship: varchar("party_relationship", { length: 100 }),
  partyNotes: text("party_notes"),
  principalAmount: decimal("principal_amount", { precision: 15, scale: 2 }).notNull(),
  annualInterestRate: decimal("annual_interest_rate", { precision: 5, scale: 2 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  interestPaymentMethod: varchar("interest_payment_method", { length: 20 }),
  monthlyPaymentAmount: decimal("monthly_payment_amount", { precision: 15, scale: 2 }),
  agreedPaymentDay: integer("agreed_payment_day"),
  annualPaymentDate: date("annual_payment_date"),
  fixedReturnRate: decimal("fixed_return_rate", { precision: 5, scale: 2 }),
  otherReturnPlan: text("other_return_plan"),
  hasAgreedReturn: boolean("has_agreed_return").default(false),
  returnMethod: varchar("return_method", { length: 20 }),
  installmentCount: integer("installment_count"),
  installmentAmount: decimal("installment_amount", { precision: 15, scale: 2 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  totalPaidAmount: decimal("total_paid_amount", { precision: 15, scale: 2 }).default("0"),
  isHighRisk: boolean("is_high_risk").default(false),
  contractFileUrl: varchar("contract_file_url", { length: 500 }),
  documentNotes: text("document_notes"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 借貸付款計劃表
export const loanPaymentSchedule = pgTable("loan_payment_schedule", {
  id: serial("id").primaryKey(),
  recordId: integer("record_id").notNull().references(() => loanInvestmentRecords.id),
  scheduleType: varchar("schedule_type", { length: 20 }).notNull(),
  dueDate: date("due_date").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false),
  paidDate: date("paid_date"),
  paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 借貸付款紀錄表
export const loanPaymentHistory = pgTable("loan_payment_history", {
  id: serial("id").primaryKey(),
  recordId: integer("record_id").notNull().references(() => loanInvestmentRecords.id),
  scheduleId: integer("schedule_id").references(() => loanPaymentSchedule.id),
  paymentType: varchar("payment_type", { length: 20 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("completed"),
  isEarlyPayment: boolean("is_early_payment").default(false),
  isLatePayment: boolean("is_late_payment").default(false),
  receiptFileUrl: varchar("receipt_file_url", { length: 500 }),
  hasReceipt: boolean("has_receipt").default(false),
  receiptNotes: text("receipt_notes"),
  notes: text("notes"),
  communicationNotes: text("communication_notes"),
  riskNotes: text("risk_notes"),
  remainingPrincipal: decimal("remaining_principal", { precision: 15, scale: 2 }),
  remainingInterest: decimal("remaining_interest", { precision: 15, scale: 2 }),
  recordedBy: varchar("recorded_by", { length: 100 }),
  verifiedBy: varchar("verified_by", { length: 100 }),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 驗證 Schema
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

export const insertFileAttachmentSchema = createInsertSchema(fileAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 型別匯出
export type LoanInvestmentRecord = typeof loanInvestmentRecords.$inferSelect;
export type InsertLoanInvestmentRecord = z.infer<typeof insertLoanInvestmentRecordSchema>;
export type LoanPaymentSchedule = typeof loanPaymentSchedule.$inferSelect;
export type InsertLoanPaymentSchedule = z.infer<typeof insertLoanPaymentScheduleSchema>;
export type LoanPaymentHistory = typeof loanPaymentHistory.$inferSelect;
export type InsertLoanPaymentHistory = z.infer<typeof insertLoanPaymentHistorySchema>;
export type FileAttachment = typeof fileAttachments.$inferSelect;
export type InsertFileAttachment = z.infer<typeof insertFileAttachmentSchema>;
