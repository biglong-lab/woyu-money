/**
 * server/storage/helpers.ts 單元測試
 * 測試純計算函式：calculateMonthsBetween、getMonthIndex
 * （withRetry 等需要 DB 的函式不在此測試範圍）
 */
import { describe, it, expect } from "vitest"
import { calculateMonthsBetween, getMonthIndex } from "../../server/storage/helpers"

describe("calculateMonthsBetween", () => {
  it("同月應回傳 1", () => {
    const start = new Date(2024, 0, 1) // 2024-01
    const end = new Date(2024, 0, 31) // 2024-01
    expect(calculateMonthsBetween(start, end)).toBe(1)
  })

  it("連續兩個月應回傳 2", () => {
    const start = new Date(2024, 0, 1) // 2024-01
    const end = new Date(2024, 1, 1) // 2024-02
    expect(calculateMonthsBetween(start, end)).toBe(2)
  })

  it("跨年度應正確計算", () => {
    const start = new Date(2024, 10, 1) // 2024-11
    const end = new Date(2025, 1, 1) // 2025-02
    expect(calculateMonthsBetween(start, end)).toBe(4)
  })

  it("整年度 1月到12月應回傳 12", () => {
    const start = new Date(2024, 0, 1) // 2024-01
    const end = new Date(2024, 11, 31) // 2024-12
    // 公式：(12-1)*0 + (11-0) + 1 = 12
    expect(calculateMonthsBetween(start, end)).toBe(12)
  })

  it("跨多年應正確計算", () => {
    const start = new Date(2022, 0, 1) // 2022-01
    const end = new Date(2024, 0, 1) // 2024-01
    expect(calculateMonthsBetween(start, end)).toBe(25)
  })

  it("1月到6月應回傳 6", () => {
    const start = new Date(2024, 0, 1) // 2024-01
    const end = new Date(2024, 5, 30) // 2024-06
    // 公式：(0)*12 + (5-0) + 1 = 6
    expect(calculateMonthsBetween(start, end)).toBe(6)
  })
})

describe("getMonthIndex", () => {
  it("同月應回傳 0", () => {
    const start = new Date(2024, 0, 1) // 2024-01
    const current = new Date(2024, 0, 15) // 2024-01
    expect(getMonthIndex(start, current)).toBe(0)
  })

  it("下個月應回傳 1", () => {
    const start = new Date(2024, 0, 1) // 2024-01
    const current = new Date(2024, 1, 1) // 2024-02
    expect(getMonthIndex(start, current)).toBe(1)
  })

  it("跨年度應正確計算", () => {
    const start = new Date(2024, 10, 1) // 2024-11
    const current = new Date(2025, 1, 1) // 2025-02
    expect(getMonthIndex(start, current)).toBe(3)
  })

  it("一年後應回傳 12", () => {
    const start = new Date(2024, 0, 1) // 2024-01
    const current = new Date(2025, 0, 1) // 2025-01
    expect(getMonthIndex(start, current)).toBe(12)
  })

  it("兩年後應回傳 24", () => {
    const start = new Date(2024, 0, 1) // 2024-01
    const current = new Date(2026, 0, 1) // 2026-01
    expect(getMonthIndex(start, current)).toBe(24)
  })

  it("前面的月份應回傳負數", () => {
    const start = new Date(2024, 6, 1) // 2024-07
    const current = new Date(2024, 3, 1) // 2024-04
    expect(getMonthIndex(start, current)).toBe(-3)
  })
})
