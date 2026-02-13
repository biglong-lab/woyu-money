/**
 * Reports API 整合測試
 * 測試財務報表、人事費報表、稅務報表
 */
import { describe, it, expect, beforeAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())

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

  const reportRoutes = (await import("../../server/routes/reports")).default
  app.use(reportRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Reports API", () => {
  let app: Express

  beforeAll(async () => {
    app = await createTestApp()
  })

  // ── GET /api/reports/income-statement ───────────────────────────

  describe("GET /api/reports/income-statement - 損益表", () => {
    it("應回傳損益表資料", async () => {
      const res = await request(app)
        .get("/api/reports/income-statement?year=2026&month=1")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("不帶參數應使用當前日期", async () => {
      const res = await request(app)
        .get("/api/reports/income-statement")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── GET /api/reports/balance-sheet ──────────────────────────────

  describe("GET /api/reports/balance-sheet - 資產負債表", () => {
    it("應回傳資產負債表資料", async () => {
      const res = await request(app)
        .get("/api/reports/balance-sheet?year=2026&month=1")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── GET /api/reports/cash-flow ─────────────────────────────────

  describe("GET /api/reports/cash-flow - 現金流量表", () => {
    it("應回傳現金流量表資料", async () => {
      const res = await request(app)
        .get("/api/reports/cash-flow?year=2026&month=1")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── GET /api/reports/hr-cost-report ────────────────────────────

  describe("GET /api/reports/hr-cost-report - 人事費年度報表", () => {
    it("應回傳人事費年度報表", async () => {
      const res = await request(app)
        .get("/api/reports/hr-cost-report?year=2026")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── GET /api/reports/hr-cost-report/:year/:month ───────────────

  describe("GET /api/reports/hr-cost-report/:year/:month - 人事費月報", () => {
    it("應回傳人事費月度明細", async () => {
      const res = await request(app)
        .get("/api/reports/hr-cost-report/2026/1")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── GET /api/reports/tax/business-tax ──────────────────────────

  describe("GET /api/reports/tax/business-tax - 營業稅彙總", () => {
    it("應回傳營業稅報表", async () => {
      const res = await request(app)
        .get("/api/reports/tax/business-tax?year=2026&period=1")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── GET /api/reports/tax/salary-withholding ────────────────────

  describe("GET /api/reports/tax/salary-withholding - 薪資扣繳", () => {
    it("應回傳薪資扣繳彙總", async () => {
      const res = await request(app)
        .get("/api/reports/tax/salary-withholding?year=2026")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ── GET /api/reports/tax/supplementary-health ──────────────────

  describe("GET /api/reports/tax/supplementary-health - 二代健保", () => {
    it("應回傳二代健保補充保費試算", async () => {
      const res = await request(app)
        .get("/api/reports/tax/supplementary-health?year=2026")
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })
})
