/**
 * Expense Webhook API
 *
 * 鏡像 income.ts 的 routes，差異：
 * - sourceKey 開頭路徑 /api/expense/webhook/:sourceKey 不需 session 認證（webhook 接收用）
 *   → 在 routes/index.ts 已將 /api/expense/webhook/* 加入豁免清單
 * - 管理 API（CRUD sources、列表 webhooks）需 session 認證
 */
import { Router } from "express"
import { eq, and, desc, sql } from "drizzle-orm"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { db } from "../db"
import { expenseSources, expenseWebhooks } from "@shared/schema"
import { insertExpenseSourceSchema } from "@shared/schema"
import {
  getExpenseSourceByKey,
  listExpenseSources,
  receiveExpenseWebhook,
  getExpenseWebhookById,
  confirmExpenseWebhook,
  batchConfirmExpenseWebhooks,
} from "../storage/expense-webhooks"
import { confirmExpenseWebhookSchema, batchConfirmExpenseSchema } from "@shared/schema"
import { logEvent } from "../storage/integration-events"
import { ZodError } from "zod"

const router = Router()

// ─────────────────────────────────────────────
// 管理 API（CRUD）
// ─────────────────────────────────────────────

/** GET /api/expense/sources — 列出所有支出來源 */
router.get(
  "/api/expense/sources",
  asyncHandler(async (_req, res) => {
    const sources = await listExpenseSources()
    res.json(sources.map(maskSource))
  })
)

/** POST /api/expense/sources — 新增來源 */
router.post(
  "/api/expense/sources",
  asyncHandler(async (req, res) => {
    try {
      const data = insertExpenseSourceSchema.parse(req.body)
      const [row] = await db.insert(expenseSources).values(data).returning()
      res.status(201).json(maskSource(row))
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, "資料格式錯誤：" + err.errors.map((e) => e.message).join(", "))
      }
      throw err
    }
  })
)

/** PUT /api/expense/sources/:id — 更新來源 */
router.put(
  "/api/expense/sources/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    try {
      const partial = insertExpenseSourceSchema.partial().parse(req.body)
      const [row] = await db
        .update(expenseSources)
        .set({ ...partial, updatedAt: new Date() })
        .where(eq(expenseSources.id, id))
        .returning()
      if (!row) throw new AppError(404, "來源不存在")
      res.json(maskSource(row))
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, "資料格式錯誤：" + err.errors.map((e) => e.message).join(", "))
      }
      throw err
    }
  })
)

/** DELETE /api/expense/sources/:id — 停用來源 */
router.delete(
  "/api/expense/sources/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const [row] = await db
      .update(expenseSources)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(expenseSources.id, id))
      .returning()
    if (!row) throw new AppError(404, "來源不存在")
    res.json({ success: true })
  })
)

// ─────────────────────────────────────────────
// 對帳 API（列表 / 確認 / 拒絕 / 重新處理）
// ─────────────────────────────────────────────

/** GET /api/expense/webhooks — 列出 webhook 紀錄（含分頁、篩選）*/
router.get(
  "/api/expense/webhooks",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1))
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 50)))
    const status = req.query.status as string | undefined
    const sourceId = req.query.sourceId ? Number(req.query.sourceId) : undefined

    const conditions = []
    if (status) conditions.push(eq(expenseWebhooks.status, status))
    if (sourceId) conditions.push(eq(expenseWebhooks.sourceId, sourceId))
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [data, [{ count }]] = await Promise.all([
      db
        .select()
        .from(expenseWebhooks)
        .where(whereClause)
        .orderBy(desc(expenseWebhooks.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(expenseWebhooks)
        .where(whereClause),
    ])

    res.json({ data, total: count, page, pageSize })
  })
)

/** GET /api/expense/webhooks/:id — 取得單筆詳情 */
router.get(
  "/api/expense/webhooks/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const row = await getExpenseWebhookById(id)
    if (!row) throw new AppError(404, "找不到")
    res.json(row)
  })
)

/** POST /api/expense/webhooks/:id/confirm — 確認單筆 → 寫入 payment_items */
router.post(
  "/api/expense/webhooks/:id/confirm",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    try {
      const input = confirmExpenseWebhookSchema.parse(req.body)
      const userId = (req.user as { id?: number } | undefined)?.id ?? null
      const result = await confirmExpenseWebhook(id, userId, input)
      if (!result.success) throw new AppError(400, result.error ?? "確認失敗")
      res.json(result)
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, "資料格式錯誤：" + err.errors.map((e) => e.message).join(", "))
      }
      throw err
    }
  })
)

