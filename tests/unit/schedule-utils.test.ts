/**
 * 排程計算工具測試
 * 測試付款優先級計算和智慧排程建議
 */
import { describe, it, expect } from "vitest"
import {
  calculatePriority,
  generateSmartSchedule,
  getOverdueRescheduleItems,
  type ScheduleItem,
} from "@shared/schedule-utils"

// 建立測試用項目
function createItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 1,
    itemName: "測試項目",
    totalAmount: 10000,
    paidAmount: 0,
    remainingAmount: 10000,
    isOverdue: false,
    overdueDays: 0,
    hasLateFee: false,
    ...overrides,
  }
}

describe("calculatePriority", () => {
  it("逾期項目應該獲得最高優先級 (critical)", () => {
    const item = createItem({ isOverdue: true, overdueDays: 5 })
    const result = calculatePriority(item)
    expect(result.priorityLevel).toBe("critical")
    expect(result.priority).toBeGreaterThanOrEqual(100)
    expect(result.reason).toContain("逾期5天")
  })

  it("有罰款風險的項目應該優先級高", () => {
    const item = createItem({ hasLateFee: true })
    const result = calculatePriority(item)
    expect(result.priority).toBeGreaterThanOrEqual(50)
    expect(result.reason).toContain("罰款風險")
  })

  it("租金類別應有高優先級", () => {
    const item = createItem({ categoryType: "rent" })
    const result = calculatePriority(item)
    expect(result.priorityLevel).toBe("high")
    expect(result.reason).toContain("租金合約")
  })

  it("勞健保類別應有高優先級", () => {
    const item = createItem({ categoryType: "insurance" })
    const result = calculatePriority(item)
    expect(result.priorityLevel).toBe("high")
    expect(result.reason).toContain("勞健保費")
  })

  it("分期合約應有中等優先級", () => {
    const item = createItem({ paymentType: "installment" })
    const result = calculatePriority(item)
    expect(result.priorityLevel).toBe("medium")
    expect(result.reason).toContain("分期合約")
  })

  it("月付項目應有基本優先級", () => {
    const item = createItem({ paymentType: "monthly" })
    const result = calculatePriority(item)
    expect(result.priority).toBe(15)
    expect(result.reason).toContain("月付項目")
  })

  it("3 天內到期應增加 40 優先級", () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const item = createItem({ dueDate: tomorrow.toISOString().split("T")[0] })
    const result = calculatePriority(item)
    expect(result.priority).toBeGreaterThanOrEqual(40)
    expect(result.reason).toContain("3天內到期")
  })

  it("4-7 天內到期應增加 20 優先級", () => {
    const fiveDays = new Date()
    fiveDays.setDate(fiveDays.getDate() + 5)
    const item = createItem({ dueDate: fiveDays.toISOString().split("T")[0] })
    const result = calculatePriority(item)
    expect(result.priority).toBeGreaterThanOrEqual(20)
    expect(result.reason).toContain("7天內到期")
  })

  it("超過 7 天到期不增加額外優先級", () => {
    const tenDays = new Date()
    tenDays.setDate(tenDays.getDate() + 10)
    const item = createItem({ dueDate: tenDays.toISOString().split("T")[0] })
    const result = calculatePriority(item)
    expect(result.priority).toBe(0)
    expect(result.reason).toBe("一般項目")
  })

  it("無特殊條件的項目為低優先級", () => {
    const item = createItem()
    const result = calculatePriority(item)
    expect(result.priorityLevel).toBe("low")
    expect(result.reason).toBe("一般項目")
  })

  it("多條件疊加應累計優先級", () => {
    const item = createItem({
      isOverdue: true,
      overdueDays: 3,
      hasLateFee: true,
      categoryType: "rent",
    })
    const result = calculatePriority(item)
    expect(result.priorityLevel).toBe("critical")
    expect(result.priority).toBe(240) // 100 + 80 + 60
  })

  it("應保留原始項目所有屬性", () => {
    const item = createItem({ id: 42, itemName: "水電費", projectName: "浯島文旅" })
    const result = calculatePriority(item)
    expect(result.id).toBe(42)
    expect(result.itemName).toBe("水電費")
    expect(result.projectName).toBe("浯島文旅")
  })
})

describe("generateSmartSchedule", () => {
  it("預算充足時應排入所有項目", () => {
    const items = [
      createItem({ id: 1, remainingAmount: 5000 }),
      createItem({ id: 2, remainingAmount: 3000 }),
    ]
    const result = generateSmartSchedule(items, 10000)

    expect(result.isOverBudget).toBe(false)
    expect(result.scheduledItems).toHaveLength(2)
    expect(result.deferredItems).toHaveLength(0)
    expect(result.remainingBudget).toBe(2000)
  })

  it("預算不足時應依優先級排入並延後其餘", () => {
    const items = [
      createItem({ id: 1, remainingAmount: 5000, categoryType: "rent" }), // 高優先
      createItem({ id: 2, remainingAmount: 3000 }), // 低優先
      createItem({ id: 3, remainingAmount: 4000 }), // 低優先
    ]
    const result = generateSmartSchedule(items, 6000)

    expect(result.isOverBudget).toBe(true)
    expect(result.scheduledItems.length).toBeGreaterThan(0)
    expect(result.deferredItems.length).toBeGreaterThan(0)
    expect(result.scheduledTotal).toBeLessThanOrEqual(6000)
  })

  it("應正確計算總需求金額", () => {
    const items = [
      createItem({ remainingAmount: 5000 }),
      createItem({ remainingAmount: 3000 }),
      createItem({ remainingAmount: 7000 }),
    ]
    const result = generateSmartSchedule(items, 20000)
    expect(result.totalNeeded).toBe(15000)
  })

  it("關鍵項目應包含 critical 和 high 優先級", () => {
    const items = [
      createItem({ isOverdue: true, overdueDays: 1, remainingAmount: 2000 }), // critical
      createItem({ categoryType: "rent", remainingAmount: 3000 }), // high
      createItem({ remainingAmount: 1000 }), // low
    ]
    const result = generateSmartSchedule(items, 10000)
    expect(result.criticalItems).toHaveLength(2)
  })

  it("空項目清單應返回空結果", () => {
    const result = generateSmartSchedule([], 10000)
    expect(result.totalNeeded).toBe(0)
    expect(result.isOverBudget).toBe(false)
    expect(result.scheduledItems).toHaveLength(0)
    expect(result.remainingBudget).toBe(10000)
  })
})

describe("getOverdueRescheduleItems", () => {
  it("應只返回逾期項目", () => {
    const items = [
      createItem({ id: 1, isOverdue: true, overdueDays: 5 }),
      createItem({ id: 2, isOverdue: false }),
      createItem({ id: 3, isOverdue: true, overdueDays: 2 }),
    ]
    const result = getOverdueRescheduleItems(items)
    expect(result).toHaveLength(2)
    expect(result.every(item => item.isOverdue)).toBe(true)
  })

  it("應按優先級降序排列", () => {
    const items = [
      createItem({ id: 1, isOverdue: true, overdueDays: 2 }),
      createItem({ id: 2, isOverdue: true, overdueDays: 10, hasLateFee: true }),
    ]
    const result = getOverdueRescheduleItems(items)
    expect(result[0].id).toBe(2) // 更高優先級在前
    expect(result[0].priority).toBeGreaterThan(result[1].priority)
  })

  it("無逾期項目時應返回空陣列", () => {
    const items = [
      createItem({ isOverdue: false }),
      createItem({ isOverdue: false }),
    ]
    const result = getOverdueRescheduleItems(items)
    expect(result).toHaveLength(0)
  })
})
