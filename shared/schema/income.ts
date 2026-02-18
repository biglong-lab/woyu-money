import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  decimal,
  timestamp,
  varchar,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"
import { paymentProjects } from "./category"
import { debtCategories } from "./category"
import { paymentItems, paymentRecords } from "./payment"

// ─────────────────────────────────────────────
// 進帳來源設定表
// 管理哪些外部系統可以接入、如何驗證、如何轉換資料
// ─────────────────────────────────────────────
export const incomeSources = pgTable(
  "income_sources",
  {
    id: serial("id").primaryKey(),

    // 顯示名稱與識別
    sourceName: varchar("source_name", { length: 100 }).notNull(),
    sourceKey: varchar("source_key", { length: 50 }).notNull(), // URL 路徑識別碼，如 linepay / airbnb
    sourceType: varchar("source_type", { length: 30 }).notNull().default("custom"),
    // sourceType 可選值：linepay | jkopay | airbnb | booking | custom_api | manual

    description: text("description"),

    // 驗證方式（雙重支援）
    authType: varchar("auth_type", { length: 20 }).notNull().default("token"),
    // authType 可選值：token | hmac | both
    webhookSecret: varchar("webhook_secret", { length: 255 }), // HMAC-SHA256 密鑰
    apiToken: varchar("api_token", { length: 255 }),            // Bearer Token

    // 白名單 IP（可選，JSON 陣列）
    allowedIps: jsonb("allowed_ips").default([]),

    // 預設歸類設定
    defaultProjectId: integer("default_project_id").references(() => paymentProjects.id),
    defaultCategoryId: integer("default_category_id").references(() => debtCategories.id),

    // 欄位對應（JSONPath 格式）
    // 範例：{ "amount": "$.transaction.amount", "paidAt": "$.completedAt" }
    fieldMapping: jsonb("field_mapping").notNull().default({}),

    // 幣別設定
    defaultCurrency: varchar("default_currency", { length: 10 }).notNull().default("TWD"),
    // 幣別換算設定，null 表示不做換算
    currencyConversionEnabled: boolean("currency_conversion_enabled").default(false),

    // 行為設定
    isActive: boolean("is_active").default(true),
    autoConfirm: boolean("auto_confirm").default(false), // false = 需人工確認（批次）

    // 統計（方便查看）
    totalReceived: integer("total_received").default(0), // 累計接收筆數
    lastReceivedAt: timestamp("last_received_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    sourceKeyUniq: unique("income_sources_source_key_uniq").on(table.sourceKey),
    isActiveIdx: index("income_sources_is_active_idx").on(table.isActive),
  })
)

// ─────────────────────────────────────────────
// 原始進帳紀錄表
// 儲存從外部系統進來的每一筆原始資料，可追溯、可重播
// ─────────────────────────────────────────────
export const incomeWebhooks = pgTable(
  "income_webhooks",
  {
    id: serial("id").primaryKey(),

    // 來源
    sourceId: integer("source_id")
      .notNull()
      .references(() => incomeSources.id),

    // 外部系統的唯一交易ID（防重複進帳）
    externalTransactionId: varchar("external_transaction_id", { length: 255 }),

    // 原始資料完整保存（可重新解析）
    rawPayload: jsonb("raw_payload").notNull(),

    // 解析後的標準化資料
    parsedAmount: decimal("parsed_amount", { precision: 12, scale: 2 }),
    parsedCurrency: varchar("parsed_currency", { length: 10 }).default("TWD"),
    parsedAmountTwd: decimal("parsed_amount_twd", { precision: 12, scale: 2 }), // 換算後台幣
    exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }),         // 使用的匯率
    parsedDescription: text("parsed_description"),
    parsedPaidAt: timestamp("parsed_paid_at"),
    parsedPayerName: varchar("parsed_payer_name", { length: 255 }),
    parsedPayerContact: varchar("parsed_payer_contact", { length: 255 }), // email/phone
    parsedOrderId: varchar("parsed_order_id", { length: 255 }), // 訂單號

    // 驗證結果
    signatureValid: boolean("signature_valid").default(true),

    // 處理狀態
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // status 可選值：pending | confirmed | rejected | duplicate | error

    // 人工操作
    reviewedByUserId: integer("reviewed_by_user_id"),
    reviewedAt: timestamp("reviewed_at"),
    reviewNote: text("review_note"),

    // 確認後連結的系統記錄
    linkedItemId: integer("linked_item_id").references(() => paymentItems.id),
    linkedRecordId: integer("linked_record_id").references(() => paymentRecords.id),

    processedAt: timestamp("processed_at"),
    errorMessage: text("error_message"),

    // 請求 metadata
    requestIp: varchar("request_ip", { length: 45 }),
    requestHeaders: jsonb("request_headers").default({}),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    sourceIdIdx: index("income_webhooks_source_id_idx").on(table.sourceId),
    statusIdx: index("income_webhooks_status_idx").on(table.status),
    createdAtIdx: index("income_webhooks_created_at_idx").on(table.createdAt),
    parsedPaidAtIdx: index("income_webhooks_paid_at_idx").on(table.parsedPaidAt),
    // externalTransactionId + sourceId 聯合唯一（防同來源重複）
    externalTxUniq: unique("income_webhooks_external_tx_uniq").on(
      table.sourceId,
      table.externalTransactionId
    ),
  })
)

