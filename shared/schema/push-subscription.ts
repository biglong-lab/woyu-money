/**
 * Web Push 訂閱
 *
 * 每個使用者 device/browser 一筆，存 PushSubscription 的 endpoint + keys。
 * 後端用 web-push library 透過 endpoint 推送訊息。
 */
import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  varchar,
  index,
  unique,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),

    userId: integer("user_id").notNull(),

    /** PushSubscription.endpoint（URL）*/
    endpoint: text("endpoint").notNull(),

    /** PushSubscription.keys.p256dh（base64url）*/
    p256dh: varchar("p256dh", { length: 255 }).notNull(),

    /** PushSubscription.keys.auth（base64url）*/
    auth: varchar("auth", { length: 100 }).notNull(),

    /** User-Agent 字串（辨識裝置）*/
    userAgent: text("user_agent"),

    /** 標籤偏好設定（之後可細分通知類別）*/
    enabledTopics: text("enabled_topics").default("all"),
    // "all" | "urgent" | "none" | comma-separated list

    isActive: boolean("is_active").default(true),
    lastUsedAt: timestamp("last_used_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("push_subscriptions_user_id_idx").on(table.userId),
    endpointIdx: index("push_subscriptions_endpoint_idx").on(table.endpoint),
    // 同一 endpoint 只一筆（同裝置重複訂閱會 upsert）
    endpointUniq: unique("push_subscriptions_endpoint_uniq").on(table.endpoint),
  })
)

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions)
  .omit({ id: true, createdAt: true, updatedAt: true, lastUsedAt: true })
  .extend({
    endpoint: z.string().url(),
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  })

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>
