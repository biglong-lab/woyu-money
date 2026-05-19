/**
 * 週期性支出模板 API
 *
 * GET    /api/recurring-expense-templates           — 列表
 * POST   /api/recurring-expense-templates           — 新增
 * PUT    /api/recurring-expense-templates/:id       — 編輯
 * DELETE /api/recurring-expense-templates/:id       — 刪除
 * POST   /api/recurring-expense-templates/:id/generate — 立即產出當月（或指定月）
 * POST   /api/recurring-expense-templates/generate-all  — 對所有 active 模板產出
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  generateItemsForMonth,
  listScheduledItems,
  replaceScheduledWithActual,
} from "../storage/recurring-expense-templates"
import { insertRecurringExpenseTemplateSchema } from "@shared/schema"
import { ZodError } from "zod"

const router = Router()

router.get(
  "/api/recurring-expense-templates",
  asyncHandler(async (_req, res) => {
    res.json(await listTemplates())
  })
)

router.post(
  "/api/recurring-expense-templates",
  asyncHandler(async (req, res) => {
    try {
      const data = insertRecurringExpenseTemplateSchema.parse(req.body)
      const row = await createTemplate(data)
      res.status(201).json(row)
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, "資料格式錯誤：" + err.errors.map((e) => e.message).join(", "))
      }
      throw err
    }
  })
)

router.put(
  "/api/recurring-expense-templates/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    try {
      const partial = insertRecurringExpenseTemplateSchema.partial().parse(req.body)
      const row = await updateTemplate(id, partial)
      if (!row) throw new AppError(404, "模板不存在")
      res.json(row)
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, "資料格式錯誤：" + err.errors.map((e) => e.message).join(", "))
      }
      throw err
    }
  })
)

router.delete(
  "/api/recurring-expense-templates/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const ok = await deleteTemplate(id)
    if (!ok) throw new AppError(404, "模板不存在")
    res.json({ success: true })
  })
)

router.post(
  "/api/recurring-expense-templates/:id/generate",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const tpl = await getTemplate(id)
    if (!tpl) throw new AppError(404, "模板不存在")

    const month = (req.body?.month as string | undefined) ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError(400, "month 格式須為 YYYY-MM")
    }

    // 若指定 force=true、清除 lastGeneratedMonth 重新產
    if (req.body?.force) {
      await updateTemplate(id, { lastGeneratedMonth: null } as never)
    }

    const result = await generateItemsForMonth(month, [id])
    res.json(result)
  })
)

router.post(
  "/api/recurring-expense-templates/generate-all",
  asyncHandler(async (req, res) => {
    const month = (req.body?.month as string | undefined) ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError(400, "month 格式須為 YYYY-MM")
    }
    const result = await generateItemsForMonth(month)
    res.json({ month, ...result })
  })
)

/**
 * GET /api/recurring-expense-templates/scheduled-items?month=YYYY-MM
 * 列出該月所有「模板自動產出占位項」（給「填入實際金額」UI 用）
 */
router.get(
  "/api/recurring-expense-templates/scheduled-items",
  asyncHandler(async (req, res) => {
    const month = (req.query.month as string | undefined) ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError(400, "month 格式須為 YYYY-MM")
    }
    const items = await listScheduledItems(month)
    res.json({ month, items })
  })
)

/**
 * POST /api/recurring-expense-templates/replace-with-actual/:itemId
 * 將某筆「估算占位」更新為「實際支付」（不新增另一筆）
 *
 * Body: { actualAmount, paymentDate, paymentMethod?, notes?, receiptImageUrl? }
 */
router.post(
  "/api/recurring-expense-templates/replace-with-actual/:itemId",
  asyncHandler(async (req, res) => {
    const itemId = Number(req.params.itemId)
    if (!Number.isInteger(itemId) || itemId < 1) throw new AppError(400, "無效的 itemId")

    const actualAmount = Number(req.body?.actualAmount)
    if (!Number.isFinite(actualAmount) || actualAmount <= 0) {
      throw new AppError(400, "actualAmount 需為正數")
    }

    const paymentDate = String(req.body?.paymentDate || "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      throw new AppError(400, "paymentDate 格式需 YYYY-MM-DD")
    }

    try {
      const result = await replaceScheduledWithActual({
        itemId,
        actualAmount,
        paymentDate,
        paymentMethod: req.body?.paymentMethod || null,
        notes: req.body?.notes || null,
        receiptImageUrl: req.body?.receiptImageUrl || null,
      })
      res.json(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "更新失敗"
      throw new AppError(400, msg)
    }
  })
)

export default router
