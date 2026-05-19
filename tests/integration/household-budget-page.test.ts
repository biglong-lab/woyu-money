/**
 * P1 — 救活家用記帳頁面 /household-budget
 *
 * 測試 5 個 alias endpoints：
 *  GET  /api/household/budget?month=
 *  POST /api/household/budget
 *  GET  /api/household/expenses?month=
 *  POST /api/household/expenses
 *  GET  /api/household/stats?month=
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
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
  const routes = (await import("../../server/routes/household")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

const TEST_MONTH = "2099-11"
const TEST_YEAR = 2099
const TEST_MONTH_NUM = 11

describe.skipIf(skipIfNoDb)("Household budget page — P1 救活頁面", () => {
  let app: Express

  beforeAll(async () => {
    app = await createTestApp()
  })

  beforeEach(async () => {
    // 清測試月資料
    await db.execute(
      sql`DELETE FROM household_budgets WHERE year = ${TEST_YEAR} AND month = ${TEST_MONTH_NUM}`
    )
    await db.execute(
      sql`DELETE FROM household_expenses WHERE date >= '${sql.raw(TEST_MONTH + "-01")}'::date AND date < '${sql.raw(TEST_MONTH + "-30")}'::date`
    )
  })

  afterAll(async () => {
    // 完成後清乾淨
    await db.execute(
      sql`DELETE FROM household_budgets WHERE year = ${TEST_YEAR} AND month = ${TEST_MONTH_NUM}`
    )
    await db.execute(
      sql`DELETE FROM household_expenses WHERE date >= '${sql.raw(TEST_MONTH + "-01")}'::date AND date < '${sql.raw(TEST_MONTH + "-30")}'::date`
    )
  })

  it("GET /api/household/budget 無預算時應回 budgetAmount=0", async () => {
    const res = await request(app).get(`/api/household/budget?month=${TEST_MONTH}`)
    expect(res.status).toBe(200)
    expect(res.body.month).toBe(TEST_MONTH)
    expect(res.body.budgetAmount).toBe("0")
    expect(res.body.hasBudget).toBe(false)
  })

  it("POST /api/household/budget 應建立總預算、再次取得回新值", async () => {
    const post = await request(app)
      .post("/api/household/budget")
      .send({ month: TEST_MONTH, budgetAmount: 35000 })
    expect(post.status).toBe(201)
    expect(parseFloat(post.body.budgetAmount)).toBe(35000)
    expect(post.body.id).toBeGreaterThan(0)

    const get = await request(app).get(`/api/household/budget?month=${TEST_MONTH}`)
    expect(get.status).toBe(200)
    expect(parseFloat(get.body.budgetAmount)).toBe(35000)
    expect(get.body.hasBudget).toBe(true)
  })

  it("POST /api/household/budget 二次提交應 update（不重複新增）", async () => {
    await request(app)
      .post("/api/household/budget")
      .send({ month: TEST_MONTH, budgetAmount: 30000 })
    const second = await request(app)
      .post("/api/household/budget")
      .send({ month: TEST_MONTH, budgetAmount: 45000 })
    expect(second.status).toBe(201)
    expect(parseFloat(second.body.budgetAmount)).toBe(45000)

    // 只有一筆 categoryId=0 的紀錄
    const rows = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM household_budgets
          WHERE year = ${TEST_YEAR} AND month = ${TEST_MONTH_NUM} AND category_id = 0`
    )
    const { n } = (rows as unknown as { rows: { n: number }[] }).rows[0]
    expect(n).toBe(1)
  })

  it("POST /api/household/budget 拒絕負數金額", async () => {
    const res = await request(app)
      .post("/api/household/budget")
      .send({ month: TEST_MONTH, budgetAmount: -100 })
    expect(res.status).toBe(400)
  })

  it("POST /api/household/expenses + GET /api/household/expenses 完整流程", async () => {
    const post = await request(app)
      .post("/api/household/expenses")
      .send({
        amount: 250,
        date: `${TEST_MONTH}-15`,
        paymentMethod: "現金",
        description: "午餐",
      })
    expect(post.status).toBe(201)
    expect(post.body.id).toBeGreaterThan(0)

    const list = await request(app).get(`/api/household/expenses?month=${TEST_MONTH}`)
    expect(list.status).toBe(200)
    expect(Array.isArray(list.body)).toBe(true)
    const ours = list.body.find((e: { id: number }) => e.id === post.body.id)
    expect(ours).toBeTruthy()
    expect(parseFloat(ours.amount)).toBe(250)
    expect(ours.description).toBe("午餐")
  })

  it("POST /api/household/expenses 拒絕無效金額 / 日期", async () => {
    const bad1 = await request(app).post("/api/household/expenses").send({ amount: 0 })
    expect(bad1.status).toBe(400)

    const bad2 = await request(app)
      .post("/api/household/expenses")
      .send({ amount: 100, date: "2099/11/15" })
    expect(bad2.status).toBe(400)
  })

  it("GET /api/household/stats 應正確聚合「預算/已花/剩餘/分類佔比」", async () => {
    // 設預算
    await request(app)
      .post("/api/household/budget")
      .send({ month: TEST_MONTH, budgetAmount: 10000 })
    // 加 3 筆支出
    await request(app)
      .post("/api/household/expenses")
      .send({ amount: 300, date: `${TEST_MONTH}-05`, description: "早餐" })
    await request(app)
      .post("/api/household/expenses")
      .send({ amount: 1200, date: `${TEST_MONTH}-10`, description: "電費" })
    await request(app)
      .post("/api/household/expenses")
      .send({ amount: 500, date: `${TEST_MONTH}-20`, description: "公車" })

    const stats = await request(app).get(`/api/household/stats?month=${TEST_MONTH}`)
    expect(stats.status).toBe(200)
    expect(stats.body.month).toBe(TEST_MONTH)
    expect(stats.body.budgetAmount).toBe(10000)
    expect(stats.body.totalSpent).toBe(2000)
    expect(stats.body.remaining).toBe(8000)
    expect(stats.body.count).toBe(3)
    expect(stats.body.progressPercent).toBe(20)
    expect(Array.isArray(stats.body.categoryBreakdown)).toBe(true)
    expect(stats.body.categoryBreakdown.length).toBe(1) // 都是未分類
  })

  it("GET /api/household/stats 無預算時 progressPercent=0", async () => {
    await request(app)
      .post("/api/household/expenses")
      .send({ amount: 500, date: `${TEST_MONTH}-12`, description: "東西" })
    const stats = await request(app).get(`/api/household/stats?month=${TEST_MONTH}`)
    expect(stats.status).toBe(200)
    expect(stats.body.budgetAmount).toBe(0)
    expect(stats.body.totalSpent).toBe(500)
    expect(stats.body.remaining).toBe(-500)
    expect(stats.body.progressPercent).toBe(0)
  })

  it("GET /api/categories/household 應回家用分類列表", async () => {
    const res = await request(app).get("/api/categories/household")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
