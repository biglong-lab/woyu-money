/**
 * PeriodFeedCard — 今天 / 本週 / 本月 即時花費清單（Phase 4）
 *
 * 設計：
 *  - tab 切換期間
 *  - 上方顯示總金額 + 筆數
 *  - 下方時序倒序列表（emoji + 分類 + 金額 + 備註 + 日期）
 *  - 每筆右側「副本」「刪除」操作
 */
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import { cn } from "@/lib/utils"
import { Calendar, CalendarDays, CalendarRange, Trash2 } from "lucide-react"
import { getCategoryDecor } from "@/lib/category-emoji"

type Period = "today" | "week" | "month"

interface PeriodExpense {
  id: number
  amount: string
  description: string | null
  date: string
  paymentMethod: string | null
  receiptImages: string[] | null
  categoryId: number | null
  categoryName: string
  color: string
}

interface PeriodResponse {
  period: Period
  startDate: string
  endDate: string
  total: number
  count: number
  expenses: PeriodExpense[]
}

export function PeriodFeedCard() {
  const [period, setPeriod] = useState<Period>("today")
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<PeriodResponse>({
    queryKey: [`/api/household/period-summary?period=${period}`],
    staleTime: 30 * 1000,
  })

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id) => apiRequest("DELETE", `/api/household/expenses/${id}`),
    onSuccess: () => {
      toast({ title: "已刪除" })
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/household/"),
      })
    },
    onError: (e) => {
      toast({ title: "刪除失敗", description: e.message, variant: "destructive" })
    },
  })

  const tabs: { key: Period; label: string; icon: React.ComponentType<{ className?: string }> }[] =
    [
      { key: "today", label: "今天", icon: Calendar },
      { key: "week", label: "本週", icon: CalendarRange },
      { key: "month", label: "本月", icon: CalendarDays },
    ]

  return (
    <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">📋 花了什麼</CardTitle>
          <div className="flex bg-white rounded-lg p-1 border">
            {tabs.map((t) => {
              const Icon = t.icon
              const active = period === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setPeriod(t.key)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
                    active ? "bg-amber-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
                  )}
                  data-testid={`tab-period-${t.key}`}
                >
                  <Icon className="w-3 h-3" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
        <CardDescription>
          {data ? `共 ${data.count} 筆 · ${data.startDate}` : "載入中..."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* 總金額 */}
        <div className="bg-white rounded-lg p-3 mb-3 border text-center">
          <div className="text-[10px] text-gray-500">期間總計</div>
          <div className="text-2xl font-bold text-amber-700">
            NT$ {(data?.total ?? 0).toLocaleString()}
          </div>
        </div>

        {/* 列表 */}
        {isLoading && <div className="text-sm text-gray-500 py-4 text-center">載入中...</div>}
        {!isLoading && data && data.expenses.length === 0 && (
          <div className="text-sm text-gray-500 py-6 text-center">
            🎉 這個期間還沒記帳、開始記一筆吧
          </div>
        )}
        {!isLoading && data && data.expenses.length > 0 && (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {data.expenses.map((e) => {
              const decor = getCategoryDecor(e.categoryName)
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-2 bg-white rounded-lg border p-2 group"
                  data-testid={`expense-row-${e.id}`}
                >
                  <div
                    className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${decor.color}22`, color: decor.color }}
                  >
                    {decor.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700 truncate">
                        {e.categoryName}
                      </span>
                      <span className="text-[9px] text-gray-400 shrink-0">
                        {e.date.slice(5, 10)}
                      </span>
                    </div>
                    {e.description && (
                      <div className="text-[10px] text-gray-500 truncate">{e.description}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-amber-700">
                      NT$ {Math.round(parseFloat(e.amount)).toLocaleString()}
                    </div>
                    <div className="text-[9px] text-gray-400">
                      {e.paymentMethod === "cash"
                        ? "💵"
                        : e.paymentMethod === "card"
                          ? "💳"
                          : e.paymentMethod === "mobile_payment"
                            ? "📱"
                            : "🏦"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                    onClick={() => {
                      if (window.confirm("確定刪除這筆？")) deleteMutation.mutate(e.id)
                    }}
                    data-testid={`button-delete-${e.id}`}
                  >
                    <Trash2 className="w-3 h-3 text-rose-600" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
