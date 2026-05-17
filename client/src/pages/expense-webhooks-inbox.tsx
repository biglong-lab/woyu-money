/**
 * 外部帳單收件箱（/expense/inbox）
 *
 * 顯示 PM bridge / POS 等外部系統推進來的支出帳單（expense_webhooks），
 * 鏡像 income-webhooks-inbox 設計：列表 + 篩選 + 單筆/批次確認/拒絕。
 *
 * Pending → 點確認 → 寫入 payment_items（待付）或 payment_items+payment_records（已付）
 */
import { useState, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Layers,
  Building2,
  Receipt,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  ArrowUpDown,
} from "lucide-react"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { EmptyState } from "@/components/ui/empty-state"
import type { PaymentProject } from "@shared/schema"

interface ExpenseWebhook {
  id: number
  sourceId: number
  externalTransactionId: string | null
  parsedAmount: string | null
  parsedAmountTwd: string | null
  parsedCurrency: string | null
  parsedVendor: string | null
  parsedDescription: string | null
  parsedInvoiceNumber: string | null
  parsedPaidAt: string | null
  parsedDueAt: string | null
  parsedCategoryHint: string | null
  status: string
  reviewNote: string | null
  linkedItemId: number | null
  createdAt: string
  // PM 推來的額外欄位都在 rawPayload 裡（不在 parsed_*）
  // 例如：pmInvoicePhoto（帳單照片 URL）、pmCompanyId（館舍）等
  rawPayload?: Record<string, unknown>
}

