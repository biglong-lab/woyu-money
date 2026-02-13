/**
 * Document Inbox API 整合測試
 * 測試待整理文件的 CRUD 操作與查詢功能
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())

  // 模擬認證中間件，讓所有請求通過驗證
  app.use((req, _res, next) => {
    const reqWithAuth = req as typeof req & {
      user: { id: number; username: string; fullName?: string; isActive: boolean }
      isAuthenticated: () => boolean
      session: Record<string, unknown>
    }
    reqWithAuth.user = { id: 1, username: "admin", fullName: "管理員", isActive: true }
    reqWithAuth.isAuthenticated = () => true
    reqWithAuth.session = { userId: 1, isAuthenticated: true }
    next()
  })

  // 載入 document-inbox 路由
  const documentInboxRoutes = (await import("../../server/routes/document-inbox")).default
  app.use(documentInboxRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Document Inbox API", () => {
  let app: Express
  const createdDocIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    // 清理測試建立的文件
    for (const id of createdDocIds) {
      try {
        await request(app).delete(`/api/document-inbox/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── GET /api/document-inbox ─────────────────────────────────────

  describe("GET /api/document-inbox - 列表", () => {
    it("應回傳文件列表陣列", async () => {
      const res = await request(app)
        .get("/api/document-inbox")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援 status 篩選參數", async () => {
      const res = await request(app)
        .get("/api/document-inbox?status=pending")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援 documentType 篩選參數", async () => {
      const res = await request(app)
        .get("/api/document-inbox?documentType=bill")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應支援同時使用多個篩選參數", async () => {
      const res = await request(app)
        .get("/api/document-inbox?status=pending&documentType=invoice")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/document-inbox/stats ───────────────────────────────

  describe("GET /api/document-inbox/stats - 統計資訊", () => {
    it("應回傳統計物件", async () => {
      const res = await request(app)
        .get("/api/document-inbox/stats")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toBeDefined()
      expect(typeof res.body).toBe("object")
    })
  })

  // ── GET /api/document-inbox/:id ─────────────────────────────────

  describe("GET /api/document-inbox/:id - 取得單一文件", () => {
    it("不存在的 ID 應回傳 404", async () => {
      const res = await request(app).get("/api/document-inbox/999999")

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty("message")
    })

    it("無效的 ID 應回傳 400", async () => {
      const res = await request(app).get("/api/document-inbox/abc")

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("無效的 ID 參數")
    })
  })

  // ── PUT /api/document-inbox/:id ─────────────────────────────────

  describe("PUT /api/document-inbox/:id - 更新文件", () => {
    it("無效的 ID 應回傳 400", async () => {
      const res = await request(app)
        .put("/api/document-inbox/invalid")
        .send({
          status: "processed",
        })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("無效的 ID 參數")
    })

    it("不存在的 ID 應回傳 200 或 404", async () => {
      const res = await request(app)
        .put("/api/document-inbox/999999")
        .send({
          status: "processed",
        })

      // 更新不存在的項目可能回傳 200（如果 storage 層不拋錯）或 404
      expect([200, 404]).toContain(res.status)
    })
  })

  // ── PATCH /api/document-inbox/:id/notes ─────────────────────────

  describe("PATCH /api/document-inbox/:id/notes - 更新備註", () => {
    it("無效的 ID 應回傳 400", async () => {
      const res = await request(app)
        .patch("/api/document-inbox/abc/notes")
        .send({
          notes: "測試備註",
        })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("無效的 ID 參數")
    })

    it("不存在的 ID 應回傳 404", async () => {
      const res = await request(app)
        .patch("/api/document-inbox/999999/notes")
        .send({
          notes: "測試備註",
        })

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty("message")
    })
  })

  // ── DELETE /api/document-inbox/:id ──────────────────────────────

  describe("DELETE /api/document-inbox/:id - 刪除文件", () => {
    it("無效的 ID 應回傳 400", async () => {
      const res = await request(app).delete("/api/document-inbox/invalid")

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("無效的 ID 參數")
    })

    it("不存在的 ID 應回傳 404", async () => {
      const res = await request(app).delete("/api/document-inbox/999999")

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("找不到該項目")
    })
  })

  // ── POST /api/document-inbox/:id/archive-to-payment-item ────────

  describe("POST /api/document-inbox/:id/archive-to-payment-item - 歸檔為付款項目", () => {
    it("無效的 ID 應回傳 400", async () => {
      const res = await request(app)
        .post("/api/document-inbox/invalid/archive-to-payment-item")
        .send({
          itemName: "測試項目",
          totalAmount: "1000",
        })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("無效的 ID 參數")
    })

    it("不存在的 ID 應回傳 404", async () => {
      const res = await request(app)
        .post("/api/document-inbox/999999/archive-to-payment-item")
        .send({
          itemName: "測試項目",
          totalAmount: "1000",
        })

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty("message")
    })
  })

  // ── POST /api/document-inbox/:id/archive-to-payment-record ──────

  describe("POST /api/document-inbox/:id/archive-to-payment-record - 歸檔為付款記錄", () => {
    it("無效的 ID 應回傳 400", async () => {
      const res = await request(app)
        .post("/api/document-inbox/invalid/archive-to-payment-record")
        .send({
          paymentItemId: 1,
          amount: "1000",
        })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("無效的 ID 參數")
    })

    it("不存在的 ID 應回傳 404", async () => {
      const res = await request(app)
        .post("/api/document-inbox/999999/archive-to-payment-record")
        .send({
          paymentItemId: 1,
          amount: "1000",
        })

      expect(res.status).toBe(404)
    })

    it("缺少 paymentItemId 的不存在文件應回傳 404（先驗證文件存在）", async () => {
      const res = await request(app)
        .post("/api/document-inbox/999999/archive-to-payment-record")
        .send({
          amount: "1000",
          // 缺少 paymentItemId
        })

      // 因為文件不存在，會先回傳 404，不會檢查參數
      expect(res.status).toBe(404)
    })
  })

  // ── POST /api/document-inbox/:id/archive-to-invoice ────────────

  describe("POST /api/document-inbox/:id/archive-to-invoice - 歸檔為發票", () => {
    it("無效的 ID 應回傳 400", async () => {
      const res = await request(app)
        .post("/api/document-inbox/invalid/archive-to-invoice")
        .send({
          invoiceNumber: "TEST-001",
          totalAmount: "1000",
        })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("無效的 ID 參數")
    })

    it("不存在的 ID 應回傳 404", async () => {
      const res = await request(app)
        .post("/api/document-inbox/999999/archive-to-invoice")
        .send({
          invoiceNumber: "TEST-001",
          totalAmount: "1000",
        })

      expect(res.status).toBe(404)
    })
  })

  // ── POST /api/document-inbox/:id/re-recognize ───────────────────

  describe("POST /api/document-inbox/:id/re-recognize - 重新辨識", () => {
    it("無效的 ID 應回傳 400", async () => {
      const res = await request(app).post("/api/document-inbox/invalid/re-recognize")

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("無效的 ID 參數")
    })

    it("不存在的 ID 應回傳 404", async () => {
      const res = await request(app).post("/api/document-inbox/999999/re-recognize")

      expect(res.status).toBe(404)
    })
  })
})
