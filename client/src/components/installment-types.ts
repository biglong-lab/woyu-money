// 分期付款管理共用型別定義

export type PaymentItem = {
  id: number;
  itemName: string;
  amount: string;
  totalAmount: string;
  categoryId: number;
  projectId: number;
  paymentType: "monthly" | "installment" | "single";
  dueDate: string;
  startDate?: string;
  endDate?: string;
  installmentMonths?: number;
  installmentCount?: number;
  installmentAmount?: string;
  paidAmount: string;
  isPaid: boolean;
  notes?: string;
  fixedCategoryId?: number;
  createdAt: string;
  updatedAt: string;
};

export type DebtCategory = {
  id: number;
  categoryName: string;
  categoryType: string;
};

export type PaymentProject = {
  id: number;
  projectName: string;
  projectType: string;
};

export type FixedCategory = {
  id: number;
  categoryName: string;
  categoryType: string;
};

// 分析後的分期項目型別
// 使用 Omit 排除與分析結果衝突的原始字串欄位
export type AnalyzedInstallmentItem = Omit<PaymentItem, "dueDate" | "paidAmount" | "totalAmount" | "isPaid"> & {
  currentPeriod: number;
  totalPeriods: number;
  baseName: string;
  dueDate: Date;
  daysUntilDue: number;
  paidAmount: number;
  totalAmount: number;
  remainingAmount: number;
  progress: number;
  periodProgress: number;
  isPaid: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
  projectTotalAmount: number;
  paidPeriods: number;
  remainingPeriods: number;
  monthlyAmount: number;
  averageMonthlyAmount: number;
  status: "paid" | "overdue" | "due-soon" | "normal";
};

// 分期統計資料型別
export type InstallmentStats = {
  total: number;
  dueSoon: number;
  overdue: number;
  completed: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  averageProgress: number;
};

// 分期計算結果型別
export type PaymentCalculation = {
  monthlyAmount: number;
  firstPayment: number;
  calculations: Array<{
    period: number;
    amount: number;
    type: string;
  }>;
};