// ─────────────────────────────────────────────
// Zod 驗證 Schema
// ─────────────────────────────────────────────

// 欄位對應設定的型別
export const fieldMappingSchema = z.object({
  amount: z.string().optional(),          // JSONPath 取金額
  currency: z.string().optional(),        // JSONPath 取幣別
  transactionId: z.string().optional(),   // JSONPath 取交易ID
  paidAt: z.string().optional(),          // JSONPath 取付款時間
  description: z.string().optional(),     // JSONPath 取說明
  payerName: z.string().optional(),       // JSONPath 取付款方名稱
  payerContact: z.string().optional(),    // JSONPath 取聯絡資訊
  orderId: z.string().optional(),         // JSONPath 取訂單號
})
export type FieldMapping = z.infer<typeof fieldMappingSchema>

export const insertIncomeSourceSchema = createInsertSchema(incomeSources)
  .omit({ id: true, createdAt: true, updatedAt: true, totalReceived: true, lastReceivedAt: true })
  .extend({
    fieldMapping: fieldMappingSchema.optional().default({}),
    allowedIps: z.array(z.string().ip()).optional().default([]),
    authType: z.enum(["token", "hmac", "both"]).default("token"),
    sourceType: z
      .enum(["linepay", "jkopay", "airbnb", "booking", "custom_api", "manual"])
      .default("custom_api"),
  })

export const insertIncomeWebhookSchema = createInsertSchema(incomeWebhooks)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    parsedAmount: z.union([z.string(), z.number()]).transform((v) => v.toString()).optional(),
    parsedAmountTwd: z.union([z.string(), z.number()]).transform((v) => v.toString()).optional(),
    exchangeRate: z.union([z.string(), z.number()]).transform((v) => v.toString()).optional(),
  })

// 人工確認時的輸入
export const confirmWebhookSchema = z.object({
  projectId: z.number().int().positive(),
  categoryId: z.number().int().positive().optional(),
  itemName: z.string().min(1).max(255).optional(),   // 若要覆蓋預設名稱
  reviewNote: z.string().max(500).optional(),
})
export type ConfirmWebhookInput = z.infer<typeof confirmWebhookSchema>

// 批次確認
export const batchConfirmWebhookSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
  projectId: z.number().int().positive(),
  categoryId: z.number().int().positive().optional(),
  reviewNote: z.string().max(500).optional(),
})
export type BatchConfirmWebhookInput = z.infer<typeof batchConfirmWebhookSchema>

// ─────────────────────────────────────────────
// 型別匯出
// ─────────────────────────────────────────────
export type IncomeSource = typeof incomeSources.$inferSelect
export type InsertIncomeSource = z.infer<typeof insertIncomeSourceSchema>
export type IncomeWebhook = typeof incomeWebhooks.$inferSelect
export type InsertIncomeWebhook = z.infer<typeof insertIncomeWebhookSchema>
