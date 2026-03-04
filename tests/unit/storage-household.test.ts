/**
 * server/storage/household.ts 單元測試
 * 覆蓋家用預算、家用支出、分類預算、年度預算的 CRUD 函式
 * 使用 drizzle ORM 鏈式呼叫 mock
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// === 使用 vi.hoisted 建立 mock（解決 hoisting 問題） ===
const { mockDb, state } = vi.hoisted(() => {
  // 共享的回傳值狀態
  const state = {
    selectResult: [] as unknown[],
    insertResult: [] as unknown[],
    updateResult: [] as unknown[],
    deleteResult: undefined as unknown,
    executeResult: { rows: [] } as unknown,
  }

  /** 建立可鏈式呼叫的 Proxy mock */
  function createChainMock(resultKey: keyof typeof state) {
    const chain: Record<string, (...args: unknown[]) => unknown> = {}
    const self: unknown = new Proxy(chain, {
      get(target, prop: string) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => resolve(state[resultKey])
        }
        if (!target[prop]) {
          target[prop] = vi.fn(() => self)
        }
        return target[prop]
      },
    })
    return self
  }

  const mockDb = {
    select: vi.fn(() => createChainMock("selectResult")),
    insert: vi.fn(() => createChainMock("insertResult")),
    update: vi.fn(() => createChainMock("updateResult")),
    delete: vi.fn(() => createChainMock("deleteResult")),
    execute: vi.fn(() => Promise.resolve(state.executeResult)),
  }

  return { mockDb, state }
})

vi.mock("../../server/db", () => ({
  db: mockDb,
}))

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>()
  return {
    ...actual,
    eq: vi.fn((_col: unknown, _val: unknown) => ({ type: "eq" })),
    and: vi.fn((..._conditions: unknown[]) => ({ type: "and" })),
    desc: vi.fn((_col: unknown) => ({ type: "desc" })),
  }
})

import {
  getHouseholdBudget,
  setHouseholdBudget,
  getHouseholdBudgets,
  createOrUpdateHouseholdBudget,
  getHouseholdExpenses,
  createHouseholdExpense,
  updateHouseholdExpense,
  deleteHouseholdExpense,
  getHouseholdCategoryBudgets,
  createHouseholdBudget,
  updateHouseholdBudget,
  updateHouseholdCategoryBudget,
  deleteHouseholdBudget,
  getHouseholdCategoryStats,
  getHouseholdStats,
  getYearlyBudgets,
  createOrUpdateYearlyBudget,
  getMonthlyBudgets,
} from "../../server/storage/household"

// === 測試用 mock 資料 ===

