/**
 * 家庭共同存錢目標 — 階段 4.4
 *
 * 設計：
 *  - 不和 kids_goals 混用（kids_goals 是個別小孩自己存）
 *  - 此表為「全家共同目標」：旅遊基金 / 大型家電 / 結婚基金
 *  - 紀錄目標 / 已存 / 截止日 / 狀態（active / achieved / archived）
 *  - 每筆 contribution 寫進 family_savings_contributions 子表（可追溯誰存的）
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
import { users } from "./base"
import { z } from "zod"

export const familySavingsGoals = pgTable(
  "family_savings_goals",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").notNull().default(1),
    title: varchar("title", { length: 100 }).notNull(),
    emoji: varchar("emoji", { length: 8 }).notNull().default("💰"),
    targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).notNull(),
    currentAmount: decimal("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    targetDate: date("target_date"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    notes: text("notes"),
    createdByUserId: integer("created_by_user_id").references(() => users.id),
    achievedAt: timestamp("achieved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    familyIdx: index("fsg_family_idx").on(table.familyId),
    statusIdx: index("fsg_status_idx").on(table.status),
  })
)

export const familySavingsContributions = pgTable(
  "family_savings_contributions",
  {
    id: serial("id").primaryKey(),
    goalId: integer("goal_id")
      .notNull()
      .references(() => familySavingsGoals.id, {
        onDelete: "cascade",
      }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    contributedByUserId: integer("contributed_by_user_id").references(() => users.id),
    contributedByName: varchar("contributed_by_name", { length: 100 }),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    goalIdx: index("fsc_goal_idx").on(table.goalId),
  })
)

export const createSavingsGoalSchema = z.object({
  title: z.string().min(1).max(100),
  emoji: z.string().max(8).optional(),
  targetAmount: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  targetDate: z.string().optional(),
  notes: z.string().max(500).optional(),
})

export const contributeSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  note: z.string().max(500).optional(),
})

export type FamilySavingsGoal = typeof familySavingsGoals.$inferSelect
export type FamilySavingsContribution = typeof familySavingsContributions.$inferSelect
