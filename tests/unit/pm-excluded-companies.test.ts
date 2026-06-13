import { describe, it, expect } from "vitest"
import {
  EXCLUDED_PM_COMPANY_IDS,
  isExcludedPmCompany,
} from "@shared/pm-excluded-companies"

describe("pm-excluded-companies", () => {
  it("排除清單包含大號文創 (6) 與大哉文旅 (7)", () => {
    expect(EXCLUDED_PM_COMPANY_IDS).toContain(6)
    expect(EXCLUDED_PM_COMPANY_IDS).toContain(7)
  })

  it("被排除的公司回傳 true", () => {
    expect(isExcludedPmCompany(6)).toBe(true)
    expect(isExcludedPmCompany(7)).toBe(true)
  })

  it("未排除的公司回傳 false", () => {
    expect(isExcludedPmCompany(1)).toBe(false)
    expect(isExcludedPmCompany(5)).toBe(false)
  })

  it("null / undefined 視為未排除", () => {
    expect(isExcludedPmCompany(null)).toBe(false)
    expect(isExcludedPmCompany(undefined)).toBe(false)
  })
})
