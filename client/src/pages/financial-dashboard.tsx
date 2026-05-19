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
import { useQuery } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
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
} from "lucide-react"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"
import {
  BarChart,
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
    count: number
  }
  interface YtdData {
    income: number
    expense: number
    profit: number
    months: MonthRow[]
    breakdown?: Record<string, { expense: BreakdownItem[]; income: BreakdownItem[] }>
  }
  const ytdQuery = useQuery<YtdData>({
    queryKey: ["/api/dashboard/ytd"],
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
  const futureRows: MonthRow[] = useMemo(() => {
    if (!forecastQueries.data) return []
    return forecastQueries.data.map((f) => ({
      month: f.targetMonth,
      income: f.pointEstimate,
      expense: estimatedFutureExpense,
      profit: f.pointEstimate - estimatedFutureExpense,
    }))
  }, [forecastQueries.data, estimatedFutureExpense])

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

  // 圖表資料：歷史 + 未來
  const chartData = [
    ...ytd.months.slice(-6).map((m) => ({ ...m, isForecast: false })),
    ...futureRows.map((m) => ({ ...m, isForecast: true })),
  ]

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" />
          財務綜合儀表板
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          一頁看完今年到今 + 未來 3 月預估 + 各館明細 + 缺口警示
        </p>
      </div>

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
              <ComposedChart data={chartData}>
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
                    const bd = ytd.breakdown?.[label as string]
                    const incomeTop = bd?.income.slice(0, 5) ?? []
                    const expenseTop = bd?.expense.slice(0, 8) ?? []
                    const incomeRest = bd?.income.slice(5) ?? []
                    const expenseRest = bd?.expense.slice(8) ?? []
                    return (
                      <div className="bg-white border border-gray-200 rounded shadow-lg p-3 text-xs max-w-xs">
                        <div className="font-semibold mb-2 pb-1 border-b">
                          {label}
                          {row?.isForecast && <span className="ml-1 text-amber-600">(預估)</span>}
                        </div>
                        {/* payload 顯示主要數字 */}
                        <div className="space-y-0.5 mb-2">
                          {payload.map((p, i) => (
                            <div
                              key={i}
                              className="flex justify-between gap-3"
                              style={{ color: p.color }}
                            >
                              <span>{p.name}</span>
                              <span className="font-mono font-medium">
                                {formatMoney(Number(p.value))}
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* 分類 breakdown（過去月才有資料）*/}
                        {!row?.isForecast && bd && (
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
                                    <span className="font-mono">{formatMoney(it.amount)}</span>
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
                                    <span className="font-mono">{formatMoney(it.amount)}</span>
                                  </div>
                                ))}
                                {expenseRest.length > 0 && (
                                  <div className="text-[10px] text-gray-400 italic">
                                    + {expenseRest.length} 個其他分類
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                        {row?.isForecast && (
                          <div className="border-t pt-2 mt-2 text-[10px] text-gray-500">
                            預估：收入採季節性預測、支出用 YTD 月均
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
                <Bar dataKey="income" name="收入" fill="#3b82f6">
                  {chartData.map((d, i) => (
                    <Cell key={i} fill="#3b82f6" fillOpacity={d.isForecast ? 0.4 : 1} />
                  ))}
                </Bar>
                <Bar dataKey="expense" name="支出" fill="#ef4444">
                  {chartData.map((d, i) => (
                    <Cell key={i} fill="#ef4444" fillOpacity={d.isForecast ? 0.4 : 1} />
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
              return (
                <div
                  key={r.month}
                  className={`flex items-center gap-3 p-3 rounded border ${
                    r.profit >= 0 ? "border-gray-200" : "border-red-300 bg-red-50/30"
                  } flex-wrap`}
                >
                  <div className="w-20">
                    <div className="font-semibold">{r.month}</div>
                    <div className="text-xs text-gray-400">
                      {forecast && `${forecast.daysElapsed}/30 天`}
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">收入估計</div>
                      <div className="text-blue-700 font-semibold">{formatMoney(r.income)}</div>
                      {forecast && (
                        <div className="text-xs text-gray-400">
                          80% CI: {formatMoney(forecast.ci80.lower)}~
                          {formatMoney(forecast.ci80.upper)}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">支出預估</div>
                      <div className="text-red-700 font-semibold">{formatMoney(r.expense)}</div>
                      <div className="text-xs text-gray-400">
                        {ytdAvgMonthlyExpense > fixedMonthlyExpense
                          ? `YTD 月均（${templates.filter((t) => t.isActive).length} 模板 + HR / 一次性）`
                          : `${templates.filter((t) => t.isActive).length} 筆模板`}
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
                            : "bg-gray-100 text-gray-700"
                    }
                  >
                    信心 {forecast?.confidence ?? "—"}
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

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
            <li>
              ⏳ 未來預訂：可在「
              <a href="/forecast-input" className="text-indigo-600 underline">
                預訂金額輸入
              </a>
              」頁手動填、或由 PMS 系統推送
            </li>
            <li>📊 推估模型：「離月底 N 天累積比率」法、資料累積 3+ 月後信心會升級</li>
          </ul>
        </CardContent>
      </Card>

      <BackToTop />
    </div>
  )
}
