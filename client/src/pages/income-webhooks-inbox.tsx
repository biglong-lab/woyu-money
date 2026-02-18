// 進帳收件箱頁面
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Inbox,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  Banknote,
  Clock,
  User,
  Hash,
  Layers,
  Building2,
  Download,
} from "lucide-react"
import type { IncomeWebhook, IncomeSource, PaymentProject } from "@shared/schema"

// ─── 狀態設定 ────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "待確認",
    color: "bg-yellow-100 text-yellow-800",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  confirmed: {
    label: "已確認",
    color: "bg-green-100 text-green-800",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  rejected: {
    label: "已拒絕",
    color: "bg-red-100 text-red-800",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  duplicate: {
    label: "重複",
    color: "bg-gray-100 text-gray-600",
    icon: <Layers className="h-3.5 w-3.5" />,
  },
  error: {
    label: "錯誤",
    color: "bg-red-100 text-red-800",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
}

// ─── 確認表單 Schema ──────────────────────────────
const confirmSchema = z.object({
  projectId: z.string().min(1, "請選擇專案"),
  categoryId: z.string().optional(),
  itemName: z.string().max(255).optional(),
  reviewNote: z.string().max(500).optional(),
})
type ConfirmFormValues = z.infer<typeof confirmSchema>

// ─── 進帳詳情 Dialog ──────────────────────────────
function WebhookDetailDialog({
  webhook,
  sources,
  projects,
  onClose,
  onConfirm,
  onReject,
}: {
  webhook: IncomeWebhook
  sources: IncomeSource[]
  projects: PaymentProject[]
  onClose: () => void
  onConfirm: (id: number, data: ConfirmFormValues) => void
  onReject: (id: number, note?: string) => void
}) {
  const [mode, setMode] = useState<"view" | "confirm" | "reject">("view")
  const [rejectNote, setRejectNote] = useState("")
  const form = useForm<ConfirmFormValues>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { itemName: webhook.parsedDescription ?? "" },
  })

  const source = sources.find((s) => s.id === webhook.sourceId)
  const status = STATUS_CONFIG[webhook.status] ?? STATUS_CONFIG.pending
  const amount = parseFloat(String(webhook.parsedAmountTwd ?? webhook.parsedAmount ?? "0"))
  const formattedAmount = amount.toLocaleString("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            進帳詳情
            <Badge className={status.color}>
              <span className="flex items-center gap-1">
                {status.icon}
                {status.label}
              </span>
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* 金額大顯示 */}
        <div className="text-center py-4 bg-gray-50 rounded-lg">
          <p className="text-3xl font-bold text-green-600">{formattedAmount}</p>
          {webhook.parsedCurrency && webhook.parsedCurrency !== "TWD" && (
            <p className="text-sm text-muted-foreground mt-1">
              原始：{webhook.parsedCurrency}{" "}
              {parseFloat(String(webhook.parsedAmount ?? "0")).toLocaleString()}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {webhook.parsedPaidAt
              ? new Date(webhook.parsedPaidAt).toLocaleString("zh-TW")
              : "未知時間"}
          </p>
        </div>

        {/* 詳細資訊 */}
        <div className="space-y-2 text-sm">
          {[
            { icon: <User className="h-4 w-4" />, label: "來源", value: source?.sourceName ?? "-" },
            { icon: <User className="h-4 w-4" />, label: "付款方", value: webhook.parsedPayerName ?? "-" },
            { icon: <Hash className="h-4 w-4" />, label: "訂單號", value: webhook.parsedOrderId ?? "-" },
            { icon: <Hash className="h-4 w-4" />, label: "交易 ID", value: webhook.externalTransactionId ?? "-" },
            { icon: <Banknote className="h-4 w-4" />, label: "說明", value: webhook.parsedDescription ?? "-" },
          ].map(({ icon, label, value }) =>
            value && value !== "-" ? (
              <div key={label} className="flex items-center gap-2 text-muted-foreground">
                {icon}
                <span className="w-16 flex-shrink-0 font-medium text-foreground">{label}</span>
                <span className="break-all">{value}</span>
              </div>
            ) : null
          )}
          {webhook.reviewNote && (
            <div className="text-muted-foreground bg-gray-50 rounded p-2 mt-2">
              備註：{webhook.reviewNote}
            </div>
          )}
        </div>

        {/* 待確認操作區 */}
        {webhook.status === "pending" && mode === "view" && (
          <div className="flex gap-2 mt-2">
            <Button className="flex-1" onClick={() => setMode("confirm")}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              確認入帳
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-red-600 hover:text-red-700"
              onClick={() => setMode("reject")}
            >
              <XCircle className="h-4 w-4 mr-2" />
              拒絕
            </Button>
          </div>
        )}

        {/* 確認入帳表單 */}
        {mode === "confirm" && (
          <form
            onSubmit={form.handleSubmit((v) => onConfirm(webhook.id, v))}
            className="space-y-3 mt-2"
          >
            <div className="space-y-1.5">
              <Label>歸屬專案 *</Label>
              <Select
                value={form.watch("projectId")}
                onValueChange={(v) => form.setValue("projectId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇專案" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.projectId && (
                <p className="text-xs text-red-500">{form.formState.errors.projectId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>項目名稱（選填）</Label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder={webhook.parsedDescription ?? `進帳 ${new Date().toLocaleDateString("zh-TW")}`}
                {...form.register("itemName")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>備註（選填）</Label>
              <Textarea rows={2} {...form.register("reviewNote")} />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setMode("view")}>
                返回
              </Button>
              <Button type="submit" className="flex-1">
                確認入帳
              </Button>
            </div>
          </form>
        )}

        {/* 拒絕表單 */}
        {mode === "reject" && (
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label>拒絕原因（選填）</Label>
              <Textarea
                rows={2}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("view")}>
                返回
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => onReject(webhook.id, rejectNote)}
              >
                確認拒絕
              </Button>
            </div>
          </div>
        )}

        {mode === "view" && webhook.status !== "pending" && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              關閉
            </Button>
            {webhook.status !== "pending" && (
              <Button
                variant="outline"
                onClick={() => {
                  /* reprocess */
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                重新處理
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── 批次確認 Dialog ──────────────────────────────
function BatchConfirmDialog({
  ids,
  projects,
  onClose,
  onConfirm,
}: {
  ids: number[]
  projects: PaymentProject[]
  onClose: () => void
  onConfirm: (projectId: number, note?: string) => void
}) {
  const [projectId, setProjectId] = useState("")
  const [note, setNote] = useState("")

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批次確認入帳</DialogTitle>
          <DialogDescription>共 {ids.length} 筆進帳，請選擇歸屬專案</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>歸屬專案 *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇專案" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>備註（選填）</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!projectId}
            onClick={() => onConfirm(parseInt(projectId), note || undefined)}
          >
            確認 {ids.length} 筆入帳
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── PM 同步 Dialog ───────────────────────────────
interface PmCompany {
  id: number
  name: string
}

interface SyncResult {
  synced: number
  skipped: number
  errors: number
  period: { startDate: string; endDate: string }
}

function PmSyncDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()

  // 預設：本月 1 日到今天
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10)

  const [startDate, setStartDate] = useState(fmtDate(firstOfMonth))
  const [endDate, setEndDate] = useState(fmtDate(today))
  const [companyId, setCompanyId] = useState("")
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)

  const { data: companies = [] } = useQuery<PmCompany[]>({
    queryKey: ["/api/pm-bridge/companies"],
    staleTime: 5 * 60 * 1000,
  })

  const { data: status } = useQuery<{
    pm: { connected: boolean; error: string | null; totalRevenues: number | null }
    money: { sourceId: number | null; importedCount: number }
  }>({
    queryKey: ["/api/pm-bridge/status"],
    staleTime: 10000,
  })

  const syncMutation = useMutation<SyncResult, Error, void>({
    mutationFn: () =>
      apiRequest("POST", "/api/pm-bridge/sync", {
        startDate,
        endDate,
        companyId: companyId ? parseInt(companyId) : undefined,
      }) as Promise<SyncResult>,
    onSuccess: (data) => {
      setLastResult(data)
      if (data.synced > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/income/webhooks"] })
        queryClient.invalidateQueries({ queryKey: ["/api/income/webhooks/pending-count"] })
        queryClient.invalidateQueries({ queryKey: ["/api/pm-bridge/status"] })
      }
      toast({
        title: `同步完成`,
        description: `新增 ${data.synced} 筆，略過 ${data.skipped} 筆${data.errors > 0 ? `，${data.errors} 筆錯誤` : ""}`,
      })
    },
    onError: (err) => {
      toast({ title: "同步失敗", description: err.message, variant: "destructive" })
    },
  })

  const pmOk = status?.pm.connected

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            從 PM 旅館系統同步收入
          </DialogTitle>
          <DialogDescription>
            唯讀讀取 PM 系統的收入記錄，轉入待確認收件箱。
            不會修改 PM 任何資料。
          </DialogDescription>
        </DialogHeader>

        {/* 連線狀態 */}
        <div className={`flex items-center gap-2 text-sm rounded-md p-2 ${
          pmOk ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          <div className={`h-2 w-2 rounded-full ${pmOk ? "bg-green-500" : "bg-red-500"}`} />
          {pmOk
            ? `PM 系統已連線（共 ${status?.pm.totalRevenues ?? 0} 筆收入）`
            : `無法連線：${status?.pm.error ?? "檢查中..."}`}
        </div>

        {/* 已匯入數 */}
        {status?.money.importedCount !== undefined && (
          <p className="text-xs text-muted-foreground">
            已匯入 {status.money.importedCount} 筆到進帳收件箱
          </p>
        )}

        <div className="space-y-3">
          {/* 日期範圍 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>起始日期</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>結束日期</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* 館舍篩選 */}
          {companies.length > 0 && (
            <div className="space-y-1.5">
              <Label>館舍（選填）</Label>
              <Select value={companyId || "all"} onValueChange={(v) => setCompanyId(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="所有館舍" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有館舍</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* 上次結果 */}
        {lastResult && (
          <div className="bg-gray-50 rounded-md p-3 text-sm space-y-1">
            <p className="font-medium">上次同步結果</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-green-600">{lastResult.synced}</p>
                <p className="text-xs text-muted-foreground">新增</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-400">{lastResult.skipped}</p>
                <p className="text-xs text-muted-foreground">略過</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-500">{lastResult.errors}</p>
                <p className="text-xs text-muted-foreground">錯誤</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            關閉
          </Button>
          <Button
            disabled={!pmOk || syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
            className="gap-2"
          >
            {syncMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {syncMutation.isPending ? "同步中..." : "開始同步"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── 主頁面 ──────────────────────────────────────
export default function IncomeWebhooksInboxPage() {
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState("pending")
  const [sourceFilter, setSourceFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [detailWebhook, setDetailWebhook] = useState<IncomeWebhook | null>(null)
  const [showBatchConfirm, setShowBatchConfirm] = useState(false)
  const [showPmSync, setShowPmSync] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 20

  // ─── 查詢 ─────────────────────────────────
  const buildQuery = () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (sourceFilter) params.set("sourceId", sourceFilter)
    return `/api/income/webhooks?${params}`
  }

  const { data: result, isLoading } = useQuery<{
    data: IncomeWebhook[]
    total: number
    page: number
    pageSize: number
  }>({
    queryKey: [buildQuery()],
    refetchInterval: 15000,
  })

  const { data: pendingCount } = useQuery<{ count: number }>({
    queryKey: ["/api/income/webhooks/pending-count"],
    refetchInterval: 30000,
  })

  const { data: sources = [] } = useQuery<IncomeSource[]>({
    queryKey: ["/api/income/sources"],
  })

  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  })

  const webhooks = result?.data ?? []
  const total = result?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  // ─── Mutations ───────────────────────────────
  const confirmMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ConfirmFormValues }) =>
      apiRequest("POST", `/api/income/webhooks/${id}/confirm`, {
        projectId: parseInt(data.projectId),
        categoryId: data.categoryId ? parseInt(data.categoryId) : undefined,
        itemName: data.itemName || undefined,
        reviewNote: data.reviewNote || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income/webhooks"] })
      queryClient.invalidateQueries({ queryKey: ["/api/income/webhooks/pending-count"] })
      setDetailWebhook(null)
      toast({ title: "已確認入帳" })
    },
    onError: (err: Error) => {
      toast({ title: "確認失敗", description: err.message, variant: "destructive" })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      apiRequest("POST", `/api/income/webhooks/${id}/reject`, { reviewNote: note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income/webhooks"] })
      queryClient.invalidateQueries({ queryKey: ["/api/income/webhooks/pending-count"] })
      setDetailWebhook(null)
      toast({ title: "已拒絕" })
    },
    onError: (err: Error) => {
      toast({ title: "操作失敗", description: err.message, variant: "destructive" })
    },
  })

  const batchConfirmMutation = useMutation<
    { successCount: number; failCount: number },
    Error,
    { projectId: number; reviewNote?: string }
  >({
    mutationFn: (data) =>
      apiRequest("POST", "/api/income/webhooks/batch-confirm", {
        ids: Array.from(selectedIds),
        projectId: data.projectId,
        reviewNote: data.reviewNote,
      }) as Promise<{ successCount: number; failCount: number }>,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/income/webhooks"] })
      queryClient.invalidateQueries({ queryKey: ["/api/income/webhooks/pending-count"] })
      setSelectedIds(new Set())
      setShowBatchConfirm(false)
      toast({
        title: `批次確認完成：${data.successCount} 筆成功${data.failCount > 0 ? `，${data.failCount} 筆失敗` : ""}`,
      })
    },
    onError: (err: Error) => {
      toast({ title: "批次確認失敗", description: err.message, variant: "destructive" })
    },
  })

  // ─── 選取邏輯 ──────────────────────────────
  const pendingWebhooks = webhooks.filter((w) => w.status === "pending")

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === pendingWebhooks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingWebhooks.map((w) => w.id)))
    }
  }

  // ─── 渲染 ─────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* 頁首 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            進帳收件箱
            {(pendingCount?.count ?? 0) > 0 && (
              <Badge className="bg-red-500 text-white">
                {pendingCount!.count}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            外部系統推送的進帳，確認後自動建立收入記錄
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPmSync(true)}
            className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Building2 className="h-4 w-4" />
            從 PM 同步
          </Button>

          {selectedIds.size > 0 && statusFilter === "pending" && (
            <Button onClick={() => setShowBatchConfirm(true)} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              批次確認 {selectedIds.size} 筆
            </Button>
          )}
        </div>
      </div>

      {/* 篩選列 */}
      <div className="flex gap-3 flex-wrap">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setPage(1)
            setSelectedIds(new Set())
          }}
        >
          <TabsList>
            <TabsTrigger value="pending">待確認</TabsTrigger>
            <TabsTrigger value="confirmed">已確認</TabsTrigger>
            <TabsTrigger value="rejected">已拒絕</TabsTrigger>
            <TabsTrigger value="all">全部</TabsTrigger>
          </TabsList>
        </Tabs>

        {sources.length > 0 && (
          <Select
            value={sourceFilter}
            onValueChange={(v) => {
              setSourceFilter(v === "all" ? "" : v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="所有來源" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有來源</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.sourceName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 全選列（僅待確認模式顯示） */}
      {statusFilter === "pending" && pendingWebhooks.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={selectedIds.size === pendingWebhooks.length && pendingWebhooks.length > 0}
            onCheckedChange={selectAll}
          />
          <span>全選本頁待確認（{pendingWebhooks.length} 筆）</span>
        </div>
      )}

      {/* 列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>
              {statusFilter === "pending"
                ? "目前沒有待確認的進帳"
                : "查無符合條件的進帳紀錄"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {webhooks.map((webhook) => {
            const status = STATUS_CONFIG[webhook.status] ?? STATUS_CONFIG.pending
            const source = sources.find((s) => s.id === webhook.sourceId)
            const amount = parseFloat(
              String(webhook.parsedAmountTwd ?? webhook.parsedAmount ?? "0")
            )
            const isSelected = selectedIds.has(webhook.id)

            return (
              <Card
                key={webhook.id}
                className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setDetailWebhook(webhook)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {/* 選取框（僅 pending） */}
                    {webhook.status === "pending" && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelect(webhook.id)
                        }}
                      >
                        <Checkbox checked={isSelected} />
                      </div>
                    )}

                    {/* 主要資訊 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-green-600">
                          +
                          {amount.toLocaleString("zh-TW", {
                            style: "currency",
                            currency: "TWD",
                            maximumFractionDigits: 0,
                          })}
                        </span>
                        <Badge className={status.color}>
                          <span className="flex items-center gap-1">
                            {status.icon}
                            {status.label}
                          </span>
                        </Badge>
                        {source && (
                          <Badge variant="outline" className="text-xs">
                            {source.sourceName}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {webhook.parsedDescription && (
                          <span className="truncate max-w-xs">{webhook.parsedDescription}</span>
                        )}
                        {webhook.parsedPayerName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {webhook.parsedPayerName}
                          </span>
                        )}
                        <span>
                          {webhook.parsedPaidAt
                            ? new Date(webhook.parsedPaidAt).toLocaleString("zh-TW")
                            : new Date(webhook.createdAt!).toLocaleString("zh-TW")}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 分頁 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            共 {total} 筆，第 {page} / {totalPages} 頁
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              上一頁
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一頁
            </Button>
          </div>
        </div>
      )}

      {/* 進帳詳情 Dialog */}
      {detailWebhook && (
        <WebhookDetailDialog
          webhook={detailWebhook}
          sources={sources}
          projects={projects}
          onClose={() => setDetailWebhook(null)}
          onConfirm={(id, data) => confirmMutation.mutate({ id, data })}
          onReject={(id, note) => rejectMutation.mutate({ id, note })}
        />
      )}

      {/* 批次確認 Dialog */}
      {showBatchConfirm && (
        <BatchConfirmDialog
          ids={Array.from(selectedIds)}
          projects={projects}
          onClose={() => setShowBatchConfirm(false)}
          onConfirm={(projectId, note) =>
            batchConfirmMutation.mutate({ projectId, reviewNote: note })
          }
        />
      )}

      {/* PM 同步 Dialog */}
      {showPmSync && (
        <PmSyncDialog
          onClose={() => setShowPmSync(false)}
          onDone={() => setShowPmSync(false)}
        />
      )}
    </div>
  )
}
