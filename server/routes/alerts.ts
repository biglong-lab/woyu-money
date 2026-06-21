/**
 * 今日財務提醒彙總 — GET /api/alerts/today
 * 聚合邏輯在 services/alerts.service.ts（route + scheduler 共用）
 */
import { Router } from "express"
import { asyncHandler } from "../middleware/error-handler"
import { getTodayAlerts } from "../services/alerts.service"

const router = Router()

router.get(
  "/api/alerts/today",
  asyncHandler(async (_req, res) => {
    const alerts = await getTodayAlerts()
    res.json({ alerts, count: alerts.length, generatedAt: new Date().toISOString() })
  })
)

export default router
