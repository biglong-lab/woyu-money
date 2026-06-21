/**
 * 成本結構年度端點 + ledger 桶 — /api/dashboard/cost-structure(/annual)
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
  const routes = (await import("../../server/routes/cost-structure")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

const NOTE = "__cs_ledger_test_" + Date.now()

describe.skipIf(skipIfNoDb)("Cost Structure annual + ledger bucket", () => {
  let app: Express
  let ledgerId: number

  beforeAll(async () => {
    app = await createTestApp()
    const r = await db.execute(sql`
      INSERT INTO expense_ledger (amount, entry_date, note, status)
      VALUES ('888', CURRENT_DATE, ${NOTE}, 'unclassified') RETURNING id
    `)
    ledgerId = (r as unknown as { rows: Array<{ id: number }> }).rows[0].id
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM expense_ledger WHERE id = ${ledgerId}`)
  })

  it("月度結構含 ledger 桶（流水帳計入）", async () => {
    const month = new Date().toISOString().slice(0, 7)
    const res = await request(app).get(`/api/dashboard/cost-structure?month=${month}`)
    expect(res.status).toBe(200)
    expect(res.body.ledger).toBeTruthy()
    expect(res.body.ledger.total).toBeGreaterThanOrEqual(888)
    expect(res.body.ledger.unclassifiedCount).toBeGreaterThanOrEqual(1)
    // ledger 計入 grandTotal
    expect(res.body.grandTotal).toBeGreaterThanOrEqual(888)
  })

  it("年度結構回五桶 ×12 月 + totals", async () => {
    const year = new Date().getFullYear()
    const res = await request(app).get(`/api/dashboard/cost-structure/annual?year=${year}`)
    expect(res.status).toBe(200)
    expect(res.body.buckets.map((b: { key: string }) => b.key)).toEqual([
      "rental",
      "hr",
      "fixed",
      "ledger",
      "manual",
    ])
    for (const b of res.body.buckets) expect(b.cells).toHaveLength(12)
    expect(res.body.monthly).toHaveLength(12)
    expect(res.body.totals).toHaveProperty("budget")
    expect(res.body.totals).toHaveProperty("actual")
    // 本月流水帳 888 應落在 ledger 桶實際
    const ledger = res.body.buckets.find((b: { key: string }) => b.key === "ledger")
    expect(ledger.actualTotal).toBeGreaterThanOrEqual(888)
  })
})
