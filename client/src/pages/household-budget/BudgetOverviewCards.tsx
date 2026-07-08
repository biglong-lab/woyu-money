// 本月預算概況（每月預算 / 已花費 / 剩餘預算 / 記帳次數 四卡 + 預算進度條）
// 從原 household-budget.tsx 機械搬移、點擊複製金額行為不變
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, TrendingDown, TrendingUp, Calendar } from "lucide-react"
import { formatNT } from "@/lib/utils"
import { useCopyAmount } from "@/hooks/use-copy-amount"

interface BudgetOverviewCardsProps {
  budgetAmount: number
  totalSpent: number
  remaining: number
  spentPercentage: number
  expenseCount: number
}

/** 本月預算概況卡片區（四卡 grid + 預算進度條） */
export function BudgetOverviewCards({
  budgetAmount,
  totalSpent,
  remaining,
  spentPercentage,
  expenseCount,
}: BudgetOverviewCardsProps) {
  const copyAmount = useCopyAmount()

  return (
    <>
      {/* 本月預算概況 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">每月預算</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => copyAmount(budgetAmount, "本月預算")}
              className="text-2xl font-bold hover:text-blue-600 hover:underline cursor-pointer"
              title="點擊複製金額"
            >
              {formatNT(budgetAmount)}
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已花費</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => copyAmount(totalSpent, "本月已花費")}
              className="text-2xl font-bold text-red-600 hover:underline cursor-pointer"
              title="點擊複製金額"
            >
              {formatNT(totalSpent)}
            </button>
            <p className="text-xs text-muted-foreground">{spentPercentage.toFixed(1)}% 的預算</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">剩餘預算</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => copyAmount(remaining, "本月剩餘預算")}
              className={`text-2xl font-bold hover:underline cursor-pointer ${
                remaining >= 0 ? "text-green-600" : "text-red-600"
              }`}
              title="點擊複製金額"
            >
              {formatNT(remaining)}
            </button>
            <p className="text-xs text-muted-foreground">
              {remaining >= 0 ? "還可以花" : "已超支"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">記帳次數</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expenseCount}</div>
            <p className="text-xs text-muted-foreground">本月記錄</p>
          </CardContent>
        </Card>
      </div>

      {/* 預算進度條 */}
      {budgetAmount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>本月預算使用狀況</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all duration-300 ${
                  spentPercentage > 100
                    ? "bg-red-500"
                    : spentPercentage > 80
                      ? "bg-yellow-500"
                      : "bg-green-500"
                }`}
                style={{ width: `${Math.min(spentPercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>已使用 {spentPercentage.toFixed(1)}%</span>
              <span>
                {remaining >= 0
                  ? `還有 NT$ ${remaining.toLocaleString()}`
                  : `超支 NT$ ${Math.abs(remaining).toLocaleString()}`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
