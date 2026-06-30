import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  decimal,
  timestamp,
  date,
  varchar,
  index,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

// ─────────────────────────────────────────────
// 歷史欠款整理（獨立模組、暫不與其他財務數據對應）
// 用途：把過去散落的欠款先登打進來看全貌，再做分期還款與歸帳
// 注意：識別字用 legacyDebt 前綴，避免與既有核心表 debtCategories（科目主表）撞名
// ─────────────────────────────────────────────

// 欠款分類（可自訂、依需求新增，如 借款 / 貨款 / 稅款 / 勞健保）
export const legacyDebtCategories = pgTable("legacy_debt_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})

// 生命週期狀態：open 處理中 / reconciled 已歸帳 / cancelled 作廢
export const LEGACY_DEBT_STATUSES = ["open", "reconciled", "cancelled"] as const
export type LegacyDebtStatus = (typeof LEGACY_DEBT_STATUSES)[number]

// 歷史欠款主表
export const legacyDebts = pgTable(
  "legacy_debts",
  {
    id: serial("id").primaryKey(),
    // 欠款總額
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    // 分類（選填、關聯 legacy_debt_categories）
    categoryId: integer("category_id").references(() => legacyDebtCategories.id),
    // 債權人 / 對象（欠誰的）
    creditor: varchar("creditor", { length: 100 }),
    // 發生日期（選填）
    incurDate: date("incur_date"),
    // 期限 / 到期日（選填）
    dueDate: date("due_date"),
    // 狀態
    status: varchar("status", { length: 20 }).default("open").notNull(),
    // 歸帳科目（選填、獨立標記用）
    accountCode: varchar("account_code", { length: 50 }),
    // 歸帳時間
    reconciledAt: timestamp("reconciled_at"),
    // 備註
    note: text("note"),
    // 單據圖片（本地 /uploads/... 路徑）
    receiptImageUrl: varchar("receipt_image_url", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    categoryIdx: index("legacy_debts_category_idx").on(table.categoryId),
    statusIdx: index("legacy_debts_status_idx").on(table.status),
    dueDateIdx: index("legacy_debts_due_date_idx").on(table.dueDate),
  })
)

// 分期 / 還款紀錄（一筆欠款可多次還款）
export const legacyDebtPayments = pgTable(
  "legacy_debt_payments",
  {
    id: serial("id").primaryKey(),
    debtId: integer("debt_id")
      .notNull()
      .references(() => legacyDebts.id, { onDelete: "cascade" }),
    // 本次還款金額
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    // 還款日期
    payDate: date("pay_date").notNull(),
    // 付款方式（現金 / 轉帳 / 信用卡…）
    method: varchar("method", { length: 50 }),
    // 備註
    note: text("note"),
    // 收據圖片
    receiptImageUrl: varchar("receipt_image_url", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    debtIdx: index("legacy_debt_payments_debt_idx").on(table.debtId),
    payDateIdx: index("legacy_debt_payments_pay_date_idx").on(table.payDate),
  })
)

// ─────────────────────────────────────────────
// 驗證 Schema
// ─────────────────────────────────────────────

const amountField = z
  .union([z.string(), z.number()])
  .transform((v) => v.toString())
  .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "金額需為非負數字")

const ymdField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式需為 YYYY-MM-DD")

export const insertLegacyDebtCategorySchema = createInsertSchema(legacyDebtCategories)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().trim().min(1, "分類名稱不可空白").max(50),
  })

export const insertLegacyDebtSchema = createInsertSchema(legacyDebts)
  .omit({ id: true, createdAt: true, updatedAt: true, reconciledAt: true })
  .extend({
    amount: amountField,
    categoryId: z.number().int().positive().optional().nullable(),
    creditor: z.string().trim().max(100).optional().nullable(),
    incurDate: ymdField.optional().nullable(),
    dueDate: ymdField.optional().nullable(),
    status: z.enum(LEGACY_DEBT_STATUSES).default("open"),
    accountCode: z.string().trim().max(50).optional().nullable(),
    note: z.string().max(2000).optional().nullable(),
    receiptImageUrl: z.string().max(500).optional().nullable(),
  })

export const insertLegacyDebtPaymentSchema = createInsertSchema(legacyDebtPayments)
  .omit({ id: true, createdAt: true, debtId: true })
  .extend({
    amount: amountField.refine((v) => parseFloat(v) > 0, "還款金額需大於 0"),
    payDate: ymdField,
    method: z.string().trim().max(50).optional().nullable(),
    note: z.string().max(2000).optional().nullable(),
    receiptImageUrl: z.string().max(500).optional().nullable(),
  })

// ─────────────────────────────────────────────
// 型別匯出
// ─────────────────────────────────────────────

export type LegacyDebtCategory = typeof legacyDebtCategories.$inferSelect
export type InsertLegacyDebtCategory = z.infer<typeof insertLegacyDebtCategorySchema>
export type LegacyDebt = typeof legacyDebts.$inferSelect
export type InsertLegacyDebt = z.infer<typeof insertLegacyDebtSchema>
export type LegacyDebtPayment = typeof legacyDebtPayments.$inferSelect
export type InsertLegacyDebtPayment = z.infer<typeof insertLegacyDebtPaymentSchema>
