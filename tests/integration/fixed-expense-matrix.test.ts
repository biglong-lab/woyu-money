/**
 * 固定開銷矩陣 — /api/fixed-expense-matrix
 * 驗證端點回傳結構正確（templates/cells/totals/monthlyTotals）
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

describe.skipIf(skipIfNoDb)("Fixed Expense Matrix Pay（點格子記付款）", () => {
  let app: Express
  let templateId: number
  const YEAR = 2099 // 用未來年避免污染真實資料
  const MONTH = 3

  beforeAll(async () => {
    app = await createTestApp()
    const r = await db.execute(sql`
      INSERT INTO recurring_expense_templates
        (template_name, estimated_amount, day_of_month, active_months, is_active)
      VALUES ('__pay_test_tpl', '10000', 15, '*', true)
      RETURNING id
    `)
    templateId = (r as unknown as { rows: Array<{ id: number }> }).rows[0].id
  })

  afterAll(async () => {
    // 清付款紀錄 → 項目 → 模板
    await db.execute(sql`
      DELETE FROM payment_records WHERE payment_item_id IN (
        SELECT id FROM payment_items WHERE recurring_template_id = ${templateId}
      )
    `)
    await db.execute(sql`DELETE FROM payment_items WHERE recurring_template_id = ${templateId}`)
    await db.execute(sql`DELETE FROM recurring_expense_templates WHERE id = ${templateId}`)
  })

  it("付款後矩陣該格 actual 反映實付、find-or-create 自動建項目", async () => {
    const pay = await request(app)
      .post("/api/fixed-expense-matrix/pay")
      .field("templateId", String(templateId))
      .field("year", String(YEAR))
      .field("month", String(MONTH))
      .field("amount", "9500")
      .field("paymentDate", `${YEAR}-0${MONTH}-15`)
      .field("paymentMethod", "轉帳")
    expect(pay.status).toBe(200)
    expect(pay.body.success).toBe(true)
    expect(pay.body.itemId).toBeGreaterThan(0)

    const matrix = await request(app).get(`/api/fixed-expense-matrix?year=${YEAR}`)
    const cell = matrix.body.cells.find(
      (c: { templateId: number; month: number }) => c.templateId === templateId && c.month === MONTH
    )
    expect(cell).toBeTruthy()
    expect(cell.actual).toBe(9500)
    expect(cell.budget).toBe(10000)
    expect(cell.diff).toBe(-500)
  })

  it("缺金額回 400", async () => {
    const res = await request(app)
      .post("/api/fixed-expense-matrix/pay")
      .field("templateId", String(templateId))
      .field("year", String(YEAR))
      .field("month", String(MONTH))
    expect(res.status).toBe(400)
  })
})
