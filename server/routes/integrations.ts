/**
 * Integrations API — 通用整合管理
 *
 * - GET /api/integrations/events — 查詢拋接紀錄（含分頁、篩選）
 * - GET /api/integrations/sources/:type/:id/health — 取得 source 24h 健康指標
 *
 * 此 router 只處理「跨 income/expense」的通用查詢；
 * 各別 source CRUD 仍在 /api/income/sources、/api/expense/sources。
 */
import { Router } from "express"
import crypto from "crypto"
import { requireAuth } from "../auth"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { eventQuerySchema } from "@shared/schema"
import { queryEvents, getSourceHealth, getEventById, logEvent } from "../storage/integration-events"
import { ZodError } from "zod"
import { getIncomeSourceByKey, receiveWebhook } from "../storage/income"
import {
  getExpenseSourceByKey,
  receiveExpenseWebhook,
  getExpenseSourceById,
} from "../storage/expense-webhooks"
import { db } from "../db"
import { incomeSources } from "@shared/schema"
import type { IncomeSource, ExpenseSource } from "@shared/schema"
import { eq } from "drizzle-orm"

const router = Router()

// 全部需要登入
router.use(requireAuth)

/** GET /api/integrations/events — 查詢拋接紀錄
 *
 * Query params:
 *   integrationType: income | expense
 *   sourceId: number
 *   sourceKey: string
 *   direction: inbound | outbound
 *   outcome: success | auth_failed | validation_failed | duplicate | error | retried
 *   since: ISO datetime
 *   until: ISO datetime
 *   page: number (default 1)
 *   pageSize: number (default 50, max 200)
 */
router.get(
  "/api/integrations/events",
  asyncHandler(async (req, res) => {
    try {
      const query = eventQuerySchema.parse(req.query)
      const result = await queryEvents(query)
      res.json(result)
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, "查詢參數無效: " + err.errors.map((e) => e.message).join(", "))
      }
      throw err
    }
  })
)

/** GET /api/integrations/events/:id — 取得單筆事件詳情（給 Replay 用）*/
router.get(
  "/api/integrations/events/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      throw new AppError(400, "無效的事件 ID")
    }
    const event = await getEventById(id)
    if (!event) throw new AppError(404, "事件不存在")
    res.json(event)
  })
)

/** GET /api/integrations/sources/:type/:id/health — 24h 健康指標 */
router.get(
  "/api/integrations/sources/:type/:id/health",
  asyncHandler(async (req, res) => {
    const type = req.params.type
    if (type !== "income" && type !== "expense") {
      throw new AppError(400, "無效的整合類型，必須為 income 或 expense")
    }
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      throw new AppError(400, "無效的 source ID")
    }
    const health = await getSourceHealth(type, id)
    res.json(health)
  })
)

// ─────────────────────────────────────────────
// 串接測試工具
// ─────────────────────────────────────────────

/** 預設 sample payload — 根據 fieldMapping 自動產生符合對應的測試資料 */
function buildSamplePayload(
  fieldMapping: Record<string, string>,
  type: "income" | "expense"
): Record<string, unknown> {
  const sample: Record<string, unknown> = {}
  const now = new Date().toISOString()
  const fakeTxId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // 依 fieldMapping 反推要塞哪些欄位（JSONPath 寫得越複雜這裡越無法處理，提供最簡單的扁平結構）
  const assignByPath = (path: string, value: unknown) => {
    const cleanPath = path.replace(/^\$\.?/, "")
    const parts = cleanPath.split(".").filter(Boolean)
    if (parts.length === 0) return
    let cur: Record<string, unknown> = sample
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {}
      cur = cur[parts[i]] as Record<string, unknown>
    }
    cur[parts[parts.length - 1]] = value
  }

  if (fieldMapping.amount) assignByPath(fieldMapping.amount, 1234)
  if (fieldMapping.currency) assignByPath(fieldMapping.currency, "TWD")
  if (fieldMapping.transactionId) assignByPath(fieldMapping.transactionId, fakeTxId)
  if (fieldMapping.paidAt) assignByPath(fieldMapping.paidAt, now)
  if (fieldMapping.description) {
    assignByPath(fieldMapping.description, type === "income" ? "測試進帳" : "測試支出")
  }

  if (type === "income") {
    if (fieldMapping.payerName) assignByPath(fieldMapping.payerName, "測試付款人")
    if (fieldMapping.payerContact) assignByPath(fieldMapping.payerContact, "test@example.com")
    if (fieldMapping.orderId) assignByPath(fieldMapping.orderId, `ORD-${fakeTxId}`)
  } else {
    if (fieldMapping.vendor) assignByPath(fieldMapping.vendor, "測試廠商")
    if (fieldMapping.invoiceNumber) assignByPath(fieldMapping.invoiceNumber, `INV-${fakeTxId}`)
    if (fieldMapping.categoryHint) assignByPath(fieldMapping.categoryHint, "辦公雜支")
    if (fieldMapping.dueAt) assignByPath(fieldMapping.dueAt, now)
    if (fieldMapping.tags) assignByPath(fieldMapping.tags, ["test", "auto-generated"])
  }

  // 若 mapping 為空，至少塞一個基本欄位
  if (Object.keys(sample).length === 0) {
    sample.amount = 1234
    sample.transactionId = fakeTxId
    sample.test = true
  }

  return sample
}

