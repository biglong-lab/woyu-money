import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Wallet, TrendingDown, TrendingUp, Calendar, Trash2, Mic, MicOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import { localDateISO, formatNT, cn } from "@/lib/utils"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useCopyAmount } from "@/hooks/use-copy-amount"
import type { HouseholdExpense } from "@shared/schema/household"
import type { DebtCategory } from "@shared/schema/category"
import { BackToTop } from "@/components/back-to-top"
import { ReceiptUploadButton } from "@/components/receipt-upload-button"
import { AmountKeypad } from "@/components/amount-keypad"
import { useIsMobile } from "@/hooks/use-mobile"
import { PeriodFeedCard } from "@/components/household/period-feed-card"
import {
  ExpenseTemplatesCard,
  type ExpenseTemplate,
} from "@/components/household/expense-templates-card"
import { ExpenseSearchCard } from "@/components/household/expense-search-card"
import { IncomeExpenseBalanceCard } from "@/components/household/income-expense-balance-card"
import { ExportCsvDropdown } from "@/components/household/export-csv-dropdown"
import { StreakChip } from "@/components/household/streak-chip"
import { getCategoryDecor } from "@/lib/category-emoji"
import { useVoiceInput } from "@/hooks/use-voice-input"
import {
  BudgetOverrunAlertsCard,
  BudgetSuggestionCard,
  MonthlyComparisonCard,
  BudgetChangesCard,
  AnomaliesCard,
  AIInsightsCard,
  YearlyOverviewCard,
} from "@/components/household/budget-cards"

// API 回應型別定義（對齊 server /api/household/budget 和 /api/household/stats）
interface MonthlyBudgetResponse {
  month: string
  budgetAmount: string | number
  hasBudget: boolean
  id: number | null
}

