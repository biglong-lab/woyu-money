/**
 * 現金分配引擎 API
 *
 * 核心使命：回答使用者「這週我 30 萬，該先付哪幾筆？」
 *
 * Endpoints:
 * - GET  /api/payment/priority-report      取得優先級報告（本週焦點）
 * - POST /api/payment/allocation-suggest   現金分配建議
 *
 * Service 層（payment-priority.service）負責：
 * - DB 查詢未付款項目
 * - 套用 5 維度優先級演算法
 * - 分配到 suggested / deferred 兩個清單
 * - 計算 shortage / surplus
 */

import { Router } from "express"
import { z } from "zod"
import { asyncHandler, errors } from "../middleware/error-handler"
import { getPriorityReport, suggestAllocation } from "../services/payment-priority.service"

const router = Router()

// ─────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────

const allocationRequestSchema = z.object({
  availableBudget: z.number().finite().nonnegative(),
  asOf: z.string().datetime().optional(),
})

// ─────────────────────────────────────────────
// GET /api/payment/priority-report
// ─────────────────────────────────────────────

router.get(
  "/api/payment/priority-report",
  asyncHandler(async (req, res) => {
    const includeLow = req.query.includeLow === "true"
    const report = await getPriorityReport({ includeLow })
    res.json(report)
  })
)

// ─────────────────────────────────────────────
// POST /api/payment/allocation-suggest
// ─────────────────────────────────────────────

router.post(
  "/api/payment/allocation-suggest",
  asyncHandler(async (req, res) => {
    const parsed = allocationRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      const field = firstIssue?.path.join(".") ?? "body"
      throw errors.badRequest(`請求格式錯誤：${field} - ${firstIssue?.message ?? "未知"}`)
    }

    const { availableBudget, asOf } = parsed.data
    const result = await suggestAllocation({
      availableBudget,
      asOf: asOf ? new Date(asOf) : undefined,
    })
    res.json(result)
  })
)

export default router
