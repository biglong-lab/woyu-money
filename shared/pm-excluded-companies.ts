/**
 * PM 旅館系統公司過濾清單（單一真實來源）
 *
 * 背景：
 * - 大號文創 (company_id 6)、大哉文旅 (company_id 7) 為 PM 源頭存在、
 *   但不納入 Money 財務系統的館舍。
 * - PM 源頭仍保有其營收資料（唯讀、不可改），故在 Money 端統一過濾：
 *   1. pm-bridge 同步不帶入這些公司的 revenues
 *   2. /api/pm-bridge/companies 選單不顯示
 *   3. 前端收入預測 / 預測輸入下拉清單不顯示
 *
 * 要恢復某公司：從此陣列移除其 id 即可（同步會自動重新帶入）。
 */
export const EXCLUDED_PM_COMPANY_IDS: readonly number[] = [6, 7]

/** 判斷某 PM company_id 是否被排除（null 視為未排除） */
export function isExcludedPmCompany(companyId: number | null | undefined): boolean {
  if (companyId === null || companyId === undefined) return false
  return EXCLUDED_PM_COMPANY_IDS.includes(companyId)
}
