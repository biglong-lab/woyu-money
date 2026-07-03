/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 01，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { insertHouseholdBudgetSchema, insertHouseholdExpenseSchema } from "@shared/schema"
import { receiptUpload } from "../upload-config"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"
import { localDateTPE } from "@shared/date-utils"
import { recognizeDocument } from "../../document-ai"
import fs from "fs"
import path from "path"
import { getFixedCategories } from "../../storage/categories"
import {
  createHouseholdExpense,
  createOrUpdateHouseholdBudget,
  deleteHouseholdExpense,
  getHouseholdCategoryBudgets,
  getHouseholdExpenses,
  updateHouseholdCategoryBudget,
  updateHouseholdExpense,
} from "../../storage/household"
import { parseYearMonth, TOTAL_BUDGET_CATEGORY_ID } from "./helpers"

const router = Router()

router.get(
  "/api/household-categories",
  asyncHandler(async (req, res) => {
    const categories = await getFixedCategories()
    res.json(categories)
  })
)

// 家用預算
router.get(
  "/api/household-budgets",
  asyncHandler(async (req, res) => {
    const budgets = await getHouseholdCategoryBudgets()
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
    const budget = await createOrUpdateHouseholdBudget(result.data)
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
    const budget = await updateHouseholdCategoryBudget(id, result.data)
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

    const expenses = await getHouseholdExpenses(filters, pageNum, limitNum)
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
    const expense = await createHouseholdExpense(result.data)
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
    const expense = await updateHouseholdExpense(id, result.data)
    res.json(expense)
  })
)

router.delete(
  "/api/household-expenses/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    await deleteHouseholdExpense(id)
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
      WHERE year = ${year} AND month = ${month} AND is_total_budget = true
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
      WHERE year = ${year} AND month = ${month} AND is_total_budget = true
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
        INSERT INTO household_budgets (category_id, is_total_budget, year, month, budget_amount, notes, is_active, created_at, updated_at)
        VALUES (${TOTAL_BUDGET_CATEGORY_ID}, true, ${year}, ${month}, ${amt}, ${notes ?? null}, true, NOW(), NOW())
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
      WHERE NOT he.is_deleted AND he.date >= ${startDate}::date AND he.date < ${endDate}::date
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
    const date = body.date ?? localDateTPE()
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
    const expense = await createHouseholdExpense(result.data)
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
      WHERE year = ${year} AND month = ${month} AND is_total_budget = true
      LIMIT 1
    `)
    const budgetAmount = parseFloat(
      (budgetRows as unknown as { rows: { amt: string }[] }).rows[0]?.amt ?? "0"
    )

    // 月支出加總 + 計數
    const totalRows = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0)::text AS total, COUNT(*)::int AS count
      FROM household_expenses
      WHERE NOT is_deleted AND date >= ${startDate}::date AND date < ${endDate}::date
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
      WHERE NOT he.is_deleted AND he.date >= ${startDate}::date AND he.date < ${endDate}::date
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
    const categories = await getFixedCategories()
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
        WHERE NOT is_deleted AND date >= ${past3Start}::date AND date < ${startDate}::date
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
      WHERE NOT he.is_deleted AND he.date >= ${startDate}::date AND he.date < ${endDate}::date
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
      WHERE NOT he.is_deleted AND he.date >= ${startDate}::date AND he.date < ${endDate}::date
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
        WHERE NOT is_deleted AND date >= ${past3Start}::date AND date < ${startDate}::date
          AND category_id IS NOT NULL
        GROUP BY category_id
        HAVING COUNT(*) >= 3
      ),
      curr_cats AS (
        SELECT DISTINCT category_id
        FROM household_expenses
        WHERE NOT is_deleted AND date >= ${startDate}::date AND date < ${endDate}::date
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

export default router
