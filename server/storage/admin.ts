/**
 * 管理功能模組入口 (Admin Module Entry)
 * 整合並重新匯出所有管理相關功能
 *
 * 此檔案作為向後相容的入口點，
 * 實際實作已拆分至各子模組：
 * - smart-alerts.ts — 智慧提醒
 * - advanced-search.ts — 進階搜尋
 * - batch-operations.ts — 批量操作
 * - reports.ts — 報表生成
 * - line-config.ts — LINE 設定
 * - system-admin.ts — 系統管理
 * - overdue-items.ts — 逾期項目
 * - project-stats.ts — 專案統計
 */

// === 智慧提醒 ===
export {
  getSmartAlerts,
  getSmartAlertStats,
  dismissSmartAlert,
} from "./smart-alerts"

// === 進階搜尋 ===
export {
  advancedSearchPaymentItems,
  advancedSearchProjects,
  advancedSearchCategories,
} from "./advanced-search"

// === 批量操作 ===
export {
  batchUpdatePaymentItems,
  bulkImportPaymentItems,
} from "./batch-operations"

// === 報表生成 ===
export {
  generateIntelligentReport,
  exportReport,
} from "./reports"

// === LINE 設定 ===
export {
  getLineConfig,
  createLineConfig,
  updateLineConfig,
  testLineConnection,
} from "./line-config"

// === 系統管理 ===
export {
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
  getSystemStats,
  createBackup,
  clearSystemCache,
  validateDataIntegrity,
} from "./system-admin"

// === 逾期項目 ===
export { getOverduePaymentItems } from "./overdue-items"

// === 專案統計 ===
export { getProjectsWithStats } from "./project-stats"
