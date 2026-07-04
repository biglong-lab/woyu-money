/**
 * 信用卡請款紀錄（/card-claims）
 *
 * 獨立模組。請款 → (扣銀行手續費) → 預估到帳 → 記錄實際到帳 → 比對，形成閉環。
 * 區間查詢（本月/上月/下月/本季/今年/自訂）+ 月度統計 + 到帳彙總。
 */
import { useMemo, useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { CreditCard, Plus, Pencil, Trash2, Settings, Banknote, Download } from "lucide-react"
import { ClaimForm } from "@/components/card-claims/claim-form"
import { OptionsDialog } from "@/components/card-claims/options-dialog"
import { SettleDialog } from "@/components/card-claims/settle-dialog"
import { ImageLightbox } from "@/components/card-claims/image-lightbox"
import {
  statusMeta,
  fmt,
  ymd,
  feeRateOf,
  expectedSettlement,
  type Option,
  type BankOption,
  type Claim,
} from "@/components/card-claims/shared"

interface Summary {
  totalAmount: number
  totalCount: number
  byStatus: Array<{ status: string; count: number; amount: number }>
  byMonth: Array<{ month: string; count: number; amount: number }>
}

type RangePreset = "thisMonth" | "lastMonth" | "nextMonth" | "thisQuarter" | "thisYear" | "custom"
function presetRange(preset: RangePreset): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (preset) {
    case "thisMonth":
      return { start: ymd(new Date(y, m, 1)), end: ymd(new Date(y, m + 1, 0)) }
    case "lastMonth":
      return { start: ymd(new Date(y, m - 1, 1)), end: ymd(new Date(y, m, 0)) }
    case "nextMonth":
      return { start: ymd(new Date(y, m + 1, 1)), end: ymd(new Date(y, m + 2, 0)) }
    case "thisQuarter": {
      const q = Math.floor(m / 3)
      return { start: ymd(new Date(y, q * 3, 1)), end: ymd(new Date(y, q * 3 + 3, 0)) }
    }
    case "thisYear":
      return { start: ymd(new Date(y, 0, 1)), end: ymd(new Date(y, 11, 31)) }
    default:
      return { start: ymd(new Date(y, m, 1)), end: ymd(new Date(y, m + 1, 0)) }
  }
}
const PRESET_LABELS: Array<{ value: RangePreset; label: string }> = [
  { value: "thisMonth", label: "本月" },
  { value: "lastMonth", label: "上月" },
  { value: "nextMonth", label: "下月" },
  { value: "thisQuarter", label: "本季" },
  { value: "thisYear", label: "今年" },
  { value: "custom", label: "自訂" },
]