/** POST /api/integrations/sources/:type/:id/test
 *
 * Body:
 *   { executeForReal?: boolean }   — true 真的走完整流程；預設 false 只回傳要送的 payload
 *
 * Response:
 *   { sourceKey, payload, headers, curl, result? }
 */
router.post(
  "/api/integrations/sources/:type/:id/test",
  asyncHandler(async (req, res) => {
    const type = req.params.type
    if (type !== "income" && type !== "expense")
      throw new AppError(400, "type 必須為 income 或 expense")
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 source ID")
    const executeForReal = req.body?.executeForReal === true

    // 取 source（兩個表分開）
    let source: IncomeSource | ExpenseSource | null
    if (type === "income") {
      const [row] = await db.select().from(incomeSources).where(eq(incomeSources.id, id)).limit(1)
      source = row ?? null
    } else {
      source = await getExpenseSourceById(id)
    }
    if (!source) throw new AppError(404, "來源不存在")

    const fieldMapping = (source.fieldMapping as Record<string, string>) ?? {}
    const payload = buildSamplePayload(fieldMapping, type)
    const rawBody = JSON.stringify(payload)

    // 組 headers
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if ((source.authType === "token" || source.authType === "both") && source.apiToken) {
      headers["Authorization"] = `Bearer ${source.apiToken}`
    }
    if ((source.authType === "hmac" || source.authType === "both") && source.webhookSecret) {
      const sig = crypto.createHmac("sha256", source.webhookSecret).update(rawBody).digest("hex")
      headers["X-Signature"] = `sha256=${sig}`
    }

    const webhookPath = `/api/${type}/webhook/${source.sourceKey}`
    const host = `${req.protocol}://${req.get("host")}`
    const curl = [
      `curl -X POST '${host}${webhookPath}' \\`,
      ...Object.entries(headers).map(([k, v]) => `  -H '${k}: ${v}' \\`),
      `  -d '${rawBody}'`,
    ].join("\n")

    const response: {
      sourceKey: string
      payload: Record<string, unknown>
      headers: Record<string, string>
      curl: string
      executed: boolean
      result?: { success: boolean; webhookId?: number; isDuplicate?: boolean; error?: string }
    } = { sourceKey: source.sourceKey, payload, headers, curl, executed: false }

    // 真的執行
    if (executeForReal) {
      const t0 = Date.now()
      let result: { success: boolean; webhookId?: number; isDuplicate?: boolean; error?: string }
      if (type === "income") {
        result = await receiveWebhook({
          source: source as IncomeSource,
          rawPayload: payload,
          rawBody,
          signatureHeader: headers["X-Signature"] ?? "",
          tokenHeader: headers["Authorization"] ?? "",
          requestIp: "127.0.0.1",
          requestHeaders: headers,
        })
      } else {
        result = await receiveExpenseWebhook({
          source: source as ExpenseSource,
          rawPayload: payload,
          rawBody,
          signatureHeader: headers["X-Signature"] ?? "",
          tokenHeader: headers["Authorization"] ?? "",
          requestIp: "127.0.0.1",
          requestHeaders: headers,
        })
      }

      let outcome: "success" | "auth_failed" | "duplicate" | "error" = "success"
      if (!result.success) outcome = "auth_failed"
      else if (result.isDuplicate) outcome = "duplicate"

      await logEvent({
        integrationType: type as "income" | "expense",
        sourceId: source.id,
        sourceKey: source.sourceKey,
        direction: "inbound",
        httpMethod: "POST",
        httpPath: webhookPath,
        statusCode: result.success ? 200 : 401,
        requestHeaders: { ...headers, "X-Test-Payload": "1" },
        requestPayload: payload,
        responseBody: result,
        outcome,
        errorMessage: result.error ?? null,
        latencyMs: Date.now() - t0,
        linkedWebhookId: result.webhookId ?? null,
        requestIp: "127.0.0.1",
      })

      response.executed = true
      response.result = result
    }

    res.json(response)
  })
)

