/**
 * 分攤計算單元測試
 *
 * 測試重點：
 * - 各規則正確計算
 * - 總和恆等於原金額（餘數修正）
 * - 邊界條件（空、零、負數）
 * - 異常處理
 */

import { describe, it, expect } from "vitest"
import {
  allocateCost,
  estimateOccupancyCost,
  estimateFromHistory,
  type PropertyGroupMemberInput,
} from "../../shared/cost-allocation"

// ─────────────────────────────────────────────
// 輕旅櫃台組（測試 fixture）
// ─────────────────────────────────────────────

const QING_LV: PropertyGroupMemberInput = { projectId: 4, weight: 8 } // 8 房
const ZHAO_DAI: PropertyGroupMemberInput = { projectId: 10, weight: 4 } // 4 房
const KUI_XING: PropertyGroupMemberInput = { projectId: 20, weight: 6 } // 6 房

const GROUP = [QING_LV, ZHAO_DAI, KUI_XING]

// ─────────────────────────────────────────────
// allocateCost
// ─────────────────────────────────────────────

describe("allocateCost - equal 平均分攤", () => {
  it("3 館平均分攤 480k → 各 160k", () => {
    const result = allocateCost(480000, GROUP, "equal")
    expect(result).toHaveLength(3)
    expect(result[0].amount).toBe(160000)
    expect(result[1].amount).toBe(160000)
    expect(result[2].amount).toBe(160000)
  })

  it("總和必等於原金額（無誤差）", () => {
    const result = allocateCost(480000, GROUP, "equal")
    const sum = result.reduce((acc, r) => acc + r.amount, 0)
    expect(sum).toBe(480000)
  })

  it("無法整除時最後一筆吸收餘數（100 / 3 = 33,33,34）", () => {
    const result = allocateCost(100, GROUP, "equal")
    const sum = result.reduce((acc, r) => acc + r.amount, 0)
    expect(sum).toBe(100)
    // 前兩筆 33，最後一筆 34
    expect(result[0].amount).toBe(33)
    expect(result[1].amount).toBe(33)
    expect(result[2].amount).toBe(34)
  })

  it("basis 標示「平均分攤 (1/3)」", () => {
    const result = allocateCost(480000, GROUP, "equal")
    expect(result[0].basis).toBe("平均分攤 (1/3)")
  })
})

describe("allocateCost - by_rooms 房數比例", () => {
  it("輕旅 8 / 招待所 4 / 背包棧 6 房，總 18 房，分攤 360k", () => {
    const result = allocateCost(360000, GROUP, "by_rooms")
    // 輕旅 8/18 = 160000
    // 招待所 4/18 = 80000
    // 背包棧 6/18 = 120000
    expect(result[0].amount).toBe(160000)
    expect(result[1].amount).toBe(80000)
    expect(result[2].amount).toBe(120000)
  })

  it("總和必等於原金額", () => {
    const result = allocateCost(480000, GROUP, "by_rooms")
    const sum = result.reduce((acc, r) => acc + r.amount, 0)
    expect(sum).toBe(480000)
  })

  it("basis 含房數權重資訊", () => {
    const result = allocateCost(360000, GROUP, "by_rooms")
    expect(result[0].basis).toContain("房數比例")
    expect(result[0].basis).toContain("8")
  })
})

describe("allocateCost - by_revenue 營收比例", () => {
  it("依各館當月營收分攤", () => {
    const members: PropertyGroupMemberInput[] = [
      { projectId: 4, weight: 8, revenue: 800000 },
      { projectId: 10, weight: 4, revenue: 200000 },
      { projectId: 20, weight: 6, revenue: 1000000 },
    ]
    const result = allocateCost(200000, members, "by_revenue")
    // 總營收 2M，各占 40% / 10% / 50%
    expect(result[0].amount).toBe(80000)
    expect(result[1].amount).toBe(20000)
    expect(result[2].amount).toBe(100000)
  })

  it("缺少 revenue 時當作 0（會降低該館比例）", () => {
    const members: PropertyGroupMemberInput[] = [
      { projectId: 4, weight: 8, revenue: 100000 },
      { projectId: 10, weight: 4 }, // 沒給 revenue
      { projectId: 20, weight: 6, revenue: 100000 },
    ]
    const result = allocateCost(200000, members, "by_revenue")
    // 第二館完全不分攤
    expect(result[0].amount).toBe(100000)
    expect(result[1].amount).toBe(0)
    expect(result[2].amount).toBe(100000)
  })

  it("全部營收為 0 時拋錯（無法分攤）", () => {
    const members: PropertyGroupMemberInput[] = [
      { projectId: 4, weight: 8, revenue: 0 },
      { projectId: 10, weight: 4, revenue: 0 },
    ]
    expect(() => allocateCost(100, members, "by_revenue")).toThrow(/總權重為 0/)
  })
})

