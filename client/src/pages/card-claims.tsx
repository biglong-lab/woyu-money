/**
 * 信用卡請款紀錄（/card-claims）
 *
 * 獨立模組、暫不與其他財務數據對應。
 * 功能：記錄每次刷卡請款的結算金額、刷卡時間、銀行、請款標籤、館別、狀態、備註
 *      + 區間查詢（本月/上月/下月/本季/今年/自訂）+ 月度統計
 */
import { useState, useRef } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { CreditCard, Plus, Pencil, Trash2, Settings, Tag, Building2, Upload, X } from "lucide-react"

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────
interface Option {
  id: number
  name: string
  isActive: boolean
}
interface Claim {
  id: number
  amount: string
  swipeDate: string
  bank: string | null
  tagId: number | null
  propertyId: number | null
  status: string
  receiptImageUrl: string | null
  notes: string | null
  tagName: string | null
  propertyName: string | null
}
interface Summary {
  totalAmount: number
  totalCount: number
  byStatus: Array<{ status: string; count: number; amount: number }>
  byMonth: Array<{ month: string; count: number; amount: number }>
  byTag: Array<{ tagName: string | null; count: number; amount: number }>
  byProperty: Array<{ propertyName: string | null; count: number; amount: number }>
}

const STATUS_OPTIONS = [
  { value: "pending", label: "待請款", color: "bg-amber-100 text-amber-800" },
  { value: "claimed", label: "已請款", color: "bg-blue-100 text-blue-800" },
  { value: "settled", label: "已入帳", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "已取消", color: "bg-gray-100 text-gray-600" },
]
const statusMeta = (s: string) => STATUS_OPTIONS.find((o) => o.value === s) ?? STATUS_OPTIONS[0]

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

// ─────────────────────────────────────────────
// 區間預設
// ─────────────────────────────────────────────
type RangePreset = "thisMonth" | "lastMonth" | "nextMonth" | "thisQuarter" | "thisYear" | "custom"
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
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

