/**
 * PMS Bridge 路由
 *
 * 提供從 PMS 績效管理系統同步月度收入的 API 端點
 * PMS 資料：每月累計，取每月最後一筆 = 當月實際收入
 *
 * 雲端化：PMS_DATABASE_URL 改為遠端 URL 即可，路由不需變動
 */

import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import {
  syncPmsRevenues,
  previewPmsRevenues,
  ensurePmsBridgeSource,
} from "../storage/pms-bridge"

const router = Router()

// ─────────────────────────────────────────────
// 工具：驗證月份格式 YYYY-MM
// ─────────────────────────────────────────────

function parseMonth(value: unknown, fieldName: string): string {
  const str = String(value ?? "")
  if (!/^\d{4}-\d{2}$/.test(str)) {
    throw new AppError(400, `${fieldName} 格式錯誤，需為 YYYY-MM`)
  }
  return str
}

// ─────────────────────────────────────────────
// GET /api/pms-bridge/preview
// 預覽 PMS 月度收入（不寫入）
// ─────────────────────────────────────────────

router.get(
  "/api/pms-bridge/preview",
  asyncHandler(async (req, res) => {
    const startMonth = parseMonth(
      req.query.startMonth ?? "2025-07",
      "startMonth"
    )
    const endMonth = parseMonth(
      req.query.endMonth ?? new Date().toISOString().slice(0, 7),
      "endMonth"
    )

    try {
      const preview = await previewPmsRevenues(startMonth, endMonth)
      res.json({
        startMonth,
        endMonth,
        summary: preview.summary,
        branches: preview.branches,
        records: preview.revenues,
        totalRecords: preview.revenues.length,
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("PMS_DATABASE_URL")) {
        throw new AppError(
          503,
          "PMS 系統資料庫未設定，請確認 PMS_DATABASE_URL 環境變數"
        )
      }
      throw err
    }
  })
)

// ─────────────────────────────────────────────
// POST /api/pms-bridge/sync
// 同步 PMS 月度收入到 income_webhooks
// ─────────────────────────────────────────────

router.post(
  "/api/pms-bridge/sync",
  asyncHandler(async (req, res) => {
    const { startMonth: rawStart, endMonth: rawEnd } = req.body as {
      startMonth?: unknown
      endMonth?: unknown
    }

    const startMonth = parseMonth(rawStart ?? "2025-07", "startMonth")
    const endMonth = parseMonth(
      rawEnd ?? new Date().toISOString().slice(0, 7),
      "endMonth"
    )

    try {
      const result = await syncPmsRevenues(startMonth, endMonth)
      res.json({
        success: true,
        message: `PMS 同步完成：新增 ${result.synced} 筆，更新 ${result.updated} 筆，略過 ${result.skipped} 筆`,
        ...result,
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("PMS_DATABASE_URL")) {
        throw new AppError(
          503,
          "PMS 系統資料庫未設定，請確認 PMS_DATABASE_URL 環境變數"
        )
      }
      throw err
    }
  })
)

// ─────────────────────────────────────────────
// GET /api/pms-bridge/status
// 查看 PMS Bridge 設定狀態與資料筆數
// ─────────────────────────────────────────────

router.get(
  "/api/pms-bridge/status",
  asyncHandler(async (_req, res) => {
    try {
      const sourceId = await ensurePmsBridgeSource()
      res.json({
        connected: true,
        sourceId,
        message: "PMS Bridge 連線正常",
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("PMS_DATABASE_URL")) {
        res.json({
          connected: false,
          message: "PMS_DATABASE_URL 未設定",
        })
        return
      }
      throw err
    }
  })
)

// ─────────────────────────────────────────────
// GET /api/pms-bridge/compare
// PMS vs PM 月度比對
// 傳回兩個系統的月度匯總，供差距分析
// ─────────────────────────────────────────────

router.get(
  "/api/pms-bridge/compare",
  asyncHandler(async (req, res) => {
    const startMonth = parseMonth(
      req.query.startMonth ?? "2025-07",
      "startMonth"
    )
    const endMonth = parseMonth(
      req.query.endMonth ?? new Date().toISOString().slice(0, 7),
      "endMonth"
    )

    const { Pool } = await import("pg")

    // PMS 月度數據（每月最後一筆 = 當月實際）
    const pmsPool = new Pool({
      connectionString: process.env.PMS_DATABASE_URL,
      max: 2,
    })

    // PM 月度數據
    const pmPool = new Pool({
      connectionString: process.env.PM_DATABASE_URL,
      max: 2,
    })

    try {
      const [pmsResult, pmResult] = await Promise.all([
        pmsPool.query<{ month: string; total: string; branches: string }>(`
          WITH latest_per_month AS (
            SELECT DISTINCT ON (branch_id, TO_CHAR(date, 'YYYY-MM'))
              TO_CHAR(date, 'YYYY-MM') AS month,
              branch_id,
              current_month_revenue
            FROM performance_entries
            WHERE TO_CHAR(date, 'YYYY-MM') >= $1
              AND TO_CHAR(date, 'YYYY-MM') <= $2
            ORDER BY branch_id, TO_CHAR(date, 'YYYY-MM'), date DESC
          )
          SELECT month, SUM(current_month_revenue)::text AS total, COUNT(*)::text AS branches
          FROM latest_per_month
          GROUP BY month
          ORDER BY month
        `, [startMonth, endMonth]),

        pmPool.query<{ month: string; total: string; records: string }>(`
          SELECT
            TO_CHAR(date AT TIME ZONE 'Asia/Taipei', 'YYYY-MM') AS month,
            SUM(amount::numeric)::text AS total,
            COUNT(*)::text AS records
          FROM revenues
          WHERE deleted_at IS NULL
            AND TO_CHAR(date AT TIME ZONE 'Asia/Taipei', 'YYYY-MM') >= $1
            AND TO_CHAR(date AT TIME ZONE 'Asia/Taipei', 'YYYY-MM') <= $2
          GROUP BY TO_CHAR(date AT TIME ZONE 'Asia/Taipei', 'YYYY-MM')
          ORDER BY month
        `, [startMonth, endMonth]),
      ])

      // 合併比對
      const months = new Set([
        ...pmsResult.rows.map((r) => r.month),
        ...pmResult.rows.map((r) => r.month),
      ])

      const pmsMap = new Map(pmsResult.rows.map((r) => [r.month, r]))
      const pmMap = new Map(pmResult.rows.map((r) => [r.month, r]))

      const comparison = Array.from(months)
        .sort()
        .map((month) => {
          const pms = pmsMap.get(month)
          const pm = pmMap.get(month)
          const pmsTotal = pms ? parseFloat(pms.total) : 0
          const pmTotal = pm ? parseFloat(pm.total) : 0
          const diff = pmsTotal - pmTotal
          const diffPct = pmTotal > 0 ? (diff / pmTotal) * 100 : null

          return {
            month,
            pms: {
              total: pmsTotal,
              branches: pms ? parseInt(pms.branches) : 0,
            },
            pm: {
              total: pmTotal,
              records: pm ? parseInt(pm.records) : 0,
            },
            diff,
            diffPct: diffPct !== null ? Math.round(diffPct * 10) / 10 : null,
            status:
              Math.abs(diff) < 1000
                ? "match"
                : diff > 0
                  ? "pms_higher"
                  : "pm_higher",
          }
        })

      res.json({ startMonth, endMonth, comparison })
    } finally {
      await Promise.all([pmsPool.end(), pmPool.end()])
    }
  })
)

export default router
