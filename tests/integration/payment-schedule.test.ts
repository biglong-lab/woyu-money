/**
 * Payment Schedule API 整合測試
 * 測試排程 CRUD、逾期、統計、智慧排程
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
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

  const scheduleRoutes = (await import("../../server/routes/payment-schedule")).default
  const paymentItemRoutes = (await import("../../server/routes/payment-items")).default
  app.use(scheduleRoutes)
  app.use(paymentItemRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Payment Schedule API", () => {
  let app: Express
  const createdScheduleIds: number[] = []
  const createdItemIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const id of createdScheduleIds) {
      try {
        await request(app).delete(`/api/payment/schedule/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
    for (const id of createdItemIds) {
      try {
        await request(app).delete(`/api/payment/items/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── GET /api/payment/schedule/:year/:month ─────────────────────

  describe("GET /api/payment/schedule/:year/:month - 月度排程", () => {
    it("應回傳排程陣列", async () => {
      const res = await request(app)
        .get("/api/payment/schedule/2026/2")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── POST /api/payment/schedule ─────────────────────────────────

  describe("POST /api/payment/schedule - 建立排程", () => {
    let testItemId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const itemRes = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `排程測試項目_${timestamp}`,
          totalAmount: "100000",
          startDate: "2026-01-01",
        })
        .expect(201)
      testItemId = itemRes.body.id
      createdItemIds.push(testItemId)
    })

    it("應成功建立排程並回傳 201", async () => {
      const schedule = {
        paymentItemId: testItemId,
        scheduledDate: "2026-03-15",
        scheduledAmount: "50000",
        notes: "整合測試排程",
      }

      const res = await request(app)
        .post("/api/payment/schedule")
        .send(schedule)
        .expect(201)

      expect(res.body).toHaveProperty("id")
      createdScheduleIds.push(res.body.id)
    })

    it("缺少必填欄位應回傳 400", async () => {
      await request(app)
        .post("/api/payment/schedule")
        .send({ paymentItemId: testItemId })
        .expect(400)
    })
  })

  // ── PUT /api/payment/schedule/:id ──────────────────────────────

  describe("PUT /api/payment/schedule/:id - 更新排程", () => {
    it("應成功更新排程", async () => {
      const scheduleId = createdScheduleIds[0]
      if (!scheduleId) return

      const res = await request(app)
        .put(`/api/payment/schedule/${scheduleId}`)
        .send({ scheduledAmount: "55000" })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  // ── GET /api/payment/overdue ───────────────────────────────────

  describe("GET /api/payment/overdue - 逾期排程", () => {
    it("應回傳逾期排程陣列", async () => {
      const res = await request(app)
        .get("/api/payment/overdue")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/payment/schedule/stats/:year/:month ───────────────

  describe("GET /api/payment/schedule/stats/:year/:month - 排程統計", () => {
    it("應回傳排程統計", async () => {
      const res = await request(app)
        .get("/api/payment/schedule/stats/2026/3")
        .expect(200)

      expect(res.body).toHaveProperty("year", 2026)
      expect(res.body).toHaveProperty("month", 3)
      expect(res.body).toHaveProperty("totalAmount")
      expect(res.body).toHaveProperty("totalCount")
      expect(res.body).toHaveProperty("overdueCount")
      expect(res.body).toHaveProperty("dailyStats")
    })
  })

  // ── GET /api/payment/items/overdue ─────────────────────────────

  describe("GET /api/payment/items/overdue - 逾期付款項目", () => {
    it("應回傳逾期項目陣列", async () => {
      const res = await request(app)
        .get("/api/payment/items/overdue")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/payment/items/integrated ──────────────────────────

  describe("GET /api/payment/items/integrated - 整合項目資料", () => {
    it("應回傳整合項目陣列", async () => {
      const res = await request(app)
        .get("/api/payment/items/integrated")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援年月參數", async () => {
      const res = await request(app)
        .get("/api/payment/items/integrated?year=2026&month=3")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty("actualPaid")
        expect(res.body[0]).toHaveProperty("scheduledTotal")
        expect(res.body[0]).toHaveProperty("pendingAmount")
      }
    })
  })

  // ── POST /api/payment/schedule/smart-suggest ───────────────────

  describe("POST /api/payment/schedule/smart-suggest - 智慧排程建議", () => {
    it("應回傳排程建議", async () => {
      const res = await request(app)
        .post("/api/payment/schedule/smart-suggest")
        .send({ year: 2026, month: 3, budget: 500000 })
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("缺少參數應回傳 400", async () => {
      await request(app)
        .post("/api/payment/schedule/smart-suggest")
        .send({ year: 2026 })
        .expect(400)
    })
  })

  // ── POST /api/payment/schedule/auto-reschedule ─────────────────

  describe("POST /api/payment/schedule/auto-reschedule - 批次重排", () => {
    it("應成功執行批次重排", async () => {
      const res = await request(app)
        .post("/api/payment/schedule/auto-reschedule")
        .send({ targetYear: 2026, targetMonth: 4 })
        .expect(200)

      expect(res.body).toHaveProperty("rescheduled")
    })

    it("缺少參數應回傳 400", async () => {
      await request(app)
        .post("/api/payment/schedule/auto-reschedule")
        .send({ targetYear: 2026 })
        .expect(400)
    })
  })

  // ── DELETE /api/payment/schedule/:id ────────────────────────────

  describe("DELETE /api/payment/schedule/:id - 刪除排程", () => {
    it("應成功刪除排程並回傳 204", async () => {
      const testItemId = createdItemIds[0]
      if (!testItemId) return

      const createRes = await request(app)
        .post("/api/payment/schedule")
        .send({
          paymentItemId: testItemId,
          scheduledDate: "2026-04-01",
          scheduledAmount: "20000",
        })
        .expect(201)

      await request(app)
        .delete(`/api/payment/schedule/${createRes.body.id}`)
        .expect(204)
    })
  })
})
