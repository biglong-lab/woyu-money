/**
 * 排程分配規劃台 — allocation CRUD
 * （GET /api/payment-planner 依賴優先級報告掃全表、較重，這裡只測規劃層 CRUD）
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
  const routes = (await import("../../server/routes/payment-planner")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Payment Planner allocations API", () => {
  let app: Express
  let itemId: number
  let allocId: number

  beforeAll(async () => {
    app = await createTestApp()
    const rows = await db.execute(sql`
      INSERT INTO payment_items (item_name, total_amount, item_type, payment_type, start_date, status)
      VALUES ('__planner_test', '30000', 'project', 'single', '2099-01-01', 'pending')
      RETURNING id
    `)
    itemId = (rows as unknown as { rows: Array<{ id: number }> }).rows[0].id
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM payment_plan_allocations WHERE payment_item_id = ${itemId}`)
    await db.execute(sql`DELETE FROM payment_items WHERE id = ${itemId}`)
  })

  it("新增分配", async () => {
    const res = await request(app)
      .post("/api/payment-planner/allocations")
      .send({ paymentItemId: itemId, plannedMonth: "2099-03", plannedAmount: "10000" })
    expect(res.status).toBe(200)
    expect(res.body.id).toBeDefined()
    expect(res.body.plannedMonth).toBe("2099-03")
    allocId = res.body.id
  })

  it("月份格式錯誤應 400", async () => {
    const res = await request(app)
      .post("/api/payment-planner/allocations")
      .send({ paymentItemId: itemId, plannedMonth: "2099/03", plannedAmount: "10000" })
    expect(res.status).toBe(400)
  })

  it("更新分配金額", async () => {
    const res = await request(app)
      .put(`/api/payment-planner/allocations/${allocId}`)
      .send({ plannedAmount: "12345" })
    expect(res.status).toBe(200)
    expect(Number(res.body.plannedAmount)).toBe(12345)
  })

  it("刪除分配", async () => {
    const res = await request(app).delete(`/api/payment-planner/allocations/${allocId}`)
    expect(res.status).toBe(200)
  })
})
