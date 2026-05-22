/**
 * Budget API 整合測試
 * 測試預算計劃 CRUD、預算項目管理、統計摘要
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

  const budgetRoutes = (await import("../../server/routes/budget")).default
  app.use(budgetRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Budget API", () => {
  let app: Express
  const createdPlanIds: number[] = []
  const createdItemIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const id of createdItemIds) {
      try {
        await request(app).delete(`/api/budget/items/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
    for (const id of createdPlanIds) {
      try {
        await request(app).delete(`/api/budget/plans/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── GET /api/budget/plans ──────────────────────────────────────

  describe("GET /api/budget/plans - 預算計劃列表", () => {
    it("應回傳預算計劃陣列", async () => {
      const res = await request(app)
        .get("/api/budget/plans")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援 includeItems 參數", async () => {
      const res = await request(app).get("/api/budget/plans?includeItems=true").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty("items")
        expect(res.body[0]).toHaveProperty("calculatedTotal")
      }
    })
  })

  // ── POST /api/budget/plans ─────────────────────────────────────

  describe("POST /api/budget/plans - 新增預算計劃", () => {
    it("應成功建立預算計劃並回傳 201", async () => {
      const timestamp = Date.now()
      const plan = {
        planName: `測試預算_${timestamp}`,
        projectId: 1,
        totalBudget: "500000",
        status: "draft",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      }

      const res = await request(app).post("/api/budget/plans").send(plan).expect(201)

      expect(res.body).toHaveProperty("id")
      createdPlanIds.push(res.body.id)
    })

    it("無效資料應回傳 400", async () => {
      const res = await request(app).post("/api/budget/plans").send({ invalidField: true })

      expect(res.status).toBe(400)
    })
  })

  // ── GET /api/budget/plans/:id ──────────────────────────────────

  describe("GET /api/budget/plans/:id - 單一預算計劃", () => {
    it("應回傳指定預算計劃含項目", async () => {
      const planId = createdPlanIds[0]
      if (!planId) return

      const res = await request(app).get(`/api/budget/plans/${planId}`).expect(200)

      expect(res.body).toHaveProperty("id", planId)
      expect(res.body).toHaveProperty("items")
      expect(res.body).toHaveProperty("calculatedTotal")
    })

    it("不存在的計劃應回傳 404", async () => {
      await request(app).get("/api/budget/plans/999999").expect(404)
    })

    it("無效 ID 應回傳 400", async () => {
      await request(app).get("/api/budget/plans/abc").expect(400)
    })
  })

  // ── PATCH /api/budget/plans/:id ────────────────────────────────

  describe("PATCH /api/budget/plans/:id - 更新預算計劃", () => {
    it("應成功更新預算計劃", async () => {
      const planId = createdPlanIds[0]
      if (!planId) return

      const res = await request(app)
        .patch(`/api/budget/plans/${planId}`)
        .send({ status: "active", totalBudget: "600000" })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  // ── POST /api/budget/items ─────────────────────────────────────

  describe("POST /api/budget/items - 新增預算項目", () => {
    it("應成功建立預算項目並回傳 201", async () => {
      const planId = createdPlanIds[0]
      if (!planId) return

      const timestamp = Date.now()
      const item = {
        budgetPlanId: planId,
        itemName: `測試項目_${timestamp}`,
        plannedAmount: "50000",
        paymentType: "single",
      }

      const res = await request(app).post("/api/budget/items").send(item).expect(201)

      expect(res.body).toHaveProperty("id")
      createdItemIds.push(res.body.id)
    })
  })

  // ── GET /api/budget/items ──────────────────────────────────────

  describe("GET /api/budget/items - 預算項目列表", () => {
    it("應回傳預算項目陣列", async () => {
      const res = await request(app).get("/api/budget/items").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援 budgetPlanId 篩選", async () => {
      const planId = createdPlanIds[0]
      if (!planId) return

      const res = await request(app).get(`/api/budget/items?budgetPlanId=${planId}`).expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── GET /api/budget/items/:id ──────────────────────────────────

  describe("GET /api/budget/items/:id - 單一預算項目", () => {
    it("應回傳指定預算項目", async () => {
      const itemId = createdItemIds[0]
      if (!itemId) return

      const res = await request(app).get(`/api/budget/items/${itemId}`).expect(200)

      expect(res.body).toHaveProperty("id", itemId)
    })

    it("不存在的項目應回傳 404", async () => {
      await request(app).get("/api/budget/items/999999").expect(404)
    })
  })

  // ── PATCH /api/budget/items/:id ────────────────────────────────

  describe("PATCH /api/budget/items/:id - 更新預算項目", () => {
    it("應成功更新預算項目", async () => {
      const itemId = createdItemIds[0]
      if (!itemId) return

      const res = await request(app)
        .patch(`/api/budget/items/${itemId}`)
        .send({
          plannedAmount: "60000",
          actualAmount: "55000",
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  // ── GET /api/budget/plans/:id/summary ──────────────────────────

  describe("GET /api/budget/plans/:id/summary - 預算摘要", () => {
    it("應回傳完整統計摘要", async () => {
      const planId = createdPlanIds[0]
      if (!planId) return

      const res = await request(app).get(`/api/budget/plans/${planId}/summary`).expect(200)

      expect(res.body).toHaveProperty("plan")
      expect(res.body).toHaveProperty("summary")
      expect(res.body.summary).toHaveProperty("totalBudget")
      expect(res.body.summary).toHaveProperty("calculatedTotal")
      expect(res.body.summary).toHaveProperty("itemCount")
      expect(res.body.summary).toHaveProperty("byPaymentType")
    })
  })

  // ── GET /api/budget/overrun-alerts ─────────────────────────────

  describe("GET /api/budget/overrun-alerts - 預算超支警示", () => {
    it("應回傳超支警示結構（items + totalCount + severity 分級 + message）", async () => {
      const res = await request(app).get("/api/budget/overrun-alerts").expect(200)
      expect(Array.isArray(res.body.items)).toBe(true)
      expect(res.body).toHaveProperty("totalCount")
      expect(res.body).toHaveProperty("dangerCount")
      expect(res.body).toHaveProperty("overCount")
      expect(res.body).toHaveProperty("warnCount")
      expect(res.body.message).toBeTruthy()
    })

    it("應依 severity 分級項目（warn 80~100% / over ≥100% / danger ≥120%）", async () => {
      const res = await request(app).get("/api/budget/overrun-alerts").expect(200)
      for (const item of res.body.items) {
        expect(["warn", "over", "danger"]).toContain(item.severity)
        expect(item).toHaveProperty("usagePct")
        expect(item).toHaveProperty("planned")
        expect(item).toHaveProperty("actual")
        if (item.severity === "danger") expect(item.usagePct).toBeGreaterThanOrEqual(120)
        if (item.severity === "over") expect(item.usagePct).toBeGreaterThanOrEqual(100)
        if (item.severity === "warn") {
          expect(item.usagePct).toBeGreaterThanOrEqual(80)
          expect(item.usagePct).toBeLessThan(100)
        }
      }
    })
  })

  // ── DELETE /api/budget/items/:id ───────────────────────────────

  describe("DELETE /api/budget/items/:id - 刪除預算項目", () => {
    it("應成功軟刪除預算項目並回傳 204", async () => {
      const planId = createdPlanIds[0]
      if (!planId) return

      const createRes = await request(app)
        .post("/api/budget/items")
        .send({
          budgetPlanId: planId,
          itemName: "待刪除項目",
          plannedAmount: "10000",
          paymentType: "single",
        })
        .expect(201)

      await request(app).delete(`/api/budget/items/${createRes.body.id}`).expect(204)
    })
  })

  // ── DELETE /api/budget/plans/:id ───────────────────────────────

  describe("DELETE /api/budget/plans/:id - 刪除預算計劃", () => {
    it("應成功刪除預算計劃並回傳 204", async () => {
      const timestamp = Date.now()
      const createRes = await request(app)
        .post("/api/budget/plans")
        .send({
          planName: `待刪除預算_${timestamp}`,
          projectId: 1,
          totalBudget: "100000",
          startDate: "2026-07-01",
          endDate: "2026-12-31",
          status: "draft",
        })
        .expect(201)

      await request(app).delete(`/api/budget/plans/${createRes.body.id}`).expect(204)
    })
  })
})