/** POST /api/expense/webhooks/batch-confirm — 批次確認 */
router.post(
  "/api/expense/webhooks/batch-confirm",
  asyncHandler(async (req, res) => {
    try {
      const input = batchConfirmExpenseSchema.parse(req.body)
      const userId = (req.user as { id?: number } | undefined)?.id ?? null
      const result = await batchConfirmExpenseWebhooks(input.ids, userId, {
        projectId: input.projectId,
        categoryId: input.categoryId,
        asPaid: input.asPaid,
        reviewNote: input.reviewNote,
      })
      res.json(result)
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, "資料格式錯誤：" + err.errors.map((e) => e.message).join(", "))
      }
      throw err
    }
  })
)

/** POST /api/expense/webhooks/:id/reject — 拒絕單筆 webhook */
router.post(
  "/api/expense/webhooks/:id/reject",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const reviewNote = String(req.body?.reviewNote ?? "")
    const userId = (req.user as { id?: number } | undefined)?.id ?? null

    const [row] = await db
      .update(expenseWebhooks)
      .set({
        status: "rejected",
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewNote,
        updatedAt: new Date(),
      })
      .where(eq(expenseWebhooks.id, id))
      .returning()

    if (!row) throw new AppError(404, "webhook 不存在")
    res.json({ success: true })
  })
)

/** POST /api/expense/webhooks/:id/reprocess — 重新放回待確認 */
router.post(
  "/api/expense/webhooks/:id/reprocess",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const [row] = await db
      .update(expenseWebhooks)
      .set({
        status: "pending",
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(expenseWebhooks.id, id))
      .returning()
    if (!row) throw new AppError(404, "webhook 不存在")
    res.json({ success: true })
  })
)

// ─────────────────────────────────────────────
// Webhook 接收端點（不需 session 認證 — 在 routes/index.ts 已豁免）
// ─────────────────────────────────────────────

/** POST /api/expense/webhook/:sourceKey — 外部系統推送支出 */
router.post(
  "/api/expense/webhook/:sourceKey",
  asyncHandler(async (req, res) => {
    const { sourceKey } = req.params
    const t0 = Date.now()

    const source = await getExpenseSourceByKey(sourceKey)
    if (!source) {
      await logEvent({
        integrationType: "expense",
        sourceId: 0,
        sourceKey,
        direction: "inbound",
        httpMethod: "POST",
        httpPath: `/api/expense/webhook/${sourceKey}`,
        statusCode: 200,
        requestPayload: req.body,
        outcome: "error",
        errorMessage: `unknown source_key: ${sourceKey}`,
        latencyMs: Date.now() - t0,
        requestIp: String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "")
          .split(",")[0]
          .trim(),
      })
      return res.status(200).json({ received: true })
    }

    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body)
    const requestIp = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "")
      .split(",")[0]
      .trim()

    const result = await receiveExpenseWebhook({
      source,
      rawPayload: req.body,
      rawBody,
      signatureHeader: String(
        req.headers["x-signature"] ?? req.headers["x-hub-signature-256"] ?? ""
      ),
      tokenHeader: String(req.headers["authorization"] ?? ""),
      requestIp,
      requestHeaders: req.headers as Record<string, string>,
    })

    let outcome: "success" | "auth_failed" | "duplicate" | "error" = "success"
    let statusCode = 200
    if (!result.success) {
      outcome = "auth_failed"
      statusCode = 401
    } else if (result.isDuplicate) {
      outcome = "duplicate"
    }

    await logEvent({
      integrationType: "expense",
      sourceId: source.id,
      sourceKey,
      direction: "inbound",
      httpMethod: "POST",
      httpPath: `/api/expense/webhook/${sourceKey}`,
      statusCode,
      requestPayload: req.body,
      responseBody: result.success
        ? { received: true, duplicate: result.isDuplicate, id: result.webhookId }
        : { error: result.error },
      outcome,
      errorMessage: result.success ? null : (result.error ?? null),
      latencyMs: Date.now() - t0,
      linkedWebhookId: result.webhookId ?? null,
      requestIp,
    })

    if (!result.success) return res.status(401).json({ error: result.error })
    if (result.isDuplicate)
      return res.status(200).json({ received: true, duplicate: true, id: result.webhookId })
    return res.status(200).json({ received: true, id: result.webhookId })
  })
)

// ─────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────
function maskSource(source: Record<string, unknown>) {
  return {
    ...source,
    apiToken: source.apiToken ? `****${String(source.apiToken).slice(-4)}` : null,
    webhookSecret: source.webhookSecret ? `****${String(source.webhookSecret).slice(-4)}` : null,
  }
}

export default router
