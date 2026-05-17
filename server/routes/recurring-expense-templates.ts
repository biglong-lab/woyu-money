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

export default router
