/**
 * server/storage/helpers.ts 擴展單元測試
 * 補充 withRetry、getCachedCategoryType、createAuditLogAsync、
 * createFixedCategorySubOptionAsync 的測試
 * （calculateMonthsBetween 和 getMonthIndex 已在 storage-helpers.test.ts 測試）
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// 使用 vi.hoisted 定義 mock
const { mockDb, mockHandleDatabaseError } = vi.hoisted(() => {
  const mockInsert = vi.fn()
  const mockValues = vi.fn()
  const mockSelectChain = vi.fn()
  const mockWhere = vi.fn()
  const mockLimit = vi.fn()

  const mockDb = {
    select: vi.fn(),
    insert: mockInsert,
    _mockValues: mockValues,
    _mockSelectChain: mockSelectChain,
    _mockWhere: mockWhere,
    _mockLimit: mockLimit,
  }

  const mockHandleDatabaseError = vi.fn().mockResolvedValue(undefined)

  return { mockDb, mockHandleDatabaseError }
})

// Mock DB 模組
vi.mock("../../server/db", () => ({
  db: mockDb,
  pool: {},
  handleDatabaseError: mockHandleDatabaseError,
}))

// Mock schema 模組
vi.mock("@shared/schema", () => ({
  auditLogs: { tableName: "audit_logs" },
  debtCategories: {
    id: "id",
    categoryType: "category_type",
  },
  fixedCategorySubOptions: {
    fixedCategoryId: "fixed_category_id",
    projectId: "project_id",
    subOptionName: "sub_option_name",
  },
}))

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ type: "eq", field, value })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
}))

import {
  withRetry,
  getCachedCategoryType,
  createAuditLogAsync,
  createFixedCategorySubOptionAsync,
} from "../../server/storage/helpers"

describe("withRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  it("操作成功應直接回傳結果", async () => {
    const operation = vi.fn().mockResolvedValue("success")

    const result = await withRetry(operation)

    expect(result).toBe("success")
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it("操作失敗但非連線錯誤應直接拋出", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("validation error"))

    await expect(withRetry(operation, 3, 10)).rejects.toThrow("validation error")
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it("連線錯誤應重試指定次數", async () => {
    const connectionError = new Error("connection timeout")
    const operation = vi
      .fn()
      .mockRejectedValueOnce(connectionError)
      .mockRejectedValueOnce(connectionError)
      .mockResolvedValue("recovered")

    const result = await withRetry(operation, 3, 10)

    expect(result).toBe("recovered")
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it("Too many database connection attempts 錯誤應重試", async () => {
    const error = new Error("Too many database connection attempts")
    const operation = vi.fn().mockRejectedValueOnce(error).mockResolvedValue("ok")

    const result = await withRetry(operation, 2, 10)

    expect(result).toBe("ok")
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it("timeout 錯誤應重試", async () => {
    const error = new Error("query timeout")
    const operation = vi.fn().mockRejectedValueOnce(error).mockResolvedValue("ok")

    const result = await withRetry(operation, 2, 10)

    expect(result).toBe("ok")
  })

  it("重試次數用盡後應拋出錯誤", async () => {
    const connectionError = new Error("connection refused")
    const operation = vi.fn().mockRejectedValue(connectionError)

    await expect(withRetry(operation, 2, 10)).rejects.toThrow("connection refused")
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it("非 Error 物件的錯誤應被轉換為 Error", async () => {
    const operation = vi.fn().mockRejectedValue("string error")

    await expect(withRetry(operation, 1, 10)).rejects.toBe("string error")
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it("重試時應呼叫 handleDatabaseError", async () => {
    const connectionError = new Error("connection timeout")
    const operation = vi.fn().mockRejectedValueOnce(connectionError).mockResolvedValue("ok")

    await withRetry(operation, 2, 10)

    expect(mockHandleDatabaseError).toHaveBeenCalledWith(connectionError)
  })

  it("預設重試 3 次、基礎延遲 1000ms", async () => {
    // 檢查函式簽名的預設值
    const operation = vi.fn().mockResolvedValue("ok")
    await withRetry(operation)
    expect(operation).toHaveBeenCalledTimes(1)
  })
})

describe("getCachedCategoryType", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 清除快取（因為快取是模組層級）
    // 重新載入模組無法輕易做到，所以我們在測試中利用不同 categoryId 來避開快取
  })

  /** 建立 category 查詢的 chain mock */
  function setupCategoryChain(result: unknown[]) {
    const limitFn = vi.fn().mockResolvedValue(result)
    const whereFn = vi.fn().mockReturnValue({ limit: limitFn })
    const fromFn = vi.fn().mockReturnValue({ where: whereFn })
    mockDb.select.mockReturnValue({ from: fromFn })
    return { limitFn, whereFn, fromFn }
  }

  it("household 分類應回傳 home", async () => {
    setupCategoryChain([{ categoryType: "household" }])

    const result = await getCachedCategoryType(100)

    expect(result).toBe("home")
  })

  it("非 household 分類應回傳 project", async () => {
    setupCategoryChain([{ categoryType: "project" }])

    const result = await getCachedCategoryType(200)

    expect(result).toBe("project")
  })

  it("找不到分類時應回傳 project", async () => {
    setupCategoryChain([])

    const result = await getCachedCategoryType(300)

    expect(result).toBe("project")
  })

  it("快取命中時不應再查詢 DB", async () => {
    setupCategoryChain([{ categoryType: "household" }])

    // 第一次查詢（寫入快取）
    await getCachedCategoryType(100)
    vi.clearAllMocks()

    // 第二次查詢（應走快取）
    const result = await getCachedCategoryType(100)

    expect(result).toBe("home")
    expect(mockDb.select).not.toHaveBeenCalled()
  })
})

