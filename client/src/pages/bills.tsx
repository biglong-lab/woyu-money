/**
 * 帳單到期看板 — 通盤本月/近期應繳（法定付款日 + 強執分期），避免遲繳
 *
 * 2026-07-04：加「立即處理」— 每筆帳單可直接開付款 dialog 記錄付款，
 * payment_item 走 /api/payment/items/:id/payments（同步更新狀態+預算回沖）、
 * 強執分期走 /api/enforcement/installments/:id/payments。
 */
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, AlertCircle, CheckCircle2, Banknote, Download } from "lucide-react"
import PaymentActionTabs from "@/components/payment-action-tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  const [payFile, setPayFile] = useState<File | null>(null)

  function openPay(b: Bill) {
    setPayTarget(b)
    setPayAmount(String(Math.round(b.amount * 100) / 100))
    setPayDate(todayStr())
    setPayMethod("bank_transfer")
    setPayNotes("")
    setPayFile(null)
  }

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payTarget) throw new Error("無付款對象")
      const amt = parseFloat(payAmount)
      if (!(amt > 0)) throw new Error("金額需為正數")
      // 統一用 FormData（兩端點都收 multipart、receiptFile 選填）
      const fd = new FormData()
      fd.append("amount", String(amt))
      fd.append("paymentDate", payDate)
      if (payFile) fd.append("receiptFile", payFile)
      if (payTarget.source === "enforcement_installment") {
        fd.append("notes", payNotes || `帳單看板立即處理（${payTarget.name}）`)
        return apiRequest("POST", `/api/enforcement/installments/${payTarget.refId}/payments`, fd)
      }
      fd.append("paymentMethod", payMethod)
      fd.append("notes", payNotes || "帳單看板立即處理")
      return apiRequest("POST", `/api/payment/items/${payTarget.refId}/payments`, fd)
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

  // ── 批次處理 ──
  const billKey = (b: Bill) => `${b.source}-${b.refId}-${b.dueDate}`
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchDate, setBatchDate] = useState(todayStr())
  const [batchMethod, setBatchMethod] = useState("bank_transfer")
  const [batchNotes, setBatchNotes] = useState("")
  const [batchProgress, setBatchProgress] = useState<string | null>(null)

  const selectedBills = (data?.bills ?? []).filter((b) => selected.has(billKey(b)))
  const selectedTotal = selectedBills.reduce((s, b) => s + b.amount, 0)

  function toggleSelect(b: Bill) {
    setSelected((prev) => {
      const next = new Set(prev)
      const k = billKey(b)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }
  function toggleSelectAll() {
    const bills = data?.bills ?? []
    setSelected((prev) => (prev.size === bills.length ? new Set() : new Set(bills.map(billKey))))
  }

  /** 匯出應繳清單 CSV（BOM + UTF-8、Excel 可直接開；勾選了就只匯出勾選的） */
  function exportCsv() {
    const bills = selectedBills.length > 0 ? selectedBills : (data?.bills ?? [])
    if (bills.length === 0) return
    const header = ["名稱", "金額", "法定付款日", "最終必繳日", "狀態", "天數", "備註"]
    const urgencyLabel = (u: Bill["urgency"]) => URGENCY[u]?.label ?? u
    const rows = bills.map((b) => [
      b.name,
      String(b.amount),
      b.dueDate ?? "",
      b.finalDueDate ?? "",
      urgencyLabel(b.urgency),
      b.overdue ? `逾期 ${-b.daysUntil} 天` : `${b.daysUntil} 天後`,
      b.penaltyNote ?? "",
    ])
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `應繳帳單_${todayStr()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  /** 強執下月投影用其到期日入帳（歸對月份）；其餘用批次日期 */
  function paymentDateFor(b: Bill): string {
    if (b.source === "enforcement_installment" && b.dueDate) {
      if (b.dueDate.slice(0, 7) !== batchDate.slice(0, 7)) return b.dueDate
    }
    return batchDate
  }

  const batchMutation = useMutation({
    mutationFn: async () => {
      let ok = 0
      const failed: string[] = []
      for (let i = 0; i < selectedBills.length; i++) {
        const b = selectedBills[i]
        setBatchProgress(`處理中 ${i + 1}/${selectedBills.length}：${b.name}`)
        try {
          if (b.source === "enforcement_installment") {
            await apiRequest("POST", `/api/enforcement/installments/${b.refId}/payments`, {
              amount: String(b.amount),
              paymentDate: paymentDateFor(b),
              notes: batchNotes || `帳單看板批次處理（${b.name}）`,
            })
          } else {
            await apiRequest("POST", `/api/payment/items/${b.refId}/payments`, {
              amount: String(b.amount),
              paymentDate: batchDate,
              paymentMethod: batchMethod,
              notes: batchNotes || "帳單看板批次處理",
            })
          }
          ok++
        } catch (e) {
          failed.push(`${b.name}（${e instanceof Error ? e.message : "未知錯誤"}）`)
        }
      }
      return { ok, failed }
    },
    onSuccess: ({ ok, failed }) => {
      setBatchProgress(null)
      setBatchOpen(false)
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: [`/api/bills/upcoming?days=${days}`] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/priority-report"] })
      if (failed.length === 0) {
        toast({ title: `✅ 批次完成：${ok} 筆全數付款` })
      } else {
        toast({
          title: `批次完成：成功 ${ok} 筆、失敗 ${failed.length} 筆`,
          description: failed.slice(0, 3).join("；") + (failed.length > 3 ? "…" : ""),
          variant: "destructive",
        })
      }
    },
    onError: (e: Error) => {
      setBatchProgress(null)
      toast({ title: "批次處理失敗", description: e.message, variant: "destructive" })
    },
  })

  return (
    <div className="container mx-auto py-6 space-y-5">
      <PaymentActionTabs />
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={!data || data.bills.length === 0}
            data-testid="export-csv"
          >
            <Download className="h-4 w-4 mr-1" />
            匯出 CSV{selected.size > 0 ? `（勾選 ${selected.size} 筆）` : ""}
          </Button>
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

      {/* 批次操作列（有勾選時顯示、sticky 置頂） */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 shadow-sm">
          <span className="text-sm font-medium text-emerald-900">
            已勾選 {selected.size} 筆 · 合計 {formatNT(selectedTotal)}
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              取消勾選
            </Button>
            <Button size="sm" onClick={() => setBatchOpen(true)} data-testid="batch-pay-open">
              <Banknote className="h-4 w-4 mr-1" />
              批次處理（{selected.size} 筆）
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">應繳清單</CardTitle>
              <CardDescription>依到期日排序；強執分期自動投影本月與下月應付</CardDescription>
            </div>
            {data && data.bills.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                <Checkbox
                  checked={selected.size === data.bills.length && data.bills.length > 0}
                  onCheckedChange={toggleSelectAll}
                  data-testid="select-all"
                />
                全選
              </label>
            )}
          </div>
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
                  className={`flex items-center gap-3 border-b py-2 text-sm flex-wrap ${
                    selected.has(billKey(b)) ? "bg-emerald-50/60 -mx-2 px-2 rounded" : ""
                  }`}
                  data-testid={`bill-${b.source}-${b.refId}`}
                >
                  <Checkbox
                    checked={selected.has(billKey(b))}
                    onCheckedChange={() => toggleSelect(b)}
                    className="shrink-0"
                    data-testid={`select-${b.source}-${b.refId}`}
                  />
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" && parseFloat(payAmount) > 0 && !payMutation.isPending)
                    payMutation.mutate()
                }}
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
            <div>
              <Label htmlFor="pay-receipt">收據存證（選填、手機可直接拍照）</Label>
              <Input
                id="pay-receipt"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setPayFile(e.target.files?.[0] ?? null)}
              />
              {payFile && (
                <p className="mt-1 flex items-center gap-2 text-xs text-emerald-700">
                  📎 {payFile.name}（{Math.round(payFile.size / 1024)} KB）
                  <button
                    type="button"
                    className="text-gray-400 underline"
                    onClick={() => setPayFile(null)}
                  >
                    移除
                  </button>
                </p>
              )}
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
      {/* 批次處理 Dialog */}
      <Dialog
        open={batchOpen}
        onOpenChange={(open) => !batchMutation.isPending && setBatchOpen(open)}
      >
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              批次處理付款（{selectedBills.length} 筆）
            </DialogTitle>
            <DialogDescription>
              合計 {formatNT(selectedTotal)} · 每筆以其未付餘額入帳
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="max-h-36 overflow-y-auto rounded border bg-gray-50 p-2 text-xs space-y-1">
              {selectedBills.map((b) => (
                <div key={billKey(b)} className="flex justify-between gap-2">
                  <span className="truncate">{b.name}</span>
                  <span className="font-mono shrink-0">{formatNT(b.amount)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="batch-date">付款日期</Label>
                <Input
                  id="batch-date"
                  type="date"
                  value={batchDate}
                  onChange={(e) => setBatchDate(e.target.value)}
                />
              </div>
              <div>
                <Label>付款方式</Label>
                <Select value={batchMethod} onValueChange={setBatchMethod}>
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
            </div>
            {selectedBills.some(
              (b) =>
                b.source === "enforcement_installment" &&
                b.dueDate &&
                b.dueDate.slice(0, 7) !== batchDate.slice(0, 7)
            ) && (
              <p className="text-xs text-amber-600">
                ⚠ 內含下月的強執分期：該筆會以其到期日入帳（歸對月份）
              </p>
            )}
            <div>
              <Label htmlFor="batch-notes">備註（選填、套用到每筆）</Label>
              <Textarea
                id="batch-notes"
                value={batchNotes}
                onChange={(e) => setBatchNotes(e.target.value)}
                rows={2}
              />
            </div>
            {batchProgress && (
              <p className="text-sm text-emerald-700 animate-pulse">{batchProgress}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBatchOpen(false)}
              disabled={batchMutation.isPending}
            >
              取消
            </Button>
            <Button
              onClick={() => batchMutation.mutate()}
              disabled={batchMutation.isPending || selectedBills.length === 0}
              data-testid="batch-pay-confirm"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {batchMutation.isPending ? "處理中…" : `確認付款 ${formatNT(selectedTotal)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BackToTop />
    </div>
  )
}
