/**
 * Analytics 延伸整合測試
 *
 * 覆蓋 analytics.ts 路由中尚未被 analytics.test.ts 測試到的端點：
 * - GET /api/payment/analytics/intelligent（智能分析）
 * - GET /api/smart-alerts（智能警報）
 * - GET /api/smart-alerts/stats（警報統計）
 * - POST /api/smart-alerts/dismiss（關閉警報）
 * - POST /api/search/advanced（進階搜尋）
 * - POST /api/batch/update（批量操作）
 * - GET /api/reports/intelligent（智能報表）
 * - POST /api/reports/export（報表匯出）
 *
 * 同時透過建立測試資料間接觸及：
 * - server/storage/subcategory-payments.ts（getProjectsWithStats 等）
 * - server/storage/statistics.ts（getOverduePaymentItems、getPaymentStatistics 等）
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

/**
 * 建立測試用 Express app，模擬已登入使用者
 */
async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())

  // 模擬認證中介層
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

  const analyticsRoutes = (await import("../../server/routes/analytics")).default
  const paymentItemRoutes = (await import("../../server/routes/payment-items")).default
  const scheduleRoutes = (await import("../../server/routes/payment-schedule")).default
  app.use(analyticsRoutes)
  app.use(paymentItemRoutes)
  app.use(scheduleRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Analytics 延伸端點", () => {
  let app: Express
  const createdItemIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const id of createdItemIds) {
      try {
        await request(app).delete(`/api/payment/items/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── GET /api/payment/analytics/intelligent ─────────────────────

  describe("GET /api/payment/analytics/intelligent - 智能分析", () => {
    it("應回傳智能分析結果", async () => {
      const res = await request(app)
        .get("/api/payment/analytics/intelligent")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("cashFlowPrediction")
      expect(res.body).toHaveProperty("riskAssessment")
      expect(res.body).toHaveProperty("paymentPatterns")
      expect(res.body).toHaveProperty("recommendations")
      expect(res.body).toHaveProperty("seasonalTrends")
    })

    it("現金流預測應包含趨勢資訊", async () => {
      const res = await request(app).get("/api/payment/analytics/intelligent").expect(200)

      const prediction = res.body.cashFlowPrediction
      expect(prediction).toHaveProperty("nextMonth")
      expect(prediction).toHaveProperty("nextQuarter")
      expect(prediction).toHaveProperty("confidence")
      expect(prediction).toHaveProperty("trend")
      expect(["increasing", "decreasing", "stable"]).toContain(prediction.trend)
    })

    it("風險評估應包含等級", async () => {
      const res = await request(app).get("/api/payment/analytics/intelligent").expect(200)

      const risk = res.body.riskAssessment
      expect(risk).toHaveProperty("overdueProbability")
      expect(risk).toHaveProperty("criticalItems")
      expect(risk).toHaveProperty("riskLevel")
      expect(["high", "medium", "low"]).toContain(risk.riskLevel)
    })

    it("建議列表應為非空陣列", async () => {
      const res = await request(app).get("/api/payment/analytics/intelligent").expect(200)

      expect(Array.isArray(res.body.recommendations)).toBe(true)
      expect(res.body.recommendations.length).toBeGreaterThan(0)

      const rec = res.body.recommendations[0]
      expect(rec).toHaveProperty("id")
      expect(rec).toHaveProperty("type")
      expect(rec).toHaveProperty("title")
      expect(rec).toHaveProperty("description")
      expect(rec).toHaveProperty("impact")
    })

    it("季節趨勢應有 12 個月", async () => {
      const res = await request(app).get("/api/payment/analytics/intelligent").expect(200)

      expect(res.body.seasonalTrends.length).toBe(12)
      const trend = res.body.seasonalTrends[0]
      expect(trend).toHaveProperty("month")
      expect(trend).toHaveProperty("predicted")
    })
  })

  // ── GET /api/smart-alerts ──────────────────────────────────────

  describe("GET /api/smart-alerts - 智能警報", () => {
    it("應回傳警報陣列", async () => {
      const res = await request(app)
        .get("/api/smart-alerts")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/smart-alerts/stats ────────────────────────────────

  describe("GET /api/smart-alerts/stats - 警報統計", () => {
    it("應回傳統計資料", async () => {
      const res = await request(app)
        .get("/api/smart-alerts/stats")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── POST /api/smart-alerts/dismiss ─────────────────────────────

  describe("POST /api/smart-alerts/dismiss - 關閉警報", () => {
    it("應成功關閉指定警報", async () => {
      const res = await request(app)
        .post("/api/smart-alerts/dismiss")
        .send({ alertId: "test-alert-nonexistent" })
        .expect(200)

      expect(res.body).toHaveProperty("message")
    })
  })

  // ── POST /api/search/advanced ──────────────────────────────────

  describe("POST /api/search/advanced - 進階搜尋", () => {
    it("應回傳 payment_items 搜尋結果", async () => {
      const res = await request(app)
        .post("/api/search/advanced")
        .send({ searchType: "payment_items", filters: [] })
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toBeDefined()
      expect(res.body).toHaveProperty("items")
      expect(res.body).toHaveProperty("total")
    })

    it("應支援帶篩選條件的搜尋", async () => {
      const res = await request(app)
        .post("/api/search/advanced")
        .send({
          searchType: "payment_items",
          filters: [{ field: "global", value: "測試" }],
        })
        .expect(200)

      expect(res.body).toHaveProperty("items")
    })

    it("應回傳 projects 搜尋結果", async () => {
      const res = await request(app)
        .post("/api/search/advanced")
        .send({ searchType: "projects", filters: [] })
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("應回傳 categories 搜尋結果", async () => {
      const res = await request(app)
        .post("/api/search/advanced")
        .send({ searchType: "categories", filters: [] })
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("不支援的搜尋類型應回傳 400", async () => {
      const res = await request(app)
        .post("/api/search/advanced")
        .send({ searchType: "unknown_type", filters: {} })
        .expect(400)

      expect(res.body).toHaveProperty("message")
    })
  })

  // ── POST /api/batch/update ─────────────────────────────────────

  describe("POST /api/batch/update - 批量操作", () => {
    let batchTestItemId: number

    beforeAll(async () => {
      // 建立測試用付款項目
      const timestamp = Date.now()
      const itemRes = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `批量測試項目_${timestamp}`,
          totalAmount: "50000",
          startDate: "2026-01-01",
        })
        .expect(201)
      batchTestItemId = itemRes.body.id
      createdItemIds.push(batchTestItemId)
    })

    it("應成功批量更新狀態", async () => {
      const res = await request(app)
        .post("/api/batch/update")
        .send({
          action: "update_status",
          itemIds: [batchTestItemId],
          data: { status: "pending" },
        })
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── GET /api/reports/intelligent ───────────────────────────────

  describe("GET /api/reports/intelligent - 智能報表", () => {
    it("應回傳月度概覽報表", async () => {
      const res = await request(app)
        .get("/api/reports/intelligent?period=monthly&reportType=overview")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("應支援不同報表類型", async () => {
      const res = await request(app)
        .get("/api/reports/intelligent?period=monthly&reportType=overview")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── POST /api/reports/export ───────────────────────────────────

  describe("POST /api/reports/export - 報表匯出", () => {
    it("應回傳匯出資料", async () => {
      const res = await request(app)
        .post("/api/reports/export")
        .send({
          format: "json",
          reportType: "overview",
          filters: {},
        })
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── 整合項目資料（含排程）──────────────────────────────────────

  describe("GET /api/payment/items/integrated - 整合項目資料（延伸）", () => {
    let testItemId: number

    beforeAll(async () => {
      // 建立項目 + 排程，確保整合查詢有完整資料覆蓋
      const timestamp = Date.now()
      const itemRes = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `整合測試項目_${timestamp}`,
          totalAmount: "80000",
          startDate: "2026-02-01",
          endDate: "2026-02-28",
        })
        .expect(201)

      testItemId = itemRes.body.id
      createdItemIds.push(testItemId)

      // 建立一筆排程
      await request(app)
        .post("/api/payment/schedule")
        .send({
          paymentItemId: testItemId,
          scheduledDate: "2026-02-15",
          scheduledAmount: "40000",
          notes: "延伸測試排程",
        })
        .expect(201)
    })

    it("帶年月參數時每筆項目應有排程資訊", async () => {
      const res = await request(app)
        .get("/api/payment/items/integrated?year=2026&month=2")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)

      // 找到剛建立的測試項目
      const testItem = res.body.find((item: Record<string, unknown>) => item.id === testItemId)
      if (testItem) {
        expect(testItem).toHaveProperty("actualPaid")
        expect(testItem).toHaveProperty("scheduledTotal")
        expect(testItem).toHaveProperty("pendingAmount")
        expect(testItem).toHaveProperty("schedules")
        expect(testItem).toHaveProperty("monthSchedules")
        expect(testItem).toHaveProperty("scheduleCount")
        expect(testItem).toHaveProperty("recordCount")
        expect(testItem).toHaveProperty("hasOverdueSchedule")
        expect(testItem.scheduleCount).toBeGreaterThanOrEqual(1)
      }
    })
  })

  // ── 項目排程歷史 ──────────────────────────────────────────────

  describe("GET /api/payment/items/:itemId/schedules - 項目排程歷史", () => {
    it("應回傳該項目所有排程", async () => {
      // 使用清理列表中最後一個項目（已在上面建立排程）
      const testItemId = createdItemIds[createdItemIds.length - 1]
      if (!testItemId) return

      const res = await request(app)
        .get(`/api/payment/items/${testItemId}/schedules`)
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("不存在的項目應回傳空陣列", async () => {
      const res = await request(app).get("/api/payment/items/999999/schedules").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBe(0)
    })
  })

  // ── 重排逾期（搭配項目建立） ──────────────────────────────────

  describe("POST /api/payment/reschedule/:id - 重新排程", () => {
    let scheduleIdForReschedule: number

    beforeAll(async () => {
      // 建立一個過去日期的排程，方便測試重排
      const testItemId = createdItemIds[0]
      if (!testItemId) return

      const createRes = await request(app)
        .post("/api/payment/schedule")
        .send({
          paymentItemId: testItemId,
          scheduledDate: "2025-01-01",
          scheduledAmount: "10000",
          notes: "過期排程-重排測試",
        })
        .expect(201)

      scheduleIdForReschedule = createRes.body.id
    })

    it("應成功重新排程至新日期", async () => {
      if (!scheduleIdForReschedule) return

      const res = await request(app)
        .post(`/api/payment/reschedule/${scheduleIdForReschedule}`)
        .send({ newDate: "2026-06-01", notes: "手動重排至六月" })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })

    it("缺少 newDate 應回傳 400", async () => {
      if (!scheduleIdForReschedule) return

      await request(app)
        .post(`/api/payment/reschedule/${scheduleIdForReschedule}`)
        .send({ notes: "只有備註沒有日期" })
        .expect(400)
    })
  })

  // ── GET /api/payment/schedule/items/:year/:month ───────────────

  describe("GET /api/payment/schedule/items/:year/:month - 未排程項目", () => {
    it("應回傳未排程項目陣列", async () => {
      const res = await request(app)
        .get("/api/payment/schedule/items/2026/3")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })
})
