/**
 * Payment Allocation API 整合測試
 *
 * 測試 /api/payment/priority-report 與 /api/payment/allocation-suggest
 *
 * 設計：
 * - 使用 vi.mock 隔離 service 層，讓測試不依賴 DB
 * - 專注於驗證 API 層的輸入驗證、回傳格式、錯誤處理
 * - Service 本身已在 payment-priority-service.test.ts 達 100% 覆蓋
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import request from "supertest"
import type { Express } from "express"

// Mock service 層（必須在頂層呼叫以 hoist 到 import 前）
vi.mock("../../server/services/payment-priority.service", () => ({
  getPriorityReport: vi.fn(),
  suggestAllocation: vi.fn(),
}))

// 取得 mock（type-safe）
import * as PaymentPriorityService from "../../server/services/payment-priority.service"

const mockGetPriorityReport = vi.mocked(PaymentPriorityService.getPriorityReport)
const mockSuggestAllocation = vi.mocked(PaymentPriorityService.suggestAllocation)

// ─────────────────────────────────────────────
// 測試 App 工廠（輕量版，bypass auth）
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

  // Mock auth：所有請求視為 admin 已登入
  app.use((req, _res, next) => {
    const reqWithAuth = req as typeof req & MockAuthedRequest
    reqWithAuth.user = { id: 1, username: "admin", isActive: true }
    reqWithAuth.isAuthenticated = () => true
    reqWithAuth.session = { userId: 1, isAuthenticated: true }
    next()
  })

  const routes = (await import("../../server/routes/payment-allocation")).default
  app.use(routes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

// ─────────────────────────────────────────────
// 測試資料工廠
// ─────────────────────────────────────────────

function createEmptyReport() {
  return {
    generatedAt: new Date("2026-04-25T00:00:00.000Z"),
    totalUnpaid: 0,
    counts: { critical: 0, high: 0, medium: 0, low: 0 },
    byUrgency: { critical: [], high: [], medium: [], low: [] },
    all: [],
  }
}

function createEmptyAllocation(budget: number) {
  return {
    generatedAt: new Date("2026-04-25T00:00:00.000Z"),
    availableBudget: budget,
    totalNeeded: 0,
    suggested: [],
    suggestedTotal: 0,
    deferred: [],
    deferredTotal: 0,
    shortage: 0,
    surplus: budget,
    markdown: "# 空清單",
  }
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe("Payment Allocation API", () => {
  let app: Express

  beforeAll(async () => {
    app = await createTestApp()
  })

  beforeEach(() => {
    mockGetPriorityReport.mockReset()
    mockSuggestAllocation.mockReset()
  })

  // ── GET /api/payment/priority-report ────────────────────────────

  describe("GET /api/payment/priority-report", () => {
    it("應回傳完整的優先級報告", async () => {
      mockGetPriorityReport.mockResolvedValueOnce(createEmptyReport())

      const res = await request(app)
        .get("/api/payment/priority-report")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("totalUnpaid")
      expect(res.body).toHaveProperty("counts")
      expect(res.body).toHaveProperty("byUrgency")
      expect(res.body).toHaveProperty("all")
      expect(res.body.counts).toEqual({ critical: 0, high: 0, medium: 0, low: 0 })
    })

    it("預設 includeLow 為 false", async () => {
      mockGetPriorityReport.mockResolvedValueOnce(createEmptyReport())

      await request(app).get("/api/payment/priority-report").expect(200)

      expect(mockGetPriorityReport).toHaveBeenCalledWith({ includeLow: false })
    })

    it("includeLow=true 應傳給 service", async () => {
      mockGetPriorityReport.mockResolvedValueOnce(createEmptyReport())

      await request(app).get("/api/payment/priority-report?includeLow=true").expect(200)

      expect(mockGetPriorityReport).toHaveBeenCalledWith({ includeLow: true })
    })

    it("service 拋錯應回 500", async () => {
      mockGetPriorityReport.mockRejectedValueOnce(new Error("DB 連線失敗"))

      const res = await request(app).get("/api/payment/priority-report").expect(500)
      expect(res.body).toHaveProperty("message")
    })
  })

  // ── POST /api/payment/allocation-suggest ────────────────────────

  describe("POST /api/payment/allocation-suggest", () => {
    it("正常請求應回傳分配建議", async () => {
      mockSuggestAllocation.mockResolvedValueOnce(createEmptyAllocation(300000))

      const res = await request(app)
        .post("/api/payment/allocation-suggest")
        .send({ availableBudget: 300000 })
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body.availableBudget).toBe(300000)
      expect(res.body).toHaveProperty("suggested")
      expect(res.body).toHaveProperty("deferred")
      expect(res.body).toHaveProperty("shortage")
      expect(res.body).toHaveProperty("surplus")
      expect(res.body).toHaveProperty("markdown")
    })

    it("應將 availableBudget 正確傳給 service", async () => {
      mockSuggestAllocation.mockResolvedValueOnce(createEmptyAllocation(500000))

      await request(app)
        .post("/api/payment/allocation-suggest")
        .send({ availableBudget: 500000 })
        .expect(200)

      expect(mockSuggestAllocation).toHaveBeenCalledWith({
        availableBudget: 500000,
        asOf: undefined,
      })
    })

    it("asOf 應被解析為 Date 傳入 service", async () => {
      mockSuggestAllocation.mockResolvedValueOnce(createEmptyAllocation(100000))

      await request(app)
        .post("/api/payment/allocation-suggest")
        .send({ availableBudget: 100000, asOf: "2026-05-01T00:00:00.000Z" })
        .expect(200)

      const callArg = mockSuggestAllocation.mock.calls[0][0]
      expect(callArg.availableBudget).toBe(100000)
      expect(callArg.asOf).toBeInstanceOf(Date)
      expect(callArg.asOf?.toISOString()).toBe("2026-05-01T00:00:00.000Z")
    })

    it("缺少 availableBudget 應回 400", async () => {
      const res = await request(app).post("/api/payment/allocation-suggest").send({})
      expect(res.status).toBe(400)
      expect(mockSuggestAllocation).not.toHaveBeenCalled()
    })

    it("availableBudget 為負數應回 400", async () => {
      const res = await request(app)
        .post("/api/payment/allocation-suggest")
        .send({ availableBudget: -1000 })
      expect(res.status).toBe(400)
      expect(mockSuggestAllocation).not.toHaveBeenCalled()
    })

    it("availableBudget 為字串應回 400", async () => {
      const res = await request(app)
        .post("/api/payment/allocation-suggest")
        .send({ availableBudget: "300000" })
      expect(res.status).toBe(400)
      expect(mockSuggestAllocation).not.toHaveBeenCalled()
    })

    it("availableBudget 為 0 應允許（代表沒錢）", async () => {
      mockSuggestAllocation.mockResolvedValueOnce(createEmptyAllocation(0))

      await request(app)
        .post("/api/payment/allocation-suggest")
        .send({ availableBudget: 0 })
        .expect(200)
    })

    it("asOf 格式錯誤應回 400", async () => {
      const res = await request(app)
        .post("/api/payment/allocation-suggest")
        .send({ availableBudget: 100000, asOf: "not-a-date" })
      expect(res.status).toBe(400)
      expect(mockSuggestAllocation).not.toHaveBeenCalled()
    })

    it("service 拋錯應回 500", async () => {
      mockSuggestAllocation.mockRejectedValueOnce(new Error("DB 連線失敗"))

      const res = await request(app)
        .post("/api/payment/allocation-suggest")
        .send({ availableBudget: 100000 })
        .expect(500)
      expect(res.body).toHaveProperty("message")
    })

    it("availableBudget 為 Infinity 應回 400", async () => {
      const res = await request(app)
        .post("/api/payment/allocation-suggest")
        .send({ availableBudget: "Infinity" })
      expect(res.status).toBe(400)
      expect(mockSuggestAllocation).not.toHaveBeenCalled()
    })
  })
})
