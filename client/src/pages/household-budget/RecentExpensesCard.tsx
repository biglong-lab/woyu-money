// 最近記錄卡片（本月支出清單前 10 筆、發票標記、刪除按鈕）
// 從原 household-budget.tsx 機械搬移、confirm 刪除行為不變
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2 } from "lucide-react"
import type { ExpenseWithCategory, HouseholdCategory } from "./types"

interface RecentExpensesCardProps {
  selectedMonth: string
  expenses: ExpenseWithCategory[]
  householdCategories: HouseholdCategory[]
  onDelete: (id: number) => void
  isDeleting: boolean
}

/** 最近記錄（本月支出前 10 筆） */
export function RecentExpensesCard({
  selectedMonth,
  expenses,
  householdCategories,
  onDelete,
  isDeleting,
}: RecentExpensesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{selectedMonth} 記錄</CardTitle>
        <CardDescription>已記錄 {expenses.length} 筆支出</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {expenses.length > 0 ? (
            expenses.slice(0, 10).map((expense: ExpenseWithCategory, index: number) => {
              const category = householdCategories.find(
                (cat: HouseholdCategory) => cat.id === expense.categoryId
              )
              return (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category?.color || "#gray" }}
                    />
                    <div>
                      <div className="font-medium">
                        {category?.categoryName || expense.categoryName || "其他"}
                      </div>
                      <div className="text-sm text-muted-foreground">{expense.date}</div>
                      {expense.description && (
                        <div className="text-sm text-muted-foreground">{expense.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-medium text-red-600">
                        -NT$ {parseInt(expense.amount?.toString() || "0").toLocaleString()}
                      </div>
                      {expense.receiptPhoto && (
                        <Badge variant="outline" className="text-xs">
                          有發票
                        </Badge>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (expense.id && confirm(`刪除此筆 -NT$ ${expense.amount} ？`)) {
                          onDelete(expense.id)
                        }
                      }}
                      disabled={isDeleting}
                      className="text-red-500 hover:bg-red-50 rounded p-1.5"
                      title="刪除這筆"
                      aria-label="刪除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              還沒有記錄，點擊"快速記帳"開始記錄支出
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
