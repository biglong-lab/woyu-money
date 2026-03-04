/**
 * server/notification-system.ts 單元測試
 * 測試 NotificationSystem 的純邏輯部分與 mock DB 的行為
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// mock db 模組
const mockExecute = vi.fn()
vi.mock("../../server/db", () => ({
  db: {
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}))

// mock drizzle-orm sql 標記模板
vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
    _tag: "sql",
  }),
}))

import {
  NotificationSystem,
  type NotificationData,
  type Notification,
  type NotificationSettingsData,
} from "../../server/notification-system"

describe("NotificationSystem - 單元測試", () => {
  let system: NotificationSystem

  beforeEach(() => {
    vi.clearAllMocks()
    system = new NotificationSystem()
  })

  // ========== getDefaultSettings ==========
  describe("getDefaultSettings（透過 getNotificationSettings 觸發）", () => {
    it("DB 查無設定時應回傳預設值", async () => {
      // 第一次呼叫：查詢設定 → 空結果
      // 第二次呼叫：插入預設設定
      mockExecute
        .mockResolvedValueOnce({ rows: [] }) // SELECT 查無資料
        .mockResolvedValueOnce({ rows: [] }) // INSERT 預設設定

      const settings = await system.getNotificationSettings(1)

      expect(settings.emailEnabled).toBe(true)
      expect(settings.lineEnabled).toBe(false)
      expect(settings.browserEnabled).toBe(true)
      expect(settings.paymentDueReminder).toBe(true)
      expect(settings.paymentOverdueAlert).toBe(true)
      expect(settings.systemUpdates).toBe(false)
      expect(settings.weeklyReport).toBe(true)
      expect(settings.dailyDigestTime).toBe("09:00")
      expect(settings.weeklyReportDay).toBe("monday")
      expect(settings.advanceWarningDays).toBe(3)
    })

    it("DB 錯誤時應回傳預設設定", async () => {
      mockExecute.mockRejectedValueOnce(new Error("DB connection failed"))

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const settings = await system.getNotificationSettings(999)

      expect(settings.emailEnabled).toBe(true)
      expect(settings.dailyDigestTime).toBe("09:00")

      consoleSpy.mockRestore()
    })
  })

  // ========== createNotification ==========
  describe("createNotification", () => {
    it("應正確呼叫 DB 並回傳映射後的通知物件", async () => {
      const mockRow = {
        id: 1,
        user_id: 1,
        type: "payment_reminder",
        title: "付款提醒",
        message: "測試訊息",
        priority: "medium",
        is_read: false,
        action_url: null,
        metadata: "{}",
        created_at: "2026-03-01T00:00:00Z",
        read_at: null,
        expires_at: null,
      }

      mockExecute.mockResolvedValueOnce({ rows: [mockRow] })

      const data: NotificationData = {
        userId: 1,
        type: "payment_reminder",
        title: "付款提醒",
        message: "測試訊息",
      }

      const result = await system.createNotification(data)

      expect(result.id).toBe(1)
      expect(result.userId).toBe(1)
      expect(result.type).toBe("payment_reminder")
      expect(result.title).toBe("付款提醒")
      expect(result.message).toBe("測試訊息")
      expect(result.priority).toBe("medium")
      expect(result.isRead).toBe(false)
      expect(result.metadata).toEqual({})
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.readAt).toBeUndefined()
      expect(result.expiresAt).toBeUndefined()
    })

    it("metadata 為物件時應直接使用（不需 JSON.parse）", async () => {
      const mockRow = {
        id: 2,
        user_id: 1,
        type: "system",
        title: "系統通知",
        message: "msg",
        priority: "high",
        is_read: false,
        action_url: "/dashboard",
        metadata: { key: "value" }, // 已經是物件
        created_at: "2026-03-01T00:00:00Z",
        read_at: null,
        expires_at: "2026-04-01T00:00:00Z",
      }

      mockExecute.mockResolvedValueOnce({ rows: [mockRow] })

      const result = await system.createNotification({
        userId: 1,
        type: "system",
        title: "系統通知",
        message: "msg",
        priority: "high",
        actionUrl: "/dashboard",
        metadata: { key: "value" },
      })

      expect(result.metadata).toEqual({ key: "value" })
      expect(result.actionUrl).toBe("/dashboard")
      expect(result.expiresAt).toBeInstanceOf(Date)
    })

    it("DB 錯誤應拋出異常", async () => {
      mockExecute.mockRejectedValueOnce(new Error("Insert failed"))

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      await expect(
        system.createNotification({
          userId: 1,
          type: "test",
          title: "t",
          message: "m",
        })
      ).rejects.toThrow("Insert failed")

      consoleSpy.mockRestore()
    })
  })

  // ========== getUserNotifications ==========
  describe("getUserNotifications", () => {
    it("應回傳映射後的通知陣列", async () => {
      const mockRows = [
        {
          id: 1,
          user_id: 1,
          type: "info",
          title: "通知1",
          message: "訊息1",
          priority: "low",
          is_read: false,
          action_url: null,
          metadata: "{}",
          created_at: "2026-03-01T00:00:00Z",
          read_at: null,
          expires_at: null,
        },
        {
          id: 2,
          user_id: 1,
          type: "info",
          title: "通知2",
          message: "訊息2",
          priority: "medium",
          is_read: true,
          action_url: "/page",
          metadata: '{"key":"val"}',
          created_at: "2026-03-02T00:00:00Z",
          read_at: "2026-03-02T01:00:00Z",
          expires_at: null,
        },
      ]

      mockExecute.mockResolvedValueOnce({ rows: mockRows })

      const result = await system.getUserNotifications(1)

      expect(result).toHaveLength(2)
      expect(result[0].title).toBe("通知1")
      expect(result[0].isRead).toBe(false)
      expect(result[1].isRead).toBe(true)
      expect(result[1].readAt).toBeInstanceOf(Date)
      expect(result[1].metadata).toEqual({ key: "val" })
    })

    it("DB 錯誤應回傳空陣列", async () => {
      mockExecute.mockRejectedValueOnce(new Error("Query failed"))

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const result = await system.getUserNotifications(1)
      expect(result).toEqual([])

      consoleSpy.mockRestore()
    })

    it("無通知時應回傳空陣列", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] })

      const result = await system.getUserNotifications(999)
      expect(result).toEqual([])
    })
  })

  // ========== markAsRead ==========
  describe("markAsRead", () => {
    it("成功時應回傳 true", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] })

      const result = await system.markAsRead(1)
      expect(result).toBe(true)
    })

    it("DB 錯誤應回傳 false", async () => {
      mockExecute.mockRejectedValueOnce(new Error("Update failed"))

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const result = await system.markAsRead(1)
      expect(result).toBe(false)

      consoleSpy.mockRestore()
    })
  })

  // ========== markAllAsRead ==========
  describe("markAllAsRead", () => {
    it("成功時應回傳 true", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] })

      const result = await system.markAllAsRead(1)
      expect(result).toBe(true)
    })

    it("DB 錯誤應回傳 false", async () => {
      mockExecute.mockRejectedValueOnce(new Error("Update failed"))

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const result = await system.markAllAsRead(1)
      expect(result).toBe(false)

      consoleSpy.mockRestore()
    })
  })

  // ========== getUnreadCount ==========
  describe("getUnreadCount", () => {
    it("應回傳未讀數量", async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ count: 5 }],
      })

      const result = await system.getUnreadCount(1)
      expect(result).toBe(5)
    })

    it("無未讀時應回傳 0", async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ count: 0 }],
      })

      const result = await system.getUnreadCount(1)
      expect(result).toBe(0)
    })

    it("DB 錯誤應回傳 0", async () => {
      mockExecute.mockRejectedValueOnce(new Error("Query failed"))

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const result = await system.getUnreadCount(1)
      expect(result).toBe(0)

      consoleSpy.mockRestore()
    })

    it("查詢結果為空時應回傳 0", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] })

      const result = await system.getUnreadCount(1)
      expect(result).toBe(0)
    })
  })

  // ========== getNotificationSettings ==========
  describe("getNotificationSettings", () => {
    it("已有設定應回傳映射後的資料", async () => {
      const mockRow = {
        email_enabled: false,
        line_enabled: true,
        browser_enabled: false,
        payment_due_reminder: false,
        payment_overdue_alert: true,
        system_updates: true,
        weekly_report: false,
        daily_digest_time: "18:00",
        weekly_report_day: "friday",
        advance_warning_days: 7,
      }

      mockExecute.mockResolvedValueOnce({ rows: [mockRow] })

      const settings = await system.getNotificationSettings(1)

      expect(settings.emailEnabled).toBe(false)
      expect(settings.lineEnabled).toBe(true)
      expect(settings.browserEnabled).toBe(false)
      expect(settings.paymentDueReminder).toBe(false)
      expect(settings.paymentOverdueAlert).toBe(true)
      expect(settings.systemUpdates).toBe(true)
      expect(settings.weeklyReport).toBe(false)
      expect(settings.dailyDigestTime).toBe("18:00")
      expect(settings.weeklyReportDay).toBe("friday")
      expect(settings.advanceWarningDays).toBe(7)
    })
  })

  // ========== updateNotificationSettings ==========
  describe("updateNotificationSettings", () => {
    it("成功時應回傳 true", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] })

      const settings: NotificationSettingsData = {
        emailEnabled: true,
        lineEnabled: false,
        browserEnabled: true,
        paymentDueReminder: true,
        paymentOverdueAlert: true,
        systemUpdates: false,
        weeklyReport: true,
        dailyDigestTime: "09:00",
        weeklyReportDay: "monday",
        advanceWarningDays: 3,
      }

      const result = await system.updateNotificationSettings(1, settings)
      expect(result).toBe(true)
    })

    it("DB 錯誤應回傳 false", async () => {
      mockExecute.mockRejectedValueOnce(new Error("Update failed"))

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const settings: NotificationSettingsData = {
        emailEnabled: true,
        lineEnabled: false,
        browserEnabled: true,
        paymentDueReminder: true,
        paymentOverdueAlert: true,
        systemUpdates: false,
        weeklyReport: true,
        dailyDigestTime: "09:00",
        weeklyReportDay: "monday",
        advanceWarningDays: 3,
      }

      const result = await system.updateNotificationSettings(1, settings)
      expect(result).toBe(false)

      consoleSpy.mockRestore()
    })
  })
})
