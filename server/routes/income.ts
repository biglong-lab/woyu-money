import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { insertIncomeSourceSchema, confirmWebhookSchema, batchConfirmWebhookSchema } from "@shared/schema"
import {
  getIncomeSources,
  getIncomeSourceById,
  getIncomeSourceByKey,
  createIncomeSource,
  updateIncomeSource,
  deleteIncomeSource,
  getIncomeWebhooks,
  getIncomeWebhookById,
  getPendingWebhooksCount,
  receiveWebhook,
  confirmWebhook,
  batchConfirmWebhooks,
  rejectWebhook,
  reprocessWebhook,
  verifyBearerToken,
  verifyHmacSignature,
} from "../storage/income"
import { ZodError } from "zod"

const router = Router()

// ─────────────────────────────────────────────
// 進帳來源管理（需認證）
// ─────────────────────────────────────────────

/** GET /api/income/sources — 列出所有來源 */
router.get(
  "/api/income/sources",
  asyncHandler(async (_req, res) => {
    const sources = await getIncomeSources()
    // 回傳時遮罩敏感欄位
    const masked = sources.map(maskSource)
    res.json(masked)
  })
)

/** GET /api/income/sources/:id — 取得單一來源（含完整設定，供管理員編輯） */
router.get(
  "/api/income/sources/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")
    const source = await getIncomeSourceById(id)
    if (!source) throw new AppError(404, "找不到此進帳來源")
    res.json(source)
  })
)

/** POST /api/income/sources — 新增進帳來源 */
router.post(
  "/api/income/sources",
  asyncHandler(async (req, res) => {
    try {
      const data = insertIncomeSourceSchema.parse(req.body)
      const source = await createIncomeSource(data)
      res.status(201).json(source)
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, `資料驗證失敗：${err.errors.map((e) => e.message).join(", ")}`)
      }
      throw err
    }
  })
)

/** PUT /api/income/sources/:id — 更新進帳來源 */
router.put(
  "/api/income/sources/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")
    try {
      const data = insertIncomeSourceSchema.partial().parse(req.body)
      const updated = await updateIncomeSource(id, data)
      if (!updated) throw new AppError(404, "找不到此進帳來源")
      res.json(updated)
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, `資料驗證失敗：${err.errors.map((e) => e.message).join(", ")}`)
      }
      throw err
    }
  })
)

/** DELETE /api/income/sources/:id — 停用進帳來源 */
router.delete(
  "/api/income/sources/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")
    const ok = await deleteIncomeSource(id)
    if (!ok) throw new AppError(404, "找不到此進帳來源")
    res.json({ message: "已停用" })
  })
)

// ─────────────────────────────────────────────
// 進帳收件箱（需認證）
// ─────────────────────────────────────────────

/** GET /api/income/webhooks — 列出進帳紀錄（分頁 + 篩選）
 *  Query: page, pageSize, sourceId, status
 */
router.get(
  "/api/income/webhooks",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")))
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"))))
    const sourceId = req.query.sourceId ? parseInt(String(req.query.sourceId)) : undefined
    const status = req.query.status ? String(req.query.status) : undefined

    const result = await getIncomeWebhooks({ page, pageSize, sourceId, status })
    res.json(result)
  })
)

/** GET /api/income/webhooks/pending-count — 待確認筆數（用於 Badge 顯示） */
router.get(
  "/api/income/webhooks/pending-count",
  asyncHandler(async (_req, res) => {
    const count = await getPendingWebhooksCount()
    res.json({ count })
  })
)

/** GET /api/income/webhooks/:id — 取得單筆進帳詳情 */
router.get(
  "/api/income/webhooks/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")
    const webhook = await getIncomeWebhookById(id)
    if (!webhook) throw new AppError(404, "找不到此進帳紀錄")
    res.json(webhook)
  })
)

