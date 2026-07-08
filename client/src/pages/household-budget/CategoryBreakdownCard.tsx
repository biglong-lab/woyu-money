// 分類佔比卡片（各分類支出排名、前 5 名 + 其他分類數量）
// 從原 household-budget.tsx 機械搬移、條件渲染邏輯不變
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { MonthlyStatsResponse } from "./types"

interface CategoryBreakdownCardProps {
  monthlyStats: MonthlyStatsResponse | undefined
  totalSpent: number
  selectedMonth: string
}

/** 分類佔比（前 5、無資料時不渲染） */
export function CategoryBreakdownCard({
  monthlyStats,
  totalSpent,
  selectedMonth,
}: CategoryBreakdownCardProps) {
  // 與原檔相同的條件：無統計 / 非陣列 / 空陣列 → 不顯示
  if (
    !monthlyStats ||
    !Array.isArray(monthlyStats.categoryBreakdown) ||
    monthlyStats.categoryBreakdown.length === 0
  ) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">分類佔比</CardTitle>
        <CardDescription>{selectedMonth} 各分類支出排名</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {monthlyStats.categoryBreakdown.slice(0, 5).map((c) => {
          const pct = totalSpent > 0 ? Math.round((c.amount / totalSpent) * 100) : 0
          return (
            <div key={c.categoryId ?? c.categoryName} className="text-sm">
              <div className="flex justify-between mb-0.5">
                <span>{c.categoryName}</span>
                <span className="font-mono">
                  NT$ {Math.round(c.amount).toLocaleString()}{" "}
                  <span className="text-xs text-gray-400">({pct}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded bg-gray-100 overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>
          )
        })}
        {monthlyStats.categoryBreakdown.length > 5 && (
          <div className="text-xs text-gray-400 italic pt-1">
            + {monthlyStats.categoryBreakdown.length - 5} 個其他分類
          </div>
        )}
      </CardContent>
    </Card>
  )
}
