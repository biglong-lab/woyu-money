/**
 * server/storage/invoice.ts 單元測試
 * 測試發票記錄查詢與統計功能
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// 使用 vi.hoisted 定義 mock
const { mockDb } = vi.hoisted(() => {
  const mockOrderBy = vi.fn()
  const mockWhere = vi.fn()
  const mockGroupBy = vi.fn()
  const mockFrom = vi.fn()
  const mockSelect = vi.fn()

  const mockDb = {
    select: mockSelect,
    _mockFrom: mockFrom,
    _mockWhere: mockWhere,
    _mockOrderBy: mockOrderBy,
    _mockGroupBy: mockGroupBy,
  }
  return { mockDb }
})

// Mock DB 模組
vi.mock("../../server/db", () => ({
  db: mockDb,
}))

// Mock schema 模組
vi.mock("@shared/schema", () => ({
  invoiceRecords: {
    taxYear: "tax_year",
    taxMonth: "tax_month",
    category: "category",
    invoiceType: "invoice_type",
    invoiceDate: "invoice_date",
    totalAmount: "total_amount",
  },
}))

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ type: "eq", field, value })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  desc: vi.fn((field) => ({ type: "desc", field })),
  sql: vi.fn(),
}))

import { getInvoiceRecords, getInvoiceStats } from "../../server/storage/invoice"

describe("getInvoiceRecords", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** 建立 chainable mock select 流程 */
  function setupSelectChain(result: unknown[]) {
    const orderByFn = vi.fn().mockResolvedValue(result)
    const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn })
    const fromFn = vi.fn().mockReturnValue({
      where: whereFn,
      orderBy: orderByFn,
    })
    mockDb.select.mockReturnValue({ from: fromFn })
    return { orderByFn, whereFn, fromFn }
  }

  it("無篩選條件時應查詢所有記錄", async () => {
    const mockRecords = [
      { id: 1, invoiceDate: "2024-01-15", totalAmount: "1000" },
      { id: 2, invoiceDate: "2024-02-10", totalAmount: "2000" },
    ]
    setupSelectChain(mockRecords)

    const result = await getInvoiceRecords()

    expect(result).toEqual(mockRecords)
    expect(mockDb.select).toHaveBeenCalled()
  })

  it("空篩選物件應查詢所有記錄", async () => {
    const mockRecords = [{ id: 1 }]
    setupSelectChain(mockRecords)

    const result = await getInvoiceRecords({})

    expect(result).toEqual(mockRecords)
  })

  it("year 篩選條件應加入 where 子句", async () => {
    const mockRecords = [{ id: 1, taxYear: 2024 }]
    const { whereFn } = setupSelectChain(mockRecords)

    const result = await getInvoiceRecords({ year: 2024 })

    expect(result).toEqual(mockRecords)
    // 有條件時應走 where 路徑
    expect(whereFn).toHaveBeenCalled()
  })

  it("month 篩選條件應正確處理", async () => {
    const mockRecords = [{ id: 1, taxMonth: 6 }]
    const { whereFn } = setupSelectChain(mockRecords)

    const result = await getInvoiceRecords({ month: 6 })

    expect(result).toEqual(mockRecords)
    expect(whereFn).toHaveBeenCalled()
  })

  it("category 篩選條件應正確處理", async () => {
    const mockRecords = [{ id: 1, category: "food" }]
    const { whereFn } = setupSelectChain(mockRecords)

    const result = await getInvoiceRecords({ category: "food" })

    expect(result).toEqual(mockRecords)
    expect(whereFn).toHaveBeenCalled()
  })

  it("invoiceType 篩選條件應正確處理", async () => {
    const mockRecords = [{ id: 1, invoiceType: "receipt" }]
    const { whereFn } = setupSelectChain(mockRecords)

    const result = await getInvoiceRecords({ invoiceType: "receipt" })

    expect(result).toEqual(mockRecords)
    expect(whereFn).toHaveBeenCalled()
  })

  it("多個篩選條件應同時生效", async () => {
    const mockRecords = [{ id: 1 }]
    const { whereFn } = setupSelectChain(mockRecords)

    const result = await getInvoiceRecords({
      year: 2024,
      month: 3,
      category: "food",
      invoiceType: "electronic",
    })

    expect(result).toEqual(mockRecords)
    expect(whereFn).toHaveBeenCalled()
  })

  it("空字串 category 不應加入條件", async () => {
    const mockRecords = [{ id: 1 }]
    setupSelectChain(mockRecords)

    const result = await getInvoiceRecords({ category: "" })

    expect(result).toEqual(mockRecords)
  })

  it("查詢結果為空陣列時應正常回傳", async () => {
    setupSelectChain([])

    const result = await getInvoiceRecords({ year: 9999 })

    expect(result).toEqual([])
  })
})

describe("getInvoiceStats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** 建立統計查詢的 chainable mock */
  function setupStatsChain(result: unknown[]) {
    const groupByFn = vi.fn().mockResolvedValue(result)
    const whereFn = vi.fn().mockReturnValue({ groupBy: groupByFn })
    const fromFn = vi.fn().mockReturnValue({ where: whereFn })
    mockDb.select.mockReturnValue({ from: fromFn })
    return { groupByFn, whereFn, fromFn }
  }

  it("應回傳指定年度的統計資料", async () => {
    const mockStats = [
      { month: 1, invoiceType: "receipt", totalAmount: "5000", count: 3 },
      { month: 2, invoiceType: "electronic", totalAmount: "8000", count: 5 },
    ]
    setupStatsChain(mockStats)

    const result = await getInvoiceStats(2024)

    expect(result).toEqual({
      year: 2024,
      stats: mockStats,
    })
  })

  it("無資料時應回傳空統計", async () => {
    setupStatsChain([])

    const result = await getInvoiceStats(2099)

    expect(result).toEqual({
      year: 2099,
      stats: [],
    })
  })

  it("回傳的 year 應與輸入一致", async () => {
    setupStatsChain([])

    const result2023 = await getInvoiceStats(2023)
    const result2024 = await getInvoiceStats(2024)

    expect(result2023.year).toBe(2023)
    expect(result2024.year).toBe(2024)
  })

  it("統計資料應包含正確結構", async () => {
    const mockStats = [{ month: 6, invoiceType: "paper", totalAmount: "12000", count: 10 }]
    setupStatsChain(mockStats)

    const result = await getInvoiceStats(2024)

    expect(result.stats[0]).toHaveProperty("month", 6)
    expect(result.stats[0]).toHaveProperty("invoiceType", "paper")
    expect(result.stats[0]).toHaveProperty("totalAmount", "12000")
    expect(result.stats[0]).toHaveProperty("count", 10)
  })
})
