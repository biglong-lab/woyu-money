/**
 * 統一分類管理頁（PR-3）
 *
 * 取代舊 5 頁分類管理（fixed-categories、project-categories、household-categories、
 *                debt-categories、project-category-templates）。
 *
 * 結構：
 *   - 上方：摘要 + 重複偵測面板（折疊）
 *   - 主內容：左列表 + 右詳細
 *
 * 功能：
 *   - 列表：顯示 usedCount、isInUse badge、isDeleted 灰色
 *   - 編輯：改名、改描述、改類型
 *   - 合併：選 from + to → 預覽影響範圍 → 執行
 *   - 軟刪除：標記 is_deleted=true
 *   - 重複偵測：列出名字相同（不分大小寫）的分類群組，建議保留 usedCount 高者
 */

import { useMemo, useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Edit,
  GitMerge,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Search,
  ChevronRight,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useDocumentTitle } from "@/hooks/use-document-title"

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface UnifiedCategory {
  id: number
  categoryName: string | null
  categoryType: string | null
  description: string | null
  isDeleted: boolean
  createdAt: string | null
  usedCount: number
  lastUsedAt: string | null
  budgetCount: number
  isInUse: boolean
}

interface MergeResult {
  success: boolean
  sourceId: number
  targetId: number
  paymentItemsMoved: number
  budgetItemsMoved: number
  message: string
}

interface ArchiveUnusedDryRunResult {
  dryRun: boolean
  candidatesCount?: number
  archivedCount?: number
  candidates?: { id: number; categoryName: string | null; createdAt: string | null }[]
  archived?: { id: number; categoryName: string | null; createdAt: string | null }[]
  message: string
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function typeLabel(t: string | null): string {
  switch (t) {
    case "project":
      return "專案"
    case "household":
      return "家庭"
    case "debt":
      return "債務"
    default:
      return t ?? "未分"
  }
}

function formatDate(s: string | null): string {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleDateString("zh-TW")
  } catch {
    return s
  }
}

// ─────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────

