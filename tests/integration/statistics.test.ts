/**
 * Statistics 整合測試
 *
 * 覆蓋 server/storage/statistics.ts 的端點：
 * - GET /api/payment-statistics（付款統計）
 * - GET /api/payment-overview（付款總覽）
 * - GET /api/payment/items/paginated（分頁付款項目）
 * - GET /api/payment/items/overdue（逾期付款項目）
 * - GET /api/payment/project/stats（專案統計）
 *
 * 透過 analytics + payment-items + payment-schedule 路由間接觸及 statistics.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

/**
 * 建立測試用 Express app，模擬已登入使用者
 * 掛載 analytics、payment-items、payment-schedule 路由
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

  // 掛載路由
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

describe.skipIf(skipIfNoDb)("Statistics 相關端點", () => {
  let app: Express
  const createdItemIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    // 清理測試資料
    for (const id of createdItemIds) {
      try {
        await request(app).delete(`/api/payment/items/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── GET /api/payment-statistics ────────────────────────────────

  describe("GET /api/payment-statistics - 付款統計", () => {
    it("應回傳統計資料（無篩選）", async () => {
      const res = await request(app)
        .get("/api/payment-statistics")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("應支援日期範圍篩選", async () => {
      const res = await request(app)
        .get("/api/payment-statistics?startDate=2025-01-01&endDate=2026-12-31")
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("應支援 projectId 篩選", async () => {
      const res = await request(app).get("/api/payment-statistics?projectId=1").expect(200)

      expect(res.body).toBeDefined()
    })

    it("應支援 categoryId 篩選", async () => {
      const res = await request(app).get("/api/payment-statistics?categoryId=1").expect(200)

      expect(res.body).toBeDefined()
    })

    it("應同時支援多個篩選條件", async () => {
      const res = await request(app)
        .get(
          "/api/payment-statistics?startDate=2025-01-01&endDate=2026-12-31&projectId=1&categoryId=1"
        )
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── GET /api/payment-overview ──────────────────────────────────

  describe("GET /api/payment-overview - 付款總覽", () => {
    it("應回傳總覽資料", async () => {
      const res = await request(app)
        .get("/api/payment-overview")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── GET /api/payment/items/paginated ───────────────────────────

  describe("GET /api/payment/items/paginated - 分頁付款項目", () => {
    it("應回傳分頁結構", async () => {
      const res = await request(app)
        .get("/api/payment/items/paginated")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("items")
      expect(res.body).toHaveProperty("pagination")
      expect(Array.isArray(res.body.items)).toBe(true)
      expect(res.body.pagination).toHaveProperty("currentPage")
      expect(res.body.pagination).toHaveProperty("pageSize")
      expect(res.body.pagination).toHaveProperty("totalItems")
      expect(res.body.pagination).toHaveProperty("totalPages")
      expect(res.body.pagination).toHaveProperty("hasNextPage")
      expect(res.body.pagination).toHaveProperty("hasPreviousPage")
    })

    it("應支援自訂分頁大小", async () => {
      const res = await request(app)
        .get("/api/payment/items/paginated?page=1&pageSize=10")
        .expect(200)

      expect(res.body.pagination.currentPage).toBe(1)
      expect(res.body.pagination.pageSize).toBe(10)
    })

    it("應限制 pageSize 最大值為 100", async () => {
      const res = await request(app).get("/api/payment/items/paginated?pageSize=999").expect(200)

      expect(res.body.pagination.pageSize).toBeLessThanOrEqual(100)
    })

    it("應支援 projectId 篩選", async () => {
      const res = await request(app).get("/api/payment/items/paginated?projectId=1").expect(200)

      expect(res.body).toHaveProperty("items")
    })

    it("應支援 status 篩選", async () => {
      const res = await request(app).get("/api/payment/items/paginated?status=pending").expect(200)

      expect(res.body).toHaveProperty("items")
    })

    it("應支援日期範圍篩選", async () => {
      const res = await request(app)
        .get("/api/payment/items/paginated?startDate=2025-01-01&endDate=2026-12-31")
        .expect(200)

      expect(res.body).toHaveProperty("items")
    })

    it("應支援 includeDeleted 參數", async () => {
      const res = await request(app)
        .get("/api/payment/items/paginated?includeDeleted=true")
        .expect(200)

      expect(res.body).toHaveProperty("items")
    })

    it("分頁結果不應超過指定頁面大小", async () => {
      const res = await request(app).get("/api/payment/items/paginated?pageSize=5").expect(200)

      expect(res.body.items.length).toBeLessThanOrEqual(5)
    })
  })

  // ── GET /api/payment/items/overdue ─────────────────────────────

  describe("GET /api/payment/items/overdue - 逾期付款項目", () => {
    it("應回傳逾期項目陣列", async () => {
      const res = await request(app)
        .get("/api/payment/items/overdue")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("逾期項目應包含必要欄位", async () => {
      const res = await request(app).get("/api/payment/items/overdue").expect(200)

      if (res.body.length > 0) {
        const item = res.body[0]
        expect(item).toHaveProperty("id")
        expect(item).toHaveProperty("itemName")
        expect(item).toHaveProperty("totalAmount")
        expect(item).toHaveProperty("status")
        expect(item).toHaveProperty("categoryName")
        expect(item).toHaveProperty("projectName")
      }
    })
  })

  // ── GET /api/payment/project/stats ─────────────────────────────

  describe("GET /api/payment/project/stats - 付款專案詳細統計", () => {
    it("應回傳統計摘要", async () => {
      const res = await request(app)
        .get("/api/payment/project/stats")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("totalPlanned")
      expect(res.body).toHaveProperty("totalPaid")
      expect(res.body).toHaveProperty("totalUnpaid")
      expect(res.body).toHaveProperty("completionRate")
      expect(res.body).toHaveProperty("monthlyPaid")
      expect(res.body).toHaveProperty("overdueAmount")
      expect(res.body).toHaveProperty("totalItems")
    })

    it("統計值應為字串格式的數字", async () => {
      const res = await request(app).get("/api/payment/project/stats").expect(200)

      // totalPlanned 等欄位回傳為 string
      expect(typeof res.body.totalPlanned).toBe("string")
      expect(typeof res.body.totalPaid).toBe("string")
      expect(typeof res.body.completionRate).toBe("string")
    })
  })

  // ── GET /api/payment/schedule/stats/:year/:month ───────────────

  describe("GET /api/payment/schedule/stats/:year/:month - 排程統計（間接觸及 statistics）", () => {
    it("空月份應回傳零值", async () => {
      const res = await request(app).get("/api/payment/schedule/stats/2020/1").expect(200)

      expect(res.body.year).toBe(2020)
      expect(res.body.month).toBe(1)
      expect(res.body.totalCount).toBe(0)
      expect(res.body.totalAmount).toBe(0)
    })
  })

  // ── GET /api/payment/cashflow/stats ────────────────────────────

  describe("GET /api/payment/cashflow/stats - 現金流統計（進階）", () => {
    it("應回傳按專案分組的統計", async () => {
      const res = await request(app).get("/api/payment/cashflow/stats").expect(200)

      expect(res.body).toHaveProperty("projectStats")
      expect(Array.isArray(res.body.projectStats)).toBe(true)
    })

    it("projectStats 內項目應包含必要欄位", async () => {
      const res = await request(app).get("/api/payment/cashflow/stats").expect(200)

      if (res.body.projectStats.length > 0) {
        const stat = res.body.projectStats[0]
        expect(stat).toHaveProperty("projectId")
        expect(stat).toHaveProperty("projectName")
        expect(stat).toHaveProperty("totalPaid")
        expect(stat).toHaveProperty("recordCount")
      }
    })
  })

  // ── GET /api/payment/cashflow/details ──────────────────────────

  describe("GET /api/payment/cashflow/details - 現金流詳細項目", () => {
    it("應回傳分頁結構", async () => {
      const res = await request(app)
        .get("/api/payment/cashflow/details")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("items")
      expect(res.body).toHaveProperty("pagination")
      expect(res.body).toHaveProperty("summary")
      expect(Array.isArray(res.body.items)).toBe(true)
    })

    it("應支援年月篩選", async () => {
      const res = await request(app)
        .get("/api/payment/cashflow/details?year=2026&month=1")
        .expect(200)

      expect(res.body.summary.period.year).toBe(2026)
      expect(res.body.summary.period.month).toBe(1)
    })

    it("分頁應正確限制筆數", async () => {
      const res = await request(app).get("/api/payment/cashflow/details?page=1&limit=5").expect(200)

      expect(res.body.items.length).toBeLessThanOrEqual(5)
      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.limit).toBe(5)
    })

    it("詳細項目應包含必要欄位", async () => {
      const res = await request(app).get("/api/payment/cashflow/details").expect(200)

      if (res.body.items.length > 0) {
        const item = res.body.items[0]
        expect(item).toHaveProperty("recordId")
        expect(item).toHaveProperty("itemId")
        expect(item).toHaveProperty("itemName")
        expect(item).toHaveProperty("amount")
        expect(item).toHaveProperty("paymentDate")
        expect(item).toHaveProperty("projectName")
      }
    })
  })
})
