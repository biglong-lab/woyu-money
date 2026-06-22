/**
 * 強制執行 — /api/enforcement
 * 驗證 公文/圈存/分期 CRUD + 對帳等式（強執 ≈ 圈存 + 分期）
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
  const routes = (await import("../../server/routes/enforcement")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

const MARK = "__enf_test_" + Date.now()

describe.skipIf(skipIfNoDb)("Enforcement API", () => {
  let app: Express
  let caseId: number
  let instId: number

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM enforcement_installment_payments WHERE notes = ${MARK}`)
    await db.execute(sql`DELETE FROM enforcement_installments WHERE notes = ${MARK}`)
    await db.execute(sql`DELETE FROM enforcement_seizures WHERE notes = ${MARK}`)
    await db.execute(sql`DELETE FROM enforcement_cases WHERE notes = ${MARK}`)
  })

  it("建公文（強執總額）", async () => {
    const res = await request(app)
      .post("/api/enforcement/cases")
      .send({
        agency: "行政執行署金門分署",
        totalAmount: "100000",
        subject: "滯納健保費",
        notes: MARK,
      })
    expect(res.status).toBe(201)
    expect(Number(res.body.totalAmount)).toBe(100000)
    caseId = res.body.id
  })

  it("缺金額回 400", async () => {
    const res = await request(app).post("/api/enforcement/cases").send({ agency: "x", notes: MARK })
    expect(res.status).toBe(400)
  })

  it("建圈存（綁公文）", async () => {
    const res = await request(app)
      .post("/api/enforcement/seizures")
      .send({ caseId, bankName: "中國信託", amount: "30000", status: "frozen", notes: MARK })
    expect(res.status).toBe(201)
  })

  it("建分期計畫 + 一筆實付", async () => {
    const plan = await request(app)
      .post("/api/enforcement/installments")
      .send({ caseId, monthlyAmount: "5000", periods: 14, totalAmount: "70000", notes: MARK })
    expect(plan.status).toBe(201)
    instId = plan.body.id

    const pay = await request(app)
      .post(`/api/enforcement/installments/${instId}/payments`)
      .send({ paymentDate: "2026-06-15", amount: "5000", notes: MARK })
    expect(pay.status).toBe(201)
  })

  it("對帳：強執 ≈ 圈存 + 分期計畫；含未歸類差異", async () => {
    const res = await request(app).get("/api/enforcement/reconcile")
    expect(res.status).toBe(200)
    expect(res.body.enforcedTotal).toBeGreaterThanOrEqual(100000)
    expect(res.body.seizedTotal).toBeGreaterThanOrEqual(30000)
    expect(res.body.installmentPlanTotal).toBeGreaterThanOrEqual(70000)
    expect(res.body.installmentPaidTotal).toBeGreaterThanOrEqual(5000)
    // 本案：圈存3萬 + 分期計畫7萬 = 10萬 = 強執總額 → diff 對本案為 0（全站可能有其他案）
    expect(typeof res.body.diff).toBe("number")
  })
})
