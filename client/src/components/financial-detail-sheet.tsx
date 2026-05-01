/**
 * 財務健康度明細抽屜（PR-6）
 *
 * 從首頁 4 張卡（未付總額/逾期筆數/已產生滯納金/年度損失）點擊開啟，
 * 顯示對應「為什麼這麼多」的明細，避免使用者只看到大數字找不到答案。
 */

import { useMemo } from "react"
import { Link } from "wouter"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  Copy,
  ExternalLink,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { useState } from "react"
import { formatNT } from "@/lib/utils"
import { useCopyAmount } from "@/hooks/use-copy-amount"

type UrgencyLevel = "critical" | "high" | "medium" | "low"

interface PriorityResult {
  id: number
  itemName: string
  unpaidAmount: number
  urgency: UrgencyLevel
  daysOverdue: number
  daysUntilDue: number
  lateFeeEstimate: number
  dueDate: string
  projectName?: string
  categoryLabel?: string
}

export interface PriorityReport {
  totalUnpaid: number
  counts: Record<UrgencyLevel, number>
  all: PriorityResult[]
}

export interface AnnualLossItem {
  itemId: number
  itemName: string
  dueDate: string
  paymentDate?: string
  daysOverdue: number
  amount: number
  lateFee: number
}

export interface AnnualLossReport {
  year: number
  itemCount: number
  totalPrincipal: number
  totalLateFee: number
  lossPercentage: number
  items: AnnualLossItem[]
}

export type DetailMode = "unpaid" | "overdue" | "lateFee" | "annual"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: DetailMode
  priority: PriorityReport | undefined
  annual: AnnualLossReport | undefined
}

const TITLES: Record<DetailMode, { title: string; desc: string }> = {
  unpaid: {
    title: "應付總額明細",
    desc: "已逾期 + 14 天內到期（不含未來未發生）",
  },
  overdue: { title: "逾期項目清單", desc: "已過期未付款，請優先處理" },
  lateFee: { title: "已產生滯納金", desc: "目前累計的滯納金損失（每日增加）" },
  annual: { title: "年度損失分析", desc: "今年因延遲付款累計的滯納金" },
}

