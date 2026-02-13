import { pgTable, text, serial, integer, boolean, decimal, timestamp, date, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { paymentProjects } from "./category";

// 租約管理表
export const rentalContracts = pgTable("rental_contracts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => paymentProjects.id),
  contractName: varchar("contract_name", { length: 255 }).notNull(),
  tenantName: varchar("tenant_name", { length: 255 }),
  tenantPhone: varchar("tenant_phone", { length: 50 }),
  tenantAddress: text("tenant_address"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  totalYears: integer("total_years").notNull(),
  totalMonths: integer("total_months").notNull(),
  baseAmount: decimal("base_amount", { precision: 10, scale: 2 }).notNull(),
  payeeName: varchar("payee_name", { length: 255 }),
  payeeUnit: varchar("payee_unit", { length: 255 }),
  bankCode: varchar("bank_code", { length: 10 }),
  accountNumber: varchar("account_number", { length: 50 }),
  contractPaymentDay: integer("contract_payment_day").default(1),
  hasBufferPeriod: boolean("has_buffer_period").default(false),
  bufferMonths: integer("buffer_months").default(0),
  bufferIncludedInTerm: boolean("buffer_included_in_term").default(true),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 合約文件上傳管理表
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

// 租金階段價格表
export const rentalPriceTiers = pgTable("rental_price_tiers", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => rentalContracts.id),
  yearStart: integer("year_start").notNull(),
  yearEnd: integer("year_end").notNull(),
  monthlyAmount: decimal("monthly_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 驗證 Schema
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

// 型別匯出
export type RentalContract = typeof rentalContracts.$inferSelect;
export type InsertRentalContract = z.infer<typeof insertRentalContractSchema>;
export type RentalPriceTier = typeof rentalPriceTiers.$inferSelect;
export type InsertRentalPriceTier = z.infer<typeof insertRentalPriceTierSchema>;
export type ContractDocument = typeof contractDocuments.$inferSelect;
export type InsertContractDocument = z.infer<typeof insertContractDocumentSchema>;
