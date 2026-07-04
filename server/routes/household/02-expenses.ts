/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 02，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"
import { deleteHouseholdExpense } from "../../storage/household"
import { parseYearMonth, formatYMD } from "./helpers"

const router = Router()

/**
 * DELETE /api/household/expenses/:id  (alias for /api/household-expenses/:id)
 * 給前端 /household-budget 頁直接刪除
 */
router.delete(
  "/api/household/expenses/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")
    await deleteHouseholdExpense(id)
    res.status(204).send()
  })
)

/**
 * 家用收入 endpoints
 *   GET    /api/household/incomes?month=YYYY-MM   列出（預設本月）
 *   POST   /api/household/incomes                 建立
 *   DELETE /api/household/incomes/:id             刪除
 *   GET    /api/household/incomes/summary?month=  本月收入總計 + 分類分布
 */
router.get(
  "/api/household/incomes",
  asyncHandler(async (req, res) => {
    const { year, month } = parseYearMonth(req.query.month as string | undefined)
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const endDate = `${endY}-${String(endM).padStart(2, "0")}-01`
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "200", 10), 1), 500)

    const rows = await db.execute(sql`
      SELECT
        id,
        family_id      AS "familyId",
        amount::text   AS amount,
        category,
        date::text     AS date,
        description,
        payment_method AS "paymentMethod",
        created_at     AS "createdAt"
      FROM household_incomes
      WHERE date >= ${startDate}::date AND date < ${endDate}::date
      ORDER BY date DESC, id DESC
      LIMIT ${limit}
    `)
    res.json((rows as unknown as { rows: unknown[] }).rows)
  })
)

router.post(
  "/api/household/incomes",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {}
    const amt = parseFloat(String(body.amount ?? ""))
    if (isNaN(amt) || amt <= 0) throw new AppError(400, "金額需為正數")
    const category = String(body.category ?? "").trim()
    if (!category) throw new AppError(400, "請選擇分類")
    const dateStr = String(body.date ?? "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new AppError(400, "日期格式 YYYY-MM-DD")

    const result = await db.execute(sql`
      INSERT INTO household_incomes
        (family_id, amount, category, date, description, payment_method, created_at, updated_at)
      VALUES
        (1, ${amt}, ${category}, ${dateStr}::date,
         ${body.description ?? null},
         ${body.paymentMethod ?? "bank_transfer"},
         NOW(), NOW())
      RETURNING id, amount::text AS amount, category, date::text AS date, description,
                payment_method AS "paymentMethod"
    `)
    res.status(201).json((result as unknown as { rows: unknown[] }).rows[0])
  })
)

router.delete(
  "/api/household/incomes/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")
    const result = await db.execute(sql`
      DELETE FROM household_incomes WHERE id = ${id}
      RETURNING id
    `)
    const row = (result as unknown as { rows: { id: number }[] }).rows[0]
    if (!row) throw new AppError(404, "找不到該筆收入")
    res.status(204).send()
  })
)

router.get(
  "/api/household/incomes/summary",
  asyncHandler(async (req, res) => {
    const { year, month } = parseYearMonth(req.query.month as string | undefined)
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const endDate = `${endY}-${String(endM).padStart(2, "0")}-01`

    const rows = await db.execute(sql`
      SELECT
        category,
        COALESCE(SUM(amount::numeric), 0)::text AS total,
        COUNT(*)::int AS count
      FROM household_incomes
      WHERE date >= ${startDate}::date AND date < ${endDate}::date
      GROUP BY category
      ORDER BY SUM(amount::numeric) DESC
    `)
    const list = (rows as unknown as { rows: { category: string; total: string; count: number }[] })
      .rows
    const totalIncome = list.reduce((s, r) => s + parseFloat(r.total), 0)

    res.json({
      month: `${year}-${String(month).padStart(2, "0")}`,
      totalIncome: Math.round(totalIncome),
      breakdown: list.map((r) => ({
        category: r.category,
        amount: Math.round(parseFloat(r.total)),
        count: r.count,
        pct: totalIncome > 0 ? Math.round((parseFloat(r.total) / totalIncome) * 100) : 0,
      })),
    })
  })
)

