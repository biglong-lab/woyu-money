/**
 * 新增 / 編輯請款紀錄表單（含到帳欄位 + 預估到帳提示）
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
import { ImageLightbox } from "./image-lightbox"
import {
  STATUS_OPTIONS,
  fmt,
  ymd,
  feeRateOf,
  expectedSettlement,
  type Option,
  type BankOption,
  type Claim,
} from "./shared"

export function ClaimForm({
  claim,
  tags,
  properties,
  banks,
  onClose,
}: {
  claim: Claim | null
  tags: Option[]
  properties: Option[]
  banks: BankOption[]
  onClose: () => void
}) {
  const { toast } = useToast()
  const [amount, setAmount] = useState(claim?.amount ?? "")
  const [swipeDate, setSwipeDate] = useState(claim?.swipeDate ?? ymd(new Date()))
  const [bank, setBank] = useState(claim?.bank ?? "none")
  const [tagId, setTagId] = useState<string>(claim?.tagId ? String(claim.tagId) : "none")
  const [propertyIds, setPropertyIds] = useState<number[]>(claim?.propertyIds ?? [])
  const [status, setStatus] = useState(claim?.status ?? "pending")
  const [settledAmount, setSettledAmount] = useState(claim?.settledAmount ?? "")
  const [settledDate, setSettledDate] = useState(claim?.settledDate ?? "")
  const [notes, setNotes] = useState(claim?.notes ?? "")
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(
    claim?.receiptImageUrl ?? null
  )
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const feeRate = feeRateOf(bank === "none" ? null : bank, banks)
  const amountNum = parseFloat(amount) || 0
  const expected = expectedSettlement(amountNum, feeRate)

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" })
      if (!res.ok) throw new Error((await res.text()) || "上傳失敗")
      const data = (await res.json()) as { url: string }
      setReceiptImageUrl(data.url)
      toast({ title: "圖片已上傳" })
    } catch (e) {
      toast({
        title: "圖片上傳失敗",
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
        swipeDate,
        bank: bank === "none" ? null : bank,
        tagId: tagId === "none" ? null : Number(tagId),
        propertyIds,
        status,
        settledAmount: settledAmount || null,
        settledDate: settledDate || null,
        receiptImageUrl,
        notes: notes || null,
      }
      return claim
        ? apiRequest("PATCH", `/api/card-claims/${claim.id}`, body)
        : apiRequest("POST", "/api/card-claims", body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/card-claims"),
      })
      toast({ title: claim ? "已更新紀錄" : "已新增紀錄" })
      onClose()
    },
    onError: (e: Error) =>
      toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  })

  function submit() {
    if (!amount || isNaN(Number(amount))) {
      toast({ title: "請輸入有效金額", variant: "destructive" })
      return
    }
    save.mutate()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{claim ? "編輯請款紀錄" : "新增請款紀錄"}</DialogTitle>
          <DialogDescription>填寫刷卡請款資訊；到帳後可記錄實際到帳金額</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
          <div>
            <Label>結算金額 *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label>刷卡時間 *</Label>
            <Input type="date" value={swipeDate} onChange={(e) => setSwipeDate(e.target.value)} />
          </div>
          <div>
            <Label>刷卡銀行</Label>
            <Select value={bank} onValueChange={setBank}>
              <SelectTrigger>
                <SelectValue placeholder="選擇銀行" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">（不指定）</SelectItem>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.name}>
                    {b.name}
                    {parseFloat(b.feeRate ?? "0") > 0 ? `（手續費 ${b.feeRate}%）` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {amountNum > 0 && feeRate > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                預估到帳 <span className="font-medium text-indigo-600">{fmt(expected)}</span>
                （扣 {feeRate}% 手續費 {fmt(amountNum - expected)}）
              </p>
            )}
          </div>
          <div>
            <Label>請款標籤</Label>
            <Select value={tagId} onValueChange={setTagId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇標籤" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">（不指定）</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>館別（可多選）</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {properties.map((p) => {
                const checked = propertyIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setPropertyIds((prev) =>
                        checked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                      )
                    }
                    className={`text-sm px-2 py-1.5 rounded border text-left ${
                      checked ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-muted"
                    }`}
                  >
                    {checked ? "✓ " : ""}
                    {p.name}
                  </button>
                )
              })}
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
          {/* 到帳紀錄（閉環） */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <div className="text-sm font-medium">到帳紀錄（選填）</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">實際到帳金額</Label>
                <Input
                  type="number"
                  value={settledAmount}
                  onChange={(e) => setSettledAmount(e.target.value)}
                  placeholder={expected > 0 ? String(Math.round(expected)) : "0"}
                />
              </div>
              <div>
                <Label className="text-xs">到帳日期</Label>
                <Input
                  type="date"
                  value={settledDate}
                  onChange={(e) => setSettledDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div>
            <Label>收據圖片</Label>
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
                  alt="收據"
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
                    <Upload className="h-4 w-4 mr-1" /> 上傳收據圖片
                  </>
                )}
              </Button>
            )}
          </div>
          <div>
            <Label>備註</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
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
