/**
 * Late Fee API 整合測試
 *
 * 測試：
 * - GET /api/late-fee/annual-loss
 * - GET /api/late-fee/reminder-status
 *
 * 使用 vi.mock 隔離 service 層，不依賴 DB
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import request from "supertest"
import type { Express } from "express"

// Mock service 層（vi.mock hoisted）
vi.mock("../../server/services/late-fee.service", () => ({
  getAnnualLossReport: vi.fn(),
  getTodayReminderStatus: vi.fn(),
}))

import * as LateFeeService from "../../server/services/late-fee.service"

const mockGetAnnualLossReport = vi.mocked(LateFeeService.getAnnualLossReport)
const mockGetTodayReminderStatus = vi.mocked(LateFeeService.getTodayReminderStatus)

// ─────────────────────────────────────────────
// Test App 工廠（bypass auth）
// ─────────────────────────────────────────────

interface MockAuthedRequest {
  user: { id: number; username: string; isActive: boolean }
  isAuthenticated: () => boolean
  session: Record<string, unknown>
}

async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())

  app.use((req, _res, next) => {
    const reqWithAuth = req as typeof req & MockAuthedRequest
    reqWithAuth.user = { id: 1, username: "admin", isActive: true }
    reqWithAuth.isAuthenticated = () => true
    reqWithAuth.session = { userId: 1, isAuthenticated: true }
    next()
  })

  const routes = (await import("../../server/routes/late-fee")).default
  app.use(routes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

// ─────────────────────────────────────────────
// 測試資料工廠
// ─────────────────────────────────────────────

function createAnnualReport(overrides: Record<string, unknown> = {}) {
  return {
    year: 2026,
    itemCount: 0,
    totalPrincipal: 0,
    totalLateFee: 0,
    lossPercentage: 0,
    items: [],
    generatedAt: new Date("2026-04-25T00:00:00.000Z"),
    ...overrides,
  }
}

function createReminderStatus(overrides: Record<string, unknown> = {}) {
  return {
    today: "2026-04-25",
    level: "warning" as const,
    shouldRemind: true,
    pendingCount: 0,
    pendingTotalAmount: 0,
    pendingTotalLateFee: 0,
    items: [],
    ...overrides,
  }
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe("Late Fee API", () => {
  let app: Express

  beforeAll(async () => {
    app = await createTestApp()
  })

  beforeEach(() => {
    mockGetAnnualLossReport.mockReset()
    mockGetTodayReminderStatus.mockReset()
  })

  // ── GET /api/late-fee/annual-loss ────────────────────────────

  describe("GET /api/late-fee/annual-loss", () => {
    it("未提供 year 應使用當前年度", async () => {
      mockGetAnnualLossReport.mockResolvedValueOnce(createAnnualReport())

      const res = await request(app).get("/api/late-fee/annual-loss").expect(200)

      expect(res.body).toHaveProperty("year")
      expect(res.body).toHaveProperty("itemCount")
      expect(res.body).toHaveProperty("totalLateFee")
      expect(res.body).toHaveProperty("lossPercentage")
      expect(mockGetAnnualLossReport).toHaveBeenCalledTimes(1)
    })

    it("指定 year=2026 應傳給 service", async () => {
      mockGetAnnualLossReport.mockResolvedValueOnce(createAnnualReport({ year: 2026 }))

      await request(app).get("/api/late-fee/annual-loss?year=2026").expect(200)

      expect(mockGetAnnualLossReport).toHaveBeenCalledWith(2026)
    })

    it("year=2025 應正確傳給 service", async () => {
      mockGetAnnualLossReport.mockResolvedValueOnce(createAnnualReport({ year: 2025 }))

      await request(app).get("/api/late-fee/annual-loss?year=2025").expect(200)

      expect(mockGetAnnualLossReport).toHaveBeenCalledWith(2025)
    })

    it("year 非法（非數字）應回 400", async () => {
      const res = await request(app).get("/api/late-fee/annual-loss?year=abc")
      expect(res.status).toBe(400)
      expect(mockGetAnnualLossReport).not.toHaveBeenCalled()
    })

    it("year 超出合理範圍（< 2000）應回 400", async () => {
      const res = await request(app).get("/api/late-fee/annual-loss?year=1999")
      expect(res.status).toBe(400)
      expect(mockGetAnnualLossReport).not.toHaveBeenCalled()
    })

    it("year 超出合理範圍（> 2100）應回 400", async () => {
      const res = await request(app).get("/api/late-fee/annual-loss?year=2101")
      expect(res.status).toBe(400)
      expect(mockGetAnnualLossReport).not.toHaveBeenCalled()
    })

    it("應回傳完整報告欄位", async () => {
      mockGetAnnualLossReport.mockResolvedValueOnce(
        createAnnualReport({
          itemCount: 3,
          totalPrincipal: 360000,
          totalLateFee: 14400,
          lossPercentage: 4.0,
          items: [
            {
              itemId: 1,
              itemName: "勞健保 3 月",
              dueDate: "2026-03-25",
              paymentDate: "2026-04-05",
              daysOverdue: 11,
              amount: 120000,
              lateFee: 3960,
              status: "paid_late",
            },
          ],
        })
      )

      const res = await request(app).get("/api/late-fee/annual-loss?year=2026").expect(200)
      expect(res.body.itemCount).toBe(3)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].itemName).toBe("勞健保 3 月")
    })

    it("service 拋錯應回 500", async () => {
      mockGetAnnualLossReport.mockRejectedValueOnce(new Error("DB 連線失敗"))

      const res = await request(app).get("/api/late-fee/annual-loss?year=2026").expect(500)
      expect(res.body).toHaveProperty("message")
    })
  })

  // ── GET /api/late-fee/reminder-status ────────────────────────

  describe("GET /api/late-fee/reminder-status", () => {
    it("應回傳完整的提醒狀態", async () => {
      mockGetTodayReminderStatus.mockResolvedValueOnce(createReminderStatus())

      const res = await request(app).get("/api/late-fee/reminder-status").expect(200)

      expect(res.body).toHaveProperty("today")
      expect(res.body).toHaveProperty("level")
      expect(res.body).toHaveProperty("shouldRemind")
      expect(res.body).toHaveProperty("pendingCount")
      expect(res.body).toHaveProperty("items")
      expect(mockGetTodayReminderStatus).toHaveBeenCalledTimes(1)
    })

    it("level=early 應正確回傳", async () => {
      mockGetTodayReminderStatus.mockResolvedValueOnce(
        createReminderStatus({ level: "early", today: "2026-04-20" })
      )

      const res = await request(app).get("/api/late-fee/reminder-status").expect(200)
      expect(res.body.level).toBe("early")
    })

    it("level=final + 有待處理項目", async () => {
      mockGetTodayReminderStatus.mockResolvedValueOnce(
        createReminderStatus({
          level: "final",
          pendingCount: 2,
          pendingTotalAmount: 240000,
          pendingTotalLateFee: 5760,
          items: [
            {
              id: 1,
              itemName: "勞健保 3 月",
              dueDate: "2026-03-25",
              daysOverdue: 8,
              unpaidAmount: 120000,
              lateFee: 2880,
            },
          ],
        })
      )

      const res = await request(app).get("/api/late-fee/reminder-status").expect(200)
      expect(res.body.level).toBe("final")
      expect(res.body.pendingCount).toBe(2)
      expect(res.body.pendingTotalLateFee).toBe(5760)
    })

    it("service 拋錯應回 500", async () => {
      mockGetTodayReminderStatus.mockRejectedValueOnce(new Error("DB 錯誤"))

      const res = await request(app).get("/api/late-fee/reminder-status").expect(500)
      expect(res.body).toHaveProperty("message")
    })
  })
})
