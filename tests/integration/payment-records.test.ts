/**
 * Payment Records API 整合測試
 * 測試付款記錄的 CRUD 操作與現金流查詢
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())

  // 模擬認證中間件
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

  const paymentRecordRoutes = (await import("../../server/routes/payment-records")).default
  const paymentItemRoutes = (await import("../../server/routes/payment-items")).default
  app.use(paymentRecordRoutes)
  app.use(paymentItemRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Payment Records API", () => {
  let app: Express
  const createdRecordIds: number[] = []
  const createdItemIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    // 先刪除記錄，再刪除項目（FK 依賴）
    for (const id of createdRecordIds) {
      try {
        await request(app).delete(`/api/payment-records/${id}`)
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

  // ── GET /api/payment/records ────────────────────────────────────

  describe("GET /api/payment/records - 記錄列表", () => {
    it("應回傳付款記錄陣列", async () => {
      const res = await request(app)
        .get("/api/payment/records")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援 itemId 篩選", async () => {
      const res = await request(app).get("/api/payment/records?itemId=1").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援日期範圍篩選", async () => {
      const res = await request(app)
        .get("/api/payment/records?startDate=2026-01-01&endDate=2026-12-31")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援分頁參數", async () => {
      const res = await request(app)
        .get("/api/payment/records?page=1&limit=10")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── POST /api/payment-records ───────────────────────────────────

  describe("POST /api/payment-records - 新增記錄", () => {
    let testItemId: number

    beforeAll(async () => {
      // 先建立一筆付款項目作為 FK 參照
      const timestamp = Date.now()
      const itemRes = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `記錄測試用項目_${timestamp}`,
          totalAmount: "50000",
          startDate: "2026-01-01",
        })
        .expect(201)
      testItemId = itemRes.body.id
      createdItemIds.push(testItemId)
    })

    it("應成功建立付款記錄並回傳 201", async () => {
      const newRecord = {
        itemId: testItemId,
        amountPaid: "5000",
        paymentDate: "2026-01-15",
        paymentMethod: "bank_transfer",
        notes: "整合測試付款",
      }

      const res = await request(app).post("/api/payment-records").send(newRecord).expect(201)

      expect(res.body).toHaveProperty("id")
      expect(res.body.amountPaid).toBeDefined()
      createdRecordIds.push(res.body.id)
    })

    it("缺少必填欄位應回傳 400", async () => {
      const invalidRecord = {
        // 缺少 itemId 和 amountPaid
        paymentDate: "2026-01-15",
      }

      const res = await request(app).post("/api/payment-records").send(invalidRecord)

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
    })
  })

  // ── PUT /api/payment-records/:id ────────────────────────────────

  describe("PUT /api/payment-records/:id - 更新記錄", () => {
    let testRecordId: number
    let testItemId: number

    beforeAll(async () => {
      // 建立項目
      const timestamp = Date.now()
      const itemRes = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `更新記錄測試項目_${timestamp}`,
          totalAmount: "30000",
          startDate: "2026-02-01",
        })
        .expect(201)
      testItemId = itemRes.body.id
      createdItemIds.push(testItemId)

      // 建立記錄
      const recordRes = await request(app)
        .post("/api/payment-records")
        .send({
          itemId: testItemId,
          amountPaid: "3000",
          paymentDate: "2026-02-10",
          paymentMethod: "cash",
        })
        .expect(201)
      testRecordId = recordRes.body.id
      createdRecordIds.push(testRecordId)
    })

    it("應成功更新付款記錄", async () => {
      const res = await request(app)
        .put(`/api/payment-records/${testRecordId}`)
        .send({
          itemId: testItemId,
          amountPaid: "3500",
          paymentDate: "2026-02-11",
          paymentMethod: "bank_transfer",
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  // ── DELETE /api/payment-records/:id ─────────────────────────────

  describe("DELETE /api/payment-records/:id - 刪除記錄", () => {
    let testRecordId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const itemRes = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `刪除記錄測試項目_${timestamp}`,
          totalAmount: "10000",
          startDate: "2026-03-01",
        })
        .expect(201)
      createdItemIds.push(itemRes.body.id)

      const recordRes = await request(app)
        .post("/api/payment-records")
        .send({
          itemId: itemRes.body.id,
          amountPaid: "1000",
          paymentDate: "2026-03-05",
        })
        .expect(201)
      testRecordId = recordRes.body.id
    })

    it("應成功刪除並回傳 204", async () => {
      await request(app).delete(`/api/payment-records/${testRecordId}`).expect(204)
    })
  })

  // ── GET /api/payment/records/cashflow ───────────────────────────

  describe("GET /api/payment/records/cashflow - 現金流", () => {
    it("應回傳現金流記錄陣列", async () => {
      const res = await request(app)
        .get("/api/payment/records/cashflow")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援 monthsBack 參數", async () => {
      const res = await request(app)
        .get("/api/payment/records/cashflow?monthsBack=3")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("每筆記錄應包含現金流專用欄位", async () => {
      const res = await request(app).get("/api/payment/records/cashflow").expect(200)

      if (res.body.length > 0) {
        const record = res.body[0]
        expect(record).toHaveProperty("paymentMonth")
        expect(record).toHaveProperty("dueMonth")
        expect(record).toHaveProperty("isCurrentMonthItem")
        expect(record).toHaveProperty("originLabel")
        expect(typeof record.isCurrentMonthItem).toBe("boolean")
      }
    })
  })

  // ── GET /api/payment-items/:itemId/notes ────────────────────────

  describe("GET /api/payment-items/:itemId/notes - 項目備註", () => {
    it("應回傳備註陣列", async () => {
      const itemId = createdItemIds[0]
      if (!itemId) return

      const res = await request(app).get(`/api/payment-items/${itemId}/notes`).expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })
})