export default function CardClaimsPage() {
  useDocumentTitle("信用卡請款紀錄")
  const { toast } = useToast()

  const [preset, setPreset] = useState<RangePreset>("thisYear")
  const initial = presetRange("thisYear")
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)

  const [editing, setEditing] = useState<Claim | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [settleFor, setSettleFor] = useState<Claim | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  function applyPreset(p: RangePreset) {
    setPreset(p)
    if (p !== "custom") {
      const r = presetRange(p)
      setStart(r.start)
      setEnd(r.end)
    }
  }

  const qs = `startDate=${start}&endDate=${end}`
  const { data: claims = [], isLoading } = useQuery<Claim[]>({
    queryKey: [`/api/card-claims?${qs}`],
  })
  const { data: summary } = useQuery<Summary>({ queryKey: [`/api/card-claims/summary?${qs}`] })
  const { data: tags = [] } = useQuery<Option[]>({ queryKey: ["/api/card-claims/tags"] })
  const { data: properties = [] } = useQuery<Option[]>({
    queryKey: ["/api/card-claims/properties"],
  })
  const { data: banks = [] } = useQuery<BankOption[]>({ queryKey: ["/api/card-claims/banks"] })

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/card-claims/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/card-claims"),
      })
      toast({ title: "已刪除紀錄" })
    },
  })

  // 每筆預估到帳
  const expectedOf = (c: Claim) => expectedSettlement(Number(c.amount), feeRateOf(c.bank, banks))

  // 到帳彙總
  const settleSummary = useMemo(() => {
    let expected = 0
    let settled = 0
    let settledCount = 0
    for (const c of claims) {
      expected += expectedOf(c)
      if (c.settledAmount != null) {
        settled += Number(c.settledAmount)
        settledCount++
      }
    }
    return { expected, settled, settledCount, pendingCount: claims.length - settledCount }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims, banks])

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(c: Claim) {
    setEditing(c)
    setFormOpen(true)
  }

  /** 匯出目前區間/篩選的請款紀錄 CSV（BOM+UTF-8、Excel 直開）— 對銀行到帳比對 */
  function exportCsv() {
    if (claims.length === 0) return
    const header = ["刷卡日", "金額", "銀行", "標籤", "館別", "狀態", "實際到帳", "到帳日", "備註"]
    const rows = claims.map((c) => [
      c.swipeDate,
      c.amount,
      c.bank ?? "",
      c.tagName ?? "",
      c.propertyNames.length > 0 ? c.propertyNames.join("、") : (c.propertyName ?? ""),
      statusMeta(c.status).label,
      c.settledAmount ?? "",
      c.settledDate ?? "",
      c.notes ?? "",
    ])
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = "\ufeff" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `信用卡請款_${new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* 標題列 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-indigo-600" />
            信用卡請款紀錄
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            請款 → 扣手續費 → 預估到帳 → 記錄實際到帳，閉環比對
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={claims.length === 0}
            data-testid="claims-export-csv"
          >
            <Download className="h-4 w-4 mr-1" /> 匯出 CSV
          </Button>
          <Button variant="outline" onClick={() => setOptionsOpen(true)}>
            <Settings className="h-4 w-4 mr-1" /> 標籤/館別/銀行
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> 新增紀錄
          </Button>
        </div>
      </div>

      {/* 區間選擇 */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1">
            {PRESET_LABELS.map((p) => (
              <Button
                key={p.value}
                size="sm"
                variant={preset === p.value ? "default" : "outline"}
                onClick={() => applyPreset(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs">起</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value)
                  setPreset("custom")
                }}
                className="w-40"
              />
            </div>
            <div>
              <Label className="text-xs">迄</Label>
              <Input
                type="date"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value)
                  setPreset("custom")
                }}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 統計摘要 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="請款總額" value={fmt(summary?.totalAmount ?? 0)} />
        <StatCard title="預估到帳" value={fmt(settleSummary.expected)} tone="text-indigo-600" />
        <StatCard
          title="實際到帳"
          value={fmt(settleSummary.settled)}
          tone="text-green-600"
          sub={`${settleSummary.settledCount} 筆已到帳`}
        />
        <StatCard
          title="待到帳"
          value={String(settleSummary.pendingCount)}
          tone="text-amber-600"
          sub="筆"
        />
      </div>

      {/* 月度統計 */}
      {summary && summary.byMonth.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">每月統計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.byMonth.map((m) => (
                <div key={m.month} className="border rounded-lg px-3 py-2 text-sm">
                  <div className="font-medium">{m.month}</div>
                  <div className="text-indigo-600 font-semibold">{fmt(m.amount)}</div>
                  <div className="text-xs text-muted-foreground">{m.count} 筆</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 紀錄 */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">載入中…</p>
          ) : claims.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">此區間尚無紀錄</p>
          ) : (
            <>
              {/* 桌面：表格 */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>刷卡日期</TableHead>
                      <TableHead className="text-right">結算金額</TableHead>
                      <TableHead>銀行</TableHead>
                      <TableHead className="text-right">預估到帳</TableHead>
                      <TableHead className="text-right">實際到帳</TableHead>
                      <TableHead>標籤</TableHead>
                      <TableHead>館別</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>收據</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.map((c) => {
                      const sm = statusMeta(c.status)
                      const exp = expectedOf(c)
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="whitespace-nowrap">{c.swipeDate}</TableCell>
                          <TableCell className="text-right font-medium">
                            {fmt(Number(c.amount))}
                          </TableCell>
                          <TableCell>{c.bank || "—"}</TableCell>
                          <TableCell className="text-right text-indigo-600">{fmt(exp)}</TableCell>
                          <TableCell className="text-right">
                            {c.settledAmount != null ? (
                              <span className="text-green-700 font-medium">
                                {fmt(Number(c.settledAmount))}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">未到帳</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {c.tagName ? <Badge variant="outline">{c.tagName}</Badge> : "—"}
                          </TableCell>
                          <TableCell>
                            {c.propertyNames.length > 0 ? c.propertyNames.join("、") : "—"}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded text-xs ${sm.color}`}>
                              {sm.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            {c.receiptImageUrl ? (
                              <img
                                src={c.receiptImageUrl}
                                alt="收據"
                                onClick={() => setLightbox(c.receiptImageUrl)}
                                className="h-10 w-10 rounded object-cover border cursor-pointer hover:opacity-80"
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="記錄到帳"
                              onClick={() => setSettleFor(c)}
                            >
                              <Banknote className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("確定刪除此筆紀錄？")) deleteMut.mutate(c.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 手機：卡片 */}
              <div className="md:hidden space-y-3">
                {claims.map((c) => {
                  const sm = statusMeta(c.status)
                  const exp = expectedOf(c)
                  return (
                    <div key={c.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-lg">{fmt(Number(c.amount))}</div>
                          <div className="text-xs text-muted-foreground">{c.swipeDate}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs shrink-0 ${sm.color}`}>
                          {sm.label}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
                        <div className="text-muted-foreground">預估到帳</div>
                        <div className="text-right text-indigo-600">{fmt(exp)}</div>
                        <div className="text-muted-foreground">實際到帳</div>
                        <div className="text-right">
                          {c.settledAmount != null ? (
                            <span className="text-green-700 font-medium">
                              {fmt(Number(c.settledAmount))}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">未到帳</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        {c.bank && (
                          <span className="bg-muted px-1.5 py-0.5 rounded">🏦 {c.bank}</span>
                        )}
                        {c.tagName && (
                          <span className="bg-muted px-1.5 py-0.5 rounded">🏷️ {c.tagName}</span>
                        )}
                        {c.propertyNames.map((p) => (
                          <span key={p} className="bg-muted px-1.5 py-0.5 rounded">
                            🏨 {p}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        {c.receiptImageUrl ? (
                          <img
                            src={c.receiptImageUrl}
                            alt="收據"
                            onClick={() => setLightbox(c.receiptImageUrl)}
                            className="h-12 w-12 rounded object-cover border cursor-pointer"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">無收據</span>
                        )}
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => setSettleFor(c)}>
                            <Banknote className="h-4 w-4 mr-1 text-green-600" />
                            到帳
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm("確定刪除此筆紀錄？")) deleteMut.mutate(c.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {formOpen && (
        <ClaimForm
          claim={editing}
          tags={tags}
          properties={properties}
          banks={banks}
          onClose={() => setFormOpen(false)}
        />
      )}
      {optionsOpen && <OptionsDialog onClose={() => setOptionsOpen(false)} />}
      {settleFor && (
        <SettleDialog
          claim={settleFor}
          expected={expectedOf(settleFor)}
          onClose={() => setSettleFor(null)}
        />
      )}
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}

function StatCard({
  title,
  value,
  tone,
  sub,
}: {
  title: string
  value: string
  tone?: string
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className={`text-xl font-bold mt-1 ${tone ?? ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  )
}