interface ExpenseSource {
  id: number
  sourceName: string
  sourceKey: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
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

type SortKey = "createdDesc" | "createdAsc" | "amountDesc" | "amountAsc" | "dueAsc" | "dueDesc"

export default function ExpenseWebhooksInbox() {
  useDocumentTitle("外部帳單收件箱")
  const { toast } = useToast()
  const [tab, setTab] = useState<"pending" | "confirmed" | "rejected" | "all">("pending")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [confirmDialog, setConfirmDialog] = useState<{
    mode: "single" | "batch"
    webhook?: ExpenseWebhook
  } | null>(null)
  const [rejectDialog, setRejectDialog] = useState<{ ids: number[] } | null>(null)

  // 搜尋與篩選
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [dueFrom, setDueFrom] = useState("")
  const [dueTo, setDueTo] = useState("")
  const [sortBy, setSortBy] = useState<SortKey>("createdDesc")

  // 列表（按狀態篩選，pageSize 500 一次拿完，避免 PM 推大批時看不到）
  const queryStr = tab === "all" ? "?pageSize=500" : `?status=${tab}&pageSize=500`
  const {
    data: list,
    isLoading,
    refetch,
  } = useQuery<{
    data: ExpenseWebhook[]
    total: number
  }>({
    queryKey: [`/api/expense/webhooks${queryStr}`],
    refetchInterval: 30000, // 30 秒自動重新整理（PM cron 進來時可及時看到）
  })
  const allWebhooks = list?.data ?? []
  const serverTotal = list?.total ?? 0

  // sources（顯示來源名稱）
  const { data: sourcesData } = useQuery<ExpenseSource[]>({
    queryKey: ["/api/expense/sources"],
  })
  const sources = sourcesData ?? []
  const sourceNameOf = (id: number) => sources.find((s) => s.id === id)?.sourceName ?? `來源 #${id}`

  // projects
  const { data: projectsData } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  })
  const projects = projectsData ?? []

  // 過濾 + 排序
  const webhooks = useMemo(() => {
    const kw = search.trim().toLowerCase()
    const min = parseFloat(minAmount) || 0
    const max = parseFloat(maxAmount) || Infinity
    const from = dueFrom ? new Date(dueFrom).getTime() : null
    const to = dueTo ? new Date(dueTo).getTime() + 86_400_000 : null // 含當日

    const filtered = allWebhooks.filter((w) => {
      // 來源
      if (sourceFilter !== "all" && String(w.sourceId) !== sourceFilter) return false
      // 金額
      const amt = parseFloat(w.parsedAmountTwd || w.parsedAmount || "0")
      if (amt < min || amt > max) return false
      // 到期日
      if (from || to) {
        const dueMs = w.parsedDueAt ? new Date(w.parsedDueAt).getTime() : null
        if (!dueMs) return false
        if (from && dueMs < from) return false
        if (to && dueMs >= to) return false
      }
      // 關鍵字（廠商 / 描述 / 發票 / 分類 / 交易 ID / PM company）
      if (kw) {
        const pmCompany = String(w.rawPayload?.pmCompanyId ?? "").toLowerCase()
        const hay = [
          w.parsedVendor,
          w.parsedDescription,
          w.parsedInvoiceNumber,
          w.parsedCategoryHint,
          w.externalTransactionId,
          pmCompany,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "createdAsc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case "amountDesc":
          return (
            parseFloat(b.parsedAmountTwd || b.parsedAmount || "0") -
            parseFloat(a.parsedAmountTwd || a.parsedAmount || "0")
          )
        case "amountAsc":
          return (
            parseFloat(a.parsedAmountTwd || a.parsedAmount || "0") -
            parseFloat(b.parsedAmountTwd || b.parsedAmount || "0")
          )
        case "dueAsc":
          return (
            (a.parsedDueAt ? new Date(a.parsedDueAt).getTime() : Infinity) -
            (b.parsedDueAt ? new Date(b.parsedDueAt).getTime() : Infinity)
          )
        case "dueDesc":
          return (
            (b.parsedDueAt ? new Date(b.parsedDueAt).getTime() : -Infinity) -
            (a.parsedDueAt ? new Date(a.parsedDueAt).getTime() : -Infinity)
          )
        case "createdDesc":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })
    return sorted
  }, [allWebhooks, search, sourceFilter, minAmount, maxAmount, dueFrom, dueTo, sortBy])

  const visiblePendingIds = useMemo(
    () => webhooks.filter((w) => w.status === "pending").map((w) => w.id),
    [webhooks]
  )
  const allVisiblePendingSelected =
    visiblePendingIds.length > 0 && visiblePendingIds.every((id) => selectedIds.has(id))
  const someVisiblePendingSelected =
    !allVisiblePendingSelected && visiblePendingIds.some((id) => selectedIds.has(id))

  const toggleSelectAllVisible = () => {
    if (allVisiblePendingSelected) {
      const next = new Set(selectedIds)
      visiblePendingIds.forEach((id) => next.delete(id))
      setSelectedIds(next)
    } else {
      const next = new Set(selectedIds)
      visiblePendingIds.forEach((id) => next.add(id))
      setSelectedIds(next)
    }
  }

  const clearFilters = () => {
    setSearch("")
    setSourceFilter("all")
    setMinAmount("")
    setMaxAmount("")
    setDueFrom("")
    setDueTo("")
    setSortBy("createdDesc")
  }

  const activeFilterCount =
    (search ? 1 : 0) +
    (sourceFilter !== "all" ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0) +
    (dueFrom ? 1 : 0) +
    (dueTo ? 1 : 0) +
    (sortBy !== "createdDesc" ? 1 : 0)

  // 確認 / 拒絕 mutations
  const confirmMutation = useMutation({
    mutationFn: async (vars: {
      id: number
      projectId: number
      categoryId?: number
      itemName?: string
      asPaid: boolean
      reviewNote?: string
    }) => apiRequest("POST", `/api/expense/webhooks/${vars.id}/confirm`, vars),
    onSuccess: () => {
      toast({ title: "✅ 已確認", description: "已建立為付款項目" })
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/expense"),
      })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
      setConfirmDialog(null)
      setSelectedIds(new Set())
    },
    onError: (err: Error) =>
      toast({ title: "失敗", description: err.message, variant: "destructive" }),
  })

  const batchConfirmMutation = useMutation({
    mutationFn: async (vars: {
      ids: number[]
      projectId: number
      categoryId?: number
      asPaid: boolean
      reviewNote?: string
    }) =>
      apiRequest<{ successCount: number; failCount: number }>(
        "POST",
        "/api/expense/webhooks/batch-confirm",
        vars
      ),
    onSuccess: (data: { successCount: number; failCount: number }) => {
      toast({
        title: "批次確認完成",
        description: `成功 ${data.successCount} 筆${data.failCount > 0 ? `、失敗 ${data.failCount}` : ""}`,
      })
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/expense"),
      })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
      setConfirmDialog(null)
      setSelectedIds(new Set())
    },
    onError: (err: Error) =>
      toast({ title: "失敗", description: err.message, variant: "destructive" }),
  })

  const rejectMutation = useMutation({
    mutationFn: async (vars: { id: number; reviewNote?: string }) =>
      apiRequest("POST", `/api/expense/webhooks/${vars.id}/reject`, {
        reviewNote: vars.reviewNote ?? "",
      }),
    onSuccess: () => {
      toast({ title: "已拒絕" })
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/expense"),
      })
    },
    onError: (err: Error) =>
      toast({ title: "失敗", description: err.message, variant: "destructive" }),
  })

  const batchRejectMutation = useMutation({
    mutationFn: async (vars: { ids: number[]; reviewNote: string }) => {
      const results = await Promise.allSettled(
        vars.ids.map((id) =>
          apiRequest("POST", `/api/expense/webhooks/${id}/reject`, {
            reviewNote: vars.reviewNote,
          })
        )
      )
      const successCount = results.filter((r) => r.status === "fulfilled").length
      const failCount = results.length - successCount
      return { successCount, failCount }
    },
    onSuccess: (data) => {
      toast({
        title: "批次拒絕完成",
        description: `成功 ${data.successCount} 筆${data.failCount > 0 ? `、失敗 ${data.failCount}` : ""}`,
      })
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/expense"),
      })
      setRejectDialog(null)
      setSelectedIds(new Set())
    },
    onError: (err: Error) =>
      toast({ title: "失敗", description: err.message, variant: "destructive" }),
  })

  // 統計（基於過濾後 + 待確認的）
  const pendingInView = webhooks.filter((w) => w.status === "pending")
  const totalPendingAmount = pendingInView.reduce(
    (sum, w) => sum + parseFloat(w.parsedAmountTwd || w.parsedAmount || "0"),
    0
  )
  const selectedAmount = pendingInView
    .filter((w) => selectedIds.has(w.id))
    .reduce((sum, w) => sum + parseFloat(w.parsedAmountTwd || w.parsedAmount || "0"), 0)

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Inbox className="h-6 w-6 text-purple-600" />
          外部帳單收件箱
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          PM 旅館系統 / POS 等外部來源推進來的帳單、確認後變成應付款項目
        </p>
      </div>

      {/* 統計列 — 待確認 tab 顯示 */}
      {tab === "pending" && pendingInView.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-3 px-4 flex flex-wrap items-center gap-4">
            <div>
              <div className="text-xs text-yellow-700">符合條件待確認</div>
              <div className="text-xl font-bold text-yellow-900">{pendingInView.length}</div>
            </div>
            <div>
              <div className="text-xs text-yellow-700">合計金額</div>
              <div className="text-xl font-bold text-yellow-900">
                ${Math.round(totalPendingAmount).toLocaleString()}
              </div>
            </div>
            {selectedIds.size > 0 && (
              <>
                <div className="border-l border-yellow-300 pl-4">
                  <div className="text-xs text-yellow-700">已選</div>
                  <div className="text-xl font-bold text-blue-900">
                    {selectedIds.size}{" "}
                    <span className="text-sm font-normal text-blue-600">
                      ${Math.round(selectedAmount).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" onClick={() => setConfirmDialog({ mode: "batch" })}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    批次確認
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejectDialog({ ids: Array.from(selectedIds) })}
                  >
                    <XCircle className="h-4 w-4 mr-1 text-red-600" />
                    批次拒絕
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedIds(new Set())}
                    title="清除選取"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 切換 */}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as typeof tab)
          setSelectedIds(new Set())
        }}
      >
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="h-4 w-4 mr-1" />
            待確認
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            已確認
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <XCircle className="h-4 w-4 mr-1" />
            已拒絕
          </TabsTrigger>
          <TabsTrigger value="all">
            <Layers className="h-4 w-4 mr-1" />
            全部
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 搜尋與篩選工具列 */}
      <Card>
        <CardContent className="py-3 px-3 sm:px-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋廠商 / 描述 / 發票 / 分類..."
                className="pl-8 pr-8"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="清除搜尋"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-auto min-w-[120px]">
                <ArrowUpDown className="h-4 w-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdDesc">最新優先</SelectItem>
                <SelectItem value="createdAsc">最舊優先</SelectItem>
                <SelectItem value="amountDesc">金額由大到小</SelectItem>
                <SelectItem value="amountAsc">金額由小到大</SelectItem>
                <SelectItem value="dueAsc">到期日近</SelectItem>
                <SelectItem value="dueDesc">到期日遠</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              篩選
              {activeFilterCount > 0 && (
                <Badge className="ml-1 bg-blue-500 text-white">{activeFilterCount}</Badge>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} title="清除所有條件">
                <X className="h-4 w-4 mr-1" />
                清除
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              title="立即重新整理"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t">
              <div>
                <Label className="text-xs">來源</Label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部來源</SelectItem>
                    {sources.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.sourceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">金額範圍</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    placeholder="最小"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                  />
                  <span className="text-gray-400">~</span>
                  <Input
                    type="number"
                    placeholder="最大"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">到期日範圍</Label>
                <div className="flex gap-2 items-center">
                  <Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
                  <span className="text-gray-400">~</span>
                  <Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 全選列（只在 pending tab + 有 pending 顯示） */}
      {tab === "pending" && visiblePendingIds.length > 0 && (
        <div className="flex items-center gap-3 px-1 text-sm text-gray-600">
          <Checkbox
            checked={
              allVisiblePendingSelected
                ? true
                : someVisiblePendingSelected
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={toggleSelectAllVisible}
            id="select-all-visible"
          />
          <label htmlFor="select-all-visible" className="cursor-pointer select-none">
            {allVisiblePendingSelected ? "取消全選" : "全選目前顯示的"} {visiblePendingIds.length}{" "}
            筆
          </label>
          <span className="text-gray-400">
            ・顯示 {webhooks.length} / 已載入 {allWebhooks.length}
            {serverTotal > allWebhooks.length && (
              <span className="text-orange-600 ml-1">（伺服器尚有 {serverTotal} 筆）</span>
            )}
          </span>
        </div>
      )}

      {/* 列表 */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            載入中...
          </CardContent>
        </Card>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-0">
            <EmptyState
              icon={Inbox}
              title={
                allWebhooks.length === 0
                  ? tab === "pending"
                    ? "目前沒有待確認的帳單"
                    : "無資料"
                  : "沒有符合篩選條件的資料"
              }
              description={
                allWebhooks.length === 0
                  ? tab === "pending"
                    ? "PM 系統推帳單進來時、會出現在這裡。也可請對接方手動觸發推送測試。"
                    : "切換其他狀態查看"
                  : "試試清除部分篩選條件，或關鍵字換個寫法。"
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {webhooks.map((w) => (
            <WebhookCard
              key={w.id}
              webhook={w}
              sourceName={sourceNameOf(w.sourceId)}
              selected={selectedIds.has(w.id)}
              onToggleSelect={() => {
                const next = new Set(selectedIds)
                if (next.has(w.id)) next.delete(w.id)
                else next.add(w.id)
                setSelectedIds(next)
              }}
              onConfirm={() => setConfirmDialog({ mode: "single", webhook: w })}
              onReject={() => {
                if (confirm("確定拒絕這筆帳單？拒絕後不會建立付款項目。")) {
                  rejectMutation.mutate({ id: w.id })
                }
              }}
            />
          ))}
        </div>
      )}

      {/* 確認 Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          mode={confirmDialog.mode}
          webhook={confirmDialog.webhook}
          selectedIds={Array.from(selectedIds)}
          projects={projects}
          isPending={confirmMutation.isPending || batchConfirmMutation.isPending}
          onClose={() => setConfirmDialog(null)}
          onConfirm={(data) => {
            if (confirmDialog.mode === "single" && confirmDialog.webhook) {
              confirmMutation.mutate({ id: confirmDialog.webhook.id, ...data })
            } else {
              batchConfirmMutation.mutate({ ids: Array.from(selectedIds), ...data })
            }
          }}
        />
      )}

      {/* 批次拒絕 Dialog */}
      {rejectDialog && (
        <BatchRejectDialog
          count={rejectDialog.ids.length}
          isPending={batchRejectMutation.isPending}
          onClose={() => setRejectDialog(null)}
          onConfirm={(reviewNote) =>
            batchRejectMutation.mutate({ ids: rejectDialog.ids, reviewNote })
          }
        />
      )}
    </div>
  )
}

