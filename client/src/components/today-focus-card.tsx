/**
 * 今日焦點卡片（Today Focus Card）
 *
 * 設計哲學：
 * - 破解「看到一堆欠款 → 逃避」的惡性循環
 * - 預設只顯示「今天 1 件事」，完成一件才看下一件
 * - 漸進揭露：本日 → 本週 → 本月 → 全部
 * - 每筆強調：拖延成本（已滯納金 + 每日新增）
 *
 * 呼叫 API：
 * - GET  /api/payment/priority-report?includeLow=true
 * - POST /api/payment/records        （標記已付）
 */

import { useState, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Link } from "wouter"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Copy,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { localDateISO, formatNT, friendlyApiError } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useCopyAmount } from "@/hooks/use-copy-amount"

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────

type UrgencyLevel = "critical" | "high" | "medium" | "low"
type ViewScope = "today" | "week" | "month" | "all"

interface PriorityResult {
  id: number
  itemName: string
  unpaidAmount: number
  dueDate: string
  category: string
  categoryLabel: string
  daysOverdue: number
  daysUntilDue: number
  score: number
  urgency: UrgencyLevel
  lateFeeEstimate: number
  dailyLateFee: number
  reasons: string[]
  projectName?: string
}

interface PriorityReport {
  generatedAt: string
  totalUnpaid: number
  counts: Record<UrgencyLevel, number>
  byUrgency: Record<UrgencyLevel, PriorityResult[]>
  all: PriorityResult[]
}

// ─────────────────────────────────────────────
// 輔助函式
// ─────────────────────────────────────────────

function todayISODate(): string {
  return localDateISO(0)
}

const SCOPE_FILTERS: Record<ViewScope, UrgencyLevel[]> = {
  today: ["critical"],
  week: ["critical", "high"],
  month: ["critical", "high", "medium"],
  all: ["critical", "high", "medium", "low"],
}

function filterByScope(items: PriorityResult[], scope: ViewScope): PriorityResult[] {
  const allowed = SCOPE_FILTERS[scope]
  return items.filter((item) => allowed.includes(item.urgency))
}

// ─────────────────────────────────────────────
// 子元件：Scope 切換（本日 / 本週 / 本月 / 全部）
// ─────────────────────────────────────────────

interface ScopeTabsProps {
  scope: ViewScope
  onChange: (scope: ViewScope) => void
  counts: Record<ViewScope, number>
}

