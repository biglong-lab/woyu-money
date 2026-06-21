/**
 * 開銷流水帳 — /api/expense-ledger
 * 驗證：只填金額即可記、列表/篩選、彙總、分帳自動標 classified、刪除
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
  const routes = (await import("../../server/routes/expense-ledger")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

const NOTE = "__ledger_test_" + Date.now()

describe.skipIf(skipIfNoDb)("Expense Ledger API", () => {
  let app: Express
  const createdIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    if (createdIds.length > 0) {
      await db.execute(sql`DELETE FROM expense_ledger WHERE id = ANY(${createdIds})`)
    }
    await db.execute(sql`DELETE FROM expense_ledger WHERE note LIKE '__ledger_test_%'`)
  })

  it("只填金額即可記一筆（status 預設 unclassified）", async () => {
    const today = new Date().toISOString().slice(0, 10)
    const res = await request(app)
      .post("/api/expense-ledger")
      .send({ amount: "150", entryDate: today, note: NOTE })
    expect(res.status).toBe(200)
    expect(res.body.id).toBeGreaterThan(0)
    expect(res.body.status).toBe("unclassified")
    expect(Number(res.body.amount)).toBe(150)
    createdIds.push(res.body.id)
  })

  it("缺金額時驗證失敗（400）", async () => {
    const today = new Date().toISOString().slice(0, 10)
    const res = await request(app).post("/api/expense-ledger").send({ entryDate: today })
    expect(res.status).toBe(400)
  })

  it("列表可依 status 篩選", async () => {
    const res = await request(app).get("/api/expense-ledger?status=unclassified")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.some((e: { id: number }) => e.id === createdIds[0])).toBe(true)
  })

  it("彙總含 unclassifiedCount/Amount", async () => {
    const res = await request(app).get("/api/expense-ledger/summary?status=unclassified")
    expect(res.status).toBe(200)
    expect(res.body.unclassifiedCount).toBeGreaterThanOrEqual(1)
    expect(Number(res.body.unclassifiedAmount)).toBeGreaterThanOrEqual(150)
  })

  it("分帳：填 categoryId 後自動標 classified", async () => {
    // 取一個現有分類 id（若無則用 1）
    const cat = await db.execute(sql`SELECT id FROM debt_categories LIMIT 1`)
    const catId = (cat as unknown as { rows: Array<{ id: number }> }).rows[0]?.id ?? 1
    const res = await request(app)
      .put(`/api/expense-ledger/${createdIds[0]}`)
      .send({ categoryId: catId })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe("classified")
    expect(res.body.categoryId).toBe(catId)
  })

  it("刪除後列表不再出現", async () => {
    const del = await request(app).delete(`/api/expense-ledger/${createdIds[0]}`)
    expect(del.status).toBe(200)
    const list = await request(app).get("/api/expense-ledger?status=all")
    expect(list.body.some((e: { id: number }) => e.id === createdIds[0])).toBe(false)
    createdIds.length = 0
  })
})