// ─────────────────────────────────────────────
// 主頁面
// ─────────────────────────────────────────────
export default function CardClaimsPage() {
  useDocumentTitle("信用卡請款紀錄")
  const { toast } = useToast()

  const [preset, setPreset] = useState<RangePreset>("thisMonth")
  const initial = presetRange("thisMonth")
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)

  const [editing, setEditing] = useState<Claim | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)

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
  const { data: summary } = useQuery<Summary>({
    queryKey: [`/api/card-claims/summary?${qs}`],
  })
  const { data: tags = [] } = useQuery<Option[]>({ queryKey: ["/api/card-claims/tags"] })
  const { data: properties = [] } = useQuery<Option[]>({
    queryKey: ["/api/card-claims/properties"],
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/card-claims/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/card-claims"),
      })
      toast({ title: "已刪除紀錄" })
    },
  })

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(c: Claim) {
    setEditing(c)
    setFormOpen(true)
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
            記錄每次刷卡請款的結算金額、銀行、標籤、館別與狀態（獨立模組）
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOptionsOpen(true)}>
            <Settings className="h-4 w-4 mr-1" /> 標籤/館別
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
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard title="區間總額" value={fmt(summary.totalAmount)} />
          <SummaryCard title="筆數" value={String(summary.totalCount)} />
          {STATUS_OPTIONS.slice(0, 2).map((s) => {
            const row = summary.byStatus.find((b) => b.status === s.value)
            return <SummaryCard key={s.value} title={s.label} value={fmt(row?.amount ?? 0)} />
          })}
        </div>
      )}

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

      {/* 紀錄表格 */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">載入中…</p>
          ) : claims.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">此區間尚無紀錄</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>刷卡日期</TableHead>
                    <TableHead className="text-right">結算金額</TableHead>
                    <TableHead>銀行</TableHead>
                    <TableHead>標籤</TableHead>
                    <TableHead>館別</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>收據</TableHead>
                    <TableHead>備註</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((c) => {
                    const sm = statusMeta(c.status)
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="whitespace-nowrap">{c.swipeDate}</TableCell>
                        <TableCell className="text-right font-medium">
                          {fmt(Number(c.amount))}
                        </TableCell>
                        <TableCell>{c.bank || "—"}</TableCell>
                        <TableCell>
                          {c.tagName ? <Badge variant="outline">{c.tagName}</Badge> : "—"}
                        </TableCell>
                        <TableCell>{c.propertyName || "—"}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded text-xs ${sm.color}`}>
                            {sm.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          {c.receiptImageUrl ? (
                            <a href={c.receiptImageUrl} target="_blank" rel="noreferrer">
                              <img
                                src={c.receiptImageUrl}
                                alt="收據"
                                className="h-10 w-10 rounded object-cover border hover:opacity-80"
                              />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                          {c.notes || "—"}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
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
          )}
        </CardContent>
      </Card>

      {formOpen && (
        <ClaimForm
          claim={editing}
          tags={tags}
          properties={properties}
          onClose={() => setFormOpen(false)}
        />
      )}
      {optionsOpen && <OptionsDialog onClose={() => setOptionsOpen(false)} />}
    </div>
  )
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="text-xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 新增 / 編輯表單
// ─────────────────────────────────────────────
function ClaimForm({
  claim,
  tags,
  properties,
  onClose,
}: {
  claim: Claim | null
  tags: Option[]
  properties: Option[]
  onClose: () => void
}) {
  const { toast } = useToast()
  const [amount, setAmount] = useState(claim?.amount ?? "")
  const [swipeDate, setSwipeDate] = useState(claim?.swipeDate ?? ymd(new Date()))
  const [bank, setBank] = useState(claim?.bank ?? "")
  const [tagId, setTagId] = useState<string>(claim?.tagId ? String(claim.tagId) : "none")
  const [propertyId, setPropertyId] = useState<string>(
    claim?.propertyId ? String(claim.propertyId) : "none"
  )
  const [status, setStatus] = useState(claim?.status ?? "pending")
  const [notes, setNotes] = useState(claim?.notes ?? "")
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(
    claim?.receiptImageUrl ?? null
  )
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
        bank: bank || null,
        tagId: tagId === "none" ? null : Number(tagId),
        propertyId: propertyId === "none" ? null : Number(propertyId),
        status,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{claim ? "編輯請款紀錄" : "新增請款紀錄"}</DialogTitle>
          <DialogDescription>填寫刷卡請款資訊</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
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
            <Input
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="如：玉山、國泰…"
            />
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
            <Label>館別</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇館別" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">（不指定）</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <a href={receiptImageUrl} target="_blank" rel="noreferrer">
                  <img
                    src={receiptImageUrl}
                    alt="收據"
                    className="h-16 w-16 rounded object-cover border"
                  />
                </a>
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
    </Dialog>
  )
}

// ─────────────────────────────────────────────
// 標籤 / 館別管理
// ─────────────────────────────────────────────
function OptionsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>標籤 / 館別管理</DialogTitle>
          <DialogDescription>可依需求新增請款標籤與館別</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <OptionList
            title="請款標籤"
            icon={<Tag className="h-4 w-4" />}
            endpoint="/api/card-claims/tags"
          />
          <OptionList
            title="館別"
            icon={<Building2 className="h-4 w-4" />}
            endpoint="/api/card-claims/properties"
          />
        </div>
        <DialogFooter>
          <Button onClick={onClose}>關閉</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OptionList({
  title,
  icon,
  endpoint,
}: {
  title: string
  icon: React.ReactNode
  endpoint: string
}) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const { data: items = [] } = useQuery<Option[]>({ queryKey: [endpoint] })

  const refresh = () => queryClient.invalidateQueries({ queryKey: [endpoint] })

  const addMut = useMutation({
    mutationFn: () => apiRequest("POST", endpoint, { name }),
    onSuccess: () => {
      setName("")
      refresh()
      toast({ title: "已新增" })
    },
    onError: (e: Error) =>
      toast({ title: "新增失敗", description: e.message, variant: "destructive" }),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `${endpoint}/${id}`),
    onSuccess: () => {
      refresh()
      toast({ title: "已移除" })
    },
  })

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center gap-2 font-medium mb-2">
        {icon}
        {title}
      </div>
      <div className="flex gap-1 mb-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新增…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) addMut.mutate()
          }}
        />
        <Button
          size="sm"
          onClick={() => name.trim() && addMut.mutate()}
          disabled={addMut.isPending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between text-sm py-1">
            <span>{it.name}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => delMut.mutate(it.id)}
            >
              <Trash2 className="h-3 w-3 text-red-400" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
