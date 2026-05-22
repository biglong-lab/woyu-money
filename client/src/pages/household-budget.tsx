import { useState } from "react"
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
import { Plus, Camera, Wallet, TrendingDown, TrendingUp, Calendar, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import { localDateISO, formatNT } from "@/lib/utils"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useCopyAmount } from "@/hooks/use-copy-amount"
import type { HouseholdExpense } from "@shared/schema/household"
import type { DebtCategory } from "@shared/schema/category"
import { BackToTop } from "@/components/back-to-top"

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
}

interface AddExpensePayload {
  amount: number
  categoryId: number
  description: string
  paymentMethod: string
  date: string
}

interface SetBudgetPayload {
  budgetAmount: number
  month: string
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
  const [showQuickAdd, setShowQuickAdd] = useState(false)
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
  const addExpenseMutation = useMutation({
    mutationFn: async (data: QuickAddFormData) => {
      const formattedData: AddExpensePayload = {
        ...data,
        amount: parseFloat(data.amount),
        categoryId: parseInt(data.categoryId),
      }
      return await apiRequest("POST", "/api/household/expenses", formattedData)
    },
    onSuccess: () => {
      toast({
        title: "記帳成功",
        description: "支出已記錄",
      })
      invalidateHousehold()
      setShowQuickAdd(false)
      quickAddForm.reset()
    },
    onError: (e: Error) => {
      toast({
        title: "記帳失敗",
        description: e.message || "請重試",
        variant: "destructive",
      })
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
    if (!data.categoryId || !data.amount) {
      toast({
        title: "請填寫必要欄位",
        description: "請選擇分類並輸入金額",
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
          <h1 className="text-3xl font-bold">家用記帳</h1>
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>快速記帳</DialogTitle>
                <DialogDescription>快速記錄今天的支出</DialogDescription>
              </DialogHeader>
              <form onSubmit={quickAddForm.handleSubmit(onQuickAdd)} className="space-y-4">
                <div>
                  <Label htmlFor="amount">
                    金額 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="輸入金額"
                    onFocus={(e) => e.target.select()}
                    autoFocus
                    {...quickAddForm.register("amount", { required: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="categoryId">
                    分類 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    onValueChange={(value: string) => quickAddForm.setValue("categoryId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇分類" />
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
                <div>
                  <Label htmlFor="description">
                    備註 <span className="text-xs text-gray-400 font-normal">（選填）</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="簡單備註"
                    {...quickAddForm.register("description")}
                  />
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
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    拍照存證
                  </Button>
                  <span className="text-sm text-muted-foreground">有空再整理</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowQuickAdd(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={addExpenseMutation.isPending}>
                    記錄
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showBudgetSetup} onOpenChange={setShowBudgetSetup}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                設定預算
              </Button>
            </DialogTrigger>
            <DialogContent>
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
        </div>
      </div>

      {/* 預算超支即時警示 */}
      <BudgetOverrunAlertsCard />

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

function BudgetOverrunAlertsCard() {
  const { data } = useQuery<{
    items: Array<{
      itemId: number
      planName: string
      itemName: string
      planned: number
      actual: number
      usagePct: number
      overAmount: number
      severity: "warn" | "over" | "danger"
    }>
    totalCount: number
    dangerCount: number
    overCount: number
    warnCount: number
    message: string
  }>({
    queryKey: ["/api/budget/overrun-alerts"],
  })
  if (!data || data.totalCount === 0) return null

  const SEVERITY_STYLE: Record<string, { border: string; bg: string; bar: string; text: string }> =
    {
      danger: {
        border: "border-red-500",
        bg: "from-red-50 to-rose-50",
        bar: "bg-red-500",
        text: "text-red-700",
      },
      over: {
        border: "border-orange-400",
        bg: "from-orange-50 to-amber-50",
        bar: "bg-orange-500",
        text: "text-orange-700",
      },
      warn: {
        border: "border-yellow-400",
        bg: "from-yellow-50 to-amber-50",
        bar: "bg-yellow-500",
        text: "text-yellow-700",
      },
    }
  const headerStyle =
    data.dangerCount > 0
      ? SEVERITY_STYLE.danger
      : data.overCount > 0
        ? SEVERITY_STYLE.over
        : SEVERITY_STYLE.warn

  return (
    <Card className={`border-2 ${headerStyle.border} bg-gradient-to-br ${headerStyle.bg}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {data.dangerCount > 0 ? "🚨" : data.overCount > 0 ? "⚠️" : "⏳"} 預算即時警示
        </CardTitle>
        <CardDescription>{data.message}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.items.slice(0, 10).map((item) => {
            const sty = SEVERITY_STYLE[item.severity] ?? SEVERITY_STYLE.warn
            const widthPct = Math.min(150, item.usagePct)
            return (
              <div key={item.itemId} className="bg-white rounded-lg p-2">
                <div className="flex justify-between items-baseline mb-1 text-sm">
                  <div className="font-medium truncate">
                    <span className="text-xs text-muted-foreground mr-1">[{item.planName}]</span>
                    {item.itemName}
                  </div>
                  <div className={`font-bold ${sty.text}`}>{item.usagePct}%</div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`${sty.bar} h-2 transition-all`}
                    style={{ width: `${(widthPct / 150) * 100}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex justify-between">
                  <span>
                    實付 NT$ {Math.round(item.actual).toLocaleString()} / 預算 NT${" "}
                    {Math.round(item.planned).toLocaleString()}
                  </span>
                  {item.overAmount > 0 && (
                    <span className={`font-medium ${sty.text}`}>
                      超 NT$ {Math.round(item.overAmount).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
