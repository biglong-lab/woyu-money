/**
 * IncomeExpenseBalanceCard — 收支結餘 + 收入分類分布
 *
 * 用 incomes/summary + stats 兩個 API：
 *  - 上方 3 大 KPI：本月收入（綠）/ 本月支出（紅）/ 結餘（綠/紅依正負）
 *  - 下方收入分類橫條圖（薪資 / 獎金 / 投資…）
 *  - 月份可切換（沿用父層 selectedMonth）
 */
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Scale } from "lucide-react"

interface IncomeSummary {
  month: string
  totalIncome: number
  breakdown: Array<{
    category: string
    amount: number
    count: number
    pct: number
  }>
}

interface StatsResponse {
  totalSpent: number
}

const INCOME_EMOJI: Record<string, string> = {
  薪資: "💼",
  獎金: "🎁",
  投資: "📈",
  副業: "🛠️",
  退款: "↩️",
  其他: "📦",
}

const INCOME_COLOR: Record<string, string> = {
  薪資: "#10B981",
  獎金: "#F59E0B",
  投資: "#3B82F6",
  副業: "#8B5CF6",
  退款: "#EC4899",
  其他: "#6B7280",
}

export function IncomeExpenseBalanceCard({ selectedMonth }: { selectedMonth: string }) {
  const { data: incomeData } = useQuery<IncomeSummary>({
    queryKey: [`/api/household/incomes/summary?month=${selectedMonth}`],
    staleTime: 60 * 1000,
  })

  const { data: statsData } = useQuery<StatsResponse>({
    queryKey: [`/api/household/stats?month=${selectedMonth}`],
    staleTime: 60 * 1000,
  })

  const income = incomeData?.totalIncome ?? 0
  const expense = statsData?.totalSpent ?? 0
  const balance = income - expense
  const isPositive = balance >= 0
  const savingRate = income > 0 ? Math.round((balance / income) * 100) : null

  return (
    <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-emerald-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">⚖️ 收支結餘</CardTitle>
        <CardDescription>
          {selectedMonth} ·{" "}
          {savingRate !== null
            ? `儲蓄率 ${savingRate >= 0 ? "+" : ""}${savingRate}%`
            : "尚無收入記錄"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 3 KPI */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-lg p-2 text-center border border-emerald-200">
            <div className="text-[10px] text-gray-500 flex items-center justify-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />
              收入
            </div>
            <div className="text-base font-bold text-emerald-700">
              NT$ {income.toLocaleString()}
            </div>
            {incomeData && incomeData.breakdown.length > 0 && (
              <div className="text-[9px] text-gray-400">
                {incomeData.breakdown.reduce((s, b) => s + b.count, 0)} 筆
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg p-2 text-center border border-rose-200">
            <div className="text-[10px] text-gray-500 flex items-center justify-center gap-0.5">
              <TrendingDown className="w-2.5 h-2.5" />
              支出
            </div>
            <div className="text-base font-bold text-rose-700">NT$ {expense.toLocaleString()}</div>
          </div>
          <div
            className={cn(
              "rounded-lg p-2 text-center border",
              isPositive ? "bg-emerald-100 border-emerald-400" : "bg-rose-100 border-rose-400"
            )}
          >
            <div className="text-[10px] text-gray-500 flex items-center justify-center gap-0.5">
              <Scale className="w-2.5 h-2.5" />
              結餘
            </div>
            <div
              className={cn(
                "text-base font-bold",
                isPositive ? "text-emerald-800" : "text-rose-800"
              )}
            >
              {isPositive ? "+" : "-"}NT$ {Math.abs(balance).toLocaleString()}
            </div>
            <div className="text-[9px] text-gray-500">
              {isPositive ? "💚 有結餘" : "⚠️ 入不敷出"}
            </div>
          </div>
        </div>

        {/* 收入分類橫條圖 */}
        {incomeData && incomeData.breakdown.length > 0 && (
          <div className="bg-white rounded-lg p-3 border">
            <div className="text-[10px] text-gray-500 mb-2">收入分類分布</div>
            <div className="space-y-1.5">
              {incomeData.breakdown.map((b) => {
                const emoji = INCOME_EMOJI[b.category] ?? "💰"
                const color = INCOME_COLOR[b.category] ?? "#10B981"
                return (
                  <div key={b.category} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <span className="text-sm">{emoji}</span>
                        <span className="font-medium">{b.category}</span>
                        <span className="text-gray-400">({b.count})</span>
                      </span>
                      <span className="font-bold text-gray-700">
                        NT$ {b.amount.toLocaleString()}
                        <span className="text-[10px] text-gray-400 ml-1">({b.pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${b.pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 提示 */}
        {income === 0 && expense === 0 && (
          <div className="text-xs text-gray-500 text-center py-3 bg-white rounded-lg border">
            本月還沒記過收支、開始記第一筆吧 💰
          </div>
        )}
      </CardContent>
    </Card>
  )
}
