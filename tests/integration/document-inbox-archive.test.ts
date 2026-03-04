/**
 * Document Inbox API 整合測試 - 歸檔操作
 * 測試歸檔為付款項目、付款記錄、發票記錄的完整流程與驗證
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

/** 透過 storage 層直接建立測試文件（繞過上傳/AI 流程） */
async function createTestDocument(overrides: Record<string, unknown> = {}) {
  const { createDocumentInboxItem } = await import("../../server/storage/document-inbox")
  return createDocumentInboxItem({
    userId: 1,
    documentType: "bill",
    status: "pending",
    imagePath: "/uploads/inbox/test-file.jpg",
    originalFilename: "test-file.jpg",
    notes: null,
    uploadedByUsername: "管理員",
    ...overrides,
  })
}

/** 透過 storage 層直接刪除文件（用於 afterAll 清理） */
async function deleteTestDocument(id: number) {
  const { deleteDocumentInboxItem } = await import("../../server/storage/document-inbox")
  await deleteDocumentInboxItem(id)
}

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

describe.skipIf(skipIfNoDb)("Document Inbox API - 歸檔操作", () => {
  let app: Express
  const createdDocIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    // 清理測試建立的文件（透過 storage 層直接刪除）
    for (const id of createdDocIds) {
      try {
        await deleteTestDocument(id)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── 歸檔為付款項目 - 正向流程 ──────────────────────────────────────

  describe("POST archive-to-payment-item - 歸檔正向流程", () => {
    it("應成功將文件歸檔為付款項目", async () => {
      const doc = await createTestDocument({
        documentType: "bill",
        notes: "待歸檔測試",
      })
      createdDocIds.push(doc.id)

      const res = await request(app)
        .post(`/api/document-inbox/${doc.id}/archive-to-payment-item`)
        .send({
          itemName: "測試歸檔付款項目",
          totalAmount: "15000",
        })
        .expect(200)

      expect(res.body).toHaveProperty("message", "已成功轉為付款項目")
      expect(res.body).toHaveProperty("paymentItem")
      expect(res.body.paymentItem).toHaveProperty("id")
      expect(res.body.paymentItem.itemName).toBe("測試歸檔付款項目")
      expect(res.body.paymentItem.totalAmount).toBe("15000.00")
      expect(res.body.paymentItem.source).toBe("ai_scan")

      // 歸檔後文件狀態應為 archived
      const docAfter = await request(app).get(`/api/document-inbox/${doc.id}`).expect(200)

      expect(docAfter.body.status).toBe("archived")
      expect(docAfter.body.archivedToType).toBe("payment_item")
      expect(docAfter.body.archivedToId).toBe(res.body.paymentItem.id)
    })

    it("帶完整參數歸檔應全部正確儲存", async () => {
      const doc = await createTestDocument({ documentType: "bill" })
      createdDocIds.push(doc.id)

      const res = await request(app)
        .post(`/api/document-inbox/${doc.id}/archive-to-payment-item`)
        .send({
          itemName: "完整參數歸檔",
          totalAmount: "8000",
          dueDate: "2026-06-30",
          notes: "自訂歸檔備註",
        })
        .expect(200)

      expect(res.body.paymentItem.itemName).toBe("完整參數歸檔")
      expect(res.body.paymentItem.totalAmount).toBe("8000.00")
      // notes 應包含追蹤資訊
      expect(res.body.paymentItem.notes).toContain("單據追蹤")
    })
  })

  // ── 歸檔為付款記錄 - 正向流程與驗證 ─────────────────────────────────

  describe("POST archive-to-payment-record - 歸檔正向流程與驗證", () => {
    it("存在的文件但缺少 paymentItemId 應回傳 400", async () => {
      const doc = await createTestDocument({ documentType: "payment" })
      createdDocIds.push(doc.id)

      const res = await request(app)
        .post(`/api/document-inbox/${doc.id}/archive-to-payment-record`)
        .send({
          amount: "5000",
          // 故意不傳 paymentItemId
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("請選擇要關聯的付款項目")
    })

    it("應成功將文件歸檔為付款記錄（需先建立付款項目）", async () => {
      // 先建立一個文件並歸檔為付款項目，取得 paymentItemId
      const billDoc = await createTestDocument({ documentType: "bill" })
      createdDocIds.push(billDoc.id)

      const archiveRes = await request(app)
        .post(`/api/document-inbox/${billDoc.id}/archive-to-payment-item`)
        .send({
          itemName: "準備關聯的付款項目",
          totalAmount: "20000",
        })
        .expect(200)

      const paymentItemId = archiveRes.body.paymentItem.id

      // 建立付款憑證文件
      const paymentDoc = await createTestDocument({ documentType: "payment" })
      createdDocIds.push(paymentDoc.id)

      const res = await request(app)
        .post(`/api/document-inbox/${paymentDoc.id}/archive-to-payment-record`)
        .send({
          paymentItemId,
          amount: "5000",
          paymentDate: "2026-03-01",
          paymentMethod: "transfer",
        })
        .expect(200)

      expect(res.body).toHaveProperty("message", "已成功轉為付款記錄")
      expect(res.body).toHaveProperty("paymentRecord")
      expect(res.body.paymentRecord).toHaveProperty("id")
      expect(res.body.paymentRecord.amountPaid).toBe("5000.00")
      expect(res.body.paymentRecord.paymentMethod).toBe("transfer")

      // 歸檔後文件狀態應為 archived
      const docAfter = await request(app).get(`/api/document-inbox/${paymentDoc.id}`).expect(200)

      expect(docAfter.body.status).toBe("archived")
      expect(docAfter.body.archivedToType).toBe("payment_record")
    })
  })

  // ── 歸檔為發票記錄 - 正向流程 ──────────────────────────────────────

  describe("POST archive-to-invoice - 歸檔正向流程", () => {
    it("應成功將文件歸檔為發票記錄", async () => {
      const doc = await createTestDocument({ documentType: "invoice" })
      createdDocIds.push(doc.id)

      const res = await request(app)
        .post(`/api/document-inbox/${doc.id}/archive-to-invoice`)
        .send({
          invoiceNumber: "TEST-INV-001",
          invoiceDate: "2026-03-01",
          vendorName: "測試供應商有限公司",
          vendorTaxId: "12345678",
          totalAmount: "10500",
          taxAmount: "500",
          subtotal: "10000",
          category: "辦公用品",
          description: "辦公用品採購",
          invoiceType: "expense",
        })
        .expect(200)

      expect(res.body).toHaveProperty("message", "已成功轉為發票記錄")
      expect(res.body).toHaveProperty("invoiceRecord")
      expect(res.body.invoiceRecord).toHaveProperty("id")
      expect(res.body.invoiceRecord.invoiceNumber).toBe("TEST-INV-001")
      expect(res.body.invoiceRecord.vendorName).toBe("測試供應商有限公司")
      expect(res.body.invoiceRecord.totalAmount).toBe("10500.00")

      // 歸檔後文件狀態應為 archived
      const docAfter = await request(app).get(`/api/document-inbox/${doc.id}`).expect(200)

      expect(docAfter.body.status).toBe("archived")
      expect(docAfter.body.archivedToType).toBe("invoice_record")
      expect(docAfter.body.archivedToId).toBe(res.body.invoiceRecord.id)
    })

    it("最少參數應能成功歸檔（使用預設值）", async () => {
      const doc = await createTestDocument({ documentType: "invoice" })
      createdDocIds.push(doc.id)

      const res = await request(app)
        .post(`/api/document-inbox/${doc.id}/archive-to-invoice`)
        .send({
          totalAmount: "1000",
        })
        .expect(200)

      expect(res.body).toHaveProperty("message", "已成功轉為發票記錄")
      expect(res.body.invoiceRecord.totalAmount).toBe("1000.00")
      // invoiceType 預設為 expense
      expect(res.body.invoiceRecord.invoiceType).toBe("expense")
    })
  })

  // ── 歸檔後的文件應不出現在預設列表 ─────────────────────────────────

  describe("歸檔後的文件不應出現在預設列表", () => {
    it("歸檔後文件不應出現在 GET /api/document-inbox", async () => {
      const doc = await createTestDocument({ documentType: "bill" })
      createdDocIds.push(doc.id)

      // 歸檔
      await request(app)
        .post(`/api/document-inbox/${doc.id}/archive-to-payment-item`)
        .send({ itemName: "歸檔隱藏測試", totalAmount: "1000" })
        .expect(200)

      // 預設列表排除 archived
      const listRes = await request(app).get("/api/document-inbox").expect(200)

      const found = listRes.body.find((d: { id: number }) => d.id === doc.id)
      expect(found).toBeUndefined()
    })

    it("歸檔後文件不應計入統計的 totalPending", async () => {
      const doc = await createTestDocument({ documentType: "invoice" })
      createdDocIds.push(doc.id)

      const statsBefore = await request(app).get("/api/document-inbox/stats").expect(200)

      // 歸檔
      await request(app)
        .post(`/api/document-inbox/${doc.id}/archive-to-invoice`)
        .send({ totalAmount: "500" })
        .expect(200)

      const statsAfter = await request(app).get("/api/document-inbox/stats").expect(200)

      // invoice 的 pending 應減少 1（文件從 pending 變成 archived）
      expect(statsAfter.body.invoice.pending).toBe(statsBefore.body.invoice.pending - 1)
    })

    it("status=archived 篩選應回傳已歸檔的文件", async () => {
      const res = await request(app).get("/api/document-inbox?status=archived").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      for (const doc of res.body) {
        expect(doc.status).toBe("archived")
      }
    })
  })
})
