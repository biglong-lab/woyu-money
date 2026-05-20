/**
 * 家庭記帳「小孩模式」schema
 *
 * 設計重點：
 * - 5 張表全部加 family_id 欄位（未來 SaaS 切租戶用）
 * - 任務金額是「實際支付」（家長真的給小孩現金）
 * - 三罐分配（Spend/Save/Give）每個小孩可獨立比例
 * - PIN 4 位數登入、小孩端不用密碼
 *
 * 與主系統串接：
 * - 任務 approve → 寫一筆 payment_records（家長銀行支出）+ kids_jars 分配
 * - kids_accounts.totalReceived 持續累積、可對帳
 */
import {
  pgTable,
  serial,
  integer,
  varchar,
  decimal,
  date,
  timestamp,
  boolean,
  text,
  jsonb,
  index,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

// ============================================================
// 小孩帳戶（family_id + 名字 + 頭像 + PIN）
// ============================================================
export const kidsAccounts = pgTable(
  "kids_accounts",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").default(1), // 預設 1、未來 SaaS 切租戶
    displayName: varchar("display_name", { length: 50 }).notNull(),
    avatar: varchar("avatar", { length: 32 }).notNull().default("🧒"), // emoji
    color: varchar("color", { length: 16 }).notNull().default("blue"), // tailwind 主題色
    pin: varchar("pin", { length: 4 }).notNull(), // 4 位數明碼（低門檻、家用 OK）
    birthday: date("birthday"),
    // 三罐分配比例（總和 100）
    spendRatio: integer("spend_ratio").notNull().default(70),
    saveRatio: integer("save_ratio").notNull().default(20),
    giveRatio: integer("give_ratio").notNull().default(10),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    familyIdx: index("kids_accounts_family_idx").on(table.familyId),
    pinIdx: index("kids_accounts_pin_idx").on(table.pin),
  })
)

// ============================================================
// 三罐餘額（每個 kid 一筆、累積金額）
// ============================================================
export const kidsJars = pgTable(
  "kids_jars",
  {
    id: serial("id").primaryKey(),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kidsAccounts.id, { onDelete: "cascade" }),
    spendBalance: decimal("spend_balance", { precision: 10, scale: 2 }).notNull().default("0"),
    saveBalance: decimal("save_balance", { precision: 10, scale: 2 }).notNull().default("0"),
    giveBalance: decimal("give_balance", { precision: 10, scale: 2 }).notNull().default("0"),
    totalReceived: decimal("total_received", { precision: 10, scale: 2 }).notNull().default("0"),
    totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).notNull().default("0"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    kidIdx: index("kids_jars_kid_idx").on(table.kidId),
  })
)

// ============================================================
// 任務（家長派、小孩做、家長 approve）
// ============================================================
export const kidsTasks = pgTable(
  "kids_tasks",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").default(1),
    kidId: integer("kid_id").references(() => kidsAccounts.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 100 }).notNull(),
    emoji: varchar("emoji", { length: 8 }).default("📋"),
    rewardAmount: decimal("reward_amount", { precision: 8, scale: 2 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // pending=待完成、submitted=小孩標完成等家長確認、approved=家長確認入帳、rejected=被駁回
    notes: text("notes"),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at"),
    approvedAt: timestamp("approved_at"),
    paymentRecordId: integer("payment_record_id"), // 入帳後對應的 payment_records.id
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    familyIdx: index("kids_tasks_family_idx").on(table.familyId),
    kidStatusIdx: index("kids_tasks_kid_status_idx").on(table.kidId, table.status),
  })
)

// ============================================================
// 存錢目標
// ============================================================
export const kidsGoals = pgTable(
  "kids_goals",
  {
    id: serial("id").primaryKey(),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kidsAccounts.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    emoji: varchar("emoji", { length: 8 }).default("🎯"),
    targetAmount: decimal("target_amount", { precision: 10, scale: 2 }).notNull(),
    currentAmount: decimal("current_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    deadline: date("deadline"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    // active / completed / abandoned
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    kidStatusIdx: index("kids_goals_kid_status_idx").on(table.kidId, table.status),
  })
)

// ============================================================
// 徽章
// ============================================================
export const kidsBadges = pgTable(
  "kids_badges",
  {
    id: serial("id").primaryKey(),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kidsAccounts.id, { onDelete: "cascade" }),
    badgeType: varchar("badge_type", { length: 40 }).notNull(),
    // streak_7 / streak_30 / first_goal / 10_tasks / 50_tasks / give_100 / save_1000 ...
    title: varchar("title", { length: 80 }).notNull(),
    emoji: varchar("emoji", { length: 8 }).notNull(),
    earnedAt: timestamp("earned_at").notNull().defaultNow(),
    metadata: jsonb("metadata"), // 可選：紀錄相關目標 id、達成數值等
  },
  (table) => ({
    kidIdx: index("kids_badges_kid_idx").on(table.kidId),
    typeIdx: index("kids_badges_type_idx").on(table.kidId, table.badgeType),
  })
)

// ============================================================
// Zod schema for validation
// ============================================================
export const insertKidsAccountSchema = createInsertSchema(kidsAccounts, {
  pin: z.string().regex(/^\d{4}$/, "PIN 需為 4 位數字"),
  spendRatio: z.number().int().min(0).max(100),
  saveRatio: z.number().int().min(0).max(100),
  giveRatio: z.number().int().min(0).max(100),
}).omit({ id: true, createdAt: true, updatedAt: true })

export const insertKidsTaskSchema = createInsertSchema(kidsTasks, {
  rewardAmount: z.union([z.string(), z.number()]).transform((v) => String(v)),
}).omit({
  id: true,
  completedAt: true,
  approvedAt: true,
  paymentRecordId: true,
  createdAt: true,
  updatedAt: true,
})

export const insertKidsGoalSchema = createInsertSchema(kidsGoals, {
  targetAmount: z.union([z.string(), z.number()]).transform((v) => String(v)),
}).omit({ id: true, completedAt: true, createdAt: true, updatedAt: true, currentAmount: true })

// Types
export type KidsAccount = typeof kidsAccounts.$inferSelect
export type InsertKidsAccount = z.infer<typeof insertKidsAccountSchema>
export type KidsJar = typeof kidsJars.$inferSelect
export type KidsTask = typeof kidsTasks.$inferSelect
export type InsertKidsTask = z.infer<typeof insertKidsTaskSchema>
export type KidsGoal = typeof kidsGoals.$inferSelect
export type InsertKidsGoal = z.infer<typeof insertKidsGoalSchema>
export type KidsBadge = typeof kidsBadges.$inferSelect