/** POST /api/income/webhooks/:id/confirm — 人工確認單筆進帳 */
router.post(
  "/api/income/webhooks/:id/confirm",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")

    const userId = (req.user as { id: number } | undefined)?.id
    if (!userId) throw new AppError(401, "請先登入")

    try {
      const input = confirmWebhookSchema.parse(req.body)
      const result = await confirmWebhook(id, userId, input)

      if (!result.success) throw new AppError(400, result.error ?? "確認失敗")
      res.json(result)
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, `資料驗證失敗：${err.errors.map((e) => e.message).join(", ")}`)
      }
      throw err
    }
  })
)

/** POST /api/income/webhooks/batch-confirm — 批次確認多筆進帳 */
router.post(
  "/api/income/webhooks/batch-confirm",
  asyncHandler(async (req, res) => {
    const userId = (req.user as { id: number } | undefined)?.id
    if (!userId) throw new AppError(401, "請先登入")

    try {
      const input = batchConfirmWebhookSchema.parse(req.body)
      const result = await batchConfirmWebhooks(userId, input)
      res.json(result)
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, `資料驗證失敗：${err.errors.map((e) => e.message).join(", ")}`)
      }
      throw err
    }
  })
)

/** POST /api/income/webhooks/:id/reject — 拒絕（標記為不處理） */
router.post(
  "/api/income/webhooks/:id/reject",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")

    const userId = (req.user as { id: number } | undefined)?.id
    if (!userId) throw new AppError(401, "請先登入")

    const { reviewNote } = req.body as { reviewNote?: string }
    const ok = await rejectWebhook(id, userId, reviewNote)
    if (!ok) throw new AppError(404, "找不到此進帳紀錄或狀態不為 pending")
    res.json({ message: "已拒絕" })
  })
)

/** POST /api/income/webhooks/:id/reprocess — 重新放回待確認 */
router.post(
  "/api/income/webhooks/:id/reprocess",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")
    const ok = await reprocessWebhook(id)
    if (!ok) throw new AppError(404, "找不到此進帳紀錄")
    res.json({ message: "已重設為待確認" })
  })
)

// ─────────────────────────────────────────────
// Webhook 接收端點（公開，不需 session，用 secret/token 驗證）
// 需排除在 requireAuth 之前，在 routes/index.ts 特別處理
// ─────────────────────────────────────────────

/** POST /api/income/webhook/:sourceKey — 外部系統推送進帳
 *
 * 驗證方式（依 source.authType）：
 *   - token: Authorization: Bearer <token>
 *   - hmac:  X-Signature: sha256=<hex>
 *   - both:  兩者皆需
 */
router.post(
  "/api/income/webhook/:sourceKey",
  asyncHandler(async (req, res) => {
    const { sourceKey } = req.params

    // 取得來源設定
    const source = await getIncomeSourceByKey(sourceKey)
    if (!source) {
      // 故意回傳 200 避免探測
      return res.status(200).json({ received: true })
    }

    // 取得原始 body（用於 HMAC 驗證）
    // Express 需設定 raw body middleware，這裡取 JSON stringify 作為 fallback
    const rawBody =
      (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body)

    const requestIp =
      String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "")
        .split(",")[0]
        .trim()

    const result = await receiveWebhook({
      source,
      rawPayload: req.body,
      rawBody,
      signatureHeader:
        String(req.headers["x-signature"] ?? req.headers["x-hub-signature-256"] ?? ""),
      tokenHeader: String(req.headers["authorization"] ?? ""),
      requestIp,
      requestHeaders: req.headers as Record<string, string>,
    })

    if (!result.success) {
      return res.status(401).json({ error: result.error })
    }

    if (result.isDuplicate) {
      return res.status(200).json({ received: true, duplicate: true, id: result.webhookId })
    }

    return res.status(200).json({ received: true, id: result.webhookId })
  })
)

// ─────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────

/** 遮罩敏感欄位（apiToken、webhookSecret 只顯示後 4 碼） */
function maskSource(source: Record<string, unknown>) {
  return {
    ...source,
    apiToken: source.apiToken
      ? `****${String(source.apiToken).slice(-4)}`
      : null,
    webhookSecret: source.webhookSecret
      ? `****${String(source.webhookSecret).slice(-4)}`
      : null,
  }
}

export default router
