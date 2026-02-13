import { Router } from "express"
import { storage } from "../storage"
import { requireAuth } from "../auth"
import { asyncHandler } from "../middleware/error-handler"

const router = Router()

// 取得使用者通知列表
router.get(
  "/api/notifications",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const limit = parseInt(req.query.limit as string) || 50
    const notifications = await storage.getUserNotifications(userId, limit)
    res.json(notifications)
  })
)

// 檢查新通知
router.get(
  "/api/notifications/check",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const lastCheck = req.query.lastCheck as string
    const newNotifications = await storage.getNewNotifications(userId, lastCheck)
    res.json(newNotifications)
  })
)

// 標記單一通知為已讀
router.post(
  "/api/notifications/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const notificationId = req.params.id
    await storage.markNotificationAsRead(userId, notificationId)
    res.json({ success: true })
  })
)

// 標記所有通知為已讀
router.post(
  "/api/notifications/read-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    await storage.markAllNotificationsAsRead(userId)
    res.json({ success: true })
  })
)

// 手動生成通知提醒
router.post(
  "/api/notifications/generate-reminders",
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await storage.generatePaymentReminders()
    res.json({ success: true, generatedCount: count })
  })
)

// 創建自定義通知
router.post(
  "/api/notifications",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const notification = await storage.createNotification({
      userId,
      ...req.body,
    })
    res.json(notification)
  })
)

// 刪除通知
router.delete(
  "/api/notifications/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const notificationId = req.params.id
    await storage.deleteNotification(userId, notificationId)
    res.json({ success: true })
  })
)

// 取得通知設定
router.get(
  "/api/notification-settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const settings = await storage.getNotificationSettings(userId)
    res.json(settings)
  })
)

// 更新通知設定（PUT）
router.put(
  "/api/notification-settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const settings = await storage.updateNotificationSettings(userId, req.body)
    res.json(settings)
  })
)

// 更新通知設定（POST）
router.post(
  "/api/notification-settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const settings = req.body
    await storage.updateNotificationSettings(userId, settings)
    res.json({ success: true })
  })
)

export default router
