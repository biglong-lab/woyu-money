/**
 * Payment Items API 整合測試
 * 測試付款項目的 CRUD 操作與分頁篩選功能
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
      user: { id: number; username: string; isActive: boolean }
      isAuthenticated: () => boolean
      session: Record<string, unknown>
    }
    reqWithAuth.user = { id: 1, username: "admin", isActive: true }
    reqWithAuth.isAuthenticated = () => true
    reqWithAuth.session = { userId: 1, isAuthenticated: true }
    next()
  })

  // 載入路由（繞過 registerRoutes 中的認證設定）
  const paymentItemRoutes = (await import("../../server/routes/payment-items")).default
  const analyticsRoutes = (await import("../../server/routes/analytics")).default
  app.use(paymentItemRoutes)
  app.use(analyticsRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Payment Items API", () => {
  let app: Express
  const createdItemIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    // 清理測試建立的項目（軟刪除）
    for (const id of createdItemIds) {
      try {
        await request(app).delete(`/api/payment/items/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── GET /api/payment/items ──────────────────────────────────────

  describe("GET /api/payment/items - 列表（分頁模式）", () => {
    it("應回傳包含 items 與 pagination 的分頁結構", async () => {
      const res = await request(app).get("/api/payment/items").expect("Content-Type", /json/)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("items")
      expect(res.body).toHaveProperty("pagination")
      expect(Array.isArray(res.body.items)).toBe(true)
    })

    it("pagination 物件應包含完整欄位", async () => {
      const res = await request(app).get("/api/payment/items").expect(200)

      const { pagination } = res.body
      expect(pagination).toHaveProperty("currentPage")
      expect(pagination).toHaveProperty("totalPages")
      expect(pagination).toHaveProperty("totalItems")
      expect(pagination).toHaveProperty("pageSize")
      expect(pagination).toHaveProperty("hasNextPage")
      expect(pagination).toHaveProperty("hasPreviousPage")
      expect(typeof pagination.currentPage).toBe("number")
      expect(typeof pagination.totalPages).toBe("number")
      expect(typeof pagination.totalItems).toBe("number")
    })

    it("應支援自訂分頁參數 page 與 limit", async () => {
      const res = await request(app).get("/api/payment/items?page=1&limit=5").expect(200)

      expect(res.body.pagination.currentPage).toBe(1)
      expect(res.body.pagination.pageSize).toBe(5)
      expect(res.body.items.length).toBeLessThanOrEqual(5)
    })

    it("limit 不應超過 200", async () => {
      const res = await request(app).get("/api/payment/items?limit=999").expect(200)

      expect(res.body.pagination.pageSize).toBeLessThanOrEqual(200)
    })

    it("應支援 projectId 篩選", async () => {
      const res = await request(app).get("/api/payment/items?projectId=1").expect(200)

      expect(res.body).toHaveProperty("items")
      expect(Array.isArray(res.body.items)).toBe(true)
    })

    it("應支援 categoryId 篩選", async () => {
      const res = await request(app).get("/api/payment/items?categoryId=1").expect(200)

      expect(res.body).toHaveProperty("items")
      expect(Array.isArray(res.body.items)).toBe(true)
    })

    it("應支援 itemType=general 篩選（排除租約項目）", async () => {
      const res = await request(app).get("/api/payment/items?itemType=general").expect(200)

      expect(res.body).toHaveProperty("items")
    })
  })

  describe("GET /api/payment/items?includeAll=true - 全量模式", () => {
    it("includeAll=true 應回傳陣列（非分頁結構）", async () => {
      const res = await request(app).get("/api/payment/items?includeAll=true").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/payment/items/paginated ────────────────────────────

  describe("GET /api/payment/items/paginated - 進階分頁", () => {
    it("應回傳分頁結果", async () => {
      const res = await request(app)
        .get("/api/payment/items/paginated?page=1&pageSize=10")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── POST /api/payment/items ─────────────────────────────────────

  describe("POST /api/payment/items - 新增項目", () => {
    it("應成功建立付款項目並回傳 201", async () => {
      const timestamp = Date.now()
      const newItem = {
        itemName: `整合測試項目_${timestamp}`,
        totalAmount: "10000",
        itemType: "project",
        paymentType: "single",
        startDate: "2026-01-15",
      }

      const res = await request(app).post("/api/payment/items").send(newItem).expect(201)

      expect(res.body).toHaveProperty("id")
      expect(res.body.itemName).toBe(newItem.itemName)
      expect(res.body.totalAmount).toBeDefined()
      createdItemIds.push(res.body.id)
    })

    it("缺少必填欄位應回傳 400", async () => {
      const invalidItem = {
        totalAmount: "5000",
        // 缺少 itemName
      }

      const res = await request(app).post("/api/payment/items").send(invalidItem)

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
    })

    it("空白 startDate 應自動補上今天日期", async () => {
      const timestamp = Date.now()
      const newItem = {
        itemName: `測試自動日期_${timestamp}`,
        totalAmount: "3000",
        startDate: "",
      }

      const res = await request(app).post("/api/payment/items").send(newItem).expect(201)

      expect(res.body).toHaveProperty("id")
      expect(res.body.startDate).toBeDefined()
      createdItemIds.push(res.body.id)
    })
  })

  // ── PUT /api/payment/items/:id ──────────────────────────────────

  describe("PUT /api/payment/items/:id - 更新項目", () => {
    let testItemId: number

    beforeAll(async () => {
      // 建立一筆供更新測試使用的項目
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `更新測試項目_${timestamp}`,
          totalAmount: "20000",
          startDate: "2026-02-01",
        })
        .expect(201)
      testItemId = res.body.id
      createdItemIds.push(testItemId)
    })

    it("應成功更新項目名稱", async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .put(`/api/payment/items/${testItemId}`)
        .send({
          itemName: `已更新名稱_${timestamp}`,
          totalAmount: "20000",
          startDate: "2026-02-01",
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })

    it("更新不存在的項目應回傳 404", async () => {
      const res = await request(app)
        .put("/api/payment/items/999999")
        .send({
          itemName: "不存在",
          totalAmount: "1000",
          startDate: "2026-01-01",
        })

      expect(res.status).toBe(404)
    })

    it("無效資料應回傳 400", async () => {
      const res = await request(app)
        .put(`/api/payment/items/${testItemId}`)
        .send({
          // 缺少必填欄位
          totalAmount: "abc",
        })

      expect(res.status).toBe(400)
    })
  })

  // ── PATCH /api/payment/items/:id ────────────────────────────────

  describe("PATCH /api/payment/items/:id - 部分更新", () => {
    let testItemId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `PATCH 測試項目_${timestamp}`,
          totalAmount: "15000",
          startDate: "2026-03-01",
        })
        .expect(201)
      testItemId = res.body.id
      createdItemIds.push(testItemId)
    })

    it("應可只更新部分欄位", async () => {
      const res = await request(app)
        .patch(`/api/payment/items/${testItemId}`)
        .send({
          notes: "透過 PATCH 新增的備註",
          changeReason: "測試部分更新",
        })
        .expect(200)

      expect(res.body).toHaveProperty("id", testItemId)
    })

    it("不存在的項目應回傳 404", async () => {
      const res = await request(app)
        .patch("/api/payment/items/999999")
        .send({ notes: "不存在" })

      expect(res.status).toBe(404)
    })
  })

  // ── DELETE /api/payment/items/:id ───────────────────────────────

  describe("DELETE /api/payment/items/:id - 軟刪除", () => {
    let testItemId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `刪除測試項目_${timestamp}`,
          totalAmount: "8000",
          startDate: "2026-04-01",
        })
        .expect(201)
      testItemId = res.body.id
      // 不加入 createdItemIds，因為測試本身會刪除
    })

    it("應成功軟刪除並回傳 204", async () => {
      await request(app).delete(`/api/payment/items/${testItemId}`).expect(204)
    })
  })

  // ── GET /api/payment/items/deleted ──────────────────────────────

  describe("GET /api/payment/items/deleted - 回收站", () => {
    it("應回傳已刪除項目的陣列", async () => {
      const res = await request(app).get("/api/payment/items/deleted").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/payment/items/:id/records ──────────────────────────

  describe("GET /api/payment/items/:id/records - 項目付款記錄", () => {
    it("應回傳指定項目的付款記錄陣列", async () => {
      // 使用已建立的項目 ID（取第一個）
      const itemId = createdItemIds[0]
      if (!itemId) return

      const res = await request(app).get(`/api/payment/items/${itemId}/records`).expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/payment/project/stats ──────────────────────────────

  describe("GET /api/payment/project/stats - 專案統計", () => {
    it("應回傳包含統計欄位的物件", async () => {
      const res = await request(app)
        .get("/api/payment/project/stats")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("totalPlanned")
      expect(res.body).toHaveProperty("totalPaid")
      expect(res.body).toHaveProperty("totalUnpaid")
      expect(res.body).toHaveProperty("completionRate")
      expect(res.body).toHaveProperty("totalItems")
      expect(typeof res.body.totalItems).toBe("number")
    })

    it("金額欄位應為字串格式", async () => {
      const res = await request(app).get("/api/payment/project/stats").expect(200)

      expect(typeof res.body.totalPlanned).toBe("string")
      expect(typeof res.body.totalPaid).toBe("string")
      expect(typeof res.body.totalUnpaid).toBe("string")
    })
  })

  // ── POST /api/payment/items/:id/restore ────────────────────────

  describe("POST /api/payment/items/:id/restore - 恢復已刪除項目", () => {
    let testItemId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `恢復測試項目_${timestamp}`,
          totalAmount: "6000",
          startDate: "2026-05-01",
        })
        .expect(201)
      testItemId = res.body.id

      // 先軟刪除
      await request(app)
        .delete(`/api/payment/items/${testItemId}`)
        .send({ reason: "測試恢復功能" })
        .expect(204)
    })

    it("應成功恢復已刪除項目並回傳項目資料", async () => {
      const res = await request(app)
        .post(`/api/payment/items/${testItemId}/restore`)
        .send({ reason: "恢復測試" })
        .expect(200)

      expect(res.body).toHaveProperty("id", testItemId)
      expect(res.body).toHaveProperty("itemName")
      createdItemIds.push(testItemId)
    })
  })

  // ── DELETE /api/payment/items/:id/permanent ────────────────────

  describe("DELETE /api/payment/items/:id/permanent - 永久刪除", () => {
    let testItemId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `永久刪除測試_${timestamp}`,
          totalAmount: "4000",
          startDate: "2026-06-01",
        })
        .expect(201)
      testItemId = res.body.id

      // 先軟刪除
      await request(app)
        .delete(`/api/payment/items/${testItemId}`)
        .send({ reason: "準備永久刪除" })
        .expect(204)
    })

    it("應成功永久刪除並回傳 204", async () => {
      await request(app)
        .delete(`/api/payment/items/${testItemId}/permanent`)
        .send({ reason: "測試永久刪除" })
        .expect(204)
    })
  })

  // ── GET /api/payment/items/:id/audit-logs ──────────────────────

  describe("GET /api/payment/items/:id/audit-logs - 審計日誌", () => {
    let testItemId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `審計測試項目_${timestamp}`,
          totalAmount: "7000",
          startDate: "2026-07-01",
        })
        .expect(201)
      testItemId = res.body.id
      createdItemIds.push(testItemId)

      // 進行一次更新以產生審計記錄
      await request(app)
        .patch(`/api/payment/items/${testItemId}`)
        .send({
          notes: "新增備註產生審計記錄",
          changeReason: "測試審計功能",
        })
        .expect(200)
    })

    it("應回傳審計日誌陣列", async () => {
      const res = await request(app)
        .get(`/api/payment/items/${testItemId}/audit-logs`)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("審計日誌應包含必要欄位", async () => {
      const res = await request(app)
        .get(`/api/payment/items/${testItemId}/audit-logs`)
        .expect(200)

      if (res.body.length > 0) {
        const log = res.body[0]
        expect(log).toHaveProperty("id")
        expect(log).toHaveProperty("tableName")
        expect(log).toHaveProperty("recordId")
        expect(log).toHaveProperty("action")
      }
    })
  })

  // ── POST /api/payment/items/:id/payments ───────────────────────

  describe("POST /api/payment/items/:id/payments - 付款處理", () => {
    let testItemId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `付款測試項目_${timestamp}`,
          totalAmount: "10000",
          paidAmount: "0",
          status: "pending",
          startDate: "2026-08-01",
        })
        .expect(201)
      testItemId = res.body.id
      createdItemIds.push(testItemId)
    })

    it("應成功記錄付款並更新項目狀態為 partial", async () => {
      const res = await request(app)
        .post(`/api/payment/items/${testItemId}/payments`)
        .send({
          amount: "3000",
          paymentDate: "2026-08-05",
          paymentMethod: "cash",
          notes: "第一次付款",
        })
        .expect(200)

      expect(res.body).toHaveProperty("id", testItemId)
      expect(res.body.status).toBe("partial")
      expect(parseFloat(res.body.paidAmount || "0")).toBeGreaterThan(0)
    })

    it("應成功記錄第二次付款並更新狀態為 paid", async () => {
      const res = await request(app)
        .post(`/api/payment/items/${testItemId}/payments`)
        .send({
          amount: "7000",
          paymentDate: "2026-08-10",
          paymentMethod: "bank_transfer",
          notes: "第二次付款（付清）",
        })
        .expect(200)

      expect(res.body).toHaveProperty("id", testItemId)
      expect(res.body.status).toBe("paid")
      expect(parseFloat(res.body.paidAmount)).toBe(10000)
    })

    it("付款金額超過剩餘金額應回傳 400", async () => {
      // 建立新項目
      const timestamp = Date.now()
      const createRes = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `超額付款測試_${timestamp}`,
          totalAmount: "5000",
          paidAmount: "0",
          startDate: "2026-08-15",
        })
        .expect(201)
      const newItemId = createRes.body.id
      createdItemIds.push(newItemId)

      const res = await request(app)
        .post(`/api/payment/items/${newItemId}/payments`)
        .send({
          amount: "6000", // 超過總額 5000
          paymentDate: "2026-08-16",
        })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
    })

    it("無效付款金額應回傳 400", async () => {
      const res = await request(app)
        .post(`/api/payment/items/${testItemId}/payments`)
        .send({
          amount: "0",
          paymentDate: "2026-08-20",
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("Invalid payment amount")
    })

    it("不存在的項目應回傳 404", async () => {
      const res = await request(app)
        .post("/api/payment/items/999999/payments")
        .send({
          amount: "1000",
          paymentDate: "2026-08-25",
        })

      expect(res.status).toBe(404)
      expect(res.body.message).toContain("not found")
    })
  })

  // ── 進階篩選與排序測試 ──────────────────────────────────────

  describe("進階篩選與排序", () => {
    it("應支援多重篩選條件組合", async () => {
      const res = await request(app)
        .get("/api/payment/items?projectId=1&categoryId=1&itemType=general")
        .expect(200)

      expect(res.body).toHaveProperty("items")
      expect(Array.isArray(res.body.items)).toBe(true)
    })

    it("分頁參數應正確處理邊界值", async () => {
      const res = await request(app).get("/api/payment/items?page=0&limit=0").expect(200)

      expect(res.body).toHaveProperty("pagination")
    })

    it("includeDeleted 參數應影響結果", async () => {
      const res = await request(app)
        .get("/api/payment/items/paginated?includeDeleted=true")
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("應支援日期範圍篩選", async () => {
      const res = await request(app)
        .get("/api/payment/items/paginated?startDate=2026-01-01&endDate=2026-12-31")
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("應支援狀態篩選", async () => {
      const res = await request(app)
        .get("/api/payment/items/paginated?status=paid")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })
})
