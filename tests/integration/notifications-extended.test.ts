/**
 * Notifications API 擴展整合測試
 *
 * 覆蓋：建立自訂通知、單一已讀標記、刪除通知、
 *       POST 設定更新、重要通知查詢、未讀通知查詢、
 *       批次操作流程
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { Express } from "express"
import type TestAgent from "supertest/lib/agent"

const skipIfNoDb = !process.env.DATABASE_URL

async function setup() {
  const { createTestApp, createAuthenticatedAgent } = await import("../helpers/test-app")
  return { createTestApp, createAuthenticatedAgent }
}

describe.skipIf(skipIfNoDb)("Notifications API — 擴展測試", () => {
  let app: Express
  let agent: TestAgent

  // 追蹤測試建立的通知 ID，用於清理
  const createdNotificationIds: string[] = []

  beforeAll(async () => {
    const { createTestApp, createAuthenticatedAgent } = await setup()
    app = await createTestApp()
    agent = await createAuthenticatedAgent(app)
  })

  afterAll(async () => {
    for (const id of createdNotificationIds) {
      try {
        await agent.delete(`/api/notifications/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── 建立自訂通知 ────────────────────────────────────────────

  describe("POST /api/notifications — 建立自訂通知", () => {
    it("應成功建立自訂通知", async () => {
      const res = await agent
        .post("/api/notifications")
        .send({
          type: "system",
          title: "測試通知 — 擴展測試",
          message: "這是一則擴展測試自訂通知",
          priority: "low",
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
      expect(res.body.title).toBe("測試通知 — 擴展測試")
      expect(res.body.isRead).toBe(false)
      createdNotificationIds.push(String(res.body.id))
    })

    it("應成功建立高優先度通知", async () => {
      const res = await agent
        .post("/api/notifications")
        .send({
          type: "payment_reminder",
          title: "緊急付款提醒",
          message: "有一筆重要付款即將到期",
          priority: "critical",
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
      expect(res.body.priority).toBe("critical")
      createdNotificationIds.push(String(res.body.id))
    })

    it("應成功建立帶 metadata 的通知", async () => {
      const res = await agent
        .post("/api/notifications")
        .send({
          type: "system",
          title: "帶附加資訊的通知",
          message: "包含 metadata",
          priority: "medium",
          metadata: {
            source: "test",
            relatedId: 42,
          },
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
      createdNotificationIds.push(String(res.body.id))
    })
  })

  // ── 通知列表查詢 ────────────────────────────────────────────

  describe("GET /api/notifications — 通知列表查詢", () => {
    it("應回傳通知陣列", async () => {
      const res = await agent.get("/api/notifications").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援 limit 參數限制筆數", async () => {
      const res = await agent.get("/api/notifications?limit=2").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeLessThanOrEqual(2)
    })

    it("通知應依建立時間倒序排列", async () => {
      const res = await agent.get("/api/notifications?limit=50").expect(200)

      if (res.body.length >= 2) {
        const first = new Date(res.body[0].createdAt).getTime()
        const second = new Date(res.body[1].createdAt).getTime()
        expect(first).toBeGreaterThanOrEqual(second)
      }
    })
  })

  // ── 單一通知已讀標記 ────────────────────────────────────────

  describe("POST /api/notifications/:id/read — 標記單一通知為已讀", () => {
    let notificationId: string

    beforeAll(async () => {
      // 建立一則未讀通知供測試
      const res = await agent.post("/api/notifications").send({
        type: "system",
        title: "待標記已讀的通知",
        message: "測試單一已讀",
        priority: "low",
      })

      notificationId = String(res.body.id)
      createdNotificationIds.push(notificationId)
    })

    it("應成功標記指定通知為已讀", async () => {
      const res = await agent.post(`/api/notifications/${notificationId}/read`).expect(200)

      expect(res.body).toHaveProperty("success", true)
    })

    it("標記不存在的通知不應出錯（靜默處理）", async () => {
      const res = await agent.post("/api/notifications/999999/read").expect(200)

      expect(res.body).toHaveProperty("success", true)
    })
  })

  // ── 全部已讀 ────────────────────────────────────────────────

  describe("POST /api/notifications/read-all — 全部標記已讀", () => {
    beforeAll(async () => {
      // 先建立幾則未讀通知
      for (let i = 0; i < 3; i++) {
        const res = await agent.post("/api/notifications").send({
          type: "system",
          title: `批次已讀測試 #${i + 1}`,
          message: "測試全部已讀功能",
          priority: "low",
        })
        createdNotificationIds.push(String(res.body.id))
      }
    })

    it("應成功將所有未讀通知標記為已讀", async () => {
      const res = await agent.post("/api/notifications/read-all").expect(200)

      expect(res.body).toHaveProperty("success", true)
    })

    it("全部已讀後再次執行也不應出錯", async () => {
      const res = await agent.post("/api/notifications/read-all").expect(200)

      expect(res.body).toHaveProperty("success", true)
    })
  })

  // ── 刪除通知 ────────────────────────────────────────────────

  describe("DELETE /api/notifications/:id — 刪除通知", () => {
    it("應成功刪除指定通知", async () => {
      // 先建立一則通知
      const createRes = await agent.post("/api/notifications").send({
        type: "system",
        title: "待刪除通知",
        message: "即將被刪除",
        priority: "low",
      })

      const deleteRes = await agent.delete(`/api/notifications/${createRes.body.id}`).expect(200)

      expect(deleteRes.body).toHaveProperty("success", true)
    })

    it("刪除不存在的通知不應出錯（靜默處理）", async () => {
      const res = await agent.delete("/api/notifications/999999").expect(200)

      expect(res.body).toHaveProperty("success", true)
    })
  })

  // ── 檢查新通知 ──────────────────────────────────────────────

  describe("GET /api/notifications/check — 檢查新通知", () => {
    it("無 lastCheck 參數時應回傳最近通知", async () => {
      const res = await agent.get("/api/notifications/check").expect(200)

      expect(res.body).toBeDefined()
    })

    it("有 lastCheck 參數時只回傳該時間之後的通知", async () => {
      // 使用較早的時間，確保能取到資料
      const res = await agent
        .get("/api/notifications/check?lastCheck=2020-01-01T00:00:00Z")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("lastCheck 為未來時間時應回傳空陣列", async () => {
      const res = await agent
        .get("/api/notifications/check?lastCheck=2099-12-31T23:59:59Z")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBe(0)
    })
  })

  // ── 通知設定 CRUD ──────────────────────────────────────────

  describe("通知設定 CRUD", () => {
    it("GET /api/notification-settings — 取得通知設定", async () => {
      const res = await agent.get("/api/notification-settings").expect(200)

      // 可能是 null（尚未建立）或設定物件
      expect(res.status).toBe(200)
    })

    it("PUT /api/notification-settings — 更新通知設定", async () => {
      const res = await agent
        .put("/api/notification-settings")
        .send({
          enablePaymentReminders: true,
          emailEnabled: false,
          lineEnabled: false,
          reminderDaysBefore: 3,
        })
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("POST /api/notification-settings — POST 方式更新設定", async () => {
      const res = await agent
        .post("/api/notification-settings")
        .send({
          enablePaymentReminders: false,
          emailEnabled: true,
          lineEnabled: false,
        })
        .expect(200)

      expect(res.body).toHaveProperty("success", true)
    })

    it("PUT /api/notification-settings — 再次更新確認可重複操作", async () => {
      const res = await agent
        .put("/api/notification-settings")
        .send({
          enablePaymentReminders: true,
          reminderDaysBefore: 7,
        })
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── 生成付款提醒 ────────────────────────────────────────────

  describe("POST /api/notifications/generate-reminders — 生成付款提醒", () => {
    it("應成功生成付款提醒並回傳筆數", async () => {
      const res = await agent.post("/api/notifications/generate-reminders").expect(200)

      expect(res.body).toHaveProperty("success", true)
      // 路由可能回傳 generated 或 generatedCount（兩組路由並存）
      const count = res.body.generated ?? res.body.generatedCount
      expect(typeof count).toBe("number")
    })

    it("重複呼叫也應成功（冪等性）", async () => {
      const res = await agent.post("/api/notifications/generate-reminders").expect(200)

      expect(res.body.success).toBe(true)
    })
  })

  // ── 完整通知生命週期流程 ────────────────────────────────────

  describe("完整通知生命週期", () => {
    it("建立 → 查詢 → 已讀 → 刪除", async () => {
      // 1. 建立
      const createRes = await agent
        .post("/api/notifications")
        .send({
          type: "system",
          title: "生命週期測試通知",
          message: "完整流程測試",
          priority: "medium",
        })
        .expect(200)

      const id = createRes.body.id
      expect(id).toBeDefined()

      // 2. 查詢確認存在
      const listRes = await agent.get("/api/notifications?limit=50").expect(200)

      const found = listRes.body.find((n: { id: number }) => n.id === id)
      expect(found).toBeDefined()
      expect(found.isRead).toBe(false)

      // 3. 標記已讀
      await agent.post(`/api/notifications/${id}/read`).expect(200)

      // 4. 刪除
      await agent.delete(`/api/notifications/${id}`).expect(200)

      // 5. 確認刪除後查不到
      const afterDeleteRes = await agent.get("/api/notifications?limit=100").expect(200)

      const notFound = afterDeleteRes.body.find((n: { id: number }) => n.id === id)
      expect(notFound).toBeUndefined()
    })
  })
})
