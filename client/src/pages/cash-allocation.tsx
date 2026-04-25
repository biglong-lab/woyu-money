/**
 * 現金分配助理頁面
 *
 * 核心使命：告訴使用者「這週我 30 萬，該先付哪幾筆？」
 *
 * 設計哲學：
 * - 不是「列出所有欠款」，而是「給出可執行清單」
 * - 分 3 層：必須立刻付（Critical）/ 本週到期（High）/ 可延後
 * - 明示每筆的滯納金損失（讓拖延成本可見）
 */

import { useState, useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  Wallet,
  Clock,
  AlertTriangle,
  Copy,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { localDateISO, formatNT } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"

const BUDGET_PRESETS = [50000, 100000, 200000, 300000, 500000, 1000000]
const BUDGET_KEY = "cash-allocation:lastBudget"

// ─────────────────────────────────────────────
// API 型別（對應 server AllocationResult）
// ─────────────────────────────────────────────

type UrgencyLevel = "critical" | "high" | "medium" | "low"

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

interface AllocationResult {
  generatedAt: string
  availableBudget: number
  totalNeeded: number
  suggested: PriorityResult[]
  suggestedTotal: number
  deferred: PriorityResult[]
  deferredTotal: number
  shortage: number
  surplus: number
  markdown: string
}

interface PriorityReport {
  totalUnpaid: number
  counts: Record<UrgencyLevel, number>
  all: PriorityResult[]
}

// ─────────────────────────────────────────────
// 格式化輔助
// ─────────────────────────────────────────────

function parseBudgetInput(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "")
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

// ─────────────────────────────────────────────
// Urgency 顯示設定
// ─────────────────────────────────────────────

const URGENCY_STYLES: Record<
  UrgencyLevel,
  { label: string; subtitle: string; badge: string; border: string; bg: string; icon: string }
> = {
  critical: {
    label: "🔴 必須立刻付",
    subtitle: "有滯納金 / 強制執行風險，不能拖",
    badge: "bg-red-100 text-red-800",
    border: "border-red-300",
    bg: "bg-red-50",
    icon: "🔴",
  },
  high: {
    label: "🟠 本週內必須付",
    subtitle: "3 日內到期或有信用風險",
    badge: "bg-orange-100 text-orange-800",
    border: "border-orange-300",
    bg: "bg-orange-50",
    icon: "🟠",
  },
  medium: {
    label: "🟡 2 週內到期",
    subtitle: "有預算可納入本期處理",
    badge: "bg-yellow-100 text-yellow-800",
    border: "border-yellow-300",
    bg: "bg-yellow-50",
    icon: "🟡",
  },
  low: {
    label: "🟢 可稍後處理",
    subtitle: "無罰金或關係彈性，建議延後",
    badge: "bg-green-100 text-green-800",
    border: "border-green-300",
    bg: "bg-green-50",
    icon: "🟢",
  },
}

// ─────────────────────────────────────────────
// 子元件：單筆項目卡
// ─────────────────────────────────────────────

function ItemCard({
  item,
  onMarkPaid,
  isPending,
}: {
  item: PriorityResult
  onMarkPaid?: (item: PriorityResult) => void
  isPending?: boolean
}) {
  const style = URGENCY_STYLES[item.urgency]
  return (
    <div className={`rounded-lg border-l-4 ${style.border} ${style.bg} p-3 sm:p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{item.itemName}</h4>
            <Badge className={`text-xs ${style.badge}`} variant="outline">
              {item.categoryLabel}
            </Badge>
          </div>
          <div className="mt-1 text-xs text-gray-600 space-y-0.5">
            <div>
              到期日：{item.dueDate}
              {item.daysOverdue > 0 && (
                <span className="ml-2 text-red-700 font-medium">
                  （已逾期 {item.daysOverdue} 天）
                </span>
              )}
              {item.daysOverdue === 0 && item.daysUntilDue <= 7 && item.daysUntilDue > 0 && (
                <span className="ml-2 text-orange-700 font-medium">
                  （{item.daysUntilDue} 天後到期）
                </span>
              )}
            </div>
            {item.projectName && <div>專案：{item.projectName}</div>}
            {item.reasons.length > 0 && <div className="italic">{item.reasons.join("、")}</div>}
          </div>
          {item.lateFeeEstimate > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-red-700 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              已產生滯納金 {formatNT(item.lateFeeEstimate)}（每拖一天 +{formatNT(item.dailyLateFee)}
              ）
            </div>
          )}
          {onMarkPaid && (
            <div className="mt-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-xs h-7"
                onClick={() => onMarkPaid(item)}
                disabled={isPending}
                data-testid={`mark-paid-${item.id}`}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {isPending ? "處理中..." : "標記此筆已付"}
              </Button>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg sm:text-xl font-bold text-gray-900">
            {formatNT(item.unpaidAmount)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 子元件：依 urgency 分群顯示
// ─────────────────────────────────────────────

function UrgencyGroup({
  level,
  items,
  title,
  onMarkPaid,
  pendingId,
}: {
  level: UrgencyLevel
  items: PriorityResult[]
  title?: string
  onMarkPaid?: (item: PriorityResult) => void
  pendingId?: number | null
}) {
  if (items.length === 0) return null
  const style = URGENCY_STYLES[level]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">
          {title ?? style.label}（{items.length} 筆）
        </CardTitle>
        <CardDescription>{style.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onMarkPaid={onMarkPaid}
            isPending={pendingId === item.id}
          />
        ))}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 子元件：摘要卡
// ─────────────────────────────────────────────

function SummaryCard({ result }: { result: AllocationResult }) {
  const hasShortage = result.shortage > 0
  const hasSurplus = result.surplus > 0

  // 進度條：必須付 vs 可動用
  const max = Math.max(result.suggestedTotal, result.availableBudget)
  const suggestedPct = max > 0 ? (result.suggestedTotal / max) * 100 : 0
  const budgetPct = max > 0 ? (result.availableBudget / max) * 100 : 0

  return (
    <Card className={hasShortage ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}>
      <CardContent className="pt-6">
        {/* 視覺化進度條：必須付 vs 可動用 */}
        <div className="mb-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-700">必須支付</span>
            <span className={`font-semibold ${hasShortage ? "text-red-700" : "text-gray-900"}`}>
              {formatNT(result.suggestedTotal)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={hasShortage ? "h-full bg-red-500" : "h-full bg-green-500"}
              style={{ width: `${suggestedPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-700">可動用金額</span>
            <span className="font-semibold text-blue-700">{formatNT(result.availableBudget)}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-blue-400" style={{ width: `${budgetPct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600 flex items-center gap-1">
              <Wallet className="h-4 w-4" />
              可動用金額
            </div>
            <div className="text-xl sm:text-2xl font-bold">{formatNT(result.availableBudget)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              必須支付
            </div>
            <div className="text-xl sm:text-2xl font-bold text-red-700">
              {formatNT(result.suggestedTotal)}
            </div>
            <div className="text-xs text-gray-500">{result.suggested.length} 筆</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 flex items-center gap-1">
              <TrendingDown className="h-4 w-4" />
              可延後
            </div>
            <div className="text-xl sm:text-2xl font-bold text-gray-700">
              {formatNT(result.deferredTotal)}
            </div>
            <div className="text-xs text-gray-500">{result.deferred.length} 筆</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          {hasShortage && (
            <div className="flex items-start gap-2 text-red-800">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">缺口 {formatNT(result.shortage)}</div>
                <div className="text-sm">
                  Critical/High 項目已強制列入必須支付。你需要額外籌措 {formatNT(result.shortage)}{" "}
                  才能完成。
                </div>
              </div>
            </div>
          )}
          {hasSurplus && !hasShortage && (
            <div className="flex items-start gap-2 text-green-800">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">餘額 {formatNT(result.surplus)}</div>
                <div className="text-sm">付完建議清單後仍有餘裕，可視情況處理延後項目。</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 主頁面
// ─────────────────────────────────────────────

export default function CashAllocationPage() {
  useDocumentTitle("現金分配")
  const [budgetInput, setBudgetInput] = useState("")
  const [result, setResult] = useState<AllocationResult | null>(null)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const { toast } = useToast()

  // 取優先級報表，用來計算智能預設金額
  const { data: priority } = useQuery<PriorityReport>({
    queryKey: ["/api/payment/priority-report?includeLow=true"],
  })

  // 智能預設金額（依目前未付狀況動態算）
  const smartPresets = (() => {
    if (!priority) return null
    const criticalSum = priority.all
      .filter((r) => r.urgency === "critical")
      .reduce((s, r) => s + r.unpaidAmount, 0)
    const highSum = priority.all
      .filter((r) => r.urgency === "high")
      .reduce((s, r) => s + r.unpaidAmount, 0)
    const mediumSum = priority.all
      .filter((r) => r.urgency === "medium")
      .reduce((s, r) => s + r.unpaidAmount, 0)
    return {
      critical: Math.ceil(criticalSum),
      thisWeek: Math.ceil(criticalSum + highSum),
      thisMonth: Math.ceil(criticalSum + highSum + mediumSum),
    }
  })()

  // 載入上次輸入金額並自動計算（不用使用者再點按鈕）
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BUDGET_KEY)
      if (saved) {
        const n = Number(saved)
        if (Number.isFinite(n) && n > 0) {
          setBudgetInput(n.toLocaleString())
          // 延遲一點讓 UI 先 render，再觸發計算
          setTimeout(() => mutation.mutate(n), 100)
        }
      }
    } catch {
      // localStorage 不可用，忽略
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mutation = useMutation<AllocationResult, Error, number>({
    mutationFn: async (availableBudget: number) => {
      return apiRequest<AllocationResult>("POST", "/api/payment/allocation-suggest", {
        availableBudget,
      })
    },
    onSuccess: (data, budget) => {
      setResult(data)
      try {
        localStorage.setItem(BUDGET_KEY, String(budget))
      } catch {
        // localStorage 不可用，忽略
      }
    },
    onError: (err) => {
      toast({
        title: "無法取得分配建議",
        description: err.message,
        variant: "destructive",
      })
    },
  })

  const markPaidMutation = useMutation<unknown, Error, PriorityResult>({
    mutationFn: (item) =>
      apiRequest("POST", "/api/payment/records", {
        itemId: item.id,
        amountPaid: item.unpaidAmount,
        paymentDate: localDateISO(),
      }),
    onMutate: (item) => setPendingId(item.id),
    onSuccess: (_data, item) => {
      toast({
        title: "已標記為已付款",
        description: `${item.itemName}（${formatNT(item.unpaidAmount)}）`,
      })
      // 重新計算分配
      const budget = parseBudgetInput(budgetInput)
      if (budget !== null) mutation.mutate(budget)
      queryClient.invalidateQueries({ queryKey: ["/api/payment/priority-report?includeLow=true"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
    },
    onSettled: () => setPendingId(null),
    onError: (err) =>
      toast({ title: "標記失敗", description: err.message, variant: "destructive" }),
  })

  const handleMarkPaid = (item: PriorityResult) => {
    markPaidMutation.mutate(item)
  }

  const handlePresetClick = (amount: number) => {
    setBudgetInput(amount.toLocaleString())
    mutation.mutate(amount)
  }

  // 即時千分位格式化（去除非數字後重新加逗號）
  const handleBudgetChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, "")
    if (!cleaned) {
      setBudgetInput("")
      return
    }
    const n = Number(cleaned)
    if (Number.isFinite(n)) setBudgetInput(n.toLocaleString())
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const budget = parseBudgetInput(budgetInput)
    if (budget === null) {
      toast({
        title: "金額格式錯誤",
        description: "請輸入非負數字（可用逗號分隔，例如 300,000）",
        variant: "destructive",
      })
      return
    }
    mutation.mutate(budget)
  }

  const suggestedCritical = result?.suggested.filter((r) => r.urgency === "critical") ?? []
  const suggestedHigh = result?.suggested.filter((r) => r.urgency === "high") ?? []
  const suggestedMedium = result?.suggested.filter((r) => r.urgency === "medium") ?? []
  const suggestedLow = result?.suggested.filter((r) => r.urgency === "low") ?? []

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 頁首 */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">💰 現金分配助理</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600">
          告訴系統你有多少錢，我告訴你該先付哪幾筆（自動計算滯納金損失、違約後果、彈性空間）
        </p>
      </div>

      {/* 輸入表單 */}
      <Card>
        <CardHeader>
          <CardTitle>這週/這期可動用多少？</CardTitle>
          <CardDescription>輸入手上可付的金額，系統依滯納金 + 違約後果排序建議</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="budget">可動用金額（NT$）</Label>
              <Input
                id="budget"
                inputMode="numeric"
                placeholder="例如：300,000"
                value={budgetInput}
                onChange={(e) => handleBudgetChange(e.target.value)}
                disabled={mutation.isPending}
                data-testid="input-budget"
              />
            </div>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-suggest">
              {mutation.isPending ? "計算中..." : "計算分配建議"}
            </Button>
          </form>

          {/* 智能預設按鈕（依目前未付狀況計算） */}
          {smartPresets && (smartPresets.critical > 0 || smartPresets.thisWeek > 0) && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs text-gray-500 self-center mr-1">💡 智能：</span>
              {smartPresets.critical > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetClick(smartPresets.critical)}
                  disabled={mutation.isPending}
                  className="text-xs h-7 border-red-300 text-red-700 hover:bg-red-50"
                  data-testid="smart-preset-critical"
                  title={`正好付清所有緊急項目（${formatNT(smartPresets.critical)}）`}
                >
                  🔴 付清緊急 {formatNT(smartPresets.critical)}
                </Button>
              )}
              {smartPresets.thisWeek > smartPresets.critical && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetClick(smartPresets.thisWeek)}
                  disabled={mutation.isPending}
                  className="text-xs h-7 border-orange-300 text-orange-700 hover:bg-orange-50"
                  data-testid="smart-preset-week"
                  title={`付清本週到期（${formatNT(smartPresets.thisWeek)}）`}
                >
                  🟠 付清本週 {formatNT(smartPresets.thisWeek)}
                </Button>
              )}
              {smartPresets.thisMonth > smartPresets.thisWeek && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetClick(smartPresets.thisMonth)}
                  disabled={mutation.isPending}
                  className="text-xs h-7 border-yellow-300 text-yellow-800 hover:bg-yellow-50"
                  data-testid="smart-preset-month"
                  title={`付清本月應付（${formatNT(smartPresets.thisMonth)}）`}
                >
                  🟡 付清本月 {formatNT(smartPresets.thisMonth)}
                </Button>
              )}
            </div>
          )}

          {/* 快捷金額按鈕 */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-xs text-gray-500 self-center mr-1">快捷：</span>
            {BUDGET_PRESETS.map((amount) => (
              <Button
                key={amount}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(amount)}
                disabled={mutation.isPending}
                className="text-xs h-7"
                data-testid={`preset-${amount}`}
              >
                {amount >= 10000 ? `${amount / 10000}萬` : amount.toLocaleString()}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 空狀態提示 */}
      {!result && !mutation.isPending && (
        <Card className="bg-gray-50">
          <CardContent className="pt-6 text-center text-gray-600">
            <p className="text-sm">
              輸入可動用金額後，系統會依「滯納金率 × 違約後果 × 逾期天數」自動排序，告訴你：
            </p>
            <ul className="mt-3 text-sm text-left max-w-md mx-auto space-y-1">
              <li>🔴 必須立刻付（勞健保、稅、銀行貸款等不能拖的）</li>
              <li>🟠 本週內到期（3 日內到期或有信用風險）</li>
              <li>🟡 可視預算處理（2 週內到期）</li>
              <li>🟢 可延後（無罰金或關係彈性）</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 結果 */}
      {result && result.suggested.length === 0 && result.deferred.length === 0 && (
        <Card className="border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="pt-10 pb-10 text-center">
            <div className="text-6xl mb-3 animate-bounce">🎉</div>
            <h3 className="text-xl sm:text-2xl font-bold text-green-700">太棒了！全部都付清</h3>
            <p className="mt-2 text-sm text-gray-600">
              目前沒有未付項目，財務狀態很健康！
              <br />
              繼續保持，準時付款可避免滯納金損失。
            </p>
          </CardContent>
        </Card>
      )}

      {result && (result.suggested.length > 0 || result.deferred.length > 0) && (
        <div className="space-y-4 sm:space-y-6" data-testid="allocation-result">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.markdown)
                  toast({ title: "已複製建議清單", description: "可貼到 LINE / 備忘錄" })
                } catch {
                  toast({
                    title: "複製失敗",
                    description: "瀏覽器不支援",
                    variant: "destructive",
                  })
                }
              }}
              data-testid="copy-allocation-md"
            >
              <Copy className="h-3 w-3 mr-1" />
              複製建議清單
            </Button>
          </div>
          <SummaryCard result={result} />

          <UrgencyGroup
            level="critical"
            items={suggestedCritical}
            onMarkPaid={handleMarkPaid}
            pendingId={pendingId}
          />
          <UrgencyGroup
            level="high"
            items={suggestedHigh}
            onMarkPaid={handleMarkPaid}
            pendingId={pendingId}
          />
          <UrgencyGroup
            level="medium"
            items={suggestedMedium}
            onMarkPaid={handleMarkPaid}
            pendingId={pendingId}
          />
          <UrgencyGroup
            level="low"
            items={suggestedLow}
            title="🟢 本期可納入（餘額充足）"
            onMarkPaid={handleMarkPaid}
            pendingId={pendingId}
          />

          {result.deferred.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">
                  ⏸️ 建議延後（{result.deferred.length} 筆，共 {formatNT(result.deferredTotal)}）
                </CardTitle>
                <CardDescription>預算不足或無罰金，可延到下期處理</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.deferred.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onMarkPaid={handleMarkPaid}
                    isPending={pendingId === item.id}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
