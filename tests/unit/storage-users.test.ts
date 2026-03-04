/**
 * server/storage/users.ts 單元測試
 * 測試使用者 CRUD、認證、角色管理、系統統計等功能
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// 使用 vi.hoisted 定義 mock
const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
  return { mockDb }
})

// Mock DB 模組
vi.mock("../../server/db", () => ({
  db: mockDb,
}))

// Mock schema 模組
vi.mock("@shared/schema", () => ({
  users: {
    id: "id",
    username: "username",
    lineUserId: "line_user_id",
    isActive: "is_active",
    createdAt: "created_at",
  },
  paymentItems: { tableName: "payment_items" },
  loanInvestmentRecords: { tableName: "loan_investment_records" },
}))

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ type: "eq", field, value })),
  desc: vi.fn((field) => ({ type: "desc", field })),
  count: vi.fn(() => "count(*)"),
}))

import {
  getUserById,
  getUserByUsername,
  getUserByLineUserId,
  getUserByLineId,
  createUser,
  updateUser,
  updateUserLoginAttempts,
  getAllUsers,
  updateUserRole,
  updateUserPermissions,
  updateUserPassword,
  toggleUserStatus,
  deleteUser,
  getSystemStats,
} from "../../server/storage/users"

/** 輔助函式：建立 select chain mock */
function setupSelectChain(result: unknown[]) {
  const whereFn = vi.fn().mockResolvedValue(result)
  const fromFn = vi.fn().mockReturnValue({ where: whereFn })
  mockDb.select.mockReturnValue({ from: fromFn })
  return { whereFn, fromFn }
}

/** 輔助函式：建立 insert chain mock */
function setupInsertChain(result: unknown[]) {
  const returningFn = vi.fn().mockResolvedValue(result)
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn })
  mockDb.insert.mockReturnValue({ values: valuesFn })
  return { returningFn, valuesFn }
}

/** 輔助函式：建立 update chain mock */
function setupUpdateChain(result: unknown[]) {
  const returningFn = vi.fn().mockResolvedValue(result)
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn })
  const setFn = vi.fn().mockReturnValue({ where: whereFn })
  mockDb.update.mockReturnValue({ set: setFn })
  return { returningFn, whereFn, setFn }
}

/** 輔助函式：建立 update chain mock（不含 returning） */
function setupUpdateChainNoReturn() {
  const whereFn = vi.fn().mockResolvedValue(undefined)
  const setFn = vi.fn().mockReturnValue({ where: whereFn })
  mockDb.update.mockReturnValue({ set: setFn })
  return { whereFn, setFn }
}

/** 模擬使用者資料 */
const mockUser = {
  id: 1,
  username: "admin",
  password: "hashed",
  role: "admin",
  isActive: true,
  lineUserId: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
}

describe("getUserById", () => {
  beforeEach(() => vi.clearAllMocks())

  it("找到使用者時應回傳使用者物件", async () => {
    setupSelectChain([mockUser])

    const result = await getUserById(1)

    expect(result).toEqual(mockUser)
    expect(mockDb.select).toHaveBeenCalled()
  })

  it("找不到使用者時應回傳 undefined", async () => {
    setupSelectChain([])

    const result = await getUserById(999)

    expect(result).toBeUndefined()
  })
})

describe("getUserByUsername", () => {
  beforeEach(() => vi.clearAllMocks())

  it("找到使用者時應回傳使用者物件", async () => {
    setupSelectChain([mockUser])

    const result = await getUserByUsername("admin")

    expect(result).toEqual(mockUser)
  })

  it("找不到使用者時應回傳 undefined", async () => {
    setupSelectChain([])

    const result = await getUserByUsername("nonexistent")

    expect(result).toBeUndefined()
  })
})

describe("getUserByLineUserId", () => {
  beforeEach(() => vi.clearAllMocks())

  it("找到使用者時應回傳使用者物件", async () => {
    const lineUser = { ...mockUser, lineUserId: "U123abc" }
    setupSelectChain([lineUser])

    const result = await getUserByLineUserId("U123abc")

    expect(result).toEqual(lineUser)
  })

  it("找不到使用者時應回傳 undefined", async () => {
    setupSelectChain([])

    const result = await getUserByLineUserId("nonexistent")

    expect(result).toBeUndefined()
  })
})

