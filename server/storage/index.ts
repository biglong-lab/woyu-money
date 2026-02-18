import connectPg from "connect-pg-simple"
import session from "express-session"
import { pool } from "../db"

// 匯入所有領域模組
import * as userFns from "./users"
import * as categoryFns from "./categories"
import * as paymentItemFns from "./payment-items"
import * as paymentRecordFns from "./payment-records"
import * as statisticsFns from "./statistics"
import * as householdFns from "./household"
import * as subcategoryFns from "./subcategory-payments"
import * as rentalFns from "./rental"
import * as notificationFns from "./notifications"
import * as loanFns from "./loans"
import * as fileAttachmentFns from "./file-attachments"
import * as adminFns from "./admin"
import * as smartAlertFns from "./smart-alerts"
import * as advancedSearchFns from "./advanced-search"
import * as batchOperationsFns from "./batch-operations"
import * as reportsFns from "./reports"
import * as lineConfigFns from "./line-config"
import * as systemAdminFns from "./system-admin"
import * as overdueItemsFns from "./overdue-items"
import * as projectStatsFns from "./project-stats"
import * as docInboxFns from "./document-inbox"
import * as budgetFns from "./budget"
import * as hrCostsFns from "./hr-costs"
import * as invoiceFns from "./invoice"
import * as financialReportsFns from "./financial-reports"
import * as incomeFns from "./income"

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

/**
 * DatabaseStorage — 組合所有領域模組的向後相容代理類別
 *
 * routes.ts 目前透過 `storage.methodName()` 呼叫方法，
 * 此類別將每個方法委派給對應的獨立領域函式，
 * 待 routes.ts 拆分完成後即可移除。
 */
export class DatabaseStorage {
  sessionStore: InstanceType<ReturnType<typeof connectPg>>

  constructor() {
    const PostgresSessionStore = connectPg(session)
    this.sessionStore = new PostgresSessionStore({
      pool: pool,
      createTableIfMissing: true,
      tableName: "sessions",
    })
  }

  // === 使用者 ===
  getUserById = userFns.getUserById
  getUserByUsername = userFns.getUserByUsername
  getUserByLineUserId = userFns.getUserByLineUserId
  createUser = userFns.createUser
  updateUser = userFns.updateUser
  updateUserLoginAttempts = userFns.updateUserLoginAttempts
  updateUserPermissions = userFns.updateUserPermissions
  updateUserPassword = userFns.updateUserPassword
  deleteUser = userFns.deleteUser

  // === 分類 ===
  getCategories = categoryFns.getCategories
  getProjectCategories = categoryFns.getProjectCategories
  getHouseholdCategories = categoryFns.getHouseholdCategories
  createCategory = categoryFns.createCategory
  updateCategory = categoryFns.updateCategory
  deleteCategory = categoryFns.deleteCategory
  getCategoryUsageCount = categoryFns.getCategoryUsageCount
  getCategoryStats = categoryFns.getCategoryStats
  getDebtCategories = categoryFns.getDebtCategories
  createDebtCategory = categoryFns.createDebtCategory
  updateDebtCategory = categoryFns.updateDebtCategory
  deleteDebtCategory = categoryFns.deleteDebtCategory
  createHouseholdCategory = categoryFns.createHouseholdCategory
  updateHouseholdCategory = categoryFns.updateHouseholdCategory
  deleteHouseholdCategory = categoryFns.deleteHouseholdCategory
  getPaymentProjects = categoryFns.getPaymentProjects
  createPaymentProject = categoryFns.createPaymentProject
  updatePaymentProject = categoryFns.updatePaymentProject
  deletePaymentProject = categoryFns.deletePaymentProject
  getFixedCategories = categoryFns.getFixedCategories
  createFixedCategory = categoryFns.createFixedCategory
  updateFixedCategory = categoryFns.updateFixedCategory
  deleteFixedCategory = categoryFns.deleteFixedCategory
  getFixedCategorySubOptions = categoryFns.getFixedCategorySubOptions
  createFixedCategorySubOption = categoryFns.createFixedCategorySubOption
  updateFixedCategorySubOption = categoryFns.updateFixedCategorySubOption
  deleteFixedCategorySubOption = categoryFns.deleteFixedCategorySubOption
  getProjectCategoryTemplates = categoryFns.getProjectCategoryTemplates
  createProjectCategoryTemplate = categoryFns.createProjectCategoryTemplate
  updateProjectCategoryTemplate = categoryFns.updateProjectCategoryTemplate
  deleteProjectCategoryTemplate = categoryFns.deleteProjectCategoryTemplate

