/**
 * HR Costs Storage 層單元測試
 *
 * 使用 vi.mock 模擬 DB，測試 storage 層的查詢邏輯。
 * 不需要 PostgreSQL 連線。
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// 模擬 DB 回傳值
const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()
const mockInsertValues = vi.fn()
const mockInsertReturning = vi.fn()
const mockUpdateSet = vi.fn()
const mockUpdateWhere = vi.fn()
const mockUpdateReturning = vi.fn()
const mockDeleteWhere = vi.fn()

// 模擬 drizzle db
vi.mock("../../server/db", () => ({
  db: {
    query: {
      employees: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
      monthlyHrCosts: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
    insert: () => ({
      values: (...args: unknown[]) => {
        mockInsertValues(...args)
        return {
          returning: () => mockInsertReturning(),
        }
      },
    }),
    update: () => ({
      set: (...args: unknown[]) => {
        mockUpdateSet(...args)
        return {
          where: (...whereArgs: unknown[]) => {
            mockUpdateWhere(...whereArgs)
            return {
              returning: () => mockUpdateReturning(),
            }
          },
        }
      },
    }),
    delete: () => ({
      where: (...args: unknown[]) => {
        mockDeleteWhere(...args)
        return Promise.resolve()
      },
    }),
  },
}))

// 模擬 drizzle-orm 運算子
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val, op: "eq" })),
  and: vi.fn((...conditions) => ({ conditions, op: "and" })),
  asc: vi.fn((col) => ({ col, dir: "asc" })),
}))

// 模擬 schema
vi.mock("@shared/schema", () => ({
  employees: {
    id: "employees.id",
    isActive: "employees.isActive",
    employeeName: "employees.employeeName",
  },
  monthlyHrCosts: {
    id: "monthlyHrCosts.id",
    year: "monthlyHrCosts.year",
    month: "monthlyHrCosts.month",
    employeeId: "monthlyHrCosts.employeeId",
    $inferInsert: {},
  },
}))

// 測試用假資料
const mockEmployee = {
  id: 1,
  employeeName: "張三",
  position: "前台",
  monthlySalary: "35000.00",
  insuredSalary: null,
  hireDate: "2025-01-15",
  terminationDate: null,
  dependentsCount: 0,
  voluntaryPensionRate: "0.00",
  isActive: true,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockInactiveEmployee = {
  ...mockEmployee,
  id: 2,
  employeeName: "李四",
  isActive: false,
  terminationDate: "2025-12-31",
}

const mockMonthlyHrCost = {
  id: 10,
  year: 2026,
  month: 3,
  employeeId: 1,
  baseSalary: "35000.00",
  insuredSalary: "36300.00",
  employerLaborInsurance: "2797",
  employerHealthInsurance: "2924",
  employerPension: "2178",
  employerEmploymentInsurance: "254",
  employerAccidentInsurance: "58",
  employerTotal: "8211",
  employeeLaborInsurance: "799",
  employeeHealthInsurance: "563",
  employeePension: "0",
  employeeTotal: "1362",
  netSalary: "33638",
  totalCost: "43211",
  isPaid: false,
  insurancePaid: false,
  paymentRecordId: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("HR Costs Storage 層", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getEmployees ────────────────────────────────────────────

  describe("getEmployees", () => {
    it("不帶篩選條件應查詢所有員工", async () => {
      mockFindMany.mockResolvedValue([mockEmployee, mockInactiveEmployee])

      const { getEmployees } = await import("../../server/storage/hr-costs")
      const result = await getEmployees()

      expect(mockFindMany).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(2)
      expect(result[0].employeeName).toBe("張三")
    })

    it("篩選 active=true 應加入 where 條件", async () => {
      mockFindMany.mockResolvedValue([mockEmployee])

      const { getEmployees } = await import("../../server/storage/hr-costs")
      const result = await getEmployees({ active: true })

      expect(mockFindMany).toHaveBeenCalled()
      expect(result).toHaveLength(1)
      expect(result[0].isActive).toBe(true)
    })

    it("篩選 active=false 應查詢離職員工", async () => {
      mockFindMany.mockResolvedValue([mockInactiveEmployee])

      const { getEmployees } = await import("../../server/storage/hr-costs")
      const result = await getEmployees({ active: false })

      expect(mockFindMany).toHaveBeenCalled()
      expect(result).toHaveLength(1)
      expect(result[0].isActive).toBe(false)
    })

    it("空結果應回傳空陣列", async () => {
      mockFindMany.mockResolvedValue([])

      const { getEmployees } = await import("../../server/storage/hr-costs")
      const result = await getEmployees()

      expect(result).toHaveLength(0)
    })
  })

  // ── getEmployee ─────────────────────────────────────────────

  describe("getEmployee", () => {
    it("應回傳指定 ID 的員工", async () => {
      mockFindFirst.mockResolvedValue(mockEmployee)

      const { getEmployee } = await import("../../server/storage/hr-costs")
      const result = await getEmployee(1)

      expect(mockFindFirst).toHaveBeenCalled()
      expect(result).toBeDefined()
      expect(result?.id).toBe(1)
    })

    it("不存在的 ID 應回傳 undefined", async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const { getEmployee } = await import("../../server/storage/hr-costs")
      const result = await getEmployee(999)

      expect(result).toBeUndefined()
    })
  })

  // ── createEmployee ──────────────────────────────────────────

  describe("createEmployee", () => {
    it("應正確建立員工並回傳結果", async () => {
      mockInsertReturning.mockResolvedValue([mockEmployee])

      const { createEmployee } = await import("../../server/storage/hr-costs")
      const result = await createEmployee({
        employeeName: "張三",
        monthlySalary: "35000",
        hireDate: "2025-01-15",
      })

      expect(mockInsertValues).toHaveBeenCalled()
      expect(result.employeeName).toBe("張三")
      expect(result.id).toBe(1)
    })
  })

  // ── updateEmployee ──────────────────────────────────────────

  describe("updateEmployee", () => {
    it("應成功更新員工資料", async () => {
      const updated = { ...mockEmployee, monthlySalary: "40000.00" }
      mockUpdateReturning.mockResolvedValue([updated])

      const { updateEmployee } = await import("../../server/storage/hr-costs")
      const result = await updateEmployee(1, { monthlySalary: "40000" })

      expect(mockUpdateSet).toHaveBeenCalled()
      expect(result).toBeDefined()
      expect(result?.monthlySalary).toBe("40000.00")
    })

    it("不存在的 ID 應回傳 undefined", async () => {
      mockUpdateReturning.mockResolvedValue([])

      const { updateEmployee } = await import("../../server/storage/hr-costs")
      const result = await updateEmployee(999, { monthlySalary: "40000" })

      expect(result).toBeUndefined()
    })
  })

  // ── softDeleteEmployee ──────────────────────────────────────

  describe("softDeleteEmployee", () => {
    it("應將員工設為離職", async () => {
      const deleted = {
        ...mockEmployee,
        isActive: false,
        terminationDate: "2026-03-04",
      }
      mockUpdateReturning.mockResolvedValue([deleted])

      const { softDeleteEmployee } = await import("../../server/storage/hr-costs")
      const result = await softDeleteEmployee(1)

      expect(mockUpdateSet).toHaveBeenCalled()
      expect(result).toBeDefined()
      expect(result?.isActive).toBe(false)
      expect(result?.terminationDate).toBeDefined()
    })

    it("不存在的 ID 應回傳 undefined", async () => {
      mockUpdateReturning.mockResolvedValue([])

      const { softDeleteEmployee } = await import("../../server/storage/hr-costs")
      const result = await softDeleteEmployee(999)

      expect(result).toBeUndefined()
    })
  })

  // ── getMonthlyHrCosts ───────────────────────────────────────

  describe("getMonthlyHrCosts", () => {
    it("應回傳指定月份的人事費記錄", async () => {
      const costWithEmployee = {
        ...mockMonthlyHrCost,
        employee: mockEmployee,
      }
      mockFindMany.mockResolvedValue([costWithEmployee])

      const { getMonthlyHrCosts } = await import("../../server/storage/hr-costs")
      const result = await getMonthlyHrCosts(2026, 3)

      expect(mockFindMany).toHaveBeenCalled()
      expect(result).toHaveLength(1)
      expect(result[0].year).toBe(2026)
      expect(result[0].month).toBe(3)
      expect(result[0].employee).toBeDefined()
    })

    it("沒有記錄時應回傳空陣列", async () => {
      mockFindMany.mockResolvedValue([])

      const { getMonthlyHrCosts } = await import("../../server/storage/hr-costs")
      const result = await getMonthlyHrCosts(2099, 12)

      expect(result).toHaveLength(0)
    })
  })

  // ── createMonthlyHrCosts ────────────────────────────────────

  describe("createMonthlyHrCosts", () => {
    it("應批量插入月度人事費記錄", async () => {
      mockInsertReturning.mockResolvedValue([mockMonthlyHrCost])

      const { createMonthlyHrCosts } = await import("../../server/storage/hr-costs")
      const records = [
        {
          year: 2026,
          month: 3,
          employeeId: 1,
          baseSalary: "35000",
          insuredSalary: "36300",
          employerLaborInsurance: "2797",
          employerHealthInsurance: "2924",
          employerPension: "2178",
          employerEmploymentInsurance: "254",
          employerAccidentInsurance: "58",
          employerTotal: "8211",
          employeeLaborInsurance: "799",
          employeeHealthInsurance: "563",
          employeePension: "0",
          employeeTotal: "1362",
          netSalary: "33638",
          totalCost: "43211",
        },
      ]

      const result = await createMonthlyHrCosts(records)

      expect(mockInsertValues).toHaveBeenCalled()
      expect(result).toHaveLength(1)
    })
  })

  // ── deleteMonthlyHrCosts ────────────────────────────────────

  describe("deleteMonthlyHrCosts", () => {
    it("應刪除指定月份的所有記錄", async () => {
      mockDeleteWhere.mockResolvedValue(undefined)

      const { deleteMonthlyHrCosts } = await import("../../server/storage/hr-costs")
      await deleteMonthlyHrCosts(2026, 3)

      expect(mockDeleteWhere).toHaveBeenCalled()
    })
  })

  // ── updateMonthlyHrCost ─────────────────────────────────────

  describe("updateMonthlyHrCost", () => {
    it("應更新付款狀態", async () => {
      const updated = { ...mockMonthlyHrCost, isPaid: true }
      mockUpdateReturning.mockResolvedValue([updated])

      const { updateMonthlyHrCost } = await import("../../server/storage/hr-costs")
      const result = await updateMonthlyHrCost(10, { isPaid: true })

      expect(mockUpdateSet).toHaveBeenCalled()
      expect(result).toBeDefined()
      expect(result?.isPaid).toBe(true)
    })

    it("應更新保險付款狀態", async () => {
      const updated = { ...mockMonthlyHrCost, insurancePaid: true }
      mockUpdateReturning.mockResolvedValue([updated])

      const { updateMonthlyHrCost } = await import("../../server/storage/hr-costs")
      const result = await updateMonthlyHrCost(10, { insurancePaid: true })

      expect(result).toBeDefined()
      expect(result?.insurancePaid).toBe(true)
    })

    it("不存在的 ID 應回傳 undefined", async () => {
      mockUpdateReturning.mockResolvedValue([])

      const { updateMonthlyHrCost } = await import("../../server/storage/hr-costs")
      const result = await updateMonthlyHrCost(999, { isPaid: true })

      expect(result).toBeUndefined()
    })
  })

  // ── getHrCostsByYear ────────────────────────────────────────

  describe("getHrCostsByYear", () => {
    it("應回傳指定年度的所有記錄", async () => {
      const costWithEmployee = {
        ...mockMonthlyHrCost,
        employee: mockEmployee,
      }
      mockFindMany.mockResolvedValue([costWithEmployee])

      const { getHrCostsByYear } = await import("../../server/storage/hr-costs")
      const result = await getHrCostsByYear(2026)

      expect(mockFindMany).toHaveBeenCalled()
      expect(result).toHaveLength(1)
    })

    it("沒有記錄時應回傳空陣列", async () => {
      mockFindMany.mockResolvedValue([])

      const { getHrCostsByYear } = await import("../../server/storage/hr-costs")
      const result = await getHrCostsByYear(2099)

      expect(result).toHaveLength(0)
    })
  })

  // ── getActiveEmployeeCount ──────────────────────────────────

  describe("getActiveEmployeeCount", () => {
    it("應回傳在職員工人數", async () => {
      mockFindMany.mockResolvedValue([mockEmployee])

      const { getActiveEmployeeCount } = await import("../../server/storage/hr-costs")
      const count = await getActiveEmployeeCount()

      expect(count).toBe(1)
    })

    it("沒有在職員工時應回傳 0", async () => {
      mockFindMany.mockResolvedValue([])

      const { getActiveEmployeeCount } = await import("../../server/storage/hr-costs")
      const count = await getActiveEmployeeCount()

      expect(count).toBe(0)
    })
  })

  // ── getActiveEmployees ──────────────────────────────────────

  describe("getActiveEmployees", () => {
    it("應回傳所有在職員工", async () => {
      mockFindMany.mockResolvedValue([mockEmployee])

      const { getActiveEmployees } = await import("../../server/storage/hr-costs")
      const result = await getActiveEmployees()

      expect(mockFindMany).toHaveBeenCalled()
      expect(result).toHaveLength(1)
      expect(result[0].isActive).toBe(true)
    })

    it("沒有在職員工時應回傳空陣列", async () => {
      mockFindMany.mockResolvedValue([])

      const { getActiveEmployees } = await import("../../server/storage/hr-costs")
      const result = await getActiveEmployees()

      expect(result).toHaveLength(0)
    })
  })
})
