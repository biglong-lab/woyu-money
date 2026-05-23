/**
 * 家用收入紀錄（household_incomes）
 *
 * 對應家用記帳「收入」面：薪資 / 獎金 / 投資 / 副業 / 退款…
 * 與支出（household_expenses）對稱、結構相似
 *
 * 設計：
 *  - family_id 預設 1
 *  - category 用 varchar 自由文字（薪資、獎金、投資、副業、退款、其他）
 *    不強制 FK 到 fixed_categories（家用收入分類少、不需要 schema 共用）
 *  - payment_method: bank_transfer / cash / mobile_payment / other（預設 bank_transfer）
 */
import {
  pgTable,
  serial,
  integer,
  varchar,
  decimal,
  date,
  timestamp,
  text,
  index,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

export const householdIncomes = pgTable(
  "household_incomes",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").notNull().default(1),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    category: varchar("category", { length: 50 }).notNull().default("薪資"),
    date: date("date").notNull(),
    description: text("description"),
    paymentMethod: varchar("payment_method", { length: 20 }).notNull().default("bank_transfer"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    familyIdx: index("hi_family_idx").on(table.familyId),
    dateIdx: index("hi_date_idx").on(table.date),
  })
)

export const insertHouseholdIncomeSchema = createInsertSchema(householdIncomes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const createIncomeSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  category: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式 YYYY-MM-DD"),
  description: z.string().max(500).optional(),
  paymentMethod: z.string().max(20).optional(),
})

export type HouseholdIncome = typeof householdIncomes.$inferSelect
export type InsertHouseholdIncome = typeof householdIncomes.$inferInsert
