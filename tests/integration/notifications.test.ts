/**
 * Notifications API 整合測試
 * 測試通知列表、已讀標記、通知設定
 */
import { describe, it, expect, beforeAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())

  app.use((req, _res, next) => {
    const reqWithAuth = req as typeof req & {
      user: { id: number; username: string; isActive: boolean }
      isAuthenticated: () => boolean
      session: Record<string, unknown>
    }
    reqWithAuth.user = { id: 1, username: "admin", isActive: true }
    reqWithAuth.isAuthenticated = () => true
    reqWithAuth.session = { userId: 1, isAuthenticated: true }
    next()
  })

  const notificationRoutes = (await import("../../server/routes/notifications")).default
  app.use(notificationRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Notifications API", () => {
  let app: Express

  beforeAll(async () => {
    app = await createTestApp()
  })

  // ── GET /api/notifications ─────────────────────────────────────

  describe("GET /api/notifications - 通知列表", () => {
    it("應回傳通知陣列", async () => {
      const res = await request(app)
        .get("/api/notifications")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援 limit 參數", async () => {
      const res = await request(app)
        .get("/api/notifications?limit=5")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/notifications/check ───────────────────────────────

  describe("GET /api/notifications/check - 檢查新通知", () => {
    it("應回傳新通知資料", async () => {
      const res = await request(app)
        .get("/api/notifications/check")
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("應支援 lastCheck 參數", async () => {
      const res = await request(app)
        .get("/api/notifications/check?lastCheck=2026-01-01T00:00:00Z")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── POST /api/notifications/read-all ───────────────────────────

  describe("POST /api/notifications/read-all - 全部已讀", () => {
    it("應成功標記所有通知為已讀", async () => {
      const res = await request(app)
        .post("/api/notifications/read-all")
        .expect(200)

      expect(res.body).toHaveProperty("success", true)
    })
  })

  // ── POST /api/notifications/generate-reminders ─────────────────

  describe("POST /api/notifications/generate-reminders - 生成提醒", () => {
    it("應成功生成付款提醒", async () => {
      const res = await request(app)
        .post("/api/notifications/generate-reminders")
        .expect(200)

      expect(res.body).toHaveProperty("success", true)
      expect(res.body).toHaveProperty("generatedCount")
    })
  })

  // ── GET /api/notification-settings ─────────────────────────────

  describe("GET /api/notification-settings - 通知設定", () => {
    it("應回傳通知設定", async () => {
      const res = await request(app)
        .get("/api/notification-settings")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── PUT /api/notification-settings ─────────────────────────────

  describe("PUT /api/notification-settings - 更新通知設定", () => {
    it("應成功更新設定", async () => {
      const res = await request(app)
        .put("/api/notification-settings")
        .send({ enablePaymentReminders: true })
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })
})
