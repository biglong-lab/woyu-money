import { Router } from "express"
import { storage } from "../storage"
import { insertHouseholdBudgetSchema, insertHouseholdExpenseSchema } from "@shared/schema"
import { receiptUpload } from "./upload-config"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { db } from "../db"
import { sql } from "drizzle-orm"
import { localMonthTPE } from "@shared/date-utils"
import { recognizeDocument } from "../document-ai"
import fs from "fs"
import path from "path"

const router = Router()

/** 把 "YYYY-MM" 拆成 { year, month } */
function parseYearMonth(monthStr: string | undefined): { year: number; month: number } {
  const ym = monthStr && /^\d{4}-\d{2}$/.test(monthStr) ? monthStr : localMonthTPE()
  const [y, m] = ym.split("-").map(Number)
  return { year: y, month: m }
}

/**
 * 「總預算」用 categoryId = 0 作為哨兵值（schema categoryId NOT NULL、又不想做 migration）
 * 之後階段 2 要做分類預算時、categoryId > 0 即為分類預算、與總預算共存
 */
const TOTAL_BUDGET_CATEGORY_ID = 0

// 家用分類
router.get(
  "/api/household-categories",
  asyncHandler(async (req, res) => {
    const categories = await storage.getFixedCategories()
    res.json(categories)
  })
)

// 家用預算
router.get(
  "/api/household-budgets",
  asyncHandler(async (req, res) => {
    const budgets = await storage.getHouseholdCategoryBudgets()
    res.json(budgets)
  })
)

router.post(
  "/api/household-budgets",
  asyncHandler(async (req, res) => {
    const result = insertHouseholdBudgetSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid budget data", errors: result.error.errors })
    }
    const budget = await storage.createOrUpdateHouseholdBudget(result.data)
    res.status(201).json(budget)
  })
)

router.put(
  "/api/household-budgets/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const result = insertHouseholdBudgetSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid budget data", errors: result.error.errors })
    }
    const budget = await storage.updateHouseholdCategoryBudget(id, result.data)
    res.json(budget)
  })
)

// 家用支出
router.get(
  "/api/household-expenses",
  asyncHandler(async (req, res) => {
    const { page = "1", limit = "10", categoryId, startDate, endDate } = req.query
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)

    const filters: { categoryId?: number; startDate?: Date; endDate?: Date } = {}
    if (categoryId) filters.categoryId = parseInt(categoryId as string)
    if (startDate) filters.startDate = new Date(startDate as string)
    if (endDate) filters.endDate = new Date(endDate as string)

    const expenses = await storage.getHouseholdExpenses(filters, pageNum, limitNum)
    res.json(expenses)
  })
)

router.post(
  "/api/household-expenses",
  asyncHandler(async (req, res) => {
    const result = insertHouseholdExpenseSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid expense data", errors: result.error.errors })
    }
    const expense = await storage.createHouseholdExpense(result.data)
    res.status(201).json(expense)
  })
)

router.put(
  "/api/household-expenses/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const result = insertHouseholdExpenseSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid expense data", errors: result.error.errors })
    }
    const expense = await storage.updateHouseholdExpense(id, result.data)
    res.json(expense)
  })
)

router.delete(
  "/api/household-expenses/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    await storage.deleteHouseholdExpense(id)
    res.status(204).send()
  })
)

// ============================================================
// 前端 /household-budget 頁面用 alias endpoints（救活頁面 P1）
// 設計：前端打 /api/household/budget（單數）、回單一物件給 UI
// 區分既有 /api/household-budgets（複數）回 list
// ============================================================

/**
 * GET /api/household/budget?month=YYYY-MM
 * 取「總預算」（categoryId=0）；無預算回 budgetAmount=0
 */
router.get(
  "/api/household/budget",
  asyncHandler(async (req, res) => {
    const { year, month } = parseYearMonth(req.query.month as string | undefined)
    const rows = await db.execute(sql`
      SELECT id, budget_amount::text AS "budgetAmount", year, month, notes
      FROM household_budgets
      WHERE year = ${year} AND month = ${month} AND category_id = ${TOTAL_BUDGET_CATEGORY_ID}
      LIMIT 1
    `)
    const row = (rows as unknown as { rows: { id: number; budgetAmount: string }[] }).rows[0]
    res.json({
      month: `${year}-${String(month).padStart(2, "0")}`,
      budgetAmount: row?.budgetAmount ?? "0",
      hasBudget: !!row,
      id: row?.id ?? null,
    })
  })
)

/**
 * POST /api/household/budget
 * Body: { month: "YYYY-MM", budgetAmount: number | string, notes? }
 * upsert「總預算」（categoryId=0）
 */
