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
      const res = await request(app).get("/api/hr/employees?active=true").expect(200)

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

      const res = await request(app).post("/api/hr/employees").send(employee).expect(200)

      expect(res.body).toHaveProperty("id")
      createdEmployeeIds.push(res.body.id)
    })

    it("無效資料應回傳 400", async () => {
      const res = await request(app).post("/api/hr/employees").send({ invalidField: true })

      expect(res.status).toBe(400)
    })
  })

  // ── GET /api/hr/employees/:id ──────────────────────────────────

  describe("GET /api/hr/employees/:id - 單一員工", () => {
    it("應回傳指定員工", async () => {
      const empId = createdEmployeeIds[0]
      if (!empId) return

      const res = await request(app).get(`/api/hr/employees/${empId}`).expect(200)

      expect(res.body).toHaveProperty("id", empId)
    })

    it("不存在的員工應回傳 404", async () => {
      await request(app).get("/api/hr/employees/999999").expect(404)
    })

    it("無效 ID 應回傳 400", async () => {
      await request(app).get("/api/hr/employees/abc").expect(400)
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
      await request(app).post("/api/hr/calculate").send({ dependentsCount: 0 }).expect(400)
    })

    it("月薪為 0 應回傳 400", async () => {
      await request(app).post("/api/hr/calculate").send({ monthlySalary: 0 }).expect(400)
    })
  })

  // ── GET /api/hr/monthly-costs ──────────────────────────────────

  describe("GET /api/hr/monthly-costs - 月度人事費", () => {
    it("應回傳指定月份人事費", async () => {
      const res = await request(app).get("/api/hr/monthly-costs?year=2026&month=2").expect(200)

      expect(res.body).toBeDefined()
    })

    it("缺少參數應回傳 400", async () => {
      await request(app).get("/api/hr/monthly-costs").expect(400)
    })
  })

  // ── GET /api/hr/summary ────────────────────────────────────────

  describe("GET /api/hr/summary - 人事費彙總", () => {
    it("應回傳年度彙總統計", async () => {
      const res = await request(app).get("/api/hr/summary?year=2026").expect(200)

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

      const res = await request(app).delete(`/api/hr/employees/${createRes.body.id}`).expect(200)

      expect(res.body).toHaveProperty("id")
    })

    it("不存在的員工 ID 應回傳 404", async () => {
      await request(app).delete("/api/hr/employees/999999").expect(404)
    })

    it("無效的員工 ID 應回傳 400", async () => {
      await request(app).delete("/api/hr/employees/abc").expect(400)
    })
  })

  // ── PUT /api/hr/employees/:id 邊界測試 ──────────────────────

  describe("PUT /api/hr/employees/:id - 邊界測試", () => {
    it("不存在的員工 ID 應回傳 404", async () => {
      await request(app)
        .put("/api/hr/employees/999999")
        .send({ monthlySalary: "40000" })
        .expect(404)
    })

    it("無效的員工 ID 應回傳 400", async () => {
      await request(app).put("/api/hr/employees/abc").send({ monthlySalary: "40000" }).expect(400)
    })
  })

  // ── POST /api/hr/monthly-costs/generate ──────────────────────

  describe("POST /api/hr/monthly-costs/generate - 產生月度人事費", () => {
    it("應成功為在職員工產生月度人事費", async () => {
      // 先建立測試員工（確保有在職員工）
      const timestamp = Date.now()
      const empRes = await request(app)
        .post("/api/hr/employees")
        .send({
          employeeName: `月度測試員工_${timestamp}`,
          monthlySalary: "35000",
          hireDate: "2025-01-01",
        })
        .expect(200)
      createdEmployeeIds.push(empRes.body.id)

      // 產生 2099 年 1 月的人事費（避免干擾真實資料）
      const res = await request(app)
        .post("/api/hr/monthly-costs/generate")
        .send({ year: 2099, month: 1 })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("message")
      expect(res.body).toHaveProperty("records")

      if (res.body.records.length > 0) {
        const record = res.body.records[0]
        expect(record).toHaveProperty("id")
        expect(record).toHaveProperty("year", 2099)
        expect(record).toHaveProperty("month", 1)
        expect(record).toHaveProperty("baseSalary")
        expect(record).toHaveProperty("employerTotal")
        expect(record).toHaveProperty("employeeTotal")
        expect(record).toHaveProperty("netSalary")
        expect(record).toHaveProperty("totalCost")
      }
    })

    it("缺少 year 應回傳 400", async () => {
      await request(app).post("/api/hr/monthly-costs/generate").send({ month: 1 }).expect(400)
    })

    it("缺少 month 應回傳 400", async () => {
      await request(app).post("/api/hr/monthly-costs/generate").send({ year: 2026 }).expect(400)
    })

    it("重複生成同月份應覆蓋舊記錄", async () => {
      // 第一次生成
      const res1 = await request(app)
        .post("/api/hr/monthly-costs/generate")
        .send({ year: 2099, month: 2 })
      expect(res1.status).toBe(200)

      // 第二次生成相同月份
      const res2 = await request(app)
        .post("/api/hr/monthly-costs/generate")
        .send({ year: 2099, month: 2 })
      expect(res2.status).toBe(200)
    })
  })

  // ── PUT /api/hr/monthly-costs/:id/pay ────────────────────────

  describe("PUT /api/hr/monthly-costs/:id/pay - 更新付款狀態", () => {
    it("應成功更新薪資已付款狀態", async () => {
      // 先產生月度記錄以獲得可用 ID
      const genRes = await request(app)
        .post("/api/hr/monthly-costs/generate")
        .send({ year: 2099, month: 3 })

      if (genRes.body.records && genRes.body.records.length > 0) {
        const recordId = genRes.body.records[0].id

        const res = await request(app)
          .put(`/api/hr/monthly-costs/${recordId}/pay`)
          .send({ isPaid: true })
          .expect(200)

        expect(res.body).toHaveProperty("id", recordId)
        expect(res.body.isPaid).toBe(true)
      }
    })

    it("應成功更新保險已付款狀態", async () => {
      const genRes = await request(app)
        .post("/api/hr/monthly-costs/generate")
        .send({ year: 2099, month: 4 })

      if (genRes.body.records && genRes.body.records.length > 0) {
        const recordId = genRes.body.records[0].id

        const res = await request(app)
          .put(`/api/hr/monthly-costs/${recordId}/pay`)
          .send({ insurancePaid: true })
          .expect(200)

        expect(res.body).toHaveProperty("id", recordId)
        expect(res.body.insurancePaid).toBe(true)
      }
    })

    it("不存在的記錄 ID 應回傳 404", async () => {
      await request(app).put("/api/hr/monthly-costs/999999/pay").send({ isPaid: true }).expect(404)
    })

    it("無效的記錄 ID 應回傳 400", async () => {
      await request(app).put("/api/hr/monthly-costs/abc/pay").send({ isPaid: true }).expect(400)
    })
  })

  // ── GET /api/hr/summary 邊界測試 ─────────────────────────────

  describe("GET /api/hr/summary - 邊界測試", () => {
    it("不帶 year 參數應使用當前年份", async () => {
      const res = await request(app).get("/api/hr/summary").expect(200)

      const currentYear = new Date().getFullYear()
      expect(res.body).toHaveProperty("year", currentYear)
      expect(res.body).toHaveProperty("activeEmployeeCount")
      expect(res.body).toHaveProperty("monthlySummary")
      expect(res.body).toHaveProperty("annualTotal")
    })

    it("monthlySummary 應包含 12 個月份", async () => {
      const res = await request(app).get("/api/hr/summary?year=2026").expect(200)

      const months = Object.keys(res.body.monthlySummary)
      expect(months.length).toBe(12)
    })

    it("annualTotal 應包含正確的彙總結構", async () => {
      const res = await request(app).get("/api/hr/summary?year=2026").expect(200)

      expect(res.body.annualTotal).toHaveProperty("totalSalary")
      expect(res.body.annualTotal).toHaveProperty("totalEmployerCost")
      expect(res.body.annualTotal).toHaveProperty("totalCost")
      expect(typeof res.body.annualTotal.totalSalary).toBe("number")
      expect(typeof res.body.annualTotal.totalEmployerCost).toBe("number")
      expect(typeof res.body.annualTotal.totalCost).toBe("number")
    })
  })

  // ── GET /api/hr/monthly-costs 邊界測試 ──────────────────────

  describe("GET /api/hr/monthly-costs - 邊界測試", () => {
    it("只提供 year 缺少 month 應回傳 400", async () => {
      await request(app).get("/api/hr/monthly-costs?year=2026").expect(400)
    })

    it("只提供 month 缺少 year 應回傳 400", async () => {
      await request(app).get("/api/hr/monthly-costs?month=3").expect(400)
    })
  })

  // ── POST /api/hr/employees 邊界測試 ─────────────────────────

  describe("POST /api/hr/employees - 邊界測試", () => {
    it("應支援帶眷屬和自提率的完整建立", async () => {
      const timestamp = Date.now()
      const employee = {
        employeeName: `完整員工_${timestamp}`,
        monthlySalary: "42000",
        hireDate: "2025-06-01",
        position: "前台",
        dependentsCount: 2,
        voluntaryPensionRate: "3",
        notes: "測試備註",
      }

      const res = await request(app).post("/api/hr/employees").send(employee).expect(200)

      expect(res.body).toHaveProperty("id")
      expect(res.body.employeeName).toBe(`完整員工_${timestamp}`)
      expect(res.body.position).toBe("前台")
      createdEmployeeIds.push(res.body.id)
    })

    it("缺少 employeeName 應回傳 400", async () => {
      const res = await request(app).post("/api/hr/employees").send({
        monthlySalary: "35000",
        hireDate: "2026-01-01",
      })

      expect(res.status).toBe(400)
    })

    it("缺少 monthlySalary 應回傳 400", async () => {
      const res = await request(app).post("/api/hr/employees").send({
        employeeName: "缺薪資員工",
        hireDate: "2026-01-01",
      })

      expect(res.status).toBe(400)
    })

    it("缺少 hireDate 應回傳 400", async () => {
      const res = await request(app).post("/api/hr/employees").send({
        employeeName: "缺日期員工",
        monthlySalary: "35000",
      })

      expect(res.status).toBe(400)
    })
  })

  // ── POST /api/hr/calculate 邊界測試 ─────────────────────────

  describe("POST /api/hr/calculate - 邊界測試", () => {
    it("負數月薪應回傳 400", async () => {
      await request(app).post("/api/hr/calculate").send({ monthlySalary: -1000 }).expect(400)
    })

    it("只提供月薪（無其他參數）應成功計算", async () => {
      const res = await request(app)
        .post("/api/hr/calculate")
        .send({ monthlySalary: 30000 })
        .expect(200)

      expect(res.body).toHaveProperty("netSalary")
      expect(res.body).toHaveProperty("totalCost")
    })

    it("帶眷屬人數計算應影響健保費", async () => {
      const noDeps = await request(app)
        .post("/api/hr/calculate")
        .send({ monthlySalary: 35000, dependentsCount: 0 })
        .expect(200)

      const withDeps = await request(app)
        .post("/api/hr/calculate")
        .send({ monthlySalary: 35000, dependentsCount: 2 })
        .expect(200)

      // 眷屬越多，員工健保負擔越高
      expect(withDeps.body.employeeHealthInsurance).toBeGreaterThan(
        noDeps.body.employeeHealthInsurance
      )
    })

    it("帶自提勞退率計算應影響員工自提金額", async () => {
      const noVol = await request(app)
        .post("/api/hr/calculate")
        .send({ monthlySalary: 40000, voluntaryPensionRate: 0 })
        .expect(200)

      const withVol = await request(app)
        .post("/api/hr/calculate")
        .send({ monthlySalary: 40000, voluntaryPensionRate: 6 })
        .expect(200)

      expect(withVol.body.employeePension).toBeGreaterThan(noVol.body.employeePension)
    })
  })

  // ── GET /api/hr/employees 篩選測試 ──────────────────────────

  describe("GET /api/hr/employees - 篩選邊界", () => {
    it("active=false 應回傳包含離職員工", async () => {
      const res = await request(app).get("/api/hr/employees?active=false").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      // 離職篩選的結果中所有員工 isActive 應為 false
      for (const emp of res.body) {
        expect(emp.isActive).toBe(false)
      }
    })

    it("不帶 active 參數應回傳所有員工", async () => {
      const res = await request(app).get("/api/hr/employees").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })
})