  // === 付款項目 ===
  getPaymentItems = paymentItemFns.getPaymentItems
  getPaymentItemsCount = paymentItemFns.getPaymentItemsCount
  getPaymentItem = paymentItemFns.getPaymentItem
  createPaymentItem = paymentItemFns.createPaymentItem
  updatePaymentItem = paymentItemFns.updatePaymentItem
  deletePaymentItem = paymentItemFns.deletePaymentItem
  permanentlyDeletePaymentItem = paymentItemFns.permanentlyDeletePaymentItem
  restorePaymentItem = paymentItemFns.restorePaymentItem
  getDeletedPaymentItems = paymentItemFns.getDeletedPaymentItems
  getAuditLogs = paymentItemFns.getAuditLogs
  createAuditLog = paymentItemFns.createAuditLog

  // === 付款記錄 ===
  getPaymentRecords = paymentRecordFns.getPaymentRecords
  getPaymentRecordsByItemId = paymentRecordFns.getPaymentRecordsByItemId
  getFilteredPaymentRecords = paymentRecordFns.getFilteredPaymentRecords
  createPaymentRecord = paymentRecordFns.createPaymentRecord
  updatePaymentRecord = paymentRecordFns.updatePaymentRecord
  deletePaymentRecord = paymentRecordFns.deletePaymentRecord
  getPaymentSchedules = paymentRecordFns.getPaymentSchedules
  getPaymentSchedule = paymentRecordFns.getPaymentSchedule
  createPaymentSchedule = paymentRecordFns.createPaymentSchedule
  updatePaymentSchedule = paymentRecordFns.updatePaymentSchedule
  deletePaymentSchedule = paymentRecordFns.deletePaymentSchedule
  getOverdueSchedules = paymentRecordFns.getOverdueSchedules
  reschedulePayment = paymentRecordFns.reschedulePayment
  getSchedulesByPaymentItem = paymentRecordFns.getSchedulesByPaymentItem
  getUnscheduledPaymentItems = paymentRecordFns.getUnscheduledPaymentItems
  getPaymentItemNotes = paymentRecordFns.getPaymentItemNotes
  createPaymentItemNote = paymentRecordFns.createPaymentItemNote
  updatePaymentItemNote = paymentRecordFns.updatePaymentItemNote
  deletePaymentItemNote = paymentRecordFns.deletePaymentItemNote
  updatePaymentItemAmounts = paymentRecordFns.updatePaymentItemAmounts

  // === 統計 ===
  getPaymentHomeStats = statisticsFns.getPaymentHomeStats
  getPaymentProjectStats = statisticsFns.getPaymentProjectStats
  getMonthlyPaymentTrend = statisticsFns.getMonthlyPaymentTrend
  getTopPaymentCategories = statisticsFns.getTopPaymentCategories
  getPaymentMethodsReport = statisticsFns.getPaymentMethodsReport
  getPaymentStatistics = statisticsFns.getPaymentStatistics
  getPaymentOverview = statisticsFns.getPaymentOverview
  getPaginatedPaymentItems = statisticsFns.getPaginatedPaymentItems
  bulkUpdatePaymentItems = statisticsFns.bulkUpdatePaymentItems
  getPaymentSummaryByDateRange = statisticsFns.getPaymentSummaryByDateRange
  getMonthlyPaymentAnalysis = statisticsFns.getMonthlyPaymentAnalysis
  getOverduePaymentItems = statisticsFns.getOverduePaymentItems

