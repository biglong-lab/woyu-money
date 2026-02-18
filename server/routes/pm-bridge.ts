/**
 * PM Bridge 路由
 *
 * 提供從 PM 旅館系統同步收入資料的 API 端點
 * 所有操作均為唯讀存取 PM 系統，只在 Money 的 incomeWebhooks 寫入
 */

import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { syncPmRevenues, previewPmRevenues, ensurePmBridgeSource } from "../storage/pm-bridge"

const router = Router()

// ─────────────────────────────────────────────
// 工具：驗證日期格式
// ─────────────────────────────────────────────

function parseDate(value: unknown, fieldName: string): string {
  const str = String(value ?? "")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    throw new AppError(400, `${fieldName} 格式錯誤，需為 YYYY-MM-DD`)
  }
  return str
}

// ─────────────────────────────────────────────
// GET /api/pm-bridge/preview
// 預覽會匯入的資料（不寫入）
// ─────────────────────────────────────────────

/**
 * 預覽 PM 系統收入資料
 * Query: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), companyId? (number)
 */
router.get(
  "/api/pm-bridge/preview",
  asyncHandler(async (req, res) => {
    const startDate = parseDate(req.query.startDate, "startDate")
    const endDate = parseDate(req.query.endDate, "endDate")
    const companyId = req.query.companyId
      ? parseInt(String(req.query.companyId))
      : undefined

    if (companyId !== undefined && isNaN(companyId)) {
      throw new AppError(400, "companyId 格式錯誤")
    }

    try {
      const preview = await previewPmRevenues(startDate, endDate, companyId)
      const newCount = preview.filter((r) => !r.alreadyImported).length
      res.json({ total: preview.length, newCount, records: preview })
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("PM_DATABASE_URL")) {
        throw new AppError(503, "PM 旅館系統資料庫未設定，請確認 PM_DATABASE_URL 環境變數")
      }
      throw err
    }
  })
)

// ─────────────────────────────────────────────
// POST /api/pm-bridge/sync
// 執行同步（寫入 incomeWebhooks）
// ─────────────────────────────────────────────

/**
 * 將 PM 系統收入資料同步到 Money incomeWebhooks
 * Body: { startDate, endDate, companyId? }
 */
router.post(
  "/api/pm-bridge/sync",
  asyncHandler(async (req, res) => {
    const { startDate: rawStart, endDate: rawEnd, companyId: rawCompanyId } = req.body as {
      startDate?: unknown
      endDate?: unknown
      companyId?: unknown
    }

    const startDate = parseDate(rawStart, "startDate")
    const endDate = parseDate(rawEnd, "endDate")

    let companyId: number | undefined
    if (rawCompanyId !== undefined && rawCompanyId !== null && rawCompanyId !== "") {
      companyId = parseInt(String(rawCompanyId))
      if (isNaN(companyId)) throw new AppError(400, "companyId 格式錯誤")
    }

    // 日期範圍合理性檢查（最多 366 天）
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (start > end) throw new AppError(400, "startDate 不能晚於 endDate")
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 366) throw new AppError(400, "日期範圍最多 366 天")

    try {
      const result = await syncPmRevenues(startDate, endDate, companyId)
      res.json({
        success: true,
        message: `同步完成：新增 ${result.synced} 筆，略過 ${result.skipped} 筆，錯誤 ${result.errors} 筆`,
        ...result,
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("PM_DATABASE_URL")) {
        throw new AppError(503, "PM 旅館系統資料庫未設定，請確認 PM_DATABASE_URL 環境變數")
      }
      throw err
    }
  })
)

// ─────────────────────────────────────────────
// GET /api/pm-bridge/companies
// 取得 PM 系統的館舍清單
// ─────────────────────────────────────────────

router.get(
  "/api/pm-bridge/companies",
  asyncHandler(async (_req, res) => {
    const { Pool } = await import("pg")
    const connStr = process.env.PM_DATABASE_URL
    if (!connStr) {
      throw new AppError(503, "PM 旅館系統資料庫未設定，請確認 PM_DATABASE_URL 環境變數")
    }
    const pool = new Pool({ connectionString: connStr, max: 1 })
    try {
      const result = await pool.query("SELECT id, name FROM companies ORDER BY id")
      res.json(result.rows)
    } finally {
      await pool.end()
    }
  })
)

// ─────────────────────────────────────────────
// GET /api/pm-bridge/status
// 確認連線狀態與已同步資訊
// ─────────────────────────────────────────────

router.get(
  "/api/pm-bridge/status",
  asyncHandler(async (_req, res) => {
    // 檢查 PM DB 連線
    let pmConnected = false
    let pmError: string | null = null
    let pmRevenueCount: number | null = null

    const connStr = process.env.PM_DATABASE_URL
    if (!connStr) {
      pmError = "PM_DATABASE_URL 未設定"
    } else {
      const { Pool } = await import("pg")
      const pool = new Pool({ connectionString: connStr, max: 1 })
      try {
        const r = await pool.query("SELECT COUNT(*) as cnt FROM revenues WHERE deleted_at IS NULL")
        pmConnected = true
        pmRevenueCount = parseInt(r.rows[0].cnt)
      } catch (e: unknown) {
        pmError = e instanceof Error ? e.message : String(e)
      } finally {
        await pool.end()
      }
    }

    // 查 Money 端已匯入的數量
    let importedCount = 0
    let sourceId: number | null = null
    try {
      sourceId = await ensurePmBridgeSource()
      const { db } = await import("../db")
      const { incomeWebhooks } = await import("@shared/schema")
      const { eq } = await import("drizzle-orm")
      const r = await db
        .select({ id: incomeWebhooks.id })
        .from(incomeWebhooks)
        .where(eq(incomeWebhooks.sourceId, sourceId))
      importedCount = r.length
    } catch {
      // ignore
    }

    res.json({
      pm: {
        connected: pmConnected,
        error: pmError,
        totalRevenues: pmRevenueCount,
      },
      money: {
        sourceId,
        importedCount,
      },
    })
  })
)

export default router