export default function CategoriesUnifiedPage() {
  useDocumentTitle("分類管理")
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("active") // all / active / unused / deleted
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // ─── Query: 取所有分類（含使用統計）───
  const { data: categories = [], isLoading } = useQuery<UnifiedCategory[]>({
    queryKey: ["/api/categories/unified"],
  })

  // ─── 篩選 / 搜尋 ───
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return categories.filter((c) => {
      if (filterType !== "all" && c.categoryType !== filterType) return false
      if (filterStatus === "active" && c.isDeleted) return false
      if (filterStatus === "deleted" && !c.isDeleted) return false
      if (filterStatus === "unused" && (c.isInUse || c.isDeleted)) return false
      if (s && !(c.categoryName?.toLowerCase().includes(s) ?? false)) return false
      return true
    })
  }, [categories, search, filterType, filterStatus])

  const selected = useMemo(
    () => categories.find((c) => c.id === selectedId) ?? null,
    [categories, selectedId]
  )

  // ─── 重複偵測（名字相同，不分大小寫） ───
  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, UnifiedCategory[]>()
    for (const c of categories) {
      if (c.isDeleted || !c.categoryName) continue
      const key = c.categoryName.trim().toLowerCase()
      if (!key) continue
      const arr = groups.get(key) ?? []
      arr.push(c)
      groups.set(key, arr)
    }
    return Array.from(groups.entries())
      .filter(([, arr]) => arr.length > 1)
      .map(([name, arr]) => ({
        name,
        items: arr.sort((a, b) => b.usedCount - a.usedCount),
      }))
  }, [categories])

  // ─── 統計摘要 ───
  const stats = useMemo(() => {
    const total = categories.length
    const active = categories.filter((c) => !c.isDeleted).length
    const inUse = categories.filter((c) => !c.isDeleted && c.isInUse).length
    const unused = categories.filter((c) => !c.isDeleted && !c.isInUse).length
    const deleted = categories.filter((c) => c.isDeleted).length
    return { total, active, inUse, unused, deleted }
  }, [categories])

  // ─── Mutations ───
  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: number
      categoryName: string
      categoryType: string
      description: string
    }) => {
      return await apiRequest("PUT", `/api/categories/${payload.id}`, {
        categoryName: payload.categoryName,
        categoryType: payload.categoryType,
        description: payload.description || null,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/categories/unified"] })
      toast({ title: "更新成功" })
      setEditOpen(false)
    },
    onError: (e: Error) => {
      toast({ title: "更新失敗", description: e.message, variant: "destructive" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/categories/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/categories/unified"] })
      toast({ title: "已軟刪除" })
      setDeleteOpen(false)
      setSelectedId(null)
    },
    onError: (e: Error) => {
      toast({ title: "刪除失敗", description: e.message, variant: "destructive" })
    },
  })

  const mergeMutation = useMutation({
    mutationFn: async (payload: { sourceId: number; targetId: number }) => {
      return await apiRequest<MergeResult>("POST", `/api/categories/${payload.sourceId}/merge`, {
        targetId: payload.targetId,
      })
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/categories/unified"] })
      toast({
        title: "合併完成",
        description: res.message,
      })
      setMergeOpen(false)
    },
    onError: (e: Error) => {
      toast({ title: "合併失敗", description: e.message, variant: "destructive" })
    },
  })

  const archiveUnusedMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      return await apiRequest<ArchiveUnusedDryRunResult>("POST", `/api/categories/archive-unused`, {
        dryRun,
      })
    },
    onSuccess: (res) => {
      if (res.dryRun) {
        toast({
          title: `dryRun：${res.candidatesCount ?? 0} 筆可清理`,
          description: res.message,
        })
      } else {
        void queryClient.invalidateQueries({ queryKey: ["/api/categories/unified"] })
        toast({ title: "已清理", description: res.message })
      }
    },
    onError: (e: Error) => {
      toast({ title: "操作失敗", description: e.message, variant: "destructive" })
    },
  })

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* 標題 + 操作 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">分類管理</h1>
          <p className="text-sm text-muted-foreground">
            統一管理所有費用分類（取代舊 5 頁分散管理）
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => archiveUnusedMutation.mutate(true)}
            disabled={archiveUnusedMutation.isPending}
          >
            <Inbox className="h-4 w-4 mr-1" /> 清理長期未用（預覽）
          </Button>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <StatCard label="總分類" value={stats.total} />
        <StatCard label="啟用中" value={stats.active} variant="default" />
        <StatCard label="使用中" value={stats.inUse} variant="success" />
        <StatCard label="未使用" value={stats.unused} variant="warning" />
        <StatCard label="已刪除" value={stats.deleted} variant="muted" />
      </div>

      {/* 重複偵測 */}
      {duplicateGroups.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              發現 {duplicateGroups.length} 組重複名稱（建議合併）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {duplicateGroups.map((g) => {
              const top = g.items[0]
              const rest = g.items.slice(1)
              return (
                <div
                  key={g.name}
                  className="flex items-center justify-between gap-2 p-2 rounded border bg-white text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{top.categoryName}</div>
                    <div className="text-xs text-muted-foreground">
                      建議保留 #{top.id}（用 {top.usedCount} 次）→ 合併{" "}
                      {rest.map((r) => `#${r.id}（${r.usedCount}）`).join("、")}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {rest.map((r) => (
                      <Button
                        key={r.id}
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          mergeMutation.mutate({ sourceId: r.id, targetId: top.id })
                        }}
                        disabled={mergeMutation.isPending}
                      >
                        合併 #{r.id} → #{top.id}
                      </Button>
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* 搜尋 + 篩選 */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="搜尋分類名稱…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部類型</SelectItem>
            <SelectItem value="project">專案</SelectItem>
            <SelectItem value="household">家庭</SelectItem>
            <SelectItem value="debt">債務</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">啟用中</SelectItem>
            <SelectItem value="unused">未使用</SelectItem>
            <SelectItem value="deleted">已刪除</SelectItem>
            <SelectItem value="all">全部</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 主內容：列表 + 詳細 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 左：列表 */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              分類列表 <span className="text-sm text-muted-foreground">({filtered.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">載入中…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">無資料</div>
            ) : (
              <div className="divide-y max-h-[60vh] overflow-y-auto">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors ${
                      selectedId === c.id ? "bg-accent" : ""
                    } ${c.isDeleted ? "opacity-60" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{c.categoryName ?? "(未命名)"}</span>
                        <Badge variant="outline" className="text-xs">
                          {typeLabel(c.categoryType)}
                        </Badge>
                        {c.isDeleted && (
                          <Badge variant="secondary" className="text-xs">
                            已刪除
                          </Badge>
                        )}
                        {!c.isDeleted && c.isInUse && (
                          <Badge className="text-xs bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="h-3 w-3 mr-0.5" />
                            使用中
                          </Badge>
                        )}
                        {!c.isDeleted && !c.isInUse && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            未使用
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        #{c.id} · 付款 {c.usedCount} · 預算 {c.budgetCount} · 最後使用{" "}
                        {formatDate(c.lastUsedAt)}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 右：詳細 + 動作 */}
        <Card className="md:sticky md:top-4 md:self-start">
          <CardHeader>
            <CardTitle className="text-base">
              {selected ? selected.categoryName : "選擇分類"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-muted-foreground">從左側點選一個分類以查看詳情</p>
            ) : (
              <div className="space-y-3 text-sm">
                <DetailRow label="ID" value={`#${selected.id}`} />
                <DetailRow label="類型" value={typeLabel(selected.categoryType)} />
                <DetailRow
                  label="狀態"
                  value={selected.isDeleted ? "已刪除" : selected.isInUse ? "使用中" : "未使用"}
                />
                <DetailRow label="付款項目數" value={String(selected.usedCount)} />
                <DetailRow label="預算項目數" value={String(selected.budgetCount)} />
                <DetailRow label="最後使用" value={formatDate(selected.lastUsedAt)} />
                <DetailRow label="建立時間" value={formatDate(selected.createdAt)} />
                {selected.description && <DetailRow label="描述" value={selected.description} />}

                <div className="pt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditOpen(true)}
                    disabled={selected.isDeleted}
                  >
                    <Edit className="h-4 w-4 mr-1" /> 編輯
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMergeOpen(true)}
                    disabled={selected.isDeleted}
                  >
                    <GitMerge className="h-4 w-4 mr-1" /> 合併
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                    disabled={selected.isDeleted}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> 軟刪除
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 編輯對話框 */}
      {selected && (
        <EditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          category={selected}
          onSubmit={(data) =>
            updateMutation.mutate({
              id: selected.id,
              ...data,
            })
          }
          isPending={updateMutation.isPending}
        />
      )}

      {/* 合併對話框 */}
      {selected && (
        <MergeDialog
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          source={selected}
          allCategories={categories}
          onSubmit={(targetId) => mergeMutation.mutate({ sourceId: selected.id, targetId })}
          isPending={mergeMutation.isPending}
        />
      )}

      {/* 軟刪除確認 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認軟刪除？</AlertDialogTitle>
            <AlertDialogDescription>
              {selected?.isInUse
                ? `此分類有 ${selected.usedCount} 筆付款項目和 ${selected.budgetCount} 筆預算項目使用中。軟刪除不會影響既有資料，但分類將不再出現在新增表單。`
                : "軟刪除後分類將不再出現在新增表單，可從回收站恢復。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selected) deleteMutation.mutate(selected.id)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─────────────────────────────────────────────
// 子元件：StatCard
// ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  variant = "default",
}: {
  label: string
  value: number
  variant?: "default" | "success" | "warning" | "muted"
}) {
  const variantClass = {
    default: "text-foreground",
    success: "text-green-700",
    warning: "text-amber-700",
    muted: "text-muted-foreground",
  }[variant]
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${variantClass}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────
// 子元件：EditDialog
// ─────────────────────────────────────────────

function EditDialog({
  open,
  onOpenChange,
  category,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  category: UnifiedCategory
  onSubmit: (data: { categoryName: string; categoryType: string; description: string }) => void
  isPending: boolean
}) {
  const [name, setName] = useState(category.categoryName ?? "")
  const [type, setType] = useState(category.categoryType ?? "project")
  const [desc, setDesc] = useState(category.description ?? "")

  // 重置表單當分類切換
  useMemo(() => {
    setName(category.categoryName ?? "")
    setType(category.categoryType ?? "project")
    setDesc(category.description ?? "")
  }, [category])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>編輯分類 #{category.id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">名稱</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">類型</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project">專案</SelectItem>
                <SelectItem value="household">家庭</SelectItem>
                <SelectItem value="debt">債務</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">描述</label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="（選填）"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button
            onClick={() => onSubmit({ categoryName: name, categoryType: type, description: desc })}
            disabled={isPending || !name.trim()}
          >
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────
// 子元件：MergeDialog
// ─────────────────────────────────────────────

function MergeDialog({
  open,
  onOpenChange,
  source,
  allCategories,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  source: UnifiedCategory
  allCategories: UnifiedCategory[]
  onSubmit: (targetId: number) => void
  isPending: boolean
}) {
  const [targetId, setTargetId] = useState<string>("")

  const candidates = useMemo(() => {
    return allCategories
      .filter((c) => !c.isDeleted && c.id !== source.id)
      .sort((a, b) => {
        // 優先：同類型 → 同名（不分大小寫）→ 高使用度
        if (a.categoryType === source.categoryType && b.categoryType !== source.categoryType)
          return -1
        if (b.categoryType === source.categoryType && a.categoryType !== source.categoryType)
          return 1
        const sourceName = source.categoryName?.toLowerCase() ?? ""
        const aMatch = a.categoryName?.toLowerCase() === sourceName
        const bMatch = b.categoryName?.toLowerCase() === sourceName
        if (aMatch && !bMatch) return -1
        if (bMatch && !aMatch) return 1
        return b.usedCount - a.usedCount
      })
  }, [allCategories, source])

  const target = useMemo(
    () => allCategories.find((c) => c.id === Number(targetId)) ?? null,
    [allCategories, targetId]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <GitMerge className="h-5 w-5 inline mr-1" />
            合併分類
          </DialogTitle>
          <DialogDescription>
            來源分類的所有付款項目與預算項目將改連到目標分類，來源會被軟刪除。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="p-3 rounded border bg-muted/50">
            <div className="text-xs text-muted-foreground">來源（將被軟刪除）</div>
            <div className="font-medium flex items-center gap-2 mt-0.5">
              <span>{source.categoryName}</span>
              <Badge variant="outline">{typeLabel(source.categoryType)}</Badge>
              <span className="text-xs text-muted-foreground">
                #{source.id} · 付款 {source.usedCount} · 預算 {source.budgetCount}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">合併到</label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇目標分類" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.categoryName}（{typeLabel(c.categoryType)}, 使用 {c.usedCount}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {target && (
            <div className="p-3 rounded border bg-blue-50/50 text-sm">
              <div className="font-medium mb-1">影響範圍預覽</div>
              <div className="space-y-0.5 text-muted-foreground">
                <div>
                  • <span className="font-mono">{source.usedCount}</span> 筆付款項目改連到{" "}
                  <span className="font-medium text-foreground">{target.categoryName}</span>
                </div>
                <div>
                  • <span className="font-mono">{source.budgetCount}</span> 筆預算項目改連到{" "}
                  <span className="font-medium text-foreground">{target.categoryName}</span>
                </div>
                <div>
                  • <span className="font-medium">{source.categoryName}</span>{" "}
                  將被軟刪除（資料保留可從回收站恢復）
                </div>
              </div>
              {source.categoryType !== target.categoryType && (
                <div className="mt-2 text-amber-700 text-xs flex items-start gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    類型不同（{typeLabel(source.categoryType)} → {typeLabel(target.categoryType)}
                    ），合併後資料會跨類型混合，請確認。
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button onClick={() => target && onSubmit(target.id)} disabled={isPending || !target}>
            {isPending ? "合併中…" : "確認合併"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
