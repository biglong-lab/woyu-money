// 家用記帳主頁（協調器）：只負責狀態管理與子元件組合
// 拆分自原 client/src/pages/household-budget.tsx（1309 行）、行為完全不變
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"
import { PeriodFeedCard } from "@/components/household/period-feed-card"
import {
  ExpenseTemplatesCard,
  type ExpenseTemplate,
} from "@/components/household/expense-templates-card"
import { ExpenseSearchCard } from "@/components/household/expense-search-card"
import { IncomeExpenseBalanceCard } from "@/components/household/income-expense-balance-card"
import { ExportCsvDropdown } from "@/components/household/export-csv-dropdown"
import { StreakChip } from "@/components/household/streak-chip"
import {
  BudgetOverrunAlertsCard,
  BudgetSuggestionCard,
  MonthlyComparisonCard,
  BudgetChangesCard,
  AnomaliesCard,
  AIInsightsCard,
  YearlyOverviewCard,
} from "@/components/household/budget-cards"
import { MonthSelector } from "./MonthSelector"
import { QuickAddDialog } from "./QuickAddDialog"
import { BudgetSetupDialog } from "./BudgetSetupDialog"
import { BudgetOverviewCards } from "./BudgetOverviewCards"
import { CategoryBreakdownCard } from "./CategoryBreakdownCard"
import { RecentExpensesCard } from "./RecentExpensesCard"
import { useHouseholdQueries } from "./use-household-queries"
import { useQuickAddForm } from "./use-quick-add-form"
import { useHouseholdMutations } from "./use-household-mutations"
import type { BudgetFormData, EntryType, IncomeCategory, LastEntry } from "./types"

