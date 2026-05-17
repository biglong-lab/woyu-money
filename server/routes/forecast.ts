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
} from "../storage/forecast-snapshots"

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

router.post(
  "/api/forecast/capture",
  asyncHandler(async (_req, res) => {
    const result = await captureFromPM()
    if (!result.ok) throw new AppError(500, result.error ?? "拍快照失敗")
    res.json(result)
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

export default router