export function FinancialDetailSheet({ open, onOpenChange, mode, priority, annual }: Props) {
  const { title, desc } = TITLES[mode]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b sticky top-0 bg-white z-10">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{desc}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 px-4 py-3">
          {mode === "unpaid" && <UnpaidView priority={priority} />}
          {mode === "overdue" && <OverdueView priority={priority} />}
          {mode === "lateFee" && <LateFeeView priority={priority} />}
          {mode === "annual" && <AnnualView annual={annual} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─────────────────────────────────────────────
// 未付總額視圖
// ─────────────────────────────────────────────

function UnpaidView({ priority }: { priority: PriorityReport | undefined }) {
  const copyAmount = useCopyAmount()

  // 按專案分組
  const byProject = useMemo(() => {
    if (!priority) return []
    const map = new Map<string, { total: number; count: number; items: PriorityResult[] }>()
    for (const r of priority.all) {
      const key = r.projectName ?? "（未指定專案）"
      const g = map.get(key) ?? { total: 0, count: 0, items: [] }
      g.total += r.unpaidAmount
      g.count += 1
      g.items.push(r)
      map.set(key, g)
    }
    return Array.from(map.entries())
      .map(([name, g]) => ({ name, ...g }))
      .sort((a, b) => b.total - a.total)
  }, [priority])

  // Top 10 最大金額
  const top10 = useMemo(() => {
    if (!priority) return []
    return [...priority.all].sort((a, b) => b.unpaidAmount - a.unpaidAmount).slice(0, 10)
  }, [priority])

  if (!priority) return <Skeleton />
  if (priority.all.length === 0) return <Empty msg="目前沒有未付款項目 🎉" />

  return (
    <div className="space-y-5">
      {/* 總額大數字 */}
      <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-3 border">
        <div className="text-xs text-gray-600">應付總額（14 天內到期 + 已逾期）</div>
        <button
          type="button"
          onClick={() => copyAmount(priority.totalUnpaid, "應付總額")}
          className="mt-1 inline-flex items-center gap-1 text-2xl font-bold text-gray-900 hover:underline"
          title="點擊複製金額"
        >
          {formatNT(priority.totalUnpaid)}
          <Copy className="h-4 w-4 opacity-50" />
        </button>
        <div className="text-xs text-gray-500 mt-1">
          共 {priority.all.length} 筆 · 不含 14 天以上未到期項目
        </div>
      </div>

      {/* 按到期狀態分（更直觀，避免 priority 引擎的 critical/high 混淆） */}
      <Section title="按到期狀態">
        <div className="grid grid-cols-3 gap-2">
          {(() => {
            const overdue = priority.all.filter((r) => r.daysOverdue > 0)
            const thisWeek = priority.all.filter((r) => r.daysOverdue === 0 && r.daysUntilDue <= 7)
            const within2w = priority.all.filter(
              (r) => r.daysOverdue === 0 && r.daysUntilDue > 7 && r.daysUntilDue <= 14
            )
            const groups = [
              { items: overdue, label: "已逾期", cls: "bg-red-50 border-red-200 text-red-800" },
              {
                items: thisWeek,
                label: "7 天內到期",
                cls: "bg-orange-50 border-orange-200 text-orange-800",
              },
              {
                items: within2w,
                label: "8–14 天到期",
                cls: "bg-yellow-50 border-yellow-200 text-yellow-800",
              },
            ]
            return groups.map((g) => {
              const sum = g.items.reduce((s, r) => s + r.unpaidAmount, 0)
              return (
                <div key={g.label} className={`rounded border p-2 text-sm ${g.cls}`}>
                  <div className="text-xs">{g.label}</div>
                  <div className="font-semibold">{formatNT(sum)}</div>
                  <div className="text-xs opacity-80">{g.items.length} 筆</div>
                </div>
              )
            })
          })()}
        </div>
      </Section>

      {/* 按專案 — 可展開看每筆細項 */}
      <Section title={`按專案分組（共 ${byProject.length} 個專案，點擊展開看細項）`}>
        <div className="space-y-1.5">
          {byProject.map((g) => (
            <ProjectGroup
              key={g.name}
              name={g.name}
              total={g.total}
              count={g.count}
              items={g.items}
              totalUnpaid={priority.totalUnpaid}
            />
          ))}
        </div>
      </Section>

      {/* Top 10 大筆 */}
      <Section title="最大筆 Top 10">
        <div className="space-y-1.5">
          {/* 顯示逾期天數讓使用者一眼看出「這筆是 N 天前的舊帳」 */}
          {top10.map((r) => (
            <ItemRow key={r.id} item={r} showOverdue={true} />
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Link href="/cash-allocation">
        <Button className="w-full" size="lg">
          進入現金分配助理
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────
// 逾期項目視圖
// ─────────────────────────────────────────────

function OverdueView({ priority }: { priority: PriorityReport | undefined }) {
  const overdue = useMemo(() => {
    if (!priority) return []
    return priority.all
      .filter((r) => r.daysOverdue > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
  }, [priority])

  if (!priority) return <Skeleton />
  if (overdue.length === 0) return <Empty msg="沒有逾期項目 ✅" />

  const totalOverdueAmount = overdue.reduce((s, r) => s + r.unpaidAmount, 0)
  const totalLateFee = overdue.reduce((s, r) => s + (r.lateFeeEstimate ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* 摘要 */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="逾期筆數" value={`${overdue.length} 筆`} variant="danger" />
        <Stat label="逾期總額" value={formatNT(totalOverdueAmount)} variant="danger" />
        <Stat label="累計滯納金" value={formatNT(totalLateFee)} variant="warning" />
      </div>

      {/* 列表 */}
      <Section title={`逾期清單（按逾期天數排序）`}>
        <div className="space-y-1.5">
          {overdue.map((r) => (
            <ItemRow key={r.id} item={r} showOverdue={true} />
          ))}
        </div>
      </Section>

      <Link href="/cash-allocation">
        <Button className="w-full" size="lg" variant="destructive">
          立刻分配現金處理逾期
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────
// 已產生滯納金視圖
// ─────────────────────────────────────────────

function LateFeeView({ priority }: { priority: PriorityReport | undefined }) {
  const items = useMemo(() => {
    if (!priority) return []
    return priority.all
      .filter((r) => r.lateFeeEstimate > 0)
      .sort((a, b) => b.lateFeeEstimate - a.lateFeeEstimate)
  }, [priority])

  if (!priority) return <Skeleton />
  if (items.length === 0) return <Empty msg="目前無累計滯納金 ✅" />

  const totalLateFee = items.reduce((s, r) => s + r.lateFeeEstimate, 0)

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-xs text-amber-700">已累計滯納金</div>
            <div className="text-2xl font-bold text-amber-800">{formatNT(totalLateFee)}</div>
            <div className="text-xs text-amber-700 mt-1">
              共 {items.length} 筆項目，每天還在增加
            </div>
          </div>
        </div>
      </div>

      <Section title="滯納金來源項目（按金額排序）">
        <div className="space-y-1.5">
          {items.map((r) => (
            <div key={r.id} className="rounded border p-2 bg-white">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{r.itemName}</span>
                <span className="text-sm font-semibold text-amber-700 whitespace-nowrap">
                  +{formatNT(r.lateFeeEstimate)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                <span>{r.projectName ?? "—"}</span>
                <span>逾期 {r.daysOverdue} 天</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Link href="/labor-insurance-watch">
        <Button className="w-full" size="lg" variant="outline">
          看完整滯納金監控
          <ExternalLink className="h-4 w-4 ml-1" />
        </Button>
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────
// 年度損失視圖
// ─────────────────────────────────────────────

function AnnualView({ annual }: { annual: AnnualLossReport | undefined }) {
  // 按月分組（Hook 必須在 early return 之前）
  const byMonth = useMemo(() => {
    if (!annual) return []
    const map = new Map<string, { total: number; count: number }>()
    for (const r of annual.items) {
      const month = r.dueDate.slice(0, 7)
      const g = map.get(month) ?? { total: 0, count: 0 }
      g.total += r.lateFee
      g.count += 1
      map.set(month, g)
    }
    return Array.from(map.entries())
      .map(([month, g]) => ({ month, ...g }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [annual])

  if (!annual) return <Skeleton />
  if (annual.totalLateFee === 0)
    return <Empty msg={`${annual.year} 年度沒有滯納金損失，做得好 ✅`} />

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-red-50 border border-red-200 p-3">
        <div className="text-xs text-red-700">{annual.year} 年度損失</div>
        <div className="text-2xl font-bold text-red-800">{formatNT(annual.totalLateFee)}</div>
        <div className="text-xs text-red-700 mt-1">
          佔本金 {annual.lossPercentage.toFixed(2)}% · 共 {annual.itemCount} 筆遲繳
        </div>
      </div>

      {byMonth.length > 0 && (
        <Section title="按月損失">
          <div className="space-y-1">
            {byMonth.map((m) => (
              <div key={m.month} className="flex items-center justify-between rounded border p-2">
                <span className="text-sm">{m.month}</span>
                <span className="text-sm font-semibold text-red-700">
                  {formatNT(m.total)}
                  <span className="ml-2 text-xs text-gray-500">({m.count} 筆)</span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Link href="/labor-insurance-watch">
        <Button className="w-full" size="lg" variant="outline">
          看完整滯納金監控
          <ExternalLink className="h-4 w-4 ml-1" />
        </Button>
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────
// 子元件
// ─────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700 mb-1.5">{title}</div>
      {children}
    </div>
  )
}

function Stat({
  label,
  value,
  variant,
}: {
  label: string
  value: string
  variant: "danger" | "warning" | "default"
}) {
  const cls = {
    danger: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    default: "bg-gray-50 border-gray-200 text-gray-800",
  }[variant]
  return (
    <div className={`rounded border p-2 ${cls}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-sm font-bold mt-0.5">{value}</div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 子元件：ProjectGroup（可展開看細項）
// ─────────────────────────────────────────────

function ProjectGroup({
  name,
  total,
  count,
  items,
  totalUnpaid,
}: {
  name: string
  total: number
  count: number
  items: PriorityResult[]
  totalUnpaid: number
}) {
  const [expanded, setExpanded] = useState(false)
  const pct = (total / totalUnpaid) * 100

  // 預設按金額排序展示
  const sortedItems = [...items].sort((a, b) => b.unpaidAmount - a.unpaidAmount)

  return (
    <div className="rounded border bg-white">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-2 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
            )}
            <span className="text-sm font-medium truncate">{name}</span>
          </div>
          <span className="text-sm font-semibold whitespace-nowrap">{formatNT(total)}</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden ml-5">
          <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="mt-0.5 flex items-center justify-between text-xs text-gray-500 ml-5">
          <span>{count} 筆</span>
          <span>{pct.toFixed(1)}%</span>
        </div>
      </button>
      {expanded && (
        <div className="border-t p-2 space-y-1.5 bg-gray-50/50">
          {sortedItems.map((it) => (
            <ItemRow key={it.id} item={it} showOverdue={true} />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, showOverdue }: { item: PriorityResult; showOverdue: boolean }) {
  const copyAmount = useCopyAmount()
  return (
    <div className="rounded border p-2 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{item.itemName}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
            <span className="truncate">{item.projectName ?? "—"}</span>
            <span>·</span>
            <span className="whitespace-nowrap">{item.dueDate}</span>
            {showOverdue && item.daysOverdue > 0 && (
              <Badge
                className="ml-auto text-[10px] py-0 h-4 bg-red-100 text-red-800 border-red-200"
                variant="outline"
              >
                逾期 {item.daysOverdue} 天
              </Badge>
            )}
            {showOverdue && item.daysOverdue === 0 && item.daysUntilDue >= 0 && (
              <Badge
                className={`ml-auto text-[10px] py-0 h-4 ${
                  item.daysUntilDue <= 3
                    ? "bg-orange-100 text-orange-800 border-orange-200"
                    : item.daysUntilDue <= 7
                      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                      : "bg-blue-100 text-blue-800 border-blue-200"
                }`}
                variant="outline"
              >
                {item.daysUntilDue === 0 ? "今天到期" : `剩 ${item.daysUntilDue} 天`}
              </Badge>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => copyAmount(item.unpaidAmount, item.itemName)}
          className="text-sm font-bold whitespace-nowrap inline-flex items-center gap-1 hover:underline"
          title="點擊複製金額"
        >
          {formatNT(item.unpaidAmount)}
          <Copy className="h-3 w-3 opacity-50" />
        </button>
      </div>
      {item.lateFeeEstimate > 0 && (
        <div className="mt-1 text-[11px] text-amber-700">
          已累計滯納金 +{formatNT(item.lateFeeEstimate)}
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-20 bg-gray-200 rounded" />
      <div className="h-32 bg-gray-200 rounded" />
      <div className="h-32 bg-gray-200 rounded" />
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-center py-12 text-sm text-gray-500">{msg}</div>
}
