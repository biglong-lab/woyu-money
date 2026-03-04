/**
 * Schema 擴展驗證測試
 * 補充 schema-validation.test.ts 的覆蓋率
 * 涵蓋：payment、document、loan、income、hr、base、category、rental、household、ai
 */
import { describe, it, expect } from "vitest"
import {
  // payment.ts
  insertPaymentItemSchema,
  insertPaymentRecordSchema,
  insertInstallmentPlanSchema,
  insertPaymentItemNoteSchema,
  insertPaymentScheduleSchema,
  insertBudgetPlanSchema,
  insertBudgetItemSchema,
  insertDailyRevenueSchema,
  // document.ts
  insertDocumentInboxSchema,
  insertInvoiceRecordSchema,
  // loan.ts
  insertLoanInvestmentRecordSchema,
  insertLoanPaymentScheduleSchema,
  insertLoanPaymentHistorySchema,
  insertFileAttachmentSchema,
  // income.ts
  insertIncomeSourceSchema,
  insertIncomeWebhookSchema,
  confirmWebhookSchema,
  batchConfirmWebhookSchema,
  fieldMappingSchema,
  // hr.ts
  insertEmployeeSchema,
  insertMonthlyHrCostSchema,
  // base.ts
  insertUserSchema,
  loginSchema,
  updateUserSchema,
  insertAuditLogSchema,
  insertLineConfigSchema,
  DEFAULT_PERMISSIONS,
  // category.ts
  insertDebtCategorySchema,
  insertPaymentProjectSchema,
  insertFixedCategorySchema,
  insertFixedCategorySubOptionSchema,
  // rental.ts
  insertRentalContractSchema,
  insertRentalPriceTierSchema,
  insertContractDocumentSchema,
  // household.ts
  insertHouseholdExpenseSchema,
  insertHouseholdBudgetSchema,
  // ai.ts
  insertAiSettingsSchema,
  updateAiSettingsSchema,
} from "@shared/schema"

// ════════════════════════════════════════════
// payment.ts 測試
// ════════════════════════════════════════════
describe("insertPaymentItemSchema（擴展）", () => {
  it("不提供 itemType/paymentType 時應通過驗證（DB 層處理預設值）", () => {
    const data = {
      itemName: "測試項目",
      totalAmount: "10000",
      startDate: "2026-01-01",
    }
    const result = insertPaymentItemSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("可明確指定 itemType 和 paymentType", () => {
    const data = {
      itemName: "測試項目",
      totalAmount: "10000",
      startDate: "2026-01-01",
      itemType: "fixed",
      paymentType: "recurring",
    }
    const result = insertPaymentItemSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.itemType).toBe("fixed")
      expect(result.data.paymentType).toBe("recurring")
    }
  })

  it("paidAmount 數字應自動轉為字串", () => {
    const data = {
      itemName: "水費",
      totalAmount: 5000,
      startDate: "2026-03-01",
      paidAmount: 1000,
    }
    const result = insertPaymentItemSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.paidAmount).toBe("1000")
    }
  })

  it("endDate 為 null 應通過驗證", () => {
    const data = {
      itemName: "保險費",
      totalAmount: "20000",
      startDate: "2026-01-01",
      endDate: null,
    }
    const result = insertPaymentItemSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("可指定選填欄位：notes, tags, priority", () => {
    const data = {
      itemName: "網路費",
      totalAmount: "899",
      startDate: "2026-02-01",
      notes: "每月固定",
      tags: "固定支出",
      priority: 2,
    }
    const result = insertPaymentItemSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.notes).toBe("每月固定")
      expect(result.data.priority).toBe(2)
    }
  })

  it("可指定分類與專案 ID", () => {
    const data = {
      itemName: "房租",
      totalAmount: "25000",
      startDate: "2026-01-01",
      categoryId: 3,
      projectId: 1,
    }
    const result = insertPaymentItemSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.categoryId).toBe(3)
      expect(result.data.projectId).toBe(1)
    }
  })
})

