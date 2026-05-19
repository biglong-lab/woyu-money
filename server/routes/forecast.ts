/**
 * 收入預測 API
 *
 * GET  /api/forecast/snapshots               — 列表
 * GET  /api/forecast/trend?targetMonth=...   — 該月走勢
 * GET  /api/forecast/simple?targetMonth=...  — 簡單線性推估
 * POST /api/forecast/capture                 — 立即拍快照
 * POST /api/forecast/backfill                — 從 PM 歷史 backfill
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import {
  listSnapshots,
  getMonthlyTrend,
  captureFromPM,
  backfillFromPMHistory,
  getSimpleForecast,
  getSeasonalForecast,
  getPmVsPmsMonthly,
} from "../storage/forecast-snapshots"
import { getIncomeSourceByKey, verifyBearerToken } from "../storage/income"
import { db } from "../db"
import { revenueForecastSnapshots } from "@shared/schema"
import { z } from "zod"
import { getCalibrationCurve, predictWithCalibration } from "../storage/pms-calibration"

const router = Router()

router.get(
  "/api/forecast/snapshots",
  asyncHandler(async (req, res) => {
    const targetMonth = req.query.targetMonth as string | undefined
    const companyIdRaw = req.query.companyId as string | undefined
    const companyId =
      companyIdRaw === "null" ? null : companyIdRaw ? parseInt(companyIdRaw, 10) : undefined
    const source = req.query.source as string | undefined
    const from = req.query.from as string | undefined

    if (targetMonth && !/^\d{4}-\d{2}$/.test(targetMonth)) {
      throw new AppError(400, "targetMonth 格式須為 YYYY-MM")
    }

    const rows = await listSnapshots({
      targetMonth,
      companyId: companyId === null ? undefined : companyId,
      source,
      from,
    })
    res.json(rows)
  })
)

router.get(
  "/api/forecast/trend",
  asyncHandler(async (req, res) => {
    const targetMonth = req.query.targetMonth as string
    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      throw new AppError(400, "targetMonth 必填，格式 YYYY-MM")
    }
    const companyIdRaw = req.query.companyId as string | undefined
    const companyId =
      companyIdRaw === undefined || companyIdRaw === "null" ? null : parseInt(companyIdRaw, 10)

    const trend = await getMonthlyTrend(targetMonth, companyId)
    res.json(trend)
  })
)

router.get(
  "/api/forecast/simple",
  asyncHandler(async (req, res) => {
    const targetMonth = req.query.targetMonth as string
    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      throw new AppError(400, "targetMonth 必填，格式 YYYY-MM")
    }
    const companyIdRaw = req.query.companyId as string | undefined
    const companyId =
      companyIdRaw === undefined || companyIdRaw === "null" ? null : parseInt(companyIdRaw, 10)

    res.json(await getSimpleForecast(targetMonth, companyId))
  })
)

router.get(
  "/api/forecast/seasonal",
  asyncHandler(async (req, res) => {
    const targetMonth = req.query.targetMonth as string
    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      throw new AppError(400, "targetMonth 必填，格式 YYYY-MM")
    }
    const companyIdRaw = req.query.companyId as string | undefined
    const companyId =
      companyIdRaw === undefined || companyIdRaw === "null" ? null : parseInt(companyIdRaw, 10)
    const historyMonths = req.query.historyMonths
      ? parseInt(req.query.historyMonths as string, 10)
      : 6

    res.json(await getSeasonalForecast(targetMonth, companyId, historyMonths))
  })
)

router.post(
  "/api/forecast/capture",
  asyncHandler(async (_req, res) => {
    const result = await captureFromPM()
    if (!result.ok) throw new AppError(500, result.error ?? "拍快照失敗")
    res.json(result)
  })
)

// PMS 預估校準模型
router.get(
  "/api/forecast/calibration",
  asyncHandler(async (req, res) => {
    const companyIdRaw = req.query.companyId as string | undefined
    const companyId =
      companyIdRaw === undefined || companyIdRaw === "null" ? null : parseInt(companyIdRaw, 10)
    res.json(await getCalibrationCurve(companyId))
  })
)

/**
 * 每月 PM 實際 vs PMS 月底紀錄對照
 * 用途：訓練校準模型 + 看訂單轉換率歷史
 */
router.get(
  "/api/forecast/pm-vs-pms-monthly",
  asyncHandler(async (_req, res) => {
    res.json(await getPmVsPmsMonthly())
  })
)

router.get(
  "/api/forecast/pms-prediction",
  asyncHandler(async (req, res) => {
    const targetMonth = req.query.targetMonth as string
    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      throw new AppError(400, "targetMonth 必填，格式 YYYY-MM")
    }
    const companyIdRaw = req.query.companyId as string | undefined
    const companyId =
      companyIdRaw === undefined || companyIdRaw === "null" ? null : parseInt(companyIdRaw, 10)
    res.json(await predictWithCalibration(targetMonth, companyId))
  })
)

router.post(
  "/api/forecast/backfill",
  asyncHandler(async (_req, res) => {
    const result = await backfillFromPMHistory()
    if (!result.ok) throw new AppError(500, result.error ?? "backfill 失敗")
    res.json(result)
  })
)

// ─────────────────────────────────────────────
// 內部 UI 用：使用者直接在 Money 內輸入預訂快照
// ─────────────────────────────────────────────
const QuickInputSchema = z.object({
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  companyId: z.number().int(),
  targetMonth: z.string().regex(/^\d{4}-\d{2}$/),
  bookedRevenue: z.union([z.number(), z.string()]).transform((v) => Number(v)),
})

