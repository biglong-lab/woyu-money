/**
 * 財務綜合儀表板 API
 *
 * GET /api/dashboard/ytd — 今年迄今收入/支出/淨利 + 月度明細
 */
import { Router } from "express"
import { asyncHandler } from "../middleware/error-handler"
import { db } from "../db"
import { sql } from "drizzle-orm"
import { getSeasonalForecast } from "../storage/forecast-snapshots"

const router = Router()

router.get(
  "/api/dashboard/ytd",
  asyncHandler(async (_req, res) => {
    const now = new Date()
    const yearStart = `${now.getFullYear()}-01-01`
    const today = now.toISOString().slice(0, 10)
    // 月度上限抓到「本月後 6 個月」止、避免把太遠未來合約全列進來，又能涵蓋
    // template_scheduled 占位 + 分期付款（如 12 期租金）的未來幾個月預定
    const lookaheadEnd = new Date(now.getFullYear(), now.getMonth() + 7, 0)
      .toISOString()
      .slice(0, 10)

    // 月度明細
    //
    // 區分「actual（實際發生、start_date <= today）」與「planned（預定未到日、start_date > today）」
    // - 走勢圖可堆疊顯示
    // - YTD totals 只算 actual（避免未到日的預定膨脹數字）
    //
    // 重要：模板自動產出占位（source='template_scheduled'、status='unpaid'）
    // 強制歸 planned、不管 start_date 是否到日 — 因為這些只是估算占位、不是實際支付。
    // 使用者要在 /recurring-expenses 「填入實際金額」介面取代為 paid 才算 actual。
    //
    // expense 計算合併兩個來源、避免 payment_items 內薪資項與 monthly_hr_costs 不一致：
    // 1. payment_items 排除「人力成本」專案下的所有薪資 / 勞健保 / 勞退項目
    // 2. monthly_hr_costs.total_cost 月度合計（HR 的 source of truth、完整 8 員工）
    const rows = await db.execute(sql`
      WITH income_split AS (
        SELECT TO_CHAR(start_date, 'YYYY-MM') AS m,
               SUM(CASE WHEN start_date <= ${today}::date THEN total_amount::numeric ELSE 0 END)::bigint AS actual,
               SUM(CASE WHEN start_date >  ${today}::date THEN total_amount::numeric ELSE 0 END)::bigint AS planned
        FROM payment_items
        WHERE item_type = 'income' AND NOT is_deleted
          AND start_date >= ${yearStart}::date AND start_date <= ${lookaheadEnd}::date
        GROUP BY 1
      ),
      expense_non_hr_split AS (
        SELECT
          TO_CHAR(pi.start_date, 'YYYY-MM') AS m,
          SUM(CASE
            WHEN pi.start_date <= ${today}::date
             AND NOT (pi.source = 'template_scheduled' AND pi.status = 'unpaid')
            THEN pi.total_amount::numeric ELSE 0 END)::bigint AS actual,
          SUM(CASE
            WHEN pi.start_date >  ${today}::date
              OR (pi.source = 'template_scheduled' AND pi.status = 'unpaid')
            THEN pi.total_amount::numeric ELSE 0 END)::bigint AS planned
        FROM payment_items pi
        LEFT JOIN payment_projects pp ON pi.project_id = pp.id
        WHERE pi.item_type IN ('project', 'home') AND NOT pi.is_deleted
          AND pi.start_date >= ${yearStart}::date AND pi.start_date <= ${lookaheadEnd}::date
          AND (pp.project_name IS NULL OR pp.project_name != '人力成本')
          AND pi.item_name NOT LIKE '%薪資%'
          AND pi.item_name NOT LIKE '%薪水%'
          AND pi.item_name NOT LIKE '%勞保%'
          AND pi.item_name NOT LIKE '%勞退%'
          AND pi.item_name NOT LIKE '%健保%'
          AND pi.item_name NOT LIKE '%房務薪%'
          AND pi.item_name NOT LIKE '%客務薪%'
          AND (pi.notes IS NULL OR pi.notes NOT LIKE '%自動補建%')
        GROUP BY 1
      ),
      expense_hr AS (
        -- HR 不分 actual/planned（monthly_hr_costs 是每月結算事實、含當月全部）
        -- 但本月超過今天的 HR 也視為 actual（已發生事實、是月結結果）
        SELECT
          (year || '-' || LPAD(month::text, 2, '0')) AS m,
          SUM(total_cost::numeric)::bigint AS amt
        FROM monthly_hr_costs
        WHERE year >= EXTRACT(year FROM ${yearStart}::date)
        GROUP BY 1
      ),
      -- 該月 active 模板中、無對應 payment_item 的「未產出」估算金額
      -- 加入 expense.planned 對齊 /cost-overview（看到完整成本、不依賴是否手動產出占位）
      template_missing AS (
        WITH RECURSIVE month_series AS (
          SELECT ${yearStart}::date AS m
          UNION ALL
          SELECT (m + INTERVAL '1 month')::date FROM month_series WHERE m < ${lookaheadEnd}::date
        )
        SELECT
          TO_CHAR(ms.m, 'YYYY-MM') AS m,
          SUM(t.estimated_amount::numeric)::bigint AS amt
        FROM month_series ms
        CROSS JOIN recurring_expense_templates t
        WHERE t.is_active = true
          AND (
            t.active_months = '*'
            OR POSITION(',' || EXTRACT(MONTH FROM ms.m)::text || ',' IN
                        ',' || REPLACE(t.active_months, ' ', '') || ',') > 0
          )
          AND NOT EXISTS (
            SELECT 1 FROM payment_items pi
            WHERE pi.recurring_template_id = t.id
              AND TO_CHAR(pi.start_date, 'YYYY-MM') = TO_CHAR(ms.m, 'YYYY-MM')
              AND NOT pi.is_deleted
          )
        GROUP BY 1
      ),
      expense_split AS (
        SELECT
          COALESCE(n.m, h.m, tm.m) AS m,
          (COALESCE(n.actual, 0) + COALESCE(h.amt, 0))::bigint AS actual,
          (COALESCE(n.planned, 0) + COALESCE(tm.amt, 0))::bigint AS planned
        FROM expense_non_hr_split n
        FULL OUTER JOIN expense_hr h ON n.m = h.m
        FULL OUTER JOIN template_missing tm ON COALESCE(n.m, h.m) = tm.m
      )
      SELECT COALESCE(i.m, e.m) AS month,
             COALESCE(i.actual,  0)::int AS income_actual,
             COALESCE(i.planned, 0)::int AS income_planned,
             COALESCE(e.actual,  0)::int AS expense_actual,
             COALESCE(e.planned, 0)::int AS expense_planned,
             (COALESCE(i.actual, 0) - COALESCE(e.actual, 0))::int AS profit_actual,
             ((COALESCE(i.actual, 0) + COALESCE(i.planned, 0)) -
              (COALESCE(e.actual, 0) + COALESCE(e.planned, 0)))::int AS profit_total
      FROM income_split i FULL OUTER JOIN expense_split e ON i.m = e.m
      ORDER BY month
    `)

    interface MonthRow {
      month: string
      income_actual: number
      income_planned: number
      expense_actual: number
      expense_planned: number
      profit_actual: number
      profit_total: number
    }
    const monthsRaw = (rows as unknown as { rows: MonthRow[] }).rows

    // 收入：未來月份用 seasonal forecast pointEstimate 取代 payment_items income
    // （PMS bridge 寫的訂單 + 季節性歷史比率推算）
    const currentMonth = today.slice(0, 7)
    const futureMonths = monthsRaw.map((m) => m.month).filter((m) => m > currentMonth)
    const forecastByMonth: Record<string, number> = {}
    await Promise.all(
      futureMonths.map(async (m) => {
        try {
          const fc = await getSeasonalForecast(m, null, 6)
          forecastByMonth[m] = fc.pointEstimate
        } catch {
          // forecast 不可得時忽略、保留 payment_items income
        }
      })
    )

    // 向後相容：保留 income/expense/profit 欄位（= actual + planned）
    const months = monthsRaw.map((m) => {
      const isFuture = m.month > currentMonth
      // 未來月：用 seasonal forecast 取代 income_planned（若有預測值）
      const forecastIncome = isFuture ? (forecastByMonth[m.month] ?? 0) : 0
      const incomeActual = m.income_actual
      const incomePlanned = isFuture ? Math.max(forecastIncome, m.income_planned) : m.income_planned
      const totalIncome = incomeActual + incomePlanned
      const totalExpense = m.expense_actual + m.expense_planned
      return {
        month: m.month,
        income: totalIncome,
        expense: totalExpense,
        profit: totalIncome - totalExpense,
        incomeActual,
        incomePlanned,
        incomeForecast: forecastIncome, // 給前端標識「預測值」用
        expenseActual: m.expense_actual,
        expensePlanned: m.expense_planned,
        profitActual: m.profit_actual,
      }
    })

    // 每月分類明細，分 actual / planned
    const breakdownRows = await db.execute(sql`
      WITH expense_by_cat AS (
        SELECT
          TO_CHAR(pi.start_date, 'YYYY-MM') AS month,
          COALESCE(dc.category_name, fc.category_name, '(未分類)') AS category,
          SUM(CASE
            WHEN pi.start_date <= ${today}::date
             AND NOT (pi.source = 'template_scheduled' AND pi.status = 'unpaid')
            THEN pi.total_amount::numeric ELSE 0 END)::bigint AS actual,
          SUM(CASE
            WHEN pi.start_date >  ${today}::date
              OR (pi.source = 'template_scheduled' AND pi.status = 'unpaid')
            THEN pi.total_amount::numeric ELSE 0 END)::bigint AS planned,
          COUNT(*)::int AS n
        FROM payment_items pi
        LEFT JOIN debt_categories dc ON pi.category_id = dc.id
        LEFT JOIN fixed_categories fc ON pi.fixed_category_id = fc.id
        LEFT JOIN payment_projects pp ON pi.project_id = pp.id
        WHERE pi.item_type IN ('project', 'home') AND NOT pi.is_deleted
          AND pi.start_date >= ${yearStart}::date AND pi.start_date <= ${lookaheadEnd}::date
          AND (pp.project_name IS NULL OR pp.project_name != '人力成本')
          AND pi.item_name NOT LIKE '%薪資%'
          AND pi.item_name NOT LIKE '%薪水%'
          AND pi.item_name NOT LIKE '%勞保%'
          AND pi.item_name NOT LIKE '%勞退%'
          AND pi.item_name NOT LIKE '%健保%'
          AND pi.item_name NOT LIKE '%房務薪%'
          AND pi.item_name NOT LIKE '%客務薪%'
          AND (pi.notes IS NULL OR pi.notes NOT LIKE '%自動補建%')
        GROUP BY 1, 2
      ),
      hr_by_month AS (
        SELECT
          (year || '-' || LPAD(month::text, 2, '0')) AS month,
          '人事成本（HR）' AS category,
          SUM(total_cost::numeric)::bigint AS actual,
          0::bigint AS planned,
          COUNT(*)::int AS n
        FROM monthly_hr_costs
        WHERE year >= EXTRACT(year FROM ${yearStart}::date)
        GROUP BY 1
      ),
      income_by_proj AS (
        SELECT
          TO_CHAR(pi.start_date, 'YYYY-MM') AS month,
          COALESCE(pp.project_name, '(未指定)') AS category,
          SUM(CASE WHEN pi.start_date <= ${today}::date THEN pi.total_amount::numeric ELSE 0 END)::bigint AS actual,
          SUM(CASE WHEN pi.start_date >  ${today}::date THEN pi.total_amount::numeric ELSE 0 END)::bigint AS planned,
          COUNT(*)::int AS n
        FROM payment_items pi
        LEFT JOIN payment_projects pp ON pi.project_id = pp.id
        WHERE pi.item_type = 'income' AND NOT pi.is_deleted
          AND pi.start_date >= ${yearStart}::date AND pi.start_date <= ${lookaheadEnd}::date
        GROUP BY 1, 2
      ),
      template_missing_by_cat AS (
        -- 未產出模板 → 全部歸入「週期模板（未產出）」分類、全 planned
        WITH RECURSIVE month_series AS (
          SELECT ${yearStart}::date AS m
          UNION ALL
          SELECT (m + INTERVAL '1 month')::date FROM month_series WHERE m < ${lookaheadEnd}::date
        )
        SELECT
          TO_CHAR(ms.m, 'YYYY-MM') AS month,
          '週期模板（未產出）' AS category,
          0::bigint AS actual,
          SUM(t.estimated_amount::numeric)::bigint AS planned,
          COUNT(*)::int AS n
        FROM month_series ms
        CROSS JOIN recurring_expense_templates t
        WHERE t.is_active = true
          AND (
            t.active_months = '*'
            OR POSITION(',' || EXTRACT(MONTH FROM ms.m)::text || ',' IN
                        ',' || REPLACE(t.active_months, ' ', '') || ',') > 0
          )
          AND NOT EXISTS (
            SELECT 1 FROM payment_items pi
            WHERE pi.recurring_template_id = t.id
              AND TO_CHAR(pi.start_date, 'YYYY-MM') = TO_CHAR(ms.m, 'YYYY-MM')
              AND NOT pi.is_deleted
          )
        GROUP BY 1
      )
      SELECT * FROM (
        SELECT 'expense' AS kind, month, category, actual, planned, n FROM expense_by_cat
        UNION ALL
        SELECT 'expense' AS kind, month, category, actual, planned, n FROM hr_by_month
        UNION ALL
        SELECT 'expense' AS kind, month, category, actual, planned, n FROM template_missing_by_cat
        UNION ALL
        SELECT 'income' AS kind, month, category, actual, planned, n FROM income_by_proj
      ) t
      ORDER BY kind, month, (actual + planned) DESC
    `)

    interface BdRow {
      kind: string
      month: string
      category: string
      actual: number
      planned: number
      n: number
    }
    const breakdownArr = (breakdownRows as unknown as { rows: BdRow[] }).rows

    const breakdown: Record<
      string,
      {
        expense: Array<{
          category: string
          amount: number
          actual: number
          planned: number
          count: number
        }>
        income: Array<{
          category: string
          amount: number
          actual: number
          planned: number
          count: number
        }>
      }
    > = {}
    for (const r of breakdownArr) {
      if (!breakdown[r.month]) breakdown[r.month] = { expense: [], income: [] }
      const arr = r.kind === "expense" ? breakdown[r.month].expense : breakdown[r.month].income
      const actual = Number(r.actual)
      const planned = Number(r.planned)
      arr.push({
        category: r.category,
        amount: actual + planned, // 向後相容
        actual,
        planned,
        count: r.n,
      })
    }

    // YTD totals 只算 actual + 只算到本月（不含未到日 / 未來月的 planned）
    const totals = months.reduce(
      (acc, m) => {
        if (m.month > currentMonth) return acc
        return {
          income: acc.income + m.incomeActual,
          expense: acc.expense + m.expenseActual,
          profit: acc.profit + m.profitActual,
        }
      },
      { income: 0, expense: 0, profit: 0 }
    )

    res.json({
      ...totals,
      months,
      breakdown,
    })
  })
)