  // === 家用預算 ===
  getHouseholdBudget = householdFns.getHouseholdBudget
  setHouseholdBudget = householdFns.setHouseholdBudget
  getHouseholdBudgets = householdFns.getHouseholdBudgets
  createOrUpdateHouseholdBudget = householdFns.createOrUpdateHouseholdBudget
  getHouseholdExpenses = householdFns.getHouseholdExpenses
  createHouseholdExpense = householdFns.createHouseholdExpense
  updateHouseholdExpense = householdFns.updateHouseholdExpense
  deleteHouseholdExpense = householdFns.deleteHouseholdExpense
  getHouseholdCategoryBudgets = householdFns.getHouseholdCategoryBudgets
  createHouseholdBudget = householdFns.createHouseholdBudget
  updateHouseholdBudget = householdFns.updateHouseholdBudget
  updateHouseholdCategoryBudget = householdFns.updateHouseholdCategoryBudget
  deleteHouseholdBudget = householdFns.deleteHouseholdBudget
  getHouseholdCategoryStats = householdFns.getHouseholdCategoryStats
  getHouseholdStats = householdFns.getHouseholdStats
  getYearlyBudgets = householdFns.getYearlyBudgets
  createOrUpdateYearlyBudget = householdFns.createOrUpdateYearlyBudget
  getMonthlyBudgets = householdFns.getMonthlyBudgets

  // === 子分類付款 ===
  getSubcategoryStatus = subcategoryFns.getSubcategoryStatus
  getSubcategoryPaymentPriority = subcategoryFns.getSubcategoryPaymentPriority
  processSubcategoryPayment = subcategoryFns.processSubcategoryPayment
  getUnifiedPaymentData = subcategoryFns.getUnifiedPaymentData
  executeUnifiedPayment = subcategoryFns.executeUnifiedPayment
  getProjectsWithStats = subcategoryFns.getProjectsWithStats

  // === 租約管理 ===
  getRentalContracts = rentalFns.getRentalContracts
  getRentalContract = rentalFns.getRentalContract
  createRentalContract = rentalFns.createRentalContract
  updateRentalContract = rentalFns.updateRentalContract
  deleteRentalContract = rentalFns.deleteRentalContract
  getRentalPriceTiers = rentalFns.getRentalPriceTiers
  generateRentalPayments = rentalFns.generateRentalPayments
  getRentalStats = rentalFns.getRentalStats
  getRentalPaymentItems = rentalFns.getRentalPaymentItems
  getRentalContractPayments = rentalFns.getRentalContractPayments
  createInstallmentPlan = rentalFns.createInstallmentPlan
  generateInstallmentPayments = rentalFns.generateInstallmentPayments
  getContractDocuments = rentalFns.getContractDocuments
  getContractDocument = rentalFns.getContractDocument
  createContractDocument = rentalFns.createContractDocument
  updateContractDocument = rentalFns.updateContractDocument
  deleteContractDocument = rentalFns.deleteContractDocument
  updateContractPaymentInfo = rentalFns.updateContractPaymentInfo
  getContractDetails = rentalFns.getContractDetails
  searchContracts = rentalFns.searchContracts

  // === 通知 ===
  createNotification = notificationFns.createNotification
  getUserNotifications = notificationFns.getUserNotifications
  getNewNotifications = notificationFns.getNewNotifications
  markNotificationAsRead = notificationFns.markNotificationAsRead
  markAllNotificationsAsRead = notificationFns.markAllNotificationsAsRead
  deleteNotification = notificationFns.deleteNotification
  getNotificationSettings = notificationFns.getNotificationSettings
  updateNotificationSettings = notificationFns.updateNotificationSettings
  generatePaymentReminders = notificationFns.generatePaymentReminders
  getUsersWithLineNotificationEnabled = notificationFns.getUsersWithLineNotificationEnabled
  getUsersWithEmailNotificationEnabled = notificationFns.getUsersWithEmailNotificationEnabled
  getUserCriticalNotifications = notificationFns.getUserCriticalNotifications
  getUserUnreadNotifications = notificationFns.getUserUnreadNotifications

