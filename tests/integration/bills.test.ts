/**
 * 帳單到期看板 — /api/bills/upcoming
 * 驗證：未付 payment_item 依法定付款日入列、強執分期投影、逾期旗標
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
  const routes = (await import("../../server/routes/bills")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

const MARK = "__bills_test_" + Date.now()

describe.skipIf(skipIfNoDb)("Bills upcoming API", () => {
  let app: Express
  let itemId: number
  let instId: number

  beforeAll(async () => {
    app = await createTestApp()
    // 逾期未付帳單（法定付款日昨天）
    const it = await db.execute(sql`
      INSERT INTO payment_items (item_name, total_amount, item_type, payment_type, start_date, legal_due_date, status, notes)
      VALUES (${MARK}, '3000', 'project', 'single', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '1 day', 'pending', ${MARK})
      RETURNING id
    `)
    itemId = (it as unknown as { rows: Array<{ id: number }> }).rows[0].id
    // active 強執分期
    const inst = await db.execute(sql`
      INSERT INTO enforcement_installments (monthly_amount, day_of_month, status, notes)
      VALUES ('5000', 10, 'active', ${MARK}) RETURNING id
    `)
    instId = (inst as unknown as { rows: Array<{ id: number }> }).rows[0].id
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM payment_items WHERE id = ${itemId}`)
    await db.execute(sql`DELETE FROM enforcement_installments WHERE id = ${instId}`)
  })

  it("回傳結構 + 逾期帳單入列 + 強執分期投影", async () => {
    const res = await request(app).get("/api/bills/upcoming?days=45")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.bills)).toBe(true)
    expect(res.body).toHaveProperty("totalDue")
    expect(res.body).toHaveProperty("overdueTotal")

    const myItem = res.body.bills.find(
      (b: { source: string; refId: number }) => b.source === "payment_item" && b.refId === itemId
    )
    expect(myItem).toBeTruthy()
    expect(myItem.overdue).toBe(true)

    const inst = res.body.bills.find(
      (b: { source: string; refId: number }) =>
        b.source === "enforcement_installment" && b.refId === instId
    )
    expect(inst).toBeTruthy()
    expect(inst.amount).toBe(5000)
  })

  it("days 參數鉗制（7-120）", async () => {
    const res = await request(app).get("/api/bills/upcoming?days=999")
    expect(res.status).toBe(200)
    expect(res.body.days).toBe(120)
  })
})
