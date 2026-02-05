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

// admin.ts 選擇性匯出（避免與 statistics.ts、subcategory-payments.ts 的重複匯出衝突）
export {
  getSmartAlerts,
  getSmartAlertStats,
  dismissSmartAlert,
  advancedSearchPaymentItems,
  advancedSearchProjects,
  advancedSearchCategories,
  batchUpdatePaymentItems,
  bulkImportPaymentItems,
  generateIntelligentReport,
  exportReport,
  getLineConfig,
  createLineConfig,
  updateLineConfig,
  testLineConnection,
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
  getSystemStats,
  createBackup,
  clearSystemCache,
  validateDataIntegrity,
} from "./admin"

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
  sessionStore: any

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

  // === 管理功能 ===
  getAllUsers = adminFns.getAllUsers
  updateUserRole = adminFns.updateUserRole
  toggleUserStatus = adminFns.toggleUserStatus
  getSystemStats = adminFns.getSystemStats
  createBackup = adminFns.createBackup
  clearSystemCache = adminFns.clearSystemCache
  validateDataIntegrity = adminFns.validateDataIntegrity
  getSmartAlerts = adminFns.getSmartAlerts
  getSmartAlertStats = adminFns.getSmartAlertStats
  dismissSmartAlert = adminFns.dismissSmartAlert
  advancedSearchPaymentItems = adminFns.advancedSearchPaymentItems
  advancedSearchProjects = adminFns.advancedSearchProjects
  advancedSearchCategories = adminFns.advancedSearchCategories
  batchUpdatePaymentItems = adminFns.batchUpdatePaymentItems
  bulkImportPaymentItems = adminFns.bulkImportPaymentItems
  generateIntelligentReport = adminFns.generateIntelligentReport
  exportReport = adminFns.exportReport
  getLineConfig = adminFns.getLineConfig
  createLineConfig = adminFns.createLineConfig
  updateLineConfig = adminFns.updateLineConfig
  testLineConnection = adminFns.testLineConnection
}

// 單例實例 — 向後相容 routes.ts 的 storage.methodName() 呼叫模式
export const storage = new DatabaseStorage()
