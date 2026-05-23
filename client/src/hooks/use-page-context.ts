/**
 * usePageContext — 依當前 URL 推斷頁面 context
 *
 * 用途：mobile-tab-bar 根據 context 自動切換 5 入口、無需手動 mode 切換。
 *
 * Context 對照（優先序由上至下）：
 *  - household：/household-budget*
 *  - family：/family*
 *  - payment：/monthly-payment*, /installment-payment*, /payment-*, /rental-matrix
 *  - property：/property-*, /pm-*, /pms*
 *  - finance：/financial-*, /cost-overview, /budget*, /forecast*, /scenario*
 *  - inbox：/document-inbox, /income/*
 *  - default：其他（fallback 家用優先）
 */
import { useLocation } from "wouter"

export type PageContext =
  | "household"
  | "family"
  | "payment"
  | "property"
  | "finance"
  | "inbox"
  | "default"

export function usePageContext(): PageContext {
  const [location] = useLocation()
  return inferContext(location)
}

export function inferContext(pathname: string): PageContext {
  if (pathname.startsWith("/household-budget")) return "household"
  if (pathname.startsWith("/family")) return "family"
  if (
    pathname.startsWith("/monthly-payment") ||
    pathname.startsWith("/installment-payment") ||
    pathname.startsWith("/payment-") ||
    pathname === "/rental-matrix" ||
    pathname === "/cash-allocation"
  )
    return "payment"
  if (
    pathname.startsWith("/property") ||
    pathname.startsWith("/pm-") ||
    pathname.startsWith("/pms") ||
    pathname.startsWith("/rental") // /rental-contracts 等
  )
    return "property"
  if (
    pathname.startsWith("/financial-") ||
    pathname === "/cost-overview" ||
    pathname.startsWith("/budget") ||
    pathname.startsWith("/forecast") ||
    pathname.startsWith("/scenario")
  )
    return "finance"
  if (pathname === "/document-inbox" || pathname.startsWith("/income/")) return "inbox"
  return "default"
}
