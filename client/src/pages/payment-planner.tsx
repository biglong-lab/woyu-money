/**
 * 一頁式排程分配規劃台（/payment-planner）
 *
 * 一頁顯示所有應付款 + 欠款，直接分類、安排時間（哪月付多少、可攤多月），
 * 自動加總每月需付金額，對照營運收入預測，跑出未來每月/每季/每年所需金額與缺口。
 *
 * 獨立規劃層（payment_plan_allocations），不動原始 dueDate，純沙盤、可逆。
 */
import { useMemo, useState } from "react"
import { Link } from "wouter"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { CalendarRange, Wand2, Search, ArrowLeft, AlertTriangle } from "lucide-react"

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────
type Urgency = "critical" | "high" | "medium" | "low"
interface PlanItem {
  id: number
  itemName: string
  categoryLabel: string
  urgency: Urgency
  unpaidAmount: number
  dueDate: string | null
  projectName: string | null
}
interface Allocation {
  id: number
  paymentItemId: number
  plannedMonth: string
  plannedAmount: number
}
interface PlannerData {
  items: PlanItem[]
  allocations: Allocation[]
  totalUnpaid: number
}
interface ForecastMonth {
  year: number
  month: number
  estimated: number
}
interface ForecastResponse {
  forecast: { months: ForecastMonth[] }
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
const URGENCY_DOT: Record<Urgency, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "⚪",
}

// 月份工具
function ymOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
function buildMonths(count: number): string[] {
  const now = new Date()
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(ymOf(new Date(now.getFullYear(), now.getMonth() + i, 1)))
  return out
}

type AggMode = "month" | "quarter" | "year"
interface ColGroup {
  key: string
  label: string
  months: string[]
}
function buildColumns(months: string[], mode: AggMode): ColGroup[] {
  if (mode === "month") {
    return months.map((m) => ({ key: m, label: m.replace("-", "/"), months: [m] }))
  }
  if (mode === "quarter") {
    const groups: ColGroup[] = []
    for (let i = 0; i < months.length; i += 3) {
      const chunk = months.slice(i, i + 3)
      const [y, mo] = chunk[0].split("-").map(Number)
      groups.push({ key: chunk[0], label: `${y} Q${Math.floor((mo - 1) / 3) + 1}`, months: chunk })
    }
    return groups
  }
  // year
  const byYear = new Map<string, string[]>()
  for (const m of months) {
    const y = m.slice(0, 4)
    byYear.set(y, [...(byYear.get(y) ?? []), m])
  }
  return Array.from(byYear.entries()).map(([y, ms]) => ({ key: y, label: `${y} 年`, months: ms }))
}

// ─────────────────────────────────────────────
// 主頁面
// ─────────────────────────────────────────────
const MONTHS_AHEAD = 12

