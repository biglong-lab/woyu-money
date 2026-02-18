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
// PMS vs PM 月度比對（含分店明細）
// ─────────────────────────────────────────────

router.get(
  "/api/pms-bridge/compare",
  asyncHandler(async (req, res) => {
    const startMonth = parseMonth(
      req.query.startMonth ?? "2025-08", // 預設從 2025-08（PM 開始完整記錄）
      "startMonth"
    )
    const endMonth = parseMonth(
      req.query.endMonth ?? new Date().toISOString().slice(0, 7),
      "endMonth"
    )

    const { Pool } = await import("pg")
    const pmsPool = new Pool({ connectionString: process.env.PMS_DATABASE_URL, max: 2 })
    const pmPool  = new Pool({ connectionString: process.env.PM_DATABASE_URL,  max: 2 })

    try {
      const [pmsMonthly, pmsBranch, pmResult] = await Promise.all([
        // PMS 月度彙總
        pmsPool.query<{ month: string; total: string; branches: string }>(`
          WITH latest AS (
            SELECT DISTINCT ON (branch_id, TO_CHAR(date, 'YYYY-MM'))
              TO_CHAR(date, 'YYYY-MM') AS month,
              branch_id,
              current_month_revenue
            FROM performance_entries
            WHERE TO_CHAR(date, 'YYYY-MM') >= $1
              AND TO_CHAR(date, 'YYYY-MM') <= $2
            ORDER BY branch_id, TO_CHAR(date, 'YYYY-MM'), date DESC
          )
          SELECT month,
                 SUM(current_month_revenue)::text AS total,
                 COUNT(*)::text                   AS branches
          FROM latest
          GROUP BY month ORDER BY month
        `, [startMonth, endMonth]),

        // PMS 分店明細（每月每分店最後一筆）
        pmsPool.query<{
          month: string; branch_id: string; branch_name: string
          branch_code: string; revenue: string; last_date: string
        }>(`
          WITH latest AS (
            SELECT DISTINCT ON (pe.branch_id, TO_CHAR(pe.date, 'YYYY-MM'))
              TO_CHAR(pe.date, 'YYYY-MM')      AS month,
              pe.branch_id::text               AS branch_id,
              b.name                           AS branch_name,
              b.code                           AS branch_code,
              pe.current_month_revenue::text   AS revenue,
              pe.date::text                    AS last_date
            FROM performance_entries pe
            JOIN branches b ON b.id = pe.branch_id
            WHERE TO_CHAR(pe.date, 'YYYY-MM') >= $1
              AND TO_CHAR(pe.date, 'YYYY-MM') <= $2
            ORDER BY pe.branch_id, TO_CHAR(pe.date, 'YYYY-MM'), pe.date DESC
          )
          SELECT * FROM latest ORDER BY month, branch_id
        `, [startMonth, endMonth]),

        // PM 月度彙總
        pmPool.query<{ month: string; total: string; records: string }>(`
          SELECT
            TO_CHAR(date AT TIME ZONE 'Asia/Taipei', 'YYYY-MM') AS month,
            SUM(amount::numeric)::text AS total,
            COUNT(*)::text             AS records
          FROM revenues
          WHERE deleted_at IS NULL
            AND TO_CHAR(date AT TIME ZONE 'Asia/Taipei', 'YYYY-MM') >= $1
            AND TO_CHAR(date AT TIME ZONE 'Asia/Taipei', 'YYYY-MM') <= $2
          GROUP BY TO_CHAR(date AT TIME ZONE 'Asia/Taipei', 'YYYY-MM')
          ORDER BY month
        `, [startMonth, endMonth]),
      ])

      // 建立分店明細 Map（按月份）
      const branchDetailMap = new Map<string, typeof pmsBranch.rows>()
      for (const row of pmsBranch.rows) {
        if (!branchDetailMap.has(row.month)) branchDetailMap.set(row.month, [])
        branchDetailMap.get(row.month)!.push(row)
      }

      // 合併比對
      const months = new Set([
        ...pmsMonthly.rows.map((r) => r.month),
        ...pmResult.rows.map((r) => r.month),
      ])
      const pmsMap = new Map(pmsMonthly.rows.map((r) => [r.month, r]))
      const pmMap  = new Map(pmResult.rows.map((r) => [r.month, r]))

      const comparison = Array.from(months).sort().map((month) => {
        const pms = pmsMap.get(month)
        const pm  = pmMap.get(month)
        const pmsTotal = pms ? parseFloat(pms.total) : 0
        const pmTotal  = pm  ? parseFloat(pm.total)  : 0
        const diff     = pmsTotal - pmTotal
        // 若 PM 幾乎無資料（< 10 筆），diffPct 不具參考意義，標為 null
        const pmRecords = pm ? parseInt(pm.records) : 0
        const diffPct =
          pmTotal > 0 && pmRecords >= 10
            ? Math.round(((diff / pmTotal) * 100) * 10) / 10
            : null

        return {
          month,
          pms: {
            total: pmsTotal,
            branches: pms ? parseInt(pms.branches) : 0,
            branchDetail: (branchDetailMap.get(month) ?? []).map((b) => ({
              branchId:   parseInt(b.branch_id),
              branchName: b.branch_name,
              branchCode: b.branch_code,
              revenue:    parseFloat(b.revenue),
              lastDate:   b.last_date,
            })),
          },
          pm: {
            total:   pmTotal,
            records: pmRecords,
          },
          diff,
          diffPct,
          // 若 PM 資料不足，不作 match/higher 判斷
          status:
            pmRecords < 10
              ? "insufficient_pm"
              : Math.abs(diff) < 1000
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
