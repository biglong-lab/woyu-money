import type { Express } from "express"
import { notificationSystem } from "./notification-system"
import { requireAuth } from "./auth"

export function setupNotificationRoutes(app: Express) {
  // 獲取用戶通知
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50
      const notifications = await notificationSystem.getUserNotifications(req.user!.id, limit)
      res.json(notifications)
    } catch (error) {
      console.error("獲取通知失敗:", error)
      res.status(500).json({ message: "獲取通知失敗" })
    }
  })

  // 標記通知為已讀
  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id)
      const success = await notificationSystem.markAsRead(notificationId)
      res.json({ success })
    } catch (error) {
      console.error("標記通知已讀失敗:", error)
      res.status(500).json({ message: "標記通知已讀失敗" })
    }
  })

  // 標記所有通知為已讀
  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const success = await notificationSystem.markAllAsRead(req.user!.id)
      res.json({ success })
    } catch (error) {
      console.error("標記所有通知已讀失敗:", error)
      res.status(500).json({ message: "標記所有通知已讀失敗" })
    }
  })

  // 獲取未讀通知數量
  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const count = await notificationSystem.getUnreadCount(req.user!.id)
      res.json({ count })
    } catch (error) {
      console.error("獲取未讀數量失敗:", error)
      res.status(500).json({ message: "獲取未讀數量失敗" })
    }
  })

  // 獲取通知設定
  app.get("/api/notification-settings", requireAuth, async (req, res) => {
    try {
      const settings = await notificationSystem.getNotificationSettings(req.user!.id)
      res.json(settings)
    } catch (error) {
      console.error("獲取通知設定失敗:", error)
      res.status(500).json({ message: "獲取通知設定失敗" })
    }
  })

  // 更新通知設定
  app.put("/api/notification-settings", requireAuth, async (req, res) => {
    try {
      const success = await notificationSystem.updateNotificationSettings(req.user!.id, req.body)
      res.json({ success })
    } catch (error) {
      console.error("更新通知設定失敗:", error)
      res.status(500).json({ message: "更新通知設定失敗" })
    }
  })

  // 手動生成付款提醒
  app.post("/api/notifications/generate-reminders", requireAuth, async (req, res) => {
    try {
      const count = await notificationSystem.generatePaymentReminders()
      res.json({ success: true, generated: count })
    } catch (error) {
      console.error("生成提醒通知失敗:", error)
      res.status(500).json({ message: "生成提醒通知失敗" })
    }
  })

  // 創建測試通知
  app.post("/api/notifications/test", requireAuth, async (req, res) => {
    try {
      const testNotification = await notificationSystem.createNotification({
        userId: req.user!.id,
        type: "test",
        title: "測試通知",
        message: "這是一個測試通知，用於驗證通知系統功能正常運作",
        priority: "medium",
        metadata: { createdBy: "manual_test", timestamp: new Date().toISOString() },
      })

      res.json({ success: true, notification: testNotification })
    } catch (error) {
      console.error("創建測試通知失敗:", error)
      res.status(500).json({ message: "創建測試通知失敗" })
    }
  })
}
