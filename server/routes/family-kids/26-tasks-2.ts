/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 26，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { bulkApproveOne } from "./helpers"

const router = Router()

router.post(
  "/api/family/tasks/bulk-approve",
  asyncHandler(async (req, res) => {
    const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : []
    const ids = rawIds.filter((x: unknown) => Number.isInteger(x) && (x as number) >= 1) as number[]
    if (ids.length === 0) throw new AppError(400, "需傳 ids: number[]（至少 1 個）")
    if (ids.length > 50) throw new AppError(400, "一次最多 50 個")
    const parentFeedback = req.body?.parentFeedback
      ? String(req.body.parentFeedback).slice(0, 500)
      : null

    const successes: Array<{
      taskId: number
      kidName: string
      reward: number
      spendAdd: number
      saveAdd: number
      giveAdd: number
    }> = []
    const failures: Array<{ id: number; error: string }> = []
    for (const id of ids) {
      try {
        const r = await bulkApproveOne(id, parentFeedback)
        successes.push(r)
      } catch (err) {
        failures.push({
          id,
          error: err instanceof AppError ? err.message : "處理失敗",
        })
      }
    }

    res.json({
      approved: successes.length,
      failed: failures.length,
      totalReward: successes.reduce((s, x) => s + x.reward, 0),
      successes,
      failures,
    })
  })
)

export default router
