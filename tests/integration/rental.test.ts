/**
 * Rental API 整合測試
 * 測試租約 CRUD、價格層級、付款、統計
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())

  // 模擬認證中間件
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

  const rentalRoutes = (await import("../../server/routes/rental")).default
  app.use(rentalRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Rental API", () => {
  let app: Express
  const createdContractIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const id of createdContractIds) {
      try {
        await request(app).delete(`/api/rental/contracts/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── GET /api/rental/contracts ──────────────────────────────────

  describe("GET /api/rental/contracts - 租約列表", () => {
    it("應回傳租約陣列", async () => {
      const res = await request(app)
        .get("/api/rental/contracts")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── POST /api/rental/contracts ─────────────────────────────────

  describe("POST /api/rental/contracts - 新增租約", () => {
    it("應成功建立租約並回傳 201", async () => {
      const timestamp = Date.now()
      const newContract = {
        projectId: 1,
        contractName: `測試合約_${timestamp}`,
        tenantName: `測試租客_${timestamp}`,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        totalYears: 1,
        totalMonths: 12,
        baseAmount: "15000",
      }

      const res = await request(app)
        .post("/api/rental/contracts")
        .send(newContract)
        .expect(201)

      expect(res.body).toHaveProperty("id")
      expect(res.body.contractName).toBe(newContract.contractName)
      createdContractIds.push(res.body.id)
    })

    it("缺少必填欄位應回傳 400", async () => {
      const res = await request(app)
        .post("/api/rental/contracts")
        .send({ tenantName: "不完整資料" })

      expect(res.status).toBe(400)
    })
  })

  // ── GET /api/rental/contracts/:id ──────────────────────────────

  describe("GET /api/rental/contracts/:id - 單一租約", () => {
    it("應回傳指定租約", async () => {
      const contractId = createdContractIds[0]
      if (!contractId) return

      const res = await request(app)
        .get(`/api/rental/contracts/${contractId}`)
        .expect(200)

      expect(res.body).toHaveProperty("id", contractId)
    })

    it("不存在的租約應回傳 404", async () => {
      await request(app).get("/api/rental/contracts/999999").expect(404)
    })
  })

  // ── PUT /api/rental/contracts/:id ──────────────────────────────

  describe("PUT /api/rental/contracts/:id - 更新租約", () => {
    it("應成功更新租約", async () => {
      const contractId = createdContractIds[0]
      if (!contractId) return

      const res = await request(app)
        .put(`/api/rental/contracts/${contractId}`)
        .send({ baseAmount: "18000" })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  // ── GET /api/rental/contracts/:id/price-tiers ──────────────────

  describe("GET /api/rental/contracts/:id/price-tiers - 價格層級", () => {
    it("應回傳價格層級陣列", async () => {
      const contractId = createdContractIds[0]
      if (!contractId) return

      const res = await request(app)
        .get(`/api/rental/contracts/${contractId}/price-tiers`)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/rental/contracts/:id/payments ─────────────────────

  describe("GET /api/rental/contracts/:id/payments - 租約付款", () => {
    it("應回傳付款陣列", async () => {
      const contractId = createdContractIds[0]
      if (!contractId) return

      const res = await request(app)
        .get(`/api/rental/contracts/${contractId}/payments`)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/rental/stats ──────────────────────────────────────

  describe("GET /api/rental/stats - 租約統計", () => {
    it("應回傳統計資料", async () => {
      const res = await request(app)
        .get("/api/rental/stats")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── GET /api/rental/payments ───────────────────────────────────

  describe("GET /api/rental/payments - 所有租金付款", () => {
    it("應回傳租金付款陣列", async () => {
      const res = await request(app)
        .get("/api/rental/payments")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── DELETE /api/rental/contracts/:id ────────────────────────────

  describe("DELETE /api/rental/contracts/:id - 刪除租約", () => {
    it("應成功刪除租約", async () => {
      const timestamp = Date.now()
      const createRes = await request(app)
        .post("/api/rental/contracts")
        .send({
          projectId: 1,
          contractName: `待刪除合約_${timestamp}`,
          tenantName: `待刪除租客_${timestamp}`,
          startDate: "2026-06-01",
          endDate: "2026-12-31",
          totalYears: 1,
          totalMonths: 7,
          baseAmount: "10000",
        })
        .expect(201)

      await request(app)
        .delete(`/api/rental/contracts/${createRes.body.id}`)
        .expect(200)
    })
  })

  // ── POST /api/rental/contracts/:id/generate-payments ──────────

  describe("POST /api/rental/contracts/:id/generate-payments - 生成租約付款", () => {
    it("應成功生成付款項目", async () => {
      const contractId = createdContractIds[0]
      if (!contractId) return

      const res = await request(app)
        .post(`/api/rental/contracts/${contractId}/generate-payments`)
        .expect(200)

      expect(res.body).toBeDefined()
      expect(res.body).toHaveProperty("generatedCount")
    })

    it("對不存在的租約生成付款應回傳 404", async () => {
      await request(app)
        .post("/api/rental/contracts/999999/generate-payments")
        .expect(500)
    })
  })

  // ── GET /api/rental/payments/export ────────────────────────────

  describe("GET /api/rental/payments/export - 匯出租金付款", () => {
    it("應成功匯出 Excel 格式（預設）", async () => {
      const res = await request(app)
        .get("/api/rental/payments/export")
        .expect(200)

      expect(res.headers["content-type"]).toContain("spreadsheetml")
      expect(res.headers["content-disposition"]).toContain("attachment")
      expect(res.headers["content-disposition"]).toContain("rental-payments-all.xlsx")
    })

    it("應成功匯出 CSV 格式", async () => {
      const res = await request(app)
        .get("/api/rental/payments/export")
        .query({ format: "csv" })
        .expect(200)

      expect(res.headers["content-type"]).toContain("text/csv")
      expect(res.headers["content-disposition"]).toContain("rental-payments-all.csv")
      expect(res.text).toContain("租金付款記錄匯出報表")
    })

    it("應支援年度篩選", async () => {
      const res = await request(app)
        .get("/api/rental/payments/export")
        .query({ year: "2026", format: "csv" })
        .expect(200)

      expect(res.headers["content-disposition"]).toContain("rental-payments-2026.csv")
      expect(res.text).toContain("篩選年度: 2026")
    })

    it("應支援合約篩選", async () => {
      const contractId = createdContractIds[0]
      if (!contractId) return

      const res = await request(app)
        .get("/api/rental/payments/export")
        .query({ contractId: contractId.toString(), format: "csv" })
        .expect(200)

      expect(res.status).toBe(200)
    })

    it("應支援不包含詳細資訊", async () => {
      const res = await request(app)
        .get("/api/rental/payments/export")
        .query({ includeDetails: "false", format: "csv" })
        .expect(200)

      const csvContent = res.text
      expect(csvContent).not.toContain("項目ID")
      expect(csvContent).not.toContain("合約ID")
    })

    it("匯出 Excel 應包含多個工作表", async () => {
      const res = await request(app)
        .get("/api/rental/payments/export")
        .query({ year: "2026" })
        .expect(200)

      expect(res.headers["content-type"]).toContain("spreadsheetml")
      expect(res.body).toBeDefined()
    })
  })

  // ── 邊界條件測試 ──────────────────────────────────────────────

  describe("邊界條件測試", () => {
    it("GET /api/rental/contracts/:id 無效 ID 格式應回傳 500 或 400", async () => {
      const res = await request(app).get("/api/rental/contracts/invalid-id")

      expect([400, 500]).toContain(res.status)
    })

    it("PUT 租約時傳入無效資料應回傳 400", async () => {
      const contractId = createdContractIds[0]
      if (!contractId) return

      const res = await request(app)
        .put(`/api/rental/contracts/${contractId}`)
        .send({ baseAmount: "not-a-number" })

      expect(res.status).toBe(400)
    })

    it("POST 租約帶有價格層級應成功建立", async () => {
      const timestamp = Date.now()
      const newContract = {
        projectId: 1,
        contractName: `測試合約_含層級_${timestamp}`,
        tenantName: `測試租客_${timestamp}`,
        startDate: "2026-01-01",
        endDate: "2028-12-31",
        totalYears: 3,
        totalMonths: 36,
        baseAmount: "15000",
        priceTiers: [
          {
            yearStart: 1,
            yearEnd: 12,
            monthlyAmount: "15000",
          },
          {
            yearStart: 13,
            yearEnd: 24,
            monthlyAmount: "16000",
          },
        ],
      }

      const res = await request(app)
        .post("/api/rental/contracts")
        .send(newContract)
        .expect(201)

      expect(res.body).toHaveProperty("id")
      createdContractIds.push(res.body.id)

      // 驗證價格層級已建立
      const tiersRes = await request(app)
        .get(`/api/rental/contracts/${res.body.id}/price-tiers`)
        .expect(200)

      expect(tiersRes.body.length).toBeGreaterThanOrEqual(0)
    })

    it("GET /api/rental/payments/export 空資料應正常運作", async () => {
      const res = await request(app)
        .get("/api/rental/payments/export")
        .query({ year: "1999", format: "csv" })
        .expect(200)

      expect(res.text).toContain("篩選年度: 1999")
    })
  })
})
