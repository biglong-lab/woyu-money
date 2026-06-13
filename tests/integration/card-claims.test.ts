/**
 * 信用卡請款紀錄 — /api/card-claims
 * 驗證 CRUD、區間/狀態篩選、區間統計、標籤/館別管理
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
  const routes = (await import("../../server/routes/card-claims")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

const TAG_NAME = "__test_tag_" + Date.now()
const PROP_NAME = "__test_prop_" + Date.now()

describe.skipIf(skipIfNoDb)("Card Claims API", () => {
  let app: Express
  let tagId: number
  let propId: number
  const claimIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
    const tag = await request(app).post("/api/card-claims/tags").send({ name: TAG_NAME })
    tagId = tag.body.id
    const prop = await request(app).post("/api/card-claims/properties").send({ name: PROP_NAME })
    propId = prop.body.id
  })

  afterAll(async () => {
    if (claimIds.length) {
      await db.execute(
        sql`DELETE FROM card_claims WHERE id IN (${sql.join(
          claimIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    }
    await db.execute(sql`DELETE FROM card_claim_tags WHERE name = ${TAG_NAME}`)
    await db.execute(sql`DELETE FROM card_claim_properties WHERE name = ${PROP_NAME}`)
  })

  it("新增請款紀錄", async () => {
    const res = await request(app).post("/api/card-claims").send({
      amount: "12500.50",
      swipeDate: "2099-06-10",
      bank: "玉山",
      tagId,
      propertyId: propId,
      status: "pending",
      notes: "測試請款",
    })
    expect(res.status).toBe(200)
    expect(res.body.id).toBeDefined()
    expect(res.body.amount).toBe("12500.50")
    claimIds.push(res.body.id)
  })

  it("列表帶出標籤/館別名稱（join）", async () => {
    const res = await request(app).get("/api/card-claims?startDate=2099-06-01&endDate=2099-06-30")
    expect(res.status).toBe(200)
    const row = res.body.find((c: { id: number }) => c.id === claimIds[0])
    expect(row).toBeDefined()
    expect(row.tagName).toBe(TAG_NAME)
    expect(row.propertyName).toBe(PROP_NAME)
  })

  it("區間統計彙總正確", async () => {
    const res = await request(app).get(
      "/api/card-claims/summary?startDate=2099-06-01&endDate=2099-06-30"
    )
    expect(res.status).toBe(200)
    expect(res.body.totalAmount).toBeGreaterThanOrEqual(12500.5)
    expect(res.body.byMonth.some((m: { month: string }) => m.month === "2099-06")).toBe(true)
  })

  it("狀態篩選只回該狀態", async () => {
    const res = await request(app).get(
      "/api/card-claims?startDate=2099-06-01&endDate=2099-06-30&status=settled"
    )
    expect(res.status).toBe(200)
    expect(res.body.every((c: { status: string }) => c.status === "settled")).toBe(true)
  })

  it("更新狀態", async () => {
    const res = await request(app)
      .patch(`/api/card-claims/${claimIds[0]}`)
      .send({ status: "settled" })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe("settled")
  })

  it("金額非數字應 400", async () => {
    const res = await request(app).post("/api/card-claims").send({
      amount: "abc",
      swipeDate: "2099-06-10",
    })
    expect(res.status).toBe(400)
  })

  it("刪除紀錄", async () => {
    const res = await request(app).delete(`/api/card-claims/${claimIds[0]}`)
    expect(res.status).toBe(200)
    claimIds.pop()
  })
})
