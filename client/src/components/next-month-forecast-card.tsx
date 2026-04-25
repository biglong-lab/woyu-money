/**
 * 下個月預估卡（首頁）
 *
 * 解決：使用者看不到「下個月需要準備多少錢」
 * 顯示：下個月預估支出 + 收支淨額 + 缺口警示
 * 點擊跳轉到完整現金流預估頁面
 */

import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import { TrendingUp, ArrowRight, AlertTriangle, Copy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatNT } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface ForecastMonth {
  year: number
  month: number
  estimated: number
}

interface GapItem {
  year: number
  month: number
  estimatedIncome: number
  estimatedExpense: number
  net: number
  gap?: number
}

interface ForecastData {
  forecast: {
    months: ForecastMonth[]
  }
  gapAnalysis: GapItem[]
  hasShortage: boolean
}

export function NextMonthForecastCard() {
  const { toast } = useToast()
  const { data, isLoading } = useQuery<ForecastData>({
    queryKey: ["/api/cashflow/forecast?monthsAhead=1"],
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-3 sm:p-4 animate-pulse">
          <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-12 bg-gray-100 rounded" />
            <div className="h-12 bg-gray-100 rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.gapAnalysis.length === 0) return null
  const gap = data.gapAnalysis[0]
  if (!gap) return null

  const hasGap = gap.gap !== undefined && gap.gap > 0
  const isNegative = gap.net < 0

  return (
    <Link href="/cashflow-decision-center">
      <Card
        className={`cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99] ${
          hasGap ? "border-red-200 bg-red-50/50" : "bg-gradient-to-br from-blue-50 to-indigo-50"
        }`}
        data-testid="next-month-forecast-card"
      >
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm sm:text-base font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              下個月預估（{gap.year}/{String(gap.month).padStart(2, "0")}）
            </h3>
            <ArrowRight className="h-4 w-4 text-gray-400" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-gray-500">預估收入</div>
              <div className="font-semibold text-green-700">{formatNT(gap.estimatedIncome)}</div>
            </div>
            <div>
              <div className="text-gray-500">預估支出</div>
              <div className="font-semibold text-red-700">{formatNT(gap.estimatedExpense)}</div>
            </div>
            <div>
              <div className="text-gray-500">淨額</div>
              <div className={`font-bold ${isNegative ? "text-red-700" : "text-gray-900"}`}>
                {formatNT(gap.net)}
              </div>
            </div>
          </div>
          {hasGap && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-800 bg-red-100 rounded px-2 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">預估缺口 {formatNT(gap.gap ?? 0)}，建議先做現金準備</span>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const text =
                    `📊 ${gap.year}/${String(gap.month).padStart(2, "0")} 現金流提醒\n\n` +
                    `預估收入：${formatNT(gap.estimatedIncome)}\n` +
                    `預估支出：${formatNT(gap.estimatedExpense)}\n` +
                    `預估缺口：${formatNT(gap.gap ?? 0)}\n\n` +
                    `💡 建議提前準備現金或安排融資`
                  try {
                    await navigator.clipboard.writeText(text)
                    toast({ title: "已複製通知", description: "可貼到 LINE / 備忘錄" })
                  } catch {
                    toast({ title: "複製失敗", variant: "destructive" })
                  }
                }}
                className="text-red-700 hover:underline flex items-center gap-1 shrink-0"
                title="複製通知文字"
                data-testid="copy-shortage-notice"
              >
                <Copy className="h-3 w-3" />
                通知
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
