// 專案預算管理共用型別定義

export type BudgetPlan = {
  id: number;
  planName: string;
  planType: string;
  projectId: number | null;
  budgetPeriod: string;
  startDate: string;
  endDate: string;
  totalBudget: string;
  actualSpent: string;
  status: string;
  tags: any[];
  createdAt: string;
  items?: BudgetItem[];
};

export type BudgetItem = {
  id: number;
  budgetPlanId: number;
  categoryId: number | null;
  fixedCategoryId: number | null;
  itemName: string;
  description: string | null;
  paymentType: string;
  plannedAmount: string;
  actualAmount: string | null;
  installmentCount: number | null;
  installmentAmount: string | null;
  monthlyAmount: string | null;
  monthCount: number | null;
  startDate: string | null;
  endDate: string | null;
  priority: number;
  convertedToPayment: boolean;
  linkedPaymentItemId: number | null;
  conversionDate: string | null;
  variance: string | null;
  variancePercentage: string | null;
  notes: string | null;
};

export type Project = {
  id: number;
  projectName: string;
  projectType: string;
};

export type Category = {
  id: number;
  categoryName: string;
};
