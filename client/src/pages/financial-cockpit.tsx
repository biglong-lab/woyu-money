/**
 * 財務健康駕駛艙（/financial-cockpit）
 *
 * 全站唯一財務主入口 — 一頁看完「現況 → 該付什麼 → 未來現金流」，並導向深度工具。
 * 全部用既有 API 拼裝（不重複造引擎）：
 * - /api/dashboard/ytd            本月收入/成本/淨利
 * - /api/cashflow/forecast        未來 6 月缺口
 * - /api/payment/priority-report  應付款優先級排序（9類別5維度引擎）
 *
 * Phase 1：聚合 + 健康分數 + 導航收斂。欠款分期規劃器、AI 顧問為後續 Phase。
 */
import { useMemo, useState } from "react"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PayableManager } from "@/components/cockpit/payable-manager"
import { ArrearsPlanner } from "@/components/cockpit/arrears-planner"
import { AiAdvisor, type AdvisorSnapshot } from "@/components/cockpit/ai-advisor"
import OverviewTabs from "@/components/overview-tabs"
import {
  Activity,
  TrendingUp,
  Wallet,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  ShieldCheck,
  PieChart,
  Bot,
} from "lucide-react"

// ─────────────────────────────────────────────
// 型別（對齊既有 API 回傳）
// ─────────────────────────────────────────────
type UrgencyLevel = "critical" | "high" | "medium" | "low"
interface PriorityItem {
  id: number
  itemName: string
  unpaidAmount: number
  dueDate: string
  categoryLabel: string
  daysOverdue: number
  daysUntilDue: number
  urgency: UrgencyLevel
  lateFeeEstimate: number
  dailyLateFee: number
  projectName?: string
}
interface PriorityReport {
  totalUnpaid: number
  counts: Record<UrgencyLevel, number>
  all: PriorityItem[]
}
interface YtdMonth {
  month: string
  income: number
  expense: number
}
interface YtdData {
  income: number
  expense: number
  profit: number
  months: YtdMonth[]
}
interface GapItem {
  year: number
  month: number
  estimatedIncome: number
  estimatedExpense: number
  net: number
  gap?: number
  isHighExpense?: boolean
}
interface ForecastResponse {
  gapAnalysis: GapItem[]
  hasShortage: boolean
}
interface TodayAlert {
  type: string
  severity: "critical" | "warn" | "info"
  title: string
  detail: string
  count?: number
  amount?: number
  link: string
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
const currentYm = () => new Date().toISOString().slice(0, 7)

// ─────────────────────────────────────────────
// 健康分數
// ─────────────────────────────────────────────
interface HealthResult {
  score: number
  label: string
  color: string
  reasons: string[]
}
function computeHealth(
  priority: PriorityReport | undefined,
  forecast: ForecastResponse | undefined,
  monthProfit: number | null
): HealthResult {
  let score = 100
  const reasons: string[] = []

  const critical = priority?.counts.critical ?? 0
  const high = priority?.counts.high ?? 0
  if (critical > 0) {
    const d = Math.min(critical * 8, 40)
    score -= d
    reasons.push(`${critical} 筆必須立刻付（強制執行/滯納金風險）−${d}`)
  }
  if (high > 0) {
    const d = Math.min(high * 3, 15)
    score -= d
    reasons.push(`${high} 筆本週內須付 −${d}`)
  }

  const shortageMonths = forecast?.gapAnalysis.filter((g) => (g.gap ?? 0) > 0).length ?? 0
  if (shortageMonths > 0) {
    const d = Math.min(shortageMonths * 10, 30)
    score -= d
    reasons.push(`未來 ${shortageMonths} 個月預估現金缺口 −${d}`)
  }

  if (monthProfit !== null && monthProfit < 0) {
    score -= 15
    reasons.push(`本月淨利為負 −15`)
  }

  score = Math.max(0, Math.min(100, score))

  let label = "健康"
  let color = "text-green-600"
  if (score < 40) {
    label = "危險"
    color = "text-red-600"
  } else if (score < 60) {
    label = "警戒"
    color = "text-orange-600"
  } else if (score < 80) {
    label = "注意"
    color = "text-amber-600"
  }
  if (reasons.length === 0) reasons.push("無重大風險，維持目前節奏")
  return { score, label, color, reasons }
}

const URGENCY_BADGE: Record<UrgencyLevel, { label: string; cls: string }> = {
  critical: { label: "🔴 立刻付", cls: "bg-red-100 text-red-800" },
  high: { label: "🟠 本週付", cls: "bg-orange-100 text-orange-800" },
  medium: { label: "🟡 可延後", cls: "bg-yellow-100 text-yellow-800" },
  low: { label: "⚪ 可推後", cls: "bg-gray-100 text-gray-600" },
}

// ─────────────────────────────────────────────
// 深度工具入口
// ─────────────────────────────────────────────
const TOOLS = [
  {
    href: "/payment-planner",
    icon: Layers,
    title: "排程分配規劃台",
    desc: "一頁排所有應付款付款月份，推估每月/季/年",
  },
  {
    href: "/cash-allocation",
    icon: Wallet,
    title: "現金分配助理",
    desc: "輸入可用現金→建議先付哪幾筆",
  },
  {
    href: "/scenario-planner",
    icon: Sparkles,
    title: "沙盤推演 2.0",
    desc: "收入↑/成本↓/還款三軸推未來現金走勢",
  },
  {
    href: "/scenario-simulator",
    icon: Sparkles,
    title: "沙盤推演（單月）",
    desc: "調行銷/訂價看下月收支",
  },
  {
    href: "/cashflow-decision-center",
    icon: TrendingUp,
    title: "現金流決策中心",
    desc: "未來 3-6 月缺口與明細",
  },
  {
    href: "/labor-insurance-watch",
    icon: ShieldCheck,
    title: "勞健保滯納金監控",
    desc: "年度損失 + 三層提醒",
  },
  { href: "/revenue-forecast", icon: TrendingUp, title: "收入預測", desc: "月底推估 + 同期比較" },
  {
    href: "/cost-overview",
    icon: Layers,
    title: "成本結構總覽",
    desc: "租金/人事/模板/一般四大成本",
  },
  { href: "/property-pl", icon: PieChart, title: "館別損益報表", desc: "各館收入/開銷/淨利率" },
  { href: "/financial-dashboard", icon: Activity, title: "綜合儀表板", desc: "YTD + 月度明細圖表" },
]

// ─────────────────────────────────────────────
// 主頁面
// ─────────────────────────────────────────────
export default function FinancialCockpitPage() {
  useDocumentTitle("財務健康駕駛艙")
  const [tab, setTab] = useState("overview")

  const { data: ytd } = useQuery<YtdData>({ queryKey: ["/api/dashboard/ytd"] })
  const { data: priority } = useQuery<PriorityReport>({
    queryKey: ["/api/payment/priority-report?includeLow=false"],
  })
  const { data: forecast } = useQuery<ForecastResponse>({
    queryKey: ["/api/cashflow/forecast?monthsAhead=6"],
  })
  const { data: alertsData } = useQuery<{ alerts: TodayAlert[] }>({
    queryKey: ["/api/alerts/today"],
  })
  const alerts = alertsData?.alerts ?? []

  const thisMonth = useMemo(() => {
    const ym = currentYm()
    return ytd?.months.find((m) => m.month === ym) ?? null
  }, [ytd])

  const monthIncome = thisMonth?.income ?? 0
  const monthExpense = thisMonth?.expense ?? 0
  const monthProfit = thisMonth ? monthIncome - monthExpense : null

  // 同期比較：上月收入 → 本月 vs 上月 %
  const incomeMoM = useMemo(() => {
    if (!ytd) return null
    const ym = currentYm()
    const idx = ytd.months.findIndex((m) => m.month === ym)
    if (idx <= 0) return null
    const prev = ytd.months[idx - 1]?.income ?? 0
    if (prev <= 0) return null
    return Math.round(((monthIncome - prev) / prev) * 100)
  }, [ytd, monthIncome])

  const health = useMemo(
    () => computeHealth(priority, forecast, monthProfit),
    [priority, forecast, monthProfit]
  )

  // 最大現金缺口月
  const worstGap = useMemo(() => {
    if (!forecast) return null
    const gaps = forecast.gapAnalysis.filter((g) => (g.gap ?? 0) > 0)
    if (gaps.length === 0) return null
    return gaps.reduce((a, b) => ((a.gap ?? 0) >= (b.gap ?? 0) ? a : b))
  }, [forecast])

  // 該付什麼：critical + high，依分數已排序
  const topPayables = useMemo(
    () =>
      (priority?.all ?? [])
        .filter((i) => i.urgency === "critical" || i.urgency === "high")
        .slice(0, 6),
    [priority]
  )

  // AI 顧問快照（帶給後端組 prompt）
  const advisorSnapshot = useMemo<AdvisorSnapshot>(
    () => ({
      healthScore: health.score,
      healthLabel: health.label,
      monthIncome,
      monthExpense,
      monthProfit,
      totalUnpaid: priority?.totalUnpaid,
      counts: priority?.counts,
      topPayables: (priority?.all ?? []).slice(0, 20).map((i) => ({
        itemName: i.itemName,
        unpaidAmount: i.unpaidAmount,
        categoryLabel: i.categoryLabel,
        urgency: i.urgency,
        daysOverdue: i.daysOverdue,
        daysUntilDue: i.daysUntilDue,
        dailyLateFee: i.dailyLateFee,
      })),
      gaps: forecast?.gapAnalysis,
    }),
    [health, monthIncome, monthExpense, monthProfit, priority, forecast]
  )

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6">
      <OverviewTabs />
      {/* 標題 + 健康分數 */}
      <Card className="border-2">
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="h-6 w-6 text-indigo-600" />
                財務健康駕駛艙
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                一頁看完現況、該付什麼、未來現金流
              </p>
            </div>
            <div className="text-center">
              <div className={`text-5xl font-extrabold ${health.color}`}>{health.score}</div>
              <div className={`text-sm font-medium ${health.color}`}>財務健康 · {health.label}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {health.reasons.map((r, i) => (
              <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                {r}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 今日提醒（主動聚合：勞健保 / 請款未到帳 / 排程到期）*/}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const cls =
              a.severity === "critical"
                ? "border-red-300 bg-red-50 text-red-800"
                : a.severity === "warn"
                  ? "border-orange-300 bg-orange-50 text-orange-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
            return (
              <Link key={i} href={a.link}>
                <div
                  className={`flex items-start gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer ${cls}`}
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold">{a.title}</span>
                    <span className="ml-1">{a.detail}</span>
                    {a.amount ? (
                      <span className="ml-1 font-medium">（{fmt(a.amount)}）</span>
                    ) : null}
                  </div>
                  <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* 一頁式工作台：總覽 / 應付款整理 / 欠款規劃 全在頁內切換、不跳頁 */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">總覽</TabsTrigger>
          <TabsTrigger value="payables">
            應付款整理
            {priority && priority.counts.critical + priority.counts.high > 0
              ? `（${priority.counts.critical + priority.counts.high}）`
              : ""}
          </TabsTrigger>
          <TabsTrigger value="arrears">欠款規劃</TabsTrigger>
          <TabsTrigger value="ai">🤖 AI 顧問</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-0">
          {/* 現況卡 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              title="本月收入"
              value={fmt(monthIncome)}
              tone="text-green-600"
              sub={
                incomeMoM === null
                  ? undefined
                  : `較上月 ${incomeMoM >= 0 ? "▲" : "▼"} ${Math.abs(incomeMoM)}%`
              }
            />
            <StatCard title="本月成本" value={fmt(monthExpense)} tone="text-red-500" />
            <StatCard
              title="本月淨利"
              value={monthProfit === null ? "—" : fmt(monthProfit)}
              tone={monthProfit !== null && monthProfit < 0 ? "text-red-600" : "text-indigo-600"}
            />
            <StatCard
              title="待付總額"
              value={fmt(priority?.totalUnpaid ?? 0)}
              tone="text-orange-600"
              sub={`${priority?.counts.critical ?? 0} 筆須立刻付`}
            />
          </div>

          {/* 現金缺口警示 */}
          {worstGap && (
            <Card className="border-orange-300 bg-orange-50">
              <CardContent className="pt-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-orange-800">
                    {worstGap.year}/{String(worstGap.month).padStart(2, "0")} 預估現金缺口{" "}
                    {fmt(worstGap.gap ?? 0)}
                  </span>
                  <span className="text-orange-700">
                    （估收 {fmt(worstGap.estimatedIncome)}、估支 {fmt(worstGap.estimatedExpense)}）—
                    建議提前部署現金或排程分期。
                  </span>
                  <Link href="/cashflow-decision-center">
                    <span className="ml-1 underline text-orange-900 cursor-pointer">看明細 →</span>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 該付什麼 */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">該付什麼（依優先級排序）</CardTitle>
              <button
                type="button"
                onClick={() => setTab("payables")}
                className="text-sm text-indigo-600 hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                整理應付款 <ArrowRight className="h-3 w-3" />
              </button>
            </CardHeader>
            <CardContent>
              {topPayables.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  目前沒有急迫的應付款 🎉
                </p>
              ) : (
                <div className="space-y-2">
                  {topPayables.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs ${URGENCY_BADGE[item.urgency].cls}`}
                          >
                            {URGENCY_BADGE[item.urgency].label}
                          </span>
                          <span className="font-medium truncate">{item.itemName}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.categoryLabel}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.daysOverdue > 0
                            ? `已逾期 ${item.daysOverdue} 天`
                            : `${item.daysUntilDue} 天後到期`}
                          {item.dailyLateFee > 0 && ` · 每天 +${fmt(item.dailyLateFee)} 滯納金`}
                          {item.projectName && ` · ${item.projectName}`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold">{fmt(item.unpaidAmount)}</div>
                        {item.lateFeeEstimate > 0 && (
                          <div className="text-xs text-red-500">
                            滯納 +{fmt(item.lateFeeEstimate)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 未來現金流 mini */}
          {forecast && forecast.gapAnalysis.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">未來現金流</CardTitle>
                <Link href="/cashflow-decision-center">
                  <span className="text-sm text-indigo-600 hover:underline cursor-pointer inline-flex items-center gap-1">
                    決策中心 <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {forecast.gapAnalysis.slice(0, 6).map((g) => {
                    const hasGap = (g.gap ?? 0) > 0
                    return (
                      <div
                        key={`${g.year}-${g.month}`}
                        className={`border rounded-lg px-3 py-2 text-sm ${hasGap ? "border-orange-300 bg-orange-50" : ""}`}
                      >
                        <div className="font-medium">
                          {g.year}/{String(g.month).padStart(2, "0")}
                        </div>
                        <div
                          className={
                            hasGap
                              ? "text-orange-700 font-semibold"
                              : "text-green-600 font-semibold"
                          }
                        >
                          {g.net >= 0 ? "+" : ""}
                          {fmt(g.net)}
                        </div>
                        {hasGap && (
                          <div className="text-xs text-orange-600">缺口 {fmt(g.gap ?? 0)}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 深度工具入口 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">規劃與分析工具</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TOOLS.map((t) => (
                  <Link key={t.href} href={t.href}>
                    <div className="border rounded-lg p-3 hover:border-indigo-400 hover:bg-indigo-50/40 transition cursor-pointer h-full">
                      <t.icon className="h-5 w-5 text-indigo-600 mb-1" />
                      <div className="font-medium text-sm">{t.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                    </div>
                  </Link>
                ))}
                {/* AI 財務顧問：切到頁內 AI 分頁 */}
                <button
                  type="button"
                  onClick={() => setTab("ai")}
                  className="text-left border rounded-lg p-3 hover:border-purple-400 hover:bg-purple-50/40 transition cursor-pointer h-full"
                >
                  <Bot className="h-5 w-5 text-purple-600 mb-1" />
                  <div className="font-medium text-sm">AI 財務顧問</div>
                  <div className="text-xs text-muted-foreground mt-0.5">一鍵產出財務優化方案</div>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 應付款整理：頁內就地標記已付、篩選、搜尋 */}
        <TabsContent value="payables" className="mt-0">
          <PayableManager />
        </TabsContent>

        {/* 欠款分期規劃器：頁內輸入→分期→建立 */}
        <TabsContent value="arrears" className="mt-0">
          <ArrearsPlanner />
        </TabsContent>

        {/* AI 財務顧問：讀快照產出優化方案 */}
        <TabsContent value="ai" className="mt-0">
          <AiAdvisor snapshot={advisorSnapshot} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({
  title,
  value,
  tone,
  sub,
}: {
  title: string
  value: string
  tone: string
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className={`text-xl font-bold mt-1 ${tone}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  )
}
