/**
 * shared/date-utils.ts 測試
 *
 * 防 regression：確保 TPE 時區的 YYYY-MM-DD 永遠正確
 * 涵蓋早晨時段（防 UTC bug 回歸）+ 跨月跨年邊界
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { localDateTPE, localMonthTPE } from "../../shared/date-utils"

describe("localDateTPE", () => {
  beforeAll(() => {
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it("應回傳 YYYY-MM-DD 格式", () => {
    vi.setSystemTime(new Date("2026-04-15T04:00:00Z")) // UTC 04:00 = TPE 12:00
    const result = localDateTPE(0)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("offset=0 在 TPE 正午應為當天", () => {
    // UTC 04:00 = TPE 12:00 同一天
    vi.setSystemTime(new Date("2026-04-15T04:00:00Z"))
    expect(localDateTPE(0)).toBe("2026-04-15")
  })

  it("Bug 修復驗證：UTC 22:00 (TPE 06:00) 應為 TPE 當天", () => {
    // UTC 2026-04-14 22:00 = TPE 2026-04-15 06:00
    // 用 toISOString().slice(0,10) 會得到 "2026-04-14" ❌
    // localDateTPE 應正確回傳 "2026-04-15" ✓
    vi.setSystemTime(new Date("2026-04-14T22:00:00Z"))
    expect(localDateTPE(0)).toBe("2026-04-15")
  })

  it("Bug 修復驗證：UTC 16:00 (TPE 00:00) 應為 TPE 新一天", () => {
    // UTC 2026-04-14 16:00 = TPE 2026-04-15 00:00 (剛跨日)
    vi.setSystemTime(new Date("2026-04-14T16:00:00Z"))
    expect(localDateTPE(0)).toBe("2026-04-15")
  })

  it("offset=-1 應回傳 TPE 昨天", () => {
    vi.setSystemTime(new Date("2026-04-15T04:00:00Z"))
    expect(localDateTPE(-1)).toBe("2026-04-14")
  })

  it("offset=+1 應回傳 TPE 明天", () => {
    vi.setSystemTime(new Date("2026-04-15T04:00:00Z"))
    expect(localDateTPE(1)).toBe("2026-04-16")
  })

  it("跨月：TPE 04-30 → +1 = 05-01", () => {
    vi.setSystemTime(new Date("2026-04-30T04:00:00Z"))
    expect(localDateTPE(1)).toBe("2026-05-01")
  })

  it("跨年：TPE 12-31 → +1 = 下一年 01-01", () => {
    vi.setSystemTime(new Date("2026-12-31T04:00:00Z"))
    expect(localDateTPE(1)).toBe("2027-01-01")
  })

  it("default offset 應為 0", () => {
    vi.setSystemTime(new Date("2026-04-15T04:00:00Z"))
    expect(localDateTPE()).toBe("2026-04-15")
  })

  it("自訂時區：UTC 應回傳 UTC 日期", () => {
    vi.setSystemTime(new Date("2026-04-15T04:00:00Z"))
    expect(localDateTPE(0, "UTC")).toBe("2026-04-15")
  })

  it("自訂時區：紐約應回傳當地日期", () => {
    // UTC 2026-04-15 04:00 = NY (UTC-4) 2026-04-15 00:00
    vi.setSystemTime(new Date("2026-04-15T04:00:00Z"))
    expect(localDateTPE(0, "America/New_York")).toBe("2026-04-15")
  })
})

describe("localMonthTPE", () => {
  beforeAll(() => {
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it("應回傳 YYYY-MM 格式", () => {
    vi.setSystemTime(new Date("2026-04-15T04:00:00Z"))
    const result = localMonthTPE()
    expect(result).toMatch(/^\d{4}-\d{2}$/)
  })

  it("offset=0 應回傳當月", () => {
    vi.setSystemTime(new Date("2026-04-15T04:00:00Z"))
    expect(localMonthTPE(0)).toBe("2026-04")
  })

  it("Bug 修復驗證：UTC 22:00 (TPE 06:00) 跨月時應為 TPE 月份", () => {
    // UTC 2026-03-31 22:00 = TPE 2026-04-01 06:00
    vi.setSystemTime(new Date("2026-03-31T22:00:00Z"))
    expect(localMonthTPE(0)).toBe("2026-04")
  })

  it("offset=-1 應回傳上個月", () => {
    vi.setSystemTime(new Date("2026-04-15T04:00:00Z"))
    expect(localMonthTPE(-1)).toBe("2026-03")
  })

  it("offset=+1 應回傳下個月", () => {
    vi.setSystemTime(new Date("2026-04-15T04:00:00Z"))
    expect(localMonthTPE(1)).toBe("2026-05")
  })

  it("跨年回滾：1 月 - 1 = 上一年 12 月", () => {
    vi.setSystemTime(new Date("2026-01-15T04:00:00Z"))
    expect(localMonthTPE(-1)).toBe("2025-12")
  })

  it("跨年前進：12 月 + 1 = 下一年 1 月", () => {
    vi.setSystemTime(new Date("2026-12-15T04:00:00Z"))
    expect(localMonthTPE(1)).toBe("2027-01")
  })
})