describe("allocateCost - manual 手動權重", () => {
  it("用 weight 欄位作為手動指定的相對權重", () => {
    const members: PropertyGroupMemberInput[] = [
      { projectId: 4, weight: 70 },
      { projectId: 10, weight: 20 },
      { projectId: 20, weight: 10 },
    ]
    const result = allocateCost(100000, members, "manual")
    expect(result[0].amount).toBe(70000)
    expect(result[1].amount).toBe(20000)
    expect(result[2].amount).toBe(10000)
  })

  it("basis 標示「手動權重」", () => {
    const result = allocateCost(100000, GROUP, "manual")
    expect(result[0].basis).toContain("手動權重")
  })
})

describe("allocateCost - 邊界條件", () => {
  it("金額為 0 時所有成員都分到 0", () => {
    const result = allocateCost(0, GROUP, "equal")
    expect(result.every((r) => r.amount === 0)).toBe(true)
  })

  it("空成員列表拋錯", () => {
    expect(() => allocateCost(100, [], "equal")).toThrow(/不可為空/)
  })

  it("非有限數字拋錯", () => {
    expect(() => allocateCost(NaN, GROUP, "equal")).toThrow(/有限數字/)
    expect(() => allocateCost(Infinity, GROUP, "equal")).toThrow(/有限數字/)
  })

  it("單一成員時全部歸該成員", () => {
    const result = allocateCost(50000, [QING_LV], "equal")
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(50000)
  })

  it("by_rooms 但所有 weight 都是 0 時拋錯", () => {
    const members: PropertyGroupMemberInput[] = [
      { projectId: 4, weight: 0 },
      { projectId: 10, weight: 0 },
    ]
    expect(() => allocateCost(100, members, "by_rooms")).toThrow(/總權重為 0/)
  })
})

// ─────────────────────────────────────────────
// estimateOccupancyCost
// ─────────────────────────────────────────────

describe("estimateOccupancyCost - 佔用驅動費用預估", () => {
  it("PT 700/天 × 8 天 = 5600", () => {
    expect(estimateOccupancyCost(700, 8)).toBe(5600)
  })

  it("洗滌 150/天 × 12 天 = 1800", () => {
    expect(estimateOccupancyCost(150, 12)).toBe(1800)
  })

  it("天數為 0 時返回 0", () => {
    expect(estimateOccupancyCost(700, 0)).toBe(0)
  })

  it("負數拋錯", () => {
    expect(() => estimateOccupancyCost(-100, 5)).toThrow()
    expect(() => estimateOccupancyCost(100, -5)).toThrow()
  })

  it("小數結果四捨五入", () => {
    expect(estimateOccupancyCost(166.67, 3)).toBe(500) // 500.01 → 500
  })
})

// ─────────────────────────────────────────────
// estimateFromHistory
// ─────────────────────────────────────────────

describe("estimateFromHistory - 歷史平均", () => {
  it("過去 6 個月電費 [18000, 19000, 20000, 17000, 22000, 21000]", () => {
    const result = estimateFromHistory([18000, 19000, 20000, 17000, 22000, 21000])
    // 去掉最高最低 (17000, 22000) 後剩 [18000, 19000, 20000, 21000]
    // 平均 = (18000+19000+20000+21000) / 4 = 19500
    expect(result).toBe(19500)
  })

  it("樣本 ≤ 2 不去極值", () => {
    expect(estimateFromHistory([100, 200])).toBe(150)
    expect(estimateFromHistory([100])).toBe(100)
  })

  it("空陣列返回 0", () => {
    expect(estimateFromHistory([])).toBe(0)
  })

  it("trimOutliers=false 不去極值", () => {
    const all = [18000, 19000, 20000, 17000, 22000, 21000]
    const sumAvg = Math.round(all.reduce((a, b) => a + b, 0) / all.length)
    expect(estimateFromHistory(all, false)).toBe(sumAvg)
  })

  it("結果為整數（四捨五入）", () => {
    const result = estimateFromHistory([100, 200, 333, 444, 555])
    // 去極值後 [200, 333, 444]，平均 = 325.67 → 326
    expect(Number.isInteger(result)).toBe(true)
  })
})
