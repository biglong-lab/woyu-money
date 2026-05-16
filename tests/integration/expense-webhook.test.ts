/**
 * Expense Webhook API 整合測試
 * 測試支出來源 CRUD、Webhook 接收、HMAC/Token 驗證、idempotency
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"
import crypto from "crypto"

const skipIfNoDb = !process.env.DATABASE_URL

async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        ;(req as unknown as { rawBody: string }).rawBody = buf.toString()
      },
    })
  )
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
  const expenseRoutes = (await import("../../server/routes/expense")).default
  app.use(expenseRoutes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Expense Sources API", () => {
  let app: Express
  const createdSourceIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })
  afterAll(async () => {
    for (const id of createdSourceIds) {
      try {
        await request(app).delete(`/api/expense/sources/${id}`)
      } catch {
        /* 忽略 */
      }
    }
  })

  describe("POST /api/expense/sources", () => {
    it("應成功建立支出來源並回傳遮罩後資料", async () => {
      const ts = Date.now()
      const res = await request(app)
        .post("/api/expense/sources")
        .send({
          sourceName: `測試支出來源_${ts}`,
          sourceKey: `test_exp_${ts}`,
          sourceType: "custom_api",
          authType: "token",
          apiToken: "secret_token_12345678",
          webhookMode: "as_pending",
        })
        .expect(201)

      expect(res.body).toHaveProperty("id")
      expect(res.body.apiToken).toMatch(/^\*{4}.{4}$/)
      createdSourceIds.push(res.body.id)
    })
  })

  describe("GET /api/expense/sources", () => {
    it("應回傳所有支出來源陣列", async () => {
      const res = await request(app).get("/api/expense/sources").expect(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe("POST /api/expense/webhook/:sourceKey — Token 驗證", () => {
    let sourceKey: string
    let sourceId: number
    const token = "valid_test_token_xyz"

    beforeAll(async () => {
      const ts = Date.now()
      const res = await request(app)
        .post("/api/expense/sources")
        .send({
          sourceName: `Webhook 測試_${ts}`,
          sourceKey: `wh_${ts}`,
          sourceType: "custom_api",
          authType: "token",
          apiToken: token,
          webhookMode: "as_pending",
          fieldMapping: {
            amount: "$.amount",
            transactionId: "$.tx_id",
            vendor: "$.vendor",
          },
        })
        .expect(201)
      sourceId = res.body.id
      sourceKey = `wh_${ts}`
      createdSourceIds.push(sourceId)
    })

    it("正確 token 應成功接收", async () => {
      const res = await request(app)
        .post(`/api/expense/webhook/${sourceKey}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 1500, tx_id: `tx_${Date.now()}_a`, vendor: "中華電信" })
        .expect(200)

      expect(res.body.received).toBe(true)
      expect(res.body).toHaveProperty("id")
    })

    it("錯誤 token 應回 401", async () => {
      await request(app)
        .post(`/api/expense/webhook/${sourceKey}`)
        .set("Authorization", "Bearer wrong_token")
        .send({ amount: 100, tx_id: "tx_wrong" })
        .expect(401)
    })

    it("未知 sourceKey 應回 200（避免探測）", async () => {
      const res = await request(app)
        .post("/api/expense/webhook/non_existent_source_xyz")
        .send({ amount: 100 })
        .expect(200)
      expect(res.body.received).toBe(true)
    })

    it("相同 transactionId 第二次推送應標記為 duplicate", async () => {
      const txId = `dup_tx_${Date.now()}`
      // 第一次
      await request(app)
        .post(`/api/expense/webhook/${sourceKey}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 500, tx_id: txId, vendor: "測試" })
        .expect(200)

      // 第二次（同 tx_id）
      const res2 = await request(app)
        .post(`/api/expense/webhook/${sourceKey}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 500, tx_id: txId, vendor: "測試" })
        .expect(200)

      expect(res2.body.duplicate).toBe(true)
    })
  })

  describe("POST /api/expense/webhook/:sourceKey — HMAC 驗證", () => {
    let sourceKey: string
    let sourceId: number
    const secret = "hmac_test_secret_abcdef"

    beforeAll(async () => {
      const ts = Date.now()
      const res = await request(app)
        .post("/api/expense/sources")
        .send({
          sourceName: `HMAC 測試_${ts}`,
          sourceKey: `hmac_${ts}`,
          sourceType: "custom_api",
          authType: "hmac",
          webhookSecret: secret,
          webhookMode: "as_pending",
          fieldMapping: { amount: "$.amount", transactionId: "$.id" },
        })
        .expect(201)
      sourceId = res.body.id
      sourceKey = `hmac_${ts}`
      createdSourceIds.push(sourceId)
    })

    it("正確簽章應成功接收", async () => {
      const body = { amount: 2000, id: `h_${Date.now()}` }
      const rawBody = JSON.stringify(body)
      const sig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")

      const res = await request(app)
        .post(`/api/expense/webhook/${sourceKey}`)
        .set("Content-Type", "application/json")
        .set("X-Signature", `sha256=${sig}`)
        .send(body)
        .expect(200)

      expect(res.body.received).toBe(true)
    })

    it("錯誤簽章應回 401", async () => {
      await request(app)
        .post(`/api/expense/webhook/${sourceKey}`)
        .set("X-Signature", "sha256=wrong_signature_here")
        .send({ amount: 100 })
        .expect(401)
    })
  })

  describe("GET /api/expense/webhooks", () => {
    it("應回傳分頁資料", async () => {
      const res = await request(app).get("/api/expense/webhooks").expect(200)
      expect(res.body).toHaveProperty("data")
      expect(res.body).toHaveProperty("total")
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })
})
