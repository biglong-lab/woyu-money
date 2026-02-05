import { z } from "zod";

// ==========================================
// 借貸投資管理 - 共用型別與工具函式
// ==========================================

// 表單驗證 Schema
export const loanInvestmentSchema = z.object({
  itemName: z.string().min(1, "項目名稱不能為空"),
  recordType: z.enum(["loan", "investment"], {
    required_error: "請選擇類型",
  }),

  // 基本資料：借方/資方資料
  partyName: z.string().min(1, "姓名不能為空"),
  partyPhone: z.string().optional(),
  partyRelationship: z.string().optional(),
  partyNotes: z.string().optional(),

  // 金額和利息
  principalAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  annualInterestRate: z.union([z.string(), z.number()]).transform((val) => val.toString()),

  // 時間安排
  startDate: z.string(),
  endDate: z.string().optional(),

  // 借貸特有欄位
  interestPaymentMethod: z.enum(["yearly", "monthly", "agreed_date"]).optional(),
  monthlyPaymentAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  agreedPaymentDay: z.union([z.string(), z.number()]).transform((val) => parseInt(val.toString())).optional(),
  annualPaymentDate: z.string().optional(),

  // 投資特有欄位
  fixedReturnRate: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  otherReturnPlan: z.string().optional(),
  hasAgreedReturn: z.boolean().optional(),
  returnMethod: z.enum(["lump_sum", "installment"]).optional(),
  installmentCount: z.union([z.string(), z.number()]).transform((val) => parseInt(val.toString())).optional(),
  installmentAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),

  // 合約和文件
  contractFileUrl: z.string().optional(),
  documentNotes: z.string().optional(),

  // 備註
  notes: z.string().optional(),

  // 狀態管理
  status: z.enum(["active", "completed", "overdue"]).optional(),
});

export type LoanInvestmentFormData = z.infer<typeof loanInvestmentSchema>;

export interface LoanInvestmentRecord {
  id: number;
  itemName: string;
  recordType: "loan" | "investment";
  partyName: string;
  partyPhone?: string;
  partyRelationship?: string;
  partyNotes?: string;
  principalAmount: string;
  annualInterestRate: string;
  startDate: string;
  endDate?: string;
  interestPaymentMethod?: string;
  monthlyPaymentAmount?: string;
  agreedPaymentDay?: number;
  annualPaymentDate?: string;
  fixedReturnRate?: string;
  otherReturnPlan?: string;
  hasAgreedReturn?: boolean;
  returnMethod?: string;
  installmentCount?: number;
  installmentAmount?: string;
  status: string;
  totalPaidAmount: string;
  isHighRisk: boolean;
  contractFileUrl?: string;
  documentNotes?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanStats {
  totalLoanAmount: string;
  activeLoanAmount: string;
  totalInvestmentAmount: string;
  activeInvestmentAmount: string;
  monthlyInterestTotal: string;
  dueSoonAmount: string;
  thisMonthDue: string;
  nextMonthDue: string;
  quarterDue: string;
  highRiskCount: number;
}

export interface QuickPaymentFormData {
  amount: string;
  paymentType: "interest" | "principal" | "mixed";
  paymentMethod: "cash" | "bank_transfer" | "check" | "other";
  notes: string;
  paymentDate: string;
}

export interface AmortizationEntry {
  period: number;
  principal: number;
  interest: number;
  monthlyPayment: number;
  remainingBalance: number;
}

// ==========================================
// 工具函式
// ==========================================

/** 格式化為台幣貨幣格式 */
export const formatCurrency = (amount: string | number): string => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
  }).format(num);
};

/** 計算每月利息 */
export const calculateMonthlyInterest = (principal: string, rate: string): number => {
  const p = parseFloat(principal);
  const r = parseFloat(rate);
  return (p * r) / 100 / 12;
};

/** 判斷是否為高風險（年息 >= 15%） */
export const isHighRisk = (rate: string): boolean => {
  return parseFloat(rate) >= 15;
};

/** 根據借款金額和每月還款推算年利率 */
export const calculateAnnualRateFromMonthlyPayment = (
  principal: number,
  monthlyPayment: number,
  _termYears: number = 1
): number => {
  if (principal <= 0 || monthlyPayment <= 0) return 0;

  // 簡化計算：假設為利息型還款，非本金攤還
  const totalInterestPerYear = monthlyPayment * 12;
  const annualRate = (totalInterestPerYear / principal) * 100;
  return Math.round(annualRate * 100) / 100; // 保留2位小數
};

/** 根據借款金額、年利率計算每月利息 */
export const calculateMonthlyInterestFromRate = (
  principal: number,
  annualRate: number
): number => {
  if (principal <= 0 || annualRate <= 0) return 0;
  return (principal * annualRate / 100) / 12;
};

/** 本利攤還計算（等額本息） */
export const calculateEqualInstallment = (
  principal: number,
  annualRate: number,
  termYears: number
): number => {
  if (principal <= 0 || annualRate <= 0 || termYears <= 0) return 0;

  const monthlyRate = annualRate / 100 / 12;
  const totalMonths = termYears * 12;

  if (monthlyRate === 0) return principal / totalMonths;

  const monthlyPayment =
    principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
    (Math.pow(1 + monthlyRate, totalMonths) - 1);

  return Math.round(monthlyPayment);
};

/** 風險評估等級 */
export const getRiskLevel = (rate: number): {
  level: string;
  color: string;
  textColor: string;
} => {
  if (rate >= 25) return { level: "極高風險", color: "bg-red-600", textColor: "text-red-600" };
  if (rate >= 20) return { level: "高風險", color: "bg-red-500", textColor: "text-red-500" };
  if (rate >= 15) return { level: "中高風險", color: "bg-orange-500", textColor: "text-orange-500" };
  if (rate >= 10) return { level: "中等風險", color: "bg-yellow-500", textColor: "text-yellow-600" };
  if (rate >= 5) return { level: "低風險", color: "bg-green-500", textColor: "text-green-600" };
  return { level: "極低風險", color: "bg-blue-500", textColor: "text-blue-600" };
};

/** 生成攤提計算表（最多顯示前 24 期） */
export const generateAmortizationSchedule = (
  record: LoanInvestmentRecord
): AmortizationEntry[] => {
  if (!record.monthlyPaymentAmount || !record.principalAmount || !record.annualInterestRate) {
    return [];
  }

  const principal = parseFloat(record.principalAmount);
  const monthlyPayment = parseFloat(record.monthlyPaymentAmount);
  const annualRate = parseFloat(record.annualInterestRate) / 100;
  const monthlyRate = annualRate / 12;

  let remainingBalance = principal;
  const schedule: AmortizationEntry[] = [];
  let period = 1;

  while (remainingBalance > 0 && period <= 360) {
    // 最多30年
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = Math.min(monthlyPayment - interestPayment, remainingBalance);

    if (principalPayment <= 0) break;

    remainingBalance -= principalPayment;

    schedule.push({
      period,
      principal: principalPayment,
      interest: interestPayment,
      monthlyPayment: principalPayment + interestPayment,
      remainingBalance: Math.max(0, remainingBalance),
    });

    period++;
    if (remainingBalance < 0.01) break; // 基本還清時停止
  }

  return schedule.slice(0, 24); // 只顯示前24期
};
