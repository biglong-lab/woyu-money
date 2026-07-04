/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 03，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"
import { parseYearMonth } from "./helpers"

const router = Router()

router.put(
  "/api/household/templates/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")
    const body = req.body ?? {}
    const amt =
      body.amount !== undefined && body.amount !== null ? parseFloat(String(body.amount)) : null
    if (amt !== null && (isNaN(amt) || amt < 0)) throw new AppError(400, "金額需為正數")
    const result = await db.execute(sql`
      UPDATE household_expense_templates
      SET
        name           = COALESCE(${body.name ?? null}, name),
        emoji          = COALESCE(${body.emoji ?? null}, emoji),
        amount         = COALESCE(${amt}, amount),
        category_id    = COALESCE(${body.categoryId ?? null}, category_id),
        payment_method = COALESCE(${body.paymentMethod ?? null}, payment_method),
        description    = COALESCE(${body.description ?? null}, description),
        day_of_month   = COALESCE(${body.dayOfMonth ?? null}, day_of_month),
        sort_order     = COALESCE(${body.sortOrder ?? null}, sort_order),
        updated_at     = NOW()
      WHERE id = ${id}
      RETURNING id, name, amount::text AS amount
    `)
    const row = (result as unknown as { rows: { id: number }[] }).rows[0]
    if (!row) throw new AppError(404, "找不到範本")
    res.json(row)
  })
)

router.delete(
  "/api/household/templates/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")
    const result = await db.execute(sql`
      UPDATE household_expense_templates
      SET is_active = false, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `)
    const row = (result as unknown as { rows: { id: number }[] }).rows[0]
    if (!row) throw new AppError(404, "找不到範本")
    res.json({ success: true, id: row.id })
  })
)

/**
 * GET /api/household/suggest-category?description=xxx&limit=3
 * 依過去 90 天記帳的 description → categoryId 統計、回最可能分類
 *
 * 演算法：
 *  1. 完全相符（LOWER 比較）權重 ×5
 *  2. 子字串包含（LIKE %xxx%）權重 ×3
 *  3. 字根命中（單一字 token 命中）權重 ×1
 *  4. 同筆 expense 只計 1 次（避免某 description 重複扭曲）
 *  5. 回前 N 個分類、含 categoryName + score
 */
router.get(
  "/api/household/suggest-category",
  asyncHandler(async (req, res) => {
    const desc = ((req.query.description as string) || "").trim()
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "3", 10), 1), 10)
    if (desc.length < 1) {
      return res.json({ description: desc, suggestions: [] })
    }
    const lower = desc.toLowerCase()
    // SQL LIKE pattern：%input%
    const likePattern = `%${lower}%`

    const rows = await db.execute(sql`
      WITH scored AS (
        SELECT
          he.category_id,
          COALESCE(fc.category_name, '(未分類)') AS category_name,
          SUM(CASE
            WHEN LOWER(he.description) = ${lower} THEN 5
            WHEN LOWER(he.description) LIKE ${likePattern} THEN 3
            WHEN LOWER(${lower}) LIKE '%' || LOWER(he.description) || '%' AND LENGTH(he.description) >= 2 THEN 2
            ELSE 0
          END)::int AS score,
          COUNT(*)::int AS occurrences
        FROM household_expenses he
        LEFT JOIN fixed_categories fc ON he.category_id = fc.id
        WHERE NOT he.is_deleted AND he.date >= NOW() - INTERVAL '90 days'
          AND he.category_id IS NOT NULL
          AND he.description IS NOT NULL
          AND he.description <> ''
        GROUP BY he.category_id, fc.category_name
        HAVING SUM(CASE
            WHEN LOWER(he.description) = ${lower} THEN 5
            WHEN LOWER(he.description) LIKE ${likePattern} THEN 3
            WHEN LOWER(${lower}) LIKE '%' || LOWER(he.description) || '%' AND LENGTH(he.description) >= 2 THEN 2
            ELSE 0
          END) > 0
      )
      SELECT
        category_id AS "categoryId",
        category_name AS "categoryName",
        score,
        occurrences
      FROM scored
      ORDER BY score DESC, occurrences DESC
      LIMIT ${limit}
    `)
    res.json({
      description: desc,
      suggestions: (rows as unknown as { rows: unknown[] }).rows,
    })
  })
)