/**
 * GET /api/household/streak
 * 連續記帳天數 streak
 *  - current: 從今天往回算、連續每天都有記帳（household_expenses OR household_incomes）
 *    若今天沒記、容忍 1 天緩衝（昨天有記也算 current=1）
 *  - longest: 歷史最長連續天數
 *  - lastRecordDate: 最後一次記帳日期
 *  - daysActive: 過去 90 天有記帳的天數（活躍度）
 */
router.get(
  "/api/household/streak",
  asyncHandler(async (_req, res) => {
    // 取過去 365 天有記帳的 distinct date（expense + income union）
    const rows = await db.execute(sql`
      WITH all_dates AS (
        SELECT DISTINCT date::date AS d FROM household_expenses
        WHERE NOT is_deleted AND date >= NOW() - INTERVAL '365 days'
        UNION
        SELECT DISTINCT date::date AS d FROM household_incomes
        WHERE date >= NOW() - INTERVAL '365 days'
      )
      SELECT d::text FROM all_dates ORDER BY d DESC
    `)
    const dates = (rows as unknown as { rows: { d: string }[] }).rows.map((r) => r.d.slice(0, 10))

    if (dates.length === 0) {
      return res.json({
        current: 0,
        longest: 0,
        lastRecordDate: null,
        daysActive: 0,
        isOnFireToday: false,
      })
    }

    // 計算當前 streak
    // 從今天往前找連續日期：若今天有 → 從今天往回；若今天沒有但昨天有 → 從昨天往回（容忍）
    const today = new Date()
    const todayStr = formatYMD(today)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = formatYMD(yesterday)

    const dateSet = new Set(dates)
    let current = 0
    let startDate: Date | null = null
    const isOnFireToday = dateSet.has(todayStr)
    if (dateSet.has(todayStr)) {
      startDate = new Date(today)
    } else if (dateSet.has(yesterdayStr)) {
      startDate = new Date(yesterday)
    }
    if (startDate) {
      const cur = new Date(startDate)
      while (dateSet.has(formatYMD(cur))) {
        current++
        cur.setDate(cur.getDate() - 1)
      }
    }

    // 計算歷史最長 streak
    const sortedAsc = [...dates].sort()
    let longest = 0
    let run = 0
    let prev: Date | null = null
    for (const ds of sortedAsc) {
      const cur = new Date(ds)
      if (prev) {
        const diffDays = Math.round((cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === 1) {
          run++
        } else if (diffDays === 0) {
          // 同一天、不計
        } else {
          run = 1
        }
      } else {
        run = 1
      }
      if (run > longest) longest = run
      prev = cur
    }

    // 過去 90 天活躍度
    const since90 = new Date(today)
    since90.setDate(since90.getDate() - 90)
    const since90Str = formatYMD(since90)
    const daysActive = dates.filter((d) => d >= since90Str).length

    res.json({
      current,
      longest,
      lastRecordDate: dates[0] ?? null,
      daysActive,
      isOnFireToday,
    })
  })
)

/**
 * GET /api/household/snapshot
 * 首頁快照：今日已花 / 本月已花 / 預算 / 剩餘 / 7 天 bar
 * 一個 endpoint 把所有首頁卡需要的資料一次回傳
 */
router.get(
  "/api/household/snapshot",
  asyncHandler(async (_req, res) => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const monthStr = `${y}-${String(m).padStart(2, "0")}`
    const monthStart = `${monthStr}-01`
    const todayStr = `${y}-${String(m).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`
    const nextMonthY = m === 12 ? y + 1 : y
    const nextMonthM = m === 12 ? 1 : m + 1
    const monthEnd = `${nextMonthY}-${String(nextMonthM).padStart(2, "0")}-01`

    // 今日 + 本月 sum（一次 query）
    const sumsRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN date >= ${todayStr}::date AND date < ${tomorrowStr}::date THEN amount::numeric ELSE 0 END), 0)::text AS today_spent,
        COALESCE(SUM(CASE WHEN date >= ${monthStart}::date AND date < ${monthEnd}::date THEN amount::numeric ELSE 0 END), 0)::text AS month_spent,
        COUNT(*) FILTER (WHERE date >= ${todayStr}::date AND date < ${tomorrowStr}::date)::int AS today_count,
        COUNT(*) FILTER (WHERE date >= ${monthStart}::date AND date < ${monthEnd}::date)::int AS month_count
      FROM household_expenses
      WHERE NOT is_deleted AND date >= ${monthStart}::date AND date < ${monthEnd}::date
    `)
    const sums = (
      sumsRows as unknown as {
        rows: {
          today_spent: string
          month_spent: string
          today_count: number
          month_count: number
        }[]
      }
    ).rows[0]
    const todaySpent = parseFloat(sums?.today_spent ?? "0")
    const monthSpent = parseFloat(sums?.month_spent ?? "0")
    const todayCount = sums?.today_count ?? 0
    const monthCount = sums?.month_count ?? 0

    // 本月預算
    const budgetRows = await db.execute(sql`
      SELECT budget_amount::text AS amt FROM household_budgets
      WHERE year = ${y} AND month = ${m} AND is_total_budget = true
      LIMIT 1
    `)
    const monthBudget = parseFloat(
      (budgetRows as unknown as { rows: { amt: string }[] }).rows[0]?.amt ?? "0"
    )

    // 過去 7 天 bar（含今日）
    const sevenAgo = new Date(now)
    sevenAgo.setDate(sevenAgo.getDate() - 6)
    const sevenAgoStr = `${sevenAgo.getFullYear()}-${String(sevenAgo.getMonth() + 1).padStart(2, "0")}-${String(sevenAgo.getDate()).padStart(2, "0")}`
    const dailyRows = await db.execute(sql`
      SELECT
        to_char(date, 'YYYY-MM-DD') AS d,
        COALESCE(SUM(amount::numeric), 0)::text AS total
      FROM household_expenses
      WHERE NOT is_deleted AND date >= ${sevenAgoStr}::date AND date < ${tomorrowStr}::date
      GROUP BY to_char(date, 'YYYY-MM-DD')
    `)
    const dailyMap = new Map<string, number>()
    for (const r of (dailyRows as unknown as { rows: { d: string; total: string }[] }).rows) {
      dailyMap.set(r.d, parseFloat(r.total))
    }
    const past7Days: { date: string; total: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(now)
      dt.setDate(dt.getDate() - i)
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
      past7Days.push({ date: key, total: Math.round(dailyMap.get(key) ?? 0) })
    }

    const remaining = monthBudget - monthSpent
    const usagePct = monthBudget > 0 ? Math.round((monthSpent / monthBudget) * 100) : null
    const daysInMonth = new Date(y, m, 0).getDate()
    const timeProgress = Math.round((now.getDate() / daysInMonth) * 100)

    // 本月收入合計（household_incomes）
    let monthIncome = 0
    let incomeCount = 0
    try {
      const incRows = await db.execute(sql`
        SELECT
          COALESCE(SUM(amount::numeric), 0)::text AS total,
          COUNT(*)::int AS cnt
        FROM household_incomes
        WHERE date >= ${monthStart}::date AND date < ${monthEnd}::date
      `)
      const r = (incRows as unknown as { rows: { total: string; cnt: number }[] }).rows[0]
      monthIncome = parseFloat(r?.total ?? "0")
      incomeCount = r?.cnt ?? 0
    } catch (e) {
      process.stdout.write(`[snapshot] incomes failed: ${(e as Error).message}\n`)
    }
    const balance = monthIncome - monthSpent

    res.json({
      month: monthStr,
      today: { date: todayStr, spent: Math.round(todaySpent), count: todayCount },
      monthSummary: {
        spent: Math.round(monthSpent),
        count: monthCount,
        budget: Math.round(monthBudget),
        remaining: Math.round(remaining),
        usagePct,
        timeProgress,
        isOver: usagePct !== null && usagePct >= 100,
        isAhead: usagePct !== null && usagePct > timeProgress + 15,
        income: Math.round(monthIncome),
        incomeCount,
        balance: Math.round(balance),
      },
      past7Days,
    })
  })
)

/**
 * GET /api/household/period-summary?period=today|week|month&date=YYYY-MM-DD
 * 取指定期間的「花了什麼」即時清單
 *  - today：當日（依使用者本地時區、Asia/Taipei）
 *  - week：本週（週一至週日）
 *  - month：當月
 * 回傳 { period, total, count, expenses: [...] }
 */
router.get(
  "/api/household/period-summary",
  asyncHandler(async (req, res) => {
    const period = (req.query.period as string) || "today"
    if (!["today", "week", "month"].includes(period)) {
      throw new AppError(400, "period 需為 today | week | month")
    }
    // 用使用者傳的 date 當基準（沒傳則用伺服器當下）
    const baseDateStr = (req.query.date as string) || ""
    const base = /^\d{4}-\d{2}-\d{2}$/.test(baseDateStr) ? new Date(baseDateStr) : new Date()

    let startDate: string
    let endDate: string
    if (period === "today") {
      const y = base.getFullYear()
      const m = String(base.getMonth() + 1).padStart(2, "0")
      const d = String(base.getDate()).padStart(2, "0")
      startDate = `${y}-${m}-${d}`
      // endDate 是下一天
      const tomorrow = new Date(base)
      tomorrow.setDate(tomorrow.getDate() + 1)
      endDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`
    } else if (period === "week") {
      // 週一作為一週起點
      const dow = base.getDay() === 0 ? 7 : base.getDay() // 1=Mon, 7=Sun
      const start = new Date(base)
      start.setDate(start.getDate() - (dow - 1))
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`
      endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`
    } else {
      // month
      const y = base.getFullYear()
      const m = base.getMonth() + 1
      startDate = `${y}-${String(m).padStart(2, "0")}-01`
      const ny = m === 12 ? y + 1 : y
      const nm = m === 12 ? 1 : m + 1
      endDate = `${ny}-${String(nm).padStart(2, "0")}-01`
    }

    const rows = await db.execute(sql`
      SELECT
        he.id,
        he.amount::text AS amount,
        he.description,
        he.date::text AS date,
        he.payment_method AS "paymentMethod",
        he.receipt_images AS "receiptImages",
        he.category_id AS "categoryId",
        COALESCE(fc.category_name, '(未分類)') AS "categoryName",
        '#9CA3AF' AS color
      FROM household_expenses he
      LEFT JOIN fixed_categories fc ON he.category_id = fc.id
      WHERE NOT he.is_deleted AND he.date >= ${startDate}::date AND he.date < ${endDate}::date
      ORDER BY he.date DESC, he.id DESC
      LIMIT 200
    `)
    const list = (rows as unknown as { rows: { amount: string }[] }).rows
    const total = list.reduce((s, r) => s + parseFloat(r.amount), 0)
    res.json({
      period,
      startDate,
      endDate,
      total: Math.round(total),
      count: list.length,
      expenses: list,
    })
  })
)