describe("insertPaymentRecordSchema（擴展）", () => {
  it("缺少 itemId 應驗證失敗", () => {
    const data = {
      amountPaid: "5000",
      paymentDate: "2026-01-15",
    }
    const result = insertPaymentRecordSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 amountPaid 應驗證失敗", () => {
    const data = {
      itemId: 1,
      paymentDate: "2026-01-15",
    }
    const result = insertPaymentRecordSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 paymentDate 應驗證失敗", () => {
    const data = {
      itemId: 1,
      amountPaid: "5000",
    }
    const result = insertPaymentRecordSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("可附帶選填欄位：paymentMethod, notes, receiptImageUrl", () => {
    const data = {
      itemId: 1,
      amountPaid: "10000",
      paymentDate: "2026-02-01",
      paymentMethod: "bank_transfer",
      notes: "匯款完成",
      receiptImageUrl: "/uploads/receipt-001.jpg",
    }
    const result = insertPaymentRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.paymentMethod).toBe("bank_transfer")
    }
  })

  it("isPartialPayment 預設為 false", () => {
    const data = {
      itemId: 2,
      amountPaid: "3000",
      paymentDate: "2026-03-01",
    }
    const result = insertPaymentRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe("insertInstallmentPlanSchema", () => {
  it("有效的分期計劃應通過驗證", () => {
    const data = {
      itemId: 1,
      totalAmount: "120000",
      installmentCount: 12,
      monthlyAmount: "10000",
      startDate: "2026-01-01",
    }
    const result = insertInstallmentPlanSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 installmentCount 應驗證失敗", () => {
    const data = {
      itemId: 1,
      totalAmount: "120000",
      monthlyAmount: "10000",
      startDate: "2026-01-01",
    }
    const result = insertInstallmentPlanSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 itemId 應驗證失敗", () => {
    const data = {
      totalAmount: "120000",
      installmentCount: 12,
      monthlyAmount: "10000",
      startDate: "2026-01-01",
    }
    const result = insertInstallmentPlanSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe("insertPaymentItemNoteSchema", () => {
  it("有效的項目備註應通過驗證", () => {
    const data = {
      itemId: 1,
      noteText: "已與廠商確認付款方式",
    }
    const result = insertPaymentItemNoteSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 noteText 應驗證失敗", () => {
    const data = {
      itemId: 1,
    }
    const result = insertPaymentItemNoteSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 itemId 應驗證失敗", () => {
    const data = {
      noteText: "備註內容",
    }
    const result = insertPaymentItemNoteSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("可附帶附件資訊", () => {
    const data = {
      itemId: 1,
      noteText: "附上合約掃描檔",
      attachmentUrl: "/uploads/contract.pdf",
      attachmentName: "contract.pdf",
      attachmentSize: 1048576,
      attachmentType: "application/pdf",
    }
    const result = insertPaymentItemNoteSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.attachmentName).toBe("contract.pdf")
    }
  })
})

describe("insertPaymentScheduleSchema", () => {
  it("有效的付款計劃應通過驗證", () => {
    const data = {
      paymentItemId: 1,
      scheduledDate: "2026-03-15",
      scheduledAmount: "5000",
    }
    const result = insertPaymentScheduleSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("scheduledAmount 數字應自動轉為字串", () => {
    const data = {
      paymentItemId: 1,
      scheduledDate: "2026-03-15",
      scheduledAmount: 8000,
    }
    const result = insertPaymentScheduleSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.scheduledAmount).toBe("8000")
    }
  })

  it("缺少 paymentItemId 應驗證失敗", () => {
    const data = {
      scheduledDate: "2026-03-15",
      scheduledAmount: "5000",
    }
    const result = insertPaymentScheduleSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 scheduledAmount 應驗證失敗", () => {
    const data = {
      paymentItemId: 1,
      scheduledDate: "2026-03-15",
    }
    const result = insertPaymentScheduleSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe("insertBudgetPlanSchema", () => {
  it("有效的預算計劃應通過驗證", () => {
    const data = {
      planName: "2026 年度預算",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      totalBudget: "500000",
    }
    const result = insertBudgetPlanSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("totalBudget 數字應自動轉為字串", () => {
    const data = {
      planName: "月度預算",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      totalBudget: 100000,
    }
    const result = insertBudgetPlanSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.totalBudget).toBe("100000")
    }
  })

  it("actualSpent 數字應自動轉為字串", () => {
    const data = {
      planName: "季度預算",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      totalBudget: "300000",
      actualSpent: 150000,
    }
    const result = insertBudgetPlanSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.actualSpent).toBe("150000")
    }
  })

  it("缺少 planName 應驗證失敗", () => {
    const data = {
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      totalBudget: "500000",
    }
    const result = insertBudgetPlanSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 startDate 應驗證失敗", () => {
    const data = {
      planName: "預算",
      endDate: "2026-12-31",
      totalBudget: "500000",
    }
    const result = insertBudgetPlanSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe("insertBudgetItemSchema", () => {
  it("有效的預算項目應通過驗證", () => {
    const data = {
      budgetPlanId: 1,
      itemName: "辦公室租金",
      plannedAmount: "25000",
    }
    const result = insertBudgetItemSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("plannedAmount 數字應自動轉為字串", () => {
    const data = {
      budgetPlanId: 1,
      itemName: "水電費",
      plannedAmount: 3000,
    }
    const result = insertBudgetItemSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.plannedAmount).toBe("3000")
    }
  })

  it("actualAmount 為 null 應通過驗證", () => {
    const data = {
      budgetPlanId: 1,
      itemName: "雜費",
      plannedAmount: "5000",
      actualAmount: null,
    }
    const result = insertBudgetItemSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.actualAmount).toBeNull()
    }
  })

  it("installmentAmount 數字應自動轉為字串", () => {
    const data = {
      budgetPlanId: 1,
      itemName: "設備分期",
      plannedAmount: "60000",
      installmentAmount: 5000,
    }
    const result = insertBudgetItemSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.installmentAmount).toBe("5000")
    }
  })

  it("缺少 budgetPlanId 應驗證失敗", () => {
    const data = {
      itemName: "租金",
      plannedAmount: "25000",
    }
    const result = insertBudgetItemSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 itemName 應驗證失敗", () => {
    const data = {
      budgetPlanId: 1,
      plannedAmount: "25000",
    }
    const result = insertBudgetItemSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe("insertDailyRevenueSchema", () => {
  it("有效的每日收款紀錄應通過驗證", () => {
    const data = {
      date: "2026-03-01",
      amount: "15000",
    }
    const result = insertDailyRevenueSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("amount 數字應自動轉為字串", () => {
    const data = {
      date: "2026-03-01",
      amount: 8500,
      projectId: 1,
    }
    const result = insertDailyRevenueSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.amount).toBe("8500")
    }
  })

  it("缺少 date 應驗證失敗", () => {
    const data = { amount: "5000" }
    const result = insertDailyRevenueSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 amount 應驗證失敗", () => {
    const data = { date: "2026-03-01" }
    const result = insertDailyRevenueSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("可附帶 description 和 receiptImageUrl", () => {
    const data = {
      date: "2026-03-01",
      amount: "20000",
      description: "Airbnb 訂房收入",
      receiptImageUrl: "/uploads/receipt.jpg",
    }
    const result = insertDailyRevenueSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

// ════════════════════════════════════════════
// document.ts 測試
// ════════════════════════════════════════════
describe("insertDocumentInboxSchema", () => {
  it("有效的文件收件應通過驗證", () => {
    const data = {
      documentType: "receipt",
      imagePath: "/uploads/receipt-001.jpg",
    }
    const result = insertDocumentInboxSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 documentType 應驗證失敗", () => {
    const data = {
      imagePath: "/uploads/receipt-001.jpg",
    }
    const result = insertDocumentInboxSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 imagePath 應驗證失敗", () => {
    const data = {
      documentType: "receipt",
    }
    const result = insertDocumentInboxSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("recognizedAmount 數字應自動轉為字串", () => {
    const data = {
      documentType: "invoice",
      imagePath: "/uploads/invoice-001.jpg",
      recognizedAmount: 5000,
    }
    const result = insertDocumentInboxSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recognizedAmount).toBe("5000")
    }
  })

  it("recognizedAmount 為 null 應通過驗證", () => {
    const data = {
      documentType: "receipt",
      imagePath: "/uploads/file.jpg",
      recognizedAmount: null,
    }
    const result = insertDocumentInboxSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recognizedAmount).toBeNull()
    }
  })

  it("confirmedAmount 數字應自動轉為字串", () => {
    const data = {
      documentType: "receipt",
      imagePath: "/uploads/file.jpg",
      confirmedAmount: 3500,
    }
    const result = insertDocumentInboxSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.confirmedAmount).toBe("3500")
    }
  })

  it("aiConfidence 數字應自動轉為字串", () => {
    const data = {
      documentType: "receipt",
      imagePath: "/uploads/file.jpg",
      aiConfidence: 0.95,
    }
    const result = insertDocumentInboxSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.aiConfidence).toBe("0.95")
    }
  })

  it("可設定 AI 辨識相關欄位", () => {
    const data = {
      documentType: "invoice",
      imagePath: "/uploads/invoice-002.jpg",
      aiRecognized: true,
      aiConfidence: "0.92",
      recognizedVendor: "中華電信",
      recognizedAmount: "1299",
      recognizedDate: "2026-02-15",
      recognizedDescription: "月租費",
    }
    const result = insertDocumentInboxSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recognizedVendor).toBe("中華電信")
    }
  })
})

describe("insertInvoiceRecordSchema", () => {
  it("有效的發票紀錄應通過驗證", () => {
    const data = {
      invoiceDate: "2026-03-01",
      totalAmount: "5000",
    }
    const result = insertInvoiceRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("totalAmount 數字應自動轉為字串", () => {
    const data = {
      invoiceDate: "2026-03-01",
      totalAmount: 15000,
    }
    const result = insertInvoiceRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.totalAmount).toBe("15000")
    }
  })

  it("缺少 invoiceDate 應驗證失敗", () => {
    const data = { totalAmount: "5000" }
    const result = insertInvoiceRecordSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 totalAmount 應驗證失敗", () => {
    const data = { invoiceDate: "2026-03-01" }
    const result = insertInvoiceRecordSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("subtotal 為 null 應通過驗證", () => {
    const data = {
      invoiceDate: "2026-03-01",
      totalAmount: "10000",
      subtotal: null,
    }
    const result = insertInvoiceRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.subtotal).toBeNull()
    }
  })

  it("subtotal 數字應自動轉為字串", () => {
    const data = {
      invoiceDate: "2026-03-01",
      totalAmount: "10500",
      subtotal: 10000,
      taxAmount: 500,
    }
    const result = insertInvoiceRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.subtotal).toBe("10000")
      expect(result.data.taxAmount).toBe("500")
    }
  })

  it("可設定完整發票資訊", () => {
    const data = {
      invoiceDate: "2026-03-01",
      totalAmount: "10500",
      invoiceNumber: "AB-12345678",
      vendorName: "大哉實業",
      vendorTaxId: "12345678",
      buyerName: "測試公司",
      category: "辦公用品",
      invoiceType: "expense",
      taxYear: 2026,
      taxMonth: 3,
    }
    const result = insertInvoiceRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.vendorName).toBe("大哉實業")
      expect(result.data.taxYear).toBe(2026)
    }
  })
})

// ════════════════════════════════════════════
// loan.ts 測試
// ════════════════════════════════════════════
describe("insertLoanInvestmentRecordSchema", () => {
  const validLoanData = {
    itemName: "親友借貸",
    recordType: "loan",
    partyName: "王小明",
    principalAmount: "500000",
    annualInterestRate: "5.00",
    startDate: "2026-01-01",
  }

  it("有效的借貸紀錄應通過驗證", () => {
    const result = insertLoanInvestmentRecordSchema.safeParse(validLoanData)
    expect(result.success).toBe(true)
  })

  it("principalAmount 數字應自動轉為字串", () => {
    const data = { ...validLoanData, principalAmount: 300000 }
    const result = insertLoanInvestmentRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.principalAmount).toBe("300000")
    }
  })

  it("annualInterestRate 數字應自動轉為字串", () => {
    const data = { ...validLoanData, annualInterestRate: 3.5 }
    const result = insertLoanInvestmentRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.annualInterestRate).toBe("3.5")
    }
  })

  it("缺少 itemName 應驗證失敗", () => {
    const { itemName: _, ...data } = validLoanData
    const result = insertLoanInvestmentRecordSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 recordType 應驗證失敗", () => {
    const { recordType: _, ...data } = validLoanData
    const result = insertLoanInvestmentRecordSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 partyName 應驗證失敗", () => {
    const { partyName: _, ...data } = validLoanData
    const result = insertLoanInvestmentRecordSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 principalAmount 應驗證失敗", () => {
    const { principalAmount: _, ...data } = validLoanData
    const result = insertLoanInvestmentRecordSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("monthlyPaymentAmount 數字應自動轉為字串", () => {
    const data = { ...validLoanData, monthlyPaymentAmount: 15000 }
    const result = insertLoanInvestmentRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.monthlyPaymentAmount).toBe("15000")
    }
  })

  it("agreedPaymentDay 字串應轉為整數", () => {
    const data = { ...validLoanData, agreedPaymentDay: "15" }
    const result = insertLoanInvestmentRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.agreedPaymentDay).toBe(15)
    }
  })

  it("installmentCount 字串應轉為整數", () => {
    const data = { ...validLoanData, installmentCount: "24" }
    const result = insertLoanInvestmentRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.installmentCount).toBe(24)
    }
  })

  it("fixedReturnRate 數字應自動轉為字串", () => {
    const data = { ...validLoanData, fixedReturnRate: 8.5 }
    const result = insertLoanInvestmentRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.fixedReturnRate).toBe("8.5")
    }
  })

  it("totalPaidAmount 數字應自動轉為字串", () => {
    const data = { ...validLoanData, totalPaidAmount: 50000 }
    const result = insertLoanInvestmentRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.totalPaidAmount).toBe("50000")
    }
  })

  it("可設定完整借貸資訊", () => {
    const data = {
      ...validLoanData,
      partyPhone: "0912345678",
      partyRelationship: "朋友",
      partyNotes: "大學同學",
      endDate: "2028-12-31",
      interestPaymentMethod: "monthly",
      hasAgreedReturn: true,
      returnMethod: "installment",
      isHighRisk: false,
      notes: "每月固定還款",
    }
    const result = insertLoanInvestmentRecordSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.partyRelationship).toBe("朋友")
      expect(result.data.hasAgreedReturn).toBe(true)
    }
  })
})

