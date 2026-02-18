/**
 * 每日收款記錄 & 收入報表 路由
 *
 * 資料來源：
 *   1. daily_revenues — 手動輸入的每日收款
 *   2. income_webhooks — 外部系統（PM、未來其他系統）API 同步進來的進帳
 *
 * CRUD: GET/POST /api/daily-revenues, PATCH/DELETE /api/daily-revenues/:id
 * 報表: GET /api/revenue/reports/stats|by-project|daily-trend|monthly-trend|yearly-comparison
 *       GET /api/revenue/reports/sources   (各來源統計)
 */

import { Router } from "express"
import { db } from "../db"
import { dailyRevenues, incomeWebhooks, incomeSources, paymentProjects } from "@shared/schema"
import { eq, desc, sql, and, gte, lte, asc, inArray } from "drizzle-orm"
import { asyncHandler, AppError } from "../middleware/error-handler"
import multer from "multer"
import path from "path"
import fs from "fs"
import { uploadDir } from "./upload-config"

const router = Router()

// ─────────────────────────────────────────────
// 上傳設定
// ─────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(uploadDir, "receipts")
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `receipt-${Date.now()}${ext}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

// ─────────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────────

function parseOptionalDate(value: unknown): string | undefined {
  if (!value) return undefined
  const str = String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return undefined
  return str
}

/**
 * 收入資料 UNION SQL
 *
 * 合併兩個來源：
 *  - daily_revenues（manual）
 *  - income_webhooks（api_sync，僅取 pending + confirmed，排除 rejected/duplicate/error）
 *
 * 欄位統一為：date TEXT, amount NUMERIC, project_name TEXT, source_type TEXT
 */
function buildRevenueUnionSQL(startDate?: string, endDate?: string) {
  const dateFilter = (dateExpr: string) => {
    const parts: string[] = []
    if (startDate) parts.push(`${dateExpr} >= '${startDate}'`)
    if (endDate) parts.push(`${dateExpr} <= '${endDate}'`)
    return parts.length > 0 ? `AND ${parts.join(" AND ")}` : ""
  }

  // daily_revenues 透過 payment_projects join 取 project_name
  const manualSql = `
    SELECT
      dr.date::text            AS date,
      dr.amount::numeric       AS amount,
      COALESCE(pp.project_name, '未分類') AS project_name,
      'manual'                 AS source_type,
      dr.description           AS description
    FROM daily_revenues dr
    LEFT JOIN payment_projects pp ON pp.id = dr.project_id
    WHERE 1=1 ${dateFilter("dr.date")}
  `

  // income_webhooks 透過 income_sources.default_project_id 取 project_name
  // 僅取 pending（待確認）和 confirmed（已確認），排除 rejected / duplicate / error
  const webhookSql = `
    SELECT
      TO_CHAR(iw.parsed_paid_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') AS date,
      iw.parsed_amount_twd::numeric AS amount,
      COALESCE(pp.project_name, iw.parsed_payer_name, '未分類') AS project_name,
      COALESCE(src.source_type, 'api_sync')                    AS source_type,
      iw.parsed_description AS description
    FROM income_webhooks iw
    LEFT JOIN income_sources src ON src.id = iw.source_id
    LEFT JOIN payment_projects pp ON pp.id = src.default_project_id
    WHERE iw.status IN ('pending', 'confirmed')
      AND iw.parsed_paid_at IS NOT NULL
      AND iw.parsed_amount_twd IS NOT NULL
      ${dateFilter("TO_CHAR(iw.parsed_paid_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD')")}
  `

  return `(${manualSql}) UNION ALL (${webhookSql})`
}

// ─────────────────────────────────────────────
// CRUD（daily_revenues 手動記錄）
// ─────────────────────────────────────────────

/** GET /api/daily-revenues */
router.get(
  "/api/daily-revenues",
  asyncHandler(async (req, res) => {
    const startDate = parseOptionalDate(req.query.startDate)
    const endDate = parseOptionalDate(req.query.endDate)
    const projectId = req.query.projectId ? parseInt(String(req.query.projectId)) : undefined

    const conditions = []
    if (startDate) conditions.push(gte(dailyRevenues.date, startDate))
    if (endDate) conditions.push(lte(dailyRevenues.date, endDate))
    if (projectId && !isNaN(projectId)) conditions.push(eq(dailyRevenues.projectId, projectId))

    const rows = await db
      .select({
        id: dailyRevenues.id,
        projectId: dailyRevenues.projectId,
        projectName: paymentProjects.projectName,
        date: dailyRevenues.date,
        amount: dailyRevenues.amount,
        description: dailyRevenues.description,
        receiptImageUrl: dailyRevenues.receiptImageUrl,
        createdAt: dailyRevenues.createdAt,
      })
      .from(dailyRevenues)
      .leftJoin(paymentProjects, eq(dailyRevenues.projectId, paymentProjects.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dailyRevenues.date), desc(dailyRevenues.id))

    res.json(rows)
  })
)

/** POST /api/daily-revenues */
router.post(
  "/api/daily-revenues",
  upload.single("receiptImage"),
  asyncHandler(async (req, res) => {
    const { projectId, date, amount, description } = req.body as Record<string, string>

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new AppError(400, "date 格式錯誤，需為 YYYY-MM-DD")
    if (!amount || isNaN(parseFloat(amount)))
      throw new AppError(400, "amount 格式錯誤")

    const receiptImageUrl = req.file
      ? `/uploads/receipts/${req.file.filename}`
      : undefined

    const [row] = await db
      .insert(dailyRevenues)
      .values({
        projectId: projectId ? parseInt(projectId) : undefined,
        date,
        amount,
        description: description || undefined,
        receiptImageUrl,
      })
      .returning()

    res.status(201).json(row)
  })
)

/** PATCH /api/daily-revenues/:id */
router.patch(
  "/api/daily-revenues/:id",
  upload.single("receiptImage"),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 id")

    const existing = await db
      .select()
      .from(dailyRevenues)
      .where(eq(dailyRevenues.id, id))
    if (existing.length === 0) throw new AppError(404, "找不到記錄")

    const { projectId, date, amount, description } = req.body as Record<string, string>

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError(400, "date 格式錯誤")
      updates.date = date
    }
    if (amount !== undefined) {
      if (isNaN(parseFloat(amount))) throw new AppError(400, "amount 格式錯誤")
      updates.amount = amount
    }
    if (projectId !== undefined) updates.projectId = projectId ? parseInt(projectId) : null
    if (description !== undefined) updates.description = description
    if (req.file) updates.receiptImageUrl = `/uploads/receipts/${req.file.filename}`

    const [updated] = await db
      .update(dailyRevenues)
      .set(updates)
      .where(eq(dailyRevenues.id, id))
      .returning()

    res.json(updated)
  })
)

/** DELETE /api/daily-revenues/:id */
router.delete(
  "/api/daily-revenues/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 id")

    await db.delete(dailyRevenues).where(eq(dailyRevenues.id, id))
    res.json({ success: true })
  })
)

// ─────────────────────────────────────────────
// 報表 API（合併兩個來源）
// ─────────────────────────────────────────────

/** GET /api/revenue/reports/stats */
router.get(
  "/api/revenue/reports/stats",
  asyncHandler(async (req, res) => {
    const startDate = parseOptionalDate(req.query.startDate)
    const endDate = parseOptionalDate(req.query.endDate)

    const unionSql = buildRevenueUnionSQL(startDate, endDate)

    const result = await db.execute(sql.raw(`
      SELECT
        COALESCE(SUM(amount), 0)::numeric AS total_revenue,
        COUNT(*)::int                      AS record_count,
        MIN(date)                          AS min_date,
        MAX(date)                          AS max_date
      FROM (${unionSql}) AS combined
    `))

    const row = result.rows[0] as {
      total_revenue: string
      record_count: number
      min_date: string | null
      max_date: string | null
    }

    let avgDaily = 0
    if (row.record_count > 0 && row.min_date && row.max_date) {
      const diffMs = new Date(row.max_date).getTime() - new Date(row.min_date).getTime()
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1)
      avgDaily = Number(row.total_revenue) / diffDays
    }

    res.json({
      totalRevenue: Number(row.total_revenue),
      recordCount: row.record_count,
      avgDaily: Math.round(avgDaily),
    })
  })
)

/** GET /api/revenue/reports/by-project */
router.get(
  "/api/revenue/reports/by-project",
  asyncHandler(async (req, res) => {
    const startDate = parseOptionalDate(req.query.startDate)
    const endDate = parseOptionalDate(req.query.endDate)

    const unionSql = buildRevenueUnionSQL(startDate, endDate)

    const result = await db.execute(sql.raw(`
      SELECT
        project_name,
        SUM(amount)::numeric AS total_revenue,
        COUNT(*)::int        AS record_count
      FROM (${unionSql}) AS combined
      GROUP BY project_name
      ORDER BY total_revenue DESC
    `))

    res.json(
      result.rows.map((r: Record<string, unknown>, idx: number) => ({
        projectId: idx,
        projectName: r.project_name ?? "未分類",
        totalRevenue: Number(r.total_revenue),
        recordCount: Number(r.record_count),
      }))
    )
  })
)

/** GET /api/revenue/reports/daily-trend */
router.get(
  "/api/revenue/reports/daily-trend",
  asyncHandler(async (req, res) => {
    const startDate = parseOptionalDate(req.query.startDate)
    const endDate = parseOptionalDate(req.query.endDate)
    const limitN = Math.min(parseInt(String(req.query.limit ?? "30")), 365)

    const unionSql = buildRevenueUnionSQL(startDate, endDate)

    const result = await db.execute(sql.raw(`
      SELECT
        date,
        SUM(amount)::numeric AS total_revenue
      FROM (${unionSql}) AS combined
      WHERE date IS NOT NULL
      GROUP BY date
      ORDER BY date DESC
      LIMIT ${limitN}
    `))

    // 回傳時間順序（舊→新）
    const rows = (result.rows as Array<{ date: string; total_revenue: string }>)
      .reverse()
      .map((r) => ({ date: r.date, totalRevenue: Number(r.total_revenue) }))

    res.json(rows)
  })
)

/** GET /api/revenue/reports/monthly-trend */
router.get(
  "/api/revenue/reports/monthly-trend",
  asyncHandler(async (req, res) => {
    const startDate = parseOptionalDate(req.query.startDate)
    const endDate = parseOptionalDate(req.query.endDate)
    const limitN = Math.min(parseInt(String(req.query.limit ?? "12")), 60)

    const unionSql = buildRevenueUnionSQL(startDate, endDate)

    const result = await db.execute(sql.raw(`
      SELECT
        SUBSTR(date, 1, 7)       AS month,
        SUM(amount)::numeric     AS total_revenue
      FROM (${unionSql}) AS combined
      WHERE date IS NOT NULL
      GROUP BY SUBSTR(date, 1, 7)
      ORDER BY month ASC
      LIMIT ${limitN}
    `))

    res.json(
      (result.rows as Array<{ month: string; total_revenue: string }>).map((r) => ({
        month: r.month,
        totalRevenue: Number(r.total_revenue),
      }))
    )
  })
)

/** GET /api/revenue/reports/yearly-comparison */
router.get(
  "/api/revenue/reports/yearly-comparison",
  asyncHandler(async (_req, res) => {
    const unionSql = buildRevenueUnionSQL()

    const result = await db.execute(sql.raw(`
      SELECT
        EXTRACT(YEAR  FROM date::date)::int AS year,
        EXTRACT(MONTH FROM date::date)::int AS month,
        SUM(amount)::numeric                AS total_revenue
      FROM (${unionSql}) AS combined
      WHERE date IS NOT NULL
      GROUP BY year, month
      ORDER BY year ASC, month ASC
    `))

    res.json(
      (result.rows as Array<{ year: number; month: number; total_revenue: string }>).map((r) => ({
        year: r.year,
        month: r.month,
        totalRevenue: Number(r.total_revenue),
      }))
    )
  })
)

/** GET /api/revenue/reports/sources
 *  各來源（PM/手動/...）的收入統計，方便未來追蹤哪個系統貢獻多少
 */
router.get(
  "/api/revenue/reports/sources",
  asyncHandler(async (req, res) => {
    const startDate = parseOptionalDate(req.query.startDate)
    const endDate = parseOptionalDate(req.query.endDate)

    const unionSql = buildRevenueUnionSQL(startDate, endDate)

    const result = await db.execute(sql.raw(`
      SELECT
        source_type,
        SUM(amount)::numeric AS total_revenue,
        COUNT(*)::int        AS record_count
      FROM (${unionSql}) AS combined
      GROUP BY source_type
      ORDER BY total_revenue DESC
    `))

    res.json(
      (result.rows as Array<{ source_type: string; total_revenue: string; record_count: number }>).map((r) => ({
        sourceType: r.source_type,
        totalRevenue: Number(r.total_revenue),
        recordCount: r.record_count,
      }))
    )
  })
)

export default router