/**
 * GET /api/household/top-categories?limit=6&days=30
 * 取過去 N 天最常用的分類（依筆數排序）
 * 用於 quick add 介面置頂 N 個常用分類
 */
router.get(
  "/api/household/top-categories",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "6", 10), 1), 20)
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 1), 365)
    const rows = await db.execute(sql`
      SELECT
        he.category_id AS "categoryId",
        COALESCE(fc.category_name, '(未分類)') AS "categoryName",
        '#9CA3AF' AS color,
        COUNT(*)::int AS uses,
        COALESCE(SUM(he.amount::numeric), 0)::text AS "totalAmount",
        MAX(he.date)::text AS "lastUsedAt"
      FROM household_expenses he
      LEFT JOIN fixed_categories fc ON he.category_id = fc.id
      WHERE NOT he.is_deleted AND he.date >= NOW() - (${days}::int * INTERVAL '1 day')
        AND he.category_id IS NOT NULL
      GROUP BY he.category_id, fc.category_name
      ORDER BY uses DESC, MAX(he.date) DESC
      LIMIT ${limit}
    `)
    res.json((rows as unknown as { rows: unknown[] }).rows)
  })
)

/**
 * GET /api/household/ai-insights?month=YYYY-MM
 * 純規則洞察：4-6 條本月消費觀察
 *  - 預算使用率 vs 月過時間
 *  - 最大分類佔比（> 30% flag）
 *  - 與上月顯著差異（±20%）
 *  - Top 1 大筆（> 本月 15%）
 *  - 高頻分類（筆數）
 *  - 沒設預算的提醒
 */