/** POST /api/integrations/events/:id/replay
 *
 * 將指定 event 的 request_payload 重新送一次（用原本的 source 設定產生新簽章）。
 * 失敗 / 成功都會寫入新的 event，attempt+1，parent_event_id 指向原 event。
 */
router.post(
  "/api/integrations/events/:id/replay",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 event ID")

    const original = await getEventById(id)
    if (!original) throw new AppError(404, "事件不存在")
    if (!original.requestPayload) throw new AppError(400, "原事件無 payload，無法 replay")

    const type = original.integrationType as "income" | "expense"

    // 取目前的 source 設定
    let source: IncomeSource | ExpenseSource | null
    if (type === "income") {
      source = await getIncomeSourceByKey(original.sourceKey)
    } else {
      source = await getExpenseSourceByKey(original.sourceKey)
    }
    if (!source) throw new AppError(404, "對應 source 已不存在或已停用")

    const rawBody = JSON.stringify(original.requestPayload)
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if ((source.authType === "token" || source.authType === "both") && source.apiToken) {
      headers["Authorization"] = `Bearer ${source.apiToken}`
    }
    if ((source.authType === "hmac" || source.authType === "both") && source.webhookSecret) {
      const sig = crypto.createHmac("sha256", source.webhookSecret).update(rawBody).digest("hex")
      headers["X-Signature"] = `sha256=${sig}`
    }

    const t0 = Date.now()
    let result: { success: boolean; webhookId?: number; isDuplicate?: boolean; error?: string }
    if (type === "income") {
      result = await receiveWebhook({
        source: source as IncomeSource,
        rawPayload: original.requestPayload,
        rawBody,
        signatureHeader: headers["X-Signature"] ?? "",
        tokenHeader: headers["Authorization"] ?? "",
        requestIp: "127.0.0.1",
        requestHeaders: headers,
      })
    } else {
      result = await receiveExpenseWebhook({
        source: source as ExpenseSource,
        rawPayload: original.requestPayload,
        rawBody,
        signatureHeader: headers["X-Signature"] ?? "",
        tokenHeader: headers["Authorization"] ?? "",
        requestIp: "127.0.0.1",
        requestHeaders: headers,
      })
    }

    let outcome: "success" | "auth_failed" | "duplicate" | "error" | "retried" = "retried"
    if (result.success && !result.isDuplicate) outcome = "success"
    else if (!result.success) outcome = "auth_failed"
    else if (result.isDuplicate) outcome = "duplicate"

    const newEvent = await logEvent({
      integrationType: type,
      sourceId: source.id,
      sourceKey: original.sourceKey,
      direction: "inbound",
      httpMethod: "POST",
      httpPath: original.httpPath ?? `/api/${type}/webhook/${original.sourceKey}`,
      statusCode: result.success ? 200 : 401,
      requestHeaders: { ...headers, "X-Replay-Of": String(original.id) },
      requestPayload: original.requestPayload,
      responseBody: result,
      outcome,
      errorMessage: result.error ?? null,
      latencyMs: Date.now() - t0,
      attempt: (original.attempt ?? 1) + 1,
      parentEventId: original.id,
      linkedWebhookId: result.webhookId ?? null,
      requestIp: "127.0.0.1",
    })

    res.json({ replayed: true, originalEventId: original.id, newEvent, result })
  })
)

export default router
