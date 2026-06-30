/**
 * 新增 / 編輯欠款表單（含單據上傳 + 歸帳科目）
 */
import { useState, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Upload, X } from "lucide-react"
import { ImageLightbox } from "@/components/card-claims/image-lightbox"
import { STATUS_OPTIONS, uploadReceipt, type Category, type Debt } from "./shared"

export function DebtForm({
  debt,
  categories,
  onClose,
}: {
  debt: Debt | null
  categories: Category[]
  onClose: () => void
}) {
  const { toast } = useToast()
  const [amount, setAmount] = useState(debt?.amount ?? "")
  const [categoryId, setCategoryId] = useState<string>(
    debt?.categoryId ? String(debt.categoryId) : "none"
  )
  const [creditor, setCreditor] = useState(debt?.creditor ?? "")
  const [incurDate, setIncurDate] = useState(debt?.incurDate ?? "")
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? "")
  const [status, setStatus] = useState(debt?.status ?? "open")
  const [accountCode, setAccountCode] = useState(debt?.accountCode ?? "")
  const [note, setNote] = useState(debt?.note ?? "")
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(
    debt?.receiptImageUrl ?? null
  )
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const url = await uploadReceipt(file)
      setReceiptImageUrl(url)
      toast({ title: "單據已上傳" })
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

  const save = useMutation({
    mutationFn: () => {
      const body = {
        amount,
        categoryId: categoryId === "none" ? null : Number(categoryId),
        creditor: creditor.trim() || null,
        incurDate: incurDate || null,
        dueDate: dueDate || null,
        status,
        accountCode: accountCode.trim() || null,
        note: note.trim() || null,
        receiptImageUrl,
      }
      return debt
        ? apiRequest("PATCH", `/api/debts/${debt.id}`, body)
        : apiRequest("POST", "/api/debts", body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/debts"),
      })
      toast({ title: debt ? "已更新欠款" : "已新增欠款" })
      onClose()
    },
    onError: (e: Error) =>
      toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  })

  function submit() {
    if (!amount || isNaN(Number(amount)) || Number(amount) < 0) {
      toast({ title: "請輸入有效金額", variant: "destructive" })
      return
    }
    save.mutate()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{debt ? "編輯欠款" : "新增欠款"}</DialogTitle>
          <DialogDescription>先把欠款登打進來掌握全貌，之後再分期還款與歸帳</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
          <div>
            <Label>欠款總額 *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label>分類</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇分類" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">（不指定）</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>債權人 / 對象（欠誰的）</Label>
            <Input
              value={creditor}
              onChange={(e) => setCreditor(e.target.value)}
              placeholder="例：王老闆 / 國稅局 / 某銀行"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>發生日期</Label>
              <Input type="date" value={incurDate} onChange={(e) => setIncurDate(e.target.value)} />
            </div>
            <div>
              <Label>期限 / 到期日</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>狀態</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {status === "reconciled" && (
            <div>
              <Label>歸帳科目 / 備註</Label>
              <Input
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                placeholder="例：應付帳款 / 短期借款"
              />
            </div>
          )}
          <div>
            <Label>單據圖片</Label>
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
              <div className="flex items-center gap-2 mt-1">
                <img
                  src={receiptImageUrl}
                  alt="單據"
                  onClick={() => setLightbox(true)}
                  className="h-16 w-16 rounded object-cover border cursor-pointer"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setReceiptImageUrl(null)}
                >
                  <X className="h-4 w-4 mr-1" /> 移除
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full mt-1"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  "上傳中…"
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-1" /> 上傳單據圖片
                  </>
                )}
              </Button>
            )}
          </div>
          <div>
            <Label>備註</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? "儲存中…" : "儲存"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {lightbox && receiptImageUrl && (
        <ImageLightbox src={receiptImageUrl} onClose={() => setLightbox(false)} />
      )}
    </Dialog>
  )
}