export default function HouseholdBudget() {
  useDocumentTitle("家用預算")

  // 月份切換（預設本月、用本地時區避 UTC 偏移）
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })

  // 資料查詢（預算 / 支出 / 統計 / 分類 / 常用分類）
  const {
    monthlyBudget,
    dailyExpenses,
    monthlyStats,
    householdCategories,
    topCategories,
    isLoadingBudget,
    isLoadingExpenses,
    isLoadingStats,
  } = useHouseholdQueries(selectedMonth)

  const { toast } = useToast()
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddReceiptUrl, setQuickAddReceiptUrl] = useState<string | null>(null)
  // 「+1 再記」連續模式
  const [continueMode, setContinueMode] = useState<boolean>(false)
  const [lastEntry, setLastEntry] = useState<LastEntry | null>(null)
  // 支出 / 收入 切換
  const [entryType, setEntryType] = useState<EntryType>("expense")
  const [incomeCategory, setIncomeCategory] = useState<IncomeCategory>("薪資")
  const [showBudgetSetup, setShowBudgetSetup] = useState(false)

  // 快速記帳表單（表單 / deeplink / 手勢複製 / 智能分類建議 / 語音輸入）
  const { quickAddForm, voice, categorySuggestions } = useQuickAddForm({
    showQuickAdd,
    setShowQuickAdd,
  })

  // 預算設定表單
  const budgetForm = useForm<BudgetFormData>({
    defaultValues: {
      monthlyBudget: monthlyBudget?.budgetAmount?.toString() || "",
    },
  })

  // mutations（收入 / 支出 / AI 辨識 / 刪除 / 預算設定）
  const {
    addExpenseMutation,
    recognizeMutation,
    deleteExpenseMutation,
    setBudgetMutation,
    onQuickAdd,
    onSetBudget,
  } = useHouseholdMutations({
    selectedMonth,
    entryType,
    incomeCategory,
    continueMode,
    quickAddReceiptUrl,
    householdCategories,
    quickAddForm,
    setQuickAddReceiptUrl,
    setShowQuickAdd,
    setShowBudgetSetup,
    setLastEntry,
  })

  // 用 stats API 拿正確統計（後端已聚合，避免前端再算一次）
  // server /api/household/expenses?month=X 已按月過濾、直接列即可
  const thisMonthExpenses = Array.isArray(dailyExpenses) ? dailyExpenses : []

  const totalSpent = monthlyStats?.totalSpent ?? 0
  const budgetAmount =
    monthlyStats?.budgetAmount ?? parseFloat(monthlyBudget?.budgetAmount?.toString() || "0")
  const remaining = monthlyStats?.remaining ?? budgetAmount - totalSpent
  const spentPercentage = monthlyStats?.progressPercent ?? 0

  if (isLoadingBudget || isLoadingExpenses || isLoadingStats) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold">家用記帳</h1>
            <StreakChip size="md" />
          </div>
          <p className="text-muted-foreground">簡單記錄，輕鬆管理每月預算</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* 月份切換 */}
          <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />

          {/* 快速記帳 Dialog */}
          <QuickAddDialog
            open={showQuickAdd}
            onOpenChange={setShowQuickAdd}
            entryType={entryType}
            setEntryType={setEntryType}
            incomeCategory={incomeCategory}
            setIncomeCategory={setIncomeCategory}
            quickAddForm={quickAddForm}
            voice={voice}
            categorySuggestions={categorySuggestions}
            topCategories={topCategories}
            householdCategories={householdCategories}
            quickAddReceiptUrl={quickAddReceiptUrl}
            setQuickAddReceiptUrl={setQuickAddReceiptUrl}
            isRecognizing={recognizeMutation.isPending}
            onRecognize={(imageUrl) => recognizeMutation.mutate(imageUrl)}
            lastEntry={lastEntry}
            setContinueMode={setContinueMode}
            onQuickAdd={onQuickAdd}
            isSubmitting={addExpenseMutation.isPending}
          />

          {/* 設定預算 Dialog */}
          <BudgetSetupDialog
            open={showBudgetSetup}
            onOpenChange={setShowBudgetSetup}
            budgetForm={budgetForm}
            onSetBudget={onSetBudget}
            isPending={setBudgetMutation.isPending}
          />

          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => {
              const url = `/api/household/monthly-report?month=${selectedMonth}&format=download`
              const link = document.createElement("a")
              link.href = url
              link.download = `household-report-${selectedMonth}.md`
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              toast({ title: "✅ 月報已下載", description: `${selectedMonth} 結算月報` })
            }}
            data-testid="button-export-monthly-report"
          >
            📄 匯出月報
          </Button>

          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => {
              window.location.href = "/categories"
            }}
            data-testid="button-manage-categories"
          >
            ⚙️ 分類管理
          </Button>

          <ExportCsvDropdown selectedMonth={selectedMonth} />
        </div>
      </div>

      {/* 收支結餘總覽（收入 + 支出 + 結餘 + 收入分類）*/}
      <IncomeExpenseBalanceCard selectedMonth={selectedMonth} />

      {/* 今天/本週/本月 花費清單（Phase 4） */}
      <PeriodFeedCard />

      {/* 進階搜尋 / 篩選 / 排序 */}
      <ExpenseSearchCard />

      {/* 固定支出範本（一鍵套用） */}
      <ExpenseTemplatesCard
        onApply={(t: ExpenseTemplate) => {
          // 開啟 quick-add 並填表
          quickAddForm.setValue("amount", t.amount, { shouldValidate: true })
          if (t.categoryId)
            quickAddForm.setValue("categoryId", String(t.categoryId), { shouldValidate: true })
          quickAddForm.setValue("paymentMethod", t.paymentMethod || "cash")
          if (t.description) quickAddForm.setValue("description", t.description)
          setShowQuickAdd(true)
        }}
      />

      {/* 預算超支即時警示 */}
      <BudgetOverrunAlertsCard />

      {/* 月初預算建議（依上月實際） */}
      <BudgetSuggestionCard
        selectedMonth={selectedMonth}
        currentBudget={budgetAmount}
        onApply={(amt) => {
          setBudgetMutation.mutate({ monthlyBudget: String(amt) })
        }}
      />

      {/* 本月 vs 上月同期 + 6 月 sparkline */}
      <MonthlyComparisonCard selectedMonth={selectedMonth} currentSpent={totalSpent} />

      {/* AI 消費觀察（純規則洞察） */}
      <AIInsightsCard selectedMonth={selectedMonth} />

      {/* 異常偵測（離群值 / 重複 / 缺記） */}
      <AnomaliesCard selectedMonth={selectedMonth} />

      {/* 年度回顧（過去 12 個月） */}
      <YearlyOverviewCard selectedMonth={selectedMonth} />

      {/* 預算變更歷程（階段 4.2 共決基底） */}
      <BudgetChangesCard selectedMonth={selectedMonth} />

      {/* 本月預算概況（四卡 + 進度條） */}
      <BudgetOverviewCards
        budgetAmount={budgetAmount}
        totalSpent={totalSpent}
        remaining={remaining}
        spentPercentage={spentPercentage}
        expenseCount={thisMonthExpenses.length}
      />

      {/* 分類佔比（前 5）*/}
      <CategoryBreakdownCard
        monthlyStats={monthlyStats}
        totalSpent={totalSpent}
        selectedMonth={selectedMonth}
      />

      {/* 最近記錄 */}
      <RecentExpensesCard
        selectedMonth={selectedMonth}
        expenses={thisMonthExpenses}
        householdCategories={householdCategories}
        onDelete={(id) => deleteExpenseMutation.mutate(id)}
        isDeleting={deleteExpenseMutation.isPending}
      />
      <BackToTop />
    </div>
  )
}
