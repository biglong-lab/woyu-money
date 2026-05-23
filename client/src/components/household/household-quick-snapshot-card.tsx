/**
 * HouseholdQuickSnapshotCard — 首頁家用記帳快照
 *
 * 顯示：
 *  - 今日已花（emoji 大字）
 *  - 本月已花 / 預算 / 剩餘 / 進度條
 *  - 超支警示（red）/ 快於進度警示（amber）
 *  - 過去 7 天 mini bar chart（含今日 highlight）
 *  - 快速「+ 記一筆」按鈕（跳 /household-budget?quickAdd=1）
 *  - 點卡片任何空白處跳 /household-budget
 */
import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Wallet, Plus, TrendingUp } from "lucide-react"

interface SnapshotResponse {
  month: string
  today: { date: string; spent: number; count: number }
  monthSummary: {
    spent: number
    count: number
    budget: number
    remaining: number
    usagePct: number | null
    timeProgress: number
    isOver: boolean
    isAhead: boolean
  }
  past7Days: { date: string; total: number }[]
}

export function HouseholdQuickSnapshotCard() {
  const { data, isLoading } = useQuery<SnapshotResponse>({
    queryKey: ["/api/household/snapshot"],
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  })

  if (isLoading || !data) {
    return (
      <Card className="border-2 border-amber-200">
        <CardContent className="p-4 text-sm text-gray-500">載入家用記帳快照…</CardContent>
      </Card>
    )
  }

  const max7 = Math.max(...data.past7Days.map((d) => d.total), 1)
  const sum7 = data.past7Days.reduce((s, d) => s + d.total, 0)
  const ms = data.monthSummary

  return (
    <Card
      className={cn(
        "border-2 transition-all",
        ms.isOver
          ? "border-rose-300 bg-gradient-to-br from-rose-50 to-amber-50"
          : ms.isAhead
            ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50"
            : "border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Link href="/household-budget">
            <CardTitle className="flex items-center gap-2 text-base cursor-pointer hover:underline">
              <Wallet className="w-4 h-4" />
              家用記帳
              <span className="text-[10px] text-gray-500 font-normal">→</span>
            </CardTitle>
          </Link>
          <Button
            size="sm"
            className="gap-1 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:scale-95"
            onClick={() => {
              window.location.href = "/household-budget?quickAdd=1"
            }}
            data-testid="button-home-quickadd"
          >
            <Plus className="w-4 h-4" />
            記一筆
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 今日 + 本月 + 剩餘 三欄 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/80 rounded-lg p-2 text-center border">
            <div className="text-[10px] text-gray-500">今日已花</div>
            <div className="text-lg font-bold text-amber-700">
              NT$ {data.today.spent.toLocaleString()}
            </div>
            {data.today.count > 0 && (
              <div className="text-[9px] text-gray-400">{data.today.count} 筆</div>
            )}
          </div>
          <div className="bg-white/80 rounded-lg p-2 text-center border">
            <div className="text-[10px] text-gray-500">本月已花</div>
            <div className="text-lg font-bold text-orange-700">NT$ {ms.spent.toLocaleString()}</div>
            <div className="text-[9px] text-gray-400">{ms.count} 筆</div>
          </div>
          <div
            className={cn(
              "rounded-lg p-2 text-center border",
              ms.isOver ? "bg-rose-100 border-rose-300" : "bg-emerald-50 border-emerald-300"
            )}
          >
            <div className="text-[10px] text-gray-500">{ms.isOver ? "超支" : "剩餘"}</div>
            <div
              className={cn("text-lg font-bold", ms.isOver ? "text-rose-700" : "text-emerald-700")}
            >
              NT$ {Math.abs(ms.remaining).toLocaleString()}
            </div>
            {ms.usagePct !== null && (
              <div className="text-[9px] text-gray-500">{ms.usagePct}% 已用</div>
            )}
          </div>
        </div>

        {/* 進度條（如果有預算）*/}
        {ms.budget > 0 && ms.usagePct !== null && (
          <div className="bg-white/80 rounded-lg p-2 border">
            <div className="flex justify-between items-center mb-1 text-[10px] text-gray-500">
              <span>
                月進度 {ms.timeProgress}% · 已用 {ms.usagePct}%
              </span>
              {ms.isAhead && !ms.isOver && (
                <span className="text-amber-700 font-medium flex items-center gap-0.5">
                  <TrendingUp className="w-2.5 h-2.5" />
                  花得比進度快
                </span>
              )}
              {ms.isOver && <span className="text-rose-700 font-medium">🚨 已超支</span>}
            </div>
            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
              {/* 月進度線 */}
              <div
                className="absolute top-0 bottom-0 w-px bg-gray-400 z-10"
                style={{ left: `${Math.min(100, ms.timeProgress)}%` }}
                title={`時間進度 ${ms.timeProgress}%`}
              />
              <div
                className={cn(
                  "h-full transition-all",
                  ms.isOver
                    ? "bg-gradient-to-r from-rose-400 to-rose-600"
                    : ms.isAhead
                      ? "bg-gradient-to-r from-amber-400 to-orange-500"
                      : "bg-gradient-to-r from-emerald-400 to-emerald-600"
                )}
                style={{ width: `${Math.min(100, ms.usagePct)}%` }}
              />
            </div>
          </div>
        )}

        {/* 過去 7 天 bar chart */}
        <div className="bg-white/80 rounded-lg p-2 border">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-gray-500">過去 7 天</span>
            <span className="text-[10px] text-gray-500">共 NT$ {sum7.toLocaleString()}</span>
          </div>
          <div className="flex items-end gap-1 h-12">
            {data.past7Days.map((d, i) => {
              const h = (d.total / max7) * 100
              const isToday = i === data.past7Days.length - 1
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end">
                  <div
                    className={cn(
                      "w-full rounded-t transition-all",
                      d.total > 0
                        ? isToday
                          ? "bg-gradient-to-t from-amber-500 to-orange-600"
                          : "bg-gradient-to-t from-amber-300 to-amber-500"
                        : "bg-gray-100"
                    )}
                    style={{ height: `${Math.max(2, h)}%` }}
                    title={`${d.date}: NT$ ${d.total.toLocaleString()}`}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-[8px] text-gray-400 mt-1">
            {data.past7Days.map((d, i) => (
              <span key={d.date} className="flex-1 text-center">
                {i === data.past7Days.length - 1 ? "今" : d.date.slice(8)}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
