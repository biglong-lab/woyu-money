/**
 * 滯納金規則表（late_fee_policies）
 *
 * 取代過去硬編寫於 shared/payment-priority.ts 的 CATEGORY_RULES。
 * 使用者可在 /late-fee-settings 自行設定每類別的：
 *   - 費率（每天 %）
 *   - 寬限期（dueDate + N 天後才開始累積）
 *   - 是否啟用
 */
import {
  pgTable,
  serial,
  varchar,
  decimal,
  integer,
  boolean,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

export const lateFeePolicies = pgTable(
  "late_fee_policies",
  {
    id: serial("id").primaryKey(),
    categoryKey: varchar("category_key", { length: 50 }).notNull(), // 對應 CATEGORY_RULES 的 key
    label: varchar("label", { length: 100 }).notNull(),
    dailyRate: decimal("daily_rate", { precision: 8, scale: 6 }).notNull().default("0"), // 0.003 = 0.3%/天
    gracePeriodDays: integer("grace_period_days").notNull().default(0),
    isEnabled: boolean("is_enabled").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    categoryKeyUniq: unique("late_fee_policies_category_key_uniq").on(table.categoryKey),
  })
)

export const insertLateFeePolicySchema = createInsertSchema(lateFeePolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type LateFeePolicy = typeof lateFeePolicies.$inferSelect
export type InsertLateFeePolicy = z.infer<typeof insertLateFeePolicySchema>