describe("getUserByLineId", () => {
  beforeEach(() => vi.clearAllMocks())

  it("找到使用者時應回傳使用者物件", async () => {
    const lineUser = { ...mockUser, lineUserId: "U456def" }
    setupSelectChain([lineUser])

    const result = await getUserByLineId("U456def")

    expect(result).toEqual(lineUser)
  })

  it("找不到使用者時應回傳 undefined", async () => {
    setupSelectChain([])

    const result = await getUserByLineId("unknown")

    expect(result).toBeUndefined()
  })
})

describe("createUser", () => {
  beforeEach(() => vi.clearAllMocks())

  it("應新增使用者並回傳完整使用者物件", async () => {
    const newUser = { ...mockUser, id: 2, username: "newuser" }
    setupInsertChain([newUser])

    const result = await createUser({
      username: "newuser",
      password: "hashed123",
    })

    expect(result).toEqual(newUser)
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it("應自動設定 createdAt 和 updatedAt", async () => {
    const newUser = { ...mockUser, id: 3 }
    const { valuesFn } = setupInsertChain([newUser])

    await createUser({ username: "test", password: "hashed" })

    const insertedValues = valuesFn.mock.calls[0][0]
    expect(insertedValues.createdAt).toBeInstanceOf(Date)
    expect(insertedValues.updatedAt).toBeInstanceOf(Date)
  })
})

describe("updateUser", () => {
  beforeEach(() => vi.clearAllMocks())

  it("應更新使用者資料並回傳更新後物件", async () => {
    const updatedUser = { ...mockUser, username: "updated" }
    setupUpdateChain([updatedUser])

    const result = await updateUser(1, { username: "updated" })

    expect(result).toEqual(updatedUser)
  })

  it("應自動更新 updatedAt", async () => {
    setupUpdateChain([mockUser])

    await updateUser(1, { username: "test" })

    const setArgs = mockDb.update.mock.results[0].value.set.mock.calls[0][0]
    expect(setArgs.updatedAt).toBeInstanceOf(Date)
  })
})

describe("updateUserLoginAttempts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("應更新登入失敗次數", async () => {
    const { setFn } = setupUpdateChainNoReturn()

    await updateUserLoginAttempts(1, 3)

    const setArgs = setFn.mock.calls[0][0]
    expect(setArgs.failedLoginAttempts).toBe(3)
    expect(setArgs.updatedAt).toBeInstanceOf(Date)
  })

  it("有鎖定時間時應一併更新", async () => {
    const { setFn } = setupUpdateChainNoReturn()
    const lockedUntil = new Date("2024-12-31")

    await updateUserLoginAttempts(1, 5, lockedUntil)

    const setArgs = setFn.mock.calls[0][0]
    expect(setArgs.failedLoginAttempts).toBe(5)
    expect(setArgs.lockedUntil).toEqual(lockedUntil)
  })

  it("不提供鎖定時間時 lockedUntil 應為 undefined", async () => {
    const { setFn } = setupUpdateChainNoReturn()

    await updateUserLoginAttempts(1, 0)

    const setArgs = setFn.mock.calls[0][0]
    expect(setArgs.lockedUntil).toBeUndefined()
  })
})

describe("getAllUsers", () => {
  beforeEach(() => vi.clearAllMocks())

  it("應回傳所有使用者列表（按建立時間降序）", async () => {
    const userList = [mockUser, { ...mockUser, id: 2, username: "user2" }]
    const orderByFn = vi.fn().mockResolvedValue(userList)
    const fromFn = vi.fn().mockReturnValue({ orderBy: orderByFn })
    mockDb.select.mockReturnValue({ from: fromFn })

    const result = await getAllUsers()

    expect(result).toEqual(userList)
    expect(result).toHaveLength(2)
  })

  it("無使用者時應回傳空陣列", async () => {
    const orderByFn = vi.fn().mockResolvedValue([])
    const fromFn = vi.fn().mockReturnValue({ orderBy: orderByFn })
    mockDb.select.mockReturnValue({ from: fromFn })

    const result = await getAllUsers()

    expect(result).toEqual([])
  })
})

