/**
 * client/src/lib/utils.ts 測試
 *
 * 涵蓋：
 * - localDateISO：本地日期 YYYY-MM-DD（避免 UTC 跨日 bug）
 * - cn：className merger
 * - formatCurrency：金額格式
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { cn, formatCurrency, localDateISO } from "../../client/src/lib/utils"

describe("cn (className merger)", () => {
  it("應合併多個 class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c")
  })

  it("應處理 falsy 值", () => {
    expect(cn("a", null, undefined, false, "b")).toBe("a b")
  })

  it("應處理條件物件", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active")
  })

  it("tailwind merge 應消除衝突 class", () => {
    // tailwind-merge 會保留後面的衝突 class
    expect(cn("p-2", "p-4")).toBe("p-4")
  })
})

describe("formatCurrency", () => {
  it("應將數字格式化為 USD 樣式", () => {
    const out = formatCurrency(1234)
    expect(out).toContain("1,234")
  })

  it("應處理字串輸入", () => {
    expect(formatCurrency("500")).toContain("500")
  })

  it("無效輸入應回傳 $0", () => {
    expect(formatCurrency("abc")).toBe("$0")
  })
})

describe("localDateISO (時區安全的本地日期)", () => {
  // 鎖定固定時間進行測試
  beforeAll(() => {
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it("應回傳 YYYY-MM-DD 格式", () => {
    vi.setSystemTime(new Date(2026, 3, 15, 12, 0, 0)) // 2026-04-15 12:00 local
    const result = localDateISO(0)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("offset=0 應回傳今天本地日期", () => {
    vi.setSystemTime(new Date(2026, 3, 15, 12, 0, 0)) // 2026-04-15
    expect(localDateISO(0)).toBe("2026-04-15")
  })

  it("offset=-1 應回傳昨天", () => {
    vi.setSystemTime(new Date(2026, 3, 15, 12, 0, 0))
    expect(localDateISO(-1)).toBe("2026-04-14")
  })

  it("offset=+1 應回傳明天", () => {
    vi.setSystemTime(new Date(2026, 3, 15, 12, 0, 0))
    expect(localDateISO(1)).toBe("2026-04-16")
  })

  it("跨月應正確：4/30 → +1 = 5/1", () => {
    vi.setSystemTime(new Date(2026, 3, 30, 12, 0, 0)) // 2026-04-30
    expect(localDateISO(1)).toBe("2026-05-01")
  })

  it("跨月應正確：5/1 → -1 = 4/30", () => {
    vi.setSystemTime(new Date(2026, 4, 1, 12, 0, 0)) // 2026-05-01
    expect(localDateISO(-1)).toBe("2026-04-30")
  })

  it("跨年應正確：12/31 → +1 = 1/1（下一年）", () => {
    vi.setSystemTime(new Date(2026, 11, 31, 12, 0, 0)) // 2026-12-31
    expect(localDateISO(1)).toBe("2027-01-01")
  })

  it("Bug 修復驗證：早晨 TPE 時間應仍為當天本地日期", () => {
    // 模擬 2026-04-15 早上 6:00 TPE（UTC 為 2026-04-14 22:00）
    // 注意：vi.setSystemTime 接受的是本地時間
    vi.setSystemTime(new Date(2026, 3, 15, 6, 0, 0))
    // 本地日期應仍為 04-15（不是 UTC 的 04-14）
    expect(localDateISO(0)).toBe("2026-04-15")
  })

  it("Default offset 應為 0", () => {
    vi.setSystemTime(new Date(2026, 3, 15, 12, 0, 0))
    expect(localDateISO()).toBe("2026-04-15")
  })
})
