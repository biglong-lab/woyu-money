/**
 * 應付項目動作彈窗 — 供應付看板矩陣明細直接處理單筆項目。
 * 分頁：付款歸帳(可上傳收據) / 備註附件(複用 PaymentItemNotes)；底部可刪除。
 * 全部複用既有 API：POST /payments(multipart)、DELETE /items/:id。
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { formatNT, localDateISO } from "@/lib/utils"
import PaymentItemNotes from "@/components/payment-item-notes"
import type { PaymentItem } from "@/components/installment-types"

const METHODS = ["銀行轉帳", "現金", "信用卡", "其他"]

export default function MatrixItemActions({
  item,
  onClose,
}: {
  item: PaymentItem | null
  onClose: () => void
}) {
  const { toast } = useToast()
  const open = !!item
  const payable = parseFloat(item?.totalAmount || "0") || 0
  const paid = parseFloat(item?.paidAmount || "0") || 0
  const unpaid = Math.max(0, payable - paid)

  const [amount, setAmount] = useState("")
  const [date, setDate] = useState("")
  const [method, setMethod] = useState(METHODS[0])
  const [notes, setNotes] = useState("")
  const [receipt, setReceipt] = useState<File | null>(null)

  // item 變更時重置表單
  const [lastId, setLastId] = useState<number | null>(null)
  if (item && item.id !== lastId) {
    setLastId(item.id)
    setAmount(String(unpaid || payable))
    setDate(localDateISO())
    setMethod(METHODS[0])
    setNotes("")
    setReceipt(null)
  }

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/payment/items"], refetchType: "all" })

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!item) return
      const fd = new FormData()
      fd.append("amount", amount)
      fd.append("paymentDate", date)
      fd.append("paymentMethod", method)
      if (notes) fd.append("notes", notes)
      if (receipt) fd.append("receiptFile", receipt)
      const res = await fetch(`/api/payment/items/${item.id}/payments`, {
        method: "POST",
        body: fd,
      })
      if (!res.ok) throw new Error("歸帳失敗")
      return res.json()
    },
    onSuccess: () => {
      refresh()
      toast({ title: "已歸帳", description: "付款記錄已新增、狀態已更新" })
      onClose()
    },
    onError: (e: Error) =>
      toast({ title: "歸帳失敗", description: e.message, variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!item) return
      return apiRequest("DELETE", `/api/payment/items/${item.id}`)
    },
    onSuccess: () => {
      refresh()
      toast({ title: "已刪除", description: "項目已移至回收站" })
      onClose()
    },
    onError: (e: Error) =>
      toast({ title: "刪除失敗", description: e.message, variant: "destructive" }),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{item?.itemName}</DialogTitle>
          <DialogDescription>
            應付 {formatNT(payable)} · 已付 {formatNT(paid)} · 未付 {formatNT(unpaid)}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pay">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="pay">付款歸帳</TabsTrigger>
            <TabsTrigger value="notes">備註 / 附件</TabsTrigger>
          </TabsList>

          {/* 付款歸帳 */}
          <TabsContent value="pay" className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">付款金額</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">付款日期</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">付款方式</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {METHODS.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={method === m ? "default" : "outline"}
                    onClick={() => setMethod(m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">備註 (選填)</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="付款備註…"
              />
            </div>
            <div>
              <Label className="text-xs">收據 (選填)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              className="w-full"
              disabled={payMutation.isPending || !amount}
              onClick={() => payMutation.mutate()}
            >
              {payMutation.isPending ? "處理中…" : `確認歸帳 ${formatNT(parseFloat(amount) || 0)}`}
            </Button>
          </TabsContent>

          {/* 備註 / 附件 (複用現成元件, 含上傳) */}
          <TabsContent value="notes" className="pt-2">
            {item && <PaymentItemNotes itemId={item.id} itemName={item.itemName} />}
          </TabsContent>
        </Tabs>

        {/* 危險操作 */}
        <div className="border-t pt-3 mt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:bg-red-50"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm(`確定刪除「${item?.itemName}」？(移至回收站, 可復原)`))
                deleteMutation.mutate()
            }}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            刪除此項目
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
