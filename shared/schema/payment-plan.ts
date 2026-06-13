import {
  pgTable,
  serial,
  integer,
  decimal,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"
import { paymentItems } from "./payment"

// ─────────────────────────────────────────────
// 排程分配規劃層（獨立規劃，不動 payment_items.dueDate）
//
// 一筆應付款可拆到多個月份（多列），每列 = 「該筆規劃在某月付多少」。
// 純沙盤規劃用：用來在一頁推估未來每月/每季/每年所需金額。
// ─────────────────────────────────────────────
export const paymentPlanAllocations = pgTable(
  "payment_plan_allocations",
  {
    id: serial("id").primaryKey(),
    paymentItemId: integer("payment_item_id")
      .notNull()
      .references(() => paymentItems.id, { onDelete: "cascade" }),
    plannedMonth: varchar("planned_month", { length: 7 }).notNull(), // YYYY-MM
    plannedAmount: decimal("planned_amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    itemIdx: index("payment_plan_alloc_item_idx").on(table.paymentItemId),
    monthIdx: index("payment_plan_alloc_month_idx").on(table.plannedMonth),
  })
)

export const insertPaymentPlanAllocationSchema = createInsertSchema(paymentPlanAllocations)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    paymentItemId: z.number().int().positive(),
    plannedMonth: z.string().regex(/^\d{4}-\d{2}$/, "月份格式需為 YYYY-MM"),
    plannedAmount: z
      .union([z.string(), z.number()])
      .transform((v) => v.toString())
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "金額需為非負數字"),
    note: z.string().max(500).optional().nullable(),
  })

export type PaymentPlanAllocation = typeof paymentPlanAllocations.$inferSelect
export type InsertPaymentPlanAllocation = z.infer<typeof insertPaymentPlanAllocationSchema>

// ─────────────────────────────────────────────
// 分類覆寫：使用者把某筆應付款重新歸到自訂類別（預設用引擎判定的類別）
// ─────────────────────────────────────────────
export const paymentPlanItemCategories = pgTable("payment_plan_item_categories", {
  paymentItemId: integer("payment_item_id")
    .primaryKey()
    .references(() => paymentItems.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 60 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

// ─────────────────────────────────────────────
// 分類月度預算：每「類別 × 月份」要付/要準備多少
// category 可為應付款類別（租金/勞健保/其他…），
// 或保留字 "營運成本" / "生活所需"（三大塊的後兩塊）
// ─────────────────────────────────────────────
export const paymentPlanCategoryBudgets = pgTable(
  "payment_plan_category_budgets",
  {
    id: serial("id").primaryKey(),
    category: varchar("category", { length: 60 }).notNull(),
    plannedMonth: varchar("planned_month", { length: 7 }).notNull(), // YYYY-MM
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    catMonthIdx: index("payment_plan_cat_budget_idx").on(table.category, table.plannedMonth),
  })
)

export const insertItemCategorySchema = createInsertSchema(paymentPlanItemCategories)
  .omit({ updatedAt: true })
  .extend({
    paymentItemId: z.number().int().positive(),
    category: z.string().trim().min(1).max(60),
  })

export const insertCategoryBudgetSchema = createInsertSchema(paymentPlanCategoryBudgets)
  .omit({ id: true, updatedAt: true })
  .extend({
    category: z.string().trim().min(1).max(60),
    plannedMonth: z.string().regex(/^\d{4}-\d{2}$/, "月份格式需為 YYYY-MM"),
    amount: z
      .union([z.string(), z.number()])
      .transform((v) => v.toString())
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "金額需為非負數字"),
  })

export type PaymentPlanItemCategory = typeof paymentPlanItemCategories.$inferSelect
export type PaymentPlanCategoryBudget = typeof paymentPlanCategoryBudgets.$inferSelect
