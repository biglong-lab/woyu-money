/**
 * server/init-admin.ts 單元測試
 * Mock db 和 hashPassword 測試管理員初始化邏輯
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock db 模組
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockValues = vi.fn()

vi.mock("../../server/db", () => ({
  db: {
    select: () => ({ from: mockFrom }),
    insert: () => ({ values: mockValues }),
  },
  pool: {},
}))

// Mock auth 模組的 hashPassword
vi.mock("../../server/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password_mock"),
}))

// Mock storage 模組（init-admin.ts 不直接用，但 auth.ts import 時需要）
vi.mock("../../server/storage", () => ({
  storage: {
    sessionStore: {},
  },
}))

// Mock @shared/schema
vi.mock("@shared/schema", () => ({
  users: { username: "username_col" },
}))

// Mock drizzle-orm eq 函式
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}))

import { initializeAdminUser } from "../../server/init-admin"
import { hashPassword } from "../../server/auth"

describe("initializeAdminUser", () => {
  // 保存原始環境變數和 process.exit
  const originalEnv = { ...process.env }
  let mockExit: ReturnType<typeof vi.spyOn>
  let mockConsoleInfo: ReturnType<typeof vi.spyOn>
  let mockConsoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Mock process.exit 避免測試真的退出
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called")
    })
    mockConsoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    // 重設所有 mock
    mockFrom.mockReset()
    mockValues.mockReset()
    vi.mocked(hashPassword).mockClear()
  })

  afterEach(() => {
    // 還原環境變數
    process.env = { ...originalEnv }
    mockExit.mockRestore()
    mockConsoleInfo.mockRestore()
    mockConsoleError.mockRestore()
  })

  it("缺少 ADMIN_USERNAME 應錯誤退出", async () => {
    delete process.env.ADMIN_USERNAME
    delete process.env.ADMIN_PASSWORD

    await expect(initializeAdminUser()).rejects.toThrow("process.exit called")

    expect(mockConsoleError).toHaveBeenCalledWith(
      "請設定 ADMIN_USERNAME 和 ADMIN_PASSWORD 環境變數"
    )
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it("缺少 ADMIN_PASSWORD 應錯誤退出", async () => {
    process.env.ADMIN_USERNAME = "admin"
    delete process.env.ADMIN_PASSWORD

    await expect(initializeAdminUser()).rejects.toThrow("process.exit called")

    expect(mockConsoleError).toHaveBeenCalledWith(
      "請設定 ADMIN_USERNAME 和 ADMIN_PASSWORD 環境變數"
    )
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it("密碼少於 8 字元應錯誤退出", async () => {
    process.env.ADMIN_USERNAME = "admin"
    process.env.ADMIN_PASSWORD = "short"

    await expect(initializeAdminUser()).rejects.toThrow("process.exit called")

    expect(mockConsoleError).toHaveBeenCalledWith("管理員密碼至少需要 8 個字元")
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it("管理員已存在應跳過建立並正常退出", async () => {
    process.env.ADMIN_USERNAME = "admin"
    process.env.ADMIN_PASSWORD = "password123"

    // 模擬查到既有管理員
    mockFrom.mockReturnValue({
      where: vi.fn().mockResolvedValue([{ id: 1, username: "admin" }]),
    })

    await expect(initializeAdminUser()).rejects.toThrow("process.exit called")

    expect(mockConsoleInfo).toHaveBeenCalledWith("管理員帳戶已存在，跳過建立")
    // 不應呼叫 insert
    expect(mockValues).not.toHaveBeenCalled()
    // 最終 process.exit(0)
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it("管理員不存在應建立新帳號", async () => {
    process.env.ADMIN_USERNAME = "newadmin"
    process.env.ADMIN_PASSWORD = "securepass123"

    // 模擬查無既有管理員
    mockFrom.mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    })
    mockValues.mockResolvedValue(undefined)

    await expect(initializeAdminUser()).rejects.toThrow("process.exit called")

    // 應呼叫 hashPassword
    expect(hashPassword).toHaveBeenCalledWith("securepass123")

    // 應呼叫 insert 並包含正確欄位
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "newadmin",
        password: "hashed_password_mock",
        email: "admin@system.local",
        fullName: "系統管理員",
        role: "admin",
        isActive: true,
      })
    )

    expect(mockConsoleInfo).toHaveBeenCalledWith("管理員帳戶建立成功")
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it("資料庫錯誤應記錄錯誤並退出", async () => {
    process.env.ADMIN_USERNAME = "admin"
    process.env.ADMIN_PASSWORD = "password123"

    const dbError = new Error("Connection refused")
    mockFrom.mockReturnValue({
      where: vi.fn().mockRejectedValue(dbError),
    })

    await expect(initializeAdminUser()).rejects.toThrow("process.exit called")

    expect(mockConsoleError).toHaveBeenCalledWith("初始化管理員帳戶失敗:", dbError)
    // finally 區塊中 process.exit(0)
    expect(mockExit).toHaveBeenCalledWith(0)
  })
})
