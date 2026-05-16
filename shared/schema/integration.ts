/**
 * 通用整合事件紀錄表（Integration Events）
 *
 * 目的：
 * - 統一記錄所有外部系統與本系統的 HTTP 互動（不分 income / expense）
 * - 提供拋接成功率、延遲、retry 追蹤、debug 線索
 * - 支援 inbound（外部 → 我們）與 outbound（我們 → 外部）兩個方向
 *
 * 跟 income_webhooks / expense_webhooks 的關係：
 * - income_webhooks / expense_webhooks 記錄「業務狀態」（待確認 / 已確認 / 重複 ...）
 * - integration_events 記錄「HTTP 層細節」（headers、payload、status code、latency、attempt）
 * - 一筆 webhook 業務紀錄可對應多筆 events（首次 + 多次 retry）
 *
 * 注意：
 * - sourceId 不做 hard FK（因為要跨 income_sources / expense_sources 兩張表）
 * - 用 (integrationType, sourceId) 組合識別來源
 */
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  varchar,
  jsonb,
  index,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

// ─────────────────────────────────────────────
// 通用整合事件表
// ─────────────────────────────────────────────
export const integrationEvents = pgTable(
  "integration_events",
  {
    id: serial("id").primaryKey(),

    // 來源識別（跨 income_sources / expense_sources）
    integrationType: varchar("integration_type", { length: 20 }).notNull(),
    // integrationType 可選值：income | expense
    sourceId: integer("source_id").notNull(),
    // 來源 ID（指向 income_sources.id 或 expense_sources.id；不做 hard FK，因跨表）
    sourceKey: varchar("source_key", { length: 50 }).notNull(),
    // 來源 key 副本（方便查詢，例如 "linepay" / "pm_revenue"）

    // 方向
    direction: varchar("direction", { length: 10 }).notNull().default("inbound"),
    // direction 可選值：inbound（外部→我們）| outbound（我們→外部）

    // HTTP 細節
    httpMethod: varchar("http_method", { length: 10 }),
    httpPath: varchar("http_path", { length: 255 }),
    statusCode: integer("status_code"),
    requestHeaders: jsonb("request_headers").default({}),
    requestPayload: jsonb("request_payload"),
    responseBody: jsonb("response_body"),

    // 處理結果
    outcome: varchar("outcome", { length: 20 }).notNull(),
    // outcome 可選值：success | auth_failed | validation_failed | duplicate | error | retried
    errorMessage: text("error_message"),
    latencyMs: integer("latency_ms"),

    // Retry 追蹤
    attempt: integer("attempt").default(1),
    parentEventId: integer("parent_event_id"),
    // 若這筆是 retry，指向第一次失敗的 event ID

    // 連結到業務紀錄
    linkedWebhookId: integer("linked_webhook_id"),
    // 對應 income_webhooks.id 或 expense_webhooks.id（依 integrationType 解讀）

    // 請求 metadata
    requestIp: varchar("request_ip", { length: 45 }),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    typeSourceIdx: index("integration_events_type_source_idx").on(
      table.integrationType,
      table.sourceId
    ),
    outcomeIdx: index("integration_events_outcome_idx").on(table.outcome),
    createdAtIdx: index("integration_events_created_at_idx").on(table.createdAt),
    directionIdx: index("integration_events_direction_idx").on(table.direction),
  })
)

// ─────────────────────────────────────────────
// Zod schema
// ─────────────────────────────────────────────
export const integrationTypeEnum = z.enum(["income", "expense"])
export const eventDirectionEnum = z.enum(["inbound", "outbound"])
export const eventOutcomeEnum = z.enum([
  "success",
  "auth_failed",
  "validation_failed",
  "duplicate",
  "error",
  "retried",
])

export const insertIntegrationEventSchema = createInsertSchema(integrationEvents)
  .omit({ id: true, createdAt: true })
  .extend({
    integrationType: integrationTypeEnum,
    direction: eventDirectionEnum.default("inbound"),
    outcome: eventOutcomeEnum,
  })

// 查詢用 filter（給 GET /api/integrations/events）
export const eventQuerySchema = z.object({
  integrationType: integrationTypeEnum.optional(),
  sourceId: z.coerce.number().int().positive().optional(),
  sourceKey: z.string().optional(),
  direction: eventDirectionEnum.optional(),
  outcome: eventOutcomeEnum.optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
})
export type EventQuery = z.infer<typeof eventQuerySchema>

// ─────────────────────────────────────────────
// 型別匯出
// ─────────────────────────────────────────────
export type IntegrationEvent = typeof integrationEvents.$inferSelect
export type InsertIntegrationEvent = z.infer<typeof insertIntegrationEventSchema>
