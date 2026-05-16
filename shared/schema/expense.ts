/**
 * 支出端 Webhook Schema
 *
 * 鏡像 income.ts 的設計，但對接到 payment_items / payment_records 這側。
 *
 * 兩種模式（webhookMode）：
 *   - as_pending：建立 payment_items（待付項目，需手動標記已付）
 *   - as_paid：autoConfirm 時直接建立 payment_records（已付紀錄）
 *
 * 與 income 的差異：
 *   - parsedVendor（廠商）取代 parsedPayerName
 *   - parsedInvoiceNumber（發票/帳單號）取代 parsedOrderId
 *   - parsedCategoryHint（分類提示，文字）
 *   - parsedTags（jsonb 陣列，用於分流）
 */
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
import { paymentProjects, debtCategories } from "./category"
import { paymentItems, paymentRecords } from "./payment"

// ─────────────────────────────────────────────
// 支出來源設定
// ─────────────────────────────────────────────
export const expenseSources = pgTable(
  "expense_sources",
  {
    id: serial("id").primaryKey(),

    sourceName: varchar("source_name", { length: 100 }).notNull(),
    sourceKey: varchar("source_key", { length: 50 }).notNull(),
    sourceType: varchar("source_type", { length: 30 }).notNull().default("custom_api"),
    // sourceType 範例：pm_expense | accounting_system | erp | custom_api | manual

    description: text("description"),

    // 驗證
    authType: varchar("auth_type", { length: 20 }).notNull().default("token"),
    // token | hmac | both
    webhookSecret: varchar("webhook_secret", { length: 255 }),
    apiToken: varchar("api_token", { length: 255 }),

    allowedIps: jsonb("allowed_ips").default([]),

    // Webhook 模式 — 決定 autoConfirm 時建立的資料類型
    webhookMode: varchar("webhook_mode", { length: 20 }).notNull().default("as_pending"),
    // as_pending：建立 payment_items（待付）
    // as_paid：建立 payment_records（已付）

    // 預設歸類
    defaultProjectId: integer("default_project_id").references(() => paymentProjects.id),
    defaultCategoryId: integer("default_category_id").references(() => debtCategories.id),
    defaultVendor: varchar("default_vendor", { length: 255 }),
    defaultTags: jsonb("default_tags").default([]),

    // 欄位對應（JSONPath 格式）
    fieldMapping: jsonb("field_mapping").notNull().default({}),

    defaultCurrency: varchar("default_currency", { length: 10 }).notNull().default("TWD"),
    currencyConversionEnabled: boolean("currency_conversion_enabled").default(false),

    isActive: boolean("is_active").default(true),
    autoConfirm: boolean("auto_confirm").default(false),

    totalReceived: integer("total_received").default(0),
    lastReceivedAt: timestamp("last_received_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    sourceKeyUniq: unique("expense_sources_source_key_uniq").on(table.sourceKey),
    isActiveIdx: index("expense_sources_is_active_idx").on(table.isActive),
  })
)