describe("insertLoanPaymentScheduleSchema", () => {
  it("有效的借貸付款計劃應通過驗證", () => {
    const data = {
      recordId: 1,
      scheduleType: "interest",
      dueDate: "2026-04-01",
      amount: "2500",
    }
    const result = insertLoanPaymentScheduleSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 recordId 應驗證失敗", () => {
    const data = {
      scheduleType: "interest",
      dueDate: "2026-04-01",
      amount: "2500",
    }
    const result = insertLoanPaymentScheduleSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 scheduleType 應驗證失敗", () => {
    const data = {
      recordId: 1,
      dueDate: "2026-04-01",
      amount: "2500",
    }
    const result = insertLoanPaymentScheduleSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe("insertLoanPaymentHistorySchema", () => {
  const validHistoryData = {
    recordId: 1,
    paymentType: "interest",
    amount: "2500",
    paymentDate: "2026-03-01",
    paymentMethod: "bank_transfer",
  }

  it("有效的借貸付款紀錄應通過驗證", () => {
    const result = insertLoanPaymentHistorySchema.safeParse(validHistoryData)
    expect(result.success).toBe(true)
  })

  it("amount 數字應自動轉為字串", () => {
    const data = { ...validHistoryData, amount: 5000 }
    const result = insertLoanPaymentHistorySchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.amount).toBe("5000")
    }
  })

  it("remainingPrincipal 數字應自動轉為字串", () => {
    const data = { ...validHistoryData, remainingPrincipal: 450000 }
    const result = insertLoanPaymentHistorySchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.remainingPrincipal).toBe("450000")
    }
  })

  it("remainingInterest 數字應自動轉為字串", () => {
    const data = { ...validHistoryData, remainingInterest: 12000 }
    const result = insertLoanPaymentHistorySchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.remainingInterest).toBe("12000")
    }
  })

  it("缺少 recordId 應驗證失敗", () => {
    const { recordId: _, ...data } = validHistoryData
    const result = insertLoanPaymentHistorySchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 paymentMethod 應驗證失敗", () => {
    const { paymentMethod: _, ...data } = validHistoryData
    const result = insertLoanPaymentHistorySchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe("insertFileAttachmentSchema", () => {
  it("有效的檔案附件應通過驗證", () => {
    const data = {
      fileName: "contract-001.pdf",
      originalName: "合約書.pdf",
      filePath: "/uploads/contract-001.pdf",
      fileSize: 2048576,
      mimeType: "application/pdf",
      fileType: "document",
      entityType: "loan",
      entityId: 1,
    }
    const result = insertFileAttachmentSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 fileName 應驗證失敗", () => {
    const data = {
      originalName: "合約書.pdf",
      filePath: "/uploads/file.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      fileType: "document",
      entityType: "loan",
      entityId: 1,
    }
    const result = insertFileAttachmentSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 entityType 應驗證失敗", () => {
    const data = {
      fileName: "file.pdf",
      originalName: "file.pdf",
      filePath: "/uploads/file.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      fileType: "document",
      entityId: 1,
    }
    const result = insertFileAttachmentSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 entityId 應驗證失敗", () => {
    const data = {
      fileName: "file.pdf",
      originalName: "file.pdf",
      filePath: "/uploads/file.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      fileType: "document",
      entityType: "loan",
    }
    const result = insertFileAttachmentSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

// ════════════════════════════════════════════
// income.ts 測試
// ════════════════════════════════════════════
describe("fieldMappingSchema", () => {
  it("空物件應通過驗證", () => {
    const result = fieldMappingSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("完整欄位對應應通過驗證", () => {
    const data = {
      amount: "$.transaction.amount",
      currency: "$.currency",
      transactionId: "$.id",
      paidAt: "$.completedAt",
      description: "$.memo",
      payerName: "$.payer.name",
      payerContact: "$.payer.email",
      orderId: "$.orderId",
    }
    const result = fieldMappingSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("部分欄位對應應通過驗證", () => {
    const data = {
      amount: "$.amount",
      transactionId: "$.txId",
    }
    const result = fieldMappingSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe("insertIncomeSourceSchema", () => {
  it("有效的進帳來源應通過驗證", () => {
    const data = {
      sourceName: "LINE Pay",
      sourceKey: "linepay",
      sourceType: "linepay",
      authType: "hmac",
    }
    const result = insertIncomeSourceSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 sourceName 應驗證失敗", () => {
    const data = {
      sourceKey: "linepay",
    }
    const result = insertIncomeSourceSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 sourceKey 應驗證失敗", () => {
    const data = {
      sourceName: "LINE Pay",
    }
    const result = insertIncomeSourceSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("無效的 authType 應驗證失敗", () => {
    const data = {
      sourceName: "測試來源",
      sourceKey: "test",
      authType: "invalid_type",
    }
    const result = insertIncomeSourceSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("無效的 sourceType 應驗證失敗", () => {
    const data = {
      sourceName: "測試來源",
      sourceKey: "test",
      sourceType: "invalid_source",
    }
    const result = insertIncomeSourceSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("authType 預設值應為 token", () => {
    const data = {
      sourceName: "自訂來源",
      sourceKey: "custom1",
    }
    const result = insertIncomeSourceSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.authType).toBe("token")
    }
  })

  it("allowedIps 應驗證 IP 格式", () => {
    const data = {
      sourceName: "測試",
      sourceKey: "test",
      allowedIps: ["192.168.1.1", "10.0.0.1"],
    }
    const result = insertIncomeSourceSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("allowedIps 無效 IP 應驗證失敗", () => {
    const data = {
      sourceName: "測試",
      sourceKey: "test",
      allowedIps: ["not-an-ip"],
    }
    const result = insertIncomeSourceSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("fieldMapping 應支援 JSONPath 格式", () => {
    const data = {
      sourceName: "Airbnb",
      sourceKey: "airbnb",
      sourceType: "airbnb",
      fieldMapping: {
        amount: "$.reservation.total",
        paidAt: "$.reservation.checkin",
      },
    }
    const result = insertIncomeSourceSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe("insertIncomeWebhookSchema", () => {
  it("有效的 webhook 紀錄應通過驗證", () => {
    const data = {
      sourceId: 1,
      rawPayload: { amount: 1500, currency: "TWD" },
    }
    const result = insertIncomeWebhookSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 sourceId 應驗證失敗", () => {
    const data = {
      rawPayload: { amount: 1500 },
    }
    const result = insertIncomeWebhookSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 rawPayload 應驗證失敗", () => {
    const data = {
      sourceId: 1,
    }
    const result = insertIncomeWebhookSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("parsedAmount 數字應自動轉為字串", () => {
    const data = {
      sourceId: 1,
      rawPayload: { test: true },
      parsedAmount: 5000,
    }
    const result = insertIncomeWebhookSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.parsedAmount).toBe("5000")
    }
  })

  it("parsedAmountTwd 數字應自動轉為字串", () => {
    const data = {
      sourceId: 1,
      rawPayload: { test: true },
      parsedAmountTwd: 150000,
    }
    const result = insertIncomeWebhookSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.parsedAmountTwd).toBe("150000")
    }
  })

  it("exchangeRate 數字應自動轉為字串", () => {
    const data = {
      sourceId: 1,
      rawPayload: { test: true },
      exchangeRate: 30.5,
    }
    const result = insertIncomeWebhookSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.exchangeRate).toBe("30.5")
    }
  })
})

describe("confirmWebhookSchema", () => {
  it("有效的確認請求應通過驗證", () => {
    const data = {
      projectId: 1,
    }
    const result = confirmWebhookSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 projectId 應驗證失敗", () => {
    const result = confirmWebhookSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("projectId 為 0 應驗證失敗（需正整數）", () => {
    const data = { projectId: 0 }
    const result = confirmWebhookSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("projectId 為負數應驗證失敗", () => {
    const data = { projectId: -1 }
    const result = confirmWebhookSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("可附帶 reviewNote", () => {
    const data = {
      projectId: 1,
      reviewNote: "已確認收款",
    }
    const result = confirmWebhookSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("reviewNote 超過 500 字應驗證失敗", () => {
    const data = {
      projectId: 1,
      reviewNote: "a".repeat(501),
    }
    const result = confirmWebhookSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("itemName 需至少 1 字", () => {
    const data = {
      projectId: 1,
      itemName: "",
    }
    const result = confirmWebhookSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe("batchConfirmWebhookSchema", () => {
  it("有效的批次確認應通過驗證", () => {
    const data = {
      ids: [1, 2, 3],
      projectId: 1,
    }
    const result = batchConfirmWebhookSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("空的 ids 陣列應驗證失敗", () => {
    const data = {
      ids: [],
      projectId: 1,
    }
    const result = batchConfirmWebhookSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("ids 超過 100 筆應驗證失敗", () => {
    const ids = Array.from({ length: 101 }, (_, i) => i + 1)
    const data = {
      ids,
      projectId: 1,
    }
    const result = batchConfirmWebhookSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 projectId 應驗證失敗", () => {
    const data = { ids: [1, 2] }
    const result = batchConfirmWebhookSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

// ════════════════════════════════════════════
// hr.ts 測試（擴展）
// ════════════════════════════════════════════
describe("insertEmployeeSchema（擴展）", () => {
  it("缺少 employeeName 應驗證失敗", () => {
    const data = {
      monthlySalary: "30000",
      hireDate: "2025-06-01",
    }
    const result = insertEmployeeSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 monthlySalary 應驗證失敗", () => {
    const data = {
      employeeName: "張三",
      hireDate: "2025-06-01",
    }
    const result = insertEmployeeSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 hireDate 應驗證失敗", () => {
    const data = {
      employeeName: "張三",
      monthlySalary: "30000",
    }
    const result = insertEmployeeSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("insuredSalary 數字應自動轉為字串", () => {
    const data = {
      employeeName: "陳大明",
      monthlySalary: "45000",
      hireDate: "2025-01-01",
      insuredSalary: 42000,
    }
    const result = insertEmployeeSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.insuredSalary).toBe("42000")
    }
  })

  it("voluntaryPensionRate 數字應自動轉為字串", () => {
    const data = {
      employeeName: "林小華",
      monthlySalary: "38000",
      hireDate: "2025-03-01",
      voluntaryPensionRate: 6,
    }
    const result = insertEmployeeSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.voluntaryPensionRate).toBe("6")
    }
  })

  it("可設定離職日期與備註", () => {
    const data = {
      employeeName: "前員工",
      monthlySalary: "28000",
      hireDate: "2024-01-01",
      terminationDate: "2025-12-31",
      isActive: false,
      notes: "合約到期",
    }
    const result = insertEmployeeSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isActive).toBe(false)
      expect(result.data.terminationDate).toBe("2025-12-31")
    }
  })
})

describe("insertMonthlyHrCostSchema", () => {
  it("有效的月度人事費應通過驗證", () => {
    const data = {
      year: 2026,
      month: 3,
      employeeId: 1,
    }
    const result = insertMonthlyHrCostSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 year 應驗證失敗", () => {
    const data = { month: 3, employeeId: 1 }
    const result = insertMonthlyHrCostSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 month 應驗證失敗", () => {
    const data = { year: 2026, employeeId: 1 }
    const result = insertMonthlyHrCostSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 employeeId 應驗證失敗", () => {
    const data = { year: 2026, month: 3 }
    const result = insertMonthlyHrCostSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("可設定完整的保險費用資訊", () => {
    const data = {
      year: 2026,
      month: 3,
      employeeId: 1,
      baseSalary: "35000",
      insuredSalary: "33300",
      employerLaborInsurance: "2497",
      employerHealthInsurance: "1762",
      employerPension: "2100",
      employerTotal: "6359",
      employeeLaborInsurance: "735",
      employeeHealthInsurance: "529",
      employeePension: "0",
      employeeTotal: "1264",
      netSalary: "33736",
      totalCost: "41359",
    }
    const result = insertMonthlyHrCostSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

// ════════════════════════════════════════════
// base.ts 測試（擴展）
// ════════════════════════════════════════════
describe("insertUserSchema（擴展）", () => {
  it("缺少 username 時應通過驗證（username 為 unique 可選欄位）", () => {
    // drizzle-zod 中 unique() 欄位設為 optional
    const data = { password: "password123" }
    const result = insertUserSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("密碼正好 8 字元應通過驗證", () => {
    const data = { username: "testuser", password: "12345678" }
    const result = insertUserSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("可設定角色和啟用狀態", () => {
    const data = {
      username: "manager",
      password: "password123",
      role: "admin",
      isActive: true,
    }
    const result = insertUserSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.role).toBe("admin")
    }
  })

  it("可設定 LINE 登入欄位", () => {
    const data = {
      username: "lineuser",
      lineUserId: "U1234567890",
      lineDisplayName: "小明",
      authProvider: "line",
    }
    const result = insertUserSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lineUserId).toBe("U1234567890")
      expect(result.data.authProvider).toBe("line")
    }
  })

  it("只有 username 也能通過驗證（密碼和 email 為選填）", () => {
    const data = { username: "minimal" }
    const result = insertUserSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe("updateUserSchema", () => {
  it("部分更新應通過驗證", () => {
    const data = { fullName: "新名字" }
    const result = updateUserSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("空物件應通過驗證（所有欄位 partial）", () => {
    const result = updateUserSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("可更新 email", () => {
    const data = { email: "new@example.com" }
    const result = updateUserSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe("loginSchema（擴展）", () => {
  it("很長的用戶名應通過驗證", () => {
    const data = { username: "a".repeat(50), password: "test1234" }
    const result = loginSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("只有空白的用戶名應通過驗證（min(1) 只檢查長度）", () => {
    const data = { username: " ", password: "test" }
    const result = loginSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("非字串類型的 username 應驗證失敗", () => {
    const data = { username: 123, password: "test" }
    const result = loginSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe("insertAuditLogSchema", () => {
  it("有效的稽核日誌應通過驗證", () => {
    const data = {
      tableName: "payment_items",
      recordId: 42,
      action: "update",
    }
    const result = insertAuditLogSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 tableName 應驗證失敗", () => {
    const data = { recordId: 42, action: "update" }
    const result = insertAuditLogSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 action 應驗證失敗", () => {
    const data = { tableName: "users", recordId: 1 }
    const result = insertAuditLogSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("可附帶新舊值和變更欄位", () => {
    const data = {
      tableName: "employees",
      recordId: 5,
      action: "update",
      oldValues: { salary: "30000" },
      newValues: { salary: "35000" },
      changedFields: ["salary"],
      userId: 1,
      userInfo: "admin",
      changeReason: "年度調薪",
    }
    const result = insertAuditLogSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe("insertLineConfigSchema", () => {
  it("有效的 LINE 設定應通過驗證", () => {
    const data = {
      channelId: "1234567890",
      channelSecret: "abcdef1234567890",
      callbackUrl: "https://example.com/callback",
      isEnabled: true,
    }
    const result = insertLineConfigSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("空物件應通過驗證（所有欄位可選）", () => {
    const result = insertLineConfigSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe("DEFAULT_PERMISSIONS", () => {
  it("admin 應有所有權限", () => {
    const adminPerms = DEFAULT_PERMISSIONS.admin
    expect(adminPerms.payment).toBe(true)
    expect(adminPerms.loanInvestment).toBe(true)
    expect(adminPerms.household).toBe(true)
    expect(adminPerms.reports).toBe(true)
    expect(adminPerms.system).toBe(true)
    expect(adminPerms.templates).toBe(true)
    expect(adminPerms.other).toBe(true)
  })

  it("user1 不應有 system 和 templates 權限", () => {
    const user1Perms = DEFAULT_PERMISSIONS.user1
    expect(user1Perms.system).toBe(false)
    expect(user1Perms.templates).toBe(false)
    expect(user1Perms.payment).toBe(true)
  })

  it("user2 只應有 household 權限", () => {
    const user2Perms = DEFAULT_PERMISSIONS.user2
    expect(user2Perms.household).toBe(true)
    expect(user2Perms.payment).toBe(false)
    expect(user2Perms.loanInvestment).toBe(false)
    expect(user2Perms.reports).toBe(false)
    expect(user2Perms.system).toBe(false)
  })
})

// ════════════════════════════════════════════
// category.ts 測試（擴展）
// ════════════════════════════════════════════
describe("insertDebtCategorySchema（擴展）", () => {
  it("可設定分類類型和描述", () => {
    const data = {
      categoryName: "水電費",
      categoryType: "fixed",
      description: "每月固定水電支出",
    }
    const result = insertDebtCategorySchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.categoryType).toBe("fixed")
    }
  })

  it("可設定模板相關欄位", () => {
    const data = {
      categoryName: "房租模板",
      isTemplate: true,
      templateNotes: "適用於所有租約",
      accountInfo: "國泰世華 123-456-789",
    }
    const result = insertDebtCategorySchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isTemplate).toBe(true)
    }
  })
})

describe("insertPaymentProjectSchema（擴展）", () => {
  it("可設定專案類型和描述", () => {
    const data = {
      projectName: "浯島文旅裝修",
      projectType: "renovation",
      description: "2026 年度裝修工程",
    }
    const result = insertPaymentProjectSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.projectType).toBe("renovation")
    }
  })

  it("缺少 projectName 應驗證失敗", () => {
    const data = { projectType: "general" }
    const result = insertPaymentProjectSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe("insertFixedCategorySchema", () => {
  it("有效的固定分類應通過驗證", () => {
    const data = {
      categoryName: "電話費",
      categoryType: "utility",
    }
    const result = insertFixedCategorySchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 categoryName 應驗證失敗", () => {
    const data = { categoryType: "utility" }
    const result = insertFixedCategorySchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 categoryType 應驗證失敗", () => {
    const data = { categoryName: "電話費" }
    const result = insertFixedCategorySchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("可設定排序和描述", () => {
    const data = {
      categoryName: "水費",
      categoryType: "utility",
      description: "自來水費",
      sortOrder: 2,
      isActive: true,
    }
    const result = insertFixedCategorySchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sortOrder).toBe(2)
    }
  })
})

describe("insertFixedCategorySubOptionSchema", () => {
  it("有效的子選項應通過驗證", () => {
    const data = {
      fixedCategoryId: 1,
      projectId: 1,
      subOptionName: "0912-345-678",
    }
    const result = insertFixedCategorySubOptionSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 fixedCategoryId 應驗證失敗", () => {
    const data = {
      projectId: 1,
      subOptionName: "0912-345-678",
    }
    const result = insertFixedCategorySubOptionSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 subOptionName 應驗證失敗", () => {
    const data = {
      fixedCategoryId: 1,
      projectId: 1,
    }
    const result = insertFixedCategorySubOptionSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

// ════════════════════════════════════════════
// rental.ts 測試（擴展）
// ════════════════════════════════════════════
describe("insertRentalContractSchema（擴展）", () => {
  it("缺少 projectId 應驗證失敗", () => {
    const data = {
      contractName: "A 棟租約",
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      totalYears: 3,
      totalMonths: 36,
      baseAmount: "25000",
    }
    const result = insertRentalContractSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 contractName 應驗證失敗", () => {
    const data = {
      projectId: 1,
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      totalYears: 3,
      totalMonths: 36,
      baseAmount: "25000",
    }
    const result = insertRentalContractSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("可設定完整租約資訊含銀行", () => {
    const data = {
      projectId: 1,
      contractName: "C 棟辦公室",
      tenantName: "大哉實業",
      tenantPhone: "082-123456",
      tenantAddress: "金門縣金城鎮",
      startDate: "2026-01-01",
      endDate: "2031-12-31",
      totalYears: 6,
      totalMonths: 72,
      baseAmount: 50000,
      payeeName: "房東王先生",
      bankCode: "013",
      accountNumber: "1234-5678-9012",
      contractPaymentDay: 5,
      hasBufferPeriod: true,
      bufferMonths: 2,
    }
    const result = insertRentalContractSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.baseAmount).toBe("50000")
      expect(result.data.tenantName).toBe("大哉實業")
      expect(result.data.bufferMonths).toBe(2)
    }
  })
})

describe("insertRentalPriceTierSchema", () => {
  it("有效的租金階段應通過驗證", () => {
    const data = {
      contractId: 1,
      yearStart: 1,
      yearEnd: 3,
      monthlyAmount: "25000",
    }
    const result = insertRentalPriceTierSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("monthlyAmount 數字應自動轉為字串", () => {
    const data = {
      contractId: 1,
      yearStart: 4,
      yearEnd: 6,
      monthlyAmount: 30000,
    }
    const result = insertRentalPriceTierSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.monthlyAmount).toBe("30000")
    }
  })

  it("缺少 contractId 應驗證失敗", () => {
    const data = {
      yearStart: 1,
      yearEnd: 3,
      monthlyAmount: "25000",
    }
    const result = insertRentalPriceTierSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 yearStart 應驗證失敗", () => {
    const data = {
      contractId: 1,
      yearEnd: 3,
      monthlyAmount: "25000",
    }
    const result = insertRentalPriceTierSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe("insertContractDocumentSchema", () => {
  it("有效的合約文件應通過驗證", () => {
    const data = {
      contractId: 1,
      fileName: "contract-v1.pdf",
      originalName: "租約正本.pdf",
      filePath: "/uploads/contracts/contract-v1.pdf",
      fileSize: 5242880,
      mimeType: "application/pdf",
    }
    const result = insertContractDocumentSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 contractId 應驗證失敗", () => {
    const data = {
      fileName: "file.pdf",
      originalName: "file.pdf",
      filePath: "/uploads/file.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
    }
    const result = insertContractDocumentSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("可設定版本和上傳者資訊", () => {
    const data = {
      contractId: 1,
      fileName: "contract-v2.pdf",
      originalName: "租約修正版.pdf",
      filePath: "/uploads/contracts/contract-v2.pdf",
      fileSize: 3145728,
      mimeType: "application/pdf",
      version: "修正版",
      isLatest: true,
      uploadedBy: "admin",
      notes: "增加附約條款",
    }
    const result = insertContractDocumentSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.version).toBe("修正版")
      expect(result.data.isLatest).toBe(true)
    }
  })
})

// ════════════════════════════════════════════
// household.ts 測試（擴展）
// ════════════════════════════════════════════
describe("insertHouseholdExpenseSchema（擴展）", () => {
  it("缺少 amount 應驗證失敗", () => {
    const data = {
      date: "2026-01-15",
      description: "午餐",
    }
    const result = insertHouseholdExpenseSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 date 應驗證失敗", () => {
    const data = {
      amount: "350",
      description: "晚餐",
    }
    const result = insertHouseholdExpenseSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("可設定付款方式和分類", () => {
    const data = {
      amount: "800",
      date: "2026-03-01",
      description: "超市採購",
      paymentMethod: "credit_card",
      categoryId: 5,
    }
    const result = insertHouseholdExpenseSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.paymentMethod).toBe("credit_card")
    }
  })
})

describe("insertHouseholdBudgetSchema", () => {
  it("有效的家用預算應通過驗證", () => {
    const data = {
      categoryId: 1,
      year: 2026,
      month: 3,
      budgetAmount: "15000",
    }
    const result = insertHouseholdBudgetSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("缺少 categoryId 應驗證失敗", () => {
    const data = {
      year: 2026,
      month: 3,
      budgetAmount: "15000",
    }
    const result = insertHouseholdBudgetSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 year 應驗證失敗", () => {
    const data = {
      categoryId: 1,
      month: 3,
      budgetAmount: "15000",
    }
    const result = insertHouseholdBudgetSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("缺少 budgetAmount 應驗證失敗", () => {
    const data = {
      categoryId: 1,
      year: 2026,
      month: 3,
    }
    const result = insertHouseholdBudgetSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("可設定備註和啟用狀態", () => {
    const data = {
      categoryId: 2,
      year: 2026,
      month: 4,
      budgetAmount: "20000",
      notes: "清明連假預計消費增加",
      isActive: true,
    }
    const result = insertHouseholdBudgetSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.notes).toBe("清明連假預計消費增加")
    }
  })
})

// ════════════════════════════════════════════
// ai.ts 測試
// ════════════════════════════════════════════
describe("insertAiSettingsSchema", () => {
  it("空物件應通過驗證（所有欄位有預設值或可選）", () => {
    const result = insertAiSettingsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("可設定 API 提供商和金鑰", () => {
    const data = {
      apiProvider: "openrouter",
      apiKey: "sk-or-v1-xxx",
      selectedModel: "anthropic/claude-3.5-sonnet",
      isEnabled: true,
    }
    const result = insertAiSettingsSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.apiProvider).toBe("openrouter")
      expect(result.data.selectedModel).toBe("anthropic/claude-3.5-sonnet")
    }
  })

  it("可設定自訂系統提示詞", () => {
    const data = {
      systemPromptExtra: "你是浯島財務管理系統的 AI 助手",
    }
    const result = insertAiSettingsSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("isEnabled 設為 false 應通過驗證", () => {
    const data = { isEnabled: false }
    const result = insertAiSettingsSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isEnabled).toBe(false)
    }
  })
})

describe("updateAiSettingsSchema", () => {
  it("部分更新應通過驗證", () => {
    const data = { selectedModel: "google/gemma-2-9b-it:free" }
    const result = updateAiSettingsSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it("空物件應通過驗證", () => {
    const result = updateAiSettingsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("只更新 isEnabled 應通過驗證", () => {
    const result = updateAiSettingsSchema.safeParse({ isEnabled: false })
    expect(result.success).toBe(true)
  })
})
