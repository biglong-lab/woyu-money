/**
 * 週期性支出模板管理（/recurring-expenses）
 *
 * 取代「依歷史平均自動推算」邏輯：
 * - 使用者建立每筆固定支出模板（人事、洗滌、水電、保險...）
 * - 設定金額、發生日、生效月份
 * - 可「立即產出當月」、不用等 1 號
 * - 每月 1-3 號 scheduler 自動產出 unpaid payment_item 待確認
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
import {
  Repeat,
  Plus,
  Pencil,
  Trash2,
  Play,
  Calendar,
  DollarSign,
  Pause,
  CheckCircle2,
} from "lucide-react"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { EmptyState } from "@/components/ui/empty-state"
import type { PaymentProject } from "@shared/schema"

interface Template {
  id: number
  templateName: string
  projectId: number | null
  categoryId: number | null
  fixedCategoryId: number | null
  estimatedAmount: string
  dayOfMonth: number
  activeMonths: string
  tags: string | null
  notes: string | null
  isActive: boolean
  lastGeneratedMonth: string | null
  createdAt: string
  updatedAt: string
}

export default function RecurringExpensesPage() {
  useDocumentTitle("週期性支出模板")
  const { toast } = useToast()
  const [editDialog, setEditDialog] = useState<{ mode: "create" | "edit"; tpl?: Template } | null>(
    null
  )
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null)

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/recurring-expense-templates"],
  })

  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  })
  const projectName = (id: number | null) =>
    projects.find((p) => p.id === id)?.projectName ?? "(無)"

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/recurring-expense-templates/${id}`),
    onSuccess: () => {
      toast({ title: "已刪除模板" })
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expense-templates"] })
      setConfirmDelete(null)
    },
    onError: (err: Error) =>
      toast({ title: "刪除失敗", description: err.message, variant: "destructive" }),
  })

  const generateMutation = useMutation({
    mutationFn: (vars: { id: number; force: boolean; month: string }) =>
      apiRequest<{ generated: number[]; skipped: { id: number; reason: string }[] }>(
        "POST",
        `/api/recurring-expense-templates/${vars.id}/generate`,
        { force: vars.force, month: vars.month }
      ),
    onSuccess: (r) => {
      toast({
        title: r.generated.length > 0 ? "✅ 已產出" : "未產出",
        description:
          r.generated.length > 0
            ? `新增 ${r.generated.length} 筆 unpaid payment_item（請至付款管理核實）`
            : (r.skipped[0]?.reason ?? "已產出該月或已有紀錄"),
      })
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expense-templates"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
    },
    onError: (err: Error) =>
      toast({ title: "產出失敗", description: err.message, variant: "destructive" }),
  })

  // 月份選擇（預設當月）
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const generateAllMutation = useMutation({
    mutationFn: (month: string) =>
      apiRequest<{
        month: string
        generated: number[]
        skipped: { id: number; reason: string }[]
      }>("POST", "/api/recurring-expense-templates/generate-all", { month }),
    onSuccess: (r) => {
      toast({
        title: `${r.month} 全部產出完成`,
        description: `新增 ${r.generated.length} 筆 / 跳過 ${r.skipped.length} 筆`,
      })
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expense-templates"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
    },
  })

  const totalMonthly = templates
    .filter((t) => t.isActive)
    .reduce((sum, t) => sum + parseFloat(t.estimatedAmount), 0)

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Repeat className="h-6 w-6 text-blue-600" />
            週期性支出模板
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            每月固定支出（人事、洗滌、水電、保險...）模板。每月 1-3 號自動產出 unpaid 待確認項目。
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 px-2 text-sm border border-gray-300 rounded bg-white"
          >
            {(() => {
              // 過去 3 月 ~ 未來 6 月
              const opts: string[] = []
              const now = new Date()
              for (let i = -3; i <= 6; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
                opts.push(d.toISOString().slice(0, 7))
              }
              return opts.map((m) => (
                <option key={m} value={m}>
                  {m}
                  {m === new Date().toISOString().slice(0, 7) ? "（本月）" : ""}
                </option>
              ))
            })()}
          </select>
          <Button
            variant="outline"
            onClick={() => generateAllMutation.mutate(selectedMonth)}
            disabled={generateAllMutation.isPending}
          >
            <Play className="h-4 w-4 mr-1" />
            全部立即產出
          </Button>
          <Button onClick={() => setEditDialog({ mode: "create" })}>
            <Plus className="h-4 w-4 mr-1" />
            新增模板
          </Button>
        </div>
      </div>

      {/* 統計卡 */}
      {templates.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3 px-4 flex flex-wrap gap-6 items-center">
            <div>
              <div className="text-xs text-blue-700">啟用中</div>
              <div className="text-xl font-bold text-blue-900">
                {templates.filter((t) => t.isActive).length}{" "}
                <span className="text-sm font-normal">/ 共 {templates.length}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-blue-700">每月估算總支出</div>
              <div className="text-xl font-bold text-blue-900">
                ${Math.round(totalMonthly).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 列表 */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-0">
            <EmptyState
              icon={Repeat}
              title="尚未建立任何模板"
              description="點擊「新增模板」開始建立每月固定支出（人事、洗滌、水電、保險等）"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              tpl={t}
              projectName={projectName(t.projectId)}
              onEdit={() => setEditDialog({ mode: "edit", tpl: t })}
              onDelete={() => setConfirmDelete(t)}
              onGenerate={(force) =>
                generateMutation.mutate({ id: t.id, force, month: selectedMonth })
              }
              isGenerating={generateMutation.isPending}
            />
          ))}
        </div>
      )}

      {editDialog && (
        <TemplateDialog
          mode={editDialog.mode}
          template={editDialog.tpl}
          projects={projects}
          onClose={() => setEditDialog(null)}
        />
      )}

      {confirmDelete && (
        <Dialog open onOpenChange={() => setConfirmDelete(null)}>
          <DialogContent className="w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle>刪除模板</DialogTitle>
              <DialogDescription>
                確定刪除「{confirmDelete.templateName}」？已產出的 payment_item 不會被刪除。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
              >
                確認刪除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function TemplateCard({
  tpl,
  projectName,
  onEdit,
  onDelete,
  onGenerate,
  isGenerating,
}: {
  tpl: Template
  projectName: string
  onEdit: () => void
  onDelete: () => void
  onGenerate: (force: boolean) => void
  isGenerating: boolean
}) {
  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)
  const alreadyGeneratedThisMonth = tpl.lastGeneratedMonth === currentMonth

  return (
    <Card className={tpl.isActive ? "" : "opacity-60"}>
      <CardContent className="py-3 px-3 sm:px-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold">{tpl.templateName}</h3>
              {tpl.isActive ? (
                <Badge className="bg-green-100 text-green-800">啟用</Badge>
              ) : (
                <Badge variant="outline" className="text-gray-500">
                  <Pause className="h-3 w-3 mr-0.5" />
                  停用
                </Badge>
              )}
              {alreadyGeneratedThisMonth && (
                <Badge className="bg-blue-100 text-blue-800">
                  <CheckCircle2 className="h-3 w-3 mr-0.5" />
                  本月已產出
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <span className="text-gray-400">金額：</span>
                <span className="font-semibold text-red-600">
                  ${parseFloat(tpl.estimatedAmount).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-400">專案：</span>
                {projectName}
              </div>
              <div>
                <Calendar className="h-3 w-3 inline mr-0.5" />
                每月 {tpl.dayOfMonth} 號
              </div>
              <div>
                <span className="text-gray-400">月份：</span>
                {tpl.activeMonths === "*" ? "全部月" : tpl.activeMonths}
              </div>
            </div>
            {tpl.notes && <div className="text-xs text-gray-500 mt-1.5">{tpl.notes}</div>}
          </div>
          <div className="flex gap-1 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onGenerate(false)}
              disabled={isGenerating || !tpl.isActive}
              title={
                alreadyGeneratedThisMonth ? "本月已產出（用編輯重設可重新產）" : "立即產出當月"
              }
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              立即產出
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 text-red-600" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TemplateDialog({
  mode,
  template,
  projects,
  onClose,
}: {
  mode: "create" | "edit"
  template?: Template
  projects: PaymentProject[]
  onClose: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(template?.templateName ?? "")
  const [amount, setAmount] = useState(template?.estimatedAmount ?? "")
  const [projectId, setProjectId] = useState<string>(template?.projectId?.toString() ?? "none")
  const [dayOfMonth, setDayOfMonth] = useState(template?.dayOfMonth ?? 10)
  const [activeMonths, setActiveMonths] = useState(template?.activeMonths ?? "*")
  const [notes, setNotes] = useState(template?.notes ?? "")
  const [isActive, setIsActive] = useState(template?.isActive ?? true)

  const saveMutation = useMutation({
    mutationFn: () => {
      const data = {
        templateName: name.trim(),
        projectId: projectId === "none" ? null : parseInt(projectId),
        estimatedAmount: amount,
        dayOfMonth: Math.min(28, Math.max(1, dayOfMonth)),
        activeMonths,
        notes: notes.trim() || null,
        isActive,
      }
      if (mode === "create") {
        return apiRequest("POST", "/api/recurring-expense-templates", data)
      }
      return apiRequest("PUT", `/api/recurring-expense-templates/${template!.id}`, data)
    },
    onSuccess: () => {
      toast({ title: mode === "create" ? "✅ 已新增" : "✅ 已更新" })
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expense-templates"] })
      onClose()
    },
    onError: (err: Error) =>
      toast({ title: "失敗", description: err.message, variant: "destructive" }),
  })

  const canSubmit = name.trim() && amount && parseFloat(amount) > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新增" : "編輯"}週期性支出模板</DialogTitle>
          <DialogDescription>
            設定每月固定支出，scheduler 會在每月 1-3 號自動產出 unpaid 待確認項目
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div>
            <Label>模板名稱 *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：洗滌費 - 浯島文旅"
            />
          </div>

          <div>
            <Label>估算金額 *</Label>
            <div className="relative">
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8"
                placeholder="0"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">產出後在付款管理可改實際金額</p>
          </div>

          <div>
            <Label>所屬專案</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇專案" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">（不指定）</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>每月幾號到期</Label>
              <Input
                type="number"
                min={1}
                max={28}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 10)}
              />
            </div>
            <div>
              <Label>生效月份</Label>
              <Input
                value={activeMonths}
                onChange={(e) => setActiveMonths(e.target.value)}
                placeholder="* 或 1,3,6,9"
              />
              <p className="text-xs text-gray-500 mt-0.5">
                <code>*</code> 全部月 / <code>1,3,6</code> 指定月
              </p>
            </div>
          </div>

          <div>
            <Label>備註</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="（選填）"
            />
          </div>

          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <Label htmlFor="active-switch">啟用（停用後 scheduler 不會自動產出）</Label>
            <Switch id="active-switch" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSubmit || saveMutation.isPending}
          >
            {mode === "create" ? "新增" : "更新"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
