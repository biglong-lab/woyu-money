/**
 * 固定開銷月度矩陣 API
 *
 * GET /api/fixed-expense-matrix?year=YYYY[&categoryId=N]
 * - 行：啟用中的週期性支出模板（recurring_expense_templates）
 * - 預算：模板 estimated_amount（成本預估、固定金額），僅 active_months 計入
 * - 實際：該模板已產出 payment_items 的實際付款（payment_records 已付），依付款日月份聚合
 * - 可用 categoryId 篩選只看某類別
 */
import { Router } from "express"
import { z } from "zod"
import { asyncHandler, errors } from "../middleware/error-handler"
import {
  buildFixedExpenseMatrix,
  type FixedExpenseTemplateInfo,
  type ActualPayment,
} from "@shared/fixed-expense-matrix"

const router = Router()

const yearSchema = z.preprocess(
  (val) => (val === undefined ? undefined : Number(val)),
  z.number().int().min(2000).max(2100).optional()
)

interface TemplateRow {
  id: number
  templateName: string
  categoryId: number | null
  categoryName: string | null
  estimatedAmount: string | number
  activeMonths: string
}

interface PaymentRow {
  templateId: number
  month: number
  amount: string | number
}

const TEMPLATES_SQL = `
  SELECT
    t.id AS "id",
    t.template_name AS "templateName",
    t.category_id AS "categoryId",
    dc.category_name AS "categoryName",
    t.estimated_amount AS "estimatedAmount",
    t.active_months AS "activeMonths"
  FROM recurring_expense_templates t
  LEFT JOIN debt_categories dc ON dc.id = t.category_id
  WHERE t.is_active = true
  ORDER BY t.template_name
`

// 實際付款：模板產出的 payment_items 的已付款紀錄（軟刪除排除），依付款日月份聚合
const ACTUAL_SQL = `
  SELECT
    pi.recurring_template_id AS "templateId",
    EXTRACT(MONTH FROM pr.payment_date)::int AS "month",
    SUM(pr.amount_paid::numeric) AS "amount"
  FROM payment_records pr
  JOIN payment_items pi ON pi.id = pr.payment_item_id
  WHERE pi.recurring_template_id IS NOT NULL
    AND pi.is_deleted = false
    AND pr.is_deleted = false
    AND EXTRACT(YEAR FROM pr.payment_date) = $1
  GROUP BY pi.recurring_template_id, month
`

router.get(
  "/api/fixed-expense-matrix",
  asyncHandler(async (req, res) => {
    const parsed = yearSchema.safeParse(req.query.year)
    if (!parsed.success) {
      throw errors.badRequest("year 參數錯誤：必須為 2000~2100 的整數")
    }
    const year = parsed.data ?? new Date().getFullYear()
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined

    const { pool } = await import("../db")
    const [tplRes, actualRes] = await Promise.all([
      pool.query<TemplateRow>(TEMPLATES_SQL),
      pool.query<PaymentRow>(ACTUAL_SQL, [year]),
    ])

    let templates: FixedExpenseTemplateInfo[] = tplRes.rows.map((r) => ({
      id: r.id,
      templateName: r.templateName,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      estimatedAmount: Math.round(Number(r.estimatedAmount ?? 0)),
      activeMonths: r.activeMonths ?? "*",
    }))

    if (categoryId !== undefined && !isNaN(categoryId)) {
      templates = templates.filter((t) => t.categoryId === categoryId)
    }

    const payments: ActualPayment[] = actualRes.rows.map((r) => ({
      templateId: r.templateId,
      month: r.month,
      amount: Number(r.amount),
    }))

    res.json(buildFixedExpenseMatrix(year, templates, payments))
  })
)

export default router