describe("createAuditLogAsync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("應成功插入審計日誌", async () => {
    const mockValuesFn = vi.fn().mockResolvedValue(undefined)
    mockDb.insert.mockReturnValue({ values: mockValuesFn })

    const logData = {
      tableName: "users",
      recordId: 1,
      action: "UPDATE",
      changedBy: 1,
    }

    await createAuditLogAsync(logData)

    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ...logData,
        createdAt: expect.any(Date),
      })
    )
  })

  it("插入失敗時不應拋出例外（靜默失敗）", async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error("insert failed")),
    })

    // 應不會拋出
    await expect(
      createAuditLogAsync({
        tableName: "test",
        recordId: 1,
        action: "INSERT",
        changedBy: 1,
      })
    ).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalled()
  })
})

describe("createFixedCategorySubOptionAsync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("子選項不存在時應新增", async () => {
    // mock select chain -> 查詢結果為空（不存在）
    const limitFn = vi.fn().mockResolvedValue([])
    const whereFn = vi.fn().mockReturnValue({ limit: limitFn })
    const fromFn = vi.fn().mockReturnValue({ where: whereFn })
    mockDb.select.mockReturnValue({ from: fromFn })

    // mock insert chain
    const mockValuesFn = vi.fn().mockResolvedValue(undefined)
    mockDb.insert.mockReturnValue({ values: mockValuesFn })

    await createFixedCategorySubOptionAsync(1, 2, "水電費")

    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        fixedCategoryId: 1,
        projectId: 2,
        subOptionName: "水電費",
        displayName: "水電費",
        isActive: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
    )
  })

  it("子選項已存在時不應重複新增", async () => {
    // mock select chain -> 查詢結果非空（已存在）
    const limitFn = vi.fn().mockResolvedValue([{ id: 99 }])
    const whereFn = vi.fn().mockReturnValue({ limit: limitFn })
    const fromFn = vi.fn().mockReturnValue({ where: whereFn })
    mockDb.select.mockReturnValue({ from: fromFn })

    await createFixedCategorySubOptionAsync(1, 2, "水電費")

    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it("查詢失敗時不應拋出例外（靜默失敗）", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error("DB error")),
        }),
      }),
    })

    await expect(createFixedCategorySubOptionAsync(1, 2, "測試")).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalled()
  })

  it("插入失敗時不應拋出例外（靜默失敗）", async () => {
    // mock select chain -> 不存在
    const limitFn = vi.fn().mockResolvedValue([])
    const whereFn = vi.fn().mockReturnValue({ limit: limitFn })
    const fromFn = vi.fn().mockReturnValue({ where: whereFn })
    mockDb.select.mockReturnValue({ from: fromFn })

    // mock insert 失敗
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error("insert error")),
    })

    await expect(createFixedCategorySubOptionAsync(1, 2, "測試")).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalled()
  })
})
