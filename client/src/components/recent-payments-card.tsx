/**
 * 最近付款動態卡（首頁）
 * 顯示最近 5 筆付款記錄，給使用者「我有在做事」的成就感
 */

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Link } from "wouter"
import { CheckCircle2, ArrowRight, Undo2, Copy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { formatNT } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useCopyAmount } from "@/hooks/use-copy-amount"

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

type DateGroup = "today" | "yesterday" | "this_week" | "earlier"

function groupOf(dateStr: string): DateGroup {
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diff === 0) return "today"
  if (diff === 1) return "yesterday"
  if (diff < 7) return "this_week"
  return "earlier"
}

const GROUP_LABEL: Record<DateGroup, string> = {
  today: "今天",
  yesterday: "昨天",
  this_week: "本週",
  earlier: "更早",
}

export function RecentPaymentsCard() {
  const { toast } = useToast()
  const copyAmount = useCopyAmount()
  const [undoingId, setUndoingId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<PaymentRecordWithNames[]>({
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!data || !Array.isArray(data) || data.length === 0) return null

  const records = data.slice(0, 5)

  // 按日期分組
  const grouped = records.reduce<Record<DateGroup, PaymentRecordWithNames[]>>(
    (acc, rec) => {
      const g = groupOf(rec.paymentDate)
      acc[g].push(rec)
      return acc
    },
    { today: [], yesterday: [], this_week: [], earlier: [] }
  )

  // 今日達成（成就感正向回饋）
  const todayCount = grouped.today.length
  const todayTotal = grouped.today.reduce(
    (s, rec) => s + Number(rec.amountPaid ?? rec.amount ?? 0),
    0
  )

  // 最近 5 筆合計（footer 顯示用）
  const visibleTotal = records.reduce((s, rec) => s + Number(rec.amountPaid ?? rec.amount ?? 0), 0)

  const handleUndo = (rec: PaymentRecordWithNames) => {
    if (
      !window.confirm(
        `確定要撤銷「${rec.itemName ?? "未命名"}」的付款記錄嗎？\n（此操作會刪除該筆 payment_record）`
      )
    )
      return
    undoMutation.mutate({ id: rec.id, itemName: rec.itemName ?? "未命名項目" })
  }

  // 複製今日已付清單（給 LINE 通知合夥人/家人）
  const handleCopyTodayList = async () => {
    if (todayCount === 0) return
    const today = new Date()
    const dateStr = `${today.getMonth() + 1}/${today.getDate()}`
    const lines = grouped.today.map((rec, i) => {
      const amount = Number(rec.amountPaid ?? rec.amount ?? 0)
      return `${i + 1}. ${rec.itemName ?? "未命名項目"} ${formatNT(amount)}`
    })
    const text =
      `✅ ${dateStr} 已付清單（${todayCount} 件）：\n\n` +
      lines.join("\n") +
      `\n\n💰 合計：${formatNT(todayTotal)}`
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "已複製今日已付清單", description: "可貼到 LINE / 備忘錄" })
    } catch {
      toast({
        title: "複製失敗",
        description: "瀏覽器不支援",
        variant: "destructive",
      })
    }
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
        {todayCount > 0 && (
          <div className="mt-1.5 flex items-center gap-2 text-xs font-medium text-green-700 bg-green-50 rounded px-2 py-1 border border-green-200">
            <span className="flex-1">
              🎉 今天已完成 {todayCount} 件付款 · 共 {formatNT(todayTotal)}
            </span>
            <button
              type="button"
              onClick={handleCopyTodayList}
              className="text-blue-600 hover:underline flex items-center gap-1 shrink-0"
              title="複製今日已付清單"
              data-testid="copy-today-list"
            >
              <Copy className="h-3 w-3" />
              <span className="hidden sm:inline">複製</span>
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {(["today", "yesterday", "this_week", "earlier"] as DateGroup[]).map((group) => {
          const items = grouped[group]
          if (items.length === 0) return null
          const groupTotal = items.reduce(
            (s, rec) => s + Number(rec.amountPaid ?? rec.amount ?? 0),
            0
          )
          return (
            <div key={group} className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span className="font-medium">
                  {GROUP_LABEL[group]} · {items.length} 件
                </span>
                <span className="text-green-700">{formatNT(groupTotal)}</span>
              </div>
              {items.map((rec) => {
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
                    <button
                      type="button"
                      onClick={() => copyAmount(amount, rec.itemName ?? "未命名項目")}
                      className="text-sm font-semibold text-green-700 shrink-0 hover:underline cursor-pointer"
                      title="點擊複製金額（轉帳用）"
                      data-testid={`copy-record-amount-${rec.id}`}
                    >
                      {formatNT(amount)}
                    </button>
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
            </div>
          )
        })}
        {records.length > 1 && (
          <div className="flex items-center justify-between pt-2 mt-1 border-t text-xs">
            <span className="text-gray-500">最近 {records.length} 筆合計</span>
            <button
              type="button"
              onClick={() => copyAmount(visibleTotal, `最近 ${records.length} 筆合計`)}
              className="font-semibold text-green-700 hover:underline cursor-pointer"
              title="點擊複製總額"
              data-testid="copy-recent-total"
            >
              {formatNT(visibleTotal)}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
