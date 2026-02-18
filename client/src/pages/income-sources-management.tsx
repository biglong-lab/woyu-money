// 進帳來源管理頁面
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Plus,
  Settings,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Webhook,
  Shield,
  Activity,
  AlertCircle,
} from "lucide-react"
import type { IncomeSource, PaymentProject } from "@shared/schema"

// ─── 來源型別標籤 ───────────────────────────────
const SOURCE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  linepay: { label: "LINE Pay", color: "bg-green-100 text-green-800" },
  jkopay: { label: "街口支付", color: "bg-blue-100 text-blue-800" },
  airbnb: { label: "Airbnb", color: "bg-rose-100 text-rose-800" },
  booking: { label: "Booking.com", color: "bg-indigo-100 text-indigo-800" },
  custom_api: { label: "自訂 API", color: "bg-gray-100 text-gray-800" },
  manual: { label: "手動", color: "bg-yellow-100 text-yellow-800" },
}

const AUTH_TYPE_LABELS: Record<string, string> = {
  token: "Bearer Token",
  hmac: "HMAC 簽名",
  both: "Token + HMAC",
}

// ─── 表單 Schema ─────────────────────────────────
const formSchema = z.object({
  sourceName: z.string().min(1, "請輸入名稱").max(100),
  sourceKey: z
    .string()
    .min(2, "最少 2 字元")
    .max(50)
    .regex(/^[a-z0-9_-]+$/, "只允許小寫英文、數字、_ 和 -"),
  sourceType: z.enum(["linepay", "jkopay", "airbnb", "booking", "custom_api", "manual"]),
  description: z.string().max(500).optional(),
  authType: z.enum(["token", "hmac", "both"]),
  apiToken: z.string().max(255).optional(),
  webhookSecret: z.string().max(255).optional(),
  defaultProjectId: z.number().int().positive().optional(),
  defaultCurrency: z.string().default("TWD"),
  autoConfirm: z.boolean().default(false),
  isActive: z.boolean().default(true),
  // 欄位對應（JSONPath）
  fieldAmount: z.string().optional(),
  fieldCurrency: z.string().optional(),
  fieldTransactionId: z.string().optional(),
  fieldPaidAt: z.string().optional(),
  fieldDescription: z.string().optional(),
  fieldPayerName: z.string().optional(),
  fieldOrderId: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

// ─── 工具：產生 Webhook URL ─────────────────────────
const getWebhookUrl = (sourceKey: string) => {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://your-domain.com"
  return `${base}/api/income/webhook/${sourceKey}`
}

// ─── 主頁面 ──────────────────────────────────────
export default function IncomeSourcesManagementPage() {
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editingSource, setEditingSource] = useState<IncomeSource | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [expandedMappings, setExpandedMappings] = useState<Set<number>>(new Set())

  // ─── 查詢 ────────────────────────────────────
  const { data: sources = [], isLoading } = useQuery<IncomeSource[]>({
    queryKey: ["/api/income/sources"],
  })

  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  })

  // ─── 表單 ────────────────────────────────────
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceType: "custom_api",
      authType: "token",
      defaultCurrency: "TWD",
      autoConfirm: false,
      isActive: true,
    },
  })

  const openCreate = () => {
    form.reset({
      sourceType: "custom_api",
      authType: "token",
      defaultCurrency: "TWD",
      autoConfirm: false,
      isActive: true,
    })
    setEditingSource(null)
    setShowForm(true)
  }

  const openEdit = (source: IncomeSource) => {
    const mapping = (source.fieldMapping as Record<string, string>) ?? {}
    form.reset({
      sourceName: source.sourceName,
      sourceKey: source.sourceKey,
      sourceType: source.sourceType as FormValues["sourceType"],
      description: source.description ?? "",
      authType: (source.authType as FormValues["authType"]) ?? "token",
      defaultProjectId: source.defaultProjectId ?? undefined,
      defaultCurrency: source.defaultCurrency ?? "TWD",
      autoConfirm: source.autoConfirm ?? false,
      isActive: source.isActive ?? true,
      fieldAmount: mapping.amount ?? "",
      fieldCurrency: mapping.currency ?? "",
      fieldTransactionId: mapping.transactionId ?? "",
      fieldPaidAt: mapping.paidAt ?? "",
      fieldDescription: mapping.description ?? "",
      fieldPayerName: mapping.payerName ?? "",
      fieldOrderId: mapping.orderId ?? "",
    })
    setEditingSource(source)
    setShowForm(true)
  }

  // ─── Mutation ────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const fieldMapping: Record<string, string> = {}
      if (values.fieldAmount) fieldMapping.amount = values.fieldAmount
      if (values.fieldCurrency) fieldMapping.currency = values.fieldCurrency
      if (values.fieldTransactionId) fieldMapping.transactionId = values.fieldTransactionId
      if (values.fieldPaidAt) fieldMapping.paidAt = values.fieldPaidAt
      if (values.fieldDescription) fieldMapping.description = values.fieldDescription
      if (values.fieldPayerName) fieldMapping.payerName = values.fieldPayerName
      if (values.fieldOrderId) fieldMapping.orderId = values.fieldOrderId

      const payload = {
        sourceName: values.sourceName,
        sourceKey: values.sourceKey,
        sourceType: values.sourceType,
        description: values.description,
        authType: values.authType,
        apiToken: values.apiToken || undefined,
        webhookSecret: values.webhookSecret || undefined,
        defaultProjectId: values.defaultProjectId,
        defaultCurrency: values.defaultCurrency,
        autoConfirm: values.autoConfirm,
        isActive: values.isActive,
        fieldMapping,
      }

      if (editingSource) {
        return apiRequest("PUT", `/api/income/sources/${editingSource.id}`, payload)
      }
      return apiRequest("POST", "/api/income/sources", payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income/sources"] })
      setShowForm(false)
      toast({ title: editingSource ? "已更新來源設定" : "已建立新進帳來源" })
    },
    onError: (err: Error) => {
      toast({ title: "儲存失敗", description: err.message, variant: "destructive" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/income/sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income/sources"] })
      setDeletingId(null)
      toast({ title: "已停用此來源" })
    },
    onError: (err: Error) => {
      toast({ title: "操作失敗", description: err.message, variant: "destructive" })
    },
  })

  const toggleMapping = (id: number) => {
    setExpandedMappings((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    toast({ title: "已複製 Webhook URL" })
  }

  // ─── 渲染 ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* 頁首 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="h-6 w-6 text-primary" />
            進帳來源管理
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            設定外部系統的 Webhook 接入，讓進帳自動進入系統
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          新增來源
        </Button>
      </div>

      {/* 說明卡片 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4 pb-3">
          <div className="flex gap-3 items-start text-sm text-blue-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">如何接入外部系統？</p>
              <p className="text-blue-700 mt-1">
                1. 建立來源並設定驗證方式 &nbsp;→&nbsp; 2. 複製 Webhook URL 填入外部系統 &nbsp;→&nbsp;
                3. 外部系統有收款時自動推送 &nbsp;→&nbsp; 4. 在「進帳收件箱」確認後自動歸帳
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 來源列表 */}
      {sources.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
            <Webhook className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>尚未設定任何進帳來源</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              新增第一個來源
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => {
            const typeInfo =
              SOURCE_TYPE_LABELS[source.sourceType] ?? SOURCE_TYPE_LABELS.custom_api
            const webhookUrl = getWebhookUrl(source.sourceKey)
            const mapping = (source.fieldMapping as Record<string, string>) ?? {}
            const hasMappings = Object.keys(mapping).length > 0
            const isExpanded = expandedMappings.has(source.id)

            return (
              <Card key={source.id} className={!source.isActive ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{source.sourceName}</CardTitle>
                      <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                      {!source.isActive && (
                        <Badge variant="outline" className="text-gray-500">
                          已停用
                        </Badge>
                      )}
                      {source.autoConfirm && (
                        <Badge className="bg-orange-100 text-orange-800">自動確認</Badge>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(source)}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setDeletingId(source.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {source.description && (
                    <CardDescription>{source.description}</CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Webhook URL */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Webhook URL
                    </Label>
                    <div className="flex gap-2">
                      <code className="flex-1 text-xs bg-gray-100 rounded px-3 py-2 break-all">
                        {webhookUrl}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyUrl(webhookUrl)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* 統計 & 驗證方式 */}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5" />
                      {AUTH_TYPE_LABELS[source.authType ?? "token"]}
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5" />
                      累計接收 {source.totalReceived ?? 0} 筆
                    </span>
                    {source.lastReceivedAt && (
                      <span>
                        最後接收：
                        {new Date(source.lastReceivedAt).toLocaleString("zh-TW")}
                      </span>
                    )}
                    {source.defaultProjectId && projects.length > 0 && (
                      <span>
                        預設專案：
                        {projects.find((p) => p.id === source.defaultProjectId)
                          ?.projectName ?? "-"}
                      </span>
                    )}
                  </div>

                  {/* 欄位對應（可展開） */}
                  {hasMappings && (
                    <Collapsible open={isExpanded} onOpenChange={() => toggleMapping(source.id)}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 -ml-2"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                          欄位對應設定
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 rounded bg-gray-50 p-3 text-xs grid grid-cols-2 gap-1">
                          {Object.entries(mapping).map(([key, path]) => (
                            <div key={key}>
                              <span className="font-medium text-gray-600">{key}：</span>
                              <code className="text-gray-800">{path}</code>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── 新增 / 編輯對話框 ─── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSource ? "編輯進帳來源" : "新增進帳來源"}
            </DialogTitle>
            <DialogDescription>
              設定外部系統的接入資訊與欄位對應規則
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
            className="space-y-5"
          >
            {/* 基本資訊 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sourceName">顯示名稱 *</Label>
                <Input
                  id="sourceName"
                  placeholder="例：LINE Pay 收款"
                  {...form.register("sourceName")}
                />
                {form.formState.errors.sourceName && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.sourceName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sourceKey">
                  來源識別碼 *
                  <span className="text-xs text-muted-foreground ml-1">（URL 路徑用）</span>
                </Label>
                <Input
                  id="sourceKey"
                  placeholder="例：linepay"
                  {...form.register("sourceKey")}
                  disabled={!!editingSource}
                />
                {form.formState.errors.sourceKey && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.sourceKey.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>來源類型</Label>
                <Select
                  value={form.watch("sourceType")}
                  onValueChange={(v) =>
                    form.setValue("sourceType", v as FormValues["sourceType"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>預設歸屬專案</Label>
                <Select
                  value={form.watch("defaultProjectId")?.toString() ?? ""}
                  onValueChange={(v) =>
                    form.setValue("defaultProjectId", v ? parseInt(v) : undefined)
                  }
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
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">說明（選填）</Label>
              <Textarea
                id="description"
                rows={2}
                placeholder="這個來源的用途說明"
                {...form.register("description")}
              />
            </div>

            {/* 驗證設定 */}
            <div className="space-y-3 border rounded-lg p-4">
              <p className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                驗證設定
              </p>

              <div className="space-y-1.5">
                <Label>驗證方式</Label>
                <Select
                  value={form.watch("authType")}
                  onValueChange={(v) =>
                    form.setValue("authType", v as FormValues["authType"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="token">Bearer Token（推薦）</SelectItem>
                    <SelectItem value="hmac">HMAC-SHA256 簽名</SelectItem>
                    <SelectItem value="both">兩者皆需（最嚴格）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(form.watch("authType") === "token" ||
                form.watch("authType") === "both") && (
                <div className="space-y-1.5">
                  <Label htmlFor="apiToken">
                    API Token
                    {editingSource && (
                      <span className="text-xs text-muted-foreground ml-1">
                        （留空表示不變更）
                      </span>
                    )}
                  </Label>
                  <Input
                    id="apiToken"
                    type="password"
                    placeholder="輸入強密碼作為 Bearer Token"
                    {...form.register("apiToken")}
                  />
                </div>
              )}

              {(form.watch("authType") === "hmac" ||
                form.watch("authType") === "both") && (
                <div className="space-y-1.5">
                  <Label htmlFor="webhookSecret">
                    Webhook Secret
                    {editingSource && (
                      <span className="text-xs text-muted-foreground ml-1">
                        （留空表示不變更）
                      </span>
                    )}
                  </Label>
                  <Input
                    id="webhookSecret"
                    type="password"
                    placeholder="HMAC-SHA256 簽名密鑰"
                    {...form.register("webhookSecret")}
                  />
                </div>
              )}
            </div>

            {/* 欄位對應 */}
            <div className="space-y-3 border rounded-lg p-4">
              <p className="text-sm font-medium">欄位對應（JSONPath）</p>
              <p className="text-xs text-muted-foreground">
                用 $.路徑 指定如何從外部 JSON 取得各欄位值，例：
                <code className="bg-gray-100 px-1 rounded">$.transaction.amount</code>
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { field: "fieldAmount", label: "金額 *", placeholder: "$.amount" },
                  { field: "fieldTransactionId", label: "交易 ID", placeholder: "$.transaction_id" },
                  { field: "fieldPaidAt", label: "收款時間", placeholder: "$.paid_at" },
                  { field: "fieldDescription", label: "說明", placeholder: "$.description" },
                  { field: "fieldPayerName", label: "付款方名稱", placeholder: "$.payer.name" },
                  { field: "fieldOrderId", label: "訂單號", placeholder: "$.order_id" },
                  { field: "fieldCurrency", label: "幣別", placeholder: "$.currency" },
                ].map(({ field, label, placeholder }) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      className="h-8 text-xs font-mono"
                      placeholder={placeholder}
                      {...form.register(field as keyof FormValues)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 行為設定 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>啟用此來源</Label>
                  <p className="text-xs text-muted-foreground">停用後不再接收此來源的 Webhook</p>
                </div>
                <Switch
                  checked={form.watch("isActive")}
                  onCheckedChange={(v) => form.setValue("isActive", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-1">
                    自動確認
                    <Badge className="bg-orange-100 text-orange-700 text-xs">謹慎使用</Badge>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    開啟後收到 Webhook 即自動入帳，不需人工確認
                  </p>
                </div>
                <Switch
                  checked={form.watch("autoConfirm")}
                  onCheckedChange={(v) => form.setValue("autoConfirm", v)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "儲存中..." : editingSource ? "更新" : "建立"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── 刪除確認 ─── */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認停用此來源？</AlertDialogTitle>
            <AlertDialogDescription>
              停用後外部系統的 Webhook 將不再被接受，但歷史進帳紀錄不受影響。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              確認停用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
