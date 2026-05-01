/**
 * 財務健康度摘要卡（首頁置頂）
 * PR-6 改造：4 張卡點擊改為展開明細抽屜（不再跳走），讓使用者立刻看到「為什麼這麼多」。
 *
 * 一目了然：未付總額、逾期筆數、已產生滯納金、年度損失
 * 點擊任一張 → 展開該主題的詳細分解（按專案、按項目、按月份等）
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import { AlertTriangle, CheckCircle2, TrendingDown, ArrowRight, Clock, Copy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatNT } from "@/lib/utils"
import { useCopyAmount } from "@/hooks/use-copy-amount"
import {
  FinancialDetailSheet,
  type DetailMode,
  type PriorityReport,
  type AnnualLossReport,
} from "./financial-detail-sheet"

export function FinancialHealthSummaryCard() {
  const copyAmount = useCopyAmount()
  const [sheetMode, setSheetMode] = useState<DetailMode | null>(null)

  // 排除「可緩」(>14 天才到期) 項目，避免 totalUnpaid 被未來未發生項目灌水
  const { data: priority } = useQuery<PriorityReport>({
    queryKey: ["/api/payment/priority-report?includeLow=false"],
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

  // 按到期狀態分組（直觀，取代 priority engine 的 critical/high 標籤）
  const dueGroups = {
    overdue: priority.all.filter((r) => r.daysOverdue > 0).length,
    thisWeek: priority.all.filter((r) => r.daysOverdue === 0 && r.daysUntilDue <= 7).length,
    within2w: priority.all.filter(
      (r) => r.daysOverdue === 0 && r.daysUntilDue > 7 && r.daysUntilDue <= 14
    ).length,
  }

  return (
    <>
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

          {/* 4 張卡：點擊展開明細 Sheet（不再跳轉） */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <KpiCard
              label="應付總額"
              value={formatNT(priority.totalUnpaid)}
              hint={`${priority.all.length} 筆 · 14 天內到期`}
              variant="default"
              onClick={() => setSheetMode("unpaid")}
              testId="kpi-unpaid"
            />
            <KpiCard
              label="逾期筆數"
              value={`${overdueCount} 筆`}
              hint={overdueCount > 0 ? "點看清單" : "無逾期 ✅"}
              variant={overdueCount > 0 ? "danger" : "default"}
              icon={overdueCount > 0 ? <AlertTriangle className="h-3 w-3 text-red-600" /> : null}
              onClick={() => setSheetMode("overdue")}
              testId="kpi-overdue"
            />
            <KpiCard
              label="已產生滯納金"
              value={formatNT(accumulatedLateFee)}
              hint={accumulatedLateFee > 0 ? "點看來源" : "—"}
              variant={accumulatedLateFee > 0 ? "warning" : "default"}
              onClick={() => setSheetMode("lateFee")}
              testId="kpi-late-fee"
            />
            <KpiCard
              label="年度損失"
              value={yearLateFee > 0 ? formatNT(yearLateFee) : "0"}
              hint={
                yearLateFee > 0
                  ? `佔本金 ${(annual?.lossPercentage ?? 0).toFixed(1)}%`
                  : "今年零損失"
              }
              variant={yearLateFee > 0 ? "danger" : "success"}
              icon={
                yearLateFee > 0 ? (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                )
              }
              onClick={() => setSheetMode("annual")}
              testId="kpi-annual"
            />
          </div>

          <div className="mt-3">
            <DueProgressBar groups={dueGroups} />
          </div>
          {/* 按到期狀態分布 — 比 priority 引擎的 critical/high 直觀 */}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <DueBadge variant="overdue" count={dueGroups.overdue} label="已逾期" />
            <DueBadge variant="thisWeek" count={dueGroups.thisWeek} label="7 天內" />
            <DueBadge variant="within2w" count={dueGroups.within2w} label="8-14 天" />
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

      {/* 明細抽屜 */}
      <FinancialDetailSheet
        open={sheetMode !== null}
        onOpenChange={(open) => !open && setSheetMode(null)}
        mode={sheetMode ?? "unpaid"}
        priority={priority}
        annual={annual}
      />
    </>
  )
}

// ─────────────────────────────────────────────
// 子元件：KpiCard（可點擊卡片）
// ─────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  hint?: string
  variant: "default" | "danger" | "warning" | "success"
  icon?: React.ReactNode
  onClick: () => void
  testId?: string
}

function KpiCard({ label, value, hint, variant, icon, onClick, testId }: KpiCardProps) {
  const variantClass = {
    default: "bg-white/70 hover:bg-white",
    danger: "bg-red-50 hover:bg-red-100",
    warning: "bg-amber-50 hover:bg-amber-100",
    success: "bg-green-50 hover:bg-green-100",
  }[variant]
  const valueClass = {
    default: "text-gray-900",
    danger: "text-red-700",
    warning: "text-amber-700",
    success: "text-green-700",
  }[variant]

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`text-left rounded p-2.5 cursor-pointer transition-all active:scale-95 ${variantClass}`}
    >
      <div className="text-xs text-gray-500 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-base sm:text-lg font-bold ${valueClass}`}>{value}</div>
      {hint && <div className="text-[10px] text-gray-500 mt-0.5 truncate">{hint}</div>}
    </button>
  )
}

// ─────────────────────────────────────────────
// 子元件：DueProgressBar / DueBadge（按到期狀態）
// ─────────────────────────────────────────────

type DueVariant = "overdue" | "thisWeek" | "within2w"

const DUE_BAR: Record<DueVariant, string> = {
  overdue: "bg-red-500",
  thisWeek: "bg-orange-400",
  within2w: "bg-yellow-400",
}

const DUE_BADGE: Record<DueVariant, string> = {
  overdue: "bg-red-100 text-red-800",
  thisWeek: "bg-orange-100 text-orange-800",
  within2w: "bg-yellow-100 text-yellow-800",
}

interface DueGroups {
  overdue: number
  thisWeek: number
  within2w: number
}

function DueProgressBar({ groups }: { groups: DueGroups }) {
  const total = groups.overdue + groups.thisWeek + groups.within2w
  if (total === 0) {
    return (
      <div className="flex h-2 rounded-full bg-green-200 overflow-hidden">
        <div className="flex-1 flex items-center justify-center text-[10px] text-green-800 font-medium">
          ✅ 沒有未付款
        </div>
      </div>
    )
  }
  const variants: DueVariant[] = ["overdue", "thisWeek", "within2w"]
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
      {variants.map((v) => {
        const pct = (groups[v] / total) * 100
        if (pct === 0) return null
        return <div key={v} className={DUE_BAR[v]} style={{ width: `${pct}%` }} />
      })}
    </div>
  )
}

function DueBadge({
  variant,
  count,
  label,
}: {
  variant: DueVariant
  count: number
  label: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${DUE_BADGE[variant]}`}
    >
      <span className="font-semibold">{count}</span>
      <span>{label}</span>
    </span>
  )
}
