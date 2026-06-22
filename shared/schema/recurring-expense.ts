/**
 * 週期性支出模板（recurring_expense_templates）
 *
 * 取代「依歷史平均自動推算」邏輯（過去 auto_backfill）。
 * 使用者可在 UI 設定每個固定支出的金額、發生月份、跳過特定月份等。
 *
 * Scheduler 每天檢查、若指定日期到了就產出 unpaid payment_item。
 */
import {
  pgTable,
  serial,
  integer,
  varchar,
  decimal,
  boolean,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"
import { paymentProjects } from "./category"

export const recurringExpenseTemplates = pgTable(
  "recurring_expense_templates",
  {
    id: serial("id").primaryKey(),
    templateName: varchar("template_name", { length: 255 }).notNull(),
    projectId: integer("project_id").references(() => paymentProjects.id),
    categoryId: integer("category_id"),
    fixedCategoryId: integer("fixed_category_id"),

    // 金額（估算，使用者可改）
    estimatedAmount: decimal("estimated_amount", { precision: 12, scale: 2 }).notNull(),

    // 觸發設定
    dayOfMonth: integer("day_of_month").notNull().default(10), // 每月幾號到期
    activeMonths: text("active_months").notNull().default("*"), // '*' 或 '1,3,6,9'

    // 帳單時間掌握（選填）：帳單來的日 / 法定繳費日 / 最終必繳日 + 罰款說明
    billDay: integer("bill_day"),
    legalDueDay: integer("legal_due_day"),
    finalDueDay: integer("final_due_day"),
    penaltyNote: text("penalty_note"),

    // 標籤 + 備註
    tags: text("tags"),
    notes: text("notes"),

    // 狀態
    isActive: boolean("is_active").notNull().default(true),
    lastGeneratedMonth: varchar("last_generated_month", { length: 7 }), // YYYY-MM

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    isActiveIdx: index("rec_exp_tpl_active_idx").on(table.isActive),
    projectIdx: index("rec_exp_tpl_project_idx").on(table.projectId),
  })
)

export const insertRecurringExpenseTemplateSchema = createInsertSchema(
  recurringExpenseTemplates
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastGeneratedMonth: true,
})

export type RecurringExpenseTemplate = typeof recurringExpenseTemplates.$inferSelect
export type InsertRecurringExpenseTemplate = z.infer<typeof insertRecurringExpenseTemplateSchema>
