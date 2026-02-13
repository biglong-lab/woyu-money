import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// 使用者表 - 含 LINE 登入支援
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).unique(),
  password: varchar("password", { length: 255 }),
  email: varchar("email", { length: 100 }),
  fullName: varchar("full_name", { length: 100 }),
  role: varchar("role", { length: 20 }).default("user"),
  isActive: boolean("is_active").default(true),
  menuPermissions: jsonb("menu_permissions").default({}),
  lastLogin: timestamp("last_login"),
  lineUserId: varchar("line_user_id", { length: 100 }).unique(),
  lineDisplayName: varchar("line_display_name", { length: 100 }),
  linePictureUrl: varchar("line_picture_url", { length: 500 }),
  lineEmail: varchar("line_email", { length: 100 }),
  authProvider: varchar("auth_provider", { length: 20 }).default("local"),
  emailVerified: boolean("email_verified").default(false),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// LINE 設定表
export const lineConfigs = pgTable("line_configs", {
  id: serial("id").primaryKey(),
  channelId: varchar("channel_id", { length: 255 }),
  channelSecret: varchar("channel_secret", { length: 255 }),
  callbackUrl: varchar("callback_url", { length: 500 }),
  isEnabled: boolean("is_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 通知表
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium"),
  isRead: boolean("is_read").default(false),
  actionUrl: varchar("action_url", { length: 500 }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
  expiresAt: timestamp("expires_at"),
});

// 通知設定表
export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  emailEnabled: boolean("email_enabled").default(true),
  lineEnabled: boolean("line_enabled").default(false),
  browserEnabled: boolean("browser_enabled").default(true),
  paymentDueReminder: boolean("payment_due_reminder").default(true),
  paymentOverdueAlert: boolean("payment_overdue_alert").default(true),
  systemUpdates: boolean("system_updates").default(false),
  weeklyReport: boolean("weekly_report").default(true),
  dailyDigestTime: varchar("daily_digest_time", { length: 5 }).default("09:00"),
  weeklyReportDay: varchar("weekly_report_day", { length: 10 }).default("monday"),
  advanceWarningDays: integer("advance_warning_days").default(3),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Session 儲存
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
}, (table) => [
  index("IDX_session_expire").on(table.expire)
]);

// 稽核日誌
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tableName: varchar("table_name", { length: 50 }).notNull(),
  recordId: integer("record_id").notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  changedFields: text("changed_fields").array(),
  userId: integer("user_id"),
  userInfo: varchar("user_info", { length: 255 }),
  changeReason: text("change_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 角色選單權限介面
export interface MenuPermissions {
  payment?: boolean;
  loanInvestment?: boolean;
  household?: boolean;
  reports?: boolean;
  system?: boolean;
  templates?: boolean;
  other?: boolean;
}

// 各角色預設權限
export const DEFAULT_PERMISSIONS: Record<string, MenuPermissions> = {
  admin: {
    payment: true,
    loanInvestment: true,
    household: true,
    reports: true,
    system: true,
    templates: true,
    other: true,
  },
  user1: {
    payment: true,
    loanInvestment: true,
    household: true,
    reports: true,
    system: false,
    templates: false,
    other: true,
  },
  user2: {
    payment: false,
    loanInvestment: false,
    household: true,
    reports: false,
    system: false,
    templates: false,
    other: false,
  },
};

// 驗證 Schema
export const updateUserSchema = createInsertSchema(users).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  password: z.string().min(8, "密碼至少需要8個字符").optional(),
  email: z.string().email("無效的電子郵件地址").optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1, "請輸入用戶名"),
  password: z.string().min(1, "請輸入密碼"),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertLineConfigSchema = createInsertSchema(lineConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 型別匯出
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = typeof notificationSettings.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type LineConfig = typeof lineConfigs.$inferSelect;
export type InsertLineConfig = z.infer<typeof insertLineConfigSchema>;
