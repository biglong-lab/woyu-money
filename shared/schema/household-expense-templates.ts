/**
 * 家用支出範本（household_expense_templates）
 *
 * 用途：
 *  - 每月固定支出（房租 / 水費 / 電費 / 訂閱 / 健身房）一鍵記錄
 *  - 點範本卡片 → 自動填 quick-add 表單（金額 / 分類 / 付款方式 / 備註）
 *  - day_of_month 為「習慣記錄日」(1-31)、可選、未來可給排程提醒用
 *
 * 設計：
 *  - family_id 預設 1（單家庭、SaaS 預留）
 *  - is_active = false 軟刪除
 *  - sort_order 給使用者拖曳排序用
 */
import {
  pgTable,
  serial,
  integer,
  varchar,
  decimal,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

export const householdExpenseTemplates = pgTable(
  "household_expense_templates",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").notNull().default(1),
    name: varchar("name", { length: 100 }).notNull(),
    emoji: varchar("emoji", { length: 8 }).notNull().default("📋"),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    categoryId: integer("category_id"),
    paymentMethod: varchar("payment_method", { length: 20 }).notNull().default("cash"),
    description: text("description"),
    dayOfMonth: integer("day_of_month"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    familyIdx: index("het_family_idx").on(table.familyId),
    activeIdx: index("het_active_idx").on(table.isActive),
  })
)

export const insertHouseholdExpenseTemplateSchema = createInsertSchema(
  householdExpenseTemplates
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().max(8).optional(),
  amount: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  categoryId: z.number().int().nullable().optional(),
  paymentMethod: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
})

export type HouseholdExpenseTemplate = typeof householdExpenseTemplates.$inferSelect
export type InsertHouseholdExpenseTemplate = typeof householdExpenseTemplates.$inferInsert
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