/**
 * GET /api/household/expenses/search
 * 進階搜尋 / 篩選 / 排序
 *
 * Query:
 *  - search        文字搜尋（模糊比對 description、LOWER）
 *  - categoryIds   逗號分隔的 category id（OR）、例 1,3,5
 *  - minAmount     最低金額（inclusive）
 *  - maxAmount     最高金額（inclusive）
 *  - startDate     開始日 YYYY-MM-DD（inclusive）
 *  - endDate       結束日 YYYY-MM-DD（exclusive、與既有月查詢一致）
 *  - sort          date_desc | date_asc | amount_desc | amount_asc（預設 date_desc）
 *  - limit         max 500、預設 100
 *
 * 回 { total, count, totalAmount, expenses[] }
 */
router.get(
  "/api/household/expenses/search",
  asyncHandler(async (req, res) => {
    const search = ((req.query.search as string) || "").trim()
    const categoryIdsRaw = (req.query.categoryIds as string) || ""
    const categoryIds = categoryIdsRaw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
    const minAmountRaw = (req.query.minAmount as string) || ""
    const maxAmountRaw = (req.query.maxAmount as string) || ""
    const minAmount =
      minAmountRaw && !isNaN(parseFloat(minAmountRaw)) ? parseFloat(minAmountRaw) : null
    const maxAmount =
      maxAmountRaw && !isNaN(parseFloat(maxAmountRaw)) ? parseFloat(maxAmountRaw) : null
    const startDate = (req.query.startDate as string) || ""
    const endDate = (req.query.endDate as string) || ""
    const sort = ((req.query.sort as string) || "date_desc").toLowerCase()
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "100", 10), 1), 500)

    const sortClauseMap: Record<string, ReturnType<typeof sql>> = {
      date_desc: sql`he.date DESC, he.id DESC`,
      date_asc: sql`he.date ASC, he.id ASC`,
      amount_desc: sql`he.amount::numeric DESC, he.date DESC`,
      amount_asc: sql`he.amount::numeric ASC, he.date DESC`,
    }
    const sortClause = sortClauseMap[sort] ?? sortClauseMap["date_desc"]

    // 動態組 WHERE conditions
    const conds: ReturnType<typeof sql>[] = []
    if (search) {
      conds.push(sql`LOWER(COALESCE(he.description, '')) LIKE ${"%" + search.toLowerCase() + "%"}`)
    }
    if (categoryIds.length > 0) {
      conds.push(sql`he.category_id = ANY(${categoryIds}::int[])`)
    }
    if (minAmount !== null) {
      conds.push(sql`he.amount::numeric >= ${minAmount}`)
    }
    if (maxAmount !== null) {
      conds.push(sql`he.amount::numeric <= ${maxAmount}`)
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      conds.push(sql`he.date >= ${startDate}::date`)
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      conds.push(sql`he.date < ${endDate}::date`)
    }
    // 安全 fallback：完全沒 filter 時、限本年內、避免一次撈全部
    if (conds.length === 0) {
      conds.push(sql`he.date >= NOW() - INTERVAL '365 days'`)
    }

    let whereClause = sql``
    for (let i = 0; i < conds.length; i++) {
      whereClause = i === 0 ? sql`WHERE ${conds[i]}` : sql`${whereClause} AND ${conds[i]}`
    }

    const rows = await db.execute(sql`
      SELECT
        he.id,
        he.category_id AS "categoryId",
        COALESCE(fc.category_name, '(未分類)') AS "categoryName",
        he.amount::text AS amount,
        he.date::text AS date,
        he.payment_method AS "paymentMethod",
        he.description,
        he.receipt_images AS "receiptImages",
        he.tags,
        he.created_at AS "createdAt"
      FROM household_expenses he
      LEFT JOIN fixed_categories fc ON fc.id = he.category_id
      ${whereClause}
      ORDER BY ${sortClause}
      LIMIT ${limit}
    `)
    const list = (rows as unknown as { rows: { amount: string }[] }).rows
    const totalAmount = list.reduce((s, r) => s + parseFloat(r.amount), 0)

    res.json({
      count: list.length,
      totalAmount: Math.round(totalAmount),
      filters: {
        search,
        categoryIds,
        minAmount,
        maxAmount,
        startDate: startDate || null,
        endDate: endDate || null,
        sort,
      },
      expenses: list,
    })
  })
)

