/**
 * 固定開銷矩陣 — /api/fixed-expense-matrix
 * 驗證端點回傳結構正確（templates/cells/totals/monthlyTotals）
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
  const routes = (await import("../../server/routes/fixed-expense-matrix")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Fixed Expense Matrix API", () => {
  let app: Express
  beforeAll(async () => {
    app = await createTestApp()
  })

  it("回傳完整矩陣結構", async () => {
    const res = await request(app).get("/api/fixed-expense-matrix?year=2026")
    expect(res.status).toBe(200)
    expect(res.body.year).toBe(2026)
    expect(res.body.months).toHaveLength(12)
    expect(Array.isArray(res.body.templates)).toBe(true)
    expect(Array.isArray(res.body.cells)).toBe(true)
    expect(res.body.monthlyTotals).toHaveLength(12)
    expect(res.body.totals).toHaveProperty("budget")
    expect(res.body.totals).toHaveProperty("actual")
    expect(res.body.totals).toHaveProperty("diff")
    expect(res.body.totals).toHaveProperty("overBudgetCount")
    // cells 數 = templates × 12
    expect(res.body.cells.length).toBe(res.body.templates.length * 12)
  })

  it("year 越界回 400", async () => {
    const res = await request(app).get("/api/fixed-expense-matrix?year=1800")
    expect(res.status).toBe(400)
  })

  it("categoryId 篩選只回該類別模板", async () => {
    const res = await request(app).get("/api/fixed-expense-matrix?year=2026&categoryId=999999")
    expect(res.status).toBe(200)
    expect(res.body.templates).toHaveLength(0)
    expect(res.body.cells).toHaveLength(0)
  })
})
