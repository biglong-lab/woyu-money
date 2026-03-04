/**
 * 子分類付款 (subcategory-payments) 整合測試
 *
 * 直接呼叫 storage 層函式，覆蓋 server/storage/subcategory-payments.ts：
 * - getSubcategoryStatus（子分類付款狀態）
 * - getSubcategoryPaymentPriority（子分類付款優先順序）
 * - processSubcategoryPayment（子分類統一付款）
 * - getUnifiedPaymentData（統一付款資料）
 * - executeUnifiedPayment（執行統一付款）
 * - getProjectsWithStats（專案統計）
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

/**
 * 建立測試用 Express app，掛載 payment-items + categories 路由
 * 用於建立/清理測試資料
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

  const paymentItemRoutes = (await import("../../server/routes/payment-items")).default
  const categoryRoutes = (await import("../../server/routes/categories")).default
  app.use(paymentItemRoutes)
  app.use(categoryRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getSubcategoryStatus — 子分類付款狀態
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("getSubcategoryStatus - 子分類付款狀態", () => {
  let getSubcategoryStatus: typeof import("../../server/storage/subcategory-payments").getSubcategoryStatus

  beforeAll(async () => {
    const mod = await import("../../server/storage/subcategory-payments")
    getSubcategoryStatus = mod.getSubcategoryStatus
  })

  it("應回傳子分類狀態陣列", async () => {
    const result = await getSubcategoryStatus(1)

    expect(Array.isArray(result)).toBe(true)
  })

  it("每筆子分類狀態應包含必要結構", async () => {
    const result = await getSubcategoryStatus(1)

    for (const item of result) {
      expect(item).toHaveProperty("subcategoryId")
      expect(item).toHaveProperty("subcategoryName")
      expect(item).toHaveProperty("currentMonth")
      expect(item).toHaveProperty("accumulated")
      expect(item).toHaveProperty("installments")
      expect(item).toHaveProperty("remainingAmount")
    }
  })

  it("currentMonth 應包含 totalDue、totalPaid、unpaidItems", async () => {
    const result = await getSubcategoryStatus(1)

    for (const item of result) {
      expect(item.currentMonth).toHaveProperty("totalDue")
      expect(item.currentMonth).toHaveProperty("totalPaid")
      expect(item.currentMonth).toHaveProperty("unpaidItems")
    }
  })

  it("accumulated 應包含 totalUnpaid、overdueItems", async () => {
    const result = await getSubcategoryStatus(1)

    for (const item of result) {
      expect(item.accumulated).toHaveProperty("totalUnpaid")
      expect(item.accumulated).toHaveProperty("overdueItems")
    }
  })

  it("installments 應包含 totalInstallments、completedInstallments", async () => {
    const result = await getSubcategoryStatus(1)

    for (const item of result) {
      expect(item.installments).toHaveProperty("totalInstallments")
      expect(item.installments).toHaveProperty("completedInstallments")
    }
  })

  it("帶 projectId 篩選時應正常運作", async () => {
    const result = await getSubcategoryStatus(1, 1)

    expect(Array.isArray(result)).toBe(true)
  })

  it("不存在的 parentCategoryId 應回傳結果（查全部 project 類型分類）", async () => {
    // getSubcategoryStatus 實際上查詢所有 project 類型分類
    const result = await getSubcategoryStatus(999999)

    expect(Array.isArray(result)).toBe(true)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getSubcategoryPaymentPriority — 子分類付款優先順序
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("getSubcategoryPaymentPriority - 付款優先順序", () => {
  let getSubcategoryPaymentPriority: typeof import("../../server/storage/subcategory-payments").getSubcategoryPaymentPriority

  beforeAll(async () => {
    const mod = await import("../../server/storage/subcategory-payments")
    getSubcategoryPaymentPriority = mod.getSubcategoryPaymentPriority
  })

  it("應回傳付款項目陣列", async () => {
    const result = await getSubcategoryPaymentPriority(1)

    expect(Array.isArray(result)).toBe(true)
  })

  it("不存在的 subcategoryId 應回傳空陣列", async () => {
    const result = await getSubcategoryPaymentPriority(999999)

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })

  it("回傳的項目應排除已付清項目", async () => {
    const result = await getSubcategoryPaymentPriority(1)

    for (const item of result) {
      expect(item.status).not.toBe("paid")
    }
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// processSubcategoryPayment — 子分類統一付款（含資料異動）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("processSubcategoryPayment - 子分類統一付款", () => {
  let app: Express
  let processSubcategoryPayment: typeof import("../../server/storage/subcategory-payments").processSubcategoryPayment
  let testCategoryId: number
  const createdItemIds: number[] = []
  const createdCategoryIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
    const mod = await import("../../server/storage/subcategory-payments")
    processSubcategoryPayment = mod.processSubcategoryPayment

    // 建立測試分類
    const timestamp = Date.now()
    const catRes = await request(app)
      .post("/api/categories")
      .send({
        categoryName: `子分類付款測試_${timestamp}`,
        categoryType: "project",
      })
      .expect(201)
    testCategoryId = catRes.body.id
    createdCategoryIds.push(testCategoryId)

    // 建立測試付款項目（未付清）
    for (let i = 0; i < 2; i++) {
      const itemRes = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `子分類付款項目_${timestamp}_${i}`,
          totalAmount: `${(i + 1) * 5000}`,
          categoryId: testCategoryId,
          startDate: "2026-01-01",
          status: "pending",
        })
        .expect(201)
      createdItemIds.push(itemRes.body.id)
    }
  })

  afterAll(async () => {
    for (const id of createdItemIds) {
      try {
        await request(app).delete(`/api/payment/items/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
    for (const id of createdCategoryIds) {
      try {
        await request(app).delete(`/api/categories/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  it("應分配付款並回傳結果", async () => {
    const result = await processSubcategoryPayment(
      testCategoryId,
      "3000",
      "2026-03-01",
      "測試使用者"
    )

    expect(result).toHaveProperty("allocatedPayments")
    expect(result).toHaveProperty("remainingAmount")
    expect(Array.isArray(result.allocatedPayments)).toBe(true)
  })

  it("分配結果應包含正確的欄位", async () => {
    const result = await processSubcategoryPayment(
      testCategoryId,
      "1000",
      "2026-03-02",
      "測試使用者"
    )

    for (const payment of result.allocatedPayments) {
      expect(payment).toHaveProperty("itemId")
      expect(payment).toHaveProperty("itemName")
      expect(payment).toHaveProperty("allocatedAmount")
      expect(payment).toHaveProperty("isFullyPaid")
    }
  })

  it("付款金額為 0 時應回傳空分配", async () => {
    const result = await processSubcategoryPayment(testCategoryId, "0", "2026-03-03")

    expect(result.allocatedPayments.length).toBe(0)
    expect(result.remainingAmount).toBe("0.00")
  })

  it("不存在的分類應回傳空分配（無符合項目）", async () => {
    const result = await processSubcategoryPayment(999999, "5000", "2026-03-04")

    expect(result.allocatedPayments.length).toBe(0)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getUnifiedPaymentData — 統一付款資料
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("getUnifiedPaymentData - 統一付款資料", () => {
  let getUnifiedPaymentData: typeof import("../../server/storage/subcategory-payments").getUnifiedPaymentData

  beforeAll(async () => {
    const mod = await import("../../server/storage/subcategory-payments")
    getUnifiedPaymentData = mod.getUnifiedPaymentData
  })

  it("無篩選時應回傳所有未付清項目", async () => {
    const result = await getUnifiedPaymentData()

    expect(result).toHaveProperty("items")
    expect(result).toHaveProperty("totalAmount")
    expect(result).toHaveProperty("overdueAmount")
    expect(result).toHaveProperty("currentMonthAmount")
    expect(result).toHaveProperty("futureAmount")
    expect(Array.isArray(result.items)).toBe(true)
  })

  it("金額欄位應為數字型別", async () => {
    const result = await getUnifiedPaymentData()

    expect(typeof result.totalAmount).toBe("number")
    expect(typeof result.overdueAmount).toBe("number")
    expect(typeof result.currentMonthAmount).toBe("number")
    expect(typeof result.futureAmount).toBe("number")
  })

  it("帶 projectId 篩選應正常運作", async () => {
    const result = await getUnifiedPaymentData(1)

    expect(result).toHaveProperty("items")
    expect(Array.isArray(result.items)).toBe(true)
  })

  it("帶 categoryId 篩選應正常運作", async () => {
    const result = await getUnifiedPaymentData(undefined, 1)

    expect(result).toHaveProperty("items")
    expect(Array.isArray(result.items)).toBe(true)
  })

  it("同時帶 projectId 和 categoryId 應正常運作", async () => {
    const result = await getUnifiedPaymentData(1, 1)

    expect(result).toHaveProperty("items")
    expect(result.totalAmount).toBeGreaterThanOrEqual(0)
  })

  it("不存在的 projectId 應回傳空結果", async () => {
    const result = await getUnifiedPaymentData(999999)

    expect(result.items.length).toBe(0)
    expect(result.totalAmount).toBe(0)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// executeUnifiedPayment — 執行統一付款
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("executeUnifiedPayment - 執行統一付款", () => {
  let app: Express
  let executeUnifiedPayment: typeof import("../../server/storage/subcategory-payments").executeUnifiedPayment
  let testProjectId: number
  const createdItemIds: number[] = []
  const createdProjectIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
    const mod = await import("../../server/storage/subcategory-payments")
    executeUnifiedPayment = mod.executeUnifiedPayment

    // 建立專用測試專案，避免影響其他測試的項目
    const timestamp = Date.now()
    const { createPaymentProject } = await import("../../server/storage/categories")
    const project = await createPaymentProject({
      projectName: `統一付款測試專案_${timestamp}`,
      projectType: "project",
    })
    testProjectId = project.id
    createdProjectIds.push(testProjectId)

    // 建立測試付款項目（指定 projectId，限定作用範圍）
    for (let i = 0; i < 2; i++) {
      const itemRes = await request(app)
        .post("/api/payment/items")
        .send({
          itemName: `統一付款測試項目_${timestamp}_${i}`,
          totalAmount: `${(i + 1) * 3000}`,
          startDate: "2025-06-01",
          status: "pending",
          projectId: testProjectId,
        })
        .expect(201)
      createdItemIds.push(itemRes.body.id)
    }
  })

  afterAll(async () => {
    for (const id of createdItemIds) {
      try {
        await request(app).delete(`/api/payment/items/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
    for (const id of createdProjectIds) {
      try {
        const { deletePaymentProject } = await import("../../server/storage/categories")
        await deletePaymentProject(id)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  it("帶 projectId 應分配付款金額並回傳結果", async () => {
    const result = await executeUnifiedPayment(2000, testProjectId)

    expect(result).toHaveProperty("allocatedPayments")
    expect(result).toHaveProperty("remainingAmount")
    expect(Array.isArray(result.allocatedPayments)).toBe(true)
  })

  it("分配結果的 allocatedAmount 應為數字", async () => {
    const result = await executeUnifiedPayment(1000, testProjectId)

    for (const payment of result.allocatedPayments) {
      expect(typeof payment.allocatedAmount).toBe("number")
      expect(payment.allocatedAmount).toBeGreaterThan(0)
    }
  })

  it("金額為 0 時應回傳空分配", async () => {
    const result = await executeUnifiedPayment(0, testProjectId)

    expect(result.allocatedPayments.length).toBe(0)
    expect(result.remainingAmount).toBe(0)
  })

  it("不存在的 projectId 應回傳空分配", async () => {
    const result = await executeUnifiedPayment(500, 999999)

    expect(result.allocatedPayments.length).toBe(0)
  })

  it("帶備註和使用者資訊應正常運作", async () => {
    const result = await executeUnifiedPayment(
      500,
      testProjectId,
      undefined,
      "統一付款測試備註",
      "測試使用者"
    )

    expect(result).toHaveProperty("allocatedPayments")
    expect(result).toHaveProperty("remainingAmount")
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getProjectsWithStats — 專案統計
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("getProjectsWithStats - 專案統計", () => {
  let getProjectsWithStats: typeof import("../../server/storage/subcategory-payments").getProjectsWithStats

  beforeAll(async () => {
    const mod = await import("../../server/storage/subcategory-payments")
    getProjectsWithStats = mod.getProjectsWithStats
  })

  it("應回傳專案統計陣列", async () => {
    const result = await getProjectsWithStats()

    expect(Array.isArray(result)).toBe(true)
  })

  it("每筆專案統計應包含完整欄位", async () => {
    const result = await getProjectsWithStats()

    for (const stat of result) {
      expect(stat).toHaveProperty("projectId")
      expect(stat).toHaveProperty("projectName")
      expect(stat).toHaveProperty("projectType")
      expect(stat).toHaveProperty("totalAmount")
      expect(stat).toHaveProperty("paidAmount")
      expect(stat).toHaveProperty("unpaidAmount")
      expect(stat).toHaveProperty("overdueAmount")
      expect(stat).toHaveProperty("completionRate")
      expect(stat).toHaveProperty("counts")
    }
  })

  it("counts 應包含 total、paid、pending、partial、overdue", async () => {
    const result = await getProjectsWithStats()

    for (const stat of result) {
      expect(stat.counts).toHaveProperty("total")
      expect(stat.counts).toHaveProperty("paid")
      expect(stat.counts).toHaveProperty("pending")
      expect(stat.counts).toHaveProperty("partial")
      expect(stat.counts).toHaveProperty("overdue")
    }
  })

  it("completionRate 應介於 0~100 之間", async () => {
    const result = await getProjectsWithStats()

    for (const stat of result) {
      expect(stat.completionRate).toBeGreaterThanOrEqual(0)
      expect(stat.completionRate).toBeLessThanOrEqual(100)
    }
  })
})
