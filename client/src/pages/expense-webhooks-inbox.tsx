/**
 * 外部帳單收件箱（/expense/inbox）
 *
 * 顯示 PM bridge / POS 等外部系統推進來的支出帳單（expense_webhooks），
 * 鏡像 income-webhooks-inbox 設計：列表 + 篩選 + 單筆/批次確認/拒絕。
 *
 * Pending → 點確認 → 寫入 payment_items（待付）或 payment_items+payment_records（已付）
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export default function ExpenseWebhooksInbox() {
  useDocumentTitle("外部帳單收件箱")
  const { toast } = useToast()
  const [tab, setTab] = useState<"pending" | "confirmed" | "rejected" | "all">("pending")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [confirmDialog, setConfirmDialog] = useState<{
    mode: "single" | "batch"
    webhook?: ExpenseWebhook
  } | null>(null)

  // 列表（按狀態篩選）
  const queryStr = tab === "all" ? "" : `?status=${tab}`
  const { data: list, isLoading } = useQuery<{
    data: ExpenseWebhook[]
    total: number
  }>({
    queryKey: [`/api/expense/webhooks${queryStr}`],
    refetchInterval: 30000, // 30 秒重新整理一次（PM cron 進來時可及時看到）
  })
  const webhooks = list?.data ?? []

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
    mutationFn: async (id: number) =>
      apiRequest("POST", `/api/expense/webhooks/${id}/reject`, { reviewNote: "" }),
    onSuccess: () => {
      toast({ title: "已拒絕" })
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/expense"),
      })
    },
    onError: (err: Error) =>
      toast({ title: "失敗", description: err.message, variant: "destructive" }),
  })

  // 統計
  const pendingCount = tab === "pending" ? webhooks.length : 0
  const totalPendingAmount = webhooks
    .filter((w) => w.status === "pending")
    .reduce((sum, w) => sum + parseFloat(w.parsedAmount || "0"), 0)

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

      {/* 統計列 */}
      {tab === "pending" && webhooks.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-3 px-4 flex flex-wrap items-center gap-4">
            <div>
              <div className="text-xs text-yellow-700">待確認筆數</div>
              <div className="text-xl font-bold text-yellow-900">{pendingCount}</div>
            </div>
            <div>
              <div className="text-xs text-yellow-700">合計金額</div>
              <div className="text-xl font-bold text-yellow-900">
                ${Math.round(totalPendingAmount).toLocaleString()}
              </div>
            </div>
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => setConfirmDialog({ mode: "batch" })}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                批次確認選取的 {selectedIds.size} 筆
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 切換 */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
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
              title={tab === "pending" ? "目前沒有待確認的帳單" : "無資料"}
              description={
                tab === "pending"
                  ? "PM 系統推帳單進來時、會出現在這裡。也可請對接方手動觸發推送測試。"
                  : "切換其他狀態查看"
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
                  rejectMutation.mutate(w.id)
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
