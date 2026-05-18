/**
 * 財務綜合儀表板 API
 *
 * GET /api/dashboard/ytd — 今年迄今收入/支出/淨利 + 月度明細
 */
import { Router } from "express"
import { asyncHandler } from "../middleware/error-handler"
import { db } from "../db"
import { sql } from "drizzle-orm"

const router = Router()

router.get(
  "/api/dashboard/ytd",
  asyncHandler(async (_req, res) => {
    const now = new Date()
    const yearStart = `${now.getFullYear()}-01-01`
    const today = now.toISOString().slice(0, 10)

    // 月度明細
    const rows = await db.execute(sql`
      WITH income AS (
        SELECT TO_CHAR(start_date, 'YYYY-MM') AS m, SUM(total_amount::numeric)::bigint AS amt
        FROM payment_items
        WHERE item_type = 'income' AND NOT is_deleted
          AND start_date >= ${yearStart}::date AND start_date <= ${today}::date
        GROUP BY 1
      ),
      expense AS (
        SELECT TO_CHAR(start_date, 'YYYY-MM') AS m, SUM(total_amount::numeric)::bigint AS amt
        FROM payment_items
        WHERE item_type IN ('project', 'home') AND NOT is_deleted
          AND start_date >= ${yearStart}::date AND start_date <= ${today}::date
        GROUP BY 1
      )
      SELECT COALESCE(i.m, e.m) AS month,
             COALESCE(i.amt, 0)::int AS income,
             COALESCE(e.amt, 0)::int AS expense,
             (COALESCE(i.amt, 0) - COALESCE(e.amt, 0))::int AS profit
      FROM income i FULL OUTER JOIN expense e ON i.m = e.m
      ORDER BY month
    `)

    const months = (
      rows as unknown as {
        rows: Array<{ month: string; income: number; expense: number; profit: number }>
      }
    ).rows
    const totals = months.reduce(
      (acc, m) => ({
        income: acc.income + (m.income || 0),
        expense: acc.expense + (m.expense || 0),
        profit: acc.profit + (m.profit || 0),
      }),
      { income: 0, expense: 0, profit: 0 }
    )

    res.json({
      ...totals,
      months,
    })
  })
)

export default router
