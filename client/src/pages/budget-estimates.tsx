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
} from "lucide-react"
import { formatNT, friendlyApiError } from "@/lib/utils"

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

  // ── Preview query ──────────────────────────────
  const {
    data: preview,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<PreviewResponse>({
    queryKey: [`/api/budget/estimates/preview?year=${year}&month=${month}`],
  })

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

  // ── 分組顯示 ─────────────────────────────────────
  const grouped = groupByProject(preview?.items ?? [])

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
            <Button
              variant="outline"
              size="default"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              重新預覽
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 預覽結果 */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
            產生預覽中...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 text-red-800">
            <AlertCircle className="h-5 w-5 inline mr-1" />
            載入失敗：{friendlyApiError(error as Error)}
          </CardContent>
        </Card>
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
