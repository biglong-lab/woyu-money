/**
 * 應付格明細彈窗（共用）— 任何「以 payment_items 為底層」的矩陣都可用。
 * 提供：明細清單 + 單筆處理(歸帳/備註/上傳/刪除, 透過 MatrixItemActions) + 批次(標記已付/刪除) + 新增。
 * 呼叫端只需傳入「該格已過濾的項目」與新增預填值; 動作後會 invalidate 應付查詢並呼叫 onChanged。
 */
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Info } from "lucide-react"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { formatNT } from "@/lib/utils"
import MatrixItemActions from "@/components/matrix-item-actions"
import type { PaymentItem } from "@/components/installment-types"

export interface PaymentCellDetailProps {
  open: boolean
  onClose: () => void
  title: string
  items: PaymentItem[]
  createPrefill?: { categoryId?: number; projectId?: number; startDate: string }
  onChanged?: () => void
}

export default function PaymentCellDetail({
  open,
  onClose,
  title,
  items,
  createPrefill,
  onChanged,
}: PaymentCellDetailProps) {
  const { toast } = useToast()
  const [actionItem, setActionItem] = useState<PaymentItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newAmount, setNewAmount] = useState("")

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/payment/items"], refetchType: "all" })
    onChanged?.()
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        itemName: newName,
        totalAmount: newAmount,
        startDate: createPrefill?.startDate,
        paymentType: "single",
      }
      if (createPrefill?.categoryId) body.categoryId = createPrefill.categoryId
      if (createPrefill?.projectId) body.projectId = createPrefill.projectId
      return apiRequest("POST", "/api/payment/items", body)
    },
    onSuccess: () => {
      refresh()
      setCreateOpen(false)
      setNewName("")
      setNewAmount("")
      toast({ title: "已新增應付項目" })
    },
    onError: (e: Error) =>
      toast({ title: "新增失敗", description: e.message, variant: "destructive" }),
  })

  const totalUnpaid = items.reduce(
    (s, it) =>
      s +
      Math.max(
        0,
        (parseFloat(it.totalAmount || "0") || 0) - (parseFloat(it.paidAmount || "0") || 0)
      ),
    0
  )

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title} — 應付明細</DialogTitle>
            <DialogDescription className="sr-only">應付項目明細清單</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {/* 工具列 (僅新增; 不提供刪除/批次, 結構性項目須回原設定處理) */}
            {createPrefill && (
              <div className="pb-1">
                <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  新增應付
                </Button>
              </div>
            )}

            {items.length === 0 && (
              <p className="text-gray-400 text-sm py-6 text-center">此格無應付項目</p>
            )}

            {items.map((it) => {
              const payable = parseFloat(it.totalAmount || "0") || 0
              const paid = parseFloat(it.paidAmount || "0") || 0
              const unpaid = Math.max(0, payable - paid)
              const done = unpaid === 0
              return (
                <div key={it.id} className="flex items-center gap-3 border rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-800 truncate">{it.itemName}</div>
                    <div className="text-xs text-gray-500">
                      {it.startDate?.slice(0, 10)}
                      {" · "}應付 {formatNT(payable)} / 已付 {formatNT(paid)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-semibold tabular-nums ${done ? "text-emerald-600" : "text-indigo-700"}`}
                    >
                      {done ? "已付清" : `未付 ${formatNT(unpaid)}`}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-blue-600"
                    onClick={() => setActionItem(it)}
                  >
                    處理
                  </Button>
                </div>
              )
            })}

            {items.length > 0 && (
              <div className="flex justify-between border-t pt-2 mt-2 text-sm font-semibold">
                <span>合計（{items.length} 筆）</span>
                <span className="tabular-nums text-indigo-700">未付 {formatNT(totalUnpaid)}</span>
              </div>
            )}

            <div className="flex items-start gap-1.5 text-xs text-gray-400 pt-1">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                每筆可分多次記錄付款直到付清。如需刪除或調整定期/合約/分期項目，請至原設定頁處理。
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MatrixItemActions
        item={actionItem}
        onClose={() => {
          setActionItem(null)
          onChanged?.()
        }}
      />

      {createPrefill && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle>新增應付項目</DialogTitle>
              <DialogDescription>將新增到「{title}」（分類/專案/月份自動帶入）</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="項目名稱"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="金額"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={createMutation.isPending || !newName || !newAmount}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "新增中…" : "新增"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
