/**
 * server/auth.ts 單元測試
 * 測試 requireAuth middleware 和 hashPassword / comparePasswords
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Request, Response, NextFunction } from "express"

// Mock storage 模組，避免真實資料庫連線
vi.mock("../../server/storage", () => ({
  storage: {
    sessionStore: {},
    getUserByUsername: vi.fn(),
    getUserById: vi.fn(),
    updateUserLoginAttempts: vi.fn(),
    updateUser: vi.fn(),
    createUser: vi.fn(),
  },
}))

// Mock db 模組
vi.mock("../../server/db", () => ({
  db: {},
  pool: {},
}))

import { requireAuth, hashPassword } from "../../server/auth"

// 建立 mock Express 物件的輔助函式
function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    isAuthenticated: vi.fn().mockReturnValue(false),
    user: undefined,
    session: {} as Request["session"],
    ...overrides,
  } as unknown as Request
}

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

// === requireAuth middleware 測試 ===
describe("requireAuth", () => {
  let mockNext: NextFunction

  beforeEach(() => {
    mockNext = vi.fn()
  })

  it("已認證且帳號啟用的使用者應通過", () => {
    const req = createMockReq({
      isAuthenticated: vi.fn().mockReturnValue(true) as unknown as () => boolean,
      user: { id: 1, username: "test", isActive: true } as Express.User,
    })
    const res = createMockRes()

    requireAuth(req, res, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it("已認證但帳號停用的使用者應回傳 403", () => {
    const req = createMockReq({
      isAuthenticated: vi.fn().mockReturnValue(true) as unknown as () => boolean,
      user: { id: 1, username: "test", isActive: false } as Express.User,
    })
    const res = createMockRes()

    requireAuth(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ message: "帳號已被停用" })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it("未認證但 session 有 userId 且 isAuthenticated 為 true 應通過（LINE 登入）", () => {
    const req = createMockReq({
      session: {
        userId: 42,
        isAuthenticated: true,
      } as Request["session"],
    })
    const res = createMockRes()

    requireAuth(req, res, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it("未認證且無 session 應回傳 401", () => {
    const req = createMockReq()
    const res = createMockRes()

    requireAuth(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: "需要登入才能訪問此資源" })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it("未認證且 session userId 為空應回傳 401", () => {
    const req = createMockReq({
      session: {
        userId: undefined,
        isAuthenticated: false,
      } as unknown as Request["session"],
    })
    const res = createMockRes()

    requireAuth(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(mockNext).not.toHaveBeenCalled()
  })

  it("isAuthenticated 為 true 但 user 為 null 時應檢查 session", () => {
    const req = createMockReq({
      isAuthenticated: vi.fn().mockReturnValue(true) as unknown as () => boolean,
      user: undefined,
      session: {
        userId: 10,
        isAuthenticated: true,
      } as Request["session"],
    })
    const res = createMockRes()

    requireAuth(req, res, mockNext)

    // passport isAuthenticated() 為 true 但 user 為 falsy，
    // 所以 if (req.isAuthenticated() && req.user) 不成立，
    // 改走 session 路徑
    expect(mockNext).toHaveBeenCalled()
  })
})

// === hashPassword 函式測試 ===
describe("hashPassword（from auth.ts）", () => {
  it("應回傳 hash.salt 格式的字串", async () => {
    const result = await hashPassword("testPassword123")
    const parts = result.split(".")
    expect(parts).toHaveLength(2)
    // 64 bytes = 128 hex 字元
    expect(parts[0]).toHaveLength(128)
    // 16 bytes = 32 hex 字元
    expect(parts[1]).toHaveLength(32)
  })

  it("相同密碼每次雜湊結果不同（隨機鹽值）", async () => {
    const hash1 = await hashPassword("samePass")
    const hash2 = await hashPassword("samePass")
    expect(hash1).not.toBe(hash2)
  })
})
