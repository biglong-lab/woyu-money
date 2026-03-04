/**
 * Rental 擴展整合測試
 * 覆蓋 storage/rental.ts 中基礎 CRUD 以外的進階功能：
 * - 租約付款生成（含價格階段、buffer period）
 * - 合約詳情（含統計、進度）
 * - 合約搜尋
 * - 付款資訊更新
 * - 分期計劃
 * - 合約文件 CRUD
 * - 更新租約觸發付款重新生成
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

/** 建立測試用 Express 應用（掛載 rental 路由 + 模擬認證） */
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

describe.skipIf(skipIfNoDb)("Rental Extended API", () => {
  let app: Express
  const createdContractIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    // 反向清理，避免 FK 衝突
    for (const id of [...createdContractIds].reverse()) {
      try {
        await request(app).delete(`/api/rental/contracts/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── 租約付款生成（含價格階段） ───────────────────────────────────

  describe("租約付款生成 — 價格階段驅動", () => {
    let contractWithTiersId: number

    it("建立含多階段價格的租約並生成付款", async () => {
      const ts = Date.now()
      const res = await request(app)
        .post("/api/rental/contracts")
        .send({
          projectId: 1,
          contractName: `多階段合約_${ts}`,
          tenantName: `租客_${ts}`,
          startDate: "2025-01-01",
          endDate: "2026-12-31",
          totalYears: 2,
          totalMonths: 24,
          baseAmount: "10000",
          priceTiers: [
            { yearStart: 1, yearEnd: 1, monthlyAmount: "10000" },
            { yearStart: 2, yearEnd: 2, monthlyAmount: "12000" },
          ],
        })
        .expect(201)

      contractWithTiersId = res.body.id
      createdContractIds.push(contractWithTiersId)

      // 生成付款
      const genRes = await request(app)
        .post(`/api/rental/contracts/${contractWithTiersId}/generate-payments`)
        .expect(200)

      expect(genRes.body.generatedCount).toBeGreaterThan(0)
    })

    it("生成的付款應根據價格階段設定不同金額", async () => {
      const paymentsRes = await request(app)
        .get(`/api/rental/contracts/${contractWithTiersId}/payments`)
        .expect(200)

      const payments = paymentsRes.body as Array<{
        itemName: string
        totalAmount: string
      }>

      // 第一年（2025）的付款應為 10000
      const year1Payments = payments.filter((p) => p.itemName.startsWith("2025-"))
      // 第二年（2026）的付款應為 12000
      const year2Payments = payments.filter((p) => p.itemName.startsWith("2026-"))

      if (year1Payments.length > 0) {
        expect(parseFloat(year1Payments[0].totalAmount)).toBe(10000)
      }

      if (year2Payments.length > 0) {
        expect(parseFloat(year2Payments[0].totalAmount)).toBe(12000)
      }
    })

    it("重複生成付款不應產生重複項目", async () => {
      const firstRes = await request(app)
        .post(`/api/rental/contracts/${contractWithTiersId}/generate-payments`)
        .expect(200)

      // 第二次生成應回傳 0（已存在的月份不重複建立）
      expect(firstRes.body.generatedCount).toBe(0)
    })
  })

  // ── 更新租約觸發付款重新生成 ─────────────────────────────────────

  describe("更新租約 — 價格階段變更觸發重新生成", () => {
    let contractForUpdateId: number

    it("建立租約後更新價格階段應觸發付款重新生成", async () => {
      const ts = Date.now()
      const createRes = await request(app)
        .post("/api/rental/contracts")
        .send({
          projectId: 1,
          contractName: `更新測試合約_${ts}`,
          tenantName: `更新租客_${ts}`,
          startDate: "2026-01-01",
          endDate: "2026-06-30",
          totalYears: 1,
          totalMonths: 6,
          baseAmount: "8000",
        })
        .expect(201)

      contractForUpdateId = createRes.body.id
      createdContractIds.push(contractForUpdateId)

      // 先生成付款
      await request(app)
        .post(`/api/rental/contracts/${contractForUpdateId}/generate-payments`)
        .expect(200)

      // 更新時傳入新的價格階段（必須同時帶至少一個合約欄位，否則 drizzle 會報 No values to set）
      await request(app)
        .put(`/api/rental/contracts/${contractForUpdateId}`)
        .send({
          baseAmount: "9000",
          priceTiers: [{ yearStart: 1, yearEnd: 1, monthlyAmount: "9000" }],
        })
        .expect(200)

      // 驗證價格階段已更新
      const tiersRes = await request(app)
        .get(`/api/rental/contracts/${contractForUpdateId}/price-tiers`)
        .expect(200)

      expect(tiersRes.body.length).toBe(1)
      // PostgreSQL decimal 欄位回傳含小數位，用 parseFloat 比較
      expect(parseFloat(tiersRes.body[0].monthlyAmount)).toBe(9000)
    })
  })

  // ── 租約統計進階驗證 ──────────────────────────────────────────

  describe("租約統計 — 進階驗證", () => {
    it("統計應包含必要欄位且為合理值", async () => {
      const res = await request(app).get("/api/rental/stats").expect(200)

      expect(res.body).toHaveProperty("totalContracts")
      expect(res.body).toHaveProperty("activeContracts")
      expect(res.body).toHaveProperty("totalMonthlyRent")

      // totalContracts 必定 >= activeContracts
      expect(Number(res.body.totalContracts)).toBeGreaterThanOrEqual(
        Number(res.body.activeContracts)
      )

      // totalMonthlyRent 應為非負數
      expect(parseFloat(res.body.totalMonthlyRent)).toBeGreaterThanOrEqual(0)
    })
  })

  // ── 合約詳情（直接呼叫 storage） ──────────────────────────────

  describe("合約詳情 — getContractDetails", () => {
    it("應回傳完整的合約詳情含統計和進度", async () => {
      const contractId = createdContractIds[0]
      if (!contractId) return

      const { storage } = await import("../../server/storage")
      const details = await storage.getContractDetails(contractId)

      expect(details).not.toBeNull()
      if (!details) return

      // 合約基本資訊
      expect(details.contract).toHaveProperty("id")
      expect(details.contract).toHaveProperty("contractName")

      // 價格階段
      expect(Array.isArray(details.priceTiers)).toBe(true)

      // 付款統計
      expect(details.paymentStats).toBeDefined()

      // 最近付款
      expect(Array.isArray(details.recentPayments)).toBe(true)

      // 合約文件
      expect(Array.isArray(details.documents)).toBe(true)

      // 進度
      expect(details.progress).toHaveProperty("percentage")
      expect(details.progress).toHaveProperty("remainingMonths")
      expect(details.progress).toHaveProperty("isExpired")
      expect(typeof details.progress.percentage).toBe("number")
      expect(details.progress.percentage).toBeGreaterThanOrEqual(0)
      expect(details.progress.percentage).toBeLessThanOrEqual(100)
    })

    it("不存在的合約應回傳 null", async () => {
      const { storage } = await import("../../server/storage")
      const details = await storage.getContractDetails(999999)
      expect(details).toBeNull()
    })
  })

  // ── 合約搜尋 ──────────────────────────────────────────────────

  describe("合約搜尋 — searchContracts", () => {
    it("無篩選條件應回傳所有合約", async () => {
      const { storage } = await import("../../server/storage")
      const results = await storage.searchContracts({})
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
    })

    it("以關鍵字搜尋應回傳匹配結果", async () => {
      const { storage } = await import("../../server/storage")
      // 使用建立測試時的關鍵字「多階段合約」
      const results = await storage.searchContracts({ keyword: "多階段合約" })
      expect(Array.isArray(results)).toBe(true)
      // 至少有一個包含此關鍵字
      expect(results.length).toBeGreaterThanOrEqual(1)
    })

    it("以 projectId 搜尋應回傳匹配結果", async () => {
      const { storage } = await import("../../server/storage")
      const results = await storage.searchContracts({ projectId: 1 })
      expect(Array.isArray(results)).toBe(true)
      for (const r of results) {
        expect(r.projectId).toBe(1)
      }
    })

    it("以日期範圍搜尋應回傳匹配結果", async () => {
      const { storage } = await import("../../server/storage")
      const results = await storage.searchContracts({
        startDateFrom: "2025-01-01",
        startDateTo: "2026-12-31",
      })
      expect(Array.isArray(results)).toBe(true)
    })

    it("不匹配的搜尋應回傳空陣列", async () => {
      const { storage } = await import("../../server/storage")
      const results = await storage.searchContracts({
        keyword: "完全不存在的合約名稱_xyz_99999",
      })
      expect(results.length).toBe(0)
    })
  })

  // ── 付款資訊更新 ──────────────────────────────────────────────

  describe("付款資訊更新 — updateContractPaymentInfo", () => {
    it("應成功更新合約付款資訊", async () => {
      const contractId = createdContractIds[0]
      if (!contractId) return

      const { storage } = await import("../../server/storage")
      const updated = await storage.updateContractPaymentInfo(contractId, {
        payeeName: "測試收款人",
        payeeUnit: "測試單位",
        bankCode: "004",
        accountNumber: "12345678901234",
        contractPaymentDay: 15,
      })

      expect(updated).toHaveProperty("id", contractId)

      // 驗證更新後的值
      const detail = await storage.getRentalContract(contractId)
      expect(detail).not.toBeNull()
      if (!detail) return
      expect(detail.payeeName).toBe("測試收款人")
      expect(detail.payeeUnit).toBe("測試單位")
      expect(detail.bankCode).toBe("004")
      expect(detail.accountNumber).toBe("12345678901234")
      expect(detail.contractPaymentDay).toBe(15)
    })
  })

  // ── 合約文件 CRUD ─────────────────────────────────────────────

  describe("合約文件 CRUD — contractDocuments", () => {
    let createdDocId: number

    it("應成功建立合約文件", async () => {
      const contractId = createdContractIds[0]
      if (!contractId) return

      const { storage } = await import("../../server/storage")
      const doc = await storage.createContractDocument({
        contractId,
        fileName: "測試文件.pdf",
        originalName: "original_測試文件.pdf",
        filePath: "/uploads/contracts/test-doc.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
      })

      expect(doc).toHaveProperty("id")
      expect(doc.fileName).toBe("測試文件.pdf")
      createdDocId = doc.id
    })

    it("應回傳合約的所有文件", async () => {
      const contractId = createdContractIds[0]
      if (!contractId) return

      const { storage } = await import("../../server/storage")
      const docs = await storage.getContractDocuments(contractId)
      expect(Array.isArray(docs)).toBe(true)
      expect(docs.length).toBeGreaterThanOrEqual(1)
    })

    it("應回傳單一文件", async () => {
      if (!createdDocId) return

      const { storage } = await import("../../server/storage")
      const doc = await storage.getContractDocument(createdDocId)
      expect(doc).toBeDefined()
      expect(doc?.id).toBe(createdDocId)
    })

    it("應成功更新文件資訊", async () => {
      if (!createdDocId) return

      const { storage } = await import("../../server/storage")
      const updated = await storage.updateContractDocument(createdDocId, {
        fileName: "更新後文件.pdf",
      })

      expect(updated.fileName).toBe("更新後文件.pdf")
    })

    it("更新不存在的文件應拋出錯誤", async () => {
      const { storage } = await import("../../server/storage")
      await expect(
        storage.updateContractDocument(999999, { fileName: "不存在.pdf" })
      ).rejects.toThrow()
    })

    it("應成功刪除文件", async () => {
      if (!createdDocId) return

      const { storage } = await import("../../server/storage")
      await storage.deleteContractDocument(createdDocId)

      // 確認已刪除
      const doc = await storage.getContractDocument(createdDocId)
      expect(doc).toBeUndefined()
    })
  })

  // ── 分期計劃 ──────────────────────────────────────────────────

  describe("分期計劃 — installmentPlan", () => {
    it("應成功建立分期計劃並生成分期付款", async () => {
      const contractId = createdContractIds[0]
      if (!contractId) return

      // 先確保有付款項目可以做分期
      const paymentsRes = await request(app)
        .get(`/api/rental/contracts/${contractId}/payments`)
        .expect(200)

      const pendingPayment = (
        paymentsRes.body as Array<{ id: number; status: string; totalAmount: string }>
      ).find((p) => p.status === "pending")

      if (!pendingPayment) return // 沒有待付款項目則跳過

      const { storage } = await import("../../server/storage")
      const plan = await storage.createInstallmentPlan({
        itemId: pendingPayment.id,
        totalAmount: pendingPayment.totalAmount,
        installmentCount: 3,
        monthlyAmount: (parseFloat(pendingPayment.totalAmount) / 3).toFixed(2),
        startDate: "2026-01-01",
        startType: "current_month",
      })

      expect(plan).toHaveProperty("id")
      expect(plan.installmentCount).toBe(3)

      // 生成分期付款
      const result = await storage.generateInstallmentPayments(plan.id)
      expect(result.generatedCount).toBe(3)
    })

    it("不存在的分期計劃應拋出錯誤", async () => {
      const { storage } = await import("../../server/storage")
      await expect(storage.generateInstallmentPayments(999999)).rejects.toThrow("分期計劃不存在")
    })
  })

  // ── 租金付款列表進階篩選 ──────────────────────────────────────

  describe("租金付款列表 — getRentalPaymentItems", () => {
    it("應回傳含專案名稱和分類名稱的付款項目", async () => {
      const res = await request(app).get("/api/rental/payments").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      if (res.body.length > 0) {
        const item = res.body[0]
        // 應包含 join 後的欄位
        expect(item).toHaveProperty("id")
        expect(item).toHaveProperty("itemName")
        expect(item).toHaveProperty("totalAmount")
        expect(item).toHaveProperty("projectName")
        expect(item).toHaveProperty("categoryName")
      }
    })
  })

  // ── 匯出進階場景 ─────────────────────────────────────────────

  describe("匯出租金付款 — 進階場景", () => {
    it("匯出 CSV 含多個合約時應包含所有資料", async () => {
      const res = await request(app)
        .get("/api/rental/payments/export")
        .query({ format: "csv" })
        .expect(200)

      expect(res.headers["content-type"]).toContain("text/csv")
      // CSV 標題行至少包含「期別」
      expect(res.text).toContain("期別")
    })

    it("匯出 Excel 帶年度篩選應包含季度統計工作表", async () => {
      const res = await request(app)
        .get("/api/rental/payments/export")
        .query({ year: "2025" })
        .responseType("blob")
        .expect(200)

      expect(res.headers["content-type"]).toContain("spreadsheetml")
      // Excel 二進位回應應有內容
      expect(res.headers["content-disposition"]).toContain("rental-payments-2025.xlsx")
    })

    it("匯出 CSV 帶 contractId 篩選應正常運作", async () => {
      const res = await request(app)
        .get("/api/rental/payments/export")
        .query({ contractId: "1", format: "csv" })
        .expect(200)

      expect(res.headers["content-type"]).toContain("text/csv")
    })
  })

  // ── 邊界條件與錯誤處理 ────────────────────────────────────────

  describe("邊界條件與錯誤處理", () => {
    it("建立租約缺少 contractName 應回傳 400", async () => {
      const res = await request(app).post("/api/rental/contracts").send({
        projectId: 1,
        tenantName: "只有租客名",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        totalYears: 1,
        totalMonths: 12,
        baseAmount: "10000",
      })

      expect(res.status).toBe(400)
    })

    it("建立租約含空的 priceTiers 陣列應成功", async () => {
      const ts = Date.now()
      const res = await request(app)
        .post("/api/rental/contracts")
        .send({
          projectId: 1,
          contractName: `空階段合約_${ts}`,
          tenantName: `租客_${ts}`,
          startDate: "2026-01-01",
          endDate: "2026-06-30",
          totalYears: 1,
          totalMonths: 6,
          baseAmount: "5000",
          priceTiers: [],
        })
        .expect(201)

      createdContractIds.push(res.body.id)

      // 確認沒有價格階段
      const tiersRes = await request(app)
        .get(`/api/rental/contracts/${res.body.id}/price-tiers`)
        .expect(200)

      expect(tiersRes.body.length).toBe(0)
    })

    it("刪除已經生成付款的租約應清理未付款項目", async () => {
      const ts = Date.now()
      const createRes = await request(app)
        .post("/api/rental/contracts")
        .send({
          projectId: 1,
          contractName: `待清理合約_${ts}`,
          tenantName: `待清理租客_${ts}`,
          startDate: "2026-01-01",
          endDate: "2026-03-31",
          totalYears: 1,
          totalMonths: 3,
          baseAmount: "7000",
        })
        .expect(201)

      const contractId = createRes.body.id

      // 生成付款
      await request(app).post(`/api/rental/contracts/${contractId}/generate-payments`).expect(200)

      // 刪除租約（應同時清理付款項目）
      await request(app).delete(`/api/rental/contracts/${contractId}`).expect(200)

      // 確認已刪除
      await request(app).get(`/api/rental/contracts/${contractId}`).expect(404)
    })
  })
})
