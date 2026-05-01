/**
 * 財務總覽 v2（Phase 4 PR-4）
 *
 * 混合視圖（D 模式）：
 * - 上方：本月預估 vs 實際 + 完成度進度條
 * - 中間：「需要處理」清單（逾期、未歸檔、大額警示、漏記）
 * - 下方：館組卡片（依 property_groups 邏輯聚合）
 *
 * 資料來源（純 read-only，不新增 endpoint）：
 * - /api/budget/plans/by-month
 * - /api/payment/priority-report
 * - /api/cashflow/forecast
 * - /api/property-groups
 * - /api/reports/property-pl
 * - /api/reports/variance
 */

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle2,
  Building2,
  ArrowRight,
  Sparkles,
  Wallet,
  PieChart,
  Inbox,
  HelpCircle,
} from "lucide-react"
import { formatNT } from "@/lib/utils"

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────

interface PlanByMonth {
  exists: boolean
  totals?: {
    planned: number
    actual: number
    variance: number
    completionPercent: number
  }
}

interface PriorityItem {
  id: number
  itemName: string
  unpaidAmount: number
  dueDate: string
  daysOverdue: number
  daysUntilDue: number
  urgency: "critical" | "high" | "medium" | "low"
  projectName?: string
}

interface PriorityReport {
  totalUnpaid: number
  counts: Record<"critical" | "high" | "medium" | "low", number>
  byUrgency: Record<"critical" | "high" | "medium" | "low", PriorityItem[]>
  all: PriorityItem[]
}

interface CashflowGap {
  year: number
  month: number
  estimatedIncome: number
  estimatedExpense: number
  net: number
  gap?: number
  isHighExpense?: boolean
  expenseRatio?: number
}

interface CashflowForecast {
  hasShortage: boolean
  gapAnalysis: CashflowGap[]
}

interface PropertyGroupMember {
  id: number
  groupId: number
  projectId: number
  projectName: string | null
  weight: string
}

interface PropertyGroup {
  id: number
  name: string
  description: string | null
  isActive: boolean
  members: PropertyGroupMember[]
}

interface PLPropertyRow {
  projectId: number
  projectName: string
  revenue: number
  directExpense: number
  allocatedExpense: number
  netProfit: number
  marginPercent: number
}

interface PLReport {
  year: number
  month: number
  totals: {
    revenue: number
    expense: number
    netProfit: number
    marginPercent: number
  }
  properties: PLPropertyRow[]
  companyLevel: {
    totalExpense: number
  }
}

interface VarianceReport {
  totals: {
    plannedTotal: number
    actualTotal: number
    variance: number
  }
  suspectMissing: { id: number }[]
  bigVariance: { id: number; severity: string }[]
}

