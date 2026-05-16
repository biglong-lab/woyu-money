/**
 * 整合 API Key（read-only）
 *
 * 用途：給對接方程式化 fetch 規範文件（spec / openapi）使用。
 * 設計原則：
 * - read-only：只能讀規範，不能寫任何資料
 * - per-token：每個對接方 / 系統一把 key，可獨立撤銷
 * - 不可恢復：產生時一次顯示完整 key、之後只保 prefix（前 8 碼）供辨識
 * - bcrypt hash：DB 只存 hash、避免外洩
 *
 * Key 格式：`moneykey_` + 32 字元隨機（base62）
 * 例：`moneykey_aB3xK7mP2qR9tY6wL4nE8jH5dF1sV0gC`
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

export const integrationApiKeys = pgTable(
  "integration_api_keys",
  {
    id: serial("id").primaryKey(),

    /** 給管理員辨識用的名稱（例：「PM 系統 / 對接 Alice」）*/
    name: varchar("name", { length: 100 }).notNull(),

    /** Key 前綴 8 碼（含 `moneykey_` 後的前 8 字元）— 供 UI 顯示辨識 */
    keyPrefix: varchar("key_prefix", { length: 30 }).notNull(),

    /** bcrypt 過的完整 key（無法反推）*/
    keyHash: varchar("key_hash", { length: 255 }).notNull(),

    /** Scope（目前只支援 `spec:read`，未來可擴展）*/
    scope: varchar("scope", { length: 50 }).notNull().default("spec:read"),

    /** 對接方說明 / 用途備註 */
    description: text("description"),

    /** 過期時間（null 表示永不過期）*/
    expiresAt: timestamp("expires_at"),

    /** 最後使用時間（用於追蹤是否還在用）*/
    lastUsedAt: timestamp("last_used_at"),

    /** 最後使用 IP（用於異常偵測）*/
    lastUsedIp: varchar("last_used_ip", { length: 45 }),

    /** 累計使用次數 */
    usageCount: integer("usage_count").default(0),

    /** 是否啟用（撤銷 = isActive=false，不刪除以保留稽核）*/
    isActive: boolean("is_active").default(true),

    /** 建立者 user_id（不做 FK 避免循環）*/
    createdByUserId: integer("created_by_user_id"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    prefixIdx: index("integration_api_keys_prefix_idx").on(table.keyPrefix),
    isActiveIdx: index("integration_api_keys_is_active_idx").on(table.isActive),
    // prefix 應該唯一（隨機產生極低碰撞機率，但加保險）
    prefixUniq: unique("integration_api_keys_prefix_uniq").on(table.keyPrefix),
  })
)

// Zod schema
export const insertIntegrationApiKeySchema = createInsertSchema(integrationApiKeys)
  .omit({
    id: true,
    keyPrefix: true,
    keyHash: true,
    lastUsedAt: true,
    lastUsedIp: true,
    usageCount: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    expiresAt: z.string().datetime().optional().or(z.literal("")),
  })

export type IntegrationApiKey = typeof integrationApiKeys.$inferSelect
export type InsertIntegrationApiKey = z.infer<typeof insertIntegrationApiKeySchema>
