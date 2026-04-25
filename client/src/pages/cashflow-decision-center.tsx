/**
 * 現金流決策中心（第 9 步）
 * 未來 3~6 個月收支預估 + 缺口警示 + 行動建議
 */

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { localDateISO, formatNT, friendlyApiError } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useCopyAmount } from "@/hooks/use-copy-amount"
import { useDocumentTitle } from "@/hooks/use-document-title"

type Basis = "last_year_same_month" | "recent_average" | "overall_average" | "no_data"
type Confidence = "high" | "medium" | "low"

interface ForecastMonth {
  year: number
  month: number
  estimated: number
  basis: Basis
  confidence: Confidence
}

interface GapItem {
  year: number
  month: number
  estimatedIncome: number
  estimatedExpense: number
  net: number
  gap?: number
  recommendation?: string
}

interface ForecastResponse {
  generatedAt: string
  monthsAhead: number
  forecast: {
    months: ForecastMonth[]
    trend: { growthRate: number; recentAvg: number; lastYearAvg: number }
  }
  gapAnalysis: GapItem[]
  hasShortage: boolean
}

const CONFIDENCE_META: Record<Confidence, { label: string; color: string }> = {
  high: { label: "高信心", color: "bg-green-100 text-green-800" },
  medium: { label: "中信心", color: "bg-yellow-100 text-yellow-800" },
  low: { label: "低信心", color: "bg-gray-100 text-gray-700" },
}

const BASIS_LABEL: Record<Basis, string> = {
  last_year_same_month: "去年同月 × 成長率",
  recent_average: "近期平均",
  overall_average: "整體平均",
  no_data: "無歷史資料",
}

interface MonthDetailItem {
  id: number
  itemName: string
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
  dueDate: string
  projectName: string | null
  categoryName: string | null
}
interface MonthDetailData {
  year: number
  month: number
  count: number
  totalUnpaid: number
  items: MonthDetailItem[]
}

function MonthDetail({ year, month }: { year: number; month: number }) {
  const { toast } = useToast()
  const copyAmount = useCopyAmount()
  const [pendingId, setPendingId] = useState<number | null>(null)
  const queryKey = [`/api/cashflow/month-detail?year=${year}&month=${month}`]
  const { data, isLoading } = useQuery<MonthDetailData>({ queryKey })

  const markPaidMutation = useMutation<unknown, Error, MonthDetailItem>({
    mutationFn: (item) =>
      apiRequest("POST", `/api/payment/items/${item.id}/payments`, {
        amount: item.unpaidAmount,
        paymentDate: localDateISO(),
      }),
    onMutate: (item) => setPendingId(item.id),
    onSuccess: (_data, item) => {
      toast({ title: "已標記為已付", description: item.itemName })
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/forecast"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/priority-report?includeLow=true"] })
    },
    onSettled: () => setPendingId(null),
    onError: (err) =>
      toast({ title: "標記失敗", description: friendlyApiError(err), variant: "destructive" }),
  })

  if (isLoading) return <div className="text-xs text-gray-500 p-2">載入中...</div>
  if (!data || data.count === 0)
    return <div className="text-xs text-gray-500 p-2">該月無未付項目明細</div>
  return (
    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
      <div className="text-xs text-gray-600">
        共 {data.count} 筆未付，{formatNT(data.totalUnpaid)}
      </div>
      <ul className="text-xs space-y-1 max-h-64 overflow-y-auto">
        {data.items.slice(0, 20).map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 py-1">
            <div className="flex-1 min-w-0">
              <span className="truncate block">
                {item.itemName}
                {item.projectName && (
                  <span className="text-gray-400 ml-1">· {item.projectName}</span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                copyAmount(item.unpaidAmount, item.itemName)
              }}
              className="shrink-0 font-medium hover:text-blue-600 hover:underline cursor-pointer"
              title="點擊複製金額"
              data-testid={`copy-cashflow-amount-${item.id}`}
            >
              {formatNT(item.unpaidAmount)}
            </button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-[10px] h-6 px-2 shrink-0"
              onClick={() => markPaidMutation.mutate(item)}
              disabled={pendingId === item.id}
              data-testid={`cashflow-mark-paid-${item.id}`}
            >
              {pendingId === item.id ? "..." : "已付"}
            </Button>
          </li>
        ))}
        {data.count > 20 && <li className="text-gray-400 italic">…還有 {data.count - 20} 筆</li>}
      </ul>
    </div>
  )
}