router.post(
  "/api/household/budget",
  asyncHandler(async (req, res) => {
    const { month: monthStr, budgetAmount, notes } = req.body ?? {}
    const { year, month } = parseYearMonth(monthStr)
    const amt = String(budgetAmount ?? "")
    if (!/^\d+(\.\d{1,2})?$/.test(amt) || Number(amt) < 0) {
      throw new AppError(400, "budgetAmount 需為非負數字（最多兩位小數）")
    }

    // 手動 upsert（household_budgets 沒有 UNIQUE constraint、ON CONFLICT 用不了）
    const existRows = await db.execute(sql`
      SELECT id FROM household_budgets
      WHERE year = ${year} AND month = ${month} AND category_id = ${TOTAL_BUDGET_CATEGORY_ID}
      LIMIT 1
    `)
    const existing = (existRows as unknown as { rows: { id: number }[] }).rows[0]

    let result: { id: number; budgetAmount: string } | undefined
    if (existing) {
      const updateRes = await db.execute(sql`
        UPDATE household_budgets
        SET budget_amount = ${amt}, notes = COALESCE(${notes ?? null}, notes), updated_at = NOW()
        WHERE id = ${existing.id}
        RETURNING id, budget_amount::text AS "budgetAmount"
      `)
      result = (updateRes as unknown as { rows: { id: number; budgetAmount: string }[] }).rows[0]
    } else {
      const insertRes = await db.execute(sql`
        INSERT INTO household_budgets (category_id, year, month, budget_amount, notes, is_active, created_at, updated_at)
        VALUES (${TOTAL_BUDGET_CATEGORY_ID}, ${year}, ${month}, ${amt}, ${notes ?? null}, true, NOW(), NOW())
        RETURNING id, budget_amount::text AS "budgetAmount"
      `)
      result = (insertRes as unknown as { rows: { id: number; budgetAmount: string }[] }).rows[0]
    }
    res.status(201).json({
      month: `${year}-${String(month).padStart(2, "0")}`,
      budgetAmount: result?.budgetAmount ?? amt,
      id: result?.id ?? null,
    })
  })
)

/**
 * GET /api/household/expenses?month=YYYY-MM&limit=N
 * 取指定月（不傳則本月）的支出列表、按日期倒序
 */
router.get(
  "/api/household/expenses",
  asyncHandler(async (req, res) => {
    const { year, month } = parseYearMonth(req.query.month as string | undefined)
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "100", 10), 1), 500)
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`
    const endYear = month === 12 ? year + 1 : year
    const endMonth = month === 12 ? 1 : month + 1
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`

    const rows = await db.execute(sql`
      SELECT
        he.id,
        he.category_id AS "categoryId",
        dc.category_name AS "categoryName",
        he.amount::text AS amount,
        he.date,
        he.payment_method AS "paymentMethod",
        he.description,
        he.receipt_images AS "receiptImages",
        he.tags,
        he.created_at AS "createdAt"
      FROM household_expenses he
      LEFT JOIN debt_categories dc ON dc.id = he.category_id
      WHERE he.date >= ${startDate}::date AND he.date < ${endDate}::date
      ORDER BY he.date DESC, he.id DESC
      LIMIT ${limit}
    `)
    res.json((rows as unknown as { rows: unknown[] }).rows)
  })
)

/**
 * POST /api/household/expenses
 * Body: { categoryId?, amount, date?, paymentMethod?, description?, receiptImages? }
 * 新增一筆家用支出
 */
router.post(
  "/api/household/expenses",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {}
    const amt = String(body.amount ?? "")
    if (!/^\d+(\.\d{1,2})?$/.test(amt) || Number(amt) <= 0) {
      throw new AppError(400, "amount 需為正數")
    }
    const date = body.date ?? new Date().toISOString().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError(400, "date 格式需 YYYY-MM-DD")
    }
    const insertData = {
      categoryId: body.categoryId ?? null,
      amount: amt,
      date,
      paymentMethod: body.paymentMethod ?? null,
      description: body.description ?? null,
      receiptImages: body.receiptImages ?? null,
    }
    const result = insertHouseholdExpenseSchema.safeParse(insertData)
    if (!result.success) {
      throw new AppError(
        400,
        "資料格式錯誤：" + result.error.errors.map((e) => e.message).join(", ")
      )
    }
    const expense = await storage.createHouseholdExpense(result.data)
    res.status(201).json(expense)
  })
)

/**
 * GET /api/household/stats?month=YYYY-MM
 * 聚合：{ budgetAmount, totalSpent, remaining, count, categoryBreakdown[] }
 */
