/**
 * server/storage/project-stats.ts 單元測試
 * 測試專案統計查詢與資料轉換邏輯
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// 使用 vi.hoisted 定義 mock
const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
  }
  return { mockDb }
})

// Mock DB 模組
vi.mock("../../server/db", () => ({
  db: mockDb,
}))

// Mock schema 模組
vi.mock("@shared/schema", () => ({
  paymentItems: {
    projectId: "project_id",
    isDeleted: "is_deleted",
    totalAmount: "total_amount",
    paidAmount: "paid_amount",
    status: "status",
  },
  paymentProjects: {
    id: "id",
    projectName: "project_name",
    projectType: "project_type",
    isDeleted: "is_deleted",
  },
}))

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ type: "eq", field, value })),
  sql: vi.fn(),
}))

import { getProjectsWithStats } from "../../server/storage/project-stats"

describe("getProjectsWithStats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  /** 建立 chainable mock 用於 select -> from -> leftJoin -> where -> groupBy -> orderBy */
  function setupChain(result: unknown[]) {
    const orderByFn = vi.fn().mockResolvedValue(result)
    const groupByFn = vi.fn().mockReturnValue({ orderBy: orderByFn })
    const whereFn = vi.fn().mockReturnValue({ groupBy: groupByFn })
    const leftJoinFn = vi.fn().mockReturnValue({ where: whereFn })
    const fromFn = vi.fn().mockReturnValue({ leftJoin: leftJoinFn })
    mockDb.select.mockReturnValue({ from: fromFn })
    return { orderByFn, groupByFn, whereFn, leftJoinFn, fromFn }
  }

  it("應回傳轉換後的專案統計資料", async () => {
    const mockRawData = [
      {
        projectId: 1,
        projectName: "裝修工程",
        projectType: "general",
        totalAmount: "100000",
        paidAmount: "75000",
        unpaidAmount: "25000",
        overdueAmount: "5000",
        totalCount: 10,
        paidCount: 7,
        pendingCount: 2,
        partialCount: 0,
        overdueCount: 1,
      },
    ]
    setupChain(mockRawData)

    const result = await getProjectsWithStats()

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      projectId: 1,
      projectName: "裝修工程",
      projectType: "general",
      totalAmount: "100000",
      paidAmount: "75000",
      unpaidAmount: "25000",
      overdueAmount: "5000",
      completionRate: 75,
      counts: {
        total: 10,
        paid: 7,
        pending: 2,
        partial: 0,
        overdue: 1,
      },
    })
  })

  it("完成率應正確計算 (paidAmount / totalAmount * 100，四捨五入)", async () => {
    const mockRawData = [
      {
        projectId: 1,
        projectName: "A",
        projectType: null,
        totalAmount: "300",
        paidAmount: "100",
        unpaidAmount: "200",
        overdueAmount: "0",
        totalCount: 3,
        paidCount: 1,
        pendingCount: 2,
        partialCount: 0,
        overdueCount: 0,
      },
    ]
    setupChain(mockRawData)

    const result = await getProjectsWithStats()

    // 100/300 * 100 = 33.333... → Math.round → 33
    expect(result[0].completionRate).toBe(33)
  })

  it("totalAmount 為 0 時完成率應為 0", async () => {
    const mockRawData = [
      {
        projectId: 2,
        projectName: "空專案",
        projectType: "business",
        totalAmount: "0",
        paidAmount: "0",
        unpaidAmount: "0",
        overdueAmount: "0",
        totalCount: 0,
        paidCount: 0,
        pendingCount: 0,
        partialCount: 0,
        overdueCount: 0,
      },
    ]
    setupChain(mockRawData)

    const result = await getProjectsWithStats()

    expect(result[0].completionRate).toBe(0)
  })

  it("全額付款的專案完成率應為 100", async () => {
    const mockRawData = [
      {
        projectId: 3,
        projectName: "已完成",
        projectType: "rental",
        totalAmount: "50000",
        paidAmount: "50000",
        unpaidAmount: "0",
        overdueAmount: "0",
        totalCount: 5,
        paidCount: 5,
        pendingCount: 0,
        partialCount: 0,
        overdueCount: 0,
      },
    ]
    setupChain(mockRawData)

    const result = await getProjectsWithStats()

    expect(result[0].completionRate).toBe(100)
  })

  it("多個專案應正確轉換", async () => {
    const mockRawData = [
      {
        projectId: 1,
        projectName: "A",
        projectType: "general",
        totalAmount: "10000",
        paidAmount: "5000",
        unpaidAmount: "5000",
        overdueAmount: "0",
        totalCount: 2,
        paidCount: 1,
        pendingCount: 1,
        partialCount: 0,
        overdueCount: 0,
      },
      {
        projectId: 2,
        projectName: "B",
        projectType: "business",
        totalAmount: "20000",
        paidAmount: "20000",
        unpaidAmount: "0",
        overdueAmount: "0",
        totalCount: 3,
        paidCount: 3,
        pendingCount: 0,
        partialCount: 0,
        overdueCount: 0,
      },
    ]
    setupChain(mockRawData)

    const result = await getProjectsWithStats()

    expect(result).toHaveLength(2)
    expect(result[0].projectName).toBe("A")
    expect(result[0].completionRate).toBe(50)
    expect(result[1].projectName).toBe("B")
    expect(result[1].completionRate).toBe(100)
  })

  it("無資料時應回傳空陣列", async () => {
    setupChain([])

    const result = await getProjectsWithStats()

    expect(result).toEqual([])
  })

  it("DB 錯誤時應記錄並拋出例外", async () => {
    const dbError = new Error("Connection refused")
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockRejectedValue(dbError),
            }),
          }),
        }),
      }),
    })

    await expect(getProjectsWithStats()).rejects.toThrow("Connection refused")
    expect(console.error).toHaveBeenCalledWith("取得專案統計失敗:", dbError)
  })

  it("projectType 為 null 時應正常處理", async () => {
    const mockRawData = [
      {
        projectId: 4,
        projectName: "無類型",
        projectType: null,
        totalAmount: "1000",
        paidAmount: "500",
        unpaidAmount: "500",
        overdueAmount: "0",
        totalCount: 1,
        paidCount: 0,
        pendingCount: 1,
        partialCount: 0,
        overdueCount: 0,
      },
    ]
    setupChain(mockRawData)

    const result = await getProjectsWithStats()

    expect(result[0].projectType).toBeNull()
  })
})
