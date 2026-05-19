/**
 * Dashboard 模板占位歸 planned（B 方案驗證）
 *
 * 規則：source='template_scheduled' AND status='unpaid' 一律歸 planned、不管 start_date 是否到日
 * → 取代為 paid（透過 /recurring-expenses 介面）才會變 actual
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest"
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
  const routes = (await import("../../server/routes/dashboard")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Dashboard — template_scheduled 占位歸 planned", () => {
  let app: Express
  // 用「過去的測試月份」（已到日、但仍歸 planned 表示邏輯生效）
  // 找一個今年已過的月份（取本月、用今天日期 - 1 月確保已過）
  const now = new Date()
  const testY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const testM = now.getMonth() === 0 ? 12 : now.getMonth() // 上個月
  const testMonth = `${testY}-${String(testM).padStart(2, "0")}`
  const testDate = `${testMonth}-15`
  let scheduledId: number
  let manualId: number

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterEach(async () => {
    if (scheduledId) {
      await db.execute(sql`DELETE FROM payment_items WHERE id = ${scheduledId}`)
    }
    if (manualId) {
      await db.execute(sql`DELETE FROM payment_items WHERE id = ${manualId}`)
    }
  })

  async function setup() {
    // 1. template_scheduled 占位（unpaid、已過日期）
    const sch = (
      await db.execute(sql`
        INSERT INTO payment_items
          (item_name, total_amount, item_type, payment_type, start_date,
           status, paid_amount, source, created_at, updated_at)
        VALUES ('測試模板占位', 5000, 'project', 'single', ${testDate}::date,
                'unpaid', 0, 'template_scheduled', NOW(), NOW())
        RETURNING id
      `)
    ).rows as unknown as { id: number }[]
    scheduledId = sch[0].id

    // 2. 一般手動項目（manual、已過日期）— 對照組
    const man = (
      await db.execute(sql`
        INSERT INTO payment_items
          (item_name, total_amount, item_type, payment_type, start_date,
           status, paid_amount, source, created_at, updated_at)
        VALUES ('測試一般支出', 3000, 'project', 'single', ${testDate}::date,
                'unpaid', 0, 'manual', NOW(), NOW())
        RETURNING id
      `)
    ).rows as unknown as { id: number }[]
    manualId = man[0].id
  }

  it("template_scheduled+unpaid 即使日期已過、仍歸 planned 不算 actual", async () => {
    await setup()
    const res = await request(app).get("/api/dashboard/ytd")
    expect(res.status).toBe(200)
    const monthRow = res.body.months.find((m: { month: string }) => m.month === testMonth)
    expect(monthRow).toBeTruthy()
    // 一般支出 $3000 進 actual、模板占位 $5000 進 planned
    expect(monthRow.expenseActual).toBeGreaterThanOrEqual(3000)
    expect(monthRow.expensePlanned).toBeGreaterThanOrEqual(5000)
  })

  it("template_scheduled+paid 算 actual（已實際支付）", async () => {
    await setup()
    // 把模板占位標 paid
    await db.execute(sql`UPDATE payment_items SET status='paid' WHERE id = ${scheduledId}`)

    const res = await request(app).get("/api/dashboard/ytd")
    const monthRow = res.body.months.find((m: { month: string }) => m.month === testMonth)
    expect(monthRow).toBeTruthy()
    // 兩筆都進 actual = 3000 + 5000 = 至少 8000
    expect(monthRow.expenseActual).toBeGreaterThanOrEqual(8000)
  })

  it("breakdown 也跟隨：template_scheduled+unpaid 在分類列 planned > 0", async () => {
    await setup()
    const res = await request(app).get("/api/dashboard/ytd")
    const bd = res.body.breakdown?.[testMonth]
    expect(bd).toBeTruthy()
    // 模板占位 + 一般支出 都歸（未分類）
    const unclassified = bd.expense.find((e: { category: string }) => e.category === "(未分類)")
    expect(unclassified).toBeTruthy()
    // 模板那 $5000 歸 planned、一般 $3000 歸 actual
    expect(unclassified.planned).toBeGreaterThanOrEqual(5000)
    expect(unclassified.actual).toBeGreaterThanOrEqual(3000)
  })
})
