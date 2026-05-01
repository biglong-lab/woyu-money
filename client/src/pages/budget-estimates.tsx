/**
 * 月度預估管理（PR-3 UI）
 *
 * 工作流：
 * 1. 選年/月 → 自動載入「預覽」（叫 /preview API）
 * 2. 用戶看預覽（依類型分組）
 * 3. 點「✅ 確認建立」→ 寫入 DB
 * 4. 顯示成功訊息 + 連到該預估表
 *
 * 設計原則：
 * - 一鍵搞定 80% 自動可推算的項目（租金 + 預估型）
 * - 剩下 20% 後續手動加（佔用、共用、零星）
 * - 預覽優先，避免誤建
 */

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sparkles,
  Calendar,
  RefreshCw,
  Building2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Lock,
  ChevronDown,
  ChevronUp,
  Plus,
  Users,
} from "lucide-react"
import { formatNT, friendlyApiError } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  allocateCost,
  type AllocationRule,
  type PropertyGroupMemberInput,
} from "@shared/cost-allocation"

interface PreviewItem {
  fixedCategoryId: number | null
  categoryName: string
  itemName: string
  attribution: "single" | "shared" | "occupancy" | "company"
  targetProjectId: number | null
  targetProjectName: string | null
  plannedAmount: number
  basis: string
}

// 已建立 plan 的檢視模式項目
interface PlanItemView {
  id: number
  itemName: string
  attribution: string
  targetProjectId: number | null
  projectName: string | null
  categoryName: string | null
  plannedAmount: number
  actualAmount: number
  variance: number
  variancePercentage: number
  completionPercentage: number
  notes: string | null
}

interface PlanByMonthResponse {
  exists: boolean
  planId?: number
  year: number
  month: number
  planName?: string
  status?: string
  totals?: {
    planned: number
    actual: number
    variance: number
    completionPercent: number
  }
  items?: PlanItemView[]
}

interface PropertyGroupMember {
  id: number
  groupId: number
  projectId: number
  projectName: string | null
  weight: string
}

interface PropertyGroup {
  id: number
  name: string
  description: string | null
  isActive: boolean
  members: PropertyGroupMember[]
}

interface FixedCategory {
  id: number
  categoryName: string
  isActive: boolean | null
}

interface PreviewResponse {
  year: number
  month: number
  itemCount: number
  totalBudget: number
  items: PreviewItem[]
}

