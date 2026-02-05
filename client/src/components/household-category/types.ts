import { z } from "zod";

// ============================================================
// 家用分類管理 - 共用型別與驗證 Schema
// ============================================================

/** 分類表單驗證 Schema */
export const categorySchema = z.object({
  categoryName: z.string().min(1, "分類名稱為必填"),
  categoryType: z.string().min(1, "分類類型為必填"),
  description: z.string().optional(),
});

/** 預算表單驗證 Schema */
export const budgetSchema = z.object({
  month: z.string().min(1, "月份為必填"),
  budgetAmount: z.string().min(1, "預算金額為必填"),
  notes: z.string().optional(),
});

/** 支出表單驗證 Schema */
export const expenseSchema = z.object({
  amount: z.string().min(1, "金額為必填"),
  date: z.string().min(1, "日期為必填"),
  description: z.string().optional(),
  paymentMethod: z.string().min(1, "付款方式為必填"),
  tags: z.array(z.string()).optional(),
});

/** 分類表單資料型別 */
export type CategoryFormData = z.infer<typeof categorySchema>;

/** 預算表單資料型別 */
export type BudgetFormData = z.infer<typeof budgetSchema>;

/** 支出表單資料型別 */
export type ExpenseFormData = z.infer<typeof expenseSchema>;

/** 支出篩選條件 */
export interface ExpenseFilter {
  dateRange: string;
  paymentMethod: string;
  search: string;
}

/** 分類統計資料（來自 API） */
export interface CategoryStats {
  currentBudget?: string;
  totalExpenses?: string;
}

// ============================================================
// 工具函式
// ============================================================

/** 格式化貨幣金額為千分位字串 */
export function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return isNaN(num) ? "0" : num.toLocaleString();
}

/** 計算預算使用率百分比 */
export function calcBudgetProgress(stats: CategoryStats | undefined): number {
  if (!stats || !stats.currentBudget) return 0;
  const spent = parseFloat(stats.totalExpenses || "0");
  const budget = parseFloat(stats.currentBudget || "0");
  return budget > 0 ? (spent / budget) * 100 : 0;
}