router.get(
  "/api/household/ai-insights",
  asyncHandler(async (req, res) => {
    const { year, month } = parseYearMonth(req.query.month as string | undefined)
    const monthStr = `${year}-${String(month).padStart(2, "0")}`
    const startDate = `${monthStr}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const endDate = `${endY}-${String(endM).padStart(2, "0")}-01`
    const prevY = month === 1 ? year - 1 : year
    const prevM = month === 1 ? 12 : month - 1
    const prevStart = `${prevY}-${String(prevM).padStart(2, "0")}-01`

    // 預算
    const budgetRows = await db.execute(sql`
      SELECT budget_amount::text AS amt FROM household_budgets
      WHERE year = ${year} AND month = ${month} AND is_total_budget = true
      LIMIT 1
    `)
    const budgetAmount = parseFloat(
      (budgetRows as unknown as { rows: { amt: string }[] }).rows[0]?.amt ?? "0"
    )

    // 本月 / 上月 sum
    const sumRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN date >= ${startDate}::date AND date < ${endDate}::date THEN amount::numeric ELSE 0 END), 0)::text AS curr,
        COALESCE(SUM(CASE WHEN date >= ${prevStart}::date AND date < ${startDate}::date THEN amount::numeric ELSE 0 END), 0)::text AS prev,
        COUNT(*) FILTER (WHERE date >= ${startDate}::date AND date < ${endDate}::date)::int AS curr_count
      FROM household_expenses
      WHERE NOT is_deleted AND date >= ${prevStart}::date AND date < ${endDate}::date
    `)
    const sr = (
      sumRows as unknown as { rows: { curr: string; prev: string; curr_count: number }[] }
    ).rows[0]
    const currTotal = parseFloat(sr?.curr ?? "0")
    const prevTotal = parseFloat(sr?.prev ?? "0")
    const currCount = sr?.curr_count ?? 0

    // 本月分類
    const catRows = await db.execute(sql`
      SELECT
        COALESCE(fc.category_name, '(未分類)') AS name,
        COALESCE(SUM(he.amount::numeric), 0)::text AS amt,
        COUNT(*)::int AS cnt
      FROM household_expenses he
      LEFT JOIN fixed_categories fc ON he.category_id = fc.id
      WHERE NOT he.is_deleted AND he.date >= ${startDate}::date AND he.date < ${endDate}::date
      GROUP BY fc.category_name
      ORDER BY SUM(he.amount::numeric) DESC
    `)
    const cats = (
      catRows as unknown as { rows: { name: string; amt: string; cnt: number }[] }
    ).rows.map((r) => ({ name: r.name, amount: parseFloat(r.amt), count: r.cnt }))

    // 最大筆
    const topRows = await db.execute(sql`
      SELECT amount::text AS amt, description, date::text AS d
      FROM household_expenses
      WHERE NOT is_deleted AND date >= ${startDate}::date AND date < ${endDate}::date
      ORDER BY amount::numeric DESC
      LIMIT 1
    `)
    const top = (
      topRows as unknown as { rows: { amt: string; description: string | null; d: string }[] }
    ).rows[0]

    const insights: Array<{
      tone: "info" | "good" | "warn" | "alert"
      icon: string
      title: string
      detail: string
    }> = []

    // 1. 預算進度
    if (budgetAmount > 0) {
      const today = new Date()
      const isCurrMonth = today.getFullYear() === year && today.getMonth() + 1 === month
      const daysInMonth = new Date(year, month, 0).getDate()
      const dayOfMonth = isCurrMonth ? today.getDate() : daysInMonth
      const timeProgress = Math.round((dayOfMonth / daysInMonth) * 100)
      const usagePct = Math.round((currTotal / budgetAmount) * 100)
      const diff = usagePct - timeProgress
      if (usagePct >= 100) {
        insights.push({
          tone: "alert",
          icon: "🚨",
          title: "預算已超支",
          detail: `已用 ${usagePct}% 預算（NT$ ${Math.round(currTotal).toLocaleString()} / ${Math.round(budgetAmount).toLocaleString()}）、超出 NT$ ${Math.round(currTotal - budgetAmount).toLocaleString()}`,
        })
      } else if (diff > 15) {
        insights.push({
          tone: "warn",
          icon: "⚠️",
          title: "花得比進度快",
          detail: `已用 ${usagePct}% 預算、但月份才過 ${timeProgress}%、提前 ${diff} 個百分點、依此速度恐超支`,
        })
      } else if (diff < -15 && isCurrMonth) {
        insights.push({
          tone: "good",
          icon: "✅",
          title: "節約有方",
          detail: `已用 ${usagePct}% 預算、月份過 ${timeProgress}%、保持下去可剩 NT$ ${Math.round(budgetAmount - (currTotal / dayOfMonth) * daysInMonth).toLocaleString()}`,
        })
      } else {
        insights.push({
          tone: "info",
          icon: "📊",
          title: "預算節奏正常",
          detail: `已用 ${usagePct}% 預算、月份過 ${timeProgress}%、節奏一致`,
        })
      }
    } else {
      insights.push({
        tone: "warn",
        icon: "💡",
        title: "尚未設定本月預算",
        detail: "建議參考上月實際花費設定預算、可即時掌握開銷狀況",
      })
    }

    // 2. 最大分類佔比
    if (cats.length > 0 && currTotal > 0) {
      const top1 = cats[0]
      const pct = Math.round((top1.amount / currTotal) * 100)
      if (pct >= 30) {
        insights.push({
          tone: pct >= 50 ? "warn" : "info",
          icon: pct >= 50 ? "🎯" : "📌",
          title: `「${top1.name}」佔了 ${pct}%`,
          detail: `本月最大開銷分類 NT$ ${Math.round(top1.amount).toLocaleString()}（${top1.count} 筆）${pct >= 50 ? "、單一分類過高、可檢視是否合理" : ""}`,
        })
      }
    }

    // 3. 與上月差異
    if (prevTotal > 0 && currTotal > 0) {
      const diffPct = Math.round(((currTotal - prevTotal) / prevTotal) * 100)
      if (Math.abs(diffPct) >= 20) {
        const isUp = diffPct > 0
        insights.push({
          tone: isUp ? "warn" : "good",
          icon: isUp ? "📈" : "📉",
          title: isUp ? `比上月多花 ${diffPct}%` : `比上月省 ${Math.abs(diffPct)}%`,
          detail: `本月 NT$ ${Math.round(currTotal).toLocaleString()} vs 上月 NT$ ${Math.round(prevTotal).toLocaleString()}、差距 ${isUp ? "+" : ""}NT$ ${Math.round(currTotal - prevTotal).toLocaleString()}`,
        })
      }
    }

    // 4. Top 1 大筆
    if (top && currTotal > 0) {
      const topAmt = parseFloat(top.amt)
      const pct = Math.round((topAmt / currTotal) * 100)
      if (pct >= 15) {
        insights.push({
          tone: "info",
          icon: "💰",
          title: `單筆最大 NT$ ${Math.round(topAmt).toLocaleString()}`,
          detail: `${top.d.slice(0, 10)} · ${top.description ?? "(無說明)"}、佔本月 ${pct}%`,
        })
      }
    }

    // 5. 高頻分類（記帳次數最多）
    if (cats.length > 0) {
      const byCount = [...cats].sort((a, b) => b.count - a.count)
      const topFreq = byCount[0]
      if (topFreq.count >= 5) {
        insights.push({
          tone: "info",
          icon: "🔁",
          title: `「${topFreq.name}」記了 ${topFreq.count} 次`,
          detail: `本月最常記帳的分類、平均單筆 NT$ ${Math.round(topFreq.amount / topFreq.count).toLocaleString()}`,
        })
      }
    }

    // 6. 完全沒記
    if (currCount === 0) {
      insights.push({
        tone: "warn",
        icon: "📝",
        title: "本月還沒記過帳",
        detail: "趁記憶清楚時補上、保持記帳節奏比補後更有效",
      })
    }

    res.json({ month: monthStr, count: insights.length, insights })
  })
)

