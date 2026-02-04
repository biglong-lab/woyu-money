import { pgTable, text, serial, integer, boolean, decimal, timestamp, date, varchar, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Debt categories - 支援階層分類系統
export const debtCategories = pgTable("debt_categories", {
  id: serial("id").primaryKey(),
  categoryName: varchar("category_name", { length: 255 }).notNull(),
  parentId: integer("parent_id"), // 父分類ID，null表示主分類
  level: integer("level").default(1), // 分類層級：1=主分類，2=子分類
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 分類關聯關係
export const categoriesRelations = relations(debtCategories, ({ one, many }) => ({
  parent: one(debtCategories, {
    fields: [debtCategories.parentId],
    references: [debtCategories.id],
    relationName: "parentCategory",
  }),
  children: many(debtCategories, {
    relationName: "parentCategory",
  }),
}));

// Vendors
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  vendorName: varchar("vendor_name", { length: 255 }).notNull(),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 付款項目標籤系統
export const paymentTags = pgTable("payment_tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#3B82F6"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 專案管理（原廠商轉為專案）
export const paymentProjects = pgTable("payment_projects", {
  id: serial("id").primaryKey(),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  projectType: varchar("project_type", { length: 50 }).notNull().default("general"), // fixed, general
  description: text("description"),
  isActive: boolean("is_active").default(true),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 付款項目（重構的債務表）
export const paymentItems = pgTable("payment_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => debtCategories.id),
  projectId: integer("project_id").references(() => paymentProjects.id),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  itemType: varchar("item_type", { length: 20 }).notNull().default("home"), // home, project
  paymentType: varchar("payment_type", { length: 20 }).notNull().default("single"), // single, recurring, installment
  recurringInterval: varchar("recurring_interval", { length: 20 }), // monthly, quarterly, yearly
  installmentCount: integer("installment_count"),
  installmentAmount: decimal("installment_amount", { precision: 10, scale: 2 }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0.00"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, partial, paid, overdue
  priority: integer("priority").default(1), // 1-5, 5 is highest
  notes: text("notes"),
  tags: jsonb("tags"), // 彈性標籤系統
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 保留原債務表作為相容性
export const debts = pgTable("debts", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => debtCategories.id),
  debtName: varchar("debt_name", { length: 255 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  vendorId: integer("vendor_id").references(() => vendors.id),
  note: text("note"),
  expectedPaymentDate: date("expected_payment_date"),
  installments: integer("installments").default(1),
  paymentType: varchar("payment_type", { length: 20 }).notNull().default("single"), // single or installment
  firstDueDate: date("first_due_date").notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0.00"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, partial, paid
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 付款記錄（新版本）
export const paymentRecords = pgTable("payment_records", {
  id: serial("id").primaryKey(),
  paymentItemId: integer("payment_item_id").notNull().references(() => paymentItems.id),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }), // cash, card, transfer, mobile_pay
  receiptImageUrl: varchar("receipt_image_url", { length: 500 }),
  receiptText: text("receipt_text"), // 手動輸入的單據內容
  isPartialPayment: boolean("is_partial_payment").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 預算規劃
export const budgetPlans = pgTable("budget_plans", {
  id: serial("id").primaryKey(),
  planName: varchar("plan_name", { length: 255 }).notNull(),
  planType: varchar("plan_type", { length: 20 }).notNull(), // home, project
  projectId: integer("project_id").references(() => paymentProjects.id),
  budgetPeriod: varchar("budget_period", { length: 20 }).notNull(), // monthly, quarterly, yearly
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  totalBudget: decimal("total_budget", { precision: 12, scale: 2 }).notNull(),
  actualSpent: decimal("actual_spent", { precision: 12, scale: 2 }).default("0.00"),
  status: varchar("status", { length: 20 }).default("active"), // active, completed, paused
  tags: jsonb("tags"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 預算項目明細
export const budgetItems = pgTable("budget_items", {
  id: serial("id").primaryKey(),
  budgetPlanId: integer("budget_plan_id").notNull().references(() => budgetPlans.id),
  categoryId: integer("category_id").references(() => debtCategories.id),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  plannedAmount: decimal("planned_amount", { precision: 10, scale: 2 }).notNull(),
  actualAmount: decimal("actual_amount", { precision: 10, scale: 2 }).default("0.00"),
  priority: integer("priority").default(1),
  tags: jsonb("tags"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 付款項目與標籤關聯表
export const paymentItemTags = pgTable("payment_item_tags", {
  id: serial("id").primaryKey(),
  paymentItemId: integer("payment_item_id").notNull().references(() => paymentItems.id),
  tagId: integer("tag_id").notNull().references(() => paymentTags.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// 保留原付款記錄表作為相容性
export const debtPayments = pgTable("debt_payments", {
  id: serial("id").primaryKey(),
  debtId: integer("debt_id").notNull().references(() => debts.id),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  receiptFile: varchar("receipt_file", { length: 255 }),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Debt schedule (for installments)
export const debtsSchedule = pgTable("debts_schedule", {
  id: serial("id").primaryKey(),
  debtId: integer("debt_id").notNull().references(() => debts.id),
  installmentNumber: integer("installment_number").notNull(),
  dueDate: date("due_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false),
  paidDate: date("paid_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily records (from the existing system)
export const dailyRecords = pgTable("daily_records_clean", {
  id: serial("id").primaryKey(),
  recordDate: date("record_date").notNull(),
  branchId: integer("branch_id").notNull(),
  roomNumber: varchar("room_number", { length: 50 }),
  platform: varchar("platform", { length: 255 }),
  invoiceLast4: varchar("invoice_last4", { length: 4 }),
  sourceType: varchar("source_type", { length: 50 }),
  sourceId: varchar("source_id", { length: 50 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  paymentMethod: varchar("payment_method", { length: 50 }),
  recordType: varchar("record_type", { length: 20 }).default("income"), // income or expense
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 家庭成員管理
export const familyMembers = pgTable("family_members", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  memberType: varchar("member_type", { length: 20 }).notNull(), // adult, child
  age: integer("age"),
  avatar: varchar("avatar", { length: 255 }),
  voicePassword: varchar("voice_password", { length: 255 }),
  preferences: text("preferences"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 兒童登入帳戶表 - 個別登入系統
export const childAccounts = pgTable("child_accounts", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").references(() => familyMembers.id).notNull(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  pinCode: varchar("pin_code", { length: 6 }).notNull(), // 4-6位數字密碼
  loginAttempts: integer("login_attempts").default(0),
  isLocked: boolean("is_locked").default(false),
  lastLoginAt: timestamp("last_login_at"),
  sessionToken: varchar("session_token", { length: 255 }),
  sessionExpiresAt: timestamp("session_expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 家庭財務管理 - 支出分類
export const familyExpenseCategories = pgTable("family_expense_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'living', 'education', 'travel', 'healthcare', 'entertainment'
  description: text("description"),
  color: varchar("color", { length: 20 }).default("#3B82F6"),
  icon: varchar("icon", { length: 50 }).default("Receipt"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 家庭財務管理 - 支出記錄
export const familyExpenses = pgTable("family_expenses", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => familyExpenseCategories.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  expenseDate: date("expense_date").notNull(),
  location: varchar("location", { length: 255 }),
  vendor: varchar("vendor", { length: 255 }),
  paymentMethod: varchar("payment_method", { length: 50 }), // 'cash', 'card', 'transfer', 'mobile_pay'
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: varchar("recurring_frequency", { length: 50 }), // 'weekly', 'monthly', 'yearly'
  nextRecurringDate: date("next_recurring_date"),
  tags: jsonb("tags"), // 額外標籤
  receiptImageUrl: varchar("receipt_image_url", { length: 500 }),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 小朋友願望清單
export const kidsWishlist = pgTable("kids_wishlist", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").references(() => familyMembers.id),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  itemPrice: decimal("item_price", { precision: 10, scale: 2 }).notNull(),
  priority: integer("priority").default(1),
  targetDate: date("target_date"),
  savedAmount: decimal("saved_amount", { precision: 10, scale: 2 }).default("0"),
  status: varchar("status", { length: 20 }).default("planning"), // planning, saving, achieved
  image: varchar("image", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 小朋友借款記錄
export const kidsLoans = pgTable("kids_loans", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").references(() => familyMembers.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  purpose: varchar("purpose", { length: 255 }).notNull(),
  loanDate: date("loan_date").notNull(),
  repaymentPlan: text("repayment_plan"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  status: varchar("status", { length: 20 }).default("active"), // active, paid, overdue
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 小朋友儲蓄記錄
export const kidsSavings = pgTable("kids_savings", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").references(() => familyMembers.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  source: varchar("source", { length: 100 }).notNull(), // allowance, gift, chore, bonus
  description: varchar("description", { length: 255 }),
  savingDate: date("saving_date").notNull(),
  goalId: integer("goal_id").references(() => kidsWishlist.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// 小朋友時間管理
export const kidsSchedule = pgTable("kids_schedule", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").references(() => familyMembers.id),
  activityName: varchar("activity_name", { length: 100 }).notNull(),
  activityType: varchar("activity_type", { length: 50 }).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  completed: boolean("completed").default(false),
  notes: text("notes"),
  reward: decimal("reward", { precision: 5, scale: 2 }),
  difficulty: integer("difficulty").default(1), // 1-5 for gamification
  createdAt: timestamp("created_at").defaultNow(),
});

// 攤提資料表
export const amortizations = pgTable("amortizations", {
  id: serial("id").primaryKey(),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  projectType: varchar("project_type", { length: 50 }).notNull(), // construction, equipment, etc.
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  amortizationMonths: integer("amortization_months").notNull(),
  monthlyAmount: decimal("monthly_amount", { precision: 10, scale: 2 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  categoryId: integer("category_id").references(() => debtCategories.id),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Financial Education Games
export const educationGames = pgTable("education_games", {
  id: serial("id").primaryKey(),
  gameType: varchar("game_type", { length: 50 }).notNull(), // budgeting, saving, spending, earning
  gameName: varchar("game_name", { length: 100 }).notNull(),
  difficulty: varchar("difficulty", { length: 20 }).notNull().default("beginner"), // beginner, intermediate, advanced
  skillsRequired: jsonb("skills_required"), // ["budgeting", "math", "planning"]
  pointsReward: integer("points_reward").default(10),
  description: text("description"),
  gameConfig: jsonb("game_config"), // game-specific configuration
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Game Progress
export const gameProgress = pgTable("game_progress", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => familyMembers.id),
  gameId: integer("game_id").notNull().references(() => educationGames.id),
  level: integer("level").default(1),
  score: integer("score").default(0),
  bestScore: integer("best_score").default(0),
  timesPlayed: integer("times_played").default(0),
  totalTimeSpent: integer("total_time_spent").default(0), // in seconds
  lastPlayedAt: timestamp("last_played_at"),
  completedChallenges: jsonb("completed_challenges"), // array of challenge IDs
  unlockedFeatures: jsonb("unlocked_features"), // array of unlocked features
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Skills Progression
export const skillsProgress = pgTable("skills_progress", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => familyMembers.id),
  skillType: varchar("skill_type", { length: 50 }).notNull(), // budgeting, saving, math, planning, decision_making
  currentLevel: integer("current_level").default(1),
  experiencePoints: integer("experience_points").default(0),
  totalPracticeTime: integer("total_practice_time").default(0), // in seconds
  strengthAreas: jsonb("strength_areas"), // areas where child excels
  improvementAreas: jsonb("improvement_areas"), // areas needing work
  milestones: jsonb("milestones"), // achieved milestones
  lastPracticeDate: timestamp("last_practice_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Game Sessions
export const gameSessions = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => familyMembers.id),
  gameId: integer("game_id").notNull().references(() => educationGames.id),
  sessionData: jsonb("session_data"), // detailed session data
  score: integer("score").default(0),
  duration: integer("duration").default(0), // in seconds
  skillsEarned: jsonb("skills_earned"), // skills practiced in this session
  mistakes: jsonb("mistakes"), // common mistakes made
  hintsUsed: integer("hints_used").default(0),
  completed: boolean("completed").default(false),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Relations
export const debtCategoriesRelations = relations(debtCategories, ({ many }) => ({
  debts: many(debts),
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
  debts: many(debts),
}));

export const debtsRelations = relations(debts, ({ one, many }) => ({
  category: one(debtCategories, {
    fields: [debts.categoryId],
    references: [debtCategories.id],
  }),
  vendor: one(vendors, {
    fields: [debts.vendorId],
    references: [vendors.id],
  }),
  payments: many(debtPayments),
  schedules: many(debtsSchedule),
}));

export const debtPaymentsRelations = relations(debtPayments, ({ one }) => ({
  debt: one(debts, {
    fields: [debtPayments.debtId],
    references: [debts.id],
  }),
}));

export const debtsScheduleRelations = relations(debtsSchedule, ({ one }) => ({
  debt: one(debts, {
    fields: [debtsSchedule.debtId],
    references: [debts.id],
  }),
}));

// 付款規劃系統關聯關係
export const paymentProjectsRelations = relations(paymentProjects, ({ many }) => ({
  paymentItems: many(paymentItems),
  budgetPlans: many(budgetPlans),
}));

export const paymentItemsRelations = relations(paymentItems, ({ one, many }) => ({
  category: one(debtCategories, {
    fields: [paymentItems.categoryId],
    references: [debtCategories.id],
  }),
  project: one(paymentProjects, {
    fields: [paymentItems.projectId],
    references: [paymentProjects.id],
  }),
  paymentRecords: many(paymentRecords),
  tags: many(paymentItemTags),
}));

export const paymentRecordsRelations = relations(paymentRecords, ({ one }) => ({
  paymentItem: one(paymentItems, {
    fields: [paymentRecords.paymentItemId],
    references: [paymentItems.id],
  }),
}));

export const budgetPlansRelations = relations(budgetPlans, ({ one, many }) => ({
  project: one(paymentProjects, {
    fields: [budgetPlans.projectId],
    references: [paymentProjects.id],
  }),
  budgetItems: many(budgetItems),
}));

export const budgetItemsRelations = relations(budgetItems, ({ one }) => ({
  budgetPlan: one(budgetPlans, {
    fields: [budgetItems.budgetPlanId],
    references: [budgetPlans.id],
  }),
  category: one(debtCategories, {
    fields: [budgetItems.categoryId],
    references: [debtCategories.id],
  }),
}));

export const paymentTagsRelations = relations(paymentTags, ({ many }) => ({
  paymentItems: many(paymentItemTags),
}));

export const paymentItemTagsRelations = relations(paymentItemTags, ({ one }) => ({
  paymentItem: one(paymentItems, {
    fields: [paymentItemTags.paymentItemId],
    references: [paymentItems.id],
  }),
  tag: one(paymentTags, {
    fields: [paymentItemTags.tagId],
    references: [paymentTags.id],
  }),
}));

// 新增資料表關係
export const familyMembersRelations = relations(familyMembers, ({ many }) => ({
  familyExpenses: many(familyExpenses),
  wishlist: many(kidsWishlist),
  loans: many(kidsLoans),
  savings: many(kidsSavings),
  schedule: many(kidsSchedule),
  gameProgress: many(gameProgress),
  skillsProgress: many(skillsProgress),
  gameSessions: many(gameSessions),
}));

export const familyExpenseCategoriesRelations = relations(familyExpenseCategories, ({ many }) => ({
  expenses: many(familyExpenses),
}));

export const familyExpensesRelations = relations(familyExpenses, ({ one }) => ({
  category: one(familyExpenseCategories, {
    fields: [familyExpenses.categoryId],
    references: [familyExpenseCategories.id],
  }),
}));

export const kidsWishlistRelations = relations(kidsWishlist, ({ one, many }) => ({
  child: one(familyMembers, {
    fields: [kidsWishlist.childId],
    references: [familyMembers.id],
  }),
  savings: many(kidsSavings),
}));

export const kidsLoansRelations = relations(kidsLoans, ({ one }) => ({
  child: one(familyMembers, {
    fields: [kidsLoans.childId],
    references: [familyMembers.id],
  }),
}));

export const kidsSavingsRelations = relations(kidsSavings, ({ one }) => ({
  child: one(familyMembers, {
    fields: [kidsSavings.childId],
    references: [familyMembers.id],
  }),
  goal: one(kidsWishlist, {
    fields: [kidsSavings.goalId],
    references: [kidsWishlist.id],
  }),
}));

export const kidsScheduleRelations = relations(kidsSchedule, ({ one }) => ({
  child: one(familyMembers, {
    fields: [kidsSchedule.childId],
    references: [familyMembers.id],
  }),
}));

// 零用錢管理
export const allowanceManagement = pgTable("allowance_management", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").references(() => familyMembers.id).notNull(),
  parentId: integer("parent_id").references(() => familyMembers.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: varchar("frequency", { length: 50 }).notNull(), // 'weekly', 'monthly', 'custom'
  nextPaymentDate: timestamp("next_payment_date").notNull(),
  isActive: boolean("is_active").default(true),
  conditions: text("conditions"), // 條件說明
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 零用錢發放記錄
export const allowancePayments = pgTable("allowance_payments", {
  id: serial("id").primaryKey(),
  allowanceId: integer("allowance_id").references(() => allowanceManagement.id).notNull(),
  childId: integer("child_id").references(() => familyMembers.id).notNull(),
  parentId: integer("parent_id").references(() => familyMembers.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").defaultNow(),
  status: varchar("status", { length: 50 }).default("completed"), // 'pending', 'completed', 'cancelled'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 借錢申請管理
export const loanRequests = pgTable("loan_requests", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").references(() => familyMembers.id).notNull(),
  parentId: integer("parent_id").references(() => familyMembers.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  purpose: text("purpose").notNull(),
  requestDate: timestamp("request_date").defaultNow(),
  approvedDate: timestamp("approved_date"),
  dueDate: timestamp("due_date"),
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'approved', 'rejected', 'repaid'
  approvalNotes: text("approval_notes"),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).default("0"),
  repaymentPlan: text("repayment_plan"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 專案管理系統
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 100 }).notNull(), // 'home_renovation', 'travel', 'education', 'investment', 'other'
  status: varchar("status", { length: 50 }).default("planning"), // 'planning', 'active', 'on_hold', 'completed', 'cancelled'
  priority: varchar("priority", { length: 20 }).default("medium"), // 'low', 'medium', 'high', 'urgent'
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  estimatedBudget: decimal("estimated_budget", { precision: 12, scale: 2 }),
  actualBudget: decimal("actual_budget", { precision: 12, scale: 2 }).default("0"),
  createdBy: integer("created_by").references(() => familyMembers.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 專案筆記與計劃
export const projectNotes = pgTable("project_notes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id).notNull(),
  authorId: integer("author_id").references(() => familyMembers.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 100 }).default("general"), // 'general', 'budget', 'research', 'timeline', 'ideas'
  tags: text("tags"), // 用逗號分隔的標籤
  isPublic: boolean("is_public").default(true), // 是否對所有家庭成員可見
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 專案預算項目
export const projectBudgetItems = pgTable("project_budget_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }).notNull(),
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }).default("0"),
  vendor: varchar("vendor", { length: 255 }),
  status: varchar("status", { length: 50 }).default("planned"), // 'planned', 'quoted', 'approved', 'purchased', 'completed'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 專案任務
export const projectTasks = pgTable("project_tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id).notNull(),
  assignedTo: integer("assigned_to").references(() => familyMembers.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("todo"), // 'todo', 'in_progress', 'completed', 'cancelled'
  priority: varchar("priority", { length: 20 }).default("medium"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 專案協作與意見 - 需要在此處定義自我引用
export const projectComments = pgTable("project_comments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id).notNull(),
  authorId: integer("author_id").references(() => familyMembers.id).notNull(),
  content: text("content").notNull(),
  type: varchar("type", { length: 50 }).default("comment"), // 'comment', 'suggestion', 'concern', 'approval'
  parentCommentId: integer("parent_comment_id"), // 回覆功能 - 將在relations中定義
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 成就系統
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 100 }),
  type: varchar("type", { length: 100 }).notNull(), // 'saving', 'task', 'education', 'goal'
  criteria: jsonb("criteria").notNull(), // 成就條件的JSON
  points: integer("points").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// 小朋友成就記錄
export const kidsAchievements = pgTable("kids_achievements", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").references(() => familyMembers.id).notNull(),
  achievementId: integer("achievement_id").references(() => achievements.id).notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
  progress: jsonb("progress"), // 進度追蹤
});

// 家長審核記錄
export const parentApprovals = pgTable("parent_approvals", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").references(() => familyMembers.id).notNull(),
  childId: integer("child_id").references(() => familyMembers.id).notNull(),
  requestType: varchar("request_type", { length: 100 }).notNull(), // 'loan', 'wishlist_purchase', 'task_completion'
  requestId: integer("request_id").notNull(), // 對應的請求ID
  action: varchar("action", { length: 50 }).notNull(), // 'approved', 'rejected', 'pending'
  notes: text("notes"),
  processedAt: timestamp("processed_at").defaultNow(),
});



// 家庭財務管理 - 預算計劃
export const familyBudgets = pgTable("family_budgets", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => familyExpenseCategories.id),
  name: varchar("name", { length: 255 }).notNull(),
  budgetType: varchar("budget_type", { length: 50 }).notNull(), // 'monthly', 'yearly', 'project'
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  spentAmount: decimal("spent_amount", { precision: 12, scale: 2 }).default("0.00"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  description: text("description"),
  alertThreshold: integer("alert_threshold").default(80), // 警告閾值百分比
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 家庭財務管理 - 理財目標
export const familyGoals = pgTable("family_goals", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 12, scale: 2 }).default("0.00"),
  category: varchar("category", { length: 100 }).notNull(), // 'education', 'travel', 'emergency', 'retirement', 'home'
  priority: varchar("priority", { length: 20 }).default("medium"), // 'low', 'medium', 'high'
  targetDate: date("target_date"),
  status: varchar("status", { length: 50 }).default("active"), // 'active', 'completed', 'paused', 'cancelled'
  monthlyContribution: decimal("monthly_contribution", { precision: 10, scale: 2 }),
  autoSave: boolean("auto_save").default(false),
  imageUrl: varchar("image_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 家庭財務管理 - 收入記錄
export const familyIncome = pgTable("family_income", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  source: varchar("source", { length: 255 }).notNull(), // 'salary', 'business', 'investment', 'bonus', 'other'
  incomeDate: date("income_date").notNull(),
  description: text("description"),
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: varchar("recurring_frequency", { length: 50 }),
  nextRecurringDate: date("next_recurring_date"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0.00"),
  netAmount: decimal("net_amount", { precision: 12, scale: 2 }).notNull(),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 新增關係
export const allowanceManagementRelations = relations(allowanceManagement, ({ one, many }) => ({
  child: one(familyMembers, {
    fields: [allowanceManagement.childId],
    references: [familyMembers.id],
  }),
  parent: one(familyMembers, {
    fields: [allowanceManagement.parentId],
    references: [familyMembers.id],
  }),
  payments: many(allowancePayments),
}));

export const allowancePaymentsRelations = relations(allowancePayments, ({ one }) => ({
  allowance: one(allowanceManagement, {
    fields: [allowancePayments.allowanceId],
    references: [allowanceManagement.id],
  }),
  child: one(familyMembers, {
    fields: [allowancePayments.childId],
    references: [familyMembers.id],
  }),
  parent: one(familyMembers, {
    fields: [allowancePayments.parentId],
    references: [familyMembers.id],
  }),
}));

export const loanRequestsRelations = relations(loanRequests, ({ one }) => ({
  child: one(familyMembers, {
    fields: [loanRequests.childId],
    references: [familyMembers.id],
  }),
  parent: one(familyMembers, {
    fields: [loanRequests.parentId],
    references: [familyMembers.id],
  }),
}));

export const achievementsRelations = relations(achievements, ({ many }) => ({
  kidsAchievements: many(kidsAchievements),
}));

export const kidsAchievementsRelations = relations(kidsAchievements, ({ one }) => ({
  child: one(familyMembers, {
    fields: [kidsAchievements.childId],
    references: [familyMembers.id],
  }),
  achievement: one(achievements, {
    fields: [kidsAchievements.achievementId],
    references: [achievements.id],
  }),
}));

export const parentApprovalsRelations = relations(parentApprovals, ({ one }) => ({
  parent: one(familyMembers, {
    fields: [parentApprovals.parentId],
    references: [familyMembers.id],
  }),
  child: one(familyMembers, {
    fields: [parentApprovals.childId],
    references: [familyMembers.id],
  }),
}));

export const amortizationsRelations = relations(amortizations, ({ one }) => ({
  category: one(debtCategories, {
    fields: [amortizations.categoryId],
    references: [debtCategories.id],
  }),
}));

// Education Games Relations
export const educationGamesRelations = relations(educationGames, ({ many }) => ({
  gameProgress: many(gameProgress),
  gameSessions: many(gameSessions),
}));

export const gameProgressRelations = relations(gameProgress, ({ one }) => ({
  child: one(familyMembers, {
    fields: [gameProgress.childId],
    references: [familyMembers.id],
  }),
  game: one(educationGames, {
    fields: [gameProgress.gameId],
    references: [educationGames.id],
  }),
}));

export const skillsProgressRelations = relations(skillsProgress, ({ one }) => ({
  child: one(familyMembers, {
    fields: [skillsProgress.childId],
    references: [familyMembers.id],
  }),
}));

export const gameSessionsRelations = relations(gameSessions, ({ one }) => ({
  child: one(familyMembers, {
    fields: [gameSessions.childId],
    references: [familyMembers.id],
  }),
  game: one(educationGames, {
    fields: [gameSessions.gameId],
    references: [educationGames.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDebtCategorySchema = createInsertSchema(debtCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDebtSchema = createInsertSchema(debts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDebtSchema = createInsertSchema(debts).omit({
  id: true,
  createdAt: true,
}).partial();

export const insertDebtPaymentSchema = createInsertSchema(debtPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDebtsScheduleSchema = createInsertSchema(debtsSchedule).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDailyRecordSchema = createInsertSchema(dailyRecords).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type DebtCategory = typeof debtCategories.$inferSelect;
export type InsertDebtCategory = z.infer<typeof insertDebtCategorySchema>;

export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;

export type Debt = typeof debts.$inferSelect;
export type InsertDebt = z.infer<typeof insertDebtSchema>;

export type DebtPayment = typeof debtPayments.$inferSelect;
export type InsertDebtPayment = z.infer<typeof insertDebtPaymentSchema>;

export type DebtsSchedule = typeof debtsSchedule.$inferSelect;
export type InsertDebtsSchedule = z.infer<typeof insertDebtsScheduleSchema>;

export type DailyRecord = typeof dailyRecords.$inferSelect;
export type InsertDailyRecord = z.infer<typeof insertDailyRecordSchema>;

// 新增資料表的 Schemas
export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyExpenseCategorySchema = createInsertSchema(familyExpenseCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyExpenseSchema = createInsertSchema(familyExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyBudgetSchema = createInsertSchema(familyBudgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyGoalSchema = createInsertSchema(familyGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyIncomeSchema = createInsertSchema(familyIncome).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKidsWishlistSchema = createInsertSchema(kidsWishlist).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKidsLoanSchema = createInsertSchema(kidsLoans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKidsSavingSchema = createInsertSchema(kidsSavings).omit({
  id: true,
  createdAt: true,
});

export const insertKidsScheduleSchema = createInsertSchema(kidsSchedule).omit({
  id: true,
  createdAt: true,
});

export const insertAmortizationSchema = createInsertSchema(amortizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 新增資料表的 Types
export type FamilyMember = typeof familyMembers.$inferSelect;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;

export type FamilyExpenseCategory = typeof familyExpenseCategories.$inferSelect;
export type InsertFamilyExpenseCategory = z.infer<typeof insertFamilyExpenseCategorySchema>;

export type FamilyExpense = typeof familyExpenses.$inferSelect;
export type InsertFamilyExpense = z.infer<typeof insertFamilyExpenseSchema>;

export type KidsWishlist = typeof kidsWishlist.$inferSelect;
export type InsertKidsWishlist = z.infer<typeof insertKidsWishlistSchema>;

export type KidsLoan = typeof kidsLoans.$inferSelect;
export type InsertKidsLoan = z.infer<typeof insertKidsLoanSchema>;

export type KidsSaving = typeof kidsSavings.$inferSelect;
export type InsertKidsSaving = z.infer<typeof insertKidsSavingSchema>;

export type KidsSchedule = typeof kidsSchedule.$inferSelect;
export type InsertKidsSchedule = z.infer<typeof insertKidsScheduleSchema>;

export type Amortization = typeof amortizations.$inferSelect;
export type InsertAmortization = z.infer<typeof insertAmortizationSchema>;

// 家長管理功能的 Schemas
export const insertAllowanceManagementSchema = createInsertSchema(allowanceManagement).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAllowancePaymentSchema = createInsertSchema(allowancePayments).omit({
  id: true,
  createdAt: true,
});

export const insertLoanRequestSchema = createInsertSchema(loanRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});

export const insertKidsAchievementSchema = createInsertSchema(kidsAchievements).omit({
  id: true,
  unlockedAt: true,
});

export const insertParentApprovalSchema = createInsertSchema(parentApprovals).omit({
  id: true,
  processedAt: true,
});

// 家長管理功能的 Types
export type AllowanceManagement = typeof allowanceManagement.$inferSelect;
export type InsertAllowanceManagement = z.infer<typeof insertAllowanceManagementSchema>;

export type AllowancePayment = typeof allowancePayments.$inferSelect;
export type InsertAllowancePayment = z.infer<typeof insertAllowancePaymentSchema>;

export type LoanRequest = typeof loanRequests.$inferSelect;
export type InsertLoanRequest = z.infer<typeof insertLoanRequestSchema>;

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;

export type KidsAchievement = typeof kidsAchievements.$inferSelect;
export type InsertKidsAchievement = z.infer<typeof insertKidsAchievementSchema>;

export type ParentApproval = typeof parentApprovals.$inferSelect;
export type InsertParentApproval = z.infer<typeof insertParentApprovalSchema>;

// Project Management Types
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type InsertProjectTask = typeof projectTasks.$inferInsert;
export type ProjectBudgetItem = typeof projectBudgetItems.$inferSelect;
export type InsertProjectBudgetItem = typeof projectBudgetItems.$inferInsert;
export type ProjectNote = typeof projectNotes.$inferSelect;
export type InsertProjectNote = typeof projectNotes.$inferInsert;
export type ProjectComment = typeof projectComments.$inferSelect;
export type InsertProjectComment = typeof projectComments.$inferInsert;

// 家庭財務管理系統的 Types
export type FamilyBudget = typeof familyBudgets.$inferSelect;
export type InsertFamilyBudget = z.infer<typeof insertFamilyBudgetSchema>;

export type FamilyGoal = typeof familyGoals.$inferSelect;
export type InsertFamilyGoal = z.infer<typeof insertFamilyGoalSchema>;

export type FamilyIncome = typeof familyIncome.$inferSelect;
export type InsertFamilyIncome = z.infer<typeof insertFamilyIncomeSchema>;

// Education Games Schemas
export const insertEducationGameSchema = createInsertSchema(educationGames).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGameProgressSchema = createInsertSchema(gameProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSkillsProgressSchema = createInsertSchema(skillsProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGameSessionSchema = createInsertSchema(gameSessions).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

// Education Games Types
export type EducationGame = typeof educationGames.$inferSelect;
export type InsertEducationGame = z.infer<typeof insertEducationGameSchema>;

export type GameProgress = typeof gameProgress.$inferSelect;
export type InsertGameProgress = z.infer<typeof insertGameProgressSchema>;

export type SkillsProgress = typeof skillsProgress.$inferSelect;
export type InsertSkillsProgress = z.infer<typeof insertSkillsProgressSchema>;

export type GameSession = typeof gameSessions.$inferSelect;
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;

// ==================== 家用財務管理系統 ====================
// 使用獨立的家用分類，一對一的預算管理結構

// 家用預算規劃 - 使用獨立的家用分類
export const householdBudgets = pgTable("household_budgets", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => householdCategories.id).notNull(),
  budgetAmount: decimal("budget_amount", { precision: 12, scale: 2 }).notNull(),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM格式
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 家用實際花費記錄 - 使用獨立的家用分類
export const householdExpenses = pgTable("household_expenses", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => householdCategories.id).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  receiptImage: varchar("receipt_image", { length: 500 }),
  receiptText: text("receipt_text"),
  tags: jsonb("tags"), // 標籤ID陣列
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash"), // cash, card, transfer, mobile_pay
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================== 專案預算管理系統 ====================
// 每個專案有獨立的預算管理，支援多專案

// 專案預算規劃 - 每個專案獨立編列預算
export const projectBudgets = pgTable("project_budgets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => paymentProjects.id).notNull(),
  categoryId: integer("category_id").references(() => projectCategories.id).notNull(),
  budgetAmount: decimal("budget_amount", { precision: 12, scale: 2 }).notNull(),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM格式
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 專案實際花費記錄 - 連結到專案和專案分類
export const projectExpenses = pgTable("project_expenses", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => paymentProjects.id).notNull(),
  categoryId: integer("category_id").references(() => projectCategories.id).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  receiptImage: varchar("receipt_image", { length: 500 }),
  receiptText: text("receipt_text"),
  tags: jsonb("tags"), // 標籤ID陣列
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash"), // cash, card, transfer, mobile_pay
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema definitions for household finance
export const insertHouseholdBudgetSchema = z.object({
  categoryId: z.coerce.number(),
  budgetAmount: z.string(),
  month: z.string(),
  notes: z.string().optional(),
});

export const insertHouseholdExpenseSchema = createInsertSchema(householdExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema definitions for project finance
export const insertProjectBudgetSchema = createInsertSchema(projectBudgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectExpenseSchema = createInsertSchema(projectExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for household finance
export type HouseholdBudget = typeof householdBudgets.$inferSelect;
export type InsertHouseholdBudget = z.infer<typeof insertHouseholdBudgetSchema>;

export type HouseholdExpense = typeof householdExpenses.$inferSelect;
export type InsertHouseholdExpense = z.infer<typeof insertHouseholdExpenseSchema>;

// Types for project finance
export type ProjectBudget = typeof projectBudgets.$inferSelect;
export type InsertProjectBudget = z.infer<typeof insertProjectBudgetSchema>;

export type ProjectExpense = typeof projectExpenses.$inferSelect;
export type InsertProjectExpense = z.infer<typeof insertProjectExpenseSchema>;

// 付款規劃系統的 Schemas
export const insertPaymentTagSchema = createInsertSchema(paymentTags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentProjectSchema = createInsertSchema(paymentProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentItemSchema = createInsertSchema(paymentItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentRecordSchema = createInsertSchema(paymentRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBudgetPlanSchema = createInsertSchema(budgetPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBudgetItemSchema = createInsertSchema(budgetItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentItemTagSchema = createInsertSchema(paymentItemTags).omit({
  id: true,
  createdAt: true,
});

// 付款規劃系統的 Types
export type PaymentTag = typeof paymentTags.$inferSelect;
export type InsertPaymentTag = z.infer<typeof insertPaymentTagSchema>;

export type PaymentProject = typeof paymentProjects.$inferSelect;
export type InsertPaymentProject = z.infer<typeof insertPaymentProjectSchema>;

export type PaymentItem = typeof paymentItems.$inferSelect;
export type InsertPaymentItem = z.infer<typeof insertPaymentItemSchema>;

export type PaymentRecord = typeof paymentRecords.$inferSelect;
export type InsertPaymentRecord = z.infer<typeof insertPaymentRecordSchema>;

export type BudgetPlan = typeof budgetPlans.$inferSelect;
export type InsertBudgetPlan = z.infer<typeof insertBudgetPlanSchema>;

export type BudgetItem = typeof budgetItems.$inferSelect;
export type InsertBudgetItem = z.infer<typeof insertBudgetItemSchema>;

export type PaymentItemTag = typeof paymentItemTags.$inferSelect;
export type InsertPaymentItemTag = z.infer<typeof insertPaymentItemTagSchema>;

// ==================== 獨立分類系統 ====================

// 家用分類 - 獨立的家用財務分類系統
export const householdCategories = pgTable("household_categories", {
  id: serial("id").primaryKey(),
  categoryName: varchar("category_name", { length: 255 }).notNull(),
  parentId: integer("parent_id"), // 父分類ID，null表示主分類
  level: integer("level").default(1), // 分類層級：1=主分類，2=子分類
  color: varchar("color", { length: 20 }).default("#3B82F6"),
  icon: varchar("icon", { length: 50 }).default("Receipt"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 專案分類 - 獨立的專案管理分類系統
export const projectCategories = pgTable("project_categories", {
  id: serial("id").primaryKey(),
  categoryName: varchar("category_name", { length: 255 }).notNull(),
  parentId: integer("parent_id"), // 父分類ID，null表示主分類
  level: integer("level").default(1), // 分類層級：1=主分類，2=子分類
  color: varchar("color", { length: 20 }).default("#10B981"),
  icon: varchar("icon", { length: 50 }).default("FolderOpen"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 家用分類關聯關係
export const householdCategoriesRelations = relations(householdCategories, ({ one, many }) => ({
  parent: one(householdCategories, {
    fields: [householdCategories.parentId],
    references: [householdCategories.id],
    relationName: "householdParentCategory",
  }),
  children: many(householdCategories, {
    relationName: "householdParentCategory",
  }),
}));

// 專案分類關聯關係
export const projectCategoriesRelations = relations(projectCategories, ({ one, many }) => ({
  parent: one(projectCategories, {
    fields: [projectCategories.parentId],
    references: [projectCategories.id],
    relationName: "projectParentCategory",
  }),
  children: many(projectCategories, {
    relationName: "projectParentCategory",
  }),
}));

// 獨立分類系統的 Schemas
export const insertHouseholdCategorySchema = createInsertSchema(householdCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectCategorySchema = createInsertSchema(projectCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 獨立分類系統的 Types
export type HouseholdCategory = typeof householdCategories.$inferSelect;
export type InsertHouseholdCategory = z.infer<typeof insertHouseholdCategorySchema>;

export type ProjectCategory = typeof projectCategories.$inferSelect;
export type InsertProjectCategory = z.infer<typeof insertProjectCategorySchema>;
