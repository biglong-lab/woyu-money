/**
 * Schema 驗證測試
 * 測試 Zod 驗證 schema 的正確性
 */
import { describe, it, expect } from "vitest"
import {
  insertPaymentItemSchema,
  insertPaymentRecordSchema,
  insertRentalContractSchema,
  insertDebtCategorySchema,
  insertPaymentProjectSchema,
  insertHouseholdExpenseSchema,
  loginSchema,
  insertUserSchema,
  insertEmployeeSchema,
} from "@shared/schema"

describe("loginSchema", () => {
  it("有效的登入資料應通過驗證", () => {
    const data = { username: "admin", password: "admin123" }
    const result = loginSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("空用戶名應驗證失敗", () => {
    const data = { username: "", password: "admin123" }
    const result = loginSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("空密碼應驗證失敗", () => {
    const data = { username: "admin", password: "" }
    const result = loginSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少欄位應驗證失敗", () => {
    const result = loginSchema.safeParse({ username: "admin" })
    expect(result.success).toBe(false)
  })
})

describe("insertUserSchema", () => {
  it("密碼少於 8 字元應驗證失敗", () => {
    const data = { username: "test", password: "123" }
    const result = insertUserSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("無效 email 應驗證失敗", () => {
    const data = { username: "test", email: "not-email" }
    const result = insertUserSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("有效資料應通過驗證", () => {
    const data = { username: "test", password: "password123", email: "test@example.com" }
    const result = insertUserSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe("insertPaymentItemSchema", () => {
  it("有效的付款項目應通過驗證", () => {
    const data = {
      itemName: "電話費",
      totalAmount: "5000",
      startDate: "2026-01-01",
    }
    const result = insertPaymentItemSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("數字型 totalAmount 應自動轉為字串", () => {
    const data = {
      itemName: "水費",
      totalAmount: 3000,
      startDate: "2026-01-01",
    }
    const result = insertPaymentItemSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.totalAmount).toBe("3000")
    }
  })

  it("缺少 itemName 應驗證失敗", () => {
    const data = { totalAmount: "5000", startDate: "2026-01-01" }
    const result = insertPaymentItemSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("null startDate 應通過（可選）", () => {
    const data = {
      itemName: "雜費",
      totalAmount: "1000",
      startDate: null,
    }
    const result = insertPaymentItemSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe("insertPaymentRecordSchema", () => {
  it("有效的付款紀錄應通過驗證", () => {
    const data = {
      itemId: 1,
      amountPaid: "5000",
      paymentDate: "2026-01-15",
    }
    const result = insertPaymentRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe("insertDebtCategorySchema", () => {
  it("有效的分類應通過驗證", () => {
    const data = { categoryName: "電話費" }
    const result = insertDebtCategorySchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 categoryName 應驗證失敗", () => {
    const result = insertDebtCategorySchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("insertPaymentProjectSchema", () => {
  it("有效的專案應通過驗證", () => {
    const data = { projectName: "浯島文旅" }
    const result = insertPaymentProjectSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe("insertRentalContractSchema", () => {
  it("有效的租約應通過驗證", () => {
    const data = {
      projectId: 1,
      contractName: "A 棟租約",
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      totalYears: 3,
      totalMonths: 36,
      baseAmount: "25000",
    }
    const result = insertRentalContractSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("數字型 baseAmount 應自動轉為字串", () => {
    const data = {
      projectId: 1,
      contractName: "B 棟租約",
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      totalYears: 3,
      totalMonths: 36,
      baseAmount: 30000,
    }
    const result = insertRentalContractSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.baseAmount).toBe("30000")
    }
  })
})

describe("insertHouseholdExpenseSchema", () => {
  it("有效的家用支出應通過驗證", () => {
    const data = {
      amount: "350",
      date: "2026-01-15",
      description: "午餐",
    }
    const result = insertHouseholdExpenseSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe("insertEmployeeSchema", () => {
  it("有效的員工資料應通過驗證", () => {
    const data = {
      employeeName: "王小明",
      monthlySalary: "35000",
      hireDate: "2025-06-01",
    }
    const result = insertEmployeeSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("數字型薪資應自動轉為字串", () => {
    const data = {
      employeeName: "李小華",
      monthlySalary: 28000,
      hireDate: "2025-06-01",
    }
    const result = insertEmployeeSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.monthlySalary).toBe("28000")
    }
  })

  it("dependentsCount 字串應自動轉為整數", () => {
    const data = {
      employeeName: "張三",
      monthlySalary: "30000",
      hireDate: "2025-06-01",
      dependentsCount: "2",
    }
    const result = insertEmployeeSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dependentsCount).toBe(2)
    }
  })
})