/**
 * GET /api/household/yearly-overview?endMonth=YYYY-MM
 * 過去 12 個月（含 endMonth）的花費 + 預算、用於年度回顧 widget
 */
router.get(
  "/api/household/yearly-overview",
  asyncHandler(async (req, res) => {
    const { year: endYear, month: endMonth } = parseYearMonth(
      req.query.endMonth as string | undefined
    )

    // 算 12 個月區間（含當月）
    const months: { year: number; month: number; monthStr: string }[] = []
    for (let i = 11; i >= 0; i--) {
      let y = endYear
      let m = endMonth - i
      while (m <= 0) {
        m += 12
        y -= 1
      }
      months.push({ year: y, month: m, monthStr: `${y}-${String(m).padStart(2, "0")}` })
    }

    const startStr = months[0].monthStr + "-01"
    const lastYear = months[11].year
    const lastMonth = months[11].month
    const endNextYear = lastMonth === 12 ? lastYear + 1 : lastYear
    const endNextMonth = lastMonth === 12 ? 1 : lastMonth + 1
    const endStr = `${endNextYear}-${String(endNextMonth).padStart(2, "0")}-01`

    // 一次撈 12 個月花費總和
    const spendRows = await db.execute(sql`
      SELECT to_char(date, 'YYYY-MM') AS m, COALESCE(SUM(amount::numeric), 0)::text AS amt
      FROM household_expenses
      WHERE NOT is_deleted AND date >= ${startStr}::date AND date < ${endStr}::date
      GROUP BY to_char(date, 'YYYY-MM')
    `)
    const spendMap = new Map<string, number>()
    for (const r of (spendRows as unknown as { rows: { m: string; amt: string }[] }).rows) {
      spendMap.set(r.m, parseFloat(r.amt))
    }

    // 一次撈 12 個月預算（categoryId=0 為總預算）
    const budgetRows = await db.execute(sql`
      SELECT year, month, budget_amount::text AS amt
      FROM household_budgets
      WHERE is_total_budget = true
        AND (year * 100 + month) >= ${months[0].year * 100 + months[0].month}
        AND (year * 100 + month) <= ${lastYear * 100 + lastMonth}
    `)
    const budgetMap = new Map<string, number>()
    for (const r of (
      budgetRows as unknown as { rows: { year: number; month: number; amt: string }[] }
    ).rows) {
      const key = `${r.year}-${String(r.month).padStart(2, "0")}`
      budgetMap.set(key, parseFloat(r.amt))
    }

    const items = months.map((m) => {
      const spent = spendMap.get(m.monthStr) ?? 0
      const budget = budgetMap.get(m.monthStr) ?? 0
      const overrun = budget > 0 && spent > budget
      const usagePct = budget > 0 ? Math.round((spent / budget) * 100) : null
      return {
        month: m.monthStr,
        spent: Math.round(spent),
        budget: Math.round(budget),
        overrun,
        usagePct,
      }
    })

    const totalSpent = items.reduce((s, i) => s + i.spent, 0)
    const totalBudget = items.reduce((s, i) => s + i.budget, 0)
    const monthsWithSpend = items.filter((i) => i.spent > 0).length
    const avgMonthly = monthsWithSpend > 0 ? Math.round(totalSpent / monthsWithSpend) : 0
    const overrunMonths = items.filter((i) => i.overrun).length
    const maxSpent = items.reduce((max, i) => Math.max(max, i.spent), 0)

    res.json({
      endMonth: months[11].monthStr,
      items,
      summary: {
        totalSpent,
        totalBudget,
        avgMonthly,
        overrunMonths,
        maxSpent,
        monthsTracked: monthsWithSpend,
      },
    })
  })
)

