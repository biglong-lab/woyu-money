/**
 * 財務綜合儀表板（/financial-dashboard）
 *
 * 一頁串起所有預估資料：
 *  - 今年到今收支總覽 + 今年預估
 *  - 未來 3 個月預估（用 forecast seasonal + recurring templates）
 *  - 各館各類別月度明細
 *  - PMS 預訂 vs PM 已實現對照
 *  - 缺口警示
 */
import { useMemo, useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Trash2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  Info,
  Users,
  ExternalLink,
} from "lucide-react"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"
import OverviewTabs from "@/components/overview-tabs"
import { formatStatus, isCompletedStatus } from "@/lib/status-labels"
import { Link } from "wouter"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
  Cell,
  ReferenceLine,
} from "recharts"

interface SeasonalForecast {
  targetMonth: string
  pointEstimate: number
  ci80: { lower: number; upper: number }
  confidence: string
  daysElapsed: number
  currentAccumulated: number
}

interface Template {
  id: number
  templateName: string
  estimatedAmount: string
  isActive: boolean
}

interface MonthRow {
  month: string
  income: number
  expense: number
  profit: number
}

const formatMoney = (v: number) =>
  v >= 0 ? "$" + Math.round(v).toLocaleString() : "-$" + Math.round(-v).toLocaleString()

/**
 * 取「未來 N 個月」字串（本月不算未來、所以 offset 從 1 開始）
 * 避免 toISOString() 時區 bug（UTC+8 會把本地 5/1 轉成 UTC 4/30）
 */
function nextMonths(count: number): string[] {
  const now = new Date()
  return [...Array(count)].map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    return `${y}-${m}`
  })
}

interface Company {
  id: number
  name: string
}