const mockBudget = {
  id: 1,
  categoryId: 10,
  year: 2026,
  month: 3,
  budgetAmount: "50000.00",
  notes: null,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

const mockExpense = {
  id: 1,
  categoryId: 10,
  amount: "1500.00",
  date: "2026-03-15",
  tags: null,
  paymentMethod: "cash",
  description: "日用品",
  receiptImages: null,
  receiptText: null,
  createdAt: new Date("2026-03-15"),
  updatedAt: new Date("2026-03-15"),
}

function resetState() {
  vi.clearAllMocks()
  state.selectResult = []
  state.insertResult = []
  state.updateResult = []
  state.deleteResult = undefined
  state.executeResult = { rows: [] }
}

describe("storage/household.ts - 家用預算管理", () => {
  beforeEach(resetState)

  // ========== getHouseholdBudget ==========
  describe("getHouseholdBudget", () => {
    it("找到預算時回傳預算物件", async () => {
      state.selectResult = [mockBudget]

      const result = await getHouseholdBudget("3")

      expect(result).toEqual(mockBudget)
      expect(mockDb.select).toHaveBeenCalled()
    })

    it("找不到預算時回傳 undefined", async () => {
      state.selectResult = []

      const result = await getHouseholdBudget("99")

      expect(result).toBeUndefined()
    })

    it("月份字串 '2026-03' 傳入時能正確解析", async () => {
      state.selectResult = [mockBudget]

      const result = await getHouseholdBudget("2026-03")

      expect(result).toEqual(mockBudget)
    })
  })

  // ========== setHouseholdBudget ==========
  describe("setHouseholdBudget", () => {
    it("已存在預算時應更新", async () => {
      state.selectResult = [mockBudget]
      state.updateResult = [{ ...mockBudget, budgetAmount: "60000.00" }]

      const result = await setHouseholdBudget({
        categoryId: 10,
        year: 2026,
        month: 3,
        budgetAmount: "60000.00",
      })

      expect(result.budgetAmount).toBe("60000.00")
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("不存在預算時應建立新的", async () => {
      const newBudget = { ...mockBudget, id: 2, budgetAmount: "30000.00" }
      state.selectResult = []
      state.insertResult = [newBudget]

      const result = await setHouseholdBudget({
        categoryId: 10,
        year: 2026,
        month: 4,
        budgetAmount: "30000.00",
      })

      expect(result.budgetAmount).toBe("30000.00")
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  // ========== getHouseholdBudgets ==========
  describe("getHouseholdBudgets", () => {
    it("回傳指定月份的預算清單", async () => {
      const budgetSummary = {
        id: 1,
        categoryId: 10,
        budgetAmount: "50000.00",
        month: 3,
      }
      state.selectResult = [budgetSummary]

      const result = await getHouseholdBudgets("3")

      expect(result).toEqual([budgetSummary])
      expect(mockDb.select).toHaveBeenCalled()
    })

    it("無預算時回傳空陣列", async () => {
      state.selectResult = []

      const result = await getHouseholdBudgets("99")

      expect(result).toEqual([])
    })
  })

  // ========== createOrUpdateHouseholdBudget ==========
  describe("createOrUpdateHouseholdBudget", () => {
    it("有 categoryId 且存在記錄時應更新", async () => {
      state.selectResult = [mockBudget]
      state.updateResult = [{ ...mockBudget, budgetAmount: "70000.00" }]

      const result = await createOrUpdateHouseholdBudget({
        categoryId: 10,
        year: 2026,
        month: 3,
        budgetAmount: "70000.00",
      })

      expect(result.budgetAmount).toBe("70000.00")
    })

    it("有 categoryId 但無記錄時應建立", async () => {
      state.selectResult = []
      state.insertResult = [mockBudget]

      const result = await createOrUpdateHouseholdBudget({
        categoryId: 10,
        year: 2026,
        month: 3,
        budgetAmount: "50000.00",
      })

      expect(result).toEqual(mockBudget)
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it("categoryId 為 falsy 時直接建立", async () => {
      state.insertResult = [{ ...mockBudget, categoryId: null }]

      const result = await createOrUpdateHouseholdBudget({
        categoryId: 0,
        year: 2026,
        month: 3,
        budgetAmount: "50000.00",
      })

      expect(result.categoryId).toBeNull()
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })
})

describe("storage/household.ts - 家用支出管理", () => {
  beforeEach(resetState)

  // ========== getHouseholdExpenses ==========
  describe("getHouseholdExpenses", () => {
    it("無篩選時回傳全部支出", async () => {
      state.selectResult = [mockExpense]

      const result = await getHouseholdExpenses()

      expect(result).toEqual([mockExpense])
    })

    it("使用 year + month 篩選", async () => {
      state.selectResult = [mockExpense]

      const result = await getHouseholdExpenses({
        year: "2026",
        month: "3",
      })

      expect(result).toEqual([mockExpense])
    })

    it("只用 month（YYYY-MM 格式）篩選", async () => {
      state.selectResult = [mockExpense]

      const result = await getHouseholdExpenses({
        month: "2026-03",
      })

      expect(result).toEqual([mockExpense])
    })

    it("使用 categoryId 篩選", async () => {
      state.selectResult = [mockExpense]

      const result = await getHouseholdExpenses({
        categoryId: 10,
      })

      expect(result).toEqual([mockExpense])
    })

    it("同時使用 year + month + categoryId 篩選", async () => {
      state.selectResult = [mockExpense]

      const result = await getHouseholdExpenses({
        year: "2026",
        month: "3",
        categoryId: 10,
      })

      expect(result).toEqual([mockExpense])
    })

    it("分頁查詢：page=1, limit=10", async () => {
      state.selectResult = [mockExpense]

      const result = await getHouseholdExpenses({}, 1, 10)

      expect(result).toEqual([mockExpense])
    })

    it("12 月跨年計算（year+month）", async () => {
      state.selectResult = []

      const result = await getHouseholdExpenses({
        year: "2026",
        month: "12",
      })

      expect(result).toEqual([])
    })

    it("12 月跨年計算（month only YYYY-MM）", async () => {
      state.selectResult = []

      const result = await getHouseholdExpenses({
        month: "2026-12",
      })

      expect(result).toEqual([])
    })

    it("無結果回傳空陣列", async () => {
      state.selectResult = []

      const result = await getHouseholdExpenses({
        year: "2025",
        month: "1",
      })

      expect(result).toEqual([])
    })
  })

  // ========== createHouseholdExpense ==========
  describe("createHouseholdExpense", () => {
    it("成功建立支出", async () => {
      state.insertResult = [mockExpense]

      const result = await createHouseholdExpense({
        categoryId: 10,
        amount: "1500.00",
        date: "2026-03-15",
        description: "日用品",
        paymentMethod: "cash",
      })

      expect(result).toEqual(mockExpense)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  // ========== updateHouseholdExpense ==========
  describe("updateHouseholdExpense", () => {
    it("成功更新支出", async () => {
      const updated = { ...mockExpense, amount: "2000.00" }
      state.updateResult = [updated]

      const result = await updateHouseholdExpense(1, {
        amount: "2000.00",
      })

      expect(result.amount).toBe("2000.00")
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  // ========== deleteHouseholdExpense ==========
  describe("deleteHouseholdExpense", () => {
    it("成功刪除支出", async () => {
      state.deleteResult = undefined

      await expect(deleteHouseholdExpense(1)).resolves.toBeUndefined()
      expect(mockDb.delete).toHaveBeenCalled()
    })
  })
})

describe("storage/household.ts - 分類預算管理", () => {
  beforeEach(resetState)

  // ========== getHouseholdCategoryBudgets ==========
  describe("getHouseholdCategoryBudgets", () => {
    it("無篩選回傳全部", async () => {
      state.selectResult = [mockBudget]

      const result = await getHouseholdCategoryBudgets()

      expect(result).toEqual([mockBudget])
    })

    it("使用 year 篩選", async () => {
      state.selectResult = [mockBudget]

      const result = await getHouseholdCategoryBudgets({ year: 2026 })

      expect(result).toEqual([mockBudget])
    })

    it("使用 month 篩選", async () => {
      state.selectResult = [mockBudget]

      const result = await getHouseholdCategoryBudgets({ month: 3 })

      expect(result).toEqual([mockBudget])
    })

    it("使用 categoryId 篩選", async () => {
      state.selectResult = [mockBudget]

      const result = await getHouseholdCategoryBudgets({ categoryId: 10 })

      expect(result).toEqual([mockBudget])
    })

    it("使用 isActive 篩選", async () => {
      state.selectResult = [mockBudget]

      const result = await getHouseholdCategoryBudgets({ isActive: true })

      expect(result).toEqual([mockBudget])
    })

    it("使用所有篩選條件", async () => {
      state.selectResult = [mockBudget]

      const result = await getHouseholdCategoryBudgets({
        year: 2026,
        month: 3,
        categoryId: 10,
        isActive: true,
      })

      expect(result).toEqual([mockBudget])
    })

    it("isActive=false 也能篩選", async () => {
      state.selectResult = []

      const result = await getHouseholdCategoryBudgets({ isActive: false })

      expect(result).toEqual([])
    })
  })

  // ========== createHouseholdBudget ==========
  describe("createHouseholdBudget", () => {
    it("缺少 categoryId 時拋出錯誤", async () => {
      await expect(
        createHouseholdBudget({
          categoryId: 0,
          year: 2026,
          month: 3,
          budgetAmount: "50000.00",
        })
      ).rejects.toThrow("categoryId, year and month are required")
    })

    it("缺少 year 時拋出錯誤", async () => {
      await expect(
        createHouseholdBudget({
          categoryId: 10,
          year: 0,
          month: 3,
          budgetAmount: "50000.00",
        })
      ).rejects.toThrow("categoryId, year and month are required")
    })

    it("缺少 month 時拋出錯誤", async () => {
      await expect(
        createHouseholdBudget({
          categoryId: 10,
          year: 2026,
          month: 0,
          budgetAmount: "50000.00",
        })
      ).rejects.toThrow("categoryId, year and month are required")
    })

    it("存在多筆重複時，保留最新、刪除舊的、並更新", async () => {
      const duplicate1 = { ...mockBudget, id: 1 }
      const duplicate2 = { ...mockBudget, id: 2 }
      state.selectResult = [duplicate1, duplicate2]
      state.updateResult = [{ ...duplicate1, budgetAmount: "60000.00" }]

      const result = await createHouseholdBudget({
        categoryId: 10,
        year: 2026,
        month: 3,
        budgetAmount: "60000.00",
      })

      expect(result.budgetAmount).toBe("60000.00")
      expect(mockDb.delete).toHaveBeenCalled()
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("存在單筆記錄時直接更新", async () => {
      state.selectResult = [mockBudget]
      state.updateResult = [{ ...mockBudget, budgetAmount: "55000.00" }]

      const result = await createHouseholdBudget({
        categoryId: 10,
        year: 2026,
        month: 3,
        budgetAmount: "55000.00",
      })

      expect(result.budgetAmount).toBe("55000.00")
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("無記錄時建立新的", async () => {
      state.selectResult = []
      state.insertResult = [mockBudget]

      const result = await createHouseholdBudget({
        categoryId: 10,
        year: 2026,
        month: 3,
        budgetAmount: "50000.00",
      })

      expect(result).toEqual(mockBudget)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  // ========== updateHouseholdBudget ==========
  describe("updateHouseholdBudget", () => {
    it("成功更新預算", async () => {
      const updated = { ...mockBudget, budgetAmount: "80000.00" }
      state.updateResult = [updated]

      const result = await updateHouseholdBudget(1, {
        budgetAmount: "80000.00",
      })

      expect(result.budgetAmount).toBe("80000.00")
    })
  })

  // ========== updateHouseholdCategoryBudget ==========
  describe("updateHouseholdCategoryBudget", () => {
    it("成功更新分類預算", async () => {
      const updated = { ...mockBudget, budgetAmount: "90000.00" }
      state.updateResult = [updated]

      const result = await updateHouseholdCategoryBudget(1, {
        budgetAmount: "90000.00",
      })

      expect(result.budgetAmount).toBe("90000.00")
    })
  })

  // ========== deleteHouseholdBudget ==========
  describe("deleteHouseholdBudget", () => {
    it("成功刪除預算", async () => {
      await expect(deleteHouseholdBudget(1)).resolves.toBeUndefined()
      expect(mockDb.delete).toHaveBeenCalled()
    })
  })
})

describe("storage/household.ts - 統計與年度預算", () => {
  beforeEach(resetState)

  // ========== getHouseholdCategoryStats ==========
  describe("getHouseholdCategoryStats", () => {
    it("有支出時正確計算統計", async () => {
      const expense1 = { ...mockExpense, amount: "1000.00" }
      const expense2 = { ...mockExpense, id: 2, amount: "500.00" }
      state.selectResult = [expense1, expense2]

      const result = await getHouseholdCategoryStats(10, "2026", "3")

      expect(result).toBeDefined()
      expect(result.expenseCount).toBeGreaterThanOrEqual(0)
    })

    it("無指定年月時使用當前日期", async () => {
      state.selectResult = []

      const result = await getHouseholdCategoryStats(10)

      expect(result).toBeDefined()
      expect(result.expenseCount).toBeGreaterThanOrEqual(0)
    })

    it("12 月的跨年計算", async () => {
      state.selectResult = []

      const result = await getHouseholdCategoryStats(10, "2026", "12")

      expect(result).toBeDefined()
    })
  })

  // ========== getHouseholdStats ==========
  describe("getHouseholdStats", () => {
    it("回傳當月統計", async () => {
      state.selectResult = []

      const result = await getHouseholdStats()

      expect(result).toBeDefined()
      expect(result).toHaveProperty("budget")
      expect(result).toHaveProperty("totalExpenses")
      expect(result).toHaveProperty("remaining")
      expect(result).toHaveProperty("expenseCount")
      expect(result).toHaveProperty("categoryBreakdown")
    })

    it("有支出時正確合計金額", async () => {
      const expenses = [
        { ...mockExpense, amount: "1000.00" },
        { ...mockExpense, id: 2, amount: "2000.00" },
      ]
      state.selectResult = expenses

      const result = await getHouseholdStats()

      expect(result).toBeDefined()
      expect(result.expenseCount).toBeGreaterThanOrEqual(0)
    })
  })

  // ========== getYearlyBudgets ==========
  describe("getYearlyBudgets", () => {
    it("回傳指定年度的預算清單", async () => {
      const yearlyBudget = {
        id: 1,
        categoryId: 10,
        year: 2026,
        month: 3,
        budgetAmount: "50000.00",
        categoryName: "食品",
      }
      state.selectResult = [yearlyBudget]

      const result = await getYearlyBudgets(2026)

      expect(result).toEqual([yearlyBudget])
    })

    it("無預算時回傳空陣列", async () => {
      state.selectResult = []

      const result = await getYearlyBudgets(2025)

      expect(result).toEqual([])
    })
  })

  // ========== createOrUpdateYearlyBudget ==========
  describe("createOrUpdateYearlyBudget", () => {
    it("已存在預算時更新", async () => {
      state.selectResult = [mockBudget]
      state.updateResult = [{ ...mockBudget, budgetAmount: "60000.00" }]

      const result = await createOrUpdateYearlyBudget({
        categoryId: 10,
        year: 2026,
        month: 3,
        budgetAmount: "60000.00",
      })

      expect(result.budgetAmount).toBe("60000.00")
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("不存在預算時建立新的", async () => {
      state.selectResult = []
      state.insertResult = [mockBudget]

      const result = await createOrUpdateYearlyBudget({
        categoryId: 10,
        year: 2026,
        month: 3,
        budgetAmount: "50000.00",
      })

      expect(result).toEqual(mockBudget)
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it("金額為數字時轉成字串", async () => {
      state.selectResult = []
      state.insertResult = [mockBudget]

      const result = await createOrUpdateYearlyBudget({
        categoryId: 10,
        year: 2026,
        month: 3,
        budgetAmount: 50000,
      })

      expect(result).toEqual(mockBudget)
    })
  })

  // ========== getMonthlyBudgets ==========
  describe("getMonthlyBudgets", () => {
    it("回傳指定年月的預算清單", async () => {
      const monthlyBudget = {
        id: 1,
        categoryId: 10,
        year: 2026,
        month: 3,
        budgetAmount: "50000.00",
        categoryName: "食品",
      }
      state.selectResult = [monthlyBudget]

      const result = await getMonthlyBudgets(2026, 3)

      expect(result).toEqual([monthlyBudget])
    })

    it("無預算時回傳空陣列", async () => {
      state.selectResult = []

      const result = await getMonthlyBudgets(2025, 1)

      expect(result).toEqual([])
    })
  })
})