describe("updateUserRole", () => {
  beforeEach(() => vi.clearAllMocks())

  it("應更新使用者角色並回傳更新後物件", async () => {
    const updatedUser = { ...mockUser, role: "user1" }
    setupUpdateChain([updatedUser])

    const result = await updateUserRole(1, "user1")

    expect(result).toEqual(updatedUser)
    expect(result.role).toBe("user1")
  })
})

describe("updateUserPermissions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("應更新使用者權限並回傳更新後物件", async () => {
    const permissions = { dashboard: true, settings: false }
    const updatedUser = { ...mockUser, menuPermissions: permissions }
    setupUpdateChain([updatedUser])

    const result = await updateUserPermissions(1, permissions)

    expect(result).toEqual(updatedUser)
  })
})

describe("updateUserPassword", () => {
  beforeEach(() => vi.clearAllMocks())

  it("應更新密碼（不回傳結果）", async () => {
    setupUpdateChainNoReturn()

    await updateUserPassword(1, "newHashedPassword")

    const setArgs = mockDb.update.mock.results[0].value.set.mock.calls[0][0]
    expect(setArgs.password).toBe("newHashedPassword")
    expect(setArgs.updatedAt).toBeInstanceOf(Date)
  })
})

describe("toggleUserStatus", () => {
  beforeEach(() => vi.clearAllMocks())

  it("應啟用使用者", async () => {
    const activatedUser = { ...mockUser, isActive: true }
    setupUpdateChain([activatedUser])

    const result = await toggleUserStatus(1, true)

    expect(result.isActive).toBe(true)
  })

  it("應停用使用者", async () => {
    const deactivatedUser = { ...mockUser, isActive: false }
    setupUpdateChain([deactivatedUser])

    const result = await toggleUserStatus(1, false)

    expect(result.isActive).toBe(false)
  })
})

describe("deleteUser", () => {
  beforeEach(() => vi.clearAllMocks())

  it("應刪除指定使用者", async () => {
    const whereFn = vi.fn().mockResolvedValue(undefined)
    mockDb.delete.mockReturnValue({ where: whereFn })

    await deleteUser(1)

    expect(mockDb.delete).toHaveBeenCalled()
    expect(whereFn).toHaveBeenCalled()
  })
})

describe("getSystemStats", () => {
  beforeEach(() => vi.clearAllMocks())

  it("應回傳完整系統統計資訊", async () => {
    // 四次 select 呼叫：totalUsers, activeUsers, paymentItems, loanRecords
    const setupCountSelect = (countValue: number) => {
      const whereFn = vi.fn().mockResolvedValue([{ count: countValue }])
      const fromFn = vi.fn().mockReturnValue({
        where: whereFn,
      })
      return { from: fromFn }
    }

    let callIndex = 0
    mockDb.select.mockImplementation(() => {
      callIndex++
      if (callIndex === 1) {
        // totalUsers - 不帶 where
        return {
          from: vi.fn().mockResolvedValue([{ count: 10 }]),
        }
      }
      if (callIndex === 2) {
        // activeUsers - 帶 where
        return setupCountSelect(8)
      }
      if (callIndex === 3) {
        // paymentItems - 不帶 where
        return {
          from: vi.fn().mockResolvedValue([{ count: 150 }]),
        }
      }
      // loanRecords - 不帶 where
      return {
        from: vi.fn().mockResolvedValue([{ count: 25 }]),
      }
    })

    const result = await getSystemStats()

    expect(result).toEqual({
      totalUsers: 10,
      activeUsers: 8,
      totalPaymentItems: 150,
      totalLoanRecords: 25,
      lastUpdated: expect.any(String),
    })
    // 驗證 lastUpdated 是合法的 ISO 字串
    expect(new Date(result.lastUpdated).toISOString()).toBe(result.lastUpdated)
  })

  it("查詢結果為空時應回傳 0", async () => {
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    }))

    // 為第一和第三、第四次呼叫（不帶 where）也設定 mock
    let callIndex = 0
    mockDb.select.mockImplementation(() => {
      callIndex++
      if (callIndex === 1 || callIndex === 3 || callIndex === 4) {
        return {
          from: vi.fn().mockResolvedValue([{ count: 0 }]),
        }
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      }
    })

    const result = await getSystemStats()

    expect(result.totalUsers).toBe(0)
    expect(result.activeUsers).toBe(0)
    expect(result.totalPaymentItems).toBe(0)
    expect(result.totalLoanRecords).toBe(0)
  })
})