router.post(
  "/api/forecast/quick-input",
  asyncHandler(async (req, res) => {
    try {
      const data = QuickInputSchema.parse(req.body)

      const targetMonthEnd = new Date(data.targetMonth + "-01")
      targetMonthEnd.setMonth(targetMonthEnd.getMonth() + 1)
      const daysAhead = Math.ceil(
        (targetMonthEnd.getTime() - new Date(data.snapshotDate).getTime()) / (1000 * 60 * 60 * 24)
      )

      try {
        await db.insert(revenueForecastSnapshots).values({
          snapshotDate: data.snapshotDate,
          companyId: data.companyId,
          targetMonth: data.targetMonth,
          accumulatedRevenue: "0",
          bookedRevenue: data.bookedRevenue.toString(),
          daysAheadOfTarget: daysAhead,
          source: "pms-booking",
          notes: "manual input",
        })
        return res.json({ status: "inserted" })
      } catch {
        const { sql } = await import("drizzle-orm")
        await db.execute(sql`
          UPDATE revenue_forecast_snapshots
          SET booked_revenue = ${data.bookedRevenue.toString()},
              notes = 'manual input',
              days_ahead_of_target = ${daysAhead}
          WHERE snapshot_date = ${data.snapshotDate}
            AND company_id = ${data.companyId}
            AND target_month = ${data.targetMonth}
            AND source = 'pms-booking'
        `)
        return res.json({ status: "updated" })
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new AppError(400, "格式錯誤：" + err.errors.map((e) => e.message).join(", "))
      }
      throw err
    }
  })
)

// ─────────────────────────────────────────────
// PMS 對接：外部系統推送預訂快照（無 session 認證，走 Bearer token）
// ─────────────────────────────────────────────

const PmsForecastPayloadSchema = z.object({
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "格式 YYYY-MM-DD"),
  companyId: z.number().int().nullable().optional(),
  targetMonth: z.string().regex(/^\d{4}-\d{2}$/, "格式 YYYY-MM"),
  bookedRevenue: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  accumulatedRevenue: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v ? Number(v) : 0)),
  notes: z.string().max(500).optional(),
})

/**
 * POST /api/forecast/webhook/:sourceKey
 *
 * 給 PMS / OTA / 其他預訂系統推送「未來預訂快照」。
 *
 * 認證：走 income_sources 既有 sourceKey + Bearer token 機制（source_type = 'pms_forecast'）
 * 行為：把 payload 寫進 revenue_forecast_snapshots，source = 'pms-booking'
 *
 * Payload 範例：
 *   {
 *     "snapshotDate": "2026-05-18",
 *     "companyId": 1,
 *     "targetMonth": "2026-06",
 *     "bookedRevenue": 250000,
 *     "accumulatedRevenue": 0
 *   }
 */
router.post(
  "/api/forecast/webhook/:sourceKey",
  asyncHandler(async (req, res) => {
    const { sourceKey } = req.params

    // 1. 找 source
    const source = await getIncomeSourceByKey(sourceKey)
    if (!source) {
      // 不洩漏 source 存在性、204 回應
      return res.status(200).json({ received: true, note: "source not configured" })
    }

    // 2. token 驗證
    if (!source.apiToken) {
      throw new AppError(401, "Token 驗證未設定")
    }
    const tokenHeader = String(req.headers["authorization"] ?? "")
    if (!tokenHeader) {
      throw new AppError(401, "缺少 Authorization header")
    }
    const token = tokenHeader.replace(/^Bearer\s+/i, "")
    if (!verifyBearerToken(token, source.apiToken)) {
      throw new AppError(401, "Token 驗證失敗")
    }

    // 3. 解析 payload
    try {
      const data = PmsForecastPayloadSchema.parse(req.body)

      const targetMonthEnd = new Date(data.targetMonth + "-01")
      targetMonthEnd.setMonth(targetMonthEnd.getMonth() + 1)
      const daysAhead = Math.ceil(
        (targetMonthEnd.getTime() - new Date(data.snapshotDate).getTime()) / (1000 * 60 * 60 * 24)
      )

      // 4. INSERT 或 UPDATE（先 try insert，違反 unique 就 update）
      let status: "inserted" | "updated" = "inserted"
      try {
        await db.insert(revenueForecastSnapshots).values({
          snapshotDate: data.snapshotDate,
          companyId: data.companyId ?? null,
          targetMonth: data.targetMonth,
          accumulatedRevenue: (data.accumulatedRevenue ?? 0).toString(),
          bookedRevenue: data.bookedRevenue.toString(),
          daysAheadOfTarget: daysAhead,
          source: "pms-booking",
          notes: data.notes ?? `via ${sourceKey}`,
        })
      } catch {
        const { sql } = await import("drizzle-orm")
        await db.execute(sql`
          UPDATE revenue_forecast_snapshots
          SET booked_revenue = ${data.bookedRevenue.toString()},
              accumulated_revenue = ${(data.accumulatedRevenue ?? 0).toString()},
              notes = ${data.notes ?? `via ${sourceKey}`},
              days_ahead_of_target = ${daysAhead}
          WHERE snapshot_date = ${data.snapshotDate}
            AND company_id IS NOT DISTINCT FROM ${data.companyId ?? null}
            AND target_month = ${data.targetMonth}
            AND source = 'pms-booking'
        `)
        status = "updated"
      }
      return res.status(200).json({ received: true, status })
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new AppError(400, "資料格式錯誤：" + err.errors.map((e) => e.message).join(", "))
      }
      throw err
    }
  })
)

export default router