// ─────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 3 }, (_, i) => CURRENT_YEAR - 1 + i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function FinancialOverviewV2() {
  useDocumentTitle("財務總覽")

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // ── 資料查詢 ────────────────────────────────
  const { data: plan } = useQuery<PlanByMonth>({
    queryKey: [`/api/budget/plans/by-month?year=${year}&month=${month}`],
  })

  const { data: priority } = useQuery<PriorityReport>({
    queryKey: ["/api/payment/priority-report?includeLow=true"],
  })

  const { data: forecast } = useQuery<CashflowForecast>({
    queryKey: ["/api/cashflow/forecast?monthsAhead=6"],
  })

  const { data: groups = [] } = useQuery<PropertyGroup[]>({
    queryKey: ["/api/property-groups"],
  })

  const { data: pl } = useQuery<PLReport>({
    queryKey: [`/api/reports/property-pl?year=${year}&month=${month}`],
  })

  const { data: variance } = useQuery<VarianceReport>({
    queryKey: [`/api/reports/variance?year=${year}&month=${month}`],
  })

  // ── 館組聚合 ────────────────────────────────
  const propertyCards = useMemo(() => {
    if (!pl) return []
    return aggregateByGroup(pl.properties, groups, pl.companyLevel.totalExpense)
  }, [pl, groups])

  // ── 需要處理項目 ────────────────────────────
  const actionItems = useMemo(() => {
    return collectActionItems(priority, forecast, variance, year, month)
  }, [priority, forecast, variance, year, month])

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-blue-600" />
            財務總覽
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            預估與實際對比 / 各館損益 / 緊急事項一覽
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} 月
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* === 上方：預估 vs 實際 === */}
      <BudgetVsActualCard plan={plan} year={year} month={month} />

      {/* === 中間：需要處理 === */}
      {actionItems.length > 0 && (
        <Card className="mb-4 border-orange-200">
          <CardHeader className="pb-3 bg-orange-50/50">
            <CardTitle className="text-base flex items-center gap-2 text-orange-800">
              <AlertCircle className="h-5 w-5" />
              需要處理（{actionItems.length}）
            </CardTitle>
            <CardDescription>需要您注意或行動的項目</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="space-y-2">
              {actionItems.map((item, i) => (
                <ActionItemRow key={i} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* === 下方：館組卡片 === */}
      {pl && (
        <div className="mb-4">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            各館組本月狀況
          </h2>
          {propertyCards.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>該月還沒有任何收入或開銷紀錄</p>
                <p className="text-xs mt-2">先建立預估表，然後付款記錄會自動回沖</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {propertyCards.map((card) => (
                <PropertyCardView key={card.key} card={card} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* === 快速連結 === */}
      <Card className="mt-4 border-blue-200 bg-blue-50/30">
        <CardContent className="pt-4 pb-4">
          <div className="text-xs text-blue-900 font-medium mb-2">快速進入</div>
          <div className="flex flex-wrap gap-2">
            <QuickLink
              href="/budget-estimates"
              label="月度預估"
              icon={<Sparkles className="h-3 w-3" />}
            />
            <QuickLink
              href="/property-pl"
              label="館別損益"
              icon={<PieChart className="h-3 w-3" />}
            />
            <QuickLink
              href="/variance-report"
              label="差異對賬"
              icon={<TrendingDown className="h-3 w-3" />}
            />
            <QuickLink
              href="/cashflow-decision-center"
              label="現金流預測"
              icon={<TrendingUp className="h-3 w-3" />}
            />
            <QuickLink
              href="/cash-allocation"
              label="現金分配"
              icon={<Wallet className="h-3 w-3" />}
            />
            <QuickLink
              href="/document-inbox"
              label="單據收件箱"
              icon={<Inbox className="h-3 w-3" />}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────
// 預估 vs 實際彙總卡
// ─────────────────────────────────────────────

function BudgetVsActualCard({
  plan,
  year,
  month,
}: {
  plan: PlanByMonth | undefined
  year: number
  month: number
}) {
  if (!plan?.exists || !plan.totals) {
    return (
      <Card className="mb-4 border-purple-200 bg-purple-50/30">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            {year}/{month} 還沒有建立預估表
          </p>
          <Link href="/budget-estimates">
            <Button size="sm">
              <Sparkles className="h-4 w-4 mr-1" />
              建立預估表
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  const t = plan.totals
  const isOverspent = t.variance > 0
  const isExact = t.variance === 0

  return (
    <Card className="mb-4 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-700" />
          {year} 年 {month} 月 預估 vs 實際
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="預估總額" value={formatNT(t.planned)} colorClass="text-gray-700" />
          <Stat label="實際總額" value={formatNT(t.actual)} colorClass="text-blue-700" />
          <Stat
            label="差異"
            value={`${isOverspent ? "+" : ""}${formatNT(t.variance)}`}
            colorClass={
              isExact ? "text-gray-700" : isOverspent ? "text-red-700" : "text-emerald-700"
            }
          />
          <Stat
            label="完成度"
            value={`${t.completionPercent}%`}
            colorClass={
              t.completionPercent >= 100
                ? "text-red-700"
                : t.completionPercent >= 70
                  ? "text-emerald-700"
                  : "text-yellow-700"
            }
          />
        </div>

        {/* 進度條 */}
        <div className="mt-4">
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                t.completionPercent >= 100
                  ? "bg-red-500"
                  : t.completionPercent >= 70
                    ? "bg-emerald-500"
                    : "bg-yellow-400"
              }`}
              style={{ width: `${Math.min(100, t.completionPercent)}%` }}
            />
          </div>
        </div>

        <div className="mt-3 text-right">
          <Link href="/budget-estimates">
            <Button size="sm" variant="outline">
              預估細項
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 統計小卡
// ─────────────────────────────────────────────

function Stat({
  label,
  value,
  colorClass = "text-foreground",
}: {
  label: string
  value: string
  colorClass?: string
}) {
  return (
    <div className="bg-white rounded-lg p-3 border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-base sm:text-lg font-bold mt-1 ${colorClass}`}>{value}</div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 需要處理 — Action Item
// ─────────────────────────────────────────────

interface ActionItem {
  type: "overdue" | "due-soon" | "high-expense" | "missing-actual" | "shortage"
  title: string
  description: string
  count?: number
  amount?: number
  link?: string
  severity: "critical" | "warning" | "info"
}

function collectActionItems(
  priority: PriorityReport | undefined,
  forecast: CashflowForecast | undefined,
  variance: VarianceReport | undefined,
  year: number,
  month: number
): ActionItem[] {
  const items: ActionItem[] = []

  // 1. 逾期
  if (priority && priority.counts.critical > 0) {
    items.push({
      type: "overdue",
      title: `${priority.counts.critical} 筆已逾期`,
      description: `總計待付 ${formatNT(
        priority.byUrgency.critical.reduce((s, p) => s + p.unpaidAmount, 0)
      )}`,
      count: priority.counts.critical,
      link: "/",
      severity: "critical",
    })
  }

  // 2. 即將到期（7 天內）
  if (priority && priority.counts.high > 0) {
    items.push({
      type: "due-soon",
      title: `${priority.counts.high} 筆 7 天內到期`,
      description: `總計待付 ${formatNT(
        priority.byUrgency.high.reduce((s, p) => s + p.unpaidAmount, 0)
      )}`,
      count: priority.counts.high,
      link: "/",
      severity: "warning",
    })
  }

  // 3. 大額警示 / 現金缺口
  if (forecast?.gapAnalysis) {
    for (const gap of forecast.gapAnalysis) {
      if (gap.gap !== undefined && gap.gap > 0) {
        items.push({
          type: "shortage",
          title: `${gap.year}/${gap.month} 預估現金缺口 ${formatNT(gap.gap)}`,
          description: `預估收入 ${formatNT(gap.estimatedIncome)} < 預估開銷 ${formatNT(gap.estimatedExpense)}`,
          amount: gap.gap,
          link: "/cashflow-decision-center",
          severity: "critical",
        })
      } else if (gap.isHighExpense) {
        items.push({
          type: "high-expense",
          title: `${gap.year}/${gap.month} 大額月（${((gap.expenseRatio ?? 0) * 100).toFixed(0)}% 超平均）`,
          description: `預估開銷 ${formatNT(gap.estimatedExpense)}，建議提前準備`,
          link: "/cashflow-decision-center",
          severity: "warning",
        })
      }
    }
  }

  // 4. 預估未發生（漏記）
  if (variance && variance.suspectMissing.length > 0) {
    items.push({
      type: "missing-actual",
      title: `${variance.suspectMissing.length} 筆預估未實際發生`,
      description: "可能漏記，請確認",
      count: variance.suspectMissing.length,
      link: `/variance-report?year=${year}&month=${month}`,
      severity: "warning",
    })
  }

  return items
}

function ActionItemRow({ item }: { item: ActionItem }) {
  const severityClass = {
    critical: "border-l-4 border-red-500 bg-red-50",
    warning: "border-l-4 border-orange-400 bg-orange-50",
    info: "border-l-4 border-blue-400 bg-blue-50",
  }[item.severity]

  const icon = {
    overdue: <Clock className="h-4 w-4 text-red-600" />,
    "due-soon": <Clock className="h-4 w-4 text-orange-600" />,
    "high-expense": <TrendingUp className="h-4 w-4 text-orange-600" />,
    "missing-actual": <HelpCircle className="h-4 w-4 text-orange-600" />,
    shortage: <AlertTriangle className="h-4 w-4 text-red-600" />,
  }[item.type]

  return (
    <div className={`p-3 rounded ${severityClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{item.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
          </div>
        </div>
        {item.link && (
          <Link href={item.link}>
            <Button size="sm" variant="ghost" className="shrink-0">
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 館組聚合
// ─────────────────────────────────────────────

interface PropertyCard {
  key: string
  title: string
  isGroup: boolean
  members: string[]
  revenue: number
  directExpense: number
  allocatedExpense: number
  netProfit: number
  marginPercent: number
  badge?: string
}

function aggregateByGroup(
  properties: PLPropertyRow[],
  groups: PropertyGroup[],
  companyExpense: number
): PropertyCard[] {
  const cards: PropertyCard[] = []
  const inGroupIds = new Set<number>()

  // 1. 群組卡（如「輕旅櫃台組」）
  for (const g of groups) {
    if (!g.isActive || g.members.length === 0) continue
    const memberIds = g.members.map((m) => m.projectId)
    memberIds.forEach((id) => inGroupIds.add(id))

    const memberProps = properties.filter((p) => memberIds.includes(p.projectId))
    if (memberProps.length === 0) continue

    const revenue = memberProps.reduce((s, p) => s + p.revenue, 0)
    const direct = memberProps.reduce((s, p) => s + p.directExpense, 0)
    const allocated = memberProps.reduce((s, p) => s + p.allocatedExpense, 0)
    const net = revenue - direct - allocated
    const margin = revenue > 0 ? Math.round((net / revenue) * 1000) / 10 : 0

    cards.push({
      key: `group-${g.id}`,
      title: g.name,
      isGroup: true,
      members: memberProps.map((p) => p.projectName),
      revenue,
      directExpense: direct,
      allocatedExpense: allocated,
      netProfit: net,
      marginPercent: margin,
      badge: `${memberProps.length} 館`,
    })
  }

  // 2. 不在 group 的單館
  for (const p of properties) {
    if (inGroupIds.has(p.projectId)) continue
    cards.push({
      key: `prop-${p.projectId}`,
      title: p.projectName,
      isGroup: false,
      members: [p.projectName],
      revenue: p.revenue,
      directExpense: p.directExpense,
      allocatedExpense: p.allocatedExpense,
      netProfit: p.netProfit,
      marginPercent: p.marginPercent,
    })
  }

  // 3. 公司級費用（如有）
  if (companyExpense > 0) {
    cards.push({
      key: "company",
      title: "公司級費用",
      isGroup: false,
      members: [],
      revenue: 0,
      directExpense: companyExpense,
      allocatedExpense: 0,
      netProfit: -companyExpense,
      marginPercent: 0,
      badge: "公司級",
    })
  }

  // 依淨利排序（高 → 低）
  return cards.sort((a, b) => b.netProfit - a.netProfit)
}

function PropertyCardView({ card }: { card: PropertyCard }) {
  const isLoss = card.netProfit < 0
  const totalExpense = card.directExpense + card.allocatedExpense

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            {card.title}
            {card.badge && (
              <Badge variant="outline" className="text-[10px]">
                {card.badge}
              </Badge>
            )}
          </CardTitle>
          {!isLoss && card.revenue > 0 && (
            <Badge
              variant="outline"
              className={
                card.marginPercent >= 20
                  ? "border-emerald-300 text-emerald-700"
                  : card.marginPercent >= 0
                    ? "border-yellow-300 text-yellow-700"
                    : "border-red-300 text-red-700"
              }
            >
              {card.marginPercent}%
            </Badge>
          )}
        </div>
        {card.isGroup && card.members.length > 0 && (
          <CardDescription className="text-xs">含：{card.members.join(" / ")}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">收入</div>
            <div className="font-semibold text-green-700 mt-0.5">{formatNT(card.revenue)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">開銷</div>
            <div className="font-semibold text-red-700 mt-0.5">{formatNT(totalExpense)}</div>
            {card.allocatedExpense > 0 && (
              <div className="text-[10px] text-orange-600 mt-0.5">
                含攤提 {formatNT(card.allocatedExpense)}
              </div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground">淨利</div>
            <div className={`font-semibold mt-0.5 ${isLoss ? "text-red-700" : "text-blue-700"}`}>
              {card.netProfit >= 0 ? "+" : ""}
              {formatNT(card.netProfit)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 快速連結
// ─────────────────────────────────────────────

function QuickLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link href={href}>
      <Button variant="ghost" size="sm" className="text-xs">
        {icon}
        <span className="ml-1">{label}</span>
      </Button>
    </Link>
  )
}
