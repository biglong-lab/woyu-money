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
    const { month: monthStr, budgetAmount, notes, reason } = req.body ?? {}
    const { year, month } = parseYearMonth(monthStr)
    const amt = String(budgetAmount ?? "")
    if (!/^\d+(\.\d{1,2})?$/.test(amt) || Number(amt) < 0) {
      throw new AppError(400, "budgetAmount 需為非負數字（最多兩位小數）")
    }

    // 取舊預算（給 change log）
    const existRows = await db.execute(sql`
      SELECT id, budget_amount::text AS "budgetAmount" FROM household_budgets
      WHERE year = ${year} AND month = ${month} AND category_id = ${TOTAL_BUDGET_CATEGORY_ID}
      LIMIT 1
    `)
    const existing = (existRows as unknown as { rows: { id: number; budgetAmount: string }[] })
      .rows[0]
    const oldAmount = existing ? parseFloat(existing.budgetAmount) : null

    let result: { id: number; budgetAmount: string } | undefined
    let action: "create" | "update" = "create"
    if (existing) {
      action = "update"
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

    // 寫變更歷程（階段 4.2）— 跳過「同金額重複保存」
    const newAmount = parseFloat(amt)
    const isNoop = action === "update" && oldAmount !== null && oldAmount === newAmount
    if (!isNoop) {
      const reqUser = (req as { user?: { id: number; fullName?: string; username?: string } }).user
      const diff = oldAmount === null ? newAmount : newAmount - oldAmount
      try {
        await db.execute(sql`
          INSERT INTO household_budget_changes
            (family_id, year, month, category_id, old_amount, new_amount, diff_amount,
             changed_by_user_id, changed_by_name, reason, action, created_at)
          VALUES
            (1, ${year}, ${month}, ${TOTAL_BUDGET_CATEGORY_ID},
             ${oldAmount}, ${newAmount}, ${diff},
             ${reqUser?.id ?? null},
             ${reqUser?.fullName ?? reqUser?.username ?? null},
             ${reason ?? null},
             ${action}, NOW())
        `)
      } catch (e) {
        // log 寫失敗不應影響主流程
        process.stdout.write(`[budget-change-log] insert failed: ${(e as Error).message}\n`)
      }
    }

    res.status(201).json({
      month: `${year}-${String(month).padStart(2, "0")}`,
      budgetAmount: result?.budgetAmount ?? amt,
      id: result?.id ?? null,
    })
  })
)

/**
 * GET /api/household/budget/changes?month=YYYY-MM
 * 取該月預算變更歷程（按時間倒序）
 */