function ScopeTabs({ scope, onChange, counts }: ScopeTabsProps) {
  const tabs: { value: ViewScope; label: string }[] = [
    { value: "today", label: "本日" },
    { value: "week", label: "本週" },
    { value: "month", label: "本月" },
    { value: "all", label: "全部" },
  ]
  return (
    <div className="flex gap-1 border-b overflow-x-auto">
      {tabs.map((tab) => {
        const active = scope === tab.value
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors
              ${active ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-500 hover:text-gray-700"}
            `}
            data-testid={`scope-tab-${tab.value}`}
          >
            {tab.label}
            <span
              className={`ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs rounded-full
                ${active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}
              `}
            >
              {counts[tab.value]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// 子元件：主焦點卡片（當前項目）
// ─────────────────────────────────────────────

interface FocusCardProps {
  item: PriorityResult
  position: number
  total: number
  onMarkPaid: () => void
  onDefer: () => void
  onCopyAmount: (amount: number, label?: string) => void
}

function FocusCard({ item, position, total, onMarkPaid, onDefer, onCopyAmount }: FocusCardProps) {
  const isOverdue = item.daysOverdue > 0
  return (
    <div className="rounded-lg border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-500">
          {position} / {total} 筆
        </div>
        <Badge variant="outline" className="text-xs">
          {item.categoryLabel}
        </Badge>
      </div>

      <h3 className="text-lg sm:text-xl font-bold text-gray-900">{item.itemName}</h3>
      <div className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900">
        <button
          type="button"
          onClick={() => onCopyAmount(item.unpaidAmount, item.itemName)}
          className="hover:text-blue-600 hover:underline cursor-pointer text-left inline-flex items-center gap-1.5"
          title="點擊複製數字（轉帳貼網銀用）"
          data-testid="focus-amount-copy"
        >
          {formatNT(item.unpaidAmount)}
          <Copy className="h-4 w-4 opacity-40" />
        </button>
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-gray-700">
          <Clock className="h-4 w-4 shrink-0" />
          <span>到期日：{item.dueDate}</span>
          {isOverdue && (
            <span className="text-red-700 font-semibold">（已逾期 {item.daysOverdue} 天）</span>
          )}
          {!isOverdue && item.daysUntilDue <= 7 && (
            <span className="text-amber-700 font-semibold">（{item.daysUntilDue} 天後到期）</span>
          )}
        </div>

        {item.projectName && <div className="text-xs text-gray-500">專案：{item.projectName}</div>}

        {item.lateFeeEstimate > 0 && (
          <div className="flex items-start gap-2 text-red-700 bg-red-50 rounded p-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="text-xs">
              已產生滯納金 <strong>{formatNT(item.lateFeeEstimate)}</strong>
              <br />
              每拖 1 天再多 <strong>{formatNT(item.dailyLateFee)}</strong>
            </div>
          </div>
        )}

        {item.reasons.length > 0 && item.lateFeeEstimate === 0 && (
          <div className="text-xs text-gray-600 italic">{item.reasons.join("、")}</div>
        )}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <Button
          onClick={onMarkPaid}
          className="flex-1 bg-green-600 hover:bg-green-700"
          data-testid="button-mark-paid"
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          已付款
        </Button>
        <Button onClick={onDefer} variant="outline" className="flex-1" data-testid="button-defer">
          ⏰ 晚點再看
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 子元件：確認付款對話框
// ─────────────────────────────────────────────

interface PaidDialogProps {
  item: PriorityResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (paymentDate: string, amountPaid: number) => void
  isPending: boolean
}

function PaidDialog({ item, open, onOpenChange, onConfirm, isPending }: PaidDialogProps) {
  const [paymentDate, setPaymentDate] = useState(todayISODate())
  const [amountInput, setAmountInput] = useState("")

  // 開啟時自動帶入應付金額
  useMemo(() => {
    if (item && open) {
      setAmountInput(String(Math.round(item.unpaidAmount)))
      setPaymentDate(todayISODate())
    }
  }, [item, open])

  if (!item) return null

  const parsedAmount = parseFloat(amountInput.replace(/[,\s]/g, ""))
  const isPartial = Number.isFinite(parsedAmount) && parsedAmount < item.unpaidAmount
  const isOverpaid = Number.isFinite(parsedAmount) && parsedAmount > item.unpaidAmount
  const isInvalid = !Number.isFinite(parsedAmount) || parsedAmount <= 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>確認付款</DialogTitle>
          <DialogDescription>
            {isPartial ? (
              <>
                將把 <strong>{item.itemName}</strong> 標記為<strong>部分付款</strong>
              </>
            ) : (
              <>
                將把 <strong>{item.itemName}</strong> 標記為已全額付款
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">項目</span>
            <span className="font-medium">{item.itemName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">應付金額</span>
            <span className="text-gray-700">{formatNT(item.unpaidAmount)}</span>
          </div>
          <div className="space-y-1">
            <label htmlFor="paid-amount" className="text-sm text-gray-600">
              實際付款金額 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">NT$</span>
              <input
                id="paid-amount"
                type="number"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isInvalid && !isPending) {
                    e.preventDefault()
                    onConfirm(paymentDate, parsedAmount)
                  }
                }}
                className="border rounded pl-12 pr-2 py-2 text-base font-bold w-full"
                data-testid="input-paid-amount"
              />
            </div>
            {!isInvalid && parsedAmount > 0 && (
              <div className="text-xs text-blue-700 font-medium">= {formatNT(parsedAmount)}</div>
            )}
            {isPartial && (
              <div className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">
                ⚠️ 此為部分付款，剩餘 {formatNT(item.unpaidAmount - parsedAmount)} 仍會列為待付
              </div>
            )}
            {isOverpaid && (
              <div className="text-xs text-orange-700 bg-orange-50 rounded px-2 py-1">
                ⚠️ 超付 {formatNT(parsedAmount - item.unpaidAmount)}，請確認金額正確
              </div>
            )}
          </div>
          <div className="flex justify-between items-center text-sm">
            <label htmlFor="payment-date" className="text-gray-600">
              付款日期
            </label>
            <input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
              data-testid="input-payment-date"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button
            onClick={() => onConfirm(paymentDate, parsedAmount)}
            disabled={isPending || isInvalid}
            data-testid="button-confirm-paid"
          >
            {isPending ? "處理中..." : "確認付款"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────
// 子元件：空狀態
// ─────────────────────────────────────────────

function EmptyState({
  scope,
  nextUpcoming,
}: {
  scope: ViewScope
  nextUpcoming?: PriorityResult | null
}) {
  const messages: Record<ViewScope, string> = {
    today: "🎉 今天沒有緊急事項，可以稍微放鬆",
    week: "✅ 本週沒有待處理項目",
    month: "✅ 本月沒有需緊急處理的項目",
    all: "✨ 所有款項都已處理完畢",
  }
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
      <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-2" />
      <div className="text-sm text-gray-700">{messages[scope]}</div>
      {nextUpcoming && scope === "today" && (
        <div className="mt-4 pt-3 border-t border-green-200 text-xs">
          <div className="text-gray-500 mb-1">下一個截止</div>
          <div className="font-semibold text-gray-900">{nextUpcoming.itemName}</div>
          <div className="text-gray-700 mt-0.5">{formatNT(nextUpcoming.unpaidAmount)}</div>
          <div className="text-gray-500 mt-0.5">
            {nextUpcoming.dueDate}（{nextUpcoming.daysUntilDue} 天後）
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────

// localStorage key + helpers：每天重置完成計數
const COMPLETED_KEY = "today-focus:completed"
function loadCompleted(): { date: string; count: number; amount: number } {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { date: string; count: number; amount: number }
      const today = localDateISO(0)
      if (parsed.date === today) return parsed
    }
  } catch {
    // ignore
  }
  return { date: localDateISO(0), count: 0, amount: 0 }
}
function saveCompleted(state: { date: string; count: number; amount: number }) {
  try {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

// 連續記錄 streak（培養習慣）
const STREAK_KEY = "today-focus:streak"
interface StreakState {
  lastDate: string
  days: number
}
function loadStreak(): StreakState {
  try {
    const raw = localStorage.getItem(STREAK_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StreakState
      const today = localDateISO(0)
      const yesterday = localDateISO(-1)
      // 最後付款日是昨天或今天 → 維持；否則歸零（中斷）
      if (parsed.lastDate === today || parsed.lastDate === yesterday) {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return { lastDate: "", days: 0 }
}
function saveStreak(state: StreakState) {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}
// Skipped IDs 持久化（同日有效）
const SKIPPED_KEY = "today-focus:skipped"
interface SkippedState {
  date: string
  ids: number[]
}
function loadSkipped(): Set<number> {
  try {
    const raw = localStorage.getItem(SKIPPED_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SkippedState
      const today = localDateISO(0)
      // 只在同一天有效，跨日自動清空
      if (parsed.date === today && Array.isArray(parsed.ids)) {
        return new Set(parsed.ids)
      }
    }
  } catch {
    // ignore
  }
  return new Set()
}
function saveSkipped(ids: Set<number>) {
  try {
    const state: SkippedState = { date: localDateISO(0), ids: Array.from(ids) }
    localStorage.setItem(SKIPPED_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

function bumpStreak(prev: StreakState): StreakState {
  const today = localDateISO(0)
  const yesterday = localDateISO(-1)
  if (prev.lastDate === today) return prev // 今天已計
  if (prev.lastDate === yesterday) return { lastDate: today, days: prev.days + 1 }
  return { lastDate: today, days: 1 } // 中斷後重啟
}

export function TodayFocusCard() {
  const { toast } = useToast()
  const [scope, setScope] = useState<ViewScope>("today")
  const [skippedIds, setSkippedIds] = useState<Set<number>>(loadSkipped)
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payingItem, setPayingItem] = useState<PriorityResult | null>(null)
  const [completed, setCompleted] = useState(loadCompleted)
  const [streak, setStreak] = useState(loadStreak)

  const { data: report, isLoading } = useQuery<PriorityReport>({
    queryKey: ["/api/payment/priority-report?includeLow=true"],
  })

  // 依 scope 篩選 + 排除已跳過
  const visibleItems = useMemo(() => {
    if (!report) return []
    return filterByScope(report.all, scope).filter((item) => !skippedIds.has(item.id))
  }, [report, scope, skippedIds])

  // 下一個即將到期項目（給 today 空狀態 preview 用）
  const nextUpcoming = useMemo(() => {
    if (!report) return null
    const upcoming = report.all
      .filter((r) => !skippedIds.has(r.id) && r.daysUntilDue > 0)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    return upcoming[0] ?? null
  }, [report, skippedIds])

  // 各 scope 的計數（供 tab 顯示）
  const scopeCounts: Record<ViewScope, number> = useMemo(() => {
    if (!report) return { today: 0, week: 0, month: 0, all: 0 }
    return {
      today: filterByScope(report.all, "today").length,
      week: filterByScope(report.all, "week").length,
      month: filterByScope(report.all, "month").length,
      all: filterByScope(report.all, "all").length,
    }
  }, [report])

  // 標記已付款
  const markPaidMutation = useMutation<
    unknown,
    Error,
    { itemId: number; amountPaid: number; paymentDate: string }
  >({
    mutationFn: async (data) => {
      return apiRequest("POST", "/api/payment/records", {
        itemId: data.itemId,
        amountPaid: data.amountPaid,
        paymentDate: data.paymentDate,
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/priority-report?includeLow=true"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/records"] })
      // 累計今日已完成
      const today = localDateISO(0)
      const next =
        completed.date === today
          ? {
              ...completed,
              count: completed.count + 1,
              amount: completed.amount + variables.amountPaid,
            }
          : { date: today, count: 1, amount: variables.amountPaid }
      setCompleted(next)
      saveCompleted(next)
      // 更新 streak
      const nextStreak = bumpStreak(streak)
      setStreak(nextStreak)
      saveStreak(nextStreak)
      toast({ title: "已標記為已付款", description: "正在載入下一筆..." })
      setPayDialogOpen(false)
      setPayingItem(null)
    },
    onError: (err) => {
      toast({
        title: "付款失敗",
        description: friendlyApiError(err),
        variant: "destructive",
      })
    },
  })

  const current = visibleItems[0]

  const handleMarkPaidClick = () => {
    if (!current) return
    setPayingItem(current)
    setPayDialogOpen(true)
  }

  const handleConfirmPaid = (paymentDate: string, amountPaid: number) => {
    if (!payingItem) return
    markPaidMutation.mutate({
      itemId: payingItem.id,
      amountPaid,
      paymentDate,
    })
  }

  const handleDefer = () => {
    if (!current) return
    setSkippedIds((prev) => {
      const next = new Set(prev).add(current.id)
      saveSkipped(next)
      return next
    })
  }

  const handleResetSkipped = () => {
    setSkippedIds(new Set())
    saveSkipped(new Set())
  }

  // 一鍵複製金額（給轉帳貼到網銀用）— 使用統一 hook
  const handleCopyAmount = useCopyAmount()

  // 複製今日清單為 LINE 風格訊息
  const handleCopyDigest = async () => {
    const items = visibleItems.slice(0, 10)
    if (items.length === 0) return
    const today = new Date()
    const dateStr = `${today.getMonth() + 1}/${today.getDate()}`
    const total = items.reduce((s, r) => s + r.unpaidAmount, 0)
    const lines = items.map((item, i) => {
      const icon = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[item.urgency]
      const suffix = item.daysOverdue > 0 ? `（逾期 ${item.daysOverdue} 天）` : ""
      return `${i + 1}. ${icon} ${item.itemName}\n   ${formatNT(item.unpaidAmount)}${suffix}`
    })
    const text =
      `📅 ${dateStr} 待付款清單（${items.length} 件）：\n\n` +
      lines.join("\n\n") +
      `\n\n💰 合計：${formatNT(total)}`
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "已複製到剪貼簿", description: "可貼到 LINE / 備忘錄" })
    } catch {
      toast({
        title: "複製失敗",
        description: "瀏覽器不支援，請手動截圖",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <Card className="border-amber-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-5 w-24 bg-amber-100 rounded animate-pulse" />
              <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 w-14 bg-gray-100 rounded-t animate-pulse" />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border-2 border-amber-100 bg-amber-50/40 p-4 space-y-3">
            <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
            <div className="flex gap-2 pt-2">
              <div className="h-9 flex-1 bg-green-100 rounded animate-pulse" />
              <div className="h-9 flex-1 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-200" data-testid="today-focus-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2 flex-wrap">
              <Sparkles className="h-5 w-5 text-amber-600" />
              今日焦點
              {streak.days >= 2 && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full"
                  title={`連續 ${streak.days} 天有付款記錄，繼續保持！`}
                  data-testid="streak-badge"
                >
                  🔥 連續 {streak.days} 天
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              專注在最該處理的 1 件事，完成後自動顯示下一件
            </CardDescription>
          </div>
          <div className="text-right text-xs">
            {completed.count > 0 ? (
              <>
                <div className="text-green-600 font-medium">今天 ✨ {completed.count} 件</div>
                <div className="text-gray-500">{formatNT(completed.amount)}</div>
              </>
            ) : (
              report &&
              report.totalUnpaid > 0 && (
                <>
                  <div className="text-gray-500">總未付</div>
                  <div className="font-bold text-gray-900">{formatNT(report.totalUnpaid)}</div>
                </>
              )
            )}
          </div>
        </div>
        <ScopeTabs scope={scope} onChange={setScope} counts={scopeCounts} />
      </CardHeader>
      <CardContent className="space-y-3">
        {current ? (
          <FocusCard
            item={current}
            position={1}
            total={visibleItems.length}
            onMarkPaid={handleMarkPaidClick}
            onDefer={handleDefer}
            onCopyAmount={handleCopyAmount}
          />
        ) : (
          <EmptyState scope={scope} nextUpcoming={nextUpcoming} />
        )}

        {skippedIds.size > 0 && (
          <button
            onClick={handleResetSkipped}
            className="text-xs text-blue-600 hover:underline"
            type="button"
          >
            已跳過 {skippedIds.size} 筆，點此復原
          </button>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t flex-wrap">
          {visibleItems.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={handleCopyDigest}
              data-testid="copy-digest"
              title={`複製目前 ${Math.min(visibleItems.length, 10)} 筆到剪貼簿`}
            >
              <Copy className="h-3 w-3 mr-1" />
              複製清單 ({Math.min(visibleItems.length, 10)})
            </Button>
          )}
          <Link href="/cash-allocation">
            <Button variant="ghost" size="sm" className="text-xs">
              現金分配助理
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
          <Link href="/payment-schedule">
            <Button variant="ghost" size="sm" className="text-xs">
              看全部排程
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>

      <PaidDialog
        item={payingItem}
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        onConfirm={handleConfirmPaid}
        isPending={markPaidMutation.isPending}
      />
    </Card>
  )
}
