/**
 * 最近付款動態卡（首頁）
 * 顯示最近 5 筆付款記錄，給使用者「我有在做事」的成就感
 */

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Link } from "wouter"
import { CheckCircle2, ArrowRight, Undo2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"

interface PaymentRecordWithNames {
  id: number
  itemId?: number
  amountPaid?: string | number
  amount?: string | number
  paymentDate: string
  itemName?: string
  projectName?: string
  notes?: string
}

function fmt(n: number): string {
  return `NT$ ${Math.round(n).toLocaleString()}`
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diff === 0) return "今天"
  if (diff === 1) return "昨天"
  if (diff < 7) return `${diff} 天前`
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${m}/${d}`
}

export function RecentPaymentsCard() {
  const { toast } = useToast()
  const [undoingId, setUndoingId] = useState<number | null>(null)

  const { data } = useQuery<PaymentRecordWithNames[]>({
    queryKey: ["/api/payment/records?limit=5&page=1"],
  })

  const undoMutation = useMutation<unknown, Error, { id: number; itemName: string }>({
    mutationFn: (input) => apiRequest("DELETE", `/api/payment-records/${input.id}`),
    onMutate: (input) => setUndoingId(input.id),
    onSuccess: (_data, input) => {
      toast({ title: "已撤銷付款記錄", description: input.itemName })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/records?limit=5&page=1"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/priority-report?includeLow=true"] })
    },
    onSettled: () => setUndoingId(null),
    onError: (err) =>
      toast({ title: "撤銷失敗", description: err.message, variant: "destructive" }),
  })

  if (!data || !Array.isArray(data) || data.length === 0) return null

  const records = data.slice(0, 5)

  const handleUndo = (rec: PaymentRecordWithNames) => {
    if (
      !window.confirm(
        `確定要撤銷「${rec.itemName ?? "未命名"}」的付款記錄嗎？\n（此操作會刪除該筆 payment_record）`
      )
    )
      return
    undoMutation.mutate({ id: rec.id, itemName: rec.itemName ?? "未命名項目" })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            最近已付
          </CardTitle>
          <Link href="/payment-records">
            <span className="text-xs text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
              全部 <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {records.map((rec) => {
          const amount = Number(rec.amountPaid ?? rec.amount ?? 0)
          return (
            <div
              key={rec.id}
              className="flex items-center justify-between gap-2 text-sm border-l-2 border-green-300 bg-green-50/50 rounded p-2"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{rec.itemName ?? "未命名項目"}</div>
                <div className="text-xs text-gray-500">
                  {formatRelativeDate(rec.paymentDate)}
                  {rec.projectName && <span className="ml-1">· {rec.projectName}</span>}
                </div>
              </div>
              <div className="text-sm font-semibold text-green-700 shrink-0">{fmt(amount)}</div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-1.5 text-[10px] text-gray-500 hover:text-red-600 shrink-0"
                onClick={() => handleUndo(rec)}
                disabled={undoingId === rec.id}
                title="撤銷此筆付款"
                data-testid={`undo-payment-${rec.id}`}
              >
                <Undo2 className="h-3 w-3" />
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