export default function PaymentPlannerPage() {
  useDocumentTitle("排程分配規劃台")
  const { toast } = useToast()

  const [mode, setMode] = useState<AggMode>("month")
  const [catFilter, setCatFilter] = useState<string>("all")
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all")
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery<PlannerData>({ queryKey: ["/api/payment-planner"] })
  const { data: forecast } = useQuery<ForecastResponse>({
    queryKey: ["/api/cashflow/forecast?monthsAhead=12"],
  })

  const months = useMemo(() => buildMonths(MONTHS_AHEAD), [])
  const columns = useMemo(() => buildColumns(months, mode), [months, mode])

  // 收入：month "YYYY-MM" → estimated
  const revenueByMonth = useMemo(() => {
    const map = new Map<string, number>()
    forecast?.forecast.months.forEach((m) => {
      map.set(`${m.year}-${String(m.month).padStart(2, "0")}`, m.estimated)
    })
    return map
  }, [forecast])

  // 分配查找：itemId → month → {id, amount}
  const allocLookup = useMemo(() => {
    const map = new Map<number, Map<string, Allocation>>()
    data?.allocations.forEach((a) => {
      if (!map.has(a.paymentItemId)) map.set(a.paymentItemId, new Map())
      map.get(a.paymentItemId)!.set(a.plannedMonth, a)
    })
    return map
  }, [data])

  // 分類選項
  const categories = useMemo(() => {
    const set = new Set<string>()
    data?.items.forEach((i) => set.add(i.categoryLabel))
    return Array.from(set).sort()
  }, [data])

  // 篩選後項目
  const items = useMemo(() => {
    let list = data?.items ?? []
    if (catFilter !== "all") list = list.filter((i) => i.categoryLabel === catFilter)
    if (urgencyFilter !== "all") list = list.filter((i) => i.urgency === urgencyFilter)
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
  }, [data, catFilter, urgencyFilter, search])

  // 列數上限保護（底部彙總用全部 allocations、不受此影響）
  const MAX_ROWS = 200
  const visibleItems = items.slice(0, MAX_ROWS)
  const truncated = items.length > MAX_ROWS

  // 每月需付（全部項目，不受篩選影響底部彙總 → 用全部 allocations）
  const neededByMonth = useMemo(() => {
    const map = new Map<string, number>()
    data?.allocations.forEach((a) => {
      map.set(a.plannedMonth, (map.get(a.plannedMonth) ?? 0) + a.plannedAmount)
    })
    return map
  }, [data])

  // 某項目某月的分配額
  function cellAmount(itemId: number, monthsInCol: string[]): number {
    const itemMap = allocLookup.get(itemId)
    if (!itemMap) return 0
    return monthsInCol.reduce((sum, m) => sum + (itemMap.get(m)?.plannedAmount ?? 0), 0)
  }
  // 某項目未分配餘額
  function unallocated(item: PlanItem): number {
    const itemMap = allocLookup.get(item.id)
    const allocated = itemMap
      ? Array.from(itemMap.values()).reduce((s, a) => s + a.plannedAmount, 0)
      : 0
    return Math.round((item.unpaidAmount - allocated) * 100) / 100
  }

  // 編輯一格（僅月模式）
  const cellMut = useMutation({
    mutationFn: async (p: { item: PlanItem; month: string; amount: number }) => {
      const existing = allocLookup.get(p.item.id)?.get(p.month)
      if (p.amount <= 0) {
        if (existing) await apiRequest("DELETE", `/api/payment-planner/allocations/${existing.id}`)
        return
      }
      if (existing) {
        await apiRequest("PUT", `/api/payment-planner/allocations/${existing.id}`, {
          plannedAmount: p.amount.toFixed(2),
        })
      } else {
        await apiRequest("POST", "/api/payment-planner/allocations", {
          paymentItemId: p.item.id,
          plannedMonth: p.month,
          plannedAmount: p.amount.toFixed(2),
        })
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/payment-planner"] }),
    onError: (e: Error) =>
      toast({ title: "更新失敗", description: e.message, variant: "destructive" }),
  })

  const autoMut = useMutation<{ created: number }, Error, "by_due" | "even">({
    mutationFn: (strategy) =>
      apiRequest("POST", "/api/payment-planner/auto-distribute", {
        monthsAhead: MONTHS_AHEAD,
        strategy,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-planner"] })
      toast({ title: "已自動分配", description: `建立 ${res.created} 筆規劃` })
    },
    onError: (e: Error) =>
      toast({ title: "自動分配失敗", description: e.message, variant: "destructive" }),
  })

  const totalUnallocated = useMemo(
    () => (data?.items ?? []).reduce((s, i) => s + Math.max(0, unallocated(i)), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, allocLookup]
  )

  // 底部彙總（依欄分組）
  function colNeeded(col: ColGroup): number {
    return col.months.reduce((s, m) => s + (neededByMonth.get(m) ?? 0), 0)
  }
  function colRevenue(col: ColGroup): number {
    return col.months.reduce((s, m) => s + (revenueByMonth.get(m) ?? 0), 0)
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4">
      {/* 標題列 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-indigo-600" />
            排程分配規劃台
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            一頁安排所有應付款的付款月份，推估未來每月/每季/每年所需金額（不影響原始到期日）
          </p>
        </div>
        <Link href="/financial-cockpit">
          <span className="text-sm text-indigo-600 hover:underline cursor-pointer inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> 回駕駛艙
          </span>
        </Link>
      </div>

      {/* 工具列 */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-2">
          {/* 彙總粒度 */}
          <div className="flex gap-1">
            {(["month", "quarter", "year"] as AggMode[]).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? "default" : "outline"}
                onClick={() => setMode(m)}
              >
                {m === "month" ? "月" : m === "quarter" ? "季" : "年"}
              </Button>
            ))}
          </div>
          {/* 自動分配 */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => autoMut.mutate("by_due")}
            disabled={autoMut.isPending}
          >
            <Wand2 className="h-4 w-4 mr-1" /> 自動分配（依到期月）
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => autoMut.mutate("even")}
            disabled={autoMut.isPending}
          >
            <Wand2 className="h-4 w-4 mr-1" /> 平均攤 12 月
          </Button>
          {/* 篩選 */}
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="分類" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分類</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="急迫度" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部急迫度</SelectItem>
              <SelectItem value="critical">🔴 立刻付</SelectItem>
              <SelectItem value="high">🟠 本週付</SelectItem>
              <SelectItem value="medium">🟡 可延後</SelectItem>
              <SelectItem value="low">⚪ 可推後</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋"
              className="pl-8 w-40 h-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* 未分配警示 */}
      {totalUnallocated > 0 && (
        <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          尚有 <span className="font-bold">{fmt(totalUnallocated)}</span>{" "}
          應付款未排入任何月份。可用「自動分配」一鍵排入，或在矩陣手動填入。
        </div>
      )}

      {/* 矩陣 */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">載入中…</p>
          ) : items.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">沒有符合條件的應付款</p>
          ) : (
            <div className="overflow-x-auto">
              {truncated && (
                <p className="text-xs text-amber-600 mb-2">
                  ⚠️ 應付款項過多，僅顯示前 {MAX_ROWS} 筆（共 {items.length}
                  筆）。請用上方篩選縮小範圍；底部每月彙總仍為全部金額。
                </p>
              )}
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="sticky left-0 bg-background text-left p-2 min-w-[200px] z-10">
                      應付款項
                    </th>
                    <th className="text-right p-2 min-w-[90px]">未付</th>
                    <th className="text-right p-2 min-w-[80px] text-amber-600">未分配</th>
                    {columns.map((c) => (
                      <th key={c.key} className="text-right p-2 min-w-[90px] whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => {
                    const un = unallocated(item)
                    return (
                      <tr key={item.id} className="border-b hover:bg-muted/30">
                        <td className="sticky left-0 bg-background p-2 z-10">
                          <div className="flex items-center gap-1">
                            <span>{URGENCY_DOT[item.urgency]}</span>
                            <span
                              className="font-medium truncate max-w-[160px]"
                              title={item.itemName}
                            >
                              {item.itemName}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] mr-1">
                              {item.categoryLabel}
                            </Badge>
                            {item.projectName}
                          </div>
                        </td>
                        <td className="text-right p-2 whitespace-nowrap">
                          {fmt(item.unpaidAmount)}
                        </td>
                        <td
                          className={`text-right p-2 whitespace-nowrap ${un > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}
                        >
                          {un === 0 ? "✓" : fmt(un)}
                        </td>
                        {columns.map((c) => {
                          const val = cellAmount(item.id, c.months)
                          if (mode === "month") {
                            return (
                              <td key={c.key} className="p-1">
                                <CellInput
                                  value={val}
                                  onCommit={(amount) =>
                                    cellMut.mutate({ item, month: c.months[0], amount })
                                  }
                                />
                              </td>
                            )
                          }
                          return (
                            <td key={c.key} className="text-right p-2 whitespace-nowrap">
                              {val > 0 ? (
                                fmt(val)
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="font-medium">
                  <tr className="border-t-2 bg-muted/20">
                    <td className="sticky left-0 bg-muted/20 p-2 z-10">每月需付總額</td>
                    <td></td>
                    <td></td>
                    {columns.map((c) => (
                      <td key={c.key} className="text-right p-2 whitespace-nowrap">
                        {fmt(colNeeded(c))}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-green-50/50">
                    <td className="sticky left-0 bg-green-50/50 p-2 z-10">預估營運收入</td>
                    <td></td>
                    <td></td>
                    {columns.map((c) => (
                      <td key={c.key} className="text-right p-2 whitespace-nowrap text-green-700">
                        {fmt(colRevenue(c))}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="sticky left-0 bg-background p-2 z-10">淨現金流</td>
                    <td></td>
                    <td></td>
                    {columns.map((c) => {
                      const net = colRevenue(c) - colNeeded(c)
                      return (
                        <td
                          key={c.key}
                          className={`text-right p-2 whitespace-nowrap ${net < 0 ? "text-red-600 font-bold" : "text-green-700"}`}
                        >
                          {net >= 0 ? "+" : ""}
                          {fmt(net)}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        💡 「月」模式可直接點格輸入該月要付的金額（一筆可分散到多月）；「季 / 年」模式顯示彙總。
        此規劃為獨立沙盤，不會更動原始到期日或滯納金計算。
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────
// 可編輯儲存格
// ─────────────────────────────────────────────
function CellInput({ value, onCommit }: { value: number; onCommit: (amount: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value > 0 ? String(Math.round(value)) : "")
          setEditing(true)
        }}
        className={`w-full text-right px-2 py-1 rounded hover:bg-indigo-50 ${value > 0 ? "" : "text-muted-foreground"}`}
      >
        {value > 0 ? fmt(value) : "—"}
      </button>
    )
  }
  return (
    <Input
      autoFocus
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false)
        const n = parseFloat(draft) || 0
        if (n !== Math.round(value)) onCommit(n)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        if (e.key === "Escape") setEditing(false)
      }}
      className="h-8 text-right px-1"
    />
  )
}
