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

export default router
