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
    // 每月自動零用金（0 = 關閉、>0 = 每月 1 號自動入帳該金額並按三罐分配）
    monthlyAllowance: decimal("monthly_allowance", { precision: 8, scale: 2 })
      .notNull()
      .default("0"),
    // 上次自動入帳的月份（YYYY-MM）、避免同月重發
    lastAllowanceMonth: varchar("last_allowance_month", { length: 7 }),
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
    // recurring：'weekly' / 'monthly' / null（單次）
    // approve 時若有此值、自動產生下一筆相同任務（dueDate += interval）
    recurringInterval: varchar("recurring_interval", { length: 12 }),
    // 追溯來源：第一個 recurring 任務的 id（同一條 chain）
    recurringParentId: integer("recurring_parent_id"),
    // 小孩 submit 時可附上照片證明（URL）
    proofImageUrl: varchar("proof_image_url", { length: 500 }),
    // 小孩自提任務（家長 approve 才入帳）培養主動性
    proposedByKid: boolean("proposed_by_kid").notNull().default(false),
    // 難度：easy ⭐ / medium ⭐⭐ / hard ⭐⭐⭐
    // 排行榜加權積分：easy=1、medium=2、hard=3
    difficulty: varchar("difficulty", { length: 8 }).notNull().default("medium"),
    // 分類：housework 家事 / study 學習 / self_care 自我照顧 / kindness 善行 / other 其他
    category: varchar("category", { length: 16 }).notNull().default("other"),
    // 小孩 submit 時的描述（「我洗了 2 個碗 + 拖了客廳」）
    submissionNote: text("submission_note"),
    // 家長 approve / reject 時的回饋訊息（「做得很棒 👍」「下次記得擦乾」）
    parentFeedback: text("parent_feedback"),
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
    // 建立時：「為什麼想存錢買這個？」（培養理財意識）
    reflection: text("reflection"),
    // 達成時：「達成感言」（鼓勵記錄努力過程）
    completedReflection: text("completed_reflection"),
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
// 花錢紀錄（小孩自己記）
// ============================================================
export const kidsSpendings = pgTable(
  "kids_spendings",
  {
    id: serial("id").primaryKey(),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kidsAccounts.id, { onDelete: "cascade" }),
    jar: varchar("jar", { length: 8 }).notNull(), // 'spend' / 'save' / 'give'
    amount: decimal("amount", { precision: 8, scale: 2 }).notNull(),
    description: varchar("description", { length: 100 }).notNull(),
    emoji: varchar("emoji", { length: 8 }).default("💰"),
    spendDate: date("spend_date").notNull(),
    // 給罐子用：捐給誰（例：流浪動物協會、學校募款）
    recipient: varchar("recipient", { length: 100 }),
    // 捐獻反思（培養同理心、月報可回顧）
    reflection: text("reflection"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    kidDateIdx: index("kids_spendings_kid_date_idx").on(table.kidId, table.spendDate),
  })
)

// ============================================================
// 任務評論串（家長 + 小孩可多次往來、培養討論文化）
// 跟 submissionNote/parentFeedback 不同：那是一次性、這是 chat-like
// ============================================================
export const kidsTaskComments = pgTable(
  "kids_task_comments",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").default(1),
    taskId: integer("task_id")
      .notNull()
      .references(() => kidsTasks.id, { onDelete: "cascade" }),
    author: varchar("author", { length: 8 }).notNull(), // 'parent' / 'kid'
    message: text("message").notNull(),
    emoji: varchar("emoji", { length: 8 }).default("💬"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    taskIdx: index("kids_task_comments_task_idx").on(table.taskId, table.createdAt),
  })
)

// ============================================================
// 小孩願望清單（想買的東西、未必有錢、跟存錢目標區隔）
// 培養「想要 vs 需要」判斷力：先放清單冷靜思考、確定要再 promote 成 goal
// ============================================================
export const kidsWishes = pgTable(
  "kids_wishes",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").default(1),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kidsAccounts.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 100 }).notNull(),
    emoji: varchar("emoji", { length: 8 }).default("✨"),
    estimatedPrice: decimal("estimated_price", { precision: 10, scale: 2 }),
    // 優先序：1=低 / 2=中 / 3=高（不嚴格、給小孩自己分類）
    priority: integer("priority").notNull().default(2),
    status: varchar("status", { length: 16 }).notNull().default("wished"),
    // wished / promoted_to_goal / abandoned
    promotedGoalId: integer("promoted_goal_id"), // 升級後對應的 kids_goals.id
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    kidIdx: index("kids_wishes_kid_idx").on(table.kidId, table.status),
  })
)

