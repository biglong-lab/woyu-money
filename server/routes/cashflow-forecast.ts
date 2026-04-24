/**
 * 現金流預估 API（第 9 步）
 *
 * GET /api/cashflow/forecast?monthsAhead=6
 *   整合：
 *   - 歷史月度收入（daily_revenues 聚合近 24 月）
 *   - 預估月度支出（未付 payment_items 依 dueDate 分月）
 *   - 呼叫 shared/revenue-forecaster 產生預估 + 缺口分析
 */

import { Router } from "express"
import { z } from "zod"
import { asyncHandler, errors } from "../middleware/error-handler"
import {
  forecastRevenue,
  analyzeCashflowGap,
  type MonthlyRevenue,
  type MonthlyExpense,
} from "@shared/revenue-forecaster"

const router = Router()

const querySchema = z.object({
  monthsAhead: z.preprocess(
    (v) => (v === undefined ? undefined : Number(v)),
    z.number().int().min(1).max(12).optional()
  ),
})

interface RevenueRow {
  year: number
  month: number
  amount: string | number
}
interface ExpenseRow {
  year: number
  month: number
  amount: string | number
}

const REVENUE_SQL = `
  SELECT
    EXTRACT(YEAR FROM date)::int AS "year",
    EXTRACT(MONTH FROM date)::int AS "month",
    SUM(amount::numeric) AS "amount"
  FROM daily_revenues
  WHERE date >= (CURRENT_DATE - INTERVAL '24 months')
  GROUP BY 1, 2
  ORDER BY 1, 2
`

const EXPENSE_SQL = `
  SELECT
    EXTRACT(YEAR FROM d)::int AS "year",
    EXTRACT(MONTH FROM d)::int AS "month",
    SUM(unpaid)::numeric AS "amount"
  FROM (
    SELECT
      COALESCE(
        (SELECT ps.scheduled_date FROM payment_schedules ps
          WHERE ps.payment_item_id = pi.id AND ps.status != 'completed'
          ORDER BY ps.scheduled_date ASC LIMIT 1),
        pi.end_date,
        pi.start_date
      ) AS d,
      (pi.total_amount::numeric - COALESCE(pi.paid_amount, 0)::numeric) AS unpaid
    FROM payment_items pi
    WHERE pi.is_deleted = false
      AND COALESCE(pi.status, 'pending') != 'paid'
      AND (pi.total_amount::numeric - COALESCE(pi.paid_amount, 0)::numeric) > 0
  ) AS x
  WHERE d IS NOT NULL AND d >= CURRENT_DATE - INTERVAL '1 month'
  GROUP BY 1, 2
  ORDER BY 1, 2
`

function toRevenue(row: RevenueRow): MonthlyRevenue {
  return { year: row.year, month: row.month, amount: Number(row.amount) }
}
function toExpense(row: ExpenseRow): MonthlyExpense {
  return { year: row.year, month: row.month, amount: Number(row.amount) }
}

router.get(
  "/api/cashflow/forecast",
  asyncHandler(async (req, res) => {
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      throw errors.badRequest("monthsAhead 參數錯誤（1-12 整數）")
    }
    const monthsAhead = parsed.data.monthsAhead ?? 6

    const { pool } = await import("../db")
    const [revResult, expResult] = await Promise.all([
      pool.query<RevenueRow>(REVENUE_SQL),
      pool.query<ExpenseRow>(EXPENSE_SQL),
    ])

    const history = revResult.rows.map(toRevenue)
    const expenses = expResult.rows.map(toExpense)

    const now = new Date()
    const forecast = forecastRevenue(history, now.getFullYear(), now.getMonth() + 1, monthsAhead)
    const gapAnalysis = analyzeCashflowGap(forecast, expenses)

    res.json({
      generatedAt: now.toISOString(),
      monthsAhead,
      history,
      forecast,
      gapAnalysis,
      hasShortage: gapAnalysis.some((g) => g.gap !== undefined),
    })
  })
)

// ─────────────────────────────────────────────
// GET /api/cashflow/month-detail?year=YYYY&month=MM
// 回傳該月所有未付清項目（依 dueDate 推算），給展開明細用
// ─────────────────────────────────────────────

const monthDetailQuerySchema = z.object({
  year: z.preprocess(
    (v) => (v === undefined ? undefined : Number(v)),
    z.number().int().min(2000).max(2100)
  ),
  month: z.preprocess(
    (v) => (v === undefined ? undefined : Number(v)),
    z.number().int().min(1).max(12)
  ),
})

interface MonthItemRow {
  id: number
  itemName: string
  totalAmount: string | number
  paidAmount: string | number
  dueDate: string
  projectName: string | null
  categoryName: string | null
}

const MONTH_ITEMS_SQL = `
  SELECT
    pi.id,
    pi.item_name AS "itemName",
    pi.total_amount AS "totalAmount",
    COALESCE(pi.paid_amount, 0) AS "paidAmount",
    COALESCE(
      (
        SELECT ps.scheduled_date::text
        FROM payment_schedules ps
        WHERE ps.payment_item_id = pi.id AND ps.status != 'completed'
        ORDER BY ps.scheduled_date ASC LIMIT 1
      ),
      pi.end_date::text,
      pi.start_date::text
    ) AS "dueDate",
    pp.project_name AS "projectName",
    COALESCE(fc.category_name, dc.category_name) AS "categoryName"
  FROM payment_items pi
  LEFT JOIN payment_projects pp ON pp.id = pi.project_id
  LEFT JOIN fixed_categories fc ON fc.id = pi.fixed_category_id
  LEFT JOIN debt_categories dc ON dc.id = pi.category_id
  WHERE pi.is_deleted = false
    AND COALESCE(pi.status, 'pending') != 'paid'
    AND (pi.total_amount::numeric - COALESCE(pi.paid_amount, 0)::numeric) > 0
    AND EXTRACT(YEAR FROM COALESCE(
      (SELECT ps.scheduled_date FROM payment_schedules ps
        WHERE ps.payment_item_id = pi.id AND ps.status != 'completed'
        ORDER BY ps.scheduled_date ASC LIMIT 1),
      pi.end_date,
      pi.start_date
    )) = $1
    AND EXTRACT(MONTH FROM COALESCE(
      (SELECT ps.scheduled_date FROM payment_schedules ps
        WHERE ps.payment_item_id = pi.id AND ps.status != 'completed'
        ORDER BY ps.scheduled_date ASC LIMIT 1),
      pi.end_date,
      pi.start_date
    )) = $2
  ORDER BY (pi.total_amount::numeric - COALESCE(pi.paid_amount, 0)::numeric) DESC
  LIMIT 100
`

router.get(
  "/api/cashflow/month-detail",
  asyncHandler(async (req, res) => {
    const parsed = monthDetailQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw errors.badRequest("year/month 參數錯誤")
    }
    const { year, month } = parsed.data
    const { pool } = await import("../db")
    const result = await pool.query<MonthItemRow>(MONTH_ITEMS_SQL, [year, month])

    const items = result.rows.map((row) => ({
      id: row.id,
      itemName: row.itemName,
      totalAmount: Number(row.totalAmount),
      paidAmount: Number(row.paidAmount),
      unpaidAmount: Number(row.totalAmount) - Number(row.paidAmount),
      dueDate: row.dueDate,
      projectName: row.projectName,
      categoryName: row.categoryName,
    }))
    const totalUnpaid = items.reduce((s, i) => s + i.unpaidAmount, 0)

    res.json({ year, month, count: items.length, totalUnpaid, items })
  })
)

export default router
