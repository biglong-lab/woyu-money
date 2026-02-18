/**
 * 每日收款記錄 & 收入報表 路由
 *
 * CRUD: GET/POST /api/daily-revenues, PATCH/DELETE /api/daily-revenues/:id
 * 報表: GET /api/revenue/reports/stats|by-project|daily-trend|monthly-trend|yearly-comparison
 */

import { Router } from "express"
import { db } from "../db"
import { dailyRevenues } from "@shared/schema"
import { paymentProjects } from "@shared/schema"
import { eq, desc, sql, and, gte, lte, asc } from "drizzle-orm"
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
// 工具
// ─────────────────────────────────────────────

function parseOptionalDate(value: unknown): string | undefined {
  if (!value) return undefined
  const str = String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return undefined
  return str
}

// ─────────────────────────────────────────────
// CRUD
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
// 報表 API
// ─────────────────────────────────────────────

/** GET /api/revenue/reports/stats */
router.get(
  "/api/revenue/reports/stats",
  asyncHandler(async (req, res) => {
    const startDate = parseOptionalDate(req.query.startDate)
    const endDate = parseOptionalDate(req.query.endDate)

    const conditions = []
    if (startDate) conditions.push(gte(dailyRevenues.date, startDate))
    if (endDate) conditions.push(lte(dailyRevenues.date, endDate))

    const [stats] = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${dailyRevenues.amount}::numeric), 0)`,
        recordCount: sql<number>`COUNT(*)::int`,
      })
      .from(dailyRevenues)
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    // 計算實際天數區間（用於計算平均日收入）
    const [dateRange] = await db
      .select({
        minDate: sql<string>`MIN(${dailyRevenues.date})`,
        maxDate: sql<string>`MAX(${dailyRevenues.date})`,
      })
      .from(dailyRevenues)
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    let avgDaily = 0
    if (stats.recordCount > 0 && dateRange.minDate && dateRange.maxDate) {
      const diffMs = new Date(dateRange.maxDate).getTime() - new Date(dateRange.minDate).getTime()
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1)
      avgDaily = Number(stats.totalRevenue) / diffDays
    }

    res.json({
      totalRevenue: Number(stats.totalRevenue),
      recordCount: stats.recordCount,
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

    const conditions = []
    if (startDate) conditions.push(gte(dailyRevenues.date, startDate))
    if (endDate) conditions.push(lte(dailyRevenues.date, endDate))

    const rows = await db
      .select({
        projectId: dailyRevenues.projectId,
        projectName: paymentProjects.projectName,
        totalRevenue: sql<number>`SUM(${dailyRevenues.amount}::numeric)`,
        recordCount: sql<number>`COUNT(*)::int`,
      })
      .from(dailyRevenues)
      .leftJoin(paymentProjects, eq(dailyRevenues.projectId, paymentProjects.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(dailyRevenues.projectId, paymentProjects.projectName)
      .orderBy(desc(sql`SUM(${dailyRevenues.amount}::numeric)`))

    res.json(
      rows.map((r) => ({
        ...r,
        projectName: r.projectName ?? "未分類",
        totalRevenue: Number(r.totalRevenue),
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
    const limit = Math.min(parseInt(String(req.query.limit ?? "30")), 365)

    const conditions = []
    if (startDate) conditions.push(gte(dailyRevenues.date, startDate))
    if (endDate) conditions.push(lte(dailyRevenues.date, endDate))

    const rows = await db
      .select({
        date: dailyRevenues.date,
        totalRevenue: sql<number>`SUM(${dailyRevenues.amount}::numeric)`,
      })
      .from(dailyRevenues)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(dailyRevenues.date)
      .orderBy(desc(dailyRevenues.date))
      .limit(limit)

    // 回傳時間順序（舊→新）
    res.json(
      rows.reverse().map((r) => ({
        date: r.date,
        totalRevenue: Number(r.totalRevenue),
      }))
    )
  })
)

/** GET /api/revenue/reports/monthly-trend */
router.get(
  "/api/revenue/reports/monthly-trend",
  asyncHandler(async (req, res) => {
    const startDate = parseOptionalDate(req.query.startDate)
    const endDate = parseOptionalDate(req.query.endDate)
    const limit = Math.min(parseInt(String(req.query.limit ?? "12")), 60)

    const conditions = []
    if (startDate) conditions.push(gte(dailyRevenues.date, startDate))
    if (endDate) conditions.push(lte(dailyRevenues.date, endDate))

    const rows = await db
      .select({
        month: sql<string>`TO_CHAR(${dailyRevenues.date}::date, 'YYYY-MM')`,
        totalRevenue: sql<number>`SUM(${dailyRevenues.amount}::numeric)`,
      })
      .from(dailyRevenues)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`TO_CHAR(${dailyRevenues.date}::date, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${dailyRevenues.date}::date, 'YYYY-MM')`))
      .limit(limit)

    res.json(
      rows.map((r) => ({
        month: r.month,
        totalRevenue: Number(r.totalRevenue),
      }))
    )
  })
)

/** GET /api/revenue/reports/yearly-comparison */
router.get(
  "/api/revenue/reports/yearly-comparison",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${dailyRevenues.date}::date)::int`,
        month: sql<number>`EXTRACT(MONTH FROM ${dailyRevenues.date}::date)::int`,
        totalRevenue: sql<number>`SUM(${dailyRevenues.amount}::numeric)`,
      })
      .from(dailyRevenues)
      .groupBy(
        sql`EXTRACT(YEAR FROM ${dailyRevenues.date}::date)`,
        sql`EXTRACT(MONTH FROM ${dailyRevenues.date}::date)`
      )
      .orderBy(
        asc(sql`EXTRACT(YEAR FROM ${dailyRevenues.date}::date)`),
        asc(sql`EXTRACT(MONTH FROM ${dailyRevenues.date}::date)`)
      )

    res.json(
      rows.map((r) => ({
        year: r.year,
        month: r.month,
        totalRevenue: Number(r.totalRevenue),
      }))
    )
  })
)

export default router
