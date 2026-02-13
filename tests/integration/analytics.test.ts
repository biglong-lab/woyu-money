/**
 * Analytics API 整合測試
 * 測試專案統計、現金流統計
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

  const analyticsRoutes = (await import("../../server/routes/analytics")).default
  app.use(analyticsRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Analytics API", () => {
  let app: Express

  beforeAll(async () => {
    app = await createTestApp()
  })

  // ── GET /api/payment/projects/stats ────────────────────────────

  describe("GET /api/payment/projects/stats - 專案統計", () => {
    it("應回傳專案統計資料", async () => {
      const res = await request(app)
        .get("/api/payment/projects/stats")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("totalProjects")
      expect(res.body).toHaveProperty("projects")
      expect(Array.isArray(res.body.projects)).toBe(true)
    })

    it("每個專案應包含統計欄位", async () => {
      const res = await request(app)
        .get("/api/payment/projects/stats")
        .expect(200)

      if (res.body.projects.length > 0) {
        const project = res.body.projects[0]
        expect(project).toHaveProperty("id")
        expect(project).toHaveProperty("projectName")
        expect(project).toHaveProperty("totalPlanned")
        expect(project).toHaveProperty("totalPaid")
        expect(project).toHaveProperty("completionRate")
      }
    })
  })

  // ── GET /api/payment/cashflow/stats ────────────────────────────

  describe("GET /api/payment/cashflow/stats - 現金流統計", () => {
    it("應回傳現金流統計", async () => {
      const res = await request(app)
        .get("/api/payment/cashflow/stats")
        .expect(200)

      expect(res.body).toHaveProperty("totalCashOutflow")
      expect(res.body).toHaveProperty("recordCount")
      expect(res.body).toHaveProperty("projectStats")
      expect(res.body).toHaveProperty("period")
    })

    it("應支援年月篩選", async () => {
      const res = await request(app)
        .get("/api/payment/cashflow/stats?year=2026&month=1")
        .expect(200)

      expect(res.body).toHaveProperty("totalCashOutflow")
    })
  })
})
