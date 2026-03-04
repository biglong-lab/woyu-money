/**
 * Document Inbox API 整合測試 - CRUD 正向流程與歸檔操作
 * 測試建立、讀取、更新、刪除、篩選、統計驗證、歸檔等完整生命週期
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

describe.skipIf(skipIfNoDb)("Document Inbox API - CRUD 正向流程", () => {
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

  // ── 建立 + 讀取 正向流程 ──────────────────────────────────────────

  describe("建立並讀取文件", () => {
    it("透過 storage 建立文件後，GET /:id 應回傳該文件", async () => {
      const doc = await createTestDocument({
        notes: "整合測試建立的文件",
        documentType: "bill",
      })
      createdDocIds.push(doc.id)

      const res = await request(app).get(`/api/document-inbox/${doc.id}`).expect(200)

      expect(res.body).toHaveProperty("id", doc.id)
      expect(res.body).toHaveProperty("documentType", "bill")
      expect(res.body).toHaveProperty("status", "pending")
      expect(res.body).toHaveProperty("imagePath", "/uploads/inbox/test-file.jpg")
      expect(res.body).toHaveProperty("originalFilename", "test-file.jpg")
      expect(res.body).toHaveProperty("notes", "整合測試建立的文件")
      expect(res.body).toHaveProperty("uploadedByUsername", "管理員")
    })

    it("建立的文件應出現在列表中", async () => {
      const doc = await createTestDocument({ documentType: "invoice" })
      createdDocIds.push(doc.id)

      const res = await request(app).get("/api/document-inbox").expect(200)

      const found = res.body.find((d: { id: number }) => d.id === doc.id)
      expect(found).toBeDefined()
      expect(found.documentType).toBe("invoice")
    })
  })

  // ── GET /api/document-inbox - 進階篩選 ────────────────────────────

  describe("GET /api/document-inbox - 進階篩選", () => {
    it("status=all 應包含所有非 archived 狀態的文件", async () => {
      const res = await request(app).get("/api/document-inbox?status=all").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("documentType=all 應不限制文件類型", async () => {
      const res = await request(app).get("/api/document-inbox?documentType=all").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("篩選 status=recognized 應只回傳已辨識的文件", async () => {
      const res = await request(app).get("/api/document-inbox?status=recognized").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      // 所有回傳結果的 status 都應為 recognized
      for (const doc of res.body) {
        expect(doc.status).toBe("recognized")
      }
    })

    it("篩選 documentType=payment 應只回傳付款憑證", async () => {
      const doc = await createTestDocument({ documentType: "payment" })
      createdDocIds.push(doc.id)

      const res = await request(app).get("/api/document-inbox?documentType=payment").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      for (const d of res.body) {
        expect(d.documentType).toBe("payment")
      }
    })
  })

  // ── GET /api/document-inbox/stats - 統計格式驗證 ────────────────────

  describe("GET /api/document-inbox/stats - 統計格式詳細驗證", () => {
    it("統計應包含 bill、payment、invoice 三種類型", async () => {
      const res = await request(app).get("/api/document-inbox/stats").expect(200)

      expect(res.body).toHaveProperty("bill")
      expect(res.body).toHaveProperty("payment")
      expect(res.body).toHaveProperty("invoice")
      expect(res.body).toHaveProperty("totalPending")
    })

    it("每種文件類型統計應包含所有狀態計數", async () => {
      const res = await request(app).get("/api/document-inbox/stats").expect(200)

      const expectedStatusKeys = ["pending", "processing", "recognized", "failed", "total"]

      for (const docType of ["bill", "payment", "invoice"]) {
        const typeStat = res.body[docType]
        for (const key of expectedStatusKeys) {
          expect(typeStat).toHaveProperty(key)
          expect(typeof typeStat[key]).toBe("number")
        }
      }
    })

    it("totalPending 應等於三種類型 total 的總和", async () => {
      const res = await request(app).get("/api/document-inbox/stats").expect(200)

      const expectedTotal = res.body.bill.total + res.body.payment.total + res.body.invoice.total

      expect(res.body.totalPending).toBe(expectedTotal)
    })
  })

  // ── PUT /api/document-inbox/:id - 更新正向流程 ─────────────────────

  describe("PUT /api/document-inbox/:id - 更新正向流程", () => {
    it("應成功更新 status 欄位", async () => {
      const doc = await createTestDocument()
      createdDocIds.push(doc.id)

      const res = await request(app)
        .put(`/api/document-inbox/${doc.id}`)
        .send({ status: "recognized" })
        .expect(200)

      expect(res.body).toHaveProperty("id", doc.id)
      expect(res.body).toHaveProperty("status", "recognized")
    })

    it("應成功更新 documentType 欄位", async () => {
      const doc = await createTestDocument({ documentType: "bill" })
      createdDocIds.push(doc.id)

      const res = await request(app)
        .put(`/api/document-inbox/${doc.id}`)
        .send({ documentType: "invoice" })
        .expect(200)

      expect(res.body.documentType).toBe("invoice")
    })

    it("應成功更新 notes 欄位", async () => {
      const doc = await createTestDocument()
      createdDocIds.push(doc.id)

      const res = await request(app)
        .put(`/api/document-inbox/${doc.id}`)
        .send({ notes: "更新後的備註" })
        .expect(200)

      expect(res.body.notes).toBe("更新後的備註")
    })

    it("應成功更新 userConfirmed 與確認欄位", async () => {
      const doc = await createTestDocument()
      createdDocIds.push(doc.id)

      const res = await request(app)
        .put(`/api/document-inbox/${doc.id}`)
        .send({
          userConfirmed: true,
          confirmedVendor: "測試供應商",
          confirmedAmount: "5000",
          confirmedDate: "2026-03-01",
          confirmedDescription: "測試描述",
          confirmedCategory: "辦公用品",
        })
        .expect(200)

      expect(res.body.userConfirmed).toBe(true)
      expect(res.body.confirmedVendor).toBe("測試供應商")
      expect(res.body.confirmedAmount).toBe("5000.00")
      expect(res.body.confirmedDate).toBe("2026-03-01")
      expect(res.body.confirmedDescription).toBe("測試描述")
      expect(res.body.confirmedCategory).toBe("辦公用品")
    })

    it("應成功更新 AI 辨識相關欄位", async () => {
      const doc = await createTestDocument()
      createdDocIds.push(doc.id)

      const res = await request(app)
        .put(`/api/document-inbox/${doc.id}`)
        .send({
          recognizedVendor: "AI辨識供應商",
          recognizedAmount: "3000",
          recognizedDate: "2026-02-15",
          recognizedDescription: "AI辨識描述",
          recognizedCategory: "水電費",
          recognizedInvoiceNumber: "INV-2026-001",
        })
        .expect(200)

      expect(res.body.recognizedVendor).toBe("AI辨識供應商")
      expect(res.body.recognizedAmount).toBe("3000.00")
      expect(res.body.recognizedDescription).toBe("AI辨識描述")
      expect(res.body.recognizedCategory).toBe("水電費")
      expect(res.body.recognizedInvoiceNumber).toBe("INV-2026-001")
    })

    it("應成功更新 tags 陣列欄位", async () => {
      const doc = await createTestDocument()
      createdDocIds.push(doc.id)

      const res = await request(app)
        .put(`/api/document-inbox/${doc.id}`)
        .send({ tags: ["緊急", "民宿", "水電"] })
        .expect(200)

      expect(res.body.tags).toEqual(["緊急", "民宿", "水電"])
    })

    it("同時更新多個欄位應全部生效", async () => {
      const doc = await createTestDocument()
      createdDocIds.push(doc.id)

      const res = await request(app)
        .put(`/api/document-inbox/${doc.id}`)
        .send({
          status: "recognized",
          notes: "多欄位更新測試",
          confirmedVendor: "多欄位供應商",
          confirmedAmount: "9999",
        })
        .expect(200)

      expect(res.body.status).toBe("recognized")
      expect(res.body.notes).toBe("多欄位更新測試")
      expect(res.body.confirmedVendor).toBe("多欄位供應商")
      expect(res.body.confirmedAmount).toBe("9999.00")
    })

    it("空 body 更新應回傳成功（不變更任何欄位）", async () => {
      const doc = await createTestDocument({ notes: "原始備註" })
      createdDocIds.push(doc.id)

      const res = await request(app).put(`/api/document-inbox/${doc.id}`).send({}).expect(200)

      // updatedAt 會更新，但其他欄位不變
      expect(res.body.notes).toBe("原始備註")
    })
  })

  // ── PATCH /api/document-inbox/:id/notes - 備註更新正向流程 ──────────

  describe("PATCH /api/document-inbox/:id/notes - 備註更新正向流程", () => {
    it("應成功更新備註內容", async () => {
      const doc = await createTestDocument()
      createdDocIds.push(doc.id)

      const res = await request(app)
        .patch(`/api/document-inbox/${doc.id}/notes`)
        .send({ notes: "測試更新的備註" })
        .expect(200)

      expect(res.body).toHaveProperty("id", doc.id)
      expect(res.body.notes).toBe("測試更新的備註")
      // 應記錄編輯者資訊
      expect(res.body).toHaveProperty("editedByUsername")
      expect(res.body.editedByUsername).toBeTruthy()
      expect(res.body).toHaveProperty("editedAt")
      expect(res.body.editedAt).toBeTruthy()
    })

    it("應成功將備註設為空字串", async () => {
      const doc = await createTestDocument({ notes: "原本有備註" })
      createdDocIds.push(doc.id)

      const res = await request(app)
        .patch(`/api/document-inbox/${doc.id}/notes`)
        .send({ notes: "" })
        .expect(200)

      // 空字串在 storage 層被轉為 null
      expect(res.body.notes).toBeNull()
    })

    it("應成功將備註設為 null", async () => {
      const doc = await createTestDocument({ notes: "需要清除" })
      createdDocIds.push(doc.id)

      const res = await request(app)
        .patch(`/api/document-inbox/${doc.id}/notes`)
        .send({ notes: null })
        .expect(200)

      expect(res.body.notes).toBeNull()
    })
  })

  // ── DELETE /api/document-inbox/:id - 刪除正向流程 ──────────────────

  describe("DELETE /api/document-inbox/:id - 刪除正向流程", () => {
    it("應成功刪除存在的文件", async () => {
      const doc = await createTestDocument()
      // 不加入 createdDocIds，因為這裡會手動刪除

      const delRes = await request(app).delete(`/api/document-inbox/${doc.id}`).expect(200)

      expect(delRes.body).toHaveProperty("message", "已刪除")

      // 確認已被刪除
      const getRes = await request(app).get(`/api/document-inbox/${doc.id}`)

      expect(getRes.status).toBe(404)
    })

    it("刪除後不應出現在列表中", async () => {
      const doc = await createTestDocument()

      // 先確認存在
      const listBefore = await request(app).get("/api/document-inbox").expect(200)
      const foundBefore = listBefore.body.find((d: { id: number }) => d.id === doc.id)
      expect(foundBefore).toBeDefined()

      // 刪除
      await request(app).delete(`/api/document-inbox/${doc.id}`).expect(200)

      // 確認不在列表中
      const listAfter = await request(app).get("/api/document-inbox").expect(200)
      const foundAfter = listAfter.body.find((d: { id: number }) => d.id === doc.id)
      expect(foundAfter).toBeUndefined()
    })
  })

  // ── GET /api/document-inbox/:id - 回傳欄位完整性 ───────────────────

  describe("GET /api/document-inbox/:id - 回傳欄位完整性", () => {
    it("應包含所有核心欄位", async () => {
      const doc = await createTestDocument()
      createdDocIds.push(doc.id)

      const res = await request(app).get(`/api/document-inbox/${doc.id}`).expect(200)

      // 基本欄位
      expect(res.body).toHaveProperty("id")
      expect(res.body).toHaveProperty("userId")
      expect(res.body).toHaveProperty("documentType")
      expect(res.body).toHaveProperty("status")
      expect(res.body).toHaveProperty("imagePath")
      expect(res.body).toHaveProperty("originalFilename")
      expect(res.body).toHaveProperty("notes")
      expect(res.body).toHaveProperty("createdAt")
      expect(res.body).toHaveProperty("updatedAt")

      // AI 辨識欄位
      expect(res.body).toHaveProperty("aiRecognized")
      expect(res.body).toHaveProperty("aiConfidence")
      expect(res.body).toHaveProperty("aiExtractedData")

      // 辨識結果欄位
      expect(res.body).toHaveProperty("recognizedVendor")
      expect(res.body).toHaveProperty("recognizedAmount")
      expect(res.body).toHaveProperty("recognizedDate")
      expect(res.body).toHaveProperty("recognizedDescription")
      expect(res.body).toHaveProperty("recognizedCategory")

      // 使用者確認欄位
      expect(res.body).toHaveProperty("userConfirmed")
      expect(res.body).toHaveProperty("confirmedVendor")
      expect(res.body).toHaveProperty("confirmedAmount")
      expect(res.body).toHaveProperty("confirmedDate")

      // 歸檔相關欄位
      expect(res.body).toHaveProperty("archivedToType")
      expect(res.body).toHaveProperty("archivedToId")
      expect(res.body).toHaveProperty("archivedAt")

      // 上傳/編輯者欄位
      expect(res.body).toHaveProperty("uploadedByUsername")
      expect(res.body).toHaveProperty("editedByUserId")
      expect(res.body).toHaveProperty("editedByUsername")
    })
  })

  // ── 不同 documentType 的篩選交叉驗證 ──────────────────────────────

  describe("documentType 篩選交叉驗證", () => {
    it("建立三種類型的文件，各自篩選應只回傳對應類型", async () => {
      const billDoc = await createTestDocument({ documentType: "bill" })
      const paymentDoc = await createTestDocument({ documentType: "payment" })
      const invoiceDoc = await createTestDocument({ documentType: "invoice" })
      createdDocIds.push(billDoc.id, paymentDoc.id, invoiceDoc.id)

      // 篩選 bill
      const billRes = await request(app).get("/api/document-inbox?documentType=bill").expect(200)
      const billFound = billRes.body.find((d: { id: number }) => d.id === billDoc.id)
      expect(billFound).toBeDefined()
      expect(billRes.body.find((d: { id: number }) => d.id === paymentDoc.id)).toBeUndefined()
      expect(billRes.body.find((d: { id: number }) => d.id === invoiceDoc.id)).toBeUndefined()

      // 篩選 payment
      const paymentRes = await request(app)
        .get("/api/document-inbox?documentType=payment")
        .expect(200)
      expect(paymentRes.body.find((d: { id: number }) => d.id === paymentDoc.id)).toBeDefined()

      // 篩選 invoice
      const invoiceRes = await request(app)
        .get("/api/document-inbox?documentType=invoice")
        .expect(200)
      expect(invoiceRes.body.find((d: { id: number }) => d.id === invoiceDoc.id)).toBeDefined()
    })
  })

  // ── 統計正確性驗證（建立文件後重新查詢） ──────────────────────────────

  describe("統計正確性 - 建立文件後驗證計數變化", () => {
    it("新增 pending 文件後 totalPending 應增加", async () => {
      const statsBefore = await request(app).get("/api/document-inbox/stats").expect(200)

      const doc = await createTestDocument({
        documentType: "bill",
        status: "pending",
      })
      createdDocIds.push(doc.id)

      const statsAfter = await request(app).get("/api/document-inbox/stats").expect(200)

      expect(statsAfter.body.bill.pending).toBe(statsBefore.body.bill.pending + 1)
      expect(statsAfter.body.bill.total).toBe(statsBefore.body.bill.total + 1)
      expect(statsAfter.body.totalPending).toBe(statsBefore.body.totalPending + 1)
    })
  })
})