router.get(
  "/api/household/budget/changes",
  asyncHandler(async (req, res) => {
    const { year, month } = parseYearMonth(req.query.month as string | undefined)
    const rows = await db.execute(sql`
      SELECT
        hbc.id,
        hbc.year,
        hbc.month,
        hbc.old_amount::text AS "oldAmount",
        hbc.new_amount::text AS "newAmount",
        hbc.diff_amount::text AS "diffAmount",
        hbc.changed_by_user_id AS "changedByUserId",
        hbc.changed_by_name AS "changedByName",
        hbc.reason,
        hbc.action,
        hbc.created_at AS "createdAt",
        u.username,
        u.full_name AS "userFullName"
      FROM household_budget_changes hbc
      LEFT JOIN users u ON u.id = hbc.changed_by_user_id
      WHERE hbc.year = ${year} AND hbc.month = ${month}
      ORDER BY hbc.created_at DESC
      LIMIT 50
    `)
    res.json((rows as unknown as { rows: unknown[] }).rows)
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
 * GET /api/household/anomalies?month=YYYY-MM
 * 異常偵測 3 條規則：
 *  1. 單筆 > 該分類過去 3 月平均 + 2σ（離群值）
 *  2. 同日同分類重複筆數 > 3（可能重複輸入）
 *  3. 過去 3 月有但本月沒記過的固定分類（缺記提醒）
 */
router.get(
  "/api/household/anomalies",
  asyncHandler(async (req, res) => {
    const { year, month } = parseYearMonth(req.query.month as string | undefined)
    const monthStr = `${year}-${String(month).padStart(2, "0")}`
    const startDate = `${monthStr}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const endDate = `${endY}-${String(endM).padStart(2, "0")}-01`

    // 過去 3 月起點
    let py = year
    let pm = month - 3
    while (pm <= 0) {
      pm += 12
      py -= 1
    }
    const past3Start = `${py}-${String(pm).padStart(2, "0")}-01`

    interface Anomaly {
      type: "outlier" | "duplicate" | "missing"
      severity: "info" | "warn" | "alert"
      title: string
      detail: string
      expenseId?: number
    }
    const anomalies: Anomaly[] = []

    // 規則 1: 離群值 — 對本月每筆、跟過去 3 月同分類的 avg + stddev 比
    const outlierRows = await db.execute(sql`
      WITH past_stats AS (
        SELECT
          category_id,
          AVG(amount::numeric) AS avg_amt,
          STDDEV(amount::numeric) AS sd_amt,
          COUNT(*)::int AS n
        FROM household_expenses
        WHERE date >= ${past3Start}::date AND date < ${startDate}::date
        GROUP BY category_id
      )
      SELECT
        he.id,
        he.amount::numeric AS amt,
        he.date::text AS d,
        he.description,
        COALESCE(fc.category_name, '(未分類)') AS cname,
        ps.avg_amt::numeric AS avg_amt,
        ps.sd_amt::numeric AS sd_amt,
        ps.n
      FROM household_expenses he
      LEFT JOIN fixed_categories fc ON he.category_id = fc.id
      JOIN past_stats ps ON ps.category_id = he.category_id
      WHERE he.date >= ${startDate}::date AND he.date < ${endDate}::date
        AND ps.n >= 5
        AND ps.sd_amt IS NOT NULL
        AND ps.sd_amt > 0
        AND he.amount::numeric > ps.avg_amt + 2 * ps.sd_amt
      ORDER BY he.amount::numeric DESC
      LIMIT 5
    `)
    for (const r of (
      outlierRows as unknown as {
        rows: {
          id: number
          amt: string
          d: string
          description: string | null
          cname: string
          avg_amt: string
          sd_amt: string
        }[]
      }
    ).rows) {
      const amt = parseFloat(r.amt)
      const avg = parseFloat(r.avg_amt)
      const sd = parseFloat(r.sd_amt)
      const sigma = sd > 0 ? Math.round(((amt - avg) / sd) * 10) / 10 : 0
      anomalies.push({
        type: "outlier",
        severity: sigma > 3 ? "alert" : "warn",
        title: `「${r.cname}」異常大筆 NT$ ${Math.round(amt).toLocaleString()}`,
        detail: `${r.d.slice(0, 10)} · ${r.description ?? "(無說明)"} · 高於該分類過去 3 月平均 ${Math.round(avg).toLocaleString()} 約 ${sigma}σ`,
        expenseId: r.id,
      })
    }

    // 規則 2: 同日同分類重複筆數 > 3
    const dupRows = await db.execute(sql`
      SELECT
        he.date::text AS d,
        COALESCE(fc.category_name, '(未分類)') AS cname,
        COUNT(*)::int AS cnt,
        COALESCE(SUM(he.amount::numeric), 0)::text AS total
      FROM household_expenses he
      LEFT JOIN fixed_categories fc ON he.category_id = fc.id
      WHERE he.date >= ${startDate}::date AND he.date < ${endDate}::date
      GROUP BY he.date, fc.category_name
      HAVING COUNT(*) > 3
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `)
    for (const r of (
      dupRows as unknown as { rows: { d: string; cname: string; cnt: number; total: string }[] }
    ).rows) {
      anomalies.push({
        type: "duplicate",
        severity: "warn",
        title: `${r.d.slice(0, 10)} 「${r.cname}」記了 ${r.cnt} 次`,
        detail: `同日同分類共 NT$ ${Math.round(parseFloat(r.total)).toLocaleString()}、檢查是否重複輸入`,
      })
    }

    // 規則 3: 固定分類本月未記
    const missingRows = await db.execute(sql`
      WITH past_cats AS (
        SELECT category_id, COUNT(*)::int AS n
        FROM household_expenses
        WHERE date >= ${past3Start}::date AND date < ${startDate}::date
          AND category_id IS NOT NULL
        GROUP BY category_id
        HAVING COUNT(*) >= 3
      ),
      curr_cats AS (
        SELECT DISTINCT category_id
        FROM household_expenses
        WHERE date >= ${startDate}::date AND date < ${endDate}::date
          AND category_id IS NOT NULL
      )
      SELECT
        COALESCE(fc.category_name, '(未分類)') AS cname,
        pc.n AS past_count
      FROM past_cats pc
      LEFT JOIN fixed_categories fc ON pc.category_id = fc.id
      WHERE pc.category_id NOT IN (SELECT category_id FROM curr_cats)
      ORDER BY pc.n DESC
      LIMIT 5
    `)
    // 只在月過 50%+ 才提示（月初剛開始記不需要警告）
    const today = new Date()
    const isCurrMonth = today.getFullYear() === year && today.getMonth() + 1 === month
    const daysInMonth = new Date(year, month, 0).getDate()
    const dayOfMonth = isCurrMonth ? today.getDate() : daysInMonth
    const monthPct = Math.round((dayOfMonth / daysInMonth) * 100)
    if (monthPct >= 50) {
      for (const r of (missingRows as unknown as { rows: { cname: string; past_count: number }[] })
        .rows) {
        anomalies.push({
          type: "missing",
          severity: "info",
          title: `「${r.cname}」本月還沒記過`,
          detail: `過去 3 月共記 ${r.past_count} 次的固定分類、月過 ${monthPct}% 仍空白、檢查是否漏記`,
        })
      }
    }

    res.json({ month: monthStr, count: anomalies.length, anomalies })
  })
)

/**
 * DELETE /api/household/expenses/:id  (alias for /api/household-expenses/:id)
 * 給前端 /household-budget 頁直接刪除
 */
router.delete(
  "/api/household/expenses/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")
    await storage.deleteHouseholdExpense(id)
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
        WHERE date >= NOW() - INTERVAL '365 days'
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

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

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
      WHERE date >= ${monthStart}::date AND date < ${monthEnd}::date
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
      WHERE year = ${y} AND month = ${m} AND category_id = ${TOTAL_BUDGET_CATEGORY_ID}
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
      WHERE date >= ${sevenAgoStr}::date AND date < ${tomorrowStr}::date
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
        COALESCE(fc.color, '#9CA3AF') AS color
      FROM household_expenses he
      LEFT JOIN fixed_categories fc ON he.category_id = fc.id
      WHERE he.date >= ${startDate}::date AND he.date < ${endDate}::date
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
        WHERE he.date >= NOW() - INTERVAL '90 days'
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
        COALESCE(fc.color, '#9CA3AF') AS color,
        COUNT(*)::int AS uses,
        COALESCE(SUM(he.amount::numeric), 0)::text AS "totalAmount",
        MAX(he.date)::text AS "lastUsedAt"
      FROM household_expenses he
      LEFT JOIN fixed_categories fc ON he.category_id = fc.id
      WHERE he.date >= NOW() - (${days}::int * INTERVAL '1 day')
        AND he.category_id IS NOT NULL
      GROUP BY he.category_id, fc.category_name, fc.color
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
      WHERE year = ${year} AND month = ${month} AND category_id = ${TOTAL_BUDGET_CATEGORY_ID}
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
      WHERE date >= ${prevStart}::date AND date < ${endDate}::date
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
      WHERE he.date >= ${startDate}::date AND he.date < ${endDate}::date
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
      WHERE date >= ${startDate}::date AND date < ${endDate}::date
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
      WHERE date >= ${startStr}::date AND date < ${endStr}::date
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
      WHERE category_id = ${TOTAL_BUDGET_CATEGORY_ID}
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
        WHERE he.date >= ${startDate}::date AND he.date < ${endDate}::date
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
