/**
 * HR Costs API 整合測試
 * 測試員工 CRUD、薪資計算、月度人事費
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

  const hrRoutes = (await import("../../server/routes/hr-costs")).default
  app.use(hrRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("HR Costs API", () => {
  let app: Express
  const createdEmployeeIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const id of createdEmployeeIds) {
      try {
        await request(app).delete(`/api/hr/employees/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── GET /api/hr/employees ──────────────────────────────────────

  describe("GET /api/hr/employees - 員工列表", () => {
    it("應回傳員工陣列", async () => {
      const res = await request(app)
        .get("/api/hr/employees")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援 active 篩選", async () => {
      const res = await request(app)
        .get("/api/hr/employees?active=true")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── POST /api/hr/employees ─────────────────────────────────────

  describe("POST /api/hr/employees - 新增員工", () => {
    it("應成功建立員工", async () => {
      const timestamp = Date.now()
      const employee = {
        employeeName: `測試員工_${timestamp}`,
        monthlySalary: "35000",
        hireDate: "2026-01-15",
      }

      const res = await request(app)
        .post("/api/hr/employees")
        .send(employee)
        .expect(200)

      expect(res.body).toHaveProperty("id")
      createdEmployeeIds.push(res.body.id)
    })

    it("無效資料應回傳 400", async () => {
      const res = await request(app)
        .post("/api/hr/employees")
        .send({ invalidField: true })

      expect(res.status).toBe(400)
    })
  })

  // ── GET /api/hr/employees/:id ──────────────────────────────────

  describe("GET /api/hr/employees/:id - 單一員工", () => {
    it("應回傳指定員工", async () => {
      const empId = createdEmployeeIds[0]
      if (!empId) return

      const res = await request(app)
        .get(`/api/hr/employees/${empId}`)
        .expect(200)

      expect(res.body).toHaveProperty("id", empId)
    })

    it("不存在的員工應回傳 404", async () => {
      await request(app)
        .get("/api/hr/employees/999999")
        .expect(404)
    })

    it("無效 ID 應回傳 400", async () => {
      await request(app)
        .get("/api/hr/employees/abc")
        .expect(400)
    })
  })

  // ── PUT /api/hr/employees/:id ──────────────────────────────────

  describe("PUT /api/hr/employees/:id - 更新員工", () => {
    it("應成功更新員工資料", async () => {
      const empId = createdEmployeeIds[0]
      if (!empId) return

      const res = await request(app)
        .put(`/api/hr/employees/${empId}`)
        .send({ monthlySalary: "38000" })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  // ── POST /api/hr/calculate ─────────────────────────────────────

  describe("POST /api/hr/calculate - 薪資計算", () => {
    it("應正確計算薪資明細", async () => {
      const res = await request(app)
        .post("/api/hr/calculate")
        .send({
          monthlySalary: 35000,
          insuredSalary: 36300,
          dependentsCount: 0,
          voluntaryPensionRate: 0,
        })
        .expect(200)

      expect(res.body).toHaveProperty("employerTotal")
      expect(res.body).toHaveProperty("employeeTotal")
      expect(res.body).toHaveProperty("netSalary")
      expect(res.body).toHaveProperty("totalCost")
      expect(res.body.netSalary).toBeLessThan(35000)
      expect(res.body.totalCost).toBeGreaterThan(35000)
    })

    it("缺少月薪應回傳 400", async () => {
      await request(app)
        .post("/api/hr/calculate")
        .send({ dependentsCount: 0 })
        .expect(400)
    })

    it("月薪為 0 應回傳 400", async () => {
      await request(app)
        .post("/api/hr/calculate")
        .send({ monthlySalary: 0 })
        .expect(400)
    })
  })

  // ── GET /api/hr/monthly-costs ──────────────────────────────────

  describe("GET /api/hr/monthly-costs - 月度人事費", () => {
    it("應回傳指定月份人事費", async () => {
      const res = await request(app)
        .get("/api/hr/monthly-costs?year=2026&month=2")
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("缺少參數應回傳 400", async () => {
      await request(app)
        .get("/api/hr/monthly-costs")
        .expect(400)
    })
  })

  // ── GET /api/hr/summary ────────────────────────────────────────

  describe("GET /api/hr/summary - 人事費彙總", () => {
    it("應回傳年度彙總統計", async () => {
      const res = await request(app)
        .get("/api/hr/summary?year=2026")
        .expect(200)

      expect(res.body).toHaveProperty("year", 2026)
      expect(res.body).toHaveProperty("activeEmployeeCount")
      expect(res.body).toHaveProperty("monthlySummary")
      expect(res.body).toHaveProperty("annualTotal")
    })
  })

  // ── DELETE /api/hr/employees/:id ───────────────────────────────

  describe("DELETE /api/hr/employees/:id - 軟刪除員工", () => {
    it("應成功軟刪除員工", async () => {
      const timestamp = Date.now()
      const createRes = await request(app)
        .post("/api/hr/employees")
        .send({
          employeeName: `待刪除員工_${timestamp}`,
          monthlySalary: "30000",
          hireDate: "2026-01-01",
        })
        .expect(200)

      const res = await request(app)
        .delete(`/api/hr/employees/${createRes.body.id}`)
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })
})
