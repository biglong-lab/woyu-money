/**
 * Web Push API
 *
 * - GET /api/push/public-key        — 取得 VAPID public key 給前端訂閱用
 * - POST /api/push/subscribe        — 訂閱推播（前端在使用者授權後呼叫）
 * - POST /api/push/unsubscribe      — 取消訂閱
 * - POST /api/push/test             — 發測試推播給當前 user（驗證用）
 */
import { Router } from "express"
import { requireAuth } from "../auth"
import { asyncHandler, AppError } from "../middleware/error-handler"
import {
  subscribePush,
  unsubscribePush,
  sendPushToUser,
  isPushConfigured,
  getVapidPublicKey,
} from "../storage/push-subscriptions"
import { z } from "zod"

const router = Router()

router.get(
  "/api/push/public-key",
  asyncHandler(async (_req, res) => {
    if (!isPushConfigured()) {
      return res.status(503).json({
        error: "Push 未設定",
        hint: "後端缺 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 環境變數",
      })
    }
    res.json({ publicKey: getVapidPublicKey() })
  })
)

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

router.post(
  "/api/push/subscribe",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req.user as { id?: number } | undefined)?.id
    if (!userId) throw new AppError(401, "未登入")

    if (!isPushConfigured()) {
      return res.status(503).json({ error: "Push 服務暫未啟用" })
    }

    const parsed = subscribeSchema.parse(req.body)
    const sub = await subscribePush({
      userId,
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      userAgent: (req.headers["user-agent"] as string) || null,
    })
    res.status(201).json({ subscribed: true, id: sub.id })
  })
)

router.post(
  "/api/push/unsubscribe",
  requireAuth,
  asyncHandler(async (req, res) => {
    const endpoint = req.body?.endpoint
    if (!endpoint || typeof endpoint !== "string") {
      throw new AppError(400, "請提供 endpoint")
    }
    await unsubscribePush(endpoint)
    res.json({ unsubscribed: true })
  })
)

router.post(
  "/api/push/test",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req.user as { id?: number } | undefined)?.id
    if (!userId) throw new AppError(401, "未登入")

    const result = await sendPushToUser(userId, {
      title: "🔔 浯島財務 — 測試通知",
      body: "如果你看到這則通知，表示推播設定成功！",
      url: "/",
      tag: "test-notification",
    })
    res.json(result)
  })
)

export default router
