/**
 * 家用預算頁卡片元件（自 household-budget.tsx 機械拆分，2026-07-03 Phase 4.3）
 * 超支警示 / 預算建議 / 月度比較 / 變更歷程 / 異常偵測 / AI 洞察 / 年度回顧
 */
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function BudgetOverrunAlertsCard() {
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

export function BudgetSuggestionCard({
  selectedMonth,
  currentBudget,
  onApply,
}: {
  selectedMonth: string
  currentBudget: number
  onApply: (amt: number) => void
}) {
  // 算上月（避免時區、用字串切）
  const [y, m] = selectedMonth.split("-").map(Number)
  const prevDate = new Date(y, m - 2, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`

  const { data: prevStats } = useQuery<{
    totalSpent: number
    count: number
    budgetAmount: number
  }>({
    queryKey: [`/api/household/stats?month=${prevMonth}`],
    staleTime: 10 * 60 * 1000,
  })

  if (!prevStats || prevStats.totalSpent === 0) return null

  // 建議：上月實際 × 1.05（5% 緩衝、抓未來預估）
  const suggested = Math.round(prevStats.totalSpent * 1.05)
  const diff = suggested - currentBudget
  const isSet = currentBudget > 0
  const isLowerThanLastMonth = isSet && currentBudget < prevStats.totalSpent

  return (
    <Card className="border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">📊 月初預算建議</CardTitle>
        <CardDescription>
          依上月 {prevMonth} 實際花費 NT$ {Math.round(prevStats.totalSpent).toLocaleString()}（共{" "}
          {prevStats.count} 筆）
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">上月實際</div>
            <div className="font-bold text-rose-700">
              NT$ {Math.round(prevStats.totalSpent).toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center border-2 border-indigo-300">
            <div className="text-[10px] text-gray-500">建議本月（×1.05）</div>
            <div className="font-bold text-indigo-700">NT$ {suggested.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">目前設定</div>
            <div className={`font-bold ${isSet ? "text-emerald-700" : "text-gray-400"}`}>
              {isSet ? `NT$ ${currentBudget.toLocaleString()}` : "未設定"}
            </div>
          </div>
        </div>
        {isLowerThanLastMonth && (
          <div className="text-xs text-orange-600 mb-2">
            ⚠️ 目前預算 NT$ {currentBudget.toLocaleString()} 低於上月實際、容易超支
          </div>
        )}
        {Math.abs(diff) > 100 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApply(suggested)}
            className="w-full gap-2 text-indigo-700 border-indigo-300 hover:bg-indigo-50"
          >
            💡 套用建議 NT$ {suggested.toLocaleString()}
            {diff !== 0 && (
              <span className="text-xs text-gray-500">
                （{diff > 0 ? "+" : ""}
                {diff.toLocaleString()}）
              </span>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function MonthlyComparisonCard({
  selectedMonth,
  currentSpent,
}: {
  selectedMonth: string
  currentSpent: number
}) {
  // 算過去 5 個月（不含本月）
  const [y, m] = selectedMonth.split("-").map(Number)
  const pastMonths: string[] = []
  for (let i = 1; i <= 5; i++) {
    const d = new Date(y, m - 1 - i, 1)
    pastMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  // 一次拉 5 個月 stats
  const queries = pastMonths.map((mo) => ({
    queryKey: [`/api/household/stats?month=${mo}`],
    staleTime: 10 * 60 * 1000,
  }))

  const { data: prevStats } = useQuery<{ totalSpent: number }>({
    queryKey: queries[0].queryKey,
    staleTime: queries[0].staleTime,
  })
  const { data: m2 } = useQuery<{ totalSpent: number }>({
    queryKey: queries[1].queryKey,
    staleTime: queries[1].staleTime,
  })
  const { data: m3 } = useQuery<{ totalSpent: number }>({
    queryKey: queries[2].queryKey,
    staleTime: queries[2].staleTime,
  })
  const { data: m4 } = useQuery<{ totalSpent: number }>({
    queryKey: queries[3].queryKey,
    staleTime: queries[3].staleTime,
  })
  const { data: m5 } = useQuery<{ totalSpent: number }>({
    queryKey: queries[4].queryKey,
    staleTime: queries[4].staleTime,
  })

  const series = [
    m5?.totalSpent ?? 0,
    m4?.totalSpent ?? 0,
    m3?.totalSpent ?? 0,
    m2?.totalSpent ?? 0,
    prevStats?.totalSpent ?? 0,
    currentSpent,
  ]
  if (series.every((v) => v === 0)) return null

  // 同期比較：今天是本月第 N 天、上月同 N 天累計
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m
  const dayOfMonth = isCurrentMonth ? today.getDate() : 0
  // 簡化：直接用上月實際全月 / 30 * dayOfMonth 估「同期」
  const prevTotal = prevStats?.totalSpent ?? 0
  const prevSamePeriod =
    isCurrentMonth && dayOfMonth > 0 ? Math.round((prevTotal / 30) * dayOfMonth) : prevTotal
  const diff = currentSpent - prevSamePeriod
  const diffPct = prevSamePeriod > 0 ? Math.round((diff / prevSamePeriod) * 100) : 0

  // sparkline max
  const max = Math.max(...series, 1)
  const labels = [...pastMonths.slice().reverse(), selectedMonth]

  const isUp = diff > 0
  const trendEmoji = Math.abs(diffPct) < 5 ? "≈" : isUp ? "📈" : "📉"
  const trendColor =
    Math.abs(diffPct) < 5 ? "text-gray-600" : isUp ? "text-rose-600" : "text-emerald-600"

  return (
    <Card className="border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-sky-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">📊 本月 vs 上月同期</CardTitle>
        <CardDescription>
          {isCurrentMonth
            ? `本月第 ${dayOfMonth} 天、跟上月同期比較`
            : `${selectedMonth} 全月 vs 上月 (${pastMonths[0]})`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">本月已花</div>
            <div className="font-bold text-cyan-700">
              NT$ {Math.round(currentSpent).toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">上月同期</div>
            <div className="font-bold text-gray-700">
              NT$ {Math.round(prevSamePeriod).toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">差異</div>
            <div className={`font-bold ${trendColor}`}>
              {trendEmoji} {isUp ? "+" : ""}
              {diffPct}%
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-2">
          <div className="text-[10px] text-gray-500 mb-1">過去 6 個月走勢</div>
          <div className="flex items-end gap-1 h-12">
            {series.map((v, i) => {
              const h = (v / max) * 100
              const isCurrent = i === series.length - 1
              return (
                <div key={labels[i]} className="flex-1 flex flex-col items-center justify-end">
                  <div
                    className={`w-full rounded-t transition-all ${
                      v > 0
                        ? isCurrent
                          ? "bg-gradient-to-t from-cyan-400 to-cyan-600"
                          : "bg-gray-300"
                        : "bg-gray-100"
                    }`}
                    style={{ height: `${Math.max(2, h)}%` }}
                    title={`${labels[i]}: NT$ ${Math.round(v).toLocaleString()}`}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-[8px] text-gray-400 mt-1">
            {labels.map((l) => (
              <span key={l} className="flex-1 text-center">
                {l.slice(5)}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface BudgetChange {
  id: number
  year: number
  month: number
  oldAmount: string | null
  newAmount: string
  diffAmount: string | null
  changedByUserId: number | null
  changedByName: string | null
  reason: string | null
  action: "create" | "update"
  createdAt: string
  username: string | null
  userFullName: string | null
}

export function BudgetChangesCard({ selectedMonth }: { selectedMonth: string }) {
  const { data = [], isLoading } = useQuery<BudgetChange[]>({
    queryKey: [`/api/household/budget/changes?month=${selectedMonth}`],
  })

  if (isLoading || data.length === 0) return null

  return (
    <Card className="border-2 border-slate-300 bg-gradient-to-br from-slate-50 to-gray-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">📜 預算變更歷程</CardTitle>
        <CardDescription>
          {selectedMonth} · 共 {data.length} 次變更（最近 50 筆）
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((c) => {
            const who = c.userFullName || c.username || c.changedByName || "—"
            const ts = new Date(c.createdAt).toLocaleString("zh-TW", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
            const isCreate = c.action === "create"
            const newAmt = Math.round(parseFloat(c.newAmount)).toLocaleString()
            const oldAmt = c.oldAmount ? Math.round(parseFloat(c.oldAmount)).toLocaleString() : null
            const diff = c.diffAmount ? Math.round(parseFloat(c.diffAmount)) : 0
            return (
              <div
                key={c.id}
                className="rounded-lg border bg-white p-2"
                data-testid={`budget-change-${c.id}`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge
                      variant="outline"
                      className={
                        isCreate
                          ? "border-emerald-300 text-emerald-700"
                          : "border-blue-300 text-blue-700"
                      }
                    >
                      {isCreate ? "✨ 新建" : "✏️ 修改"}
                    </Badge>
                    <span className="font-medium">{who}</span>
                    <span className="text-[10px] text-gray-400">{ts}</span>
                  </div>
                  <div className="text-sm font-bold">
                    {oldAmt ? (
                      <>
                        <span className="text-gray-500 line-through">NT$ {oldAmt}</span>
                        <span className="mx-1 text-gray-400">→</span>
                        <span className="text-gray-900">NT$ {newAmt}</span>
                        <span
                          className={`ml-2 text-xs ${diff > 0 ? "text-rose-600" : diff < 0 ? "text-emerald-600" : "text-gray-500"}`}
                        >
                          {diff > 0 ? "+" : ""}
                          {diff.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-900">NT$ {newAmt}</span>
                    )}
                  </div>
                </div>
                {c.reason && (
                  <div className="text-xs text-gray-600 mt-1 pl-2 border-l-2 border-slate-300">
                    💬 {c.reason}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

interface Anomaly {
  type: "outlier" | "duplicate" | "missing"
  severity: "info" | "warn" | "alert"
  title: string
  detail: string
  expenseId?: number
}
interface AnomaliesResponse {
  month: string
  count: number
  anomalies: Anomaly[]
}

export function AnomaliesCard({ selectedMonth }: { selectedMonth: string }) {
  const { data, isLoading } = useQuery<AnomaliesResponse>({
    queryKey: [`/api/household/anomalies?month=${selectedMonth}`],
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading || !data || data.anomalies.length === 0) return null

  const sevBorder: Record<Anomaly["severity"], string> = {
    info: "border-blue-200 bg-blue-50",
    warn: "border-amber-200 bg-amber-50",
    alert: "border-rose-200 bg-rose-50",
  }
  const sevText: Record<Anomaly["severity"], string> = {
    info: "text-blue-900",
    warn: "text-amber-900",
    alert: "text-rose-900",
  }
  const typeIcon: Record<Anomaly["type"], string> = {
    outlier: "🎯",
    duplicate: "🔁",
    missing: "📭",
  }

  return (
    <Card className="border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">🚨 異常偵測</CardTitle>
        <CardDescription>
          {data.month} · 偵測到 {data.count} 個可能需要檢查的項目
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.anomalies.map((a, i) => (
            <div
              key={i}
              className={`rounded-lg border p-2 ${sevBorder[a.severity]}`}
              data-testid={`anomaly-${a.type}-${i}`}
            >
              <div className={`flex items-center gap-2 font-medium text-sm ${sevText[a.severity]}`}>
                <span className="text-base">{typeIcon[a.type]}</span>
                {a.title}
              </div>
              <div className="text-xs text-gray-600 mt-1 pl-7">{a.detail}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface AIInsight {
  tone: "info" | "good" | "warn" | "alert"
  icon: string
  title: string
  detail: string
}
interface AIInsightsResponse {
  month: string
  count: number
  insights: AIInsight[]
}

export function AIInsightsCard({ selectedMonth }: { selectedMonth: string }) {
  const { data, isLoading } = useQuery<AIInsightsResponse>({
    queryKey: [`/api/household/ai-insights?month=${selectedMonth}`],
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading || !data || data.insights.length === 0) return null

  const toneClass: Record<AIInsight["tone"], string> = {
    info: "border-blue-200 bg-blue-50",
    good: "border-emerald-200 bg-emerald-50",
    warn: "border-amber-200 bg-amber-50",
    alert: "border-rose-200 bg-rose-50",
  }
  const toneText: Record<AIInsight["tone"], string> = {
    info: "text-blue-900",
    good: "text-emerald-900",
    warn: "text-amber-900",
    alert: "text-rose-900",
  }

  return (
    <Card className="border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-purple-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">🤖 本月消費觀察</CardTitle>
        <CardDescription>
          {data.month} · 自動分析 {data.count} 條洞察
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.insights.map((ins, i) => (
            <div
              key={i}
              className={`rounded-lg border p-2 ${toneClass[ins.tone]}`}
              data-testid={`insight-${ins.tone}-${i}`}
            >
              <div className={`flex items-center gap-2 font-medium text-sm ${toneText[ins.tone]}`}>
                <span className="text-base">{ins.icon}</span>
                {ins.title}
              </div>
              <div className="text-xs text-gray-600 mt-1 pl-7">{ins.detail}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface YearlyItem {
  month: string
  spent: number
  budget: number
  overrun: boolean
  usagePct: number | null
}
interface YearlyOverview {
  endMonth: string
  items: YearlyItem[]
  summary: {
    totalSpent: number
    totalBudget: number
    avgMonthly: number
    overrunMonths: number
    maxSpent: number
    monthsTracked: number
  }
}

export function YearlyOverviewCard({ selectedMonth }: { selectedMonth: string }) {
  const { data, isLoading } = useQuery<YearlyOverview>({
    queryKey: [`/api/household/yearly-overview?endMonth=${selectedMonth}`],
    staleTime: 10 * 60 * 1000,
  })

  if (isLoading || !data) return null
  if (data.summary.monthsTracked === 0) return null

  const max = Math.max(data.summary.maxSpent, 1)
  const accCoverage =
    data.summary.totalBudget > 0
      ? Math.round((data.summary.totalSpent / data.summary.totalBudget) * 100)
      : null

  return (
    <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-fuchsia-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          📅 年度回顧（過去 12 個月）
        </CardTitle>
        <CardDescription>
          至 {data.endMonth} 為止、追蹤 {data.summary.monthsTracked} 個月
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">12 月累計花費</div>
            <div className="font-bold text-purple-700">
              NT$ {data.summary.totalSpent.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">12 月累計預算</div>
            <div className="font-bold text-gray-700">
              NT$ {data.summary.totalBudget.toLocaleString()}
            </div>
            {accCoverage !== null && (
              <div
                className={`text-[10px] ${
                  accCoverage > 100 ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                使用 {accCoverage}%
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">平均月花費</div>
            <div className="font-bold text-indigo-700">
              NT$ {data.summary.avgMonthly.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">超支月數</div>
            <div
              className={`font-bold ${
                data.summary.overrunMonths > 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {data.summary.overrunMonths} / 12
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-3">
          <div className="text-[10px] text-gray-500 mb-2">月度花費（紅色表示超支）</div>
          <div className="flex items-end gap-1 h-24">
            {data.items.map((it) => {
              const h = (it.spent / max) * 100
              const isCurrent = it.month === selectedMonth
              return (
                <div key={it.month} className="flex-1 flex flex-col items-center justify-end group">
                  <div
                    className={`w-full rounded-t transition-all relative ${
                      it.spent > 0
                        ? it.overrun
                          ? "bg-gradient-to-t from-rose-400 to-rose-600"
                          : isCurrent
                            ? "bg-gradient-to-t from-purple-400 to-purple-600"
                            : "bg-gradient-to-t from-indigo-300 to-indigo-500"
                        : "bg-gray-100"
                    }`}
                    style={{ height: `${Math.max(2, h)}%` }}
                    title={`${it.month}: NT$ ${it.spent.toLocaleString()}${
                      it.budget > 0 ? ` / 預算 ${it.budget.toLocaleString()}` : ""
                    }${it.overrun ? " ⚠️ 超支" : ""}`}
                  >
                    {it.overrun && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px]">
                        ⚠️
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-[8px] text-gray-400 mt-2">
            {data.items.map((it) => (
              <span key={it.month} className="flex-1 text-center">
                {it.month.slice(5)}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
