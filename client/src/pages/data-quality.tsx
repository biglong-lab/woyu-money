/**
 * 資料品質中心（PR-10）
 *
 * 統一查看 4 類資料問題，提供逐筆編輯/刪除的快速通道。
 */

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Trash2, AlertTriangle, Calendar, DollarSign, Clock, Copy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { formatNT } from "@/lib/utils"

interface PaymentBrief {
  id: number
  itemName: string | null
  projectName: string | null
  totalAmount: number
  startDate: string | null
  status: string | null
  createdAt: string | null
}

interface DuplicateGroup {
  projectName: string | null
  yearMonth: string
  totalAmount: number
  count: number
  ids: number[]
  names: string
}

interface DataQualityReport {
  generatedAt: string
  missingDueDate: { count: number; items: PaymentBrief[] }
  zeroAmount: { count: number; items: PaymentBrief[] }
  zombies: { count: number; items: PaymentBrief[] }
  duplicates: { count: number; groups: DuplicateGroup[] }
}

export default function DataQualityPage() {
  useDocumentTitle("資料品質中心")
  const { toast } = useToast()
  const [confirmDelete, setConfirmDelete] = useState<{ ids: number[]; label: string } | null>(null)

  const { data, isLoading } = useQuery<DataQualityReport>({
    queryKey: ["/api/admin/data-quality"],
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const errors: string[] = []
      for (const id of ids) {
        try {
          await apiRequest("DELETE", `/api/payment/items/${id}`)
        } catch (e) {
          errors.push(`#${id}: ${(e as Error).message}`)
        }
      }
      return errors
    },
    onSuccess: (errors) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/data-quality"] })
      void queryClient.invalidateQueries({
        queryKey: ["/api/payment/priority-report?includeLow=false"],
      })
      if (errors.length === 0) {
        toast({ title: "已刪除" })
      } else {
        toast({
          title: "部分失敗",
          description: errors.slice(0, 3).join("\n"),
          variant: "destructive",
        })
      }
      setConfirmDelete(null)
    },
  })

  if (isLoading || !data) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  const totalIssues =
    data.missingDueDate.count + data.zeroAmount.count + data.zombies.count + data.duplicates.count

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">資料品質中心</h1>
        <p className="text-sm text-muted-foreground">偵測 4 類常見資料問題，協助維護系統健康度</p>
      </div>

      {/* 摘要卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <SummaryCard
          icon={<Calendar className="h-4 w-4" />}
          label="缺到期日"
          count={data.missingDueDate.count}
          color="amber"
        />
        <SummaryCard
          icon={<DollarSign className="h-4 w-4" />}
          label="金額異常"
          count={data.zeroAmount.count}
          color="orange"
        />
        <SummaryCard
          icon={<Clock className="h-4 w-4" />}
          label="殭屍項目"
          count={data.zombies.count}
          color="gray"
        />
        <SummaryCard
          icon={<Copy className="h-4 w-4" />}
          label="重複組"
          count={data.duplicates.count}
          color="red"
        />
      </div>

      {totalIssues === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            ✅ 系統資料健康，沒有偵測到問題
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="missing">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="missing">
              缺到期日{data.missingDueDate.count > 0 ? ` (${data.missingDueDate.count})` : ""}
            </TabsTrigger>
            <TabsTrigger value="zero">
              金額異常{data.zeroAmount.count > 0 ? ` (${data.zeroAmount.count})` : ""}
            </TabsTrigger>
            <TabsTrigger value="zombie">
              殭屍項目{data.zombies.count > 0 ? ` (${data.zombies.count})` : ""}
            </TabsTrigger>
            <TabsTrigger value="dup">
              重複組{data.duplicates.count > 0 ? ` (${data.duplicates.count})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="missing">
            <IssueList
              title="缺到期日的項目"
              desc="這些項目沒有 start_date，無法計算逾期或顯示在排程"
              items={data.missingDueDate.items}
              onDelete={(id, label) => setConfirmDelete({ ids: [id], label })}
            />
          </TabsContent>

          <TabsContent value="zero">
            <IssueList
              title="金額為 0 或負數的項目"
              desc="這些項目可能是試建後忘了刪除，影響統計"
              items={data.zeroAmount.items}
              onDelete={(id, label) => setConfirmDelete({ ids: [id], label })}
            />
          </TabsContent>

          <TabsContent value="zombie">
            <IssueList
              title="殭屍項目（>1 年無付款記錄）"
              desc="建立超過 1 年、status pending、從未有付款記錄的項目"
              items={data.zombies.items}
              onDelete={(id, label) => setConfirmDelete({ ids: [id], label })}
            />
          </TabsContent>

          <TabsContent value="dup">
            <DuplicateList
              groups={data.duplicates.groups}
              onCleanup={(ids, label) => setConfirmDelete({ ids, label })}
            />
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認軟刪除</AlertDialogTitle>
            <AlertDialogDescription>{confirmDelete?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.ids)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "處理中…" : "確認刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─────────────────────────────────────────────
// 摘要卡
// ─────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode
  label: string
  count: number
  color: "amber" | "orange" | "gray" | "red"
}) {
  const cls = {
    amber: count > 0 ? "bg-amber-50 border-amber-200 text-amber-800" : "",
    orange: count > 0 ? "bg-orange-50 border-orange-200 text-orange-800" : "",
    gray: count > 0 ? "bg-gray-50 border-gray-200 text-gray-700" : "",
    red: count > 0 ? "bg-red-50 border-red-200 text-red-800" : "",
  }[color]
  return (
    <Card className={cls}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-bold mt-1">{count}</div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 一般問題列表
// ─────────────────────────────────────────────

function IssueList({
  title,
  desc,
  items,
  onDelete,
}: {
  title: string
  desc: string
  items: PaymentBrief[]
  onDelete: (id: number, label: string) => void
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          ✅ 此類無問題
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex items-center justify-between gap-2 rounded border p-2 bg-white"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{it.itemName ?? "(未命名)"}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                #{it.id} · {it.projectName ?? "—"} · {formatNT(it.totalAmount)}
                {it.startDate && ` · ${it.startDate}`}
                {it.createdAt && ` · 建於 ${it.createdAt.slice(0, 10)}`}
                {it.status && (
                  <Badge variant="outline" className="ml-1 text-[10px] py-0 h-4">
                    {it.status}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={() =>
                onDelete(it.id, `將軟刪除「${it.itemName}」（金額 ${formatNT(it.totalAmount)}）`)
              }
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              軟刪除
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 重複組列表
// ─────────────────────────────────────────────

function DuplicateList({
  groups,
  onCleanup,
}: {
  groups: DuplicateGroup[]
  onCleanup: (ids: number[], label: string) => void
}) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          ✅ 沒有重複組
        </CardContent>
      </Card>
    )
  }

  // 全部一鍵清理：每組保留 id 最小，刪其餘
  const allToDelete = groups.flatMap((g) => g.ids.slice(1))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span>重複組（同專案 + 同月份 + 同金額）</span>
          {allToDelete.length > 0 && (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() =>
                onCleanup(
                  allToDelete,
                  `將軟刪除 ${allToDelete.length} 筆冗餘項目（每組保留 id 最小者）`
                )
              }
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              一鍵清理 {allToDelete.length} 筆
            </Button>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          建議保留每組 id 最小者（早期建立、命名通常較完整）
        </p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {groups.map((g, idx) => (
          <div
            key={`${g.projectName}-${g.yearMonth}-${idx}`}
            className="rounded border p-2 bg-amber-50"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {g.projectName} · {g.yearMonth} · {formatNT(g.totalAmount)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  IDs: {g.ids.join(", ")} · {g.count} 筆
                </div>
                <div className="text-xs text-amber-800 mt-0.5 truncate">{g.names}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:bg-red-50"
                onClick={() =>
                  onCleanup(
                    g.ids.slice(1),
                    `將軟刪除 #${g.ids.slice(1).join(", #")}（保留 #${g.ids[0]}）`
                  )
                }
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                清理 {g.count - 1} 筆
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
