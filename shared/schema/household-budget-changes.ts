/**
 * 家庭預算變更歷程 — 階段 4.2
 *
 * 設計：
 *  - 每次 POST /api/household/budget 都 insert 一筆（新建或修改都記）
 *  - 寫 oldAmount / newAmount / changedByUserId / reason
 *  - UI 顯示「誰、何時、改了多少、為什麼」
 *
 * 用途：
 *  - 家庭多人協作時、預算被改有跡可循
 *  - 為未來「需多人同意才能改」鋪路
 */
import {
  pgTable,
  serial,
  integer,
  decimal,
  varchar,
  timestamp,
  text,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./base"

export const householdBudgetChanges = pgTable(
  "household_budget_changes",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").notNull().default(1),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    categoryId: integer("category_id").notNull().default(0),
    oldAmount: decimal("old_amount", { precision: 12, scale: 2 }),
    newAmount: decimal("new_amount", { precision: 12, scale: 2 }).notNull(),
    diffAmount: decimal("diff_amount", { precision: 12, scale: 2 }),
    changedByUserId: integer("changed_by_user_id").references(() => users.id),
    changedByName: varchar("changed_by_name", { length: 100 }),
    reason: text("reason"),
    action: varchar("action", { length: 16 }).notNull().default("update"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    monthIdx: index("hbc_month_idx").on(table.year, table.month),
    familyIdx: index("hbc_family_idx").on(table.familyId),
    createdIdx: index("hbc_created_idx").on(table.createdAt),
  })
)

export type HouseholdBudgetChange = typeof householdBudgetChanges.$inferSelect
export type InsertHouseholdBudgetChange = typeof householdBudgetChanges.$inferInsert
