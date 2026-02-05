import { Router } from "express"
import { storage } from "../storage"
import { requireAuth } from "../auth"

const router = Router()

// 取得使用者通知列表
router.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id
    const limit = parseInt(req.query.limit as string) || 50
    const notifications = await storage.getUserNotifications(userId, limit)
    res.json(notifications)
  } catch (error) {
    res.status(500).json({ message: "獲取通知失敗" })
  }
})

// 檢查新通知
router.get("/api/notifications/check", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id
    const lastCheck = req.query.lastCheck as string
    const newNotifications = await storage.getNewNotifications(userId, lastCheck)
    res.json(newNotifications)
  } catch (error) {
    res.status(500).json({ message: "檢查新通知失敗" })
  }
})

// 標記單一通知為已讀
router.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id
    const notificationId = req.params.id
    await storage.markNotificationAsRead(userId, notificationId)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ message: "標記通知為已讀失敗" })
  }
})

// 標記所有通知為已讀
router.post("/api/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id
    await storage.markAllNotificationsAsRead(userId)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ message: "標記所有通知為已讀失敗" })
  }
})

// 手動生成通知提醒
router.post("/api/notifications/generate-reminders", requireAuth, async (req, res) => {
  try {
    const count = await storage.generatePaymentReminders()
    res.json({ success: true, generatedCount: count })
  } catch (error) {
    res.status(500).json({ message: "生成提醒通知失敗" })
  }
})

// 創建自定義通知
router.post("/api/notifications", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id
    const notification = await storage.createNotification({
      userId,
      ...req.body,
    })
    res.json(notification)
  } catch (error) {
    res.status(500).json({ message: "創建通知失敗" })
  }
})

// 刪除通知
router.delete("/api/notifications/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id
    const notificationId = req.params.id
    await storage.deleteNotification(userId, notificationId)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ message: "刪除通知失敗" })
  }
})

// 取得通知設定
router.get("/api/notification-settings", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id
    const settings = await storage.getNotificationSettings(userId)
    res.json(settings)
  } catch (error) {
    res.status(500).json({ message: "獲取通知設定失敗" })
  }
})

// 更新通知設定（PUT）
router.put("/api/notification-settings", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id
    const settings = await storage.updateNotificationSettings(userId, req.body)
    res.json(settings)
  } catch (error) {
    res.status(500).json({ message: "更新通知設定失敗" })
  }
})

// 更新通知設定（POST）
router.post("/api/notification-settings", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id
    const settings = req.body
    await storage.updateNotificationSettings(userId, settings)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ message: "更新通知設定失敗" })
  }
})

export default router
