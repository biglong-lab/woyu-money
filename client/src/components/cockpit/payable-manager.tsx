/**
 * 應付款整理（駕駛艙頁內面板，不跳頁）
 *
 * 顯示所有應付款（9類別5維度優先級引擎排序），可就地：
 * - 標記已付（重用 MarkPaidConfirmDialog → POST /api/payment/items/:id/payments）
 * - 依緊急度篩選、關鍵字搜尋
 * 全程不離開駕駛艙。
 */
import { useMemo, useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MarkPaidConfirmDialog, type MarkPaidPayload } from "@/components/mark-paid-confirm-dialog"
import { CheckCircle2, Search } from "lucide-react"

type UrgencyLevel = "critical" | "high" | "medium" | "low"
interface PriorityItem {
  id: number
  itemName: string
  unpaidAmount: number
  dueDate: string
  categoryLabel: string
  daysOverdue: number
  daysUntilDue: number
  urgency: UrgencyLevel
  lateFeeEstimate: number
  dailyLateFee: number
  projectName?: string
}
interface PriorityReport {
  totalUnpaid: number
  counts: Record<UrgencyLevel, number>
  all: PriorityItem[]
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

const URGENCY: Record<UrgencyLevel, { label: string; cls: string }> = {
  critical: { label: "🔴 立刻付", cls: "bg-red-100 text-red-800" },
  high: { label: "🟠 本週付", cls: "bg-orange-100 text-orange-800" },
  medium: { label: "🟡 可延後", cls: "bg-yellow-100 text-yellow-800" },
  low: { label: "⚪ 可推後", cls: "bg-gray-100 text-gray-600" },
}

const FILTERS: Array<{ value: UrgencyLevel | "all"; label: string }> = [
  { value: "all", label: "全部" },
  { value: "critical", label: "立刻付" },
  { value: "high", label: "本週付" },
  { value: "medium", label: "可延後" },
  { value: "low", label: "可推後" },
]

export function PayableManager() {
  const { toast } = useToast()
  const [filter, setFilter] = useState<UrgencyLevel | "all">("all")
  const [search, setSearch] = useState("")
  const [paying, setPaying] = useState<PriorityItem | null>(null)

  const { data: report, isLoading } = useQuery<PriorityReport>({
    queryKey: ["/api/payment/priority-report?includeLow=true"],
  })

  const items = useMemo(() => {
    let list = report?.all ?? []
    if (filter !== "all") list = list.filter((i) => i.urgency === filter)
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      list = list.filter(
        (i) =>
          i.itemName.toLowerCase().includes(s) ||
          i.categoryLabel.toLowerCase().includes(s) ||
          (i.projectName ?? "").toLowerCase().includes(s)
      )
    }
    return list
  }, [report, filter, search])

  const markPaid = useMutation({
    mutationFn: (payload: { id: number } & MarkPaidPayload) =>
      apiRequest("POST", `/api/payment/items/${payload.id}/payments`, {
        amountPaid: payload.amountPaid,
        paymentDate: payload.paymentDate,
        receiptUrl: payload.receiptUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          ["/api/payment", "/api/cashflow", "/api/dashboard"].some((p) =>
            String(q.queryKey[0]).startsWith(p)
          ),
      })
      toast({ title: "已標記付款" })
      setPaying(null)
    },
    onError: (e: Error) =>
      toast({ title: "標記失敗", description: e.message, variant: "destructive" }),
  })

  return (
    <div className="space-y-3">
      {/* 篩選列 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              {f.value !== "all" && report ? `（${report.counts[f.value as UrgencyLevel]}）` : ""}
            </Button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋項目/類別/館別"
            className="pl-8 w-52"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">載入中…</p>
      ) : items.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">沒有符合條件的應付款</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${URGENCY[item.urgency].cls}`}>
                      {URGENCY[item.urgency].label}
                    </span>
                    <span className="font-medium truncate">{item.itemName}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.categoryLabel}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {item.daysOverdue > 0
                      ? `已逾期 ${item.daysOverdue} 天`
                      : `${item.daysUntilDue} 天後到期`}
                    {item.dailyLateFee > 0 && ` · 每天 +${fmt(item.dailyLateFee)} 滯納金`}
                    {item.projectName && ` · ${item.projectName}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="font-bold">{fmt(item.unpaidAmount)}</div>
                    {item.lateFeeEstimate > 0 && (
                      <div className="text-xs text-red-500">滯納 +{fmt(item.lateFeeEstimate)}</div>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setPaying(item)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> 標記已付
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {paying && (
        <MarkPaidConfirmDialog
          open={!!paying}
          onOpenChange={(o) => !o && setPaying(null)}
          itemName={paying.itemName}
          defaultAmount={paying.unpaidAmount}
          description={paying.categoryLabel}
          isPending={markPaid.isPending}
          onConfirm={(payload) => markPaid.mutate({ id: paying.id, ...payload })}
        />
      )}
    </div>
  )
}