/**
 * 家用支出範本 endpoints
 *   GET    /api/household/templates           列出 active 範本
 *   POST   /api/household/templates           建立
 *   PUT    /api/household/templates/:id       更新
 *   DELETE /api/household/templates/:id       軟刪除（is_active=false）
 */
router.get(
  "/api/household/templates",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        id,
        family_id      AS "familyId",
        name,
        emoji,
        amount::text   AS amount,
        category_id    AS "categoryId",
        payment_method AS "paymentMethod",
        description,
        day_of_month   AS "dayOfMonth",
        sort_order     AS "sortOrder",
        is_active      AS "isActive",
        created_at     AS "createdAt"
      FROM household_expense_templates
      WHERE family_id = 1 AND is_active = true
      ORDER BY sort_order ASC, created_at DESC
    `)
    res.json((rows as unknown as { rows: unknown[] }).rows)
  })
)

router.post(
  "/api/household/templates",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {}
    const name = String(body.name ?? "").trim()
    if (!name) throw new AppError(400, "請填寫範本名稱")
    const amt = parseFloat(String(body.amount ?? ""))
    if (isNaN(amt) || amt < 0) throw new AppError(400, "金額需為正數")
    const result = await db.execute(sql`
      INSERT INTO household_expense_templates
        (family_id, name, emoji, amount, category_id, payment_method,
         description, day_of_month, sort_order, is_active, created_at, updated_at)
      VALUES
        (1, ${name},
         ${body.emoji ?? "📋"},
         ${amt},
         ${body.categoryId ?? null},
         ${body.paymentMethod ?? "cash"},
         ${body.description ?? null},
         ${body.dayOfMonth ?? null},
         ${body.sortOrder ?? 0},
         true, NOW(), NOW())
      RETURNING id, name, emoji, amount::text AS amount, category_id AS "categoryId",
                payment_method AS "paymentMethod", day_of_month AS "dayOfMonth",
                description, sort_order AS "sortOrder"
    `)
    res.status(201).json((result as unknown as { rows: unknown[] }).rows[0])
  })
)

export default router