// ============================================================
// 小孩每日心情簽到（培養情緒覺察、家長看孩子情緒軌跡）
// ============================================================
export const kidsCheckins = pgTable(
  "kids_checkins",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").default(1),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kidsAccounts.id, { onDelete: "cascade" }),
    // mood: '😄 開心' / '🙂 還好' / '😐 普通' / '😢 難過' / '😡 生氣'
    mood: varchar("mood", { length: 12 }).notNull(),
    note: text("note"),
    checkinDate: date("checkin_date").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    kidDateIdx: index("kids_checkins_kid_date_idx").on(table.kidId, table.checkinDate),
  })
)

// ============================================================
// 捐贈對象目錄（家長預設常用對象、小孩 give 時下拉選）
// 培養理財認知：知道錢的去向、誰需要幫助
// ============================================================
export const familyRecipients = pgTable(
  "family_recipients",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").default(1),
    name: varchar("name", { length: 100 }).notNull(),
    emoji: varchar("emoji", { length: 8 }).default("❤️"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    familyIdx: index("family_recipients_family_idx").on(table.familyId),
  })
)

// ============================================================
// 家長自訂任務範本收藏（每家庭自己的常用任務模板）
// 跟內建範本 (DAILY_TASK_TEMPLATES / SEASONAL_TASKS) 並存、家長可在 BatchDialog 用
// ============================================================
export const familyTaskTemplates = pgTable(
  "family_task_templates",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").default(1),
    title: varchar("title", { length: 100 }).notNull(),
    emoji: varchar("emoji", { length: 8 }).default("📋"),
    defaultReward: decimal("default_reward", { precision: 8, scale: 2 }).notNull(),
    defaultDifficulty: varchar("default_difficulty", { length: 8 }).notNull().default("medium"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    familyIdx: index("family_task_templates_family_idx").on(table.familyId),
  })
)

// ============================================================
// 家長每日鼓勵卡（每天最多 1 則 per kid）
// 培養情感連結、小孩首頁醒目顯示
// ============================================================
export const kidsDailyMessages = pgTable(
  "kids_daily_messages",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").default(1),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kidsAccounts.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    mood: varchar("mood", { length: 8 }).default("❤️"), // ❤️ / 🌟 / 💪 / 🤗 / 🎉
    messageDate: date("message_date").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    kidDateIdx: index("kids_daily_messages_kid_date_idx").on(table.kidId, table.messageDate),
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
  monthlyAllowance: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, lastAllowanceMonth: true })

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
}).omit({
  id: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  currentAmount: true,
  completedReflection: true, // 只在 save 達成時寫
})

export const insertKidsSpendingSchema = createInsertSchema(kidsSpendings, {
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  jar: z.enum(["spend", "save", "give"]),
}).omit({ id: true, createdAt: true })

// Types
export type KidsAccount = typeof kidsAccounts.$inferSelect
export type InsertKidsAccount = z.infer<typeof insertKidsAccountSchema>
export type KidsJar = typeof kidsJars.$inferSelect
export type KidsTask = typeof kidsTasks.$inferSelect
export type InsertKidsTask = z.infer<typeof insertKidsTaskSchema>
export type KidsGoal = typeof kidsGoals.$inferSelect
export type InsertKidsGoal = z.infer<typeof insertKidsGoalSchema>
export type KidsBadge = typeof kidsBadges.$inferSelect
export type KidsSpending = typeof kidsSpendings.$inferSelect
export type InsertKidsSpending = z.infer<typeof insertKidsSpendingSchema>
export type KidsDailyMessage = typeof kidsDailyMessages.$inferSelect
export type FamilyTaskTemplate = typeof familyTaskTemplates.$inferSelect
export type FamilyRecipient = typeof familyRecipients.$inferSelect
export type KidsCheckin = typeof kidsCheckins.$inferSelect
export type KidsWish = typeof kidsWishes.$inferSelect
export type KidsTaskComment = typeof kidsTaskComments.$inferSelect
