/**
 * 勞健保滯納金 API
 *
 * 使命：把「拖延成本」可視化，解決使用者 40% 損失專項。
 *
 * Endpoints:
 * - GET /api/late-fee/annual-loss?year=YYYY  年度損失報告
 * - GET /api/late-fee/reminder-status        今日提醒狀態（依日期判斷 early/warning/final）
 *
 * Service：server/services/late-fee.service.ts
 */

import { Router } from "express"
import { z } from "zod"
import { asyncHandler, errors } from "../middleware/error-handler"
import { getAnnualLossReport, getTodayReminderStatus } from "../services/late-fee.service"

const router = Router()

// ─────────────────────────────────────────────
// Query 驗證
// ─────────────────────────────────────────────

const yearSchema = z.preprocess(
  (val) => (val === undefined ? undefined : Number(val)),
  z.number().int().min(2000, "year 必須 >= 2000").max(2100, "year 必須 <= 2100").optional()
)

// ─────────────────────────────────────────────
// GET /api/late-fee/annual-loss
// ─────────────────────────────────────────────

router.get(
  "/api/late-fee/annual-loss",
  asyncHandler(async (req, res) => {
    const parsed = yearSchema.safeParse(req.query.year)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw errors.badRequest(`year 參數錯誤：${issue?.message ?? "格式無效"}`)
    }

    const year = parsed.data ?? new Date().getFullYear()
    const report = await getAnnualLossReport(year)
    res.json(report)
  })
)

// ─────────────────────────────────────────────
// GET /api/late-fee/reminder-status
// ─────────────────────────────────────────────

router.get(
  "/api/late-fee/reminder-status",
  asyncHandler(async (_req, res) => {
    const status = await getTodayReminderStatus()
    res.json(status)
  })
)

export default router