function WebhookCard({
  webhook,
  sourceName,
  selected,
  onToggleSelect,
  onConfirm,
  onReject,
}: {
  webhook: ExpenseWebhook
  sourceName: string
  selected: boolean
  onToggleSelect: () => void
  onConfirm: () => void
  onReject: () => void
}) {
  const status = STATUS_CONFIG[webhook.status] ?? STATUS_CONFIG.pending
  const amount = parseFloat(webhook.parsedAmountTwd || webhook.parsedAmount || "0")
  const isPending = webhook.status === "pending"

  return (
    <Card className={selected ? "border-blue-400 bg-blue-50/30" : ""}>
      <CardContent className="py-3 px-3 sm:px-4 flex items-start gap-3">
        {isPending && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            className="mt-1 flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge className={status.color}>
              <span className="flex items-center gap-1">
                {status.icon}
                {status.label}
              </span>
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Building2 className="h-3 w-3 mr-0.5" />
              {sourceName}
            </Badge>
            <span className="text-2xl font-bold text-red-600 ml-auto">
              ${Math.round(amount).toLocaleString()}
            </span>
          </div>

          <div className="text-sm space-y-0.5">
            {webhook.parsedVendor && <div className="font-medium">{webhook.parsedVendor}</div>}
            {webhook.parsedDescription && (
              <div className="text-gray-600">{webhook.parsedDescription}</div>
            )}
            <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
              {webhook.parsedInvoiceNumber && (
                <span>
                  <Receipt className="h-3 w-3 inline mr-0.5" />
                  {webhook.parsedInvoiceNumber}
                </span>
              )}
              {webhook.parsedDueAt && (
                <span>到期：{new Date(webhook.parsedDueAt).toLocaleDateString("zh-TW")}</span>
              )}
              {webhook.parsedPaidAt && (
                <span>付款：{new Date(webhook.parsedPaidAt).toLocaleDateString("zh-TW")}</span>
              )}
              {webhook.parsedCategoryHint && <span>分類：{webhook.parsedCategoryHint}</span>}
              {webhook.externalTransactionId && (
                <span className="text-gray-400 font-mono">{webhook.externalTransactionId}</span>
              )}
            </div>
            {/* PM 帳單照片 */}
            {(() => {
              const photo = webhook.rawPayload?.pmInvoicePhoto
              if (typeof photo !== "string" || !photo) return null
              return (
                <a
                  href={photo}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                >
                  <Receipt className="h-3 w-3" />
                  查看 PM 帳單照片
                </a>
              )
            })()}
          </div>

          {isPending && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={onConfirm}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                確認
              </Button>
              <Button size="sm" variant="outline" onClick={onReject}>
                <XCircle className="h-4 w-4 mr-1 text-red-600" />
                拒絕
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ConfirmDialog({
  mode,
  webhook,
  selectedIds,
  projects,
  isPending,
  onClose,
  onConfirm,
}: {
  mode: "single" | "batch"
  webhook?: ExpenseWebhook
  selectedIds: number[]
  projects: PaymentProject[]
  isPending: boolean
  onClose: () => void
  onConfirm: (data: {
    projectId: number
    categoryId?: number
    itemName?: string
    asPaid: boolean
    reviewNote?: string
  }) => void
}) {
  const [projectId, setProjectId] = useState<string>("")
  const [itemName, setItemName] = useState(
    webhook?.parsedVendor || webhook?.parsedDescription || ""
  )
  const [asPaid, setAsPaid] = useState(false)
  const [reviewNote, setReviewNote] = useState("")

  const canSubmit = !!projectId && (mode === "batch" || itemName.trim().length > 0)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "single" ? "確認帳單" : `批次確認 ${selectedIds.length} 筆`}
          </DialogTitle>
          <DialogDescription>
            {mode === "single" ? "確認後將寫入應付款項目" : "批次套用相同設定建立應付款項目"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {mode === "single" && webhook && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="font-bold text-lg text-red-600">
                ${Math.round(parseFloat(webhook.parsedAmount || "0")).toLocaleString()}
              </div>
              <div className="text-gray-600">
                {webhook.parsedDescription || webhook.parsedVendor}
              </div>
            </div>
          )}

          <div>
            <Label>所屬專案 *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇專案（必填）" />
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

          {mode === "single" && (
            <div>
              <Label>項目名稱 *</Label>
              <Input value={itemName} onChange={(e) => setItemName(e.target.value)} />
            </div>
          )}

          <label className="flex items-start gap-2 p-2 bg-amber-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={asPaid}
              onChange={(e) => setAsPaid(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium">建立後直接標記為已付</div>
              <div className="text-xs text-gray-600">適用 PM 推來的「已扣款」紀錄</div>
            </div>
          </label>

          <div>
            <Label>備註（選填）</Label>
            <Textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              placeholder="可補充歸檔說明..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!canSubmit || isPending}
            onClick={() =>
              onConfirm({
                projectId: parseInt(projectId),
                itemName: itemName.trim() || undefined,
                asPaid,
                reviewNote: reviewNote.trim() || undefined,
              })
            }
          >
            {isPending && <RefreshCw className="h-4 w-4 animate-spin mr-1" />}
            確認
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BatchRejectDialog({
  count,
  isPending,
  onClose,
  onConfirm,
}: {
  count: number
  isPending: boolean
  onClose: () => void
  onConfirm: (reviewNote: string) => void
}) {
  const [reviewNote, setReviewNote] = useState("")

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>批次拒絕 {count} 筆</DialogTitle>
          <DialogDescription>
            拒絕後不會建立付款項目，原始 webhook 紀錄仍保留可供查核。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>拒絕原因（選填）</Label>
            <Textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={3}
              placeholder="例：金額異常 / 已重複登錄 / PM 推測試資料..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => onConfirm(reviewNote.trim())}
          >
            {isPending && <RefreshCw className="h-4 w-4 animate-spin mr-1" />}
            確認拒絕
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