// ─────────────────────────────────────────────
// 支出 Webhook 紀錄
// ─────────────────────────────────────────────
export const expenseWebhooks = pgTable(
  "expense_webhooks",
  {
    id: serial("id").primaryKey(),

    sourceId: integer("source_id")
      .notNull()
      .references(() => expenseSources.id),

    externalTransactionId: varchar("external_transaction_id", { length: 255 }),

    rawPayload: jsonb("raw_payload").notNull(),

    // 解析後標準化資料
    parsedAmount: decimal("parsed_amount", { precision: 12, scale: 2 }),
    parsedCurrency: varchar("parsed_currency", { length: 10 }).default("TWD"),
    parsedAmountTwd: decimal("parsed_amount_twd", { precision: 12, scale: 2 }),
    exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }),
    parsedDescription: text("parsed_description"),
    parsedPaidAt: timestamp("parsed_paid_at"),
    parsedDueAt: timestamp("parsed_due_at"), // 支出特有：到期日
    parsedVendor: varchar("parsed_vendor", { length: 255 }),
    parsedInvoiceNumber: varchar("parsed_invoice_number", { length: 100 }),
    parsedCategoryHint: varchar("parsed_category_hint", { length: 100 }),
    parsedTags: jsonb("parsed_tags").default([]),

    signatureValid: boolean("signature_valid").default(true),

    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // pending | confirmed | rejected | duplicate | error

    reviewedByUserId: integer("reviewed_by_user_id"),
    reviewedAt: timestamp("reviewed_at"),
    reviewNote: text("review_note"),

    // 確認後連結
    linkedItemId: integer("linked_item_id").references(() => paymentItems.id),
    linkedRecordId: integer("linked_record_id").references(() => paymentRecords.id),

    processedAt: timestamp("processed_at"),
    errorMessage: text("error_message"),

    requestIp: varchar("request_ip", { length: 45 }),
    requestHeaders: jsonb("request_headers").default({}),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    sourceIdIdx: index("expense_webhooks_source_id_idx").on(table.sourceId),
    statusIdx: index("expense_webhooks_status_idx").on(table.status),
    createdAtIdx: index("expense_webhooks_created_at_idx").on(table.createdAt),
    parsedPaidAtIdx: index("expense_webhooks_paid_at_idx").on(table.parsedPaidAt),
    externalTxUniq: unique("expense_webhooks_external_tx_uniq").on(
      table.sourceId,
      table.externalTransactionId
    ),
  })
)

// ─────────────────────────────────────────────
// Zod
// ─────────────────────────────────────────────

export const expenseFieldMappingSchema = z.object({
  amount: z.string().optional(),
  currency: z.string().optional(),
  transactionId: z.string().optional(),
  paidAt: z.string().optional(),
  dueAt: z.string().optional(),
  description: z.string().optional(),
  vendor: z.string().optional(),
  invoiceNumber: z.string().optional(),
  categoryHint: z.string().optional(),
  tags: z.string().optional(),
})
export type ExpenseFieldMapping = z.infer<typeof expenseFieldMappingSchema>

export const insertExpenseSourceSchema = createInsertSchema(expenseSources)
  .omit({ id: true, createdAt: true, updatedAt: true, totalReceived: true, lastReceivedAt: true })
  .extend({
    fieldMapping: expenseFieldMappingSchema.optional().default({}),
    allowedIps: z.array(z.string().ip()).optional().default([]),
    defaultTags: z.array(z.string()).optional().default([]),
    authType: z.enum(["token", "hmac", "both"]).default("token"),
    webhookMode: z.enum(["as_pending", "as_paid"]).default("as_pending"),
    sourceType: z
      .enum(["pm_expense", "accounting_system", "erp", "custom_api", "manual"])
      .default("custom_api"),
  })

export const confirmExpenseWebhookSchema = z.object({
  projectId: z.number().int().positive(),
  categoryId: z.number().int().positive().optional(),
  itemName: z.string().min(1).max(255).optional(),
  asPaid: z.boolean().default(false), // 是否標記為已付
  reviewNote: z.string().max(500).optional(),
})
export type ConfirmExpenseWebhookInput = z.infer<typeof confirmExpenseWebhookSchema>

export const batchConfirmExpenseSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
  projectId: z.number().int().positive(),
  categoryId: z.number().int().positive().optional(),
  asPaid: z.boolean().default(false),
  reviewNote: z.string().max(500).optional(),
})
export type BatchConfirmExpenseInput = z.infer<typeof batchConfirmExpenseSchema>

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────
export type ExpenseSource = typeof expenseSources.$inferSelect
export type InsertExpenseSource = z.infer<typeof insertExpenseSourceSchema>
export type ExpenseWebhook = typeof expenseWebhooks.$inferSelect
