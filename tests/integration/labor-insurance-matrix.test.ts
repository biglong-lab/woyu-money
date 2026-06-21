/**
 * 勞健保矩陣 — /api/labor-insurance-matrix
 * 驗證結構、加總、mark-paid 改變狀態
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"
import { db } from "../../server/db"
import { sql } from "drizzle-orm"

const skipIfNoDb = !process.env.DATABASE_URL

async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    const r = req as typeof req & {
      user: { id: number; username: string; isActive: boolean }
      isAuthenticated: () => boolean
      session: Record<string, unknown>
    }
    r.user = { id: 1, username: "admin", isActive: true }
    r.isAuthenticated = () => true
    r.session = { userId: 1, isAuthenticated: true }
    next()
  })
  const routes = (await import("../../server/routes/labor-insurance-matrix")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

const YEAR = 2098
let empId: number

describe.skipIf(skipIfNoDb)("Labor Insurance Matrix API", () => {
  let app: Express

  beforeAll(async () => {
    app = await createTestApp()
    const e = await db.execute(sql`
      INSERT INTO employees (employee_name, monthly_salary, hire_date, is_active)
      VALUES ('__li_test_emp', '40000', '2000-01-01', true) RETURNING id
    `)
    empId = (e as unknown as { rows: Array<{ id: number }> }).rows[0].id
    // 1 月一筆未繳
    await db.execute(sql`
      INSERT INTO monthly_hr_costs
        (year, month, employee_id, employer_labor_insurance, employer_employment_insurance,
         employer_accident_insurance, employer_health_insurance, employer_pension, insurance_paid)
      VALUES (${YEAR}, 1, ${empId}, '2000', '200', '100', '1500', '1800', false)
    `)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM monthly_hr_costs WHERE employee_id = ${empId}`)
    await db.execute(sql`DELETE FROM employees WHERE id = ${empId}`)
  })

  it("回傳三列 × 12 月 + 正確加總", async () => {
    const res = await request(app).get(`/api/labor-insurance-matrix?year=${YEAR}`)
    expect(res.status).toBe(200)
    expect(res.body.rows).toHaveLength(3)
    const labor = res.body.rows.find((r: { key: string }) => r.key === "labor")
    expect(labor.cells.find((c: { month: number }) => c.month === 1).amount).toBe(2300)
    const jan = res.body.monthly.find((m: { month: number }) => m.month === 1)
    expect(jan.total).toBe(5600)
    expect(jan.status).toBe("unpaid")
  })

  it("year 越界回 400", async () => {
    const res = await request(app).get("/api/labor-insurance-matrix?year=1700")
    expect(res.status).toBe(400)
  })

  it("mark-paid 後該月變 paid", async () => {
    const pay = await request(app)
      .post("/api/labor-insurance-matrix/mark-paid")
      .send({ year: YEAR, month: 1 })
    expect(pay.status).toBe(200)
    expect(pay.body.updated).toBeGreaterThanOrEqual(1)

    const res = await request(app).get(`/api/labor-insurance-matrix?year=${YEAR}`)
    const jan = res.body.monthly.find((m: { month: number }) => m.month === 1)
    expect(jan.status).toBe("paid")
  })
})