router.get(
  "/api/household/stats",
  asyncHandler(async (req, res) => {
    const { year, month } = parseYearMonth(req.query.month as string | undefined)
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`
    const endYear = month === 12 ? year + 1 : year
    const endMonth = month === 12 ? 1 : month + 1
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`

    // 總預算
    const budgetRows = await db.execute(sql`
      SELECT budget_amount::text AS amt FROM household_budgets
      WHERE year = ${year} AND month = ${month} AND category_id = ${TOTAL_BUDGET_CATEGORY_ID}
      LIMIT 1
    `)
    const budgetAmount = parseFloat(
      (budgetRows as unknown as { rows: { amt: string }[] }).rows[0]?.amt ?? "0"
    )

    // 月支出加總 + 計數
    const totalRows = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0)::text AS total, COUNT(*)::int AS count
      FROM household_expenses
      WHERE date >= ${startDate}::date AND date < ${endDate}::date
    `)
    const totalRow = (totalRows as unknown as { rows: { total: string; count: number }[] }).rows[0]
    const totalSpent = parseFloat(totalRow?.total ?? "0")
    const count = totalRow?.count ?? 0

    // 分類佔比
    const catRows = await db.execute(sql`
      SELECT
        he.category_id AS "categoryId",
        COALESCE(dc.category_name, '(未分類)') AS "categoryName",
        COALESCE(SUM(he.amount::numeric), 0)::text AS amount,
        COUNT(*)::int AS count
      FROM household_expenses he
      LEFT JOIN debt_categories dc ON dc.id = he.category_id
      WHERE he.date >= ${startDate}::date AND he.date < ${endDate}::date
      GROUP BY he.category_id, dc.category_name
      ORDER BY SUM(he.amount::numeric) DESC
    `)
    const categoryBreakdown = (
      catRows as unknown as {
        rows: { categoryId: number | null; categoryName: string; amount: string; count: number }[]
      }
    ).rows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      amount: parseFloat(r.amount),
      count: r.count,
    }))

    res.json({
      month: `${year}-${String(month).padStart(2, "0")}`,
      budgetAmount,
      totalSpent,
      remaining: budgetAmount - totalSpent,
      count,
      progressPercent: budgetAmount > 0 ? Math.round((totalSpent / budgetAmount) * 100) : 0,
      categoryBreakdown,
    })
  })
)

/**
 * GET /api/categories/household
 * 給前端「分類選單」用，回家用分類（fixed_categories）
 */
router.get(
  "/api/categories/household",
  asyncHandler(async (_req, res) => {
    const categories = await storage.getFixedCategories()
    res.json(categories)
  })
)

// 收據圖片上傳
router.post(
  "/api/upload/images",
  receiptUpload.array("images", 5),
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      throw new AppError(400, "No files uploaded")
    }

    const filePaths = files.map((file) => `/uploads/receipts/${file.filename}`)
    res.json({ imagePaths: filePaths })
  })
)

/**
 * POST /api/household/recognize-receipt
 * Body: { imageUrl: "/uploads/receipts/xxx.jpg" }
 * 從上傳的收據圖跑 AI 辨識、回 { vendor, amount, date, category, description }
 * 給 quick-add dialog 自動填表單用、節省手 key 時間
 */
router.post(
  "/api/household/recognize-receipt",
  asyncHandler(async (req, res) => {
    const imageUrl = String(req.body?.imageUrl ?? "")
    if (!imageUrl) throw new AppError(400, "imageUrl 必填")
    if (!imageUrl.startsWith("/uploads/")) throw new AppError(400, "imageUrl 必須以 /uploads/ 開頭")

    // 路徑安全：禁止 .. 跳出 uploads 目錄
    const safe = path.normalize(imageUrl).replace(/^\/+/, "")
    if (!safe.startsWith("uploads/") || safe.includes("..")) {
      throw new AppError(400, "imageUrl 不合法")
    }
    const absPath = path.join(process.cwd(), safe)
    if (!fs.existsSync(absPath)) throw new AppError(404, "檔案不存在")

    const buf = fs.readFileSync(absPath)
    const base64 = buf.toString("base64")
    const ext = path.extname(safe).toLowerCase()
    const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg"

    const result = await recognizeDocument(base64, mimeType, "bill")
    res.json({
      success: result.success,
      confidence: result.confidence,
      extracted: result.extractedData,
      error: result.error,
    })
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
      WHERE year = ${year} AND month = ${month} AND category_id = ${TOTAL_BUDGET_CATEGORY_ID}
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
      WHERE date >= ${prevStart}::date AND date < ${endDate}::date
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
      WHERE he.date >= ${startDate}::date AND he.date < ${endDate}::date
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
      WHERE he.date >= ${startDate}::date AND he.date < ${endDate}::date
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
