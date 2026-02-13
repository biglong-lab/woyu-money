/**
 * Loans API 整合測試
 * 測試借貸投資記錄 CRUD、還款、統計、利息計算
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

  const loanRoutes = (await import("../../server/routes/loans")).default
  app.use(loanRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Loans API", () => {
  let app: Express
  const createdRecordIds: number[] = []
  const createdPaymentIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const id of createdPaymentIds) {
      try {
        await request(app).delete(`/api/loan-investment/payments/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
    for (const id of createdRecordIds) {
      try {
        await request(app).delete(`/api/loan-investment/records/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── GET /api/loan-investment/records ────────────────────────────

  describe("GET /api/loan-investment/records - 借貸記錄列表", () => {
    it("應回傳借貸記錄陣列", async () => {
      const res = await request(app)
        .get("/api/loan-investment/records")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── POST /api/loan-investment/records ───────────────────────────

  describe("POST /api/loan-investment/records - 新增借貸記錄", () => {
    it("應成功建立借貸記錄並回傳 201", async () => {
      const timestamp = Date.now()
      const newRecord = {
        itemName: `測試借貸_${timestamp}`,
        recordType: "lending",
        partyName: `測試對象_${timestamp}`,
        principalAmount: "100000",
        annualInterestRate: "5.0",
        startDate: "2026-01-01",
        status: "active",
      }

      const res = await request(app)
        .post("/api/loan-investment/records")
        .send(newRecord)
        .expect(201)

      expect(res.body).toHaveProperty("id")
      createdRecordIds.push(res.body.id)
    })

    it("缺少必填欄位應回傳 400", async () => {
      const res = await request(app)
        .post("/api/loan-investment/records")
        .send({ itemName: "不完整" })

      expect(res.status).toBe(400)
    })
  })

  // ── GET /api/loan-investment/records/:id ────────────────────────

  describe("GET /api/loan-investment/records/:id - 單筆記錄", () => {
    it("應回傳指定借貸記錄", async () => {
      const recordId = createdRecordIds[0]
      if (!recordId) return

      const res = await request(app)
        .get(`/api/loan-investment/records/${recordId}`)
        .expect(200)

      expect(res.body).toHaveProperty("id", recordId)
    })

    it("不存在的記錄應回傳 404", async () => {
      await request(app)
        .get("/api/loan-investment/records/999999")
        .expect(404)
    })
  })

  // ── PUT /api/loan-investment/records/:id ────────────────────────

  describe("PUT /api/loan-investment/records/:id - 更新記錄", () => {
    it("應成功更新借貸記錄", async () => {
      const recordId = createdRecordIds[0]
      if (!recordId) return

      const res = await request(app)
        .put(`/api/loan-investment/records/${recordId}`)
        .send({ interestRate: "6.0" })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  // ── POST /api/loan-investment/records/:id/payments ─────────────

  describe("POST /api/loan-investment/records/:id/payments - 新增還款", () => {
    it("應成功新增還款記錄並回傳 201", async () => {
      const recordId = createdRecordIds[0]
      if (!recordId) return

      const payment = {
        amount: "5000",
        paymentType: "interest",
        paymentMethod: "bank_transfer",
        paymentDate: "2026-02-01",
      }

      const res = await request(app)
        .post(`/api/loan-investment/records/${recordId}/payments`)
        .send(payment)
        .expect(201)

      expect(res.body).toHaveProperty("id")
      createdPaymentIds.push(res.body.id)
    })

    it("缺少必填欄位應回傳 400", async () => {
      const recordId = createdRecordIds[0]
      if (!recordId) return

      const res = await request(app)
        .post(`/api/loan-investment/records/${recordId}/payments`)
        .send({ amount: "5000" })

      expect(res.status).toBe(400)
    })
  })

  // ── GET /api/loan-investment/records/:id/payments ───────────────

  describe("GET /api/loan-investment/records/:id/payments - 還款歷史", () => {
    it("應回傳還款記錄陣列", async () => {
      const recordId = createdRecordIds[0]
      if (!recordId) return

      const res = await request(app)
        .get(`/api/loan-investment/records/${recordId}/payments`)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── PATCH /api/loan-investment/payments/:id/verify ─────────────

  describe("PATCH /api/loan-investment/payments/:id/verify - 驗證還款", () => {
    it("應成功驗證還款記錄", async () => {
      const paymentId = createdPaymentIds[0]
      if (!paymentId) return

      const res = await request(app)
        .patch(`/api/loan-investment/payments/${paymentId}/verify`)
        .send({ verifiedBy: "admin", notes: "已驗證" })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })

    it("缺少 verifiedBy 應回傳 400", async () => {
      const paymentId = createdPaymentIds[0]
      if (!paymentId) return

      await request(app)
        .patch(`/api/loan-investment/payments/${paymentId}/verify`)
        .send({ notes: "缺少驗證者" })
        .expect(400)
    })
  })

  // ── GET /api/loan-investment/records/:id/payment-stats ─────────

  describe("GET /api/loan-investment/records/:id/payment-stats - 還款統計", () => {
    it("應回傳統計資料", async () => {
      const recordId = createdRecordIds[0]
      if (!recordId) return

      const res = await request(app)
        .get(`/api/loan-investment/records/${recordId}/payment-stats`)
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── GET /api/loan-investment/stats ─────────────────────────────

  describe("GET /api/loan-investment/stats - 總體統計", () => {
    it("應回傳總體統計資料", async () => {
      const res = await request(app)
        .get("/api/loan-investment/stats")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── POST /api/loan-investment/calculate ────────────────────────

  describe("POST /api/loan-investment/calculate - 利息計算", () => {
    it("本息攤還應回傳正確計算結果", async () => {
      const res = await request(app)
        .post("/api/loan-investment/calculate")
        .send({
          principalAmount: "1000000",
          interestRate: "3.0",
          repaymentMode: "principal_and_interest",
          repaymentYears: 20,
          graceMonths: 0,
        })
        .expect(200)

      expect(res.body).toHaveProperty("principal", 1000000)
      expect(res.body).toHaveProperty("repaymentMode", "principal_and_interest")
      expect(res.body).toHaveProperty("monthlyPayment")
      expect(res.body).toHaveProperty("totalInterest")
      expect(res.body.monthlyPayment).toBeGreaterThan(0)
    })

    it("只付利息模式應回傳正確結果", async () => {
      const res = await request(app)
        .post("/api/loan-investment/calculate")
        .send({
          principalAmount: "500000",
          interestRate: "5.0",
          repaymentMode: "interest_only",
          repaymentYears: 5,
        })
        .expect(200)

      expect(res.body).toHaveProperty("repaymentMode", "interest_only")
      expect(res.body).toHaveProperty("monthlyInterest")
      expect(res.body.monthlyInterest).toBeGreaterThan(0)
    })

    it("到期一次還模式應回傳正確結果", async () => {
      const res = await request(app)
        .post("/api/loan-investment/calculate")
        .send({
          principalAmount: "200000",
          interestRate: "4.0",
          repaymentMode: "lump_sum",
          repaymentYears: 3,
        })
        .expect(200)

      expect(res.body).toHaveProperty("repaymentMode", "lump_sum")
      expect(res.body).toHaveProperty("finalPayment")
      expect(res.body.finalPayment).toBeGreaterThan(200000)
    })
  })

  // ── DELETE /api/loan-investment/records/:id ─────────────────────

  describe("DELETE /api/loan-investment/records/:id - 刪除記錄", () => {
    it("應成功刪除借貸記錄並回傳 204", async () => {
      const timestamp = Date.now()
      const createRes = await request(app)
        .post("/api/loan-investment/records")
        .send({
          itemName: `待刪除借貸_${timestamp}`,
          recordType: "borrowing",
          partyName: `待刪除對象_${timestamp}`,
          principalAmount: "50000",
          annualInterestRate: "3.0",
          startDate: "2026-06-01",
          status: "active",
        })
        .expect(201)

      await request(app)
        .delete(`/api/loan-investment/records/${createRes.body.id}`)
        .expect(204)
    })
  })
})
