import {
  pgTable,
  serial,
  integer,
  decimal,
  varchar,
  text,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

// ─────────────────────────────────────────────
// 開銷流水帳（先記錄、後分帳）
// 最簡：只要金額就能記；分類/會計科目/專案可空，之後批次補
// ─────────────────────────────────────────────
export const expenseLedger = pgTable(
  "expense_ledger",
  {
    id: serial("id").primaryKey(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    entryDate: date("entry_date").notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }), // 現金/信用卡/轉帳…
    note: text("note"),
    receiptImageUrl: varchar("receipt_image_url", { length: 500 }),
    // 分帳：分類 / 會計科目（可空，之後補）
    categoryId: integer("category_id"),
    accountCode: varchar("account_code", { length: 50 }),
    projectId: integer("project_id"),
    // unclassified 待整理 / classified 已分帳 / archived 已歸檔(轉應付款等)
    status: varchar("status", { length: 20 }).default("unclassified").notNull(),
    linkedPaymentItemId: integer("linked_payment_item_id"),
    source: varchar("source", { length: 20 }).default("manual").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    entryDateIdx: index("expense_ledger_entry_date_idx").on(table.entryDate),
    statusIdx: index("expense_ledger_status_idx").on(table.status),
  })
)

export const insertExpenseLedgerSchema = createInsertSchema(expenseLedger)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    amount: z
      .union([z.string(), z.number()])
      .transform((v) => v.toString())
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "金額需為非負數字"),
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式需為 YYYY-MM-DD"),
    paymentMethod: z.string().max(50).optional().nullable(),
    note: z.string().max(1000).optional().nullable(),
    receiptImageUrl: z.string().max(500).optional().nullable(),
    categoryId: z.number().int().positive().optional().nullable(),
    accountCode: z.string().max(50).optional().nullable(),
    projectId: z.number().int().positive().optional().nullable(),
    status: z.enum(["unclassified", "classified", "archived"]).optional(),
    source: z.string().max(20).optional(),
    linkedPaymentItemId: z.number().int().positive().optional().nullable(),
  })

export type ExpenseLedgerEntry = typeof expenseLedger.$inferSelect
export type InsertExpenseLedgerEntry = z.infer<typeof insertExpenseLedgerSchema>
