/**
 * server/db.ts 單元測試
 * 測試 handleDatabaseError 和 checkDatabaseHealth
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// 用 vi.hoisted 確保 mockQuery 在 vi.mock 提升後仍可存取
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}))

// Mock pg 模組避免真實資料庫連線
vi.mock("pg", () => {
  class Pool {
    query = mockQuery
    on = vi.fn()
    end = vi.fn()
  }
  return { default: { Pool } }
})

// Mock drizzle
vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn().mockReturnValue({}),
}))

// Mock schema
vi.mock("@shared/schema", () => ({}))

// 設定必要的環境變數（必須在 import 之前）
vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/testdb")

import { handleDatabaseError, checkDatabaseHealth } from "../../server/db"

describe("handleDatabaseError", () => {
  let mockConsoleError: ReturnType<typeof vi.spyOn>
  let mockConsoleWarn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.restoreAllMocks()
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mockConsoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  it("一般錯誤應記錄並立即 resolve", async () => {
    const error = new Error("some random error")

    const result = handleDatabaseError(error, "test-operation")

    await expect(result).resolves.toBeUndefined()
    expect(mockConsoleError).toHaveBeenCalled()
  })

  it("too many clients 錯誤應延遲 resolve（backing off）", async () => {
    const error = new Error("too many clients already")

    const promise = handleDatabaseError(error, "query")

    expect(promise).toBeInstanceOf(Promise)
    await promise
    expect(mockConsoleWarn).toHaveBeenCalled()
  })

  it("timeout 錯誤應觸發 backing off", async () => {
    const error = new Error("connection timeout expired")

    const promise = handleDatabaseError(error, "insert")

    expect(promise).toBeInstanceOf(Promise)
    await promise
    expect(mockConsoleWarn).toHaveBeenCalled()
  })

  it("terminating connection 錯誤應等待重連", async () => {
    const error = new Error("terminating connection due to administrator")

    const promise = handleDatabaseError(error, "select")

    expect(promise).toBeInstanceOf(Promise)
    await promise
    expect(mockConsoleWarn).toHaveBeenCalled()
  })

  it("非 Error 型別的錯誤應正常處理", async () => {
    await handleDatabaseError("string error", "operation")

    expect(mockConsoleError).toHaveBeenCalled()
  })

  it("帶有 code 屬性的錯誤應記錄 code", async () => {
    const error = Object.assign(new Error("connection refused"), {
      code: "ECONNREFUSED",
    })

    await handleDatabaseError(error, "connect")

    // 第一次 console.error（第30行）記錄結構化物件
    const firstCallArgs = mockConsoleError.mock.calls[0]
    expect(firstCallArgs[1]).toEqual(
      expect.objectContaining({
        code: "ECONNREFUSED",
        message: "connection refused",
      })
    )
  })

  it("operation 參數應出現在日誌中", async () => {
    await handleDatabaseError(new Error("test"), "my-operation")

    const logMessage = mockConsoleError.mock.calls[0][0]
    expect(logMessage).toContain("my-operation")
  })

  it("未提供 operation 參數時應使用預設值 unknown", async () => {
    await handleDatabaseError(new Error("test"))

    const logMessage = mockConsoleError.mock.calls[0][0]
    expect(logMessage).toContain("unknown")
  })
})

describe("checkDatabaseHealth", () => {
  beforeEach(() => {
    mockQuery.mockReset()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("資料庫正常應回傳 healthy: true 和 responseTime", async () => {
    mockQuery.mockResolvedValue({ rows: [{ "?column?": 1 }] })

    const result = await checkDatabaseHealth()

    expect(result.healthy).toBe(true)
    expect(result.responseTime).toBeTypeOf("number")
    expect(result.responseTime).toBeGreaterThanOrEqual(0)
  })

  it("資料庫連線失敗應回傳 healthy: false", async () => {
    mockQuery.mockRejectedValue(new Error("connection refused"))

    const result = await checkDatabaseHealth()

    expect(result.healthy).toBe(false)
    expect(result.error).toBe("connection refused")
  })

  it("非 Error 型別的錯誤應轉為字串", async () => {
    mockQuery.mockRejectedValue("unknown db error")

    const result = await checkDatabaseHealth()

    expect(result.healthy).toBe(false)
    expect(result.error).toBe("unknown db error")
  })
})
