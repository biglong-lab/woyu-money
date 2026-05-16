/**
 * 整合中心（/integrations）
 *
 * 統一管理收入 / 支出端的對外 API 嫁接：
 * - 進帳來源（連到既有 /income/sources）
 * - 支出來源（這次新建的 /expense/sources）
 * - 拋接紀錄（通用 integration_events，含 Replay）
 * - 健康指標卡片（24h 成功率、平均延遲）
 *
 * 設計重點：
 * - 統一視覺、Tab 切換、不重複造輪子
 * - 既有 income 細節編輯仍走 /income/sources（這頁只做集成入口）
 * - 支出端為新功能，提供新增/編輯/Send Test Payload
 */
import { useState } from "react"
import { Link } from "wouter"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { apiRequest } from "@/lib/queryClient"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Inbox,
  Repeat,
  Send,
  Settings as SettingsIcon,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

interface SourceLike {
  id: number
  sourceName: string
  sourceKey: string
  sourceType: string
  authType: string
  isActive: boolean | null
  autoConfirm: boolean | null
  totalReceived: number | null
  lastReceivedAt: string | null
  webhookMode?: string
}

interface HealthData {
  last24hTotal: number
  last24hSuccess: number
  last24hFailure: number
  successRate: number
  avgLatencyMs: number | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
}

interface IntegrationEvent {
  id: number
  integrationType: string
  sourceId: number
  sourceKey: string
  direction: string
  httpMethod: string | null
  statusCode: number | null
  outcome: string
  errorMessage: string | null
  latencyMs: number | null
  attempt: number | null
  createdAt: string
  requestIp: string | null
  requestPayload: unknown
}

