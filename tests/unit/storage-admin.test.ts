/**
 * server/storage/admin.ts 單元測試
 * 驗證管理模組入口正確匯出所有子模組功能
 */
import { describe, it, expect, vi } from "vitest"

// Mock 所有子模組，避免真實 DB 連線
vi.mock("../../server/storage/smart-alerts", () => ({
  getSmartAlerts: vi.fn(),
  getSmartAlertStats: vi.fn(),
  dismissSmartAlert: vi.fn(),
}))

vi.mock("../../server/storage/advanced-search", () => ({
  advancedSearchPaymentItems: vi.fn(),
  advancedSearchProjects: vi.fn(),
  advancedSearchCategories: vi.fn(),
}))

vi.mock("../../server/storage/batch-operations", () => ({
  batchUpdatePaymentItems: vi.fn(),
  bulkImportPaymentItems: vi.fn(),
}))

vi.mock("../../server/storage/reports", () => ({
  generateIntelligentReport: vi.fn(),
  exportReport: vi.fn(),
}))

vi.mock("../../server/storage/line-config", () => ({
  getLineConfig: vi.fn(),
  createLineConfig: vi.fn(),
  updateLineConfig: vi.fn(),
  testLineConnection: vi.fn(),
}))

vi.mock("../../server/storage/system-admin", () => ({
  getAllUsers: vi.fn(),
  updateUserRole: vi.fn(),
  toggleUserStatus: vi.fn(),
  getSystemStats: vi.fn(),
  createBackup: vi.fn(),
  clearSystemCache: vi.fn(),
  validateDataIntegrity: vi.fn(),
}))

vi.mock("../../server/storage/overdue-items", () => ({
  getOverduePaymentItems: vi.fn(),
}))

vi.mock("../../server/storage/project-stats", () => ({
  getProjectsWithStats: vi.fn(),
}))

describe("admin 模組入口匯出", () => {
  it("應匯出智慧提醒相關函式", async () => {
    const admin = await import("../../server/storage/admin")

    expect(admin.getSmartAlerts).toBeDefined()
    expect(admin.getSmartAlertStats).toBeDefined()
    expect(admin.dismissSmartAlert).toBeDefined()
    expect(typeof admin.getSmartAlerts).toBe("function")
    expect(typeof admin.getSmartAlertStats).toBe("function")
    expect(typeof admin.dismissSmartAlert).toBe("function")
  })

  it("應匯出進階搜尋相關函式", async () => {
    const admin = await import("../../server/storage/admin")

    expect(admin.advancedSearchPaymentItems).toBeDefined()
    expect(admin.advancedSearchProjects).toBeDefined()
    expect(admin.advancedSearchCategories).toBeDefined()
    expect(typeof admin.advancedSearchPaymentItems).toBe("function")
    expect(typeof admin.advancedSearchProjects).toBe("function")
    expect(typeof admin.advancedSearchCategories).toBe("function")
  })

  it("應匯出批量操作相關函式", async () => {
    const admin = await import("../../server/storage/admin")

    expect(admin.batchUpdatePaymentItems).toBeDefined()
    expect(admin.bulkImportPaymentItems).toBeDefined()
    expect(typeof admin.batchUpdatePaymentItems).toBe("function")
    expect(typeof admin.bulkImportPaymentItems).toBe("function")
  })

  it("應匯出報表生成相關函式", async () => {
    const admin = await import("../../server/storage/admin")

    expect(admin.generateIntelligentReport).toBeDefined()
    expect(admin.exportReport).toBeDefined()
    expect(typeof admin.generateIntelligentReport).toBe("function")
    expect(typeof admin.exportReport).toBe("function")
  })

  it("應匯出 LINE 設定相關函式", async () => {
    const admin = await import("../../server/storage/admin")

    expect(admin.getLineConfig).toBeDefined()
    expect(admin.createLineConfig).toBeDefined()
    expect(admin.updateLineConfig).toBeDefined()
    expect(admin.testLineConnection).toBeDefined()
    expect(typeof admin.getLineConfig).toBe("function")
    expect(typeof admin.createLineConfig).toBe("function")
    expect(typeof admin.updateLineConfig).toBe("function")
    expect(typeof admin.testLineConnection).toBe("function")
  })

  it("應匯出系統管理相關函式", async () => {
    const admin = await import("../../server/storage/admin")

    expect(admin.getAllUsers).toBeDefined()
    expect(admin.updateUserRole).toBeDefined()
    expect(admin.toggleUserStatus).toBeDefined()
    expect(admin.getSystemStats).toBeDefined()
    expect(admin.createBackup).toBeDefined()
    expect(admin.clearSystemCache).toBeDefined()
    expect(admin.validateDataIntegrity).toBeDefined()
  })

  it("應匯出逾期項目查詢函式", async () => {
    const admin = await import("../../server/storage/admin")

    expect(admin.getOverduePaymentItems).toBeDefined()
    expect(typeof admin.getOverduePaymentItems).toBe("function")
  })

  it("應匯出專案統計函式", async () => {
    const admin = await import("../../server/storage/admin")

    expect(admin.getProjectsWithStats).toBeDefined()
    expect(typeof admin.getProjectsWithStats).toBe("function")
  })

  it("匯出的函式總數應為 20 個", async () => {
    const admin = await import("../../server/storage/admin")
    const exportedFunctions = Object.keys(admin).filter(
      (key) => typeof (admin as Record<string, unknown>)[key] === "function"
    )

    // 3 + 3 + 2 + 2 + 4 + 7 + 1 + 1 = 23
    // 但 getAllUsers, updateUserRole, toggleUserStatus 分別來自 system-admin
    // 全部函式列表：
    // getSmartAlerts, getSmartAlertStats, dismissSmartAlert (3)
    // advancedSearchPaymentItems, advancedSearchProjects, advancedSearchCategories (3)
    // batchUpdatePaymentItems, bulkImportPaymentItems (2)
    // generateIntelligentReport, exportReport (2)
    // getLineConfig, createLineConfig, updateLineConfig, testLineConnection (4)
    // getAllUsers, updateUserRole, toggleUserStatus, getSystemStats, createBackup, clearSystemCache, validateDataIntegrity (7)
    // getOverduePaymentItems (1)
    // getProjectsWithStats (1)
    // 總計 = 23
    expect(exportedFunctions.length).toBe(23)
  })
})
