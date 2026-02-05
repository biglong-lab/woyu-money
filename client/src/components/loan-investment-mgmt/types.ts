import { z } from "zod";

/**
 * 借貸投資管理 -- 共用型別與驗證 schema
 */

// 表單驗證 schema
export const loanInvestmentSchema = z.object({
  itemName: z.string().min(1, "項目名稱為必填"),
  recordType: z.enum(["loan", "investment"]),
  partyName: z.string().min(1, "當事人姓名為必填"),
  partyPhone: z.string().optional(),
  partyRelationship: z.string().optional(),
  principalAmount: z.string().min(1, "本金金額為必填"),
  annualInterestRate: z.string().min(0, "年利率不能為負數"),
  startDate: z.string().min(1, "開始日期為必填"),
  endDate: z.string().optional(),
  status: z.enum(["active", "completed", "overdue"]).default("active"),
  paymentMethod: z.enum(["monthly", "quarterly", "annually", "maturity"]).default("monthly"),
  installmentCount: z.number().optional(),
  collateralInfo: z.string().optional(),
  notes: z.string().optional(),
  partyNotes: z.string().optional(),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium"),
  contractDate: z.string().optional(),
  maturityDate: z.string().optional(),
  guarantorInfo: z.string().optional(),
  legalDocuments: z.string().optional(),
  documentNotes: z.string().optional(),
});

// 表單資料型別（從 schema 推導）
export type LoanInvestmentFormData = z.infer<typeof loanInvestmentSchema>;

// 借貸投資記錄型別
export type LoanInvestmentRecord = {
  id: number;
  itemName: string;
  recordType: string;
  partyName: string;
  partyPhone?: string;
  partyRelationship?: string;
  principalAmount: string;
  annualInterestRate: string;
  startDate: string;
  endDate?: string;
  status: string;
  paymentMethod: string;
  installmentCount?: number;
  collateralInfo?: string;
  notes?: string;
  partyNotes?: string;
  riskLevel: string;
  contractDate?: string;
  maturityDate?: string;
  guarantorInfo?: string;
  legalDocuments?: string;
  documentNotes?: string;
  createdAt: string;
  updatedAt: string;
};

// 統計資料型別
export type LoanInvestmentStats = {
  totalPrincipal?: number;
  expectedReturn?: number;
  totalParties?: number;
  lowRiskCount?: number;
  mediumRiskCount?: number;
  highRiskCount?: number;
};
