/**
 * 財務健康度摘要卡（首頁置頂）
 * 一目了然：本月應付/已付/逾期 + 年度滯納金損失
 */

import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import { AlertTriangle, CheckCircle2, TrendingDown, ArrowRight, Clock, Copy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatNT } from "@/lib/utils"
import { useCopyAmount } from "@/hooks/use-copy-amount"

type UrgencyLevel = "critical" | "high" | "medium" | "low"

interface PriorityResult {
  itemName: string
  unpaidAmount: number
  urgency: UrgencyLevel
  daysOverdue: number
  daysUntilDue: number
  lateFeeEstimate: number
  dueDate: string
}

interface PriorityReport {
  totalUnpaid: number
  counts: Record<UrgencyLevel, number>
  all: PriorityResult[]
}

interface AnnualLossReport {
  totalLateFee: number
  totalPrincipal: number
  lossPercentage: number
}

export function FinancialHealthSummaryCard() {
  const copyAmount = useCopyAmount()
  const { data: priority } = useQuery<PriorityReport>({
    queryKey: ["/api/payment/priority-report?includeLow=true"],
  })
  const year = new Date().getFullYear()
  const { data: annual } = useQuery<AnnualLossReport>({
    queryKey: [`/api/late-fee/annual-loss?year=${year}`],
  })

  if (!priority) {
    // 載入中骨架（避免突然出現造成 layout shift）
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-3 sm:p-4 animate-pulse">
          <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200/70 rounded" />
            ))}
          </div>
          <div className="mt-3 h-2 bg-gray-200 rounded-full" />
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-5 w-16 bg-gray-200 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const overdueCount = priority.all.filter((r) => r.daysOverdue > 0).length
  const accumulatedLateFee = priority.all.reduce((s, r) => s + (r.lateFeeEstimate ?? 0), 0)
  const yearLateFee = annual?.totalLateFee ?? 0

  // 本月還剩天數（給時間壓迫感）
  const today = new Date()
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysLeftInMonth = lastDayOfMonth - today.getDate()

  // 找最緊急的：有逾期就顯示最久逾期，否則顯示最近到期
  const mostOverdue = priority.all
    .filter((r) => r.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)[0]
  const nextUpcoming = priority.all
    .filter((r) => r.daysUntilDue > 0 && r.daysUntilDue <= 14)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)[0]
  const nextItem = mostOverdue ?? nextUpcoming

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">📊 財務健康度</h2>
          <span className="text-xs text-gray-500">
            {year}/{today.getMonth() + 1}
            {daysLeftInMonth > 0 && (
              <span
                className={`ml-1.5 ${daysLeftInMonth <= 5 ? "text-red-600 font-semibold" : "text-gray-500"}`}
                title={`本月還剩 ${daysLeftInMonth} 天`}
              >
                · 剩 {daysLeftInMonth} 天
              </span>
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Link href="/cash-allocation">
            <div className="bg-white/70 rounded p-2.5 cursor-pointer hover:bg-white transition-colors active:scale-95">
              <div className="text-xs text-gray-500">未付總額</div>
              <div className="text-base sm:text-lg font-bold text-gray-900">
                {formatNT(priority.totalUnpaid)}
              </div>
            </div>
          </Link>
          <Link href="/cash-allocation">
            <div
              className={`rounded p-2.5 cursor-pointer hover:opacity-80 transition-opacity active:scale-95 ${
                overdueCount > 0 ? "bg-red-50" : "bg-white/70"
              }`}
            >
              <div className="text-xs text-gray-500 flex items-center gap-1">
                {overdueCount > 0 && <AlertTriangle className="h-3 w-3 text-red-600" />}
                逾期筆數
              </div>
              <div
                className={`text-base sm:text-lg font-bold ${
                  overdueCount > 0 ? "text-red-700" : "text-gray-900"
                }`}
              >
                {overdueCount} 筆
              </div>
            </div>
          </Link>
          <Link href="/labor-insurance-watch">
            <div
              className={`rounded p-2.5 cursor-pointer hover:opacity-80 transition-opacity active:scale-95 ${
                accumulatedLateFee > 0 ? "bg-amber-50" : "bg-white/70"
              }`}
            >
              <div className="text-xs text-gray-500">已產生滯納金</div>
              <div
                className={`text-base sm:text-lg font-bold ${
                  accumulatedLateFee > 0 ? "text-amber-700" : "text-gray-900"
                }`}
              >
                {formatNT(accumulatedLateFee)}
              </div>
            </div>
          </Link>
          <Link href="/labor-insurance-watch">
            <div
              className={`rounded p-2.5 cursor-pointer hover:opacity-80 transition-opacity active:scale-95 ${
                yearLateFee > 0 ? "bg-red-50" : "bg-green-50"
              }`}
            >
              <div className="text-xs text-gray-500 flex items-center gap-1">
                {yearLateFee > 0 ? (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                )}
                年度損失
              </div>
              <div
                className={`text-base sm:text-lg font-bold ${
                  yearLateFee > 0 ? "text-red-700" : "text-green-700"
                }`}
              >
                {yearLateFee > 0 ? formatNT(yearLateFee) : "0"}
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-3">
          <UrgencyProgressBar counts={priority.counts} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Badge level="critical" count={priority.counts.critical} label="緊急" />
          <Badge level="high" count={priority.counts.high} label="本週" />
          <Badge level="medium" count={priority.counts.medium} label="本月" />
          <Badge level="low" count={priority.counts.low} label="可緩" />
        </div>

        {nextItem && (
          <div
            className={`mt-3 flex items-start gap-2 rounded p-2 text-xs ${
              mostOverdue ? "bg-red-100 text-red-900" : "bg-blue-50 text-blue-900"
            }`}
          >
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="truncate">
                {mostOverdue ? "🔴 最久逾期：" : "⏰ 下一筆截止："}
                <strong>{nextItem.itemName}</strong>
                <span className="ml-1">
                  {mostOverdue
                    ? `（已逾期 ${nextItem.daysOverdue} 天）`
                    : `（剩 ${nextItem.daysUntilDue} 天 · ${nextItem.dueDate}）`}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    copyAmount(nextItem.unpaidAmount, nextItem.itemName)
                  }}
                  className="inline-flex items-center gap-1 font-bold text-sm hover:underline cursor-pointer"
                  title="點擊複製金額（轉帳用）"
                  data-testid="copy-next-item-amount"
                >
                  {formatNT(nextItem.unpaidAmount)}
                  <Copy className="h-3 w-3 opacity-50" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.dispatchEvent(new CustomEvent("open-quick-payment"))
                  }}
                  className="text-xs font-medium px-2 py-0.5 rounded bg-white border hover:bg-gray-50 active:scale-95 transition-all"
                  title="開啟快速付款"
                  data-testid="next-item-pay-now"
                >
                  立即付款 →
                </button>
              </div>
            </div>
          </div>
        )}

        {(overdueCount > 0 || priority.counts.critical > 0) && (
          <Link href="/cash-allocation">
            <div className="mt-2 flex items-center justify-between bg-amber-100 hover:bg-amber-200 rounded p-2 cursor-pointer transition-colors">
              <span className="text-xs font-medium text-amber-900">
                有 {priority.counts.critical + priority.counts.high} 件緊急事項，立刻分配現金
              </span>
              <ArrowRight className="h-4 w-4 text-amber-900" />
            </div>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

const URGENCY_BADGE: Record<UrgencyLevel, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-gray-100 text-gray-700",
}

const URGENCY_BAR: Record<UrgencyLevel, string> = {
  critical: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-gray-300",
}

function UrgencyProgressBar({ counts }: { counts: Record<UrgencyLevel, number> }) {
  const total = counts.critical + counts.high + counts.medium + counts.low
  if (total === 0) {
    return (
      <div className="flex h-2 rounded-full bg-green-200 overflow-hidden">
        <div className="flex-1 flex items-center justify-center text-[10px] text-green-800 font-medium">
          ✅ 沒有未付款
        </div>
      </div>
    )
  }
  const levels: UrgencyLevel[] = ["critical", "high", "medium", "low"]
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
      {levels.map((level) => {
        const pct = (counts[level] / total) * 100
        if (pct === 0) return null
        return (
          <div
            key={level}
            className={URGENCY_BAR[level]}
            style={{ width: `${pct}%` }}
            title={`${level}: ${counts[level]} 筆`}
          />
        )
      })}
    </div>
  )
}

function Badge({ level, count, label }: { level: UrgencyLevel; count: number; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${URGENCY_BADGE[level]}`}
    >
      <span className="font-semibold">{count}</span>
      <span>{label}</span>
    </span>
  )
}
