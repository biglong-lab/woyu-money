// 重新匯出所有領域函式
export * from "./users"
export * from "./categories"
export * from "./payment-items"
export * from "./payment-records"
export * from "./statistics"
export * from "./household"
export * from "./subcategory-payments"
export * from "./rental"
export * from "./notifications"
export * from "./loans"
export * from "./file-attachments"
export * from "./helpers"
export * from "./document-inbox"
export * from "./budget"
export * from "./hr-costs"
export * from "./invoice"
export * from "./financial-reports"
export * from "./income"

// 管理功能模組選擇性匯出（避免與 statistics.ts、subcategory-payments.ts 的重複匯出衝突）
// 智慧提醒
export { getSmartAlerts, getSmartAlertStats, dismissSmartAlert } from "./smart-alerts"

// 進階搜尋
export {
  advancedSearchPaymentItems,
  advancedSearchProjects,
  advancedSearchCategories,
} from "./advanced-search"

// 批量操作
export { batchUpdatePaymentItems, bulkImportPaymentItems } from "./batch-operations"

// 報表生成
export { generateIntelligentReport, exportReport } from "./reports"

// LINE 設定
export {
  getLineConfig,
  createLineConfig,
  updateLineConfig,
  testLineConnection,
} from "./line-config"

// 系統管理
export {
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
  getSystemStats,
  createBackup,
  clearSystemCache,
  validateDataIntegrity,
} from "./system-admin"

// 逾期項目（從 admin 子模組匯出，避免與 statistics.ts 衝突）
export { getOverduePaymentItems as getAdminOverduePaymentItems } from "./overdue-items"

// 專案統計（從 admin 子模組匯出，避免與 subcategory-payments.ts 衝突）
export { getProjectsWithStats as getAdminProjectsWithStats } from "./project-stats"

// 重新匯出 IStorage 介面所需的型別
export type {
  User,
  InsertUser,
  DebtCategory,
  InsertDebtCategory,
  PaymentProject,
  InsertPaymentProject,
  PaymentItem,
  InsertPaymentItem,
  PaymentRecord,
  InsertPaymentRecord,
  PaymentItemNote,
  InsertPaymentItemNote,
  PaymentSchedule,
  InsertPaymentSchedule,
  RentalContract,
  InsertRentalContract,
  ContractDocument,
  InsertContractDocument,
  InstallmentPlan,
  InsertInstallmentPlan,
  HouseholdBudget,
  InsertHouseholdBudget,
  HouseholdExpense,
  InsertHouseholdExpense,
  AuditLog,
  InsertAuditLog,
  FixedCategory,
  InsertFixedCategory,
  FixedCategorySubOption,
  InsertFixedCategorySubOption,
  LoanInvestmentRecord,
  InsertLoanInvestmentRecord,
  LoanPaymentHistory,
  InsertLoanPaymentHistory,
  LineConfig,
  InsertLineConfig,
  FileAttachment,
  InsertFileAttachment,
  ProjectCategoryTemplate,
  InsertProjectCategoryTemplate,
  Notification,
  InsertNotification,
  NotificationSettings,
  InsertNotificationSettings,
} from "@shared/schema"

/*
 * DatabaseStorage God shim 已於 2026-07-03（Phase 4.1）移除。
 * 資料存取統一模式：
 *   import { fn } from "../storage/<domain>"   ← 首選（明確、無歧義）
 *   import { fn } from "../storage"            ← barrel（歧義名有 as 別名）
 * sessionStore 移至 server/session.ts。
 */