/**
 * 某月某分類的明細（給 dashboard 點擊查看）
 * GET /api/dashboard/month-detail?month=2026-05&category=租金
 * 特殊 category：「人事成本（HR）」會回傳 monthly_hr_costs 員工明細
 */
router.get(
  "/api/dashboard/month-detail",
  asyncHandler(async (req, res) => {
    const month = String(req.query.month || "")
    const category = String(req.query.category || "")
    const kind = String(req.query.kind || "expense") // expense | income

    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "month 格式 YYYY-MM" })
      return
    }
    const [year, mo] = month.split("-").map(Number)
    const monthStart = `${year}-${String(mo).padStart(2, "0")}-01`
    const nextMonth =
      mo === 12 ? `${year + 1}-01-01` : `${year}-${String(mo + 1).padStart(2, "0")}-01`

    // 特殊：人事成本（HR）→ 從 monthly_hr_costs
    if (category === "人事成本（HR）") {
      const hr = await db.execute(sql`
        SELECT
          m.employee_id,
          e.employee_name AS employee_name,
          e.position,
          m.base_salary::bigint AS base_salary,
          m.employer_total::bigint AS employer_total,
          m.net_salary::bigint AS net_salary,
          m.total_cost::bigint AS total_cost,
          m.is_paid
        FROM monthly_hr_costs m
        LEFT JOIN employees e ON e.id = m.employee_id
        WHERE m.year = ${year} AND m.month = ${mo}
        ORDER BY m.total_cost::numeric DESC
      `)
      res.json({
        source: "monthly_hr_costs",
        category,
        items: (hr as unknown as { rows: unknown[] }).rows,
      })
      return
    }

    // 一般：從 payment_items
    if (kind === "income") {
      const rows = await db.execute(sql`
        SELECT
          pi.id,
          pi.item_name,
          pi.total_amount::bigint AS amount,
          pi.start_date,
          pi.status,
          pp.project_name,
          pi.notes
        FROM payment_items pi
        LEFT JOIN payment_projects pp ON pi.project_id = pp.id
        WHERE pi.item_type = 'income' AND NOT pi.is_deleted
          AND pi.start_date >= ${monthStart}::date
          AND pi.start_date < ${nextMonth}::date
          AND COALESCE(pp.project_name, '(未指定)') = ${category}
        ORDER BY pi.total_amount::numeric DESC
      `)
      res.json({
        source: "payment_items",
        category,
        items: (rows as unknown as { rows: unknown[] }).rows,
      })
      return
    }

    const rows = await db.execute(sql`
      SELECT
        pi.id,
        pi.item_name,
        pi.total_amount::bigint AS amount,
        pi.paid_amount::bigint AS paid_amount,
        pi.start_date,
        pi.status,
        pi.source,
        pi.recurring_template_id AS "recurringTemplateId",
        pp.project_name,
        pi.notes,
        COALESCE(dc.category_name, fc.category_name, '(未分類)') AS cat_name
      FROM payment_items pi
      LEFT JOIN debt_categories dc ON pi.category_id = dc.id
      LEFT JOIN fixed_categories fc ON pi.fixed_category_id = fc.id
      LEFT JOIN payment_projects pp ON pi.project_id = pp.id
      WHERE pi.item_type IN ('project', 'home') AND NOT pi.is_deleted
        AND pi.start_date >= ${monthStart}::date
        AND pi.start_date < ${nextMonth}::date
        AND COALESCE(dc.category_name, fc.category_name, '(未分類)') = ${category}
        AND (pp.project_name IS NULL OR pp.project_name != '人力成本')
        AND pi.item_name NOT LIKE '%薪資%'
        AND pi.item_name NOT LIKE '%薪水%'
        AND pi.item_name NOT LIKE '%勞保%'
        AND pi.item_name NOT LIKE '%勞退%'
        AND pi.item_name NOT LIKE '%健保%'
        AND pi.item_name NOT LIKE '%房務薪%'
        AND pi.item_name NOT LIKE '%客務薪%'
        AND (pi.notes IS NULL OR pi.notes NOT LIKE '%自動補建%')
      ORDER BY pi.total_amount::numeric DESC
    `)
    res.json({
      source: "payment_items",
      category,
      items: (rows as unknown as { rows: unknown[] }).rows,
    })
  })
)

export default router