interface GenerateResponse extends PreviewResponse {
  planId: number
  breakdown: { rental: number; variable: number }
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function BudgetEstimates() {
  useDocumentTitle("月度預估")
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [sharedDialogOpen, setSharedDialogOpen] = useState(false)

  // ── 1. 先檢查該月是否已有 plan ────────────────────
  const { data: planData, isLoading: planLoading } = useQuery<PlanByMonthResponse>({
    queryKey: [`/api/budget/plans/by-month?year=${year}&month=${month}`],
  })

  const planExists = planData?.exists === true

  // ── 2. 沒 plan 才跑 preview ────────────────────
  const {
    data: preview,
    isLoading: previewLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<PreviewResponse>({
    queryKey: [`/api/budget/estimates/preview?year=${year}&month=${month}`],
    enabled: planData !== undefined && !planExists,
  })

  const isLoading = planLoading || (planExists === false && previewLoading)

  // ── Generate mutation ─────────────────────────
  const generateMutation = useMutation<GenerateResponse, Error, { force: boolean }>({
    mutationFn: async ({ force }) => {
      return (await apiRequest("POST", "/api/budget/estimates/auto-generate", {
        year,
        month,
        force,
      })) as GenerateResponse
    },
    onSuccess: (data) => {
      toast({
        title: "預估表已建立",
        description: `${data.itemCount} 筆項目，總額 ${formatNT(data.totalBudget)}`,
      })
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans"] })
      // 重要：重新查 plan 狀態，自動切換到「檢視模式」
      queryClient.invalidateQueries({
        queryKey: [`/api/budget/plans/by-month?year=${year}&month=${month}`],
      })
    },
    onError: (e: Error) => {
      const msg = friendlyApiError(e)
      const isConflict = msg.includes("409") || msg.includes("已存在")
      toast({
        title: isConflict ? "該月預估已存在" : "建立失敗",
        description: isConflict ? "如要重建，請點「強制重建」按鈕" : msg,
        variant: "destructive",
      })
    },
  })

  // ── 重新整理 plan 資料（提供給 invalidate）────
  const refreshPlan = () => {
    queryClient.invalidateQueries({
      queryKey: [`/api/budget/plans/by-month?year=${year}&month=${month}`],
    })
  }

  // ── 分組顯示 ─────────────────────────────────────
  const grouped = groupByProject(preview?.items ?? [])
  const planGrouped = groupPlanByProject(planData?.items ?? [])

  const toggleCollapsed = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-purple-600" />
          月度預估自動產生
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          一鍵根據合約 + 過去 6 個月平均，自動產生整月預估表
        </p>
      </div>

      {/* 年月選擇 + 動作 */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">年</label>
                <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">月</label>
                <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} 月
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="default"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
                重新預覽
              </Button>
              <Button variant="outline" size="default" onClick={() => setSharedDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                新增共用費用
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 共用費用對話框 */}
      <SharedExpenseDialog
        open={sharedDialogOpen}
        onOpenChange={setSharedDialogOpen}
        year={year}
        month={month}
      />

      {/* 預覽結果 */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
            載入中...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 text-red-800">
            <AlertCircle className="h-5 w-5 inline mr-1" />
            載入失敗：{friendlyApiError(error as Error)}
          </CardContent>
        </Card>
      ) : planExists && planData?.totals && planData.items ? (
        // ─── 檢視模式（已建立）────────────────
        <PlanViewMode
          year={year}
          month={month}
          totals={planData.totals}
          grouped={planGrouped}
          collapsed={collapsed}
          toggleCollapsed={toggleCollapsed}
          onRebuild={() => {
            if (
              confirm(
                `確定要強制重建 ${year}/${month} 預估表？\n（會刪除舊預估的所有項目，包含已實際發生的記錄連結）`
              )
            )
              generateMutation.mutate({ force: true })
          }}
          onAddSharedExpense={() => setSharedDialogOpen(true)}
          isPending={generateMutation.isPending}
        />
      ) : (
        preview && (
          <>
            {/* 摘要卡 */}
            <Card className="mb-4 border-purple-200 bg-purple-50/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-purple-600" />
                      {year} 年 {month} 月預估摘要
                    </CardTitle>
                    <CardDescription className="mt-2 space-y-1">
                      <div>共產生 {preview.itemCount} 筆預估項目</div>
                      <div className="font-semibold text-foreground text-xl">
                        總額 {formatNT(preview.totalBudget)}
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => generateMutation.mutate({ force: false })}
                      disabled={generateMutation.isPending || preview.itemCount === 0}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      確認建立預估表
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (
                          confirm(
                            `確定要強制重建 ${year}/${month} 預估表？\n（會刪除舊預估的所有項目）`
                          )
                        )
                          generateMutation.mutate({ force: true })
                      }}
                      disabled={generateMutation.isPending || preview.itemCount === 0}
                    >
                      <Lock className="h-4 w-4 mr-1" />
                      強制重建
                    </Button>
                  </div>
                </div>
                {generateMutation.isPending && (
                  <div className="mt-3 text-sm text-purple-700 flex items-center gap-2">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    建立中...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 項目列表（按專案分組） */}
            {preview.itemCount === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>本月沒有可自動產生的預估項目</p>
                  <p className="text-xs mt-2">
                    沒有合約涵蓋此月份，且過去 6 個月也沒有歷史資料可參考。
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {grouped.map((group) => {
                  const isCollapsed = collapsed.has(group.key)
                  return (
                    <Card key={group.key}>
                      <CardHeader
                        className="pb-3 cursor-pointer hover:bg-muted/30"
                        onClick={() => toggleCollapsed(group.key)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Building2 className="h-5 w-5 text-blue-600" />
                            {group.title}
                            <Badge variant="outline">{group.items.length}</Badge>
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base">
                              {formatNT(group.subtotal)}
                            </span>
                            {isCollapsed ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      {!isCollapsed && (
                        <CardContent className="pt-0">
                          <div className="space-y-1.5">
                            {group.items.map((item, i) => (
                              <PreviewItemRow key={i} item={item} />
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}

            {/* 提示說明 */}
            <Card className="mt-4 border-blue-200 bg-blue-50/30">
              <CardContent className="pt-4 pb-4 text-sm text-blue-900 space-y-1">
                <div className="font-medium flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  自動產生策略
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-xs ml-1">
                  <li>租金：依 rental_contracts 合約金額（合約期外不產生）</li>
                  <li>其他費用：過去 6 個月該館該分類實際支出平均（已去極值）</li>
                  <li>沒有歷史資料的項目不會自動產生（避免空項目）</li>
                  <li>共用人事/洗滌、佔用驅動 PT 等需手動補（PR-3 後續）</li>
                </ul>
              </CardContent>
            </Card>
          </>
        )
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 子元件 / helpers
// ─────────────────────────────────────────────────────

interface ItemGroup {
  key: string
  title: string
  items: PreviewItem[]
  subtotal: number
}

function groupByProject(items: PreviewItem[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>()
  for (const item of items) {
    const key = item.targetProjectName ?? "（未歸屬）"
    if (!map.has(key)) {
      map.set(key, {
        key,
        title: key,
        items: [],
        subtotal: 0,
      })
    }
    const g = map.get(key)!
    g.items.push(item)
    g.subtotal += item.plannedAmount
  }
  return Array.from(map.values())
}

interface PlanItemGroup {
  key: string
  title: string
  items: PlanItemView[]
  plannedSubtotal: number
  actualSubtotal: number
  completionPercent: number
}

function groupPlanByProject(items: PlanItemView[]): PlanItemGroup[] {
  const map = new Map<string, PlanItemGroup>()
  for (const item of items) {
    const key = item.projectName ?? "（公司級 / 未歸屬）"
    if (!map.has(key)) {
      map.set(key, {
        key,
        title: key,
        items: [],
        plannedSubtotal: 0,
        actualSubtotal: 0,
        completionPercent: 0,
      })
    }
    const g = map.get(key)!
    g.items.push(item)
    g.plannedSubtotal += item.plannedAmount
    g.actualSubtotal += item.actualAmount
  }
  // 計算每組的完成度
  const result = Array.from(map.values())
  for (const g of result) {
    g.completionPercent =
      g.plannedSubtotal > 0 ? Math.round((g.actualSubtotal / g.plannedSubtotal) * 1000) / 10 : 0
  }
  return result
}

// ─────────────────────────────────────────────
// SharedExpenseDialog — 新增共用費用
// ─────────────────────────────────────────────

interface SharedExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  month: number
}

function SharedExpenseDialog({ open, onOpenChange, year, month }: SharedExpenseDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [groupId, setGroupId] = useState<string>("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [itemName, setItemName] = useState("")
  const [totalAmount, setTotalAmount] = useState("")
  const [rule, setRule] = useState<AllocationRule>("equal")

  // 取共用組
  const { data: groups = [] } = useQuery<PropertyGroup[]>({
    queryKey: ["/api/property-groups"],
    enabled: open,
  })

  // 取分類
  const { data: categories = [] } = useQuery<FixedCategory[]>({
    queryKey: ["/api/fixed-categories"],
    enabled: open,
  })

  const selectedGroup = groups.find((g) => String(g.id) === groupId)

  // 即時預覽分攤（client side 用純函式）
  const allocPreview = (() => {
    if (!selectedGroup || selectedGroup.members.length === 0) return null
    const amount = parseFloat(totalAmount)
    if (!Number.isFinite(amount) || amount < 0) return null
    try {
      const memberInputs: PropertyGroupMemberInput[] = selectedGroup.members.map((m) => ({
        projectId: m.projectId,
        weight: parseFloat(m.weight) || 1,
        // by_revenue 暫時不支援前端輸入，先給 0（會在 server 端拒絕）
        revenue: rule === "by_revenue" ? 0 : undefined,
      }))
      if (rule === "by_revenue") {
        // 提示：本對話框暫不支援 by_revenue（需要當月營收資料）
        return null
      }
      return allocateCost(amount, memberInputs, rule)
    } catch {
      return null
    }
  })()

  // 自動帶入分類名稱
  const handleCategoryChange = (v: string) => {
    setCategoryId(v)
    if (!itemName) {
      const cat = categories.find((c) => String(c.id) === v)
      if (cat) setItemName(`${year}/${month} ${cat.categoryName}（共用）`)
    }
  }

  const submit = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/budget/estimates/shared-item", {
        year,
        month,
        sharedGroupId: parseInt(groupId),
        fixedCategoryId: categoryId ? parseInt(categoryId) : undefined,
        itemName: itemName.trim(),
        totalAmount: parseFloat(totalAmount),
        allocationRule: rule,
      })
    },
    onSuccess: () => {
      toast({ title: "共用費用已建立並分攤" })
      onOpenChange(false)
      // 清空
      setGroupId("")
      setCategoryId("")
      setItemName("")
      setTotalAmount("")
      setRule("equal")
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans"] })
    },
    onError: (e: Error) =>
      toast({
        title: "建立失敗",
        description: friendlyApiError(e),
        variant: "destructive",
      }),
  })

  const canSubmit =
    groupId && itemName.trim().length > 0 && parseFloat(totalAmount) > 0 && rule !== "by_revenue" // by_revenue 暫不支援

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            新增共用費用 ({year}/{month})
          </DialogTitle>
          <DialogDescription>輸入共用費用總額後，系統會依規則分攤到各館</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>共用組 *</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇共用組" />
              </SelectTrigger>
              <SelectContent>
                {groups
                  .filter((g) => g.isActive && g.members.length > 0)
                  .map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}（{g.members.length} 個成員）
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {groups.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                尚無共用組。請先到「系統管理 → 館別共用組」建立
              </p>
            )}
          </div>

          <div>
            <Label>費用分類（選填）</Label>
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="選擇分類（如：人事費、洗滌費）" />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((c) => c.isActive !== false)
                  .map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.categoryName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>項目名稱 *</Label>
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={`例：${year}/${month} 人事費（共用）`}
            />
          </div>

          <div>
            <Label>總金額 *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                NT$
              </span>
              <Input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0"
                className="pl-12"
              />
            </div>
            {parseFloat(totalAmount) > 0 && (
              <p className="text-xs text-purple-700 mt-1 font-medium">
                = {formatNT(parseFloat(totalAmount))}
              </p>
            )}
          </div>

          <div>
            <Label>分攤規則 *</Label>
            <Select value={rule} onValueChange={(v) => setRule(v as AllocationRule)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">平均分攤（每館相同）</SelectItem>
                <SelectItem value="by_rooms">依房數比例（用權重）</SelectItem>
                <SelectItem value="manual">手動權重（用各成員 weight）</SelectItem>
                <SelectItem value="by_revenue" disabled>
                  依營收比例（暫不支援）
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 即時分攤預覽 */}
          {allocPreview && allocPreview.length > 0 && (
            <Card className="bg-purple-50/50 border-purple-200">
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-purple-800 mb-2">分攤預覽：</p>
                <div className="space-y-1.5">
                  {allocPreview.map((a) => {
                    const member = selectedGroup?.members.find((m) => m.projectId === a.projectId)
                    return (
                      <div key={a.projectId} className="flex justify-between text-sm">
                        <span>{member?.projectName ?? `Project ${a.projectId}`}</span>
                        <span className="font-medium">{formatNT(a.amount)}</span>
                      </div>
                    )
                  })}
                  <div className="pt-1.5 border-t border-purple-200 flex justify-between text-sm font-semibold">
                    <span>合計</span>
                    <span>{formatNT(allocPreview.reduce((s, a) => s + a.amount, 0))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => submit.mutate()} disabled={!canSubmit || submit.isPending}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {submit.isPending ? "建立中..." : "確認建立"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PreviewItemRow({ item }: { item: PreviewItem }) {
  return (
    <div className="flex items-start justify-between gap-2 p-2 rounded hover:bg-muted/40">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {item.categoryName}
          </Badge>
          <span className="text-sm font-medium truncate">{item.itemName}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{item.basis}</div>
      </div>
      <div className="font-semibold whitespace-nowrap">{formatNT(item.plannedAmount)}</div>
    </div>
  )
}

// ─────────────────────────────────────────────
// PlanViewMode — 已建立 plan 時的檢視模式
// ─────────────────────────────────────────────

interface PlanViewModeProps {
  year: number
  month: number
  totals: {
    planned: number
    actual: number
    variance: number
    completionPercent: number
  }
  grouped: PlanItemGroup[]
  collapsed: Set<string>
  toggleCollapsed: (key: string) => void
  onRebuild: () => void
  onAddSharedExpense: () => void
  isPending: boolean
}

function PlanViewMode({
  year,
  month,
  totals,
  grouped,
  collapsed,
  toggleCollapsed,
  onRebuild,
  isPending,
}: PlanViewModeProps) {
  return (
    <>
      {/* 摘要卡 */}
      <Card className="mb-4 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-700" />
                {year} 年 {month} 月預估表（已建立）
              </CardTitle>
              <CardDescription className="mt-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>整體完成度：</span>
                    <span className="font-medium">
                      {formatNT(totals.actual)} / {formatNT(totals.planned)}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        totals.completionPercent >= 100
                          ? "bg-red-500"
                          : totals.completionPercent >= 70
                            ? "bg-emerald-500"
                            : totals.completionPercent >= 30
                              ? "bg-yellow-400"
                              : "bg-blue-400"
                      }`}
                      style={{ width: `${Math.min(100, totals.completionPercent)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>完成 {totals.completionPercent}%</span>
                    <span
                      className={
                        totals.variance > 0
                          ? "text-red-700 font-semibold"
                          : totals.variance < 0
                            ? "text-emerald-700"
                            : ""
                      }
                    >
                      {totals.variance > 0 ? "超支 " : totals.variance < 0 ? "節省 " : ""}
                      {formatNT(Math.abs(totals.variance))}
                    </span>
                  </div>
                </div>
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={onRebuild} disabled={isPending}>
                <RefreshCw className="h-4 w-4 mr-1" />
                強制重建
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 各館分組 */}
      <div className="space-y-3">
        {grouped.map((group) => {
          const isCollapsed = collapsed.has(group.key)
          return (
            <Card key={group.key}>
              <CardHeader
                className="pb-3 cursor-pointer hover:bg-muted/30"
                onClick={() => toggleCollapsed(group.key)}
              >
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    {group.title}
                    <Badge variant="outline">{group.items.length}</Badge>
                    <Badge
                      variant="outline"
                      className={
                        group.completionPercent >= 100
                          ? "border-red-300 text-red-700"
                          : group.completionPercent >= 70
                            ? "border-emerald-300 text-emerald-700"
                            : "border-yellow-300 text-yellow-700"
                      }
                    >
                      {group.completionPercent}%
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {formatNT(group.actualSubtotal)} / {formatNT(group.plannedSubtotal)}
                    </span>
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
              {!isCollapsed && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <PlanItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* 提示 */}
      <Card className="mt-4 border-blue-200 bg-blue-50/30">
        <CardContent className="pt-4 pb-4 text-sm text-blue-900 space-y-1">
          <div className="font-medium flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            檢視模式說明
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-xs ml-1">
            <li>進度條顏色：藍 = 0-30%、黃 = 30-70%、綠 = 70-100%、紅 = 超支</li>
            <li>付款後系統會自動更新「實際金額」</li>
            <li>「強制重建」會刪除既有預估項目並重新自動產生（不影響 payment_records）</li>
            <li>看月底差異 → 「💡 財務助理 → 月度差異對賬」</li>
          </ul>
        </CardContent>
      </Card>
    </>
  )
}

// ─────────────────────────────────────────────
// PlanItemRow — 含進度條的 item 列
// ─────────────────────────────────────────────

function PlanItemRow({ item }: { item: PlanItemView }) {
  const isOverspent = item.completionPercentage > 100
  const isComplete = item.completionPercentage >= 100 && !isOverspent
  const isPartial = item.completionPercentage > 0 && item.completionPercentage < 100
  const isMissing = item.actualAmount === 0 && item.plannedAmount > 0

  return (
    <div className="p-2.5 rounded hover:bg-muted/40">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Badge variant="secondary" className="text-xs">
          {item.categoryName ?? "未分類"}
        </Badge>
        <span className="text-sm font-medium truncate flex-1">{item.itemName}</span>
        {item.attribution === "shared" && (
          <Badge variant="outline" className="text-[10px]">
            共用
          </Badge>
        )}
        {isOverspent && (
          <Badge variant="destructive" className="text-[10px]">
            超支 +{item.variancePercentage}%
          </Badge>
        )}
        {isComplete && (
          <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">
            ✅ 已完成
          </Badge>
        )}
        {isMissing && (
          <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-700">
            尚未發生
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              isOverspent
                ? "bg-red-500"
                : isComplete
                  ? "bg-emerald-500"
                  : isPartial
                    ? "bg-yellow-400"
                    : "bg-gray-300"
            }`}
            style={{ width: `${Math.min(100, item.completionPercentage)}%` }}
          />
        </div>
        <span className="text-muted-foreground whitespace-nowrap">
          {formatNT(item.actualAmount)} / {formatNT(item.plannedAmount)}
        </span>
      </div>
      {item.notes && <div className="text-xs text-muted-foreground mt-1">{item.notes}</div>}
    </div>
  )
}
