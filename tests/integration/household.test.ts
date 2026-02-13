/**
 * Household API 整合測試
 * 測試家用分類、預算、支出 CRUD
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

  const householdRoutes = (await import("../../server/routes/household")).default
  app.use(householdRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Household API", () => {
  let app: Express
  const createdExpenseIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const id of createdExpenseIds) {
      try {
        await request(app).delete(`/api/household-expenses/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── GET /api/household-categories ──────────────────────────────

  describe("GET /api/household-categories - 家用分類", () => {
    it("應回傳分類陣列", async () => {
      const res = await request(app)
        .get("/api/household-categories")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/household-budgets ─────────────────────────────────

  describe("GET /api/household-budgets - 家用預算", () => {
    it("應回傳預算陣列", async () => {
      const res = await request(app)
        .get("/api/household-budgets")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── POST /api/household-budgets ────────────────────────────────

  describe("POST /api/household-budgets - 新增/更新預算", () => {
    it("應成功建立家用預算", async () => {
      const budget = {
        categoryId: 1,
        year: 2026,
        month: 2,
        budgetAmount: "5000",
      }

      const res = await request(app)
        .post("/api/household-budgets")
        .send(budget)
        .expect(201)

      expect(res.body).toHaveProperty("id")
    })

    it("無效資料應回傳 400", async () => {
      const res = await request(app)
        .post("/api/household-budgets")
        .send({ invalidField: true })

      expect(res.status).toBe(400)
    })
  })

  // ── GET /api/household-expenses ────────────────────────────────

  describe("GET /api/household-expenses - 支出列表", () => {
    it("應回傳支出資料", async () => {
      const res = await request(app)
        .get("/api/household-expenses")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("應支援分頁參數", async () => {
      const res = await request(app)
        .get("/api/household-expenses?page=1&limit=5")
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("應支援日期範圍篩選", async () => {
      const res = await request(app)
        .get("/api/household-expenses?startDate=2026-01-01&endDate=2026-12-31")
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("應支援分類篩選", async () => {
      const res = await request(app)
        .get("/api/household-expenses?categoryId=1")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── POST /api/household-expenses ───────────────────────────────

  describe("POST /api/household-expenses - 新增支出", () => {
    it("應成功建立支出記錄", async () => {
      const expense = {
        categoryId: 1,
        amount: "350",
        description: "整合測試支出",
        date: "2026-02-07",
        paymentMethod: "cash",
      }

      const res = await request(app)
        .post("/api/household-expenses")
        .send(expense)
        .expect(201)

      expect(res.body).toHaveProperty("id")
      createdExpenseIds.push(res.body.id)
    })

    it("無效資料應回傳 400", async () => {
      const res = await request(app)
        .post("/api/household-expenses")
        .send({ invalidField: "test" })

      expect(res.status).toBe(400)
    })
  })

  // ── PUT /api/household-expenses/:id ────────────────────────────

  describe("PUT /api/household-expenses/:id - 更新支出", () => {
    it("應成功更新支出記錄", async () => {
      const expenseId = createdExpenseIds[0]
      if (!expenseId) return

      const res = await request(app)
        .put(`/api/household-expenses/${expenseId}`)
        .send({
          categoryId: 1,
          amount: "500",
          description: "已更新的支出",
          date: "2026-02-07",
          paymentMethod: "credit_card",
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  // ── DELETE /api/household-expenses/:id ─────────────────────────

  describe("DELETE /api/household-expenses/:id - 刪除支出", () => {
    it("應成功刪除支出記錄並回傳 204", async () => {
      const createRes = await request(app)
        .post("/api/household-expenses")
        .send({
          categoryId: 1,
          amount: "100",
          description: "待刪除支出",
          date: "2026-02-07",
          paymentMethod: "cash",
        })
        .expect(201)

      await request(app)
        .delete(`/api/household-expenses/${createRes.body.id}`)
        .expect(204)
    })
  })
})
