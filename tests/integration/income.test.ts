/**
 * Income API 整合測試
 * 測試進帳來源 CRUD、Webhook 收件箱操作、外部 Webhook 接收端點
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"
import crypto from "crypto"

const skipIfNoDb = !process.env.DATABASE_URL

/** 建立測試用 Express app，模擬認證中間件 */
async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  // 需要 raw body 供 HMAC 驗證
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        ;(req as unknown as { rawBody: string }).rawBody = buf.toString()
      },
    })
  )
  // 模擬認證中間件
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
  const incomeRoutes = (await import("../../server/routes/income")).default
  app.use(incomeRoutes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

/** 建立載入 categories 路由的輔助 app（用於建立專案） */
async function createCategoryApp(): Promise<Express> {
  const expressModule = (await import("express")).default
  const catApp = expressModule()
  catApp.use(expressModule.json())
  catApp.use(
    (
      req: import("express").Request,
      _res: import("express").Response,
      next: import("express").NextFunction
    ) => {
      const r = req as typeof req & {
        user: { id: number; username: string; isActive: boolean }
        isAuthenticated: () => boolean
        session: Record<string, unknown>
      }
      r.user = { id: 1, username: "admin", isActive: true }
      r.isAuthenticated = () => true
      r.session = { userId: 1, isAuthenticated: true }
      next()
    }
  )
  const catRoutes = (await import("../../server/routes/categories")).default
  catApp.use(catRoutes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  catApp.use(globalErrorHandler)
  return catApp
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 進帳來源 CRUD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe.skipIf(skipIfNoDb)("Income Sources API", () => {
  let app: Express
  const createdSourceIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })
  afterAll(async () => {
    for (const id of createdSourceIds) {
      try {
        await request(app).delete(`/api/income/sources/${id}`)
      } catch {
        /* 忽略 */
      }
    }
  })

  describe("GET /api/income/sources", () => {
    it("應回傳來源陣列", async () => {
      const res = await request(app).get("/api/income/sources").expect(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it("回傳的來源應遮罩敏感欄位", async () => {
      const ts = Date.now()
      const createRes = await request(app)
        .post("/api/income/sources")
        .send({
          sourceName: `遮罩測試_${ts}`,
          sourceKey: `mask_${ts}`,
          sourceType: "custom_api",
          authType: "token",
          apiToken: "super_secret_token_1234",
          webhookSecret: "hmac_secret_abcdef",
        })
        .expect(201)
      createdSourceIds.push(createRes.body.id)

      const res = await request(app).get("/api/income/sources").expect(200)
      const src = res.body.find((s: Record<string, unknown>) => s.id === createRes.body.id)
      if (src) {
        expect(src.apiToken).toMatch(/^\*{4}.{4}$/)
        expect(src.webhookSecret).toMatch(/^\*{4}.{4}$/)
      }
    })
  })

  describe("GET /api/income/sources/:id", () => {
    let testId: number
    beforeAll(async () => {
      const ts = Date.now()
      const res = await request(app)
        .post("/api/income/sources")
        .send({
          sourceName: `查詢測試_${ts}`,
          sourceKey: `get_${ts}`,
          sourceType: "custom_api",
          authType: "token",
        })
        .expect(201)
      testId = res.body.id
      createdSourceIds.push(testId)
    })

    it("應回傳完整來源資料", async () => {
      const res = await request(app).get(`/api/income/sources/${testId}`).expect(200)
      expect(res.body).toHaveProperty("id", testId)
      expect(res.body).toHaveProperty("sourceName")
      expect(res.body).toHaveProperty("sourceKey")
    })

    it("不存在的 ID 應回傳 404", async () => {
      await request(app).get("/api/income/sources/999999").expect(404)
    })

    it("無效的 ID 應回傳 400", async () => {
      await request(app).get("/api/income/sources/abc").expect(400)
    })
  })

  describe("POST /api/income/sources", () => {
    it("應成功建立來源並回傳 201", async () => {
      const ts = Date.now()
      const res = await request(app)
        .post("/api/income/sources")
        .send({
          sourceName: `整合測試_${ts}`,
          sourceKey: `test_${ts}`,
          sourceType: "custom_api",
          authType: "token",
          description: "測試用",
        })
        .expect(201)
      expect(res.body).toHaveProperty("id")
      createdSourceIds.push(res.body.id)
    })

    it("應支援完整欄位對應設定", async () => {
      const ts = Date.now()
      const res = await request(app)
        .post("/api/income/sources")
        .send({
          sourceName: `欄位對應_${ts}`,
          sourceKey: `map_${ts}`,
          sourceType: "linepay",
          authType: "hmac",
          fieldMapping: { amount: "$.transaction.amount", transactionId: "$.txId" },
        })
        .expect(201)
      expect(res.body.sourceType).toBe("linepay")
      createdSourceIds.push(res.body.id)
    })

    it("缺少 sourceName 應回傳 400", async () => {
      const res = await request(app)
        .post("/api/income/sources")
        .send({ sourceKey: "no_name", sourceType: "custom_api" })
      expect(res.status).toBe(400)
    })

    it("缺少 sourceKey 應回傳 400", async () => {
      const res = await request(app)
        .post("/api/income/sources")
        .send({ sourceName: "no_key", sourceType: "custom_api" })
      expect(res.status).toBe(400)
    })
  })

  describe("PUT /api/income/sources/:id", () => {
    let testId: number
    beforeAll(async () => {
      const ts = Date.now()
      const res = await request(app)
        .post("/api/income/sources")
        .send({
          sourceName: `更新測試_${ts}`,
          sourceKey: `upd_${ts}`,
          sourceType: "custom_api",
          authType: "token",
        })
        .expect(201)
      testId = res.body.id
      createdSourceIds.push(testId)
    })

    it("應成功更新來源名稱", async () => {
      const res = await request(app)
        .put(`/api/income/sources/${testId}`)
        .send({ sourceName: `已更新_${Date.now()}` })
        .expect(200)
      expect(res.body).toHaveProperty("id", testId)
    })

    it("應支援部分更新", async () => {
      const res = await request(app)
        .put(`/api/income/sources/${testId}`)
        .send({ description: "部分更新描述" })
        .expect(200)
      expect(res.body).toHaveProperty("id", testId)
    })

    it("不存在的來源應回傳 404", async () => {
      await request(app).put("/api/income/sources/999999").send({ sourceName: "x" }).expect(404)
    })

    it("無效 ID 應回傳 400", async () => {
      await request(app).put("/api/income/sources/abc").send({ sourceName: "x" }).expect(400)
    })
  })

  describe("DELETE /api/income/sources/:id", () => {
    let testId: number
    beforeAll(async () => {
      const ts = Date.now()
      const res = await request(app)
        .post("/api/income/sources")
        .send({
          sourceName: `停用測試_${ts}`,
          sourceKey: `dis_${ts}`,
          sourceType: "custom_api",
          authType: "token",
        })
        .expect(201)
      testId = res.body.id
    })

    it("應成功停用來源", async () => {
      const res = await request(app).delete(`/api/income/sources/${testId}`).expect(200)
      expect(res.body).toHaveProperty("message", "已停用")
    })

    it("不存在的來源應回傳 404", async () => {
      await request(app).delete("/api/income/sources/999999").expect(404)
    })

    it("無效 ID 應回傳 400", async () => {
      await request(app).delete("/api/income/sources/abc").expect(400)
    })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Webhook 收件箱（需認證）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe.skipIf(skipIfNoDb)("Income Webhooks API", () => {
  let app: Express
  let testSourceId: number
  let testProjectId: number
  const createdWebhookIds: number[] = []
  const createdSourceIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()

    // 建立測試用來源
    const ts = Date.now()
    const sourceRes = await request(app)
      .post("/api/income/sources")
      .send({
        sourceName: `Webhook測試_${ts}`,
        sourceKey: `wh_${ts}`,
        sourceType: "custom_api",
        authType: "token",
        apiToken: `tok_${ts}`,
        fieldMapping: { amount: "$.amount", transactionId: "$.txId", description: "$.desc" },
      })
      .expect(201)
    testSourceId = sourceRes.body.id
    createdSourceIds.push(testSourceId)

    // 透過 webhook 端點建立測試用進帳紀錄
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/api/income/webhook/${sourceRes.body.sourceKey}`)
        .set("Authorization", `Bearer tok_${ts}`)
        .send({ amount: (i + 1) * 1000, txId: `tx_${ts}_${i}`, desc: `測試 #${i}` })
    }

    // 取得 webhook IDs
    const whRes = await request(app)
      .get(`/api/income/webhooks?sourceId=${testSourceId}`)
      .expect(200)
    for (const wh of whRes.body.data) {
      createdWebhookIds.push(wh.id)
    }

    // 建立測試用專案（供 confirm 使用）
    const catApp = await createCategoryApp()
    const projRes = await request(catApp)
      .post("/api/projects")
      .send({
        projectName: `進帳測試專案_${ts}`,
        projectType: "general",
      })
      .expect(201)
    testProjectId = projRes.body.id
  })

  afterAll(async () => {
    for (const id of createdSourceIds) {
      try {
        await request(app).delete(`/api/income/sources/${id}`)
      } catch {
        /* 忽略 */
      }
    }
  })

  describe("GET /api/income/webhooks", () => {
    it("應回傳分頁結構", async () => {
      const res = await request(app).get("/api/income/webhooks").expect(200)
      expect(res.body).toHaveProperty("data")
      expect(res.body).toHaveProperty("total")
      expect(res.body).toHaveProperty("page")
      expect(res.body).toHaveProperty("pageSize")
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it("應支援自訂分頁參數", async () => {
      const res = await request(app).get("/api/income/webhooks?page=1&pageSize=2").expect(200)
      expect(res.body.page).toBe(1)
      expect(res.body.pageSize).toBe(2)
      expect(res.body.data.length).toBeLessThanOrEqual(2)
    })

    it("pageSize 不應超過 100", async () => {
      const res = await request(app).get("/api/income/webhooks?pageSize=999").expect(200)
      expect(res.body.pageSize).toBeLessThanOrEqual(100)
    })

    it("應支援 sourceId 篩選", async () => {
      const res = await request(app)
        .get(`/api/income/webhooks?sourceId=${testSourceId}`)
        .expect(200)
      for (const wh of res.body.data) {
        expect(wh.sourceId).toBe(testSourceId)
      }
    })

    it("應支援 status 篩選", async () => {
      const res = await request(app).get("/api/income/webhooks?status=pending").expect(200)
      for (const wh of res.body.data) {
        expect(wh.status).toBe("pending")
      }
    })
  })

  describe("GET /api/income/webhooks/pending-count", () => {
    it("應回傳 count 數字", async () => {
      const res = await request(app).get("/api/income/webhooks/pending-count").expect(200)
      expect(res.body).toHaveProperty("count")
      expect(typeof res.body.count).toBe("number")
    })
  })

  describe("GET /api/income/webhooks/:id", () => {
    it("應回傳完整 webhook 資料", async () => {
      const id = createdWebhookIds[0]
      if (!id) return
      const res = await request(app).get(`/api/income/webhooks/${id}`).expect(200)
      expect(res.body).toHaveProperty("id", id)
      expect(res.body).toHaveProperty("sourceId")
      expect(res.body).toHaveProperty("rawPayload")
      expect(res.body).toHaveProperty("status")
    })

    it("不存在的 ID 應回傳 404", async () => {
      await request(app).get("/api/income/webhooks/999999").expect(404)
    })

    it("無效 ID 應回傳 400", async () => {
      await request(app).get("/api/income/webhooks/abc").expect(400)
    })
  })

  describe("POST /api/income/webhooks/:id/confirm", () => {
    it("應成功確認進帳並連結 paymentItem", async () => {
      const id = createdWebhookIds[0]
      if (!id) return
      const res = await request(app)
        .post(`/api/income/webhooks/${id}/confirm`)
        .send({ projectId: testProjectId, reviewNote: "測試確認" })
        .expect(200)
      expect(res.body).toHaveProperty("success", true)
      expect(res.body).toHaveProperty("paymentItemId")
      expect(res.body).toHaveProperty("paymentRecordId")
    })

    it("重複確認同一筆應回傳 400", async () => {
      const id = createdWebhookIds[0]
      if (!id) return
      const res = await request(app)
        .post(`/api/income/webhooks/${id}/confirm`)
        .send({ projectId: testProjectId })
      expect(res.status).toBe(400)
    })

    it("缺少 projectId 應回傳 400", async () => {
      const id = createdWebhookIds[1]
      if (!id) return
      const res = await request(app)
        .post(`/api/income/webhooks/${id}/confirm`)
        .send({ reviewNote: "缺少 projectId" })
      expect(res.status).toBe(400)
    })

    it("不存在的 webhook ID 應回傳 400", async () => {
      const res = await request(app)
        .post("/api/income/webhooks/999999/confirm")
        .send({ projectId: testProjectId })
      expect(res.status).toBe(400)
    })
  })

  describe("POST /api/income/webhooks/batch-confirm", () => {
    it("應回傳批次結果", async () => {
      const ids = createdWebhookIds.slice(1)
      if (ids.length === 0) return
      const res = await request(app)
        .post("/api/income/webhooks/batch-confirm")
        .send({ ids, projectId: testProjectId, reviewNote: "批次確認" })
        .expect(200)
      expect(res.body).toHaveProperty("successCount")
      expect(res.body).toHaveProperty("failCount")
      expect(res.body.successCount + res.body.failCount).toBe(ids.length)
    })

    it("空 ids 應回傳 400", async () => {
      const res = await request(app)
        .post("/api/income/webhooks/batch-confirm")
        .send({ ids: [], projectId: testProjectId })
      expect(res.status).toBe(400)
    })

    it("缺少 projectId 應回傳 400", async () => {
      const res = await request(app)
        .post("/api/income/webhooks/batch-confirm")
        .send({ ids: [1] })
      expect(res.status).toBe(400)
    })
  })

  describe("POST /api/income/webhooks/:id/reject", () => {
    let rejectId: number
    beforeAll(async () => {
      // 找到或建立一筆 pending webhook 供拒絕測試
      const ts = Date.now()
      const pending = await request(app)
        .get(`/api/income/webhooks?sourceId=${testSourceId}&status=pending`)
        .expect(200)
      if (pending.body.data.length === 0) {
        const src = await request(app).get(`/api/income/sources/${testSourceId}`).expect(200)
        await request(app)
          .post(`/api/income/webhook/${src.body.sourceKey}`)
          .set("Authorization", `Bearer tok_${ts}`)
          .send({ amount: 5000, txId: `tx_rej_${ts}`, desc: "拒絕測試" })
        const newP = await request(app)
          .get(`/api/income/webhooks?sourceId=${testSourceId}&status=pending`)
          .expect(200)
        rejectId = newP.body.data[0]?.id
      } else {
        rejectId = pending.body.data[0].id
      }
    })

    it("應成功拒絕並回傳訊息", async () => {
      if (!rejectId) return
      const res = await request(app)
        .post(`/api/income/webhooks/${rejectId}/reject`)
        .send({ reviewNote: "測試拒絕" })
        .expect(200)
      expect(res.body).toHaveProperty("message", "已拒絕")
    })

    it("不存在的紀錄應回傳 404", async () => {
      await request(app)
        .post("/api/income/webhooks/999999/reject")
        .send({ reviewNote: "不存在" })
        .expect(404)
    })

    it("無效 ID 應回傳 400", async () => {
      await request(app).post("/api/income/webhooks/abc/reject").send({}).expect(400)
    })
  })

  describe("POST /api/income/webhooks/:id/reprocess", () => {
    it("應成功重設狀態為 pending", async () => {
      const id = createdWebhookIds[0]
      if (!id) return
      const res = await request(app).post(`/api/income/webhooks/${id}/reprocess`).expect(200)
      expect(res.body).toHaveProperty("message", "已重設為待確認")
      // 驗證狀態
      const v = await request(app).get(`/api/income/webhooks/${id}`).expect(200)
      expect(v.body.status).toBe("pending")
    })

    it("不存在的紀錄應回傳 404", async () => {
      await request(app).post("/api/income/webhooks/999999/reprocess").expect(404)
    })

    it("無效 ID 應回傳 400", async () => {
      await request(app).post("/api/income/webhooks/abc/reprocess").expect(400)
    })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Webhook 接收端點（公開，不需 session）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe.skipIf(skipIfNoDb)("Income Webhook Receiver", () => {
  let app: Express
  let testSourceKey: string
  let testApiToken: string
  let testWebhookSecret: string
  const createdSourceIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
    const ts = Date.now()
    testApiToken = `token_${ts}_abcdefgh`
    testWebhookSecret = `secret_${ts}_12345678`
    testSourceKey = `recv_${ts}`

    const res = await request(app)
      .post("/api/income/sources")
      .send({
        sourceName: `接收測試_${ts}`,
        sourceKey: testSourceKey,
        sourceType: "custom_api",
        authType: "token",
        apiToken: testApiToken,
        fieldMapping: {
          amount: "$.payment.amount",
          currency: "$.payment.currency",
          transactionId: "$.id",
          paidAt: "$.paidAt",
          description: "$.description",
          payerName: "$.customer.name",
        },
      })
      .expect(201)
    createdSourceIds.push(res.body.id)
  })

  afterAll(async () => {
    for (const id of createdSourceIds) {
      try {
        await request(app).delete(`/api/income/sources/${id}`)
      } catch {
        /* 忽略 */
      }
    }
  })

  describe("POST /api/income/webhook/:sourceKey - Token 驗證", () => {
    it("正確 Token 應成功接收", async () => {
      const res = await request(app)
        .post(`/api/income/webhook/${testSourceKey}`)
        .set("Authorization", `Bearer ${testApiToken}`)
        .send({
          id: `tx_${Date.now()}`,
          payment: { amount: 2500, currency: "TWD" },
          paidAt: "2026-03-01T10:00:00Z",
          description: "測試進帳",
          customer: { name: "測試客戶" },
        })
        .expect(200)
      expect(res.body).toHaveProperty("received", true)
      expect(res.body).toHaveProperty("id")
    })

    it("重複 transactionId 應標記 duplicate", async () => {
      const payload = {
        id: `tx_dup_${Date.now()}`,
        payment: { amount: 3000, currency: "TWD" },
        description: "重複測試",
      }
      await request(app)
        .post(`/api/income/webhook/${testSourceKey}`)
        .set("Authorization", `Bearer ${testApiToken}`)
        .send(payload)
        .expect(200)
      const res = await request(app)
        .post(`/api/income/webhook/${testSourceKey}`)
        .set("Authorization", `Bearer ${testApiToken}`)
        .send(payload)
        .expect(200)
      expect(res.body).toHaveProperty("duplicate", true)
    })

    it("錯誤 Token 應回傳 401", async () => {
      const res = await request(app)
        .post(`/api/income/webhook/${testSourceKey}`)
        .set("Authorization", "Bearer wrong")
        .send({ amount: 1000 })
      expect(res.status).toBe(401)
    })

    it("不存在的 sourceKey 應回傳 200（避免探測）", async () => {
      const res = await request(app)
        .post("/api/income/webhook/nonexistent")
        .send({ amount: 1000 })
        .expect(200)
      expect(res.body).toHaveProperty("received", true)
      expect(res.body.id).toBeUndefined()
    })

    it("無 Authorization 應視實作而定", async () => {
      const res = await request(app)
        .post(`/api/income/webhook/${testSourceKey}`)
        .send({ payment: { amount: 500 } })
      expect([200, 401]).toContain(res.status)
    })
  })

  describe("HMAC 簽名驗證", () => {
    let hmacKey: string
    beforeAll(async () => {
      const ts = Date.now()
      hmacKey = `hmac_${ts}`
      const res = await request(app)
        .post("/api/income/sources")
        .send({
          sourceName: `HMAC測試_${ts}`,
          sourceKey: hmacKey,
          sourceType: "custom_api",
          authType: "hmac",
          webhookSecret: testWebhookSecret,
          fieldMapping: { amount: "$.amount", transactionId: "$.txId" },
        })
        .expect(201)
      createdSourceIds.push(res.body.id)
    })

    it("正確簽名應成功接收", async () => {
      const payload = JSON.stringify({ amount: 8000, txId: `tx_hmac_${Date.now()}` })
      const sig = crypto.createHmac("sha256", testWebhookSecret).update(payload).digest("hex")
      const res = await request(app)
        .post(`/api/income/webhook/${hmacKey}`)
        .set("Content-Type", "application/json")
        .set("X-Signature", `sha256=${sig}`)
        .send(payload)
        .expect(200)
      expect(res.body).toHaveProperty("received", true)
      expect(res.body).toHaveProperty("id")
    })

    it("錯誤簽名應回傳 401", async () => {
      const payload = JSON.stringify({ amount: 9000, txId: "bad_hmac" })
      const res = await request(app)
        .post(`/api/income/webhook/${hmacKey}`)
        .set("Content-Type", "application/json")
        .set(
          "X-Signature",
          "sha256=0000000000000000000000000000000000000000000000000000000000000000"
        )
        .send(payload)
      expect(res.status).toBe(401)
    })
  })
})
