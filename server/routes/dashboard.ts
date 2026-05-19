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
    //
    // expense 計算合併兩個來源、避免 payment_items 內薪資項與 monthly_hr_costs 不一致：
    // 1. payment_items 排除「人力成本」專案下的所有薪資 / 勞健保 / 勞退項目
    //    + 排除 item_name LIKE '%薪資%' OR '%薪水%' OR '%勞保%' OR '%勞退%' OR '%健保%'
    // 2. monthly_hr_costs.total_cost 月度合計（HR 的 source of truth、完整 8 員工）
    const rows = await db.execute(sql`
      WITH income AS (
        SELECT TO_CHAR(start_date, 'YYYY-MM') AS m, SUM(total_amount::numeric)::bigint AS amt
        FROM payment_items
        WHERE item_type = 'income' AND NOT is_deleted
          AND start_date >= ${yearStart}::date AND start_date <= ${today}::date
        GROUP BY 1
      ),
      expense_non_hr AS (
        SELECT
          TO_CHAR(pi.start_date, 'YYYY-MM') AS m,
          SUM(pi.total_amount::numeric)::bigint AS amt
        FROM payment_items pi
        LEFT JOIN payment_projects pp ON pi.project_id = pp.id
        WHERE pi.item_type IN ('project', 'home') AND NOT pi.is_deleted
          AND pi.start_date >= ${yearStart}::date AND pi.start_date <= ${today}::date
          -- 排除「人力成本」專案下的所有項目（避免與 monthly_hr_costs 重複）
          AND (pp.project_name IS NULL OR pp.project_name != '人力成本')
          -- 排除其他專案下、看起來是薪資 / 勞健保的項目（房務/客務薪資）
          AND pi.item_name NOT LIKE '%薪資%'
          AND pi.item_name NOT LIKE '%薪水%'
          AND pi.item_name NOT LIKE '%勞保%'
          AND pi.item_name NOT LIKE '%勞退%'
          AND pi.item_name NOT LIKE '%健保%'
          AND pi.item_name NOT LIKE '%房務薪%'
          AND pi.item_name NOT LIKE '%客務薪%'
        GROUP BY 1
      ),
      expense_hr AS (
        SELECT
          (year || '-' || LPAD(month::text, 2, '0')) AS m,
          SUM(total_cost::numeric)::bigint AS amt
        FROM monthly_hr_costs
        WHERE year >= EXTRACT(year FROM ${yearStart}::date)
        GROUP BY 1
      ),
      expense AS (
        SELECT
          COALESCE(n.m, h.m) AS m,
          (COALESCE(n.amt, 0) + COALESCE(h.amt, 0))::bigint AS amt
        FROM expense_non_hr n
        FULL OUTER JOIN expense_hr h ON n.m = h.m
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

    // 每月分類明細（expense 按分類、income 按專案；HR 從 monthly_hr_costs 顯示為「人事成本（HR）」）
    const breakdownRows = await db.execute(sql`
      WITH expense_by_cat AS (
        SELECT
          TO_CHAR(pi.start_date, 'YYYY-MM') AS month,
          COALESCE(dc.category_name, fc.category_name, '(未分類)') AS category,
          SUM(pi.total_amount::numeric)::bigint AS amt,
          COUNT(*)::int AS n
        FROM payment_items pi
        LEFT JOIN debt_categories dc ON pi.category_id = dc.id
        LEFT JOIN fixed_categories fc ON pi.fixed_category_id = fc.id
        LEFT JOIN payment_projects pp ON pi.project_id = pp.id
        WHERE pi.item_type IN ('project', 'home') AND NOT pi.is_deleted
          AND pi.start_date >= ${yearStart}::date AND pi.start_date <= ${today}::date
          -- 排除「人力成本」項目（由 monthly_hr_costs 統一顯示）
          AND (pp.project_name IS NULL OR pp.project_name != '人力成本')
          AND pi.item_name NOT LIKE '%薪資%'
          AND pi.item_name NOT LIKE '%薪水%'
          AND pi.item_name NOT LIKE '%勞保%'
          AND pi.item_name NOT LIKE '%勞退%'
          AND pi.item_name NOT LIKE '%健保%'
          AND pi.item_name NOT LIKE '%房務薪%'
          AND pi.item_name NOT LIKE '%客務薪%'
        GROUP BY 1, 2
      ),
      hr_by_month AS (
        SELECT
          (year || '-' || LPAD(month::text, 2, '0')) AS month,
          '人事成本（HR）' AS category,
          SUM(total_cost::numeric)::bigint AS amt,
          COUNT(*)::int AS n
        FROM monthly_hr_costs
        WHERE year >= EXTRACT(year FROM ${yearStart}::date)
        GROUP BY 1
      ),
      income_by_proj AS (
        SELECT
          TO_CHAR(pi.start_date, 'YYYY-MM') AS month,
          COALESCE(pp.project_name, '(未指定)') AS category,
          SUM(pi.total_amount::numeric)::bigint AS amt,
          COUNT(*)::int AS n
        FROM payment_items pi
        LEFT JOIN payment_projects pp ON pi.project_id = pp.id
        WHERE pi.item_type = 'income' AND NOT pi.is_deleted
          AND pi.start_date >= ${yearStart}::date AND pi.start_date <= ${today}::date
        GROUP BY 1, 2
      )
      SELECT 'expense' AS kind, month, category, amt::bigint, n FROM expense_by_cat
      UNION ALL
      SELECT 'expense' AS kind, month, category, amt, n FROM hr_by_month
      UNION ALL
      SELECT 'income' AS kind, month, category, amt::bigint, n FROM income_by_proj
      ORDER BY kind, month, amt DESC
    `)

    const breakdownArr = (
      breakdownRows as unknown as {
        rows: Array<{ kind: string; month: string; category: string; amt: number; n: number }>
      }
    ).rows

    // 按 month 群組 breakdown
    const breakdown: Record<
      string,
      {
        expense: Array<{ category: string; amount: number; count: number }>
        income: Array<{ category: string; amount: number; count: number }>
      }
    > = {}
    for (const r of breakdownArr) {
      if (!breakdown[r.month]) breakdown[r.month] = { expense: [], income: [] }
      const arr = r.kind === "expense" ? breakdown[r.month].expense : breakdown[r.month].income
      arr.push({ category: r.category, amount: Number(r.amt), count: r.n })
    }

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
      breakdown,
    })
  })
)

export default router
