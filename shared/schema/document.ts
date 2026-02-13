import { pgTable, text, serial, integer, boolean, decimal, timestamp, date, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./base";
import { paymentItems, paymentRecords } from "./payment";

// 單據收件箱
export const documentInbox = pgTable("document_inbox", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  documentType: varchar("document_type", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"),
  imagePath: varchar("image_path", { length: 500 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }),
  aiRecognized: boolean("ai_recognized").default(false),
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }),
  aiExtractedData: jsonb("ai_extracted_data").default({}),
  aiRawResponse: text("ai_raw_response"),
  recognizedVendor: varchar("recognized_vendor", { length: 200 }),
  recognizedAmount: decimal("recognized_amount", { precision: 15, scale: 2 }),
  recognizedDate: date("recognized_date"),
  recognizedDescription: text("recognized_description"),
  recognizedCategory: varchar("recognized_category", { length: 100 }),
  recognizedInvoiceNumber: varchar("recognized_invoice_number", { length: 100 }),
  userConfirmed: boolean("user_confirmed").default(false),
  confirmedVendor: varchar("confirmed_vendor", { length: 200 }),
  confirmedAmount: decimal("confirmed_amount", { precision: 15, scale: 2 }),
  confirmedDate: date("confirmed_date"),
  confirmedDescription: text("confirmed_description"),
  confirmedCategory: varchar("confirmed_category", { length: 100 }),
  archivedToType: varchar("archived_to_type", { length: 20 }),
  archivedToId: integer("archived_to_id"),
  archivedAt: timestamp("archived_at"),
  archivedByUserId: integer("archived_by_user_id").references(() => users.id),
  archivedByUsername: varchar("archived_by_username", { length: 100 }),
  uploadedByUsername: varchar("uploaded_by_username", { length: 100 }),
  editedByUserId: integer("edited_by_user_id").references(() => users.id),
  editedByUsername: varchar("edited_by_username", { length: 100 }),
  editedAt: timestamp("edited_at"),
  notes: text("notes"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("document_inbox_user_idx").on(table.userId),
  index("document_inbox_status_idx").on(table.status),
  index("document_inbox_type_idx").on(table.documentType),
]);

// 發票紀錄表
export const invoiceRecords = pgTable("invoice_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  invoiceDate: date("invoice_date").notNull(),
  vendorName: varchar("vendor_name", { length: 200 }),
  vendorTaxId: varchar("vendor_tax_id", { length: 20 }),
  buyerName: varchar("buyer_name", { length: 200 }),
  buyerTaxId: varchar("buyer_tax_id", { length: 20 }),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  invoiceType: varchar("invoice_type", { length: 20 }).default("expense"),
  paymentItemId: integer("payment_item_id").references(() => paymentItems.id),
  paymentRecordId: integer("payment_record_id").references(() => paymentRecords.id),
  documentInboxId: integer("document_inbox_id").references(() => documentInbox.id),
  imagePath: varchar("image_path", { length: 500 }),
  taxYear: integer("tax_year"),
  taxMonth: integer("tax_month"),
  status: varchar("status", { length: 20 }).default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("invoice_records_user_idx").on(table.userId),
  index("invoice_records_date_idx").on(table.invoiceDate),
  index("invoice_records_vendor_idx").on(table.vendorName),
  index("invoice_records_tax_period_idx").on(table.taxYear, table.taxMonth),
]);

// 驗證 Schema
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

// 型別匯出
export type DocumentInbox = typeof documentInbox.$inferSelect;
export type InsertDocumentInbox = z.infer<typeof insertDocumentInboxSchema>;
export type InvoiceRecord = typeof invoiceRecords.$inferSelect;
export type InsertInvoiceRecord = z.infer<typeof insertInvoiceRecordSchema>;
