/**
 * 分期 / 還款紀錄對話框
 * 顯示某筆欠款的：總額 / 已還 / 未還 + 還款列表 + 新增還款（可上傳收據、一鍵還清）
 */
import { useState, useRef } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, Upload, X, ImageIcon } from "lucide-react"
import { ImageLightbox } from "@/components/card-claims/image-lightbox"
import { fmt, ymd, uploadReceipt, PAY_METHODS, type Debt, type DebtPayment } from "./shared"

export function PaymentsDialog({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const { toast } = useToast()
  const [lightbox, setLightbox] = useState<string | null>(null)

  const { data: payments = [] } = useQuery<DebtPayment[]>({
    queryKey: [`/api/debts/${debt.id}/payments`],
  })

  const total = Number(debt.amount) || 0
  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const remaining = Math.round((total - paid) * 100) / 100

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("/api/debts"),
    })

  const delMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/debts/payments/${id}`),
    onSuccess: () => {
      refresh()
      toast({ title: "已刪除該筆還款" })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>分期還款紀錄</DialogTitle>
          <DialogDescription>
            {debt.categoryName ?? "未分類"}
            {debt.creditor ? `・${debt.creditor}` : ""}
          </DialogDescription>
        </DialogHeader>

        {/* 進度摘要 */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-muted/30 p-2">
            <div className="text-xs text-muted-foreground">總額</div>
            <div className="font-semibold">{fmt(total)}</div>
          </div>
          <div className="rounded-lg border bg-green-50 p-2">
            <div className="text-xs text-green-700">已還</div>
            <div className="font-semibold text-green-700">{fmt(paid)}</div>
          </div>
          <div className="rounded-lg border bg-red-50 p-2">
            <div className="text-xs text-red-700">未還</div>
            <div className="font-semibold text-red-700">{fmt(remaining)}</div>
          </div>
        </div>

        {/* 還款列表 */}
        <div className="space-y-1 overflow-y-auto flex-1 min-h-[80px]">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              尚無還款紀錄，於下方新增第一筆
            </p>
          ) : (
            payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 text-sm border rounded-lg px-2 py-1.5"
              >
                <span className="text-muted-foreground w-24 shrink-0">{p.payDate}</span>
                <span className="font-medium w-20 shrink-0 text-right">
                  {fmt(Number(p.amount))}
                </span>
                <span className="text-muted-foreground flex-1 truncate">
                  {p.method ?? ""}
                  {p.note ? `・${p.note}` : ""}
                </span>
                {p.receiptImageUrl && (
                  <button
                    type="button"
                    onClick={() => setLightbox(p.receiptImageUrl)}
                    className="text-indigo-500"
                    title="檢視收據"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => delMut.mutate(p.id)}
                >
                  <Trash2 className="h-3 w-3 text-red-400" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* 新增還款 */}
        <AddPaymentForm debtId={debt.id} remaining={remaining} onAdded={refresh} />
      </DialogContent>
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </Dialog>
  )
}

function AddPaymentForm({
  debtId,
  remaining,
  onAdded,
}: {
  debtId: number
  remaining: number
  onAdded: () => void
}) {
  const { toast } = useToast()
  const [amount, setAmount] = useState("")
  const [payDate, setPayDate] = useState(ymd(new Date()))
  const [method, setMethod] = useState<string>("現金")
  const [note, setNote] = useState("")
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      setReceiptImageUrl(await uploadReceipt(file))
      toast({ title: "收據已上傳" })
    } catch (e) {
      toast({
        title: "上傳失敗",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const addMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/debts/${debtId}/payments`, {
        amount,
        payDate,
        method: method || null,
        note: note.trim() || null,
        receiptImageUrl,
      }),
    onSuccess: () => {
      setAmount("")
      setNote("")
      setReceiptImageUrl(null)
      onAdded()
      toast({ title: "已新增還款" })
    },
    onError: (e: Error) =>
      toast({ title: "新增失敗", description: e.message, variant: "destructive" }),
  })

  function submit() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({ title: "請輸入有效還款金額", variant: "destructive" })
      return
    }
    addMut.mutate()
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">新增還款</span>
        {remaining > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setAmount(String(Math.round(remaining)))}
          >
            一鍵填入未還 {fmt(remaining)}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">金額 *</Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <Label className="text-xs">日期 *</Label>
          <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">付款方式</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAY_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">備註</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="選填" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
            e.target.value = ""
          }}
        />
        {receiptImageUrl ? (
          <div className="flex items-center gap-1 text-xs text-green-700">
            <ImageIcon className="h-4 w-4" /> 已附收據
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={() => setReceiptImageUrl(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            {uploading ? "上傳中…" : "收據"}
          </Button>
        )}
        <Button className="ml-auto" onClick={submit} disabled={addMut.isPending}>
          <Plus className="h-4 w-4 mr-1" />
          {addMut.isPending ? "新增中…" : "新增還款"}
        </Button>
      </div>
    </div>
  )
}
