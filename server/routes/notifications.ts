import { Router } from "express"

import { requireAuth } from "../auth"
import { asyncHandler } from "../middleware/error-handler"
import {
  createNotification,
  deleteNotification,
  generatePaymentReminders,
  getNewNotifications,
  getNotificationSettings,
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  updateNotificationSettings,
} from "../storage/notifications"

const router = Router()

// 取得使用者通知列表
router.get(
  "/api/notifications",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const limit = parseInt(req.query.limit as string) || 50
    const notifications = await getUserNotifications(userId, limit)
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
    const newNotifications = await getNewNotifications(userId, lastCheck)
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
    await markNotificationAsRead(userId, notificationId)
    res.json({ success: true })
  })
)

// 標記所有通知為已讀
router.post(
  "/api/notifications/read-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    await markAllNotificationsAsRead(userId)
    res.json({ success: true })
  })
)

// 手動生成通知提醒
router.post(
  "/api/notifications/generate-reminders",
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await generatePaymentReminders()
    res.json({ success: true, generatedCount: count })
  })
)

// 創建自定義通知
router.post(
  "/api/notifications",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    // userId 放在 spread 之後：以登入者為準，body 帶 userId 也不能替別人建通知
    const notification = await createNotification({
      ...req.body,
      userId,
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
    await deleteNotification(userId, notificationId)
    res.json({ success: true })
  })
)

// 取得通知設定
router.get(
  "/api/notification-settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const settings = await getNotificationSettings(userId)
    res.json(settings)
  })
)

// 更新通知設定（PUT）
router.put(
  "/api/notification-settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const settings = await updateNotificationSettings(userId, req.body)
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
    await updateNotificationSettings(userId, settings)
    res.json({ success: true })
  })
)

export default router