/**
 * GET /api/household/export?type=expenses|incomes|all&month=YYYY-MM
 * 匯出 CSV（UTF-8 + BOM、Excel 可直接開）
 *
 *   - type=expenses（預設）：本月支出
 *   - type=incomes：本月收入
 *   - type=all：兩者合併（多 type 欄）
 *   - month 未傳則本月
 */
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ""
  const s = String(v)
  // 含逗號 / 雙引號 / 換行 → 包雙引號、雙引號要 escape 成 ""
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

router.get(
  "/api/household/export",
  asyncHandler(async (req, res) => {
    const type = ((req.query.type as string) || "expenses").toLowerCase()
    if (!["expenses", "incomes", "all"].includes(type)) {
      throw new AppError(400, "type 需為 expenses | incomes | all")
    }
    const { year, month } = parseYearMonth(req.query.month as string | undefined)
    const monthStr = `${year}-${String(month).padStart(2, "0")}`
    const startDate = `${monthStr}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const endDate = `${endY}-${String(endM).padStart(2, "0")}-01`

    const rows: string[][] = []
    rows.push(["類型", "日期", "金額", "分類", "備註", "付款方式", "建立時間"])

    if (type === "expenses" || type === "all") {
      const expenseRows = await db.execute(sql`
        SELECT
          he.date::text AS date,
          he.amount::text AS amount,
          COALESCE(fc.category_name, '(未分類)') AS category,
          he.description,
          he.payment_method,
          he.created_at::text AS created_at
        FROM household_expenses he
        LEFT JOIN fixed_categories fc ON he.category_id = fc.id
        WHERE NOT he.is_deleted AND he.date >= ${startDate}::date AND he.date < ${endDate}::date
        ORDER BY he.date DESC, he.id DESC
      `)
      for (const r of (
        expenseRows as unknown as {
          rows: {
            date: string
            amount: string
            category: string
            description: string | null
            payment_method: string | null
            created_at: string
          }[]
        }
      ).rows) {
        rows.push([
          "支出",
          r.date.slice(0, 10),
          r.amount,
          r.category,
          r.description ?? "",
          r.payment_method ?? "",
          r.created_at.slice(0, 19).replace("T", " "),
        ])
      }
    }

    if (type === "incomes" || type === "all") {
      try {
        const incomeRows = await db.execute(sql`
          SELECT
            date::text AS date,
            amount::text AS amount,
            category,
            description,
            payment_method,
            created_at::text AS created_at
          FROM household_incomes
          WHERE date >= ${startDate}::date AND date < ${endDate}::date
          ORDER BY date DESC, id DESC
        `)
        for (const r of (
          incomeRows as unknown as {
            rows: {
              date: string
              amount: string
              category: string
              description: string | null
              payment_method: string
              created_at: string
            }[]
          }
        ).rows) {
          rows.push([
            "收入",
            r.date.slice(0, 10),
            r.amount,
            r.category,
            r.description ?? "",
            r.payment_method,
            r.created_at.slice(0, 19).replace("T", " "),
          ])
        }
      } catch (e) {
        process.stdout.write(`[export] incomes failed: ${(e as Error).message}\n`)
      }
    }

    // 組 CSV：用 \r\n（Excel for Windows 友善）
    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n")
    // UTF-8 BOM
    const body = "﻿" + csv + "\r\n"

    const filename = `household-${type}-${monthStr}.csv`
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.send(body)
  })
)

/**
 * GET /api/household/monthly-report?month=YYYY-MM
 * 回傳 markdown 月報、包含：預算 / 實際 / 分類佔比 / Top 10 大筆 / 上月對比
 * 月底自動結算 + 月初回顧用
 */
router.get(
  "/api/household/monthly-report",
  asyncHandler(async (req, res) => {
    const { year, month } = parseYearMonth(req.query.month as string | undefined)
    const monthStr = `${year}-${String(month).padStart(2, "0")}`
    const startDate = `${monthStr}-01`
    const endYear = month === 12 ? year + 1 : year
    const endMonth = month === 12 ? 1 : month + 1
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`

    // 上月區間（同期比較）
    const prevYear = month === 1 ? year - 1 : year
    const prevMonth = month === 1 ? 12 : month - 1
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`

    // 總預算
    const budgetRows = await db.execute(sql`
      SELECT budget_amount::text AS amt FROM household_budgets
      WHERE year = ${year} AND month = ${month} AND is_total_budget = true
      LIMIT 1
    `)
    const budgetAmount = parseFloat(
      (budgetRows as unknown as { rows: { amt: string }[] }).rows[0]?.amt ?? "0"
    )

    // 本月 + 上月 總計
    const sumRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN date >= ${startDate}::date AND date < ${endDate}::date THEN amount::numeric ELSE 0 END), 0)::text AS curr,
        COUNT(*) FILTER (WHERE date >= ${startDate}::date AND date < ${endDate}::date)::int AS curr_count,
        COALESCE(SUM(CASE WHEN date >= ${prevStart}::date AND date < ${startDate}::date THEN amount::numeric ELSE 0 END), 0)::text AS prev
      FROM household_expenses
      WHERE NOT is_deleted AND date >= ${prevStart}::date AND date < ${endDate}::date
    `)
    const sumR = (
      sumRows as unknown as {
        rows: { curr: string; curr_count: number; prev: string }[]
      }
    ).rows[0]
    const totalSpent = parseFloat(sumR?.curr ?? "0")
    const prevSpent = parseFloat(sumR?.prev ?? "0")
    const count = sumR?.curr_count ?? 0

    // 分類分布
    const catRows = await db.execute(sql`
      SELECT
        COALESCE(fc.category_name, '(未分類)') AS category_name,
        COALESCE(SUM(he.amount::numeric), 0)::text AS amt,
        COUNT(*)::int AS cnt
      FROM household_expenses he
      LEFT JOIN fixed_categories fc ON he.category_id = fc.id
      WHERE NOT he.is_deleted AND he.date >= ${startDate}::date AND he.date < ${endDate}::date
      GROUP BY fc.category_name
      ORDER BY SUM(he.amount::numeric) DESC
    `)
    const categories = (
      catRows as unknown as { rows: { category_name: string; amt: string; cnt: number }[] }
    ).rows.map((r) => ({
      name: r.category_name,
      amount: parseFloat(r.amt),
      count: r.cnt,
      pct: totalSpent > 0 ? Math.round((parseFloat(r.amt) / totalSpent) * 100) : 0,
    }))

    // Top 10 大筆
    const topRows = await db.execute(sql`
      SELECT
        he.date::text AS d,
        he.amount::text AS amt,
        he.description,
        COALESCE(fc.category_name, '(未分類)') AS category_name
      FROM household_expenses he
      LEFT JOIN fixed_categories fc ON he.category_id = fc.id
      WHERE NOT he.is_deleted AND he.date >= ${startDate}::date AND he.date < ${endDate}::date
      ORDER BY he.amount::numeric DESC
      LIMIT 10
    `)
    const top = (
      topRows as unknown as {
        rows: { d: string; amt: string; description: string | null; category_name: string }[]
      }
    ).rows

    // 組 Markdown
    const remaining = budgetAmount - totalSpent
    const usagePct = budgetAmount > 0 ? Math.round((totalSpent / budgetAmount) * 100) : 0
    const diff = totalSpent - prevSpent
    const diffPct = prevSpent > 0 ? Math.round((diff / prevSpent) * 100) : 0
    const trendEmoji = Math.abs(diffPct) < 5 ? "≈" : diff > 0 ? "📈" : "📉"

    const lines: string[] = []
    lines.push(`# ${monthStr} 家用記帳月報`)
    lines.push("")
    lines.push(`> 結算時間：${new Date().toISOString()}`)
    lines.push("")
    lines.push(`## 📊 整體`)
    lines.push("")
    lines.push(`| 項目 | 金額 |`)
    lines.push(`|------|------|`)
    lines.push(`| 預算 | NT$ ${Math.round(budgetAmount).toLocaleString()} |`)
    lines.push(`| 實際花費 | NT$ ${Math.round(totalSpent).toLocaleString()}（${count} 筆）|`)
    lines.push(
      `| ${remaining >= 0 ? "剩餘" : "超支"} | NT$ ${Math.round(Math.abs(remaining)).toLocaleString()} |`
    )
    lines.push(
      `| 預算使用率 | ${usagePct}% ${budgetAmount > 0 && usagePct > 100 ? "⚠️ 超支" : ""} |`
    )
    lines.push("")
    lines.push(`## 📈 與上月對比（${String(prevMonth).padStart(2, "0")} 月）`)
    lines.push("")
    lines.push(`- 上月花費：NT$ ${Math.round(prevSpent).toLocaleString()}`)
    lines.push(`- 本月花費：NT$ ${Math.round(totalSpent).toLocaleString()}`)
    lines.push(
      `- 變化：${trendEmoji} ${diff >= 0 ? "+" : ""}NT$ ${Math.round(diff).toLocaleString()}（${diffPct >= 0 ? "+" : ""}${diffPct}%）`
    )
    lines.push("")
    if (categories.length > 0) {
      lines.push(`## 🗂️ 分類佔比`)
      lines.push("")
      lines.push(`| 分類 | 金額 | 比例 | 筆數 |`)
      lines.push(`|------|------|------|------|`)
      for (const c of categories) {
        lines.push(
          `| ${c.name} | NT$ ${Math.round(c.amount).toLocaleString()} | ${c.pct}% | ${c.count} |`
        )
      }
      lines.push("")
    }
    if (top.length > 0) {
      lines.push(`## 🏆 Top 10 大筆`)
      lines.push("")
      lines.push(`| # | 日期 | 金額 | 分類 | 說明 |`)
      lines.push(`|---|------|------|------|------|`)
      top.forEach((t, i) => {
        lines.push(
          `| ${i + 1} | ${t.d.slice(0, 10)} | NT$ ${Math.round(parseFloat(t.amt)).toLocaleString()} | ${t.category_name} | ${(t.description ?? "—").replace(/\|/g, "\\|")} |`
        )
      })
      lines.push("")
    }
    lines.push(`---`)
    lines.push(`> 由 Money 自動生成 · /api/household/monthly-report?month=${monthStr}`)

    const markdown = lines.join("\n")

    // Content-Type 依 query
    if (req.query.format === "download") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8")
      res.setHeader("Content-Disposition", `attachment; filename="household-report-${monthStr}.md"`)
      res.send(markdown)
    } else {
      res.json({ month: monthStr, markdown })
    }
  })
)

export default router
