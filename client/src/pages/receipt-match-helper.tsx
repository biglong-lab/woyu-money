/**
 * 收據對應助手（第 10 步）
 * 輸入收據資訊 → 系統回傳匹配建議 → 一鍵標記已付
 */

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Receipt, CheckCircle2, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { localDateISO } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type Confidence = "high" | "medium" | "low"

interface CandidateItem {
  id: number
  itemName: string
  totalAmount: number
  paidAmount: number
  categoryName?: string | null
}

interface MatchCandidate {
  item: CandidateItem
  score: number
  reasons: string[]
  confidence: Confidence
}

interface MatchResult {
  query: {
    amount?: number | null
    receiptDate?: string | null
    vendor?: string | null
    ocrText?: string | null
  }
  totalCandidates: number
  bestMatch: MatchCandidate | null
  candidates: MatchCandidate[]
  autoConfirmable: boolean
}

interface SuggestPayload {
  amount?: number
  receiptDate?: string
  vendor?: string
  ocrText?: string
}

const CONF_META: Record<Confidence, { label: string; color: string }> = {
  high: { label: "高信心", color: "bg-green-100 text-green-800 border-green-300" },
  medium: { label: "中信心", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  low: { label: "低信心", color: "bg-gray-100 text-gray-700 border-gray-300" },
}

function fmt(n: number): string {
  return `NT$ ${Math.round(n).toLocaleString()}`
}

function CandidateCard({
  candidate,
  onMarkPaid,
  isPending,
}: {
  candidate: MatchCandidate
  onMarkPaid: () => void
  isPending: boolean
}) {
  const conf = CONF_META[candidate.confidence]
  const unpaid = candidate.item.totalAmount - candidate.item.paidAmount
  return (
    <div className={`rounded-lg border-l-4 p-3 ${conf.color}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">{candidate.item.itemName}</div>
        <Badge variant="outline" className="text-xs">
          {conf.label} · {candidate.score} 分
        </Badge>
      </div>
      <div className="text-xs text-gray-700 space-y-0.5">
        <div>
          應付 {fmt(candidate.item.totalAmount)} / 已付 {fmt(candidate.item.paidAmount)} / 未付{" "}
          <strong>{fmt(unpaid)}</strong>
        </div>
        {candidate.item.categoryName && <div>分類：{candidate.item.categoryName}</div>}
        {candidate.reasons.length > 0 && (
          <div className="text-gray-600 italic">原因：{candidate.reasons.join("、")}</div>
        )}
      </div>
      <div className="mt-2">
        <Button
          size="sm"
          onClick={onMarkPaid}
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700 text-xs"
          data-testid={`match-mark-paid-${candidate.item.id}`}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {isPending ? "處理中..." : "標記此項為已付"}
        </Button>
      </div>
    </div>
  )
}

export default function ReceiptMatchHelperPage() {
  const [amount, setAmount] = useState("")
  const [receiptDate, setReceiptDate] = useState("")
  const [vendor, setVendor] = useState("")
  const [ocrText, setOcrText] = useState("")
  const [result, setResult] = useState<MatchResult | null>(null)
  const { toast } = useToast()

  const suggestMutation = useMutation<MatchResult, Error, SuggestPayload>({
    mutationFn: (payload) => apiRequest("POST", "/api/receipt-match/suggest", payload),
    onSuccess: (data) => setResult(data),
    onError: (err) =>
      toast({ title: "查詢失敗", description: err.message, variant: "destructive" }),
  })

  const markPaidMutation = useMutation<unknown, Error, { itemId: number; amountPaid: number }>({
    mutationFn: (data) =>
      apiRequest("POST", "/api/payment/records", {
        itemId: data.itemId,
        amountPaid: data.amountPaid,
        paymentDate: receiptDate || localDateISO(),
      }),
    onSuccess: () => {
      toast({ title: "已標記為已付款" })
      setResult(null)
      setAmount("")
      setReceiptDate("")
      setVendor("")
      setOcrText("")
      queryClient.invalidateQueries({ queryKey: ["/api/payment/priority-report?includeLow=true"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
    },
    onError: (err) =>
      toast({ title: "標記失敗", description: err.message, variant: "destructive" }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: SuggestPayload = {}
    const n = Number(amount.replace(/[,\s]/g, ""))
    if (Number.isFinite(n) && n > 0) payload.amount = n
    if (receiptDate) payload.receiptDate = receiptDate
    if (vendor.trim()) payload.vendor = vendor.trim()
    if (ocrText.trim()) payload.ocrText = ocrText.trim()
    if (!payload.amount && !payload.vendor && !payload.ocrText) {
      toast({
        title: "請至少填寫一項",
        description: "金額 / 廠商 / OCR 文字擇一",
        variant: "destructive",
      })
      return
    }
    suggestMutation.mutate(payload)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt className="h-7 w-7 text-blue-600" />
          收據對應助手
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          輸入收據資訊，系統自動匹配既有付款項目，一鍵標記已付（避免重複建立）
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">收據資訊</CardTitle>
          <CardDescription className="text-xs">
            金額、廠商、OCR 文字任一即可；提供越多資訊匹配越精準
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="amount">金額</Label>
              <Input
                id="amount"
                inputMode="numeric"
                placeholder="例如：12,000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="date">日期</Label>
              <Input
                id="date"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="vendor">廠商</Label>
              <Input
                id="vendor"
                placeholder="例如：台電、中華電信"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ocr">OCR 辨識文字（選填）</Label>
              <Textarea
                id="ocr"
                placeholder="貼上 OCR 辨識的收據文字"
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                rows={3}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={suggestMutation.isPending}>
                {suggestMutation.isPending ? "搜尋中..." : "尋找匹配項目"}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">
              匹配結果
              {result.autoConfirmable && (
                <Badge className="ml-2 bg-green-100 text-green-800" variant="outline">
                  可自動確認
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              共掃描 {result.totalCandidates} 個未付項目，找到 {result.candidates.length} 個建議
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.candidates.length === 0 ? (
              <div className="text-sm text-gray-600 py-4">
                沒有符合的既有項目。可能需要新建付款項目。
              </div>
            ) : (
              result.candidates.map((c) => (
                <CandidateCard
                  key={c.item.id}
                  candidate={c}
                  isPending={markPaidMutation.isPending}
                  onMarkPaid={() =>
                    markPaidMutation.mutate({
                      itemId: c.item.id,
                      amountPaid: c.item.totalAmount - c.item.paidAmount,
                    })
                  }
                />
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