export default function IntegrationsCenter() {
  useDocumentTitle("整合中心")
  const [activeTab, setActiveTab] = useState<"income" | "expense" | "events">("income")

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-600" />
          整合中心
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          管理收入 / 支出端的外部 API 嫁接、檢查拋接紀錄與健康指標
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="income">
            <TrendingUp className="h-4 w-4 mr-1 text-green-600" />
            進帳來源
          </TabsTrigger>
          <TabsTrigger value="expense">
            <TrendingDown className="h-4 w-4 mr-1 text-red-600" />
            支出來源
          </TabsTrigger>
          <TabsTrigger value="events">
            <Inbox className="h-4 w-4 mr-1" />
            拋接紀錄
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-4">
          <IncomeSourcesPanel />
        </TabsContent>
        <TabsContent value="expense" className="mt-4">
          <ExpenseSourcesPanel />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─────────────────────────────────────────────
// 進帳來源 panel
// ─────────────────────────────────────────────
function IncomeSourcesPanel() {
  const { data: sources = [], isLoading } = useQuery<SourceLike[]>({
    queryKey: ["/api/income/sources"],
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">外部系統推送收入資料的端點設定</p>
        <Link href="/income/sources">
          <Button variant="outline" size="sm">
            <SettingsIcon className="h-4 w-4 mr-1" />
            前往詳細管理
          </Button>
        </Link>
      </div>
      {isLoading ? (
        <p className="text-center text-gray-400 py-8">載入中...</p>
      ) : sources.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            尚無進帳來源。到「
            <Link href="/income/sources" className="text-blue-600 underline">
              詳細管理
            </Link>
            」新增。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sources.map((s) => (
            <SourceCard key={s.id} source={s} type="income" />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 支出來源 panel
// ─────────────────────────────────────────────
function ExpenseSourcesPanel() {
  const { data: sources = [], isLoading } = useQuery<SourceLike[]>({
    queryKey: ["/api/expense/sources"],
  })
  const [showAddDialog, setShowAddDialog] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          外部系統推送支出 / 待付款項目的端點設定（鏡像進帳機制）
        </p>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          + 新增支出來源
        </Button>
      </div>
      {isLoading ? (
        <p className="text-center text-gray-400 py-8">載入中...</p>
      ) : sources.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            尚無支出來源。點上方「新增」開始設定。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sources.map((s) => (
            <SourceCard key={s.id} source={s} type="expense" />
          ))}
        </div>
      )}
      {showAddDialog && <AddExpenseSourceDialog onClose={() => setShowAddDialog(false)} />}
    </div>
  )
}

// ─────────────────────────────────────────────
// Source 卡片（共用，含健康指標 + Test 按鈕）
// ─────────────────────────────────────────────
function SourceCard({ source, type }: { source: SourceLike; type: "income" | "expense" }) {
  const { toast } = useToast()
  const { data: health } = useQuery<HealthData>({
    queryKey: [`/api/integrations/sources/${type}/${source.id}/health`],
    refetchInterval: 30000,
  })

  type TestResult = { executed: boolean; result?: { success: boolean; error?: string } }
  const testMutation = useMutation({
    mutationFn: async (executeForReal: boolean): Promise<TestResult> => {
      return apiRequest<TestResult>("POST", `/api/integrations/sources/${type}/${source.id}/test`, {
        executeForReal,
      })
    },
    onSuccess: (data: TestResult) => {
      toast({
        title: data.executed ? "✅ 測試已執行" : "✅ 測試 payload 已產生",
        description: data.executed
          ? `結果：${data.result?.success ? "成功" : "失敗"}${data.result?.error ? ` - ${data.result.error}` : ""}`
          : "可複製 curl 指令在外部測試",
      })
    },
    onError: (err: Error) => {
      toast({ title: "測試失敗", description: err.message, variant: "destructive" })
    },
  })

  const successPct = health ? Math.round(health.successRate * 100) : null
  const statusColor =
    successPct === null
      ? "text-gray-400"
      : successPct >= 95
        ? "text-green-600"
        : successPct >= 80
          ? "text-yellow-600"
          : "text-red-600"

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {source.sourceName}
              {!source.isActive && <Badge variant="outline">停用</Badge>}
              {source.autoConfirm && <Badge className="bg-blue-100 text-blue-700">自動確認</Badge>}
            </CardTitle>
            <CardDescription className="text-xs mt-1 font-mono">
              {source.sourceKey} · {source.sourceType}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-gray-500">24h 總數</div>
            <div className="font-semibold text-base">{health?.last24hTotal ?? "-"}</div>
          </div>
          <div>
            <div className="text-gray-500">成功率</div>
            <div className={`font-semibold text-base ${statusColor}`}>
              {successPct !== null ? `${successPct}%` : "-"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">平均延遲</div>
            <div className="font-semibold text-base">
              {health?.avgLatencyMs ? `${health.avgLatencyMs}ms` : "-"}
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-0.5">
          <div>累計：{source.totalReceived ?? 0} 筆</div>
          {source.lastReceivedAt && (
            <div>最後接收：{new Date(source.lastReceivedAt).toLocaleString("zh-TW")}</div>
          )}
          {health?.lastFailureAt && (
            <div className="text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              最後失敗：{new Date(health.lastFailureAt).toLocaleString("zh-TW")}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => testMutation.mutate(false)}
            disabled={testMutation.isPending}
          >
            <Copy className="h-3 w-3 mr-1" />
            產生測試 payload
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => testMutation.mutate(true)}
            disabled={testMutation.isPending}
          >
            <Send className="h-3 w-3 mr-1" />
            實際送一筆
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 拋接紀錄 panel
// ─────────────────────────────────────────────
function EventsPanel() {
  const [filter, setFilter] = useState<{ type?: string; outcome?: string }>({})
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const queryParams = new URLSearchParams()
  if (filter.type) queryParams.set("integrationType", filter.type)
  if (filter.outcome) queryParams.set("outcome", filter.outcome)
  queryParams.set("page", String(page))
  queryParams.set("pageSize", "50")

  const queryUrl = `/api/integrations/events?${queryParams.toString()}`
  const { data, isLoading } = useQuery<{
    data: IntegrationEvent[]
    total: number
    page: number
    pageSize: number
  }>({
    queryKey: [queryUrl],
    refetchInterval: 5000,
  })

  const replayMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest("POST", `/api/integrations/events/${eventId}/replay`)
    },
    onSuccess: () => {
      toast({ title: "✅ 已重新送出" })
      queryClient.invalidateQueries({ queryKey: [queryUrl] })
    },
    onError: (err: Error) => {
      toast({ title: "Replay 失敗", description: err.message, variant: "destructive" })
    },
  })

  const events = data?.data ?? []
  const total = data?.total ?? 0
  const pageCount = Math.ceil(total / 50)

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <select
          className="border rounded px-2 py-1 text-sm"
          value={filter.type ?? ""}
          onChange={(e) => {
            setFilter({ ...filter, type: e.target.value || undefined })
            setPage(1)
          }}
        >
          <option value="">所有類型</option>
          <option value="income">進帳</option>
          <option value="expense">支出</option>
        </select>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={filter.outcome ?? ""}
          onChange={(e) => {
            setFilter({ ...filter, outcome: e.target.value || undefined })
            setPage(1)
          }}
        >
          <option value="">所有結果</option>
          <option value="success">成功</option>
          <option value="auth_failed">驗證失敗</option>
          <option value="validation_failed">資料無效</option>
          <option value="duplicate">重複</option>
          <option value="error">錯誤</option>
          <option value="retried">重試</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">共 {total} 筆</span>
      </div>

      {isLoading ? (
        <p className="text-center text-gray-400 py-8">載入中...</p>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">尚無拋接紀錄</CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">時間</th>
                <th className="px-3 py-2 text-left">類型 / 來源</th>
                <th className="px-3 py-2 text-left">結果</th>
                <th className="px-3 py-2 text-left">延遲</th>
                <th className="px-3 py-2 text-left">嘗試</th>
                <th className="px-3 py-2 text-left">錯誤</th>
                <th className="px-3 py-2 text-right">動作</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-600 font-mono">
                    {new Date(e.createdAt).toLocaleString("zh-TW", { hour12: false })}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={e.integrationType === "income" ? "default" : "secondary"}>
                      {e.integrationType === "income" ? "進帳" : "支出"}
                    </Badge>
                    <span className="ml-2 font-mono text-xs">{e.sourceKey}</span>
                  </td>
                  <td className="px-3 py-2">
                    <OutcomeBadge outcome={e.outcome} />
                  </td>
                  <td className="px-3 py-2 text-xs">{e.latencyMs ? `${e.latencyMs}ms` : "-"}</td>
                  <td className="px-3 py-2 text-xs">#{e.attempt ?? 1}</td>
                  <td className="px-3 py-2 text-xs text-red-600 max-w-[200px] truncate">
                    {e.errorMessage ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => replayMutation.mutate(e.id)}
                      disabled={replayMutation.isPending}
                      title="重新送一次"
                    >
                      <Repeat className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一頁
          </Button>
          <span className="text-sm text-gray-600 self-center">
            第 {page} / {pageCount} 頁
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            下一頁
          </Button>
        </div>
      )}
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    success: { label: "成功", cls: "bg-green-100 text-green-700" },
    duplicate: { label: "重複", cls: "bg-gray-100 text-gray-700" },
    auth_failed: { label: "驗證失敗", cls: "bg-red-100 text-red-700" },
    validation_failed: { label: "資料無效", cls: "bg-orange-100 text-orange-700" },
    error: { label: "錯誤", cls: "bg-red-100 text-red-700" },
    retried: { label: "重試", cls: "bg-blue-100 text-blue-700" },
  }
  const c = config[outcome] ?? { label: outcome, cls: "bg-gray-100 text-gray-700" }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.cls}`}>{c.label}</span>
}

// ─────────────────────────────────────────────
// 新增支出來源 Dialog（簡化版）
// ─────────────────────────────────────────────
function AddExpenseSourceDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState({
    sourceName: "",
    sourceKey: "",
    sourceType: "custom_api",
    authType: "token",
    apiToken: "",
    webhookSecret: "",
    webhookMode: "as_pending",
    autoConfirm: false,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/expense/sources", form)
    },
    onSuccess: () => {
      toast({ title: "✅ 已新增", description: `支出來源 ${form.sourceKey} 已建立` })
      queryClient.invalidateQueries({ queryKey: ["/api/expense/sources"] })
      onClose()
    },
    onError: (err: Error) => {
      toast({ title: "新增失敗", description: err.message, variant: "destructive" })
    },
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>新增支出來源</CardTitle>
          <CardDescription>外部系統將以此 sourceKey 推送支出資料</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Field label="名稱">
            <input
              className="w-full border rounded px-3 py-1.5"
              value={form.sourceName}
              onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
              placeholder="例：PM 系統支出"
            />
          </Field>
          <Field label="Source Key（URL 識別碼，僅小寫英數與底線）">
            <input
              className="w-full border rounded px-3 py-1.5 font-mono"
              value={form.sourceKey}
              onChange={(e) => setForm({ ...form, sourceKey: e.target.value })}
              placeholder="pm_expense"
            />
          </Field>
          <Field label="類型">
            <select
              className="w-full border rounded px-3 py-1.5"
              value={form.sourceType}
              onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
            >
              <option value="pm_expense">PM 系統</option>
              <option value="accounting_system">會計系統</option>
              <option value="erp">ERP</option>
              <option value="custom_api">自訂 API</option>
              <option value="manual">手動</option>
            </select>
          </Field>
          <Field label="驗證方式">
            <select
              className="w-full border rounded px-3 py-1.5"
              value={form.authType}
              onChange={(e) => setForm({ ...form, authType: e.target.value })}
            >
              <option value="token">Bearer Token</option>
              <option value="hmac">HMAC-SHA256</option>
              <option value="both">Token + HMAC（雙重）</option>
            </select>
          </Field>
          {(form.authType === "token" || form.authType === "both") && (
            <Field label="API Token">
              <input
                className="w-full border rounded px-3 py-1.5 font-mono text-xs"
                value={form.apiToken}
                onChange={(e) => setForm({ ...form, apiToken: e.target.value })}
                placeholder="長度 ≥ 16 字元"
              />
            </Field>
          )}
          {(form.authType === "hmac" || form.authType === "both") && (
            <Field label="HMAC Secret">
              <input
                className="w-full border rounded px-3 py-1.5 font-mono text-xs"
                value={form.webhookSecret}
                onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                placeholder="長度 ≥ 32 字元"
              />
            </Field>
          )}
          <Field label="模式">
            <select
              className="w-full border rounded px-3 py-1.5"
              value={form.webhookMode}
              onChange={(e) => setForm({ ...form, webhookMode: e.target.value })}
            >
              <option value="as_pending">建立待付項目（需手動標記已付）</option>
              <option value="as_paid">建立已付紀錄（外部已扣款）</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoConfirm}
              onChange={(e) => setForm({ ...form, autoConfirm: e.target.checked })}
            />
            <span>自動確認（推進來直接建立、不進待確認區）</span>
          </label>
        </CardContent>
        <div className="p-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.sourceName || !form.sourceKey}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            建立
          </Button>
        </div>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