  // === 借貸投資 ===
  getLoanInvestmentRecords = loanFns.getLoanInvestmentRecords
  getLoanInvestmentRecord = loanFns.getLoanInvestmentRecord
  createLoanInvestmentRecord = loanFns.createLoanInvestmentRecord
  updateLoanInvestmentRecord = loanFns.updateLoanInvestmentRecord
  deleteLoanInvestmentRecord = loanFns.deleteLoanInvestmentRecord
  generateLoanPaymentSchedule = loanFns.generateLoanPaymentSchedule
  addLoanPayment = loanFns.addLoanPayment
  getLoanPaymentHistory = loanFns.getLoanPaymentHistory
  updateLoanPaymentHistory = loanFns.updateLoanPaymentHistory
  deleteLoanPaymentHistory = loanFns.deleteLoanPaymentHistory
  verifyLoanPayment = loanFns.verifyLoanPayment
  getLoanPaymentStatistics = loanFns.getLoanPaymentStatistics
  getLoanInvestmentStats = loanFns.getLoanInvestmentStats

  // === 檔案附件 ===
  createFileAttachment = fileAttachmentFns.createFileAttachment
  getFileAttachment = fileAttachmentFns.getFileAttachment
  getFileAttachments = fileAttachmentFns.getFileAttachments
  updateFileAttachment = fileAttachmentFns.updateFileAttachment
  deleteFileAttachment = fileAttachmentFns.deleteFileAttachment

  // === 管理功能 - 系統管理 ===
  getAllUsers = systemAdminFns.getAllUsers
  updateUserRole = systemAdminFns.updateUserRole
  toggleUserStatus = systemAdminFns.toggleUserStatus
  getSystemStats = systemAdminFns.getSystemStats
  createBackup = systemAdminFns.createBackup
  clearSystemCache = systemAdminFns.clearSystemCache
  validateDataIntegrity = systemAdminFns.validateDataIntegrity

  // === 管理功能 - 智慧提醒 ===
  getSmartAlerts = smartAlertFns.getSmartAlerts
  getSmartAlertStats = smartAlertFns.getSmartAlertStats
  dismissSmartAlert = smartAlertFns.dismissSmartAlert

  // === 管理功能 - 進階搜尋 ===
  advancedSearchPaymentItems = advancedSearchFns.advancedSearchPaymentItems
  advancedSearchProjects = advancedSearchFns.advancedSearchProjects
  advancedSearchCategories = advancedSearchFns.advancedSearchCategories

  // === 管理功能 - 批量操作 ===
  batchUpdatePaymentItems = batchOperationsFns.batchUpdatePaymentItems
  bulkImportPaymentItems = batchOperationsFns.bulkImportPaymentItems

  // === 管理功能 - 報表生成 ===
  generateIntelligentReport = reportsFns.generateIntelligentReport
  exportReport = reportsFns.exportReport

  // === 管理功能 - LINE 設定 ===
  getLineConfig = lineConfigFns.getLineConfig
  createLineConfig = lineConfigFns.createLineConfig
  updateLineConfig = lineConfigFns.updateLineConfig
  testLineConnection = lineConfigFns.testLineConnection