function MonthCard({ forecast, gap }: { forecast: ForecastMonth; gap: GapItem }) {
  const [expanded, setExpanded] = useState(false)
  const copyAmount = useCopyAmount()
  const hasGap = gap.gap !== undefined && gap.gap > 0
  const hasExpense = gap.estimatedExpense > 0
  const cls = hasGap ? "border-red-300 bg-red-50" : "border-green-200 bg-green-50"
  const conf = CONFIDENCE_META[forecast.confidence]
  const monthLabel = `${forecast.year}/${String(forecast.month).padStart(2, "0")}`
  return (
    <div className={`rounded-lg border-l-4 p-3 ${cls}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">{monthLabel}</div>
        <Badge className={`text-xs ${conf.color}`} variant="outline">
          {conf.label}
        </Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-gray-500">預估收入</div>
          <button
            type="button"
            onClick={() => copyAmount(gap.estimatedIncome, `${monthLabel} 預估收入`)}
            className="font-semibold text-green-700 hover:underline cursor-pointer"
            title="點擊複製金額"
          >
            {formatNT(gap.estimatedIncome)}
          </button>
        </div>
        <div>
          <div className="text-gray-500">預估支出</div>
          <button
            type="button"
            onClick={() => copyAmount(gap.estimatedExpense, `${monthLabel} 預估支出`)}
            className="font-semibold text-red-700 hover:underline cursor-pointer"
            title="點擊複製金額"
          >
            {formatNT(gap.estimatedExpense)}
          </button>
        </div>
        <div>
          <div className="text-gray-500">淨額</div>
          <button
            type="button"
            onClick={() => copyAmount(gap.net, `${monthLabel} 淨額`)}
            className={`font-bold hover:underline cursor-pointer ${
              gap.net >= 0 ? "text-gray-900" : "text-red-700"
            }`}
            title="點擊複製金額"
          >
            {formatNT(gap.net)}
          </button>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500">來源：{BASIS_LABEL[forecast.basis]}</div>
      {hasGap && gap.recommendation && (
        <div className="mt-2 flex items-start gap-2 text-xs text-red-800 bg-red-100 rounded p-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>
            <button
              type="button"
              onClick={() => copyAmount(gap.gap ?? 0, `${monthLabel} 缺口`)}
              className="font-semibold hover:underline cursor-pointer"
              title="點擊複製缺口金額（要籌的錢）"
            >
              缺口 {formatNT(gap.gap ?? 0)}
            </button>
            <div>{gap.recommendation}</div>
          </div>
        </div>
      )}
      {hasExpense && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-1 text-xs text-blue-700 hover:underline"
          data-testid={`expand-month-${forecast.year}-${forecast.month}`}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              收起明細
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              查看支出明細
            </>
          )}
        </button>
      )}
      {expanded && <MonthDetail year={forecast.year} month={forecast.month} />}
    </div>
  )
}

export default function CashflowDecisionCenterPage() {
  useDocumentTitle("現金流預估")
  const [monthsAhead, setMonthsAhead] = useState(6)
  const { data, isLoading } = useQuery<ForecastResponse>({
    queryKey: [`/api/cashflow/forecast?monthsAhead=${monthsAhead}`],
  })

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-blue-600" />
          現金流決策中心
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          基於歷史營收推算未來 {monthsAhead} 月現金流，讓你提前規劃資金調度
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">未來 {monthsAhead} 月預估</CardTitle>
              {data && (
                <CardDescription className="text-xs">
                  成長趨勢：
                  {data.forecast.trend.growthRate >= 0 ? "+" : ""}
                  {(data.forecast.trend.growthRate * 100).toFixed(1)}% / 近期月均{" "}
                  {formatNT(data.forecast.trend.recentAvg)}
                </CardDescription>
              )}
            </div>
            <div className="flex gap-1">
              {[3, 6, 12].map((n) => (
                <Button
                  key={n}
                  variant={n === monthsAhead ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMonthsAhead(n)}
                  className="text-xs"
                >
                  {n} 月
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <div className="text-sm text-gray-500">載入中...</div>}
          {data && data.hasShortage && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">偵測到未來月份有現金缺口</div>
                <div className="text-xs mt-0.5">請檢視紅色月份的行動建議，儘早準備資金。</div>
              </div>
            </div>
          )}
          {data && !data.hasShortage && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="font-semibold">預估收入足以覆蓋所有支出，現金流健康</div>
            </div>
          )}
          {data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.forecast.months.map((f, i) => (
                <MonthCard key={`${f.year}-${f.month}`} forecast={f} gap={data.gapAnalysis[i]} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gray-50 border-dashed">
        <CardContent className="pt-6 text-xs text-gray-600 space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>高信心：有去年同月資料可對比（旺淡季已納入考量）</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>中信心：僅近期 3 個月平均可參考</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>低信心：資料不足，建議至少累積一年歷史再決策</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
