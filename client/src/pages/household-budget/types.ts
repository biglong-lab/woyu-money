// 家用記帳頁面共用型別定義（從原 household-budget.tsx 機械搬移）
import type { HouseholdExpense } from "@shared/schema/household"

// API 回應型別定義（對齊 server /api/household/budget 和 /api/household/stats）
export interface MonthlyBudgetResponse {
  month: string
  budgetAmount: string | number
  hasBudget: boolean
  id: number | null
}

export interface MonthlyStatsResponse {
  month: string
  budgetAmount: number
  totalSpent: number
  remaining: number
  count: number
  progressPercent: number
  categoryBreakdown: Array<{
    categoryId: number | null
    categoryName: string
    amount: number
    count: number
  }>
}

export interface HouseholdCategory {
  id: number
  categoryName: string
  color: string
}

export interface ExpenseWithCategory extends HouseholdExpense {
  categoryName?: string
  receiptPhoto?: string
}

// 表單型別定義
export interface QuickAddFormData {
  amount: string
  categoryId: string
  description: string
  paymentMethod: string
  date: string
}

export interface BudgetFormData {
  monthlyBudget: string
  reason?: string
}

export interface AddExpensePayload {
  amount: number
  categoryId: number
  description: string
  paymentMethod: string
  date: string
  receiptImages?: string[]
}

export interface SetBudgetPayload {
  budgetAmount: number
  month: string
  reason?: string
}

// 支出 / 收入 切換
export type EntryType = "expense" | "income"

// 收入分類（記帳工具常見 6 類）
export const INCOME_CATEGORIES = ["薪資", "獎金", "投資", "副業", "退款", "其他"] as const
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]

// 過去 30 天最常用分類（/api/household/top-categories 回應）
export interface TopCategory {
  categoryId: number
  categoryName: string
  color: string
  uses: number
  lastUsedAt: string
}

// 智能分類建議（/api/household/suggest-category 回應）
export interface CategorySuggestionsResponse {
  suggestions: Array<{
    categoryId: number
    categoryName: string
    score: number
    occurrences: number
  }>
}

// AI 收據辨識（/api/household/recognize-receipt 回應）
export interface RecognizeReceiptResponse {
  success: boolean
  confidence: number
  extracted: {
    vendor?: string
    amount?: number
    date?: string
    category?: string
    description?: string
  }
  error?: string
}

// 「+1 再記」保存的上一筆資料
export interface LastEntry {
  amount: string
  description: string
  categoryId: string
}