export default function FinancialDashboardPage() {
  useDocumentTitle("財務綜合儀表板")

  // 單館篩選器（"all" = 合計、否則 PM company_id）
  // 注意：目前僅 forecast 區塊吃此參數、YTD 維持合計（payment_items 無 company_id）
  const [companyFilter, setCompanyFilter] = useState<"all" | number>("all")

  // 點擊明細 dialog
  const [detailQuery, setDetailQuery] = useState<{
    month: string
    category: string
    kind: "expense" | "income"
  } | null>(null)
  interface DetailItem {
    id?: number
    employee_id?: number
    employee_name?: string
    item_name?: string
    amount?: number
    paid_amount?: number
    total_cost?: number
    base_salary?: number
    employer_total?: number
    net_salary?: number
    start_date?: string
    status?: string
    source?: string
    recurringTemplateId?: number | null
    project_name?: string
    notes?: string
    cat_name?: string
    is_paid?: boolean
  }
  const detailFetch = useQuery<{ source: string; category: string; items: DetailItem[] }>({
    queryKey: detailQuery
      ? [
          `/api/dashboard/month-detail?month=${detailQuery.month}&category=${encodeURIComponent(
            detailQuery.category
          )}&kind=${detailQuery.kind}`,
        ]
      : [],
    enabled: !!detailQuery,
  })

  // 分類列表（讓使用者可改分類）
  interface CategoryOption {
    id: number
    categoryName: string
    categoryType: string
  }
  const { data: categories = [] } = useQuery<CategoryOption[]>({
    queryKey: ["/api/categories"],
    staleTime: 10 * 60_000,
  })

  const { toast } = useToast()

  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/ytd"] })
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("/api/dashboard/month-detail"),
    })
  }

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, categoryId }: { id: number; categoryId: number }) =>
      apiRequest("PATCH", `/api/payment/items/${id}`, {
        categoryId,
        changeReason: "從 dashboard 改分類",
      }),
    onSuccess: () => {
      toast({ title: "✅ 已更新分類" })
      invalidateDashboard()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/payment/items/${id}`, {
        changeReason: "從 dashboard 刪除（重複 / 不需要）",
      }),
    onSuccess: () => {
      toast({ title: "✅ 已軟刪除（可從回收筒恢復）" })
      invalidateDashboard()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const linkTemplateMutation = useMutation({
    mutationFn: ({
      itemId,
      templateId,
      markPaid,
    }: {
      itemId: number
      templateId: number
      markPaid: boolean
    }) =>
      apiRequest<{ ok: true; templateName: string; itemId: number }>(
        "POST",
        `/api/recurring-expense-templates/${templateId}/link-item/${itemId}`,
        { markPaid }
      ),
    onSuccess: (r) => {
      toast({
        title: "📎 已歸檔到模板",
        description: `連結到「${r.templateName}」`,
      })
      invalidateDashboard()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/pm-bridge/companies"],
    staleTime: 5 * 60_000, // 5 分鐘 cache（不太會變）
    retry: false,
  })

  // 過去 + 未來 3 月的預測
  const months = nextMonths(3)
  const companyIdParam = companyFilter === "all" ? "null" : String(companyFilter)

  const forecastQueries = useQuery<SeasonalForecast[]>({
    queryKey: [`/api/forecast/seasonal-batch`, months, companyIdParam],
    queryFn: async () => {
      const results = await Promise.all(
        months.map((m) =>
          apiRequest<SeasonalForecast>(
            "GET",
            `/api/forecast/seasonal?targetMonth=${m}&companyId=${companyIdParam}`
          )
        )
      )
      return results
    },
  })

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/recurring-expense-templates"],
  })

  // 計算固定每月支出（週期支出模板合計）
  const fixedMonthlyExpense = useMemo(
    () =>
      templates
        .filter((t) => t.isActive)
        .reduce((sum, t) => sum + parseFloat(t.estimatedAmount), 0),
    [templates]
  )

  // 今年迄今 YTD
  interface BreakdownItem {
    category: string
    amount: number
    actual?: number
    planned?: number
    count: number
  }
  interface ExtendedMonthRow extends MonthRow {
    incomeActual?: number
    incomePlanned?: number
    incomeForecast?: number // 後端從 seasonal forecast 算的「未來月收入預測」
    expenseActual?: number
    expensePlanned?: number
    profitActual?: number
  }
  interface YtdData {
    income: number
    expense: number
    profit: number
    months: ExtendedMonthRow[]
    breakdown?: Record<string, { expense: BreakdownItem[]; income: BreakdownItem[] }>
  }
  const ytdQuery = useQuery<YtdData>({
    queryKey: ["/api/dashboard/ytd"],
  })

  // 家庭記帳 summary（顯示「N 個待審 / 累計零用金」widget）
  interface FamilyDashboard {
    kids: Array<{ id: number; displayName: string; avatar: string }>
    totalReceived: number
    totalSaved: number
    pendingTaskCount: number
    toApproveCount: number
  }
  const { data: familyDash } = useQuery<FamilyDashboard>({
    queryKey: ["/api/family/dashboard"],
    staleTime: 30_000,
  })

  const ytd: YtdData = ytdQuery.data ?? {
    income: 0,
    expense: 0,
    profit: 0,
    months: [],
    breakdown: {},
  }

  // YTD 月均支出（含 HR / 一次性 / 模板）— 比純 templates 更全面
  const ytdAvgMonthlyExpense = useMemo(() => {
    const completedMonths = ytd.months.filter((m) => m.expense > 0)
    if (completedMonths.length === 0) return 0
    return ytd.expense / completedMonths.length
  }, [ytd])

  // 估計未來月支出：取「YTD 月均」與「模板合計」較大值（保守估）
  const estimatedFutureExpense = Math.max(fixedMonthlyExpense, ytdAvgMonthlyExpense)

  // 組裝未來 3 月預測表
  // 優先用 server ytd.months 內未來月（已含 forecast income + HR baseline + template_missing）
  // forecastQueries 只當 fallback（server 還沒回來時）
  const futureRows: ExtendedMonthRow[] = useMemo(() => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const fromYtd = ytd.months.filter((m) => m.month > currentMonth).slice(0, 3)
    if (fromYtd.length === 3) return fromYtd as ExtendedMonthRow[]

    // fallback：forecast batch + 月均支出
    if (!forecastQueries.data) return fromYtd as ExtendedMonthRow[]
    return forecastQueries.data.map((f) => ({
      month: f.targetMonth,
      income: f.pointEstimate,
      expense: estimatedFutureExpense,
      profit: f.pointEstimate - estimatedFutureExpense,
      incomeActual: 0,
      incomePlanned: f.pointEstimate,
      expenseActual: 0,
      expensePlanned: estimatedFutureExpense,
      profitActual: 0,
    }))
  }, [ytd.months, forecastQueries.data, estimatedFutureExpense])

  // 未來 3 月合計
  const futureTotal = futureRows.reduce(
    (acc, r) => ({
      income: acc.income + r.income,
      expense: acc.expense + r.expense,
      profit: acc.profit + r.profit,
    }),
    { income: 0, expense: 0, profit: 0 }
  )

  // 缺口警示（單月）
  const cashFlowGap = futureRows.find((r) => r.profit < 0)

  // 累積現金缺口：YTD 結餘 + 未來逐月累積、若任一月轉負
  const cumulativeWarning = useMemo(() => {
    if (futureRows.length === 0) return null
    let cumulative = ytd.profit
    const trajectory: Array<{ month: string; cumulative: number; profit: number }> = []
    let firstNegativeMonth: string | null = null
    for (const r of futureRows) {
      cumulative += r.profit
      trajectory.push({ month: r.month, cumulative, profit: r.profit })
      if (cumulative < 0 && !firstNegativeMonth) firstNegativeMonth = r.month
    }
    return { trajectory, firstNegativeMonth, finalCumulative: cumulative }
  }, [ytd.profit, futureRows])

  // 圖表資料：直接用 server months（已含 actual + planned 拆分）
  // 過去月：actual = 整月實際、planned = 0
  // 本月：actual = 截至今日已發生、planned = 月底未到日（如 5/31 大筆租金）
  // 未來月：actual = 0、planned = 已登錄合約 / 模板占位
  // isForecast：本月之後（月 > currentMonth）顯示半透明、加虛線分界
  const currentMonthClient = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })()
  // 以 currentMonth 為中心、最近 6 月（含本月）+ 未來 3 月 = 9 個月窗
  const chartWindow = (() => {
    const d = new Date()
    const from = new Date(d.getFullYear(), d.getMonth() - 5, 1)
    const to = new Date(d.getFullYear(), d.getMonth() + 3, 1)
    const ym = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`
    return { from: ym(from), to: ym(to) }
  })()
  const chartData = ytd.months
    .filter((m) => m.month >= chartWindow.from && m.month <= chartWindow.to)
    .map((m) => ({ ...m, isForecast: m.month > currentMonthClient }))

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4">
      <OverviewTabs />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" />
          財務綜合儀表板
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          一頁看完今年到今 + 未來 3 月預估 + 各館明細 + 缺口警示
        </p>
      </div>

      {/* PM 待確認金額警示（解釋 dashboard ytd vs revenue-forecast 累積差距） */}
      <PmPendingAlertCard />

      {/* 單館切換器（限 forecast 區塊、YTD 維持合計）*/}
      {companies.length > 0 && (
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3 flex-wrap">
            <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
            <span className="text-sm text-gray-600 shrink-0">未來預估範圍：</span>
            <div className="inline-flex flex-wrap rounded-md border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setCompanyFilter("all")}
                className={`px-3 h-8 text-xs sm:text-sm transition-colors ${
                  companyFilter === "all"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                合計
              </button>
              {companies.map((c) => {
                const active = companyFilter === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCompanyFilter(c.id)}
                    className={`px-3 h-8 text-xs sm:text-sm border-l border-gray-300 transition-colors ${
                      active
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {c.name}
                  </button>
                )
              })}
            </div>
            {companyFilter !== "all" && (
              <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                <Info className="h-3 w-3 mr-1" />
                YTD 暫維持合計
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* 累積現金缺口警示（更嚴重、YTD 結餘 + 未來累積會轉負）*/}
      {cumulativeWarning?.firstNegativeMonth && (
        <Card className="border-red-400 bg-red-50">
          <CardContent className="py-3 px-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 animate-pulse" />
            <div className="text-sm flex-1">
              <div className="font-semibold text-red-900 text-base">
                🚨 累積現金預估在 {cumulativeWarning.firstNegativeMonth} 轉負！
              </div>
              <div className="text-red-700 mt-1 text-xs space-y-0.5">
                <div>
                  起始現金（YTD 結餘）：
                  <strong>{formatMoney(ytd.profit)}</strong>
                </div>
                {cumulativeWarning.trajectory.map((t) => (
                  <div
                    key={t.month}
                    className={t.cumulative < 0 ? "text-red-900 font-semibold" : ""}
                  >
                    {t.month}：{t.profit >= 0 ? "+" : ""}
                    {formatMoney(t.profit)} → 累積 {formatMoney(t.cumulative)}
                    {t.cumulative < 0 && " ⚠️"}
                  </div>
                ))}
                <div className="mt-1.5 pt-1.5 border-t border-red-200">
                  建議：提前籌資、調整支出、或進「沙盤推演」找對策。
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 缺口警示 */}
      {cashFlowGap && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-3 px-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="text-sm flex-1">
              <div className="font-semibold text-red-900">
                ⚠️ {cashFlowGap.month} 預估虧損 {formatMoney(cashFlowGap.profit)}
              </div>
              <div className="text-red-700 mt-1 text-xs">
                收入 {formatMoney(cashFlowGap.income)} − 支出 {formatMoney(cashFlowGap.expense)}
                。建議：提前籌資或調整支出。可進「沙盤推演」測試。
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4 卡：今年迄今 + 未來 3 月 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3 px-3">
            <div className="text-xs text-blue-700">YTD 收入</div>
            <div className="text-xl font-bold text-blue-900">{formatMoney(ytd.income)}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 px-3">
            <div className="text-xs text-red-700">YTD 支出</div>
            <div className="text-xl font-bold text-red-900">{formatMoney(ytd.expense)}</div>
          </CardContent>
        </Card>
        <Card
          className={`${ytd.profit >= 0 ? "border-green-200 bg-green-50" : "border-red-300 bg-red-100"}`}
        >
          <CardContent className="py-3 px-3">
            <div className="text-xs text-gray-700">YTD 淨利</div>
            <div
              className={`text-xl font-bold ${ytd.profit >= 0 ? "text-green-900" : "text-red-900"}`}
            >
              {formatMoney(ytd.profit)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="py-3 px-3">
            <div className="text-xs text-indigo-700">未來 3 月預估淨利</div>
            <div
              className={`text-xl font-bold ${futureTotal.profit >= 0 ? "text-indigo-900" : "text-red-900"}`}
            >
              {formatMoney(futureTotal.profit)}
            </div>
            <div className="text-xs text-indigo-600 mt-0.5">
              預測信心：{forecastQueries.data?.[0]?.confidence ?? "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 歷史 + 預測整合圖 */}
      <Card>
        <CardContent className="py-4 px-3 sm:px-4">
          <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between flex-wrap gap-2">
            <span>月度收支走勢（最近 6 月 + 未來 3 月預估）</span>
            <span className="text-xs text-gray-400">虛線後 = 預估</span>
          </div>
          {chartData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
              載入中…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={chartData}
                onClick={(state: { activeLabel?: string } | null) => {
                  if (state?.activeLabel) {
                    const row = chartData.find((d) => d.month === state.activeLabel)
                    if (!row?.isForecast) {
                      setDetailQuery({ month: state.activeLabel, category: "", kind: "expense" })
                    }
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}K` : v)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const row = chartData.find((d) => d.month === label)
                    if (!row) return null
                    const bd = ytd.breakdown?.[label as string]
                    const incomeTop = bd?.income.slice(0, 5) ?? []
                    const expenseTop = bd?.expense.slice(0, 8) ?? []
                    const incomeRest = bd?.income.slice(5) ?? []
                    const expenseRest = bd?.expense.slice(8) ?? []
                    const ia = row.incomeActual ?? row.income ?? 0
                    const ip = row.incomePlanned ?? 0
                    const ea = row.expenseActual ?? row.expense ?? 0
                    const ep = row.expensePlanned ?? 0
                    return (
                      <div className="bg-white border border-gray-200 rounded shadow-lg p-3 text-xs max-w-xs">
                        <div className="font-semibold mb-2 pb-1 border-b">
                          {label}
                          {row.isForecast && <span className="ml-1 text-amber-600">(預估)</span>}
                        </div>
                        {/* 收入 / 支出 / 淨利 — 拆 actual + planned */}
                        <div className="space-y-1.5 mb-2 text-[11px]">
                          <div>
                            <div className="flex justify-between text-blue-700 font-medium">
                              <span>收入合計</span>
                              <span className="font-mono">{formatMoney(ia + ip)}</span>
                            </div>
                            {(ia > 0 || ip > 0) && (
                              <div className="pl-2 text-[10px] text-gray-500">
                                <div className="flex justify-between">
                                  <span>· 已發生</span>
                                  <span className="font-mono">{formatMoney(ia)}</span>
                                </div>
                                {ip > 0 && (
                                  <div className="flex justify-between text-blue-500">
                                    <span>
                                      {(row.incomeForecast ?? 0) > 0
                                        ? "· 季節性預測"
                                        : "· 預定/未到日"}
                                    </span>
                                    <span className="font-mono">{formatMoney(ip)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex justify-between text-red-700 font-medium">
                              <span>支出合計</span>
                              <span className="font-mono">{formatMoney(ea + ep)}</span>
                            </div>
                            {(ea > 0 || ep > 0) && (
                              <div className="pl-2 text-[10px] text-gray-500">
                                <div className="flex justify-between">
                                  <span>· 已發生</span>
                                  <span className="font-mono">{formatMoney(ea)}</span>
                                </div>
                                {ep > 0 && (
                                  <div className="flex justify-between text-red-500">
                                    <span>· 預定/未到日</span>
                                    <span className="font-mono">{formatMoney(ep)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between text-green-700 font-semibold pt-1 border-t">
                            <span>淨利</span>
                            <span className="font-mono">{formatMoney(ia + ip - ea - ep)}</span>
                          </div>
                        </div>
                        {/* 分類 breakdown */}
                        {bd && (
                          <>
                            {incomeTop.length > 0 && (
                              <div className="border-t pt-2 mt-2">
                                <div className="text-blue-700 font-medium mb-1">
                                  收入來源（前 5）
                                </div>
                                {incomeTop.map((it, i) => (
                                  <div
                                    key={i}
                                    className="flex justify-between text-gray-600 text-[10px]"
                                  >
                                    <span className="truncate max-w-[140px]">{it.category}</span>
                                    <span className="font-mono">
                                      {formatMoney(it.amount)}
                                      {(it.planned ?? 0) > 0 && (
                                        <span className="text-blue-400 ml-1">
                                          (預{formatMoney(it.planned ?? 0)})
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                                {incomeRest.length > 0 && (
                                  <div className="text-[10px] text-gray-400 italic">
                                    + {incomeRest.length} 個其他來源
                                  </div>
                                )}
                              </div>
                            )}
                            {expenseTop.length > 0 && (
                              <div className="border-t pt-2 mt-2">
                                <div className="text-red-700 font-medium mb-1">
                                  支出分類（前 8）
                                </div>
                                {expenseTop.map((it, i) => (
                                  <div
                                    key={i}
                                    className="flex justify-between text-gray-600 text-[10px]"
                                  >
                                    <span className="truncate max-w-[140px]">{it.category}</span>
                                    <span className="font-mono">
                                      {formatMoney(it.amount)}
                                      {(it.planned ?? 0) > 0 && (
                                        <span className="text-red-400 ml-1">
                                          (預{formatMoney(it.planned ?? 0)})
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                                {expenseRest.length > 0 && (
                                  <div className="text-[10px] text-gray-400 italic">
                                    + {expenseRest.length} 個其他分類
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="border-t pt-2 mt-2 text-[10px] text-blue-600 italic">
                              👆 點柱子可查看分類明細
                            </div>
                          </>
                        )}
                        {row.isForecast && (
                          <div className="border-t pt-2 mt-2 text-[10px] text-amber-600">
                            未來月：已登錄合約 / 模板占位、收入採季節性預測
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {/* 今日分界線（最後一個歷史 vs 第一個預測之間）*/}
                {chartData.find((d) => d.isForecast) && (
                  <ReferenceLine
                    x={chartData.find((d) => d.isForecast)?.month}
                    stroke="#9ca3af"
                    strokeDasharray="3 3"
                    label={{ value: "預估", position: "top", fontSize: 10, fill: "#6b7280" }}
                  />
                )}
                {/* 收入：實際（深藍） + 預定（淺藍）堆疊 */}
                <Bar dataKey="incomeActual" stackId="income" name="收入(實際)" fill="#3b82f6">
                  {chartData.map((d, i) => (
                    <Cell key={i} fill="#3b82f6" fillOpacity={d.isForecast ? 0.4 : 1} />
                  ))}
                </Bar>
                <Bar dataKey="incomePlanned" stackId="income" name="收入(預定)" fill="#93c5fd">
                  {chartData.map((d, i) => (
                    <Cell key={i} fill="#93c5fd" fillOpacity={d.isForecast ? 0.5 : 0.75} />
                  ))}
                </Bar>
                {/* 支出：實際（深紅） + 預定（淺紅）堆疊 */}
                <Bar dataKey="expenseActual" stackId="expense" name="支出(實際)" fill="#ef4444">
                  {chartData.map((d, i) => (
                    <Cell key={i} fill="#ef4444" fillOpacity={d.isForecast ? 0.4 : 1} />
                  ))}
                </Bar>
                <Bar dataKey="expensePlanned" stackId="expense" name="支出(預定)" fill="#fca5a5">
                  {chartData.map((d, i) => (
                    <Cell key={i} fill="#fca5a5" fillOpacity={d.isForecast ? 0.5 : 0.75} />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="淨利"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props as {
                      cx: number
                      cy: number
                      payload: { isForecast: boolean }
                    }
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill={payload.isForecast ? "transparent" : "#10b981"}
                        stroke="#10b981"
                        strokeWidth={payload.isForecast ? 2 : 0}
                      />
                    )
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 未來 3 月詳細 */}
      <Card>
        <CardContent className="py-4 px-3 sm:px-4">
          <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-600" />
            未來 3 個月詳細預估
          </div>
          <div className="space-y-2">
            {futureRows.map((r, idx) => {
              const forecast = forecastQueries.data?.[idx]
              const hasForecastIncome = (r.incomeForecast ?? 0) > 0
              const hasHrEstimate =
                ((r as ExtendedMonthRow & { expenseHrEstimate?: number }).expenseHrEstimate ?? 0) >
                0
              return (
                <div
                  key={r.month}
                  className={`flex items-center gap-3 p-3 rounded border ${
                    r.profit >= 0 ? "border-gray-200" : "border-red-300 bg-red-50/30"
                  } flex-wrap`}
                >
                  <div className="w-20">
                    <div className="font-semibold">{r.month}</div>
                    <div className="text-xs text-gray-400">未來月</div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">收入估計</div>
                      <div className="text-blue-700 font-semibold">{formatMoney(r.income)}</div>
                      {hasForecastIncome ? (
                        <div className="text-xs text-blue-500">季節性預測 / 歷史平均</div>
                      ) : forecast ? (
                        <div className="text-xs text-gray-400">
                          80% CI: {formatMoney(forecast.ci80.lower)}~
                          {formatMoney(forecast.ci80.upper)}
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">支出預估</div>
                      <div className="text-red-700 font-semibold">{formatMoney(r.expense)}</div>
                      <div className="text-xs text-gray-400">
                        {hasHrEstimate ? "租金 + 模板 + HR baseline + 一般" : "租金 + 模板 + 一般"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">淨利</div>
                      <div
                        className={`font-bold ${r.profit >= 0 ? "text-green-700" : "text-red-700"}`}
                      >
                        {r.profit >= 0 ? (
                          <TrendingUp className="inline w-3 h-3 mr-0.5" />
                        ) : (
                          <TrendingDown className="inline w-3 h-3 mr-0.5" />
                        )}
                        {formatMoney(r.profit)}
                      </div>
                    </div>
                  </div>
                  <Badge
                    className={
                      forecast?.confidence === "high"
                        ? "bg-green-100 text-green-800"
                        : forecast?.confidence === "medium"
                          ? "bg-blue-100 text-blue-800"
                          : forecast?.confidence === "low"
                            ? "bg-amber-100 text-amber-800"
                            : hasForecastIncome
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-700"
                    }
                  >
                    {hasForecastIncome ? "預估" : `信心 ${forecast?.confidence ?? "—"}`}
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 家庭記帳 widget（小孩模式整合）*/}
      {familyDash && familyDash.kids && familyDash.kids.length > 0 && (
        <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-orange-50">
          <CardContent className="py-4 px-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-pink-600" />
                <span className="font-semibold text-gray-800">家庭記帳 · 小孩模式</span>
                <span className="text-xs text-gray-500">{familyDash.kids.length} 位成員</span>
              </div>
              <Link href="/family">
                <a className="text-xs text-pink-700 hover:text-pink-900 font-medium inline-flex items-center gap-1">
                  進入家庭模組
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link href="/family">
                <a className="block bg-white rounded-lg border border-pink-200 p-3 hover:border-pink-400 transition">
                  <div className="text-xs text-gray-500 mb-1">待審任務</div>
                  <div className="text-2xl font-bold text-pink-700">
                    {familyDash.toApproveCount}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">已 submit 等家長</div>
                </a>
              </Link>
              <div className="bg-white rounded-lg border border-pink-200 p-3">
                <div className="text-xs text-gray-500 mb-1">進行中任務</div>
                <div className="text-2xl font-bold text-amber-700">
                  {Math.max(0, familyDash.pendingTaskCount - familyDash.toApproveCount)}
                </div>
                <div className="text-xs text-gray-400 mt-1">已派、等小孩做</div>
              </div>
              <div className="bg-white rounded-lg border border-pink-200 p-3">
                <div className="text-xs text-gray-500 mb-1">累計零用金</div>
                <div className="text-2xl font-bold text-green-700">
                  ${Number(familyDash.totalReceived).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 mt-1">所有小孩 total</div>
              </div>
              <div className="bg-white rounded-lg border border-pink-200 p-3">
                <div className="text-xs text-gray-500 mb-1">儲蓄罐合計</div>
                <div className="text-2xl font-bold text-blue-700">
                  ${Number(familyDash.totalSaved).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 mt-1">save jar 累積</div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {familyDash.kids.map((k) => (
                <Link key={k.id} href={`/family/kid/${k.id}`}>
                  <a className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-pink-200 text-xs hover:border-pink-400 transition">
                    <span className="text-base">{k.avatar}</span>
                    <span className="text-gray-700">{k.displayName}</span>
                  </a>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 資料來源狀態 */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            預測引擎資料來源
          </div>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>✅ 已實現收入：每日從 PM 系統拉 daily_revenue_snapshots</li>
            <li>✅ 已實現支出：手動 + AI 掃描 + PM 帳單 webhook + 週期性模板自動產出</li>
            <li>✅ 人事成本：v3 拆 7 筆（薪資/勞保/健保/勞退 × 雇主/員工自付）</li>
            <li>⏳ 未來預訂：由 PMS 系統自動推送（無需手動）</li>
            <li>📊 推估模型：「離月底 N 天累積比率」法、資料累積 3+ 月後信心會升級</li>
          </ul>
        </CardContent>
      </Card>

      {/* 月份明細 Dialog */}
      <Dialog
        open={!!detailQuery}
        onOpenChange={(open) => {
          if (!open) setDetailQuery(null)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailQuery?.month} 月明細
              {detailQuery?.category && `：${detailQuery.category}`}
            </DialogTitle>
            <DialogDescription>
              {detailQuery?.category
                ? `該分類下的所有項目（按金額大小排序）`
                : `點擊任一分類可查看詳細項目`}
            </DialogDescription>
          </DialogHeader>

          {/* 分類列表（無 category 時顯示）*/}
          {detailQuery &&
            !detailQuery.category &&
            (() => {
              const bd = ytd.breakdown?.[detailQuery.month]
              if (!bd) return <div className="text-sm text-gray-400">無資料</div>
              return (
                <div className="space-y-4">
                  {bd.expense.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-red-700 mb-2">
                        支出分類（{bd.expense.length} 個）
                      </div>
                      <div className="space-y-1">
                        {bd.expense.map((it) => (
                          <button
                            key={it.category}
                            type="button"
                            onClick={() =>
                              setDetailQuery({
                                month: detailQuery.month,
                                category: it.category,
                                kind: "expense",
                              })
                            }
                            className="w-full flex justify-between items-center px-3 py-2 hover:bg-red-50 rounded text-sm transition group"
                          >
                            <span className="flex items-center gap-2">
                              <span>{it.category}</span>
                              <span className="text-xs text-gray-400">({it.count} 筆)</span>
                            </span>
                            <span className="font-mono text-red-700 group-hover:underline">
                              {formatMoney(it.amount)} ›
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {bd.income.length > 0 && (
                    <div className="border-t pt-3">
                      <div className="text-sm font-semibold text-blue-700 mb-2">
                        收入來源（{bd.income.length} 個）
                      </div>
                      <div className="space-y-1">
                        {bd.income.map((it) => (
                          <button
                            key={it.category}
                            type="button"
                            onClick={() =>
                              setDetailQuery({
                                month: detailQuery.month,
                                category: it.category,
                                kind: "income",
                              })
                            }
                            className="w-full flex justify-between items-center px-3 py-2 hover:bg-blue-50 rounded text-sm transition group"
                          >
                            <span className="flex items-center gap-2">
                              <span>{it.category}</span>
                              <span className="text-xs text-gray-400">({it.count} 筆)</span>
                            </span>
                            <span className="font-mono text-blue-700 group-hover:underline">
                              {formatMoney(it.amount)} ›
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

          {/* 分類明細 list */}
          {detailQuery?.category && (
            <div className="space-y-1">
              {detailFetch.isLoading && (
                <div className="text-sm text-gray-400 py-4 text-center">載入中…</div>
              )}
              {detailFetch.isError && (
                <div className="text-sm text-red-600 bg-red-50 rounded p-3 text-center">
                  ⚠️ 載入失敗：{(detailFetch.error as Error)?.message ?? "未知錯誤"}
                </div>
              )}
              {detailFetch.data?.items.length === 0 && (
                <div className="text-sm text-gray-400 py-4 text-center">該分類無項目</div>
              )}
              {detailFetch.data?.source === "monthly_hr_costs" && (
                <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-2">
                  資料來自 HR 系統（monthly_hr_costs）、含 8 員工完整薪資 + 雇主負擔
                </div>
              )}
              {detailFetch.data?.items.map((it, i) => {
                const isPaymentItem =
                  detailFetch.data?.source === "payment_items" && typeof it.id === "number"
                return (
                  <div key={i} className="py-2 px-3 border-b last:border-0 text-sm space-y-1">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {it.employee_name ?? it.item_name ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500 flex gap-2 flex-wrap mt-0.5">
                          {it.project_name && <span>專案：{it.project_name}</span>}
                          {it.start_date && <span>日期：{String(it.start_date).slice(0, 10)}</span>}
                          {it.status && (
                            <span
                              className={
                                isCompletedStatus(it.status) ? "text-green-700" : "text-amber-700"
                              }
                            >
                              {formatStatus(it.status)}
                            </span>
                          )}
                          {it.is_paid !== undefined && (
                            <span className={it.is_paid ? "text-green-700" : "text-amber-700"}>
                              {it.is_paid ? "已付" : "未付"}
                            </span>
                          )}
                        </div>
                        {it.notes && (
                          <div className="text-[10px] text-gray-400 mt-1 italic line-clamp-2">
                            {it.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-semibold">
                          {formatMoney(it.amount ?? it.total_cost ?? 0)}
                        </div>
                        {it.employer_total !== undefined && (
                          <div className="text-[10px] text-gray-400">
                            雇主負擔 {formatMoney(it.employer_total)}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 改分類 / 歸到模板 / 刪除（僅 payment_items 來源）*/}
                    {isPaymentItem && (
                      <div className="space-y-1 pt-1">
                        {it.recurringTemplateId && (
                          <div className="text-[10px] text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 inline-block">
                            📎 已歸檔模板 #{it.recurringTemplateId}
                          </div>
                        )}
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] text-gray-400">改分類：</span>
                          <Select
                            onValueChange={(v) => {
                              const catId = Number(v)
                              if (!Number.isFinite(catId) || !it.id) return
                              updateCategoryMutation.mutate({ id: it.id, categoryId: catId })
                            }}
                            disabled={updateCategoryMutation.isPending}
                          >
                            <SelectTrigger className="h-6 text-[10px] w-28">
                              <SelectValue placeholder="選擇..." />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                  {c.categoryName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-[10px] text-gray-400 ml-1">歸模板：</span>
                          <Select
                            onValueChange={(v) => {
                              if (!it.id) return
                              const [tid, mark] = v.split(":")
                              linkTemplateMutation.mutate({
                                itemId: it.id,
                                templateId: Number(tid),
                                markPaid: mark === "paid",
                              })
                            }}
                            disabled={linkTemplateMutation.isPending}
                          >
                            <SelectTrigger className="h-6 text-[10px] w-36">
                              <SelectValue placeholder="選模板..." />
                            </SelectTrigger>
                            <SelectContent>
                              {templates
                                .filter((t) => t.isActive)
                                .map((t) => (
                                  <SelectItem key={t.id} value={`${t.id}:paid`}>
                                    {t.templateName}（標已付）
                                  </SelectItem>
                                ))}
                              {templates
                                .filter((t) => t.isActive)
                                .map((t) => (
                                  <SelectItem key={`${t.id}-keep`} value={`${t.id}:keep`}>
                                    {t.templateName}（保留狀態）
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            onClick={() => {
                              if (it.id && confirm("確定刪除這筆？（軟刪除、可從回收筒復原）")) {
                                deleteItemMutation.mutate(it.id)
                              }
                            }}
                            disabled={deleteItemMutation.isPending}
                            className="ml-auto text-red-600 hover:bg-red-50 rounded p-1"
                            title="軟刪除"
                            aria-label="刪除此項"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {detailFetch.data && detailFetch.data.items.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setDetailQuery({
                      month: detailQuery.month,
                      category: "",
                      kind: detailQuery.kind,
                    })
                  }
                  className="w-full text-xs text-blue-600 hover:underline pt-2"
                >
                  ← 返回該月分類列表
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BackToTop />
    </div>
  )
}

function PmPendingAlertCard() {
  const { data } = useQuery<{
    pendingCount: number
    pendingAmount: number
    oldestPendingDate: string | null
    latestPendingDate: string | null
    severity: "ok" | "warn" | "alert"
    message: string
  }>({
    queryKey: ["/api/dashboard/pm-pending-summary"],
    refetchInterval: 5 * 60 * 1000,
  })
  if (!data || data.pendingCount === 0) return null

  const isAlert = data.severity === "alert"
  return (
    <Card
      className={`border-2 ${isAlert ? "border-red-400 bg-red-50" : "border-orange-300 bg-orange-50"}`}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="text-2xl shrink-0">{isAlert ? "🚨" : "⏳"}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{data.message}</div>
            <div className="text-xs text-muted-foreground mt-1">
              這些是 PM 系統已收的款項、但 Money 端尚未人工確認。 「收入合計」只算已確認部分、差距 =
              待確認金額。
              {data.oldestPendingDate && (
                <span className="ml-1">最早待確認：{data.oldestPendingDate.slice(0, 10)}</span>
              )}
            </div>
          </div>
          <a
            href="/income/inbox"
            className="shrink-0 px-3 py-1.5 bg-white border border-current rounded text-xs font-medium hover:bg-gray-50"
          >
            去確認 →
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