  // === 文件收件箱 ===
  getDocumentInboxItems = docInboxFns.getDocumentInboxItems
  getDocumentInboxItem = docInboxFns.getDocumentInboxItem
  createDocumentInboxItem = docInboxFns.createDocumentInboxItem
  updateDocumentInboxItem = docInboxFns.updateDocumentInboxItem
  deleteDocumentInboxItem = docInboxFns.deleteDocumentInboxItem
  getDocumentInboxStats = docInboxFns.getDocumentInboxStats
  getUserDisplayName = docInboxFns.getUserDisplayName
  updateDocumentAiResult = docInboxFns.updateDocumentAiResult
  setDocumentProcessing = docInboxFns.setDocumentProcessing
  setDocumentFailed = docInboxFns.setDocumentFailed
  updateDocumentNotes = docInboxFns.updateDocumentNotes
  archiveToPaymentItem = docInboxFns.archiveToPaymentItem
  archiveToPaymentRecord = docInboxFns.archiveToPaymentRecord
  archiveToInvoiceRecord = docInboxFns.archiveToInvoiceRecord

  // === 預算管理 ===
  getBudgetPlans = budgetFns.getBudgetPlans
  getBudgetPlan = budgetFns.getBudgetPlan
  createBudgetPlan = budgetFns.createBudgetPlan
  updateBudgetPlan = budgetFns.updateBudgetPlan
  deleteBudgetPlan = budgetFns.deleteBudgetPlan
  getBudgetItemsByPlan = budgetFns.getBudgetItemsByPlan
  getBudgetItems = budgetFns.getBudgetItems
  getBudgetItem = budgetFns.getBudgetItem
  createBudgetItem = budgetFns.createBudgetItem
  updateBudgetItem = budgetFns.updateBudgetItem
  softDeleteBudgetItem = budgetFns.softDeleteBudgetItem
  updateBudgetPlanActualSpent = budgetFns.updateBudgetPlanActualSpent
  convertBudgetItemToPayment = budgetFns.convertBudgetItemToPayment

  // === 人事費管理 ===
  getEmployees = hrCostsFns.getEmployees
  getEmployee = hrCostsFns.getEmployee
  createEmployee = hrCostsFns.createEmployee
  updateEmployee = hrCostsFns.updateEmployee
  softDeleteEmployee = hrCostsFns.softDeleteEmployee
  getMonthlyHrCosts = hrCostsFns.getMonthlyHrCosts
  createMonthlyHrCosts = hrCostsFns.createMonthlyHrCosts
  deleteMonthlyHrCosts = hrCostsFns.deleteMonthlyHrCosts
  updateMonthlyHrCost = hrCostsFns.updateMonthlyHrCost
  getHrCostsByYear = hrCostsFns.getHrCostsByYear
  getActiveEmployeeCount = hrCostsFns.getActiveEmployeeCount
  getActiveEmployees = hrCostsFns.getActiveEmployees

  // === 發票記錄 ===
  getInvoiceRecords = invoiceFns.getInvoiceRecords
  getInvoiceStats = invoiceFns.getInvoiceStats

  // === 財務報表 ===
  getIncomeStatement = financialReportsFns.getIncomeStatement
  getBalanceSheet = financialReportsFns.getBalanceSheet
  getCashFlowStatement = financialReportsFns.getCashFlowStatement
  getHrCostReport = financialReportsFns.getHrCostReport
  getHrCostMonthlyDetail = financialReportsFns.getHrCostMonthlyDetail
  getBusinessTaxReport = financialReportsFns.getBusinessTaxReport
  getSalaryWithholdingReport = financialReportsFns.getSalaryWithholdingReport
  getSupplementaryHealthReport = financialReportsFns.getSupplementaryHealthReport

  // === 付款記錄（擴充） ===
  getPaymentRecordsCashFlow = paymentRecordFns.getPaymentRecordsCashFlow
  getAllPaymentSchedules = paymentRecordFns.getAllPaymentSchedules
  getPaymentSchedulesByItemId = paymentRecordFns.getPaymentSchedulesByItemId
}

// 單例實例 — 向後相容 routes.ts 的 storage.methodName() 呼叫模式
export const storage = new DatabaseStorage()
