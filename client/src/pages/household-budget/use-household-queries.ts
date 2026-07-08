// 家用記帳頁面資料查詢（預算 / 支出 / 統計 / 分類 / 常用分類）
// 從原 household-budget.tsx 機械搬移、查詢設定完全不變
import { useQuery } from "@tanstack/react-query"
import type {
  MonthlyBudgetResponse,
  MonthlyStatsResponse,
  HouseholdCategory,
  ExpenseWithCategory,
  TopCategory,
} from "./types"

/**
 * 家用記帳頁面的所有 useQuery 集中處
 * @param selectedMonth 選定月份（YYYY-MM）
 */
export function useHouseholdQueries(selectedMonth: string) {
  const { data: monthlyBudget, isLoading: isLoadingBudget } = useQuery<MonthlyBudgetResponse>({
    queryKey: [`/api/household/budget?month=${selectedMonth}`],
  })

  const { data: dailyExpenses, isLoading: isLoadingExpenses } = useQuery<ExpenseWithCategory[]>({
    queryKey: [`/api/household/expenses?month=${selectedMonth}`],
  })

  const { data: monthlyStats, isLoading: isLoadingStats } = useQuery<MonthlyStatsResponse>({
    queryKey: [`/api/household/stats?month=${selectedMonth}`],
  })

  // 從分類管理系統載入家用分類
  const { data: householdCategories = [], isLoading: isLoadingCategories } = useQuery<
    HouseholdCategory[]
  >({
    queryKey: ["/api/categories/household"],
    staleTime: 10 * 60 * 1000, // 快取 10 分鐘
  })

  // 過去 30 天最常用的 6 個分類
  const { data: topCategories = [] } = useQuery<TopCategory[]>({
    queryKey: ["/api/household/top-categories?limit=6&days=30"],
    staleTime: 5 * 60 * 1000,
  })

  return {
    monthlyBudget,
    dailyExpenses,
    monthlyStats,
    householdCategories,
    topCategories,
    isLoadingBudget,
    isLoadingExpenses,
    isLoadingStats,
    isLoadingCategories,
  }
}
