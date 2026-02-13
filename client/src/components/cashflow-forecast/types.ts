// 現金流預測 - 型別定義與常數

export interface PaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  paidAmount?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  projectName?: string;
  paymentType?: string;
}

export interface Schedule {
  id: number;
  paymentItemId: number;
  scheduledDate: string;
  scheduledAmount: string;
  status?: string;
  itemName?: string;
}

export interface CashflowPaymentRecord {
  id: number;
  itemId: number;
  itemName: string;
  amountPaid: string;
  paymentDate: string;
  paymentMonth: string;
  dueDate: string | null;
  dueMonth: string;
  isCurrentMonthItem: boolean;
  originLabel: string;
  projectName: string | null;
  paymentMethod: string | null;
}

export interface BudgetItem {
  id: number;
  itemName: string;
  plannedAmount: string;
  actualAmount?: string | null;
  paymentType?: string;
  monthlyAmount?: string | null;
  monthCount?: string | null;
  installmentCount?: string | null;
  installmentAmount?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  isConverted?: boolean;
  budgetPlanName?: string;
}

export interface BudgetPlan {
  id: number;
  planName: string;
  budgetPeriod: string;
  startDate: string;
  endDate: string;
  totalBudget: string;
  items?: BudgetItem[];
}

export interface CashflowForecastProps {
  items: PaymentItem[];
  schedules?: Schedule[];
  budgetPlans?: BudgetPlan[];
  paymentRecords?: CashflowPaymentRecord[];
  monthsToForecast?: number;
  className?: string;
}

export interface DetailItem {
  id: number;
  name: string;
  amount: number;
  date?: string;
  project?: string;
}

export interface PaidDetailItem extends DetailItem {
  isCurrentMonthItem: boolean;
  originLabel: string;
}

export interface MonthlyDetails {
  budget: DetailItem[];
  scheduled: DetailItem[];
  estimated: DetailItem[];
  recurring: DetailItem[];
  paidCurrent: PaidDetailItem[];
  paidCarryOver: PaidDetailItem[];
}

export interface MonthlyForecast {
  month: string;
  monthLabel: string;
  budget: number;
  scheduled: number;
  estimated: number;
  recurring: number;
  paidCurrent: number;
  paidCarryOver: number;
  paid: number;
  total: number;
  details: MonthlyDetails;
}

export interface CategoryVisibility {
  budget: boolean;
  scheduled: boolean;
  estimated: boolean;
  recurring: boolean;
  paid: boolean;
}

export const CATEGORY_COLORS = {
  budget: '#8B5CF6',
  scheduled: '#3B82F6',
  estimated: '#F59E0B',
  recurring: '#10B981',
  paid: '#6B7280',
};

export const CATEGORY_LABELS = {
  budget: '預算',
  scheduled: '已排程',
  estimated: '預估到期',
  recurring: '月付固定',
  paid: '已付款',
};

export const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
};

export const formatCurrency = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toFixed(0);
};
