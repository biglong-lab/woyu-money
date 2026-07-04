/**
 * 強制執行管理 — 公文 / 圈存 / 分期 + 對帳
 * 對帳核心：強執總額 ≈ 圈存 + 分期（差異/未歸類清楚呈現）
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"
import { Gavel, Trash2, Plus, Download } from "lucide-react"
import { formatNT } from "@/lib/utils"
import EnforcementCaseDialog from "@/components/enforcement-case-dialog"

interface EnfCase {
  id: number
  caseNumber: string | null
  agency: string | null
  contactPhone: string | null
  subject: string | null
  totalAmount: string
  issuedDate: string | null
  status: string
  notes: string | null
  attachments?: Array<{ url: string }>
}
interface Seizure {
  id: number
  caseId: number | null
  bankName: string | null
  amount: string
  seizureDate: string | null
  status: string
  notes: string | null
}
interface Installment {
  id: number
  caseId: number | null
  planName: string | null
  startDate: string | null
  monthlyAmount: string
  periods: number | null
  totalAmount: string | null
  status: string
}
interface Reconcile {
  enforcedTotal: number
  seizedTotal: number
  installmentPlanTotal: number
  installmentPaidTotal: number
  unclassifiedSeized: number
  unclassifiedInstallment: number
  diff: number
  caseCount: number
}

function useEnfInvalidate() {
  return () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0] as string).startsWith("/api/enforcement"),
    })
}

export default function EnforcementPage() {
  useDocumentTitle("強制執行管理")
  const { toast } = useToast()
  const invalidate = useEnfInvalidate()

  const [caseDialogOpen, setCaseDialogOpen] = useState(false)
  const [editingCase, setEditingCase] = useState<EnfCase | null>(null)

  const { data: rec } = useQuery<Reconcile>({ queryKey: ["/api/enforcement/reconcile"] })
  const { data: cases = [] } = useQuery<EnfCase[]>({ queryKey: ["/api/enforcement/cases"] })
  const { data: seizures = [] } = useQuery<Seizure[]>({ queryKey: ["/api/enforcement/seizures"] })
  const { data: installments = [] } = useQuery<Installment[]>({
    queryKey: ["/api/enforcement/installments"],
  })

  const caseName = (id: number | null) => {
    if (!id) return "未歸類"
    const c = cases.find((x) => x.id === id)
    return c ? c.subject || c.caseNumber || `公文#${c.id}` : `公文#${id}`
  }

  const del = useMutation({
    mutationFn: async ({ kind, id }: { kind: string; id: number }) =>
      apiRequest("DELETE", `/api/enforcement/${kind}/${id}`),
    onSuccess: () => {
      invalidate()
      toast({ title: "已刪除" })
    },
  })

  /** 匯出強執全貌 CSV（對帳摘要 + 公文 + 圈存 + 分期三區、BOM+UTF-8）— 對法院/會計 */
  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const row = (cols: string[]) => cols.map(esc).join(",")
    const lines: string[] = []
    if (rec) {
      lines.push(row(["【對帳摘要】"]))
      lines.push(row(["強執總額", "圈存合計", "分期計畫合計", "分期已繳", "差額", "案件數"]))
      lines.push(
        row([
          String(rec.enforcedTotal),
          String(rec.seizedTotal),
          String(rec.installmentPlanTotal),
          String(rec.installmentPaidTotal),
          String(rec.diff),
          String(rec.caseCount),
        ])
      )
      lines.push("")
    }
    lines.push(row(["【公文案件】"]))
    lines.push(row(["案號", "機關", "事由", "總額", "發文日", "狀態", "備註"]))
    for (const c of cases) {
      lines.push(
        row([
          c.caseNumber ?? "",
          c.agency ?? "",
          c.subject ?? "",
          c.totalAmount,
          c.issuedDate ?? "",
          c.status,
          c.notes ?? "",
        ])
      )
    }
    lines.push("")
    lines.push(row(["【圈存】"]))
    lines.push(row(["歸屬公文", "銀行", "金額", "圈存日", "狀態", "備註"]))
    for (const s of seizures) {
      lines.push(
        row([
          caseName(s.caseId),
          s.bankName ?? "",
          s.amount,
          s.seizureDate ?? "",
          s.status,
          s.notes ?? "",
        ])
      )
    }
    lines.push("")
    lines.push(row(["【分期計畫】"]))
    lines.push(row(["歸屬公文", "計畫名稱", "起始日", "月付額", "期數", "總額", "狀態"]))
    for (const i of installments) {
      lines.push(
        row([
          caseName(i.caseId),
          i.planName ?? "",
          i.startDate ?? "",
          i.monthlyAmount,
          i.periods != null ? String(i.periods) : "",
          i.totalAmount ?? "",
          i.status,
        ])
      )
    }
    const csv = "﻿" + lines.join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `強制執行_${new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="container mx-auto py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <Gavel className="h-6 w-6 text-rose-600" />
            強制執行管理
          </h1>
          <p className="text-gray-500 text-sm">
            公文 / 圈存 / 分期對帳：強執總額 ≈ 圈存 + 分期，掌握被執行的錢歸屬
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={cases.length === 0 && seizures.length === 0 && installments.length === 0}
            data-testid="enf-export-csv"
          >
            <Download className="h-4 w-4 mr-1" /> 匯出 CSV
          </Button>
          <Button
            onClick={() => {
              setEditingCase(null)
              setCaseDialogOpen(true)
            }}
            className="bg-rose-600 hover:bg-rose-700"
            data-testid="add-case"
          >
            <Plus className="h-4 w-4 mr-1" /> 新增公文
          </Button>
        </div>
      </div>

      {/* 對帳等式 */}
      {rec && (
        <Card className="border-rose-200 bg-rose-50/40">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Stat label="強執總額" value={rec.enforcedTotal} cls="text-rose-700" big />
              <span className="text-2xl text-gray-400">≈</span>
              <Stat label="圈存中" value={rec.seizedTotal} cls="text-blue-700" />
              <span className="text-xl text-gray-400">+</span>
              <Stat label="分期計畫" value={rec.installmentPlanTotal} cls="text-amber-700" />
              <span className="text-xl text-gray-400">｜</span>
              <Stat
                label="差異（未對上）"
                value={rec.diff}
                cls={Math.abs(rec.diff) > 1 ? "text-red-600" : "text-green-600"}
              />
            </div>
            <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-x-4">
              <span>已分期付款累計 {formatNT(rec.installmentPaidTotal)}</span>
              {rec.unclassifiedSeized > 0 && (
                <span className="text-amber-600">
                  未歸類圈存 {formatNT(rec.unclassifiedSeized)}
                </span>
              )}
              {rec.unclassifiedInstallment > 0 && (
                <span className="text-amber-600">
                  未歸類分期 {formatNT(rec.unclassifiedInstallment)}
                </span>
              )}
              <span>{rec.caseCount} 件公文</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 公文清單 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">強執公文（{cases.length}）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {cases.length === 0 ? (
            <div className="text-center text-gray-400 py-4 text-sm">
              尚無公文，點右上「新增公文」
            </div>
          ) : (
            cases.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 border rounded p-2 flex-wrap"
                data-testid={`case-${c.id}`}
              >
                <div className="font-bold text-rose-700 w-28 shrink-0">
                  {formatNT(Number(c.totalAmount))}
                </div>
                <div className="flex-1 min-w-[160px]">
                  <div className="font-medium text-sm">{c.subject || "（未填案由）"}</div>
                  <div className="text-xs text-gray-400">
                    {[c.agency, c.caseNumber, c.issuedDate].filter(Boolean).join(" · ") || "—"}
                    {c.contactPhone ? ` · ☎ ${c.contactPhone}` : ""}
                  </div>
                </div>
                {c.attachments && c.attachments.length > 0 && (
                  <Badge variant="outline" className="shrink-0">
                    📎 {c.attachments.length}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingCase(c)
                    setCaseDialogOpen(true)
                  }}
                  data-testid={`edit-case-${c.id}`}
                >
                  編輯
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-red-500 shrink-0"
                  onClick={() => del.mutate({ kind: "cases", id: c.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 圈存 */}
      <SeizureSection
        seizures={seizures}
        cases={cases}
        caseName={caseName}
        onDelete={(id) => del.mutate({ kind: "seizures", id })}
      />

      {/* 分期 */}
      <InstallmentSection
        installments={installments}
        cases={cases}
        caseName={caseName}
        onDelete={(id) => del.mutate({ kind: "installments", id })}
      />

      <EnforcementCaseDialog
        open={caseDialogOpen}
        onOpenChange={setCaseDialogOpen}
        editing={editingCase}
      />
      <BackToTop />
    </div>
  )
}

function Stat({
  label,
  value,
  cls,
  big,
}: {
  label: string
  value: number
  cls: string
  big?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`font-bold ${big ? "text-2xl" : "text-xl"} ${cls}`}>{formatNT(value)}</div>
    </div>
  )
}

// ── 圈存區 ──
function SeizureSection({
  seizures,
  cases,
  caseName,
  onDelete,
}: {
  seizures: Seizure[]
  cases: EnfCase[]
  caseName: (id: number | null) => string
  onDelete: (id: number) => void
}) {
  const { toast } = useToast()
  const invalidate = useEnfInvalidate()
  const [f, setF] = useState({ caseId: "", bankName: "", amount: "", seizureDate: "" })
  const [file, setFile] = useState<File | null>(null)
  const add = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      if (f.caseId) fd.append("caseId", f.caseId)
      if (f.bankName) fd.append("bankName", f.bankName)
      fd.append("amount", f.amount)
      if (f.seizureDate) fd.append("seizureDate", f.seizureDate)
      if (file) fd.append("receiptFile", file)
      return apiRequest("POST", "/api/enforcement/seizures", fd)
    },
    onSuccess: () => {
      invalidate()
      toast({ title: "✅ 已記圈存" })
      setF({ caseId: "", bankName: "", amount: "", seizureDate: "" })
      setFile(null)
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">銀行圈存（{seizures.length}）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={f.caseId}
            onChange={(e) => setF({ ...f, caseId: e.target.value })}
            data-testid="seizure-case"
          >
            <option value="">未歸類</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.subject || c.caseNumber || `公文#${c.id}`}
              </option>
            ))}
          </select>
          <Input
            placeholder="銀行"
            value={f.bankName}
            onChange={(e) => setF({ ...f, bankName: e.target.value })}
          />
          <Input
            type="number"
            placeholder="金額"
            value={f.amount}
            onChange={(e) => setF({ ...f, amount: e.target.value })}
            data-testid="seizure-amount"
          />
          <Input
            type="date"
            value={f.seizureDate}
            onChange={(e) => setF({ ...f, seizureDate: e.target.value })}
          />
          <Button
            onClick={() => add.mutate()}
            disabled={!f.amount || add.isPending}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="seizure-add"
          >
            記圈存
          </Button>
        </div>
        <Input
          type="file"
          accept="image/*"
          className="text-xs"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          data-testid="seizure-file"
        />
        {file && <div className="text-xs text-gray-400">截圖：{file.name}</div>}
        {seizures.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 border-b py-1.5 text-sm flex-wrap"
            data-testid={`seizure-${s.id}`}
          >
            <span className="font-bold text-blue-700 w-24">{formatNT(Number(s.amount))}</span>
            <span className="w-24 text-gray-600">{s.bankName || "—"}</span>
            <span className="text-xs text-gray-400 w-24">{s.seizureDate || "—"}</span>
            <Badge variant="outline">{s.status === "frozen" ? "凍結中" : "已解除"}</Badge>
            <span className="flex-1 text-xs text-gray-400">→ {caseName(s.caseId)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-red-500"
              onClick={() => onDelete(s.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── 分期區 ──
function InstallmentSection({
  installments,
  cases,
  caseName,
  onDelete,
}: {
  installments: Installment[]
  cases: EnfCase[]
  caseName: (id: number | null) => string
  onDelete: (id: number) => void
}) {
  const { toast } = useToast()
  const invalidate = useEnfInvalidate()
  const [f, setF] = useState({
    caseId: "",
    monthlyAmount: "",
    periods: "",
    totalAmount: "",
    startDate: "",
  })
  const add = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/enforcement/installments", {
        caseId: f.caseId ? Number(f.caseId) : null,
        monthlyAmount: f.monthlyAmount,
        periods: f.periods ? Number(f.periods) : null,
        totalAmount: f.totalAmount || null,
        startDate: f.startDate || null,
      }),
    onSuccess: () => {
      invalidate()
      toast({ title: "✅ 已建分期" })
      setF({ caseId: "", monthlyAmount: "", periods: "", totalAmount: "", startDate: "" })
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  // 記實付（含截圖）
  const [payingId, setPayingId] = useState<number | null>(null)
  const [pf, setPf] = useState({ paymentDate: "", amount: "" })
  const [pfile, setPfile] = useState<File | null>(null)
  const pay = useMutation({
    mutationFn: async (instId: number) => {
      const fd = new FormData()
      fd.append("paymentDate", pf.paymentDate || new Date().toISOString().slice(0, 10))
      fd.append("amount", pf.amount)
      if (pfile) fd.append("receiptFile", pfile)
      return apiRequest("POST", `/api/enforcement/installments/${instId}/payments`, fd)
    },
    onSuccess: () => {
      invalidate()
      toast({ title: "✅ 已記分期實付" })
      setPayingId(null)
      setPf({ paymentDate: "", amount: "" })
      setPfile(null)
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">分期計畫（{installments.length}）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={f.caseId}
            onChange={(e) => setF({ ...f, caseId: e.target.value })}
            data-testid="inst-case"
          >
            <option value="">未歸類</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.subject || c.caseNumber || `公文#${c.id}`}
              </option>
            ))}
          </select>
          <Input
            type="number"
            placeholder="每月"
            value={f.monthlyAmount}
            onChange={(e) => setF({ ...f, monthlyAmount: e.target.value })}
            data-testid="inst-monthly"
          />
          <Input
            type="number"
            placeholder="期數"
            value={f.periods}
            onChange={(e) => setF({ ...f, periods: e.target.value })}
          />
          <Input
            type="number"
            placeholder="總額"
            value={f.totalAmount}
            onChange={(e) => setF({ ...f, totalAmount: e.target.value })}
          />
          <Input
            type="date"
            value={f.startDate}
            onChange={(e) => setF({ ...f, startDate: e.target.value })}
          />
          <Button
            onClick={() => add.mutate()}
            disabled={!f.monthlyAmount || add.isPending}
            className="bg-amber-600 hover:bg-amber-700"
            data-testid="inst-add"
          >
            建分期
          </Button>
        </div>
        {installments.map((i) => (
          <div
            key={i.id}
            className="flex items-center gap-3 border-b py-1.5 text-sm flex-wrap"
            data-testid={`inst-${i.id}`}
          >
            <span className="font-bold text-amber-700 w-28">
              每月 {formatNT(Number(i.monthlyAmount))}
            </span>
            <span className="text-xs text-gray-500 w-20">
              {i.periods ? `${i.periods} 期` : "未定"}
            </span>
            <span className="text-xs text-gray-500 w-24">
              總 {i.totalAmount ? formatNT(Number(i.totalAmount)) : "—"}
            </span>
            <span className="text-xs text-gray-400 w-24">起 {i.startDate || "—"}</span>
            <span className="flex-1 text-xs text-gray-400">→ {caseName(i.caseId)}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPayingId(payingId === i.id ? null : i.id)}
              data-testid={`inst-pay-toggle-${i.id}`}
            >
              記實付
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-red-500"
              onClick={() => onDelete(i.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {payingId === i.id && (
              <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 bg-amber-50 rounded p-2 mt-1">
                <Input
                  type="date"
                  value={pf.paymentDate}
                  onChange={(e) => setPf({ ...pf, paymentDate: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="實付金額"
                  value={pf.amount}
                  onChange={(e) => setPf({ ...pf, amount: e.target.value })}
                  data-testid={`inst-pay-amount-${i.id}`}
                />
                <Input
                  type="file"
                  accept="image/*"
                  className="text-xs"
                  onChange={(e) => setPfile(e.target.files?.[0] ?? null)}
                />
                <Button
                  onClick={() => pay.mutate(i.id)}
                  disabled={!pf.amount || pay.isPending}
                  className="bg-amber-600 hover:bg-amber-700"
                  data-testid={`inst-pay-submit-${i.id}`}
                >
                  記一筆
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