interface MonthlyStatsResponse {
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

interface HouseholdCategory {
  id: number
  categoryName: string
  color: string
}

interface ExpenseWithCategory extends HouseholdExpense {
  categoryName?: string
  receiptPhoto?: string
}

// 表單型別定義
interface QuickAddFormData {
  amount: string
  categoryId: string
  description: string
  paymentMethod: string
  date: string
}

interface BudgetFormData {
  monthlyBudget: string
  reason?: string
}

interface AddExpensePayload {
  amount: number
  categoryId: number
  description: string
  paymentMethod: string
  date: string
  receiptImages?: string[]
}

interface SetBudgetPayload {
  budgetAmount: number
  month: string
  reason?: string
}

export default function HouseholdBudget() {
  useDocumentTitle("家用預算")

  // 月份切換（預設本月、用本地時區避 UTC 偏移）
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })

  const { data: monthlyBudget, isLoading: isLoadingBudget } = useQuery<MonthlyBudgetResponse>({
    queryKey: [`/api/household/budget?month=${selectedMonth}`],
  })

  const { data: dailyExpenses, isLoading: isLoadingExpenses } = useQuery<ExpenseWithCategory[]>({
    queryKey: [`/api/household/expenses?month=${selectedMonth}`],
  })

  const { data: monthlyStats, isLoading: isLoadingStats } = useQuery<MonthlyStatsResponse>({
    queryKey: [`/api/household/stats?month=${selectedMonth}`],
  })

  // Load household categories from the category management system
  const { data: householdCategories = [], isLoading: isLoadingCategories } = useQuery<
    HouseholdCategory[]
  >({
    queryKey: ["/api/categories/household"],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  })

  const { toast } = useToast()
  const copyAmount = useCopyAmount()
  const isMobile = useIsMobile()
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddReceiptUrl, setQuickAddReceiptUrl] = useState<string | null>(null)
  // 大鍵盤切換：手機預設開、桌面預設關
  const [useKeypad, setUseKeypad] = useState<boolean>(false)
  useEffect(() => {
    if (isMobile) setUseKeypad(true)
  }, [isMobile])
  // 「+1 再記」連續模式
  const [continueMode, setContinueMode] = useState<boolean>(false)
  const [lastEntry, setLastEntry] = useState<{
    amount: string
    description: string
    categoryId: string
  } | null>(null)
  // 支出 / 收入 切換
  const [entryType, setEntryType] = useState<"expense" | "income">("expense")
  // 收入分類（記帳工具常見 6 類）
  const INCOME_CATEGORIES = ["薪資", "獎金", "投資", "副業", "退款", "其他"] as const
  const [incomeCategory, setIncomeCategory] = useState<(typeof INCOME_CATEGORIES)[number]>("薪資")

  // 過去 30 天最常用的 6 個分類
  const { data: topCategories = [] } = useQuery<
    Array<{
      categoryId: number
      categoryName: string
      color: string
      uses: number
      lastUsedAt: string
    }>
  >({
    queryKey: ["/api/household/top-categories?limit=6&days=30"],
    staleTime: 5 * 60 * 1000,
  })

  // ?quickAdd=1 → 自動開快速記帳（FAB 從其他頁來的 deeplink）
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("quickAdd") === "1") {
      setShowQuickAdd(true)
      // 清掉 query 避免再次觸發
      const url = new URL(window.location.href)
      url.searchParams.delete("quickAdd")
      window.history.replaceState({}, "", url.toString())
    }
  }, [])

  // 監聽手勢「複製為新一筆」event（從 SwipeableExpenseRow 觸發）
  useEffect(() => {
    function onDuplicateRequest(e: Event): void {
      const detail = (
        e as CustomEvent<{
          amount: string
          categoryId: number | null
          description: string
          paymentMethod: string | null
        }>
      ).detail
      if (!detail) return
      if (detail.amount) {
        quickAddForm.setValue("amount", detail.amount, { shouldValidate: true })
      }
      if (detail.categoryId) {
        quickAddForm.setValue("categoryId", String(detail.categoryId), { shouldValidate: true })
      }
      if (detail.description) quickAddForm.setValue("description", detail.description)
      if (detail.paymentMethod) quickAddForm.setValue("paymentMethod", detail.paymentMethod)
      setShowQuickAdd(true)
    }
    window.addEventListener("household:duplicate-expense", onDuplicateRequest)
    return () => window.removeEventListener("household:duplicate-expense", onDuplicateRequest)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [showBudgetSetup, setShowBudgetSetup] = useState(false)
  const queryClient = useQueryClient()

  // 快速記帳表單
  const quickAddForm = useForm<QuickAddFormData>({
    defaultValues: {
      amount: "",
      categoryId: "",
      description: "",
      paymentMethod: "cash",
      date: localDateISO(),
    },
  })

  // 智能分類建議：依備註輸入推測分類（debounce 400ms）
  const watchedDescription = quickAddForm.watch("description") || ""
  const [debouncedDesc, setDebouncedDesc] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDesc(watchedDescription.trim()), 400)
    return () => clearTimeout(t)
  }, [watchedDescription])

  // 語音輸入
  const voice = useVoiceInput()
  // 語音解析完成 → 自動填表單
  useEffect(() => {
    if (!voice.parsed) return
    const { amount, description } = voice.parsed
    if (amount) quickAddForm.setValue("amount", amount, { shouldValidate: true })
    if (description) quickAddForm.setValue("description", description)
    // 解析完不重複觸發
    voice.reset()
    toast({
      title: "🎤 語音辨識完成",
      description: `${amount ? `NT$ ${amount}` : ""} ${description ?? ""}`.trim() || "已填入",
    })
  }, [voice.parsed]) // eslint-disable-line react-hooks/exhaustive-deps
  const { data: categorySuggestions } = useQuery<{
    suggestions: Array<{
      categoryId: number
      categoryName: string
      score: number
      occurrences: number
    }>
  }>({
    queryKey: [
      `/api/household/suggest-category?description=${encodeURIComponent(debouncedDesc)}&limit=3`,
    ],
    enabled: showQuickAdd && debouncedDesc.length >= 2,
    staleTime: 30 * 1000,
  })

  // 預算設定表單
  const budgetForm = useForm<BudgetFormData>({
    defaultValues: {
      monthlyBudget: monthlyBudget?.budgetAmount?.toString() || "",
    },
  })

  // 快速記帳
  const invalidateHousehold = () => {
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/household/"),
    })
  }

  // 收入 mutation
  const addIncomeMutation = useMutation({
    mutationFn: async (data: {
      amount: string
      category: string
      description: string
      date: string
      paymentMethod: string
    }) => {
      return await apiRequest("POST", "/api/household/incomes", {
        amount: parseFloat(data.amount),
        category: data.category,
        description: data.description || null,
        date: data.date,
        paymentMethod: data.paymentMethod || "bank_transfer",
      })
    },
    onSuccess: () => {
      toast({ title: "💰 收入已記錄", description: `${incomeCategory} 入帳` })
      invalidateHousehold()
      if (continueMode) {
        quickAddForm.setValue("amount", "")
        quickAddForm.setValue("description", "")
      } else {
        setShowQuickAdd(false)
        quickAddForm.reset()
      }
    },
    onError: (e: Error) => {
      toast({ title: "記錄失敗", description: e.message, variant: "destructive" })
    },
  })
  const addExpenseMutation = useMutation({
    mutationFn: async (data: QuickAddFormData) => {
      const formattedData: AddExpensePayload = {
        ...data,
        amount: parseFloat(data.amount),
        categoryId: parseInt(data.categoryId),
        receiptImages: quickAddReceiptUrl ? [quickAddReceiptUrl] : undefined,
      }
      return await apiRequest("POST", "/api/household/expenses", formattedData)
    },
    onSuccess: (_data, vars) => {
      toast({
        title: "✅ 記帳成功",
        description: quickAddReceiptUrl ? "已記錄、附收據" : "支出已記錄",
      })
      invalidateHousehold()
      // 保存上一筆給「+1 再記」用
      setLastEntry({
        amount: vars.amount,
        description: vars.description,
        categoryId: vars.categoryId,
      })
      if (continueMode) {
        // 連續模式：只清金額、保留分類 / 付款方式 / 日期
        quickAddForm.setValue("amount", "")
        quickAddForm.setValue("description", "")
        setQuickAddReceiptUrl(null)
      } else {
        setShowQuickAdd(false)
        quickAddForm.reset()
        setQuickAddReceiptUrl(null)
      }
    },
    onError: (e: Error) => {
      toast({
        title: "記帳失敗",
        description: e.message || "請重試",
        variant: "destructive",
      })
    },
  })

  // AI 辨識收據自動填表
  const recognizeMutation = useMutation<
    {
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
    },
    Error,
    string
  >({
    mutationFn: (imageUrl: string) =>
      apiRequest("POST", "/api/household/recognize-receipt", { imageUrl }) as Promise<{
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
      }>,
    onSuccess: (data) => {
      if (!data.success) {
        toast({ title: "辨識失敗", description: data.error || "請手動填", variant: "destructive" })
        return
      }
      const e = data.extracted
      const filled: string[] = []
      if (e.amount != null && e.amount > 0) {
        quickAddForm.setValue("amount", String(e.amount))
        filled.push(`金額 $${e.amount}`)
      }
      if (e.date) {
        // 嘗試解析 YYYY-MM-DD 格式
        const m = e.date.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
        if (m) {
          const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
          quickAddForm.setValue("date", iso)
          filled.push(`日期 ${iso}`)
        }
      }
      if (e.vendor || e.description) {
        const desc = [e.vendor, e.description].filter(Boolean).join(" - ")
        quickAddForm.setValue("description", desc)
        filled.push("備註")
      }
      // category 模糊匹配 householdCategories 名稱
      if (e.category && householdCategories.length > 0) {
        const matched = householdCategories.find(
          (c) => c.categoryName.includes(e.category!) || e.category!.includes(c.categoryName)
        )
        if (matched) {
          quickAddForm.setValue("categoryId", String(matched.id))
          filled.push(`分類 ${matched.categoryName}`)
        }
      }
      toast({
        title: `✨ 辨識完成（信心 ${Math.round(data.confidence * 100)}%）`,
        description: filled.length > 0 ? `已自動填：${filled.join("、")}` : "未取得可用資料",
      })
    },
    onError: (err) => {
      toast({ title: "辨識請求失敗", description: err.message, variant: "destructive" })
    },
  })

  // 刪除支出
  const deleteExpenseMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/household-expenses/${id}`),
    onSuccess: () => {
      toast({ title: "✅ 已刪除支出" })
      invalidateHousehold()
    },
    onError: (e: Error) =>
      toast({ title: "刪除失敗", description: e.message, variant: "destructive" }),
  })

  // 設定預算（用 selectedMonth、不是固定本月）
  const setBudgetMutation = useMutation({
    mutationFn: async (data: BudgetFormData) => {
      const budgetData: SetBudgetPayload = {
        budgetAmount: parseFloat(data.monthlyBudget),
        month: selectedMonth,
        reason: data.reason?.trim() || undefined,
      }
      return await apiRequest("POST", "/api/household/budget", budgetData)
    },
    onSuccess: () => {
      toast({
        title: "預算設定成功",
        description: `${selectedMonth} 預算已更新`,
      })
      invalidateHousehold()
      setShowBudgetSetup(false)
    },
    onError: (e: Error) => {
      toast({
        title: "設定失敗",
        description: e.message || "請重試",
        variant: "destructive",
      })
    },
  })

  const onQuickAdd = (data: QuickAddFormData) => {
    if (!data.amount) {
      toast({
        title: "請輸入金額",
        variant: "destructive",
      })
      return
    }
    if (entryType === "income") {
      addIncomeMutation.mutate({
        amount: data.amount,
        category: incomeCategory,
        description: data.description,
        date: data.date,
        paymentMethod: data.paymentMethod,
      })
      return
    }
    // 支出：分類必填
    if (!data.categoryId) {
      toast({
        title: "請選擇分類",
        variant: "destructive",
      })
      return
    }
    addExpenseMutation.mutate(data)
  }

  const onSetBudget = (data: BudgetFormData) => {
    setBudgetMutation.mutate(data)
  }

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
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                const opts: string[] = []
                const now = new Date()
                for (let i = -6; i <= 1; i++) {
                  const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
                  opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
                }
                const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
                return opts.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                    {m === cm ? "（本月）" : ""}
                  </SelectItem>
                ))
              })()}
            </SelectContent>
          </Select>
          <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                快速記帳
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-0 gap-0">
              <DialogHeader className="sticky top-0 z-10 bg-white border-b p-4 m-0">
                <DialogTitle>快速記帳</DialogTitle>
                <DialogDescription>
                  {entryType === "expense"
                    ? "快速記錄今天的支出"
                    : "記錄收入（薪資 / 獎金 / 投資 / 副業）"}
                </DialogDescription>
                {/* 支出 / 收入 切換 tab */}
                <div className="flex bg-gray-100 rounded-lg p-1 mt-2">
                  <button
                    type="button"
                    onClick={() => setEntryType("expense")}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded transition-all active:scale-95",
                      entryType === "expense"
                        ? "bg-rose-500 text-white shadow"
                        : "text-gray-600 hover:bg-gray-200"
                    )}
                    data-testid="tab-entry-expense"
                  >
                    💸 支出
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType("income")}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded transition-all active:scale-95",
                      entryType === "income"
                        ? "bg-emerald-500 text-white shadow"
                        : "text-gray-600 hover:bg-gray-200"
                    )}
                    data-testid="tab-entry-income"
                  >
                    💰 收入
                  </button>
                </div>
              </DialogHeader>
              <form onSubmit={quickAddForm.handleSubmit(onQuickAdd)} className="space-y-4 p-4 pb-2">
                <div>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <Label htmlFor="amount">
                      金額 <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      {voice.isSupported && (
                        <button
                          type="button"
                          onClick={() => (voice.isListening ? voice.stop() : voice.start())}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border transition-all active:scale-95",
                            voice.isListening
                              ? "bg-rose-500 text-white border-rose-600 animate-pulse shadow"
                              : "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
                          )}
                          data-testid="button-voice-input"
                          title={
                            voice.isListening
                              ? "點擊結束錄音"
                              : "語音記帳、例如「150 元 早餐 全家」"
                          }
                        >
                          {voice.isListening ? (
                            <MicOff className="w-3 h-3" />
                          ) : (
                            <Mic className="w-3 h-3" />
                          )}
                          {voice.isListening ? "聆聽中…" : "語音"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setUseKeypad((v) => !v)}
                        className="text-[10px] text-gray-500 underline"
                      >
                        {useKeypad ? "切換鍵盤輸入" : "切換大鍵盤"}
                      </button>
                    </div>
                  </div>
                  {/* 語音即時轉錄 */}
                  {voice.isListening && (
                    <div className="mb-2 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-800">
                      🎤 正在聆聽：{voice.transcript || "（請說話、例如「150 元 早餐 全家」）"}
                    </div>
                  )}
                  {voice.error && (
                    <div className="mb-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                      {voice.error}
                    </div>
                  )}
                  {!useKeypad && (
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="輸入金額"
                      onFocus={(e) => e.target.select()}
                      autoFocus
                      inputMode="decimal"
                      {...quickAddForm.register("amount", { required: true })}
                    />
                  )}
                  {useKeypad && (
                    <AmountKeypad
                      value={quickAddForm.watch("amount") || ""}
                      onChange={(v) => quickAddForm.setValue("amount", v, { shouldValidate: true })}
                      onConfirm={() => quickAddForm.handleSubmit(onQuickAdd)()}
                    />
                  )}
                </div>
                {entryType === "income" ? (
                  <div>
                    <Label>
                      收入分類 <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {INCOME_CATEGORIES.map((cat) => {
                        const selected = incomeCategory === cat
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setIncomeCategory(cat)}
                            className={cn(
                              "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-all active:scale-95",
                              selected
                                ? "bg-emerald-100 text-emerald-800 border-emerald-400 font-semibold ring-2 ring-emerald-200"
                                : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                            )}
                            data-testid={`income-category-${cat}`}
                          >
                            {cat === "薪資" && "💼"}
                            {cat === "獎金" && "🎁"}
                            {cat === "投資" && "📈"}
                            {cat === "副業" && "🛠️"}
                            {cat === "退款" && "↩️"}
                            {cat === "其他" && "📦"}
                            {cat}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="categoryId">
                      分類 <span className="text-red-500">*</span>
                    </Label>
                    {topCategories.length > 0 && (
                      <div className="mb-2">
                        <div className="text-[10px] text-gray-500 mb-1">📌 常用</div>
                        <div className="flex flex-wrap gap-1.5">
                          {topCategories.map((tc) => {
                            const isSelected =
                              quickAddForm.watch("categoryId") === String(tc.categoryId)
                            const decor = getCategoryDecor(tc.categoryName)
                            return (
                              <button
                                key={tc.categoryId}
                                type="button"
                                onClick={() =>
                                  quickAddForm.setValue("categoryId", String(tc.categoryId), {
                                    shouldValidate: true,
                                  })
                                }
                                className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-all",
                                  "active:scale-95",
                                  isSelected
                                    ? "border-amber-400 font-semibold ring-2 ring-amber-200"
                                    : "border-gray-200 hover:border-gray-300"
                                )}
                                style={{
                                  backgroundColor: isSelected ? `${decor.color}22` : "white",
                                  color: isSelected ? decor.color : "#374151",
                                }}
                                data-testid={`category-chip-${tc.categoryId}`}
                              >
                                <span className="text-sm">{decor.emoji}</span>
                                {tc.categoryName}
                                <span className="text-gray-400">×{tc.uses}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <Select
                      value={quickAddForm.watch("categoryId")}
                      onValueChange={(value: string) => quickAddForm.setValue("categoryId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="或從完整分類選擇" />
                      </SelectTrigger>
                      <SelectContent>
                        {householdCategories.map((category: HouseholdCategory) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            <span className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                              {category.categoryName}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="description">
                    備註 <span className="text-xs text-gray-400 font-normal">（選填）</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="例如：早餐、加油"
                    rows={2}
                    {...quickAddForm.register("description")}
                  />
                  {/* 智能分類建議 */}
                  {categorySuggestions &&
                    categorySuggestions.suggestions.length > 0 &&
                    (() => {
                      const currentCatId = quickAddForm.watch("categoryId")
                      const filtered = categorySuggestions.suggestions.filter(
                        (s) => String(s.categoryId) !== currentCatId
                      )
                      if (filtered.length === 0) return null
                      return (
                        <div className="mt-2 p-2 rounded-lg bg-violet-50 border border-violet-200">
                          <div className="text-[10px] text-violet-700 mb-1.5">
                            💡 依過去記錄、建議分類：
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {filtered.map((s) => {
                              const decor = getCategoryDecor(s.categoryName)
                              return (
                                <button
                                  key={s.categoryId}
                                  type="button"
                                  onClick={() =>
                                    quickAddForm.setValue("categoryId", String(s.categoryId), {
                                      shouldValidate: true,
                                    })
                                  }
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border",
                                    "bg-white hover:shadow-sm active:scale-95 transition-all"
                                  )}
                                  style={{
                                    borderColor: decor.color,
                                    color: decor.color,
                                  }}
                                  data-testid={`suggest-category-${s.categoryId}`}
                                >
                                  <span className="text-sm">{decor.emoji}</span>
                                  {s.categoryName}
                                  <span className="text-gray-400">({s.occurrences})</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                </div>
                <div>
                  <Label htmlFor="paymentMethod">
                    付款方式 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    onValueChange={(value: string) => quickAddForm.setValue("paymentMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇付款方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">現金</SelectItem>
                      <SelectItem value="card">信用卡</SelectItem>
                      <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                      <SelectItem value="mobile_payment">行動支付</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="date">
                    日期 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    {...quickAddForm.register("date", { required: true })}
                  />
                </div>
                {entryType === "expense" && (
                  <div>
                    <Label>
                      收據照片{" "}
                      <span className="text-xs text-gray-400 font-normal">
                        （選填、拍照即可附存證）
                      </span>
                    </Label>
                    <ReceiptUploadButton
                      value={quickAddReceiptUrl}
                      onChange={setQuickAddReceiptUrl}
                    />
                    {quickAddReceiptUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 gap-1 text-purple-700 border-purple-300 hover:bg-purple-50"
                        disabled={recognizeMutation.isPending}
                        onClick={() => recognizeMutation.mutate(quickAddReceiptUrl)}
                      >
                        {recognizeMutation.isPending ? "🤖 辨識中…" : "✨ AI 自動填金額/品項/日期"}
                      </Button>
                    )}
                  </div>
                )}
                {/* 上一筆「+1 再記」快速按鈕 */}
                {lastEntry && (
                  <button
                    type="button"
                    onClick={() => {
                      quickAddForm.setValue("amount", lastEntry.amount)
                      quickAddForm.setValue("description", lastEntry.description || "")
                      quickAddForm.setValue("categoryId", lastEntry.categoryId)
                    }}
                    className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 text-xs text-amber-700 hover:bg-amber-100 active:scale-[0.99] transition-all"
                    data-testid="button-plus-one-again"
                  >
                    📋 +1 同上：NT${" "}
                    {Math.round(parseFloat(lastEntry.amount || "0")).toLocaleString()}
                    {lastEntry.description && (
                      <span className="text-gray-500"> · {lastEntry.description.slice(0, 20)}</span>
                    )}
                  </button>
                )}
              </form>

              {/* Sticky footer — 雙明確按鈕、不用 toggle */}
              <div className="sticky bottom-0 z-10 bg-white border-t p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center text-[10px] text-gray-400 px-1">
                  <a
                    href="/categories"
                    className="underline hover:text-amber-600"
                    data-testid="link-manage-categories"
                  >
                    ⚙️ 找不到分類？管理 →
                  </a>
                  <span>ESC 或點外部關閉</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setContinueMode(false)
                      setShowQuickAdd(false)
                    }}
                    data-testid="button-cancel-quickadd"
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setContinueMode(true)
                      quickAddForm.handleSubmit(onQuickAdd)()
                    }}
                    disabled={addExpenseMutation.isPending}
                    className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300"
                    data-testid="button-submit-continue"
                  >
                    記、繼續
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setContinueMode(false)
                      quickAddForm.handleSubmit(onQuickAdd)()
                    }}
                    disabled={addExpenseMutation.isPending}
                    data-testid="button-submit-quickadd"
                  >
                    記錄
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showBudgetSetup} onOpenChange={setShowBudgetSetup}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                設定預算
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>設定每月預算</DialogTitle>
                <DialogDescription>設定每月生活費預算，建立預算概念</DialogDescription>
              </DialogHeader>
              <form onSubmit={budgetForm.handleSubmit(onSetBudget)} className="space-y-4">
                <div>
                  <Label htmlFor="monthlyBudget">
                    每月預算 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="monthlyBudget"
                    type="number"
                    step="0.01"
                    placeholder="輸入每月預算"
                    onFocus={(e) => e.target.select()}
                    autoFocus
                    {...budgetForm.register("monthlyBudget", { required: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="budgetReason">變更原因（選填、留下紀錄）</Label>
                  <Input
                    id="budgetReason"
                    placeholder="例如：因油價上漲、調整交通預算"
                    {...budgetForm.register("reason")}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowBudgetSetup(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={setBudgetMutation.isPending}>
                    設定
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

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

      {/* 本月預算概況 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">每月預算</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => copyAmount(budgetAmount, "本月預算")}
              className="text-2xl font-bold hover:text-blue-600 hover:underline cursor-pointer"
              title="點擊複製金額"
            >
              {formatNT(budgetAmount)}
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已花費</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => copyAmount(totalSpent, "本月已花費")}
              className="text-2xl font-bold text-red-600 hover:underline cursor-pointer"
              title="點擊複製金額"
            >
              {formatNT(totalSpent)}
            </button>
            <p className="text-xs text-muted-foreground">{spentPercentage.toFixed(1)}% 的預算</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">剩餘預算</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => copyAmount(remaining, "本月剩餘預算")}
              className={`text-2xl font-bold hover:underline cursor-pointer ${
                remaining >= 0 ? "text-green-600" : "text-red-600"
              }`}
              title="點擊複製金額"
            >
              {formatNT(remaining)}
            </button>
            <p className="text-xs text-muted-foreground">
              {remaining >= 0 ? "還可以花" : "已超支"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">記帳次數</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{thisMonthExpenses.length}</div>
            <p className="text-xs text-muted-foreground">本月記錄</p>
          </CardContent>
        </Card>
      </div>

      {/* 預算進度條 */}
      {budgetAmount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>本月預算使用狀況</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all duration-300 ${
                  spentPercentage > 100
                    ? "bg-red-500"
                    : spentPercentage > 80
                      ? "bg-yellow-500"
                      : "bg-green-500"
                }`}
                style={{ width: `${Math.min(spentPercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>已使用 {spentPercentage.toFixed(1)}%</span>
              <span>
                {remaining >= 0
                  ? `還有 NT$ ${remaining.toLocaleString()}`
                  : `超支 NT$ ${Math.abs(remaining).toLocaleString()}`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 分類佔比（前 5）*/}
      {monthlyStats &&
        Array.isArray(monthlyStats.categoryBreakdown) &&
        monthlyStats.categoryBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">分類佔比</CardTitle>
              <CardDescription>{selectedMonth} 各分類支出排名</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {monthlyStats.categoryBreakdown.slice(0, 5).map((c) => {
                const pct = totalSpent > 0 ? Math.round((c.amount / totalSpent) * 100) : 0
                return (
                  <div key={c.categoryId ?? c.categoryName} className="text-sm">
                    <div className="flex justify-between mb-0.5">
                      <span>{c.categoryName}</span>
                      <span className="font-mono">
                        NT$ {Math.round(c.amount).toLocaleString()}{" "}
                        <span className="text-xs text-gray-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {monthlyStats.categoryBreakdown.length > 5 && (
                <div className="text-xs text-gray-400 italic pt-1">
                  + {monthlyStats.categoryBreakdown.length - 5} 個其他分類
                </div>
              )}
            </CardContent>
          </Card>
        )}

      {/* 最近記錄 */}
      <Card>
        <CardHeader>
          <CardTitle>{selectedMonth} 記錄</CardTitle>
          <CardDescription>已記錄 {thisMonthExpenses.length} 筆支出</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {thisMonthExpenses.length > 0 ? (
              thisMonthExpenses.slice(0, 10).map((expense: ExpenseWithCategory, index: number) => {
                const category = householdCategories.find(
                  (cat: HouseholdCategory) => cat.id === expense.categoryId
                )
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category?.color || "#gray" }}
                      />
                      <div>
                        <div className="font-medium">
                          {category?.categoryName || expense.categoryName || "其他"}
                        </div>
                        <div className="text-sm text-muted-foreground">{expense.date}</div>
                        {expense.description && (
                          <div className="text-sm text-muted-foreground">{expense.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-medium text-red-600">
                          -NT$ {parseInt(expense.amount?.toString() || "0").toLocaleString()}
                        </div>
                        {expense.receiptPhoto && (
                          <Badge variant="outline" className="text-xs">
                            有發票
                          </Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (expense.id && confirm(`刪除此筆 -NT$ ${expense.amount} ？`)) {
                            deleteExpenseMutation.mutate(expense.id)
                          }
                        }}
                        disabled={deleteExpenseMutation.isPending}
                        className="text-red-500 hover:bg-red-50 rounded p-1.5"
                        title="刪除這筆"
                        aria-label="刪除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                還沒有記錄，點擊"快速記帳"開始記錄支出
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <BackToTop />
    </div>
  )
}
