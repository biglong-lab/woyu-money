/**
 * 帳單到期看板 — 通盤本月/近期應繳（法定付款日 + 強執分期），避免遲繳
 *
 * 2026-07-04：加「立即處理」— 每筆帳單可直接開付款 dialog 記錄付款，
 * payment_item 走 /api/payment/items/:id/payments（同步更新狀態+預算回沖）、
 * 強執分期走 /api/enforcement/installments/:id/payments。
 */
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, AlertCircle, CheckCircle2, Banknote } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatNT } from "@/lib/utils"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"

interface Bill {
  source: string
  refId: number
  name: string
  amount: number
  billIssuedDate: string | null
  dueDate: string | null
  finalDueDate: string | null
  penaltyNote: string | null
  daysUntil: number
  finalDaysUntil: number | null
  overdue: boolean
  penaltyRisk: boolean
  urgency: "penalty" | "overdue" | "grace" | "soon" | "upcoming"
}
interface BillsData {
  today: string
  days: number
  count: number
  totalDue: number
  overdueTotal: number
  penaltyRiskTotal: number
  bills: Bill[]
}

const URGENCY: Record<string, { label: string; cls: string }> = {
  penalty: { label: "罰款風險", cls: "bg-red-200 text-red-900 border-red-400" },
  overdue: { label: "逾期", cls: "bg-red-100 text-red-800 border-red-300" },
  grace: { label: "緩衝期", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  soon: { label: "7天內", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  upcoming: { label: "近期", cls: "bg-gray-100 text-gray-600 border-gray-200" },
}

const todayStr = () => {
  const tpe = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return tpe.toISOString().slice(0, 10)
}

export default function BillsPage() {
  useDocumentTitle("帳單到期看板")
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [days, setDays] = useState("45")
  const { data, isLoading } = useQuery<BillsData>({
    queryKey: [`/api/bills/upcoming?days=${days}`],
  })

  // ── 立即處理（付款 dialog）──
  const [payTarget, setPayTarget] = useState<Bill | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState(todayStr())
  const [payMethod, setPayMethod] = useState("bank_transfer")
  const [payNotes, setPayNotes] = useState("")

  function openPay(b: Bill) {
    setPayTarget(b)
    setPayAmount(String(Math.round(b.amount * 100) / 100))
    setPayDate(todayStr())
    setPayMethod("bank_transfer")
    setPayNotes("")
  }

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payTarget) throw new Error("無付款對象")
      const amt = parseFloat(payAmount)
      if (!(amt > 0)) throw new Error("金額需為正數")
      if (payTarget.source === "enforcement_installment") {
        return apiRequest("POST", `/api/enforcement/installments/${payTarget.refId}/payments`, {
          amount: String(amt),
          paymentDate: payDate,
          notes: payNotes || `帳單看板立即處理（${payTarget.name}）`,
        })
      }
      return apiRequest("POST", `/api/payment/items/${payTarget.refId}/payments`, {
        amount: String(amt),
        paymentDate: payDate,
        paymentMethod: payMethod,
        notes: payNotes || "帳單看板立即處理",
      })
    },
    onSuccess: () => {
      toast({ title: `✅ 已付款 ${formatNT(parseFloat(payAmount))}`, description: payTarget?.name })
      setPayTarget(null)
      queryClient.invalidateQueries({ queryKey: [`/api/bills/upcoming?days=${days}`] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/priority-report"] })
    },
    onError: (e: Error) =>
      toast({ title: "付款失敗", description: e.message, variant: "destructive" }),
  })

  return (
    <div className="container mx-auto py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <CalendarClock className="h-6 w-6 text-indigo-600" />
            帳單到期看板
          </h1>
          <p className="text-gray-500 text-sm">
            通盤近期應繳：法定付款日優先 + 強執分期每月應付，逾期/即將到期一眼看，避免遲繳
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-32" data-testid="days-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["15", "30", "45", "60", "90"].map((d) => (
              <SelectItem key={d} value={d}>
                未來 {d} 天
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">應繳合計</div>
              <div className="text-xl font-bold">{formatNT(data.totalDue)}</div>
              <div className="text-xs text-gray-400">{data.count} 筆</div>
            </CardContent>
          </Card>
          <Card className={data.overdueTotal > 0 ? "border-red-200 bg-red-50/50" : ""}>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <AlertCircle
                  className={`h-3 w-3 ${data.overdueTotal > 0 ? "text-red-500" : "text-gray-400"}`}
                />
                逾期金額
              </div>
              <div className={`text-xl font-bold ${data.overdueTotal > 0 ? "text-red-600" : ""}`}>
                {formatNT(data.overdueTotal)}
              </div>
            </CardContent>
          </Card>
          <Card className={data.penaltyRiskTotal > 0 ? "border-red-300 bg-red-100/50" : ""}>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">罰款風險（過最終必繳日）</div>
              <div
                className={`text-xl font-bold ${data.penaltyRiskTotal > 0 ? "text-red-700" : ""}`}
              >
                {formatNT(data.penaltyRiskTotal)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">應繳清單</CardTitle>
          <CardDescription>依到期日排序；強執分期自動投影本月與下月應付</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {isLoading ? (
            <div className="text-center text-gray-400 py-6">載入中…</div>
          ) : !data || data.bills.length === 0 ? (
            <div className="text-center text-gray-400 py-6">近期無待繳帳單 🎉</div>
          ) : (
            data.bills.map((b, i) => {
              const u = URGENCY[b.urgency]
              return (
                <div
                  key={`${b.source}-${b.refId}-${i}`}
                  className="flex items-center gap-3 border-b py-2 text-sm flex-wrap"
                  data-testid={`bill-${b.source}-${b.refId}`}
                >
                  <span className="font-bold w-24 shrink-0">{formatNT(b.amount)}</span>
                  <Badge className={`shrink-0 border ${u.cls}`}>{u.label}</Badge>
                  <div className="flex-1 min-w-[140px]">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-gray-400">
                      法定付款 {b.dueDate ?? "—"}
                      {b.finalDueDate ? ` · 最終必繳 ${b.finalDueDate}` : ""}
                      {b.billIssuedDate ? ` · 帳單到 ${b.billIssuedDate}` : ""}
                    </div>
                    {b.penaltyNote && <div className="text-xs text-red-500">⚠ {b.penaltyNote}</div>}
                  </div>
                  <span
                    className={`text-xs shrink-0 ${b.overdue ? "text-red-600 font-medium" : "text-gray-500"}`}
                  >
                    {b.penaltyRisk && b.finalDaysUntil !== null
                      ? `過必繳 ${-b.finalDaysUntil} 天`
                      : b.overdue
                        ? `逾期 ${-b.daysUntil} 天`
                        : `${b.daysUntil} 天後`}
                  </span>
                  <Button
                    size="sm"
                    variant={b.overdue || b.penaltyRisk ? "default" : "outline"}
                    className="shrink-0 h-7 px-2.5 text-xs"
                    onClick={() => openPay(b)}
                    data-testid={`pay-${b.source}-${b.refId}`}
                  >
                    <Banknote className="h-3.5 w-3.5 mr-1" />
                    立即處理
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* 立即處理付款 Dialog */}
      <Dialog open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              立即處理付款
            </DialogTitle>
            <DialogDescription>
              {payTarget?.name}
              {payTarget?.source === "enforcement_installment" ? "（強執分期）" : ""}
              {payTarget?.dueDate ? ` · 法定付款日 ${payTarget.dueDate}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pay-amount">
                付款金額（應繳 {formatNT(payTarget?.amount ?? 0)}）
              </Label>
              <Input
                id="pay-amount"
                type="number"
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pay-date">付款日期</Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
              {payTarget?.source !== "enforcement_installment" && (
                <div>
                  <Label>付款方式</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                      <SelectItem value="cash">現金</SelectItem>
                      <SelectItem value="credit_card">信用卡</SelectItem>
                      <SelectItem value="check">支票</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="pay-notes">備註（選填）</Label>
              <Textarea
                id="pay-notes"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="例：郵局臨櫃繳納"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>
              取消
            </Button>
            <Button
              onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending || !(parseFloat(payAmount) > 0)}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {payMutation.isPending ? "處理中…" : "確認付款"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BackToTop />
    </div>
  )
}
