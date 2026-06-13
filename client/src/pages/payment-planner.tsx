/**
 * 一頁式排程分配規劃台（/payment-planner）— 分類 + 三大塊模型
 *
 * 「每月需要的收入金額」= 三大塊組合：
 *   ① 應付款項（依類別：租金/勞健保/其他…，可自己重新分類）
 *   ② 營運所需成本
 *   ③ 生活所需
 * 每一類勾選月份平均攤 → 算出每月攤提 → 加總 = 每月需賺到的收入，對照營運收入預測看缺口。
 *
 * 獨立規劃層（payment_plan_category_budgets / payment_plan_item_categories），
 * 不動原始 dueDate、純沙盤、可逆。
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
import { DistributeDialog } from "@/components/planner/distribute-dialog"
import { CalendarRange, ArrowLeft, ChevronRight, ChevronDown, Wand2 } from "lucide-react"

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────
interface PlanItem {
  id: number
  itemName: string
  category: string
  categoryLabel: string
  unpaidAmount: number
  dueDate: string | null
  projectName: string | null
}
interface CategoryBudget {
  category: string
  plannedMonth: string
  amount: number
}
interface PlannerData {
  items: PlanItem[]
  categoryBudgets: CategoryBudget[]
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
const OPERATING = "營運成本"
const LIVING = "生活所需"
const SPECIAL_BLOCKS = [OPERATING, LIVING]
// 保留類別：預估營運收入覆寫（收入、非需付；不計入每月所需）
const REVENUE_KEY = "預估營運收入"
const NON_NEED_KEYS = [REVENUE_KEY]

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
  if (mode === "month")
    return months.map((m) => ({ key: m, label: m.replace("-", "/"), months: [m] }))
  if (mode === "quarter") {
    const groups: ColGroup[] = []
    for (let i = 0; i < months.length; i += 3) {
      const chunk = months.slice(i, i + 3)
      const [y, mo] = chunk[0].split("-").map(Number)
      groups.push({ key: chunk[0], label: `${y} Q${Math.floor((mo - 1) / 3) + 1}`, months: chunk })
    }
    return groups
  }
  const byYear = new Map<string, string[]>()
  for (const m of months) byYear.set(m.slice(0, 4), [...(byYear.get(m.slice(0, 4)) ?? []), m])
  return Array.from(byYear.entries()).map(([y, ms]) => ({ key: y, label: `${y} 年`, months: ms }))
}

const MONTHS_AHEAD = 12

// ─────────────────────────────────────────────
export default function PaymentPlannerPage() {
  useDocumentTitle("排程分配規劃台")
  const { toast } = useToast()

  const [mode, setMode] = useState<AggMode>("month")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [distributeFor, setDistributeFor] = useState<string | null>(null)

  const { data, isLoading } = useQuery<PlannerData>({ queryKey: ["/api/payment-planner"] })
  const { data: forecast } = useQuery<ForecastResponse>({
    queryKey: ["/api/cashflow/forecast?monthsAhead=12"],
  })

  const months = useMemo(() => buildMonths(MONTHS_AHEAD), [])
  const columns = useMemo(() => buildColumns(months, mode), [months, mode])

  const revenueByMonth = useMemo(() => {
    const map = new Map<string, number>()
    forecast?.forecast.months.forEach((m) =>
      map.set(`${m.year}-${String(m.month).padStart(2, "0")}`, m.estimated)
    )
    return map
  }, [forecast])

  // 預算查找：category → month → amount
  const budgetLookup = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    data?.categoryBudgets.forEach((b) => {
      if (!map.has(b.category)) map.set(b.category, new Map())
      map.get(b.category)!.set(b.plannedMonth, b.amount)
    })
    return map
  }, [data])

  // 應付款依類別分組
  const itemsByCategory = useMemo(() => {
    const map = new Map<string, PlanItem[]>()
    data?.items.forEach((i) => {
      if (!map.has(i.category)) map.set(i.category, [])
      map.get(i.category)!.push(i)
    })
    return map
  }, [data])

  const payableCategories = useMemo(
    () => Array.from(itemsByCategory.keys()).sort(),
    [itemsByCategory]
  )
  // 重新分類可選的類別（既有 + 常用）
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(payableCategories)
    ;["租金", "勞健保", "貸款", "稅務", "水電", "其他"].forEach((c) => set.add(c))
    return Array.from(set).sort()
  }, [payableCategories])

  function catUnpaid(cat: string): number {
    return (itemsByCategory.get(cat) ?? []).reduce((s, i) => s + i.unpaidAmount, 0)
  }
  function cellBudget(cat: string, monthsInCol: string[]): number {
    const m = budgetLookup.get(cat)
    if (!m) return 0
    return monthsInCol.reduce((s, mo) => s + (m.get(mo) ?? 0), 0)
  }
  // 某月所有類別（含三大塊、排除收入覆寫）預算總和 = 該月所需收入
  function monthNeeded(monthsInCol: string[]): number {
    let total = 0
    budgetLookup.forEach((mMap, cat) => {
      if (NON_NEED_KEYS.includes(cat)) return
      monthsInCol.forEach((mo) => (total += mMap.get(mo) ?? 0))
    })
    return total
  }
  // 預估營運收入：有覆寫用覆寫、否則用現金流預測
  function effRevenue(month: string): number {
    const ov = budgetLookup.get(REVENUE_KEY)?.get(month)
    return ov !== undefined ? ov : (revenueByMonth.get(month) ?? 0)
  }
  function colRevenue(monthsInCol: string[]): number {
    return monthsInCol.reduce((s, m) => s + effRevenue(m), 0)
  }

  // 未分配（應付款類別）：該類未付 − 已排預算總額
  function catUnallocated(cat: string): number {
    const budgeted = Array.from(budgetLookup.get(cat)?.values() ?? []).reduce((s, v) => s + v, 0)
    return Math.round((catUnpaid(cat) - budgeted) * 100) / 100
  }

  const budgetMut = useMutation({
    mutationFn: (p: { category: string; month: string; amount: number }) =>
      apiRequest("PUT", "/api/payment-planner/category-budget", {
        category: p.category,
        plannedMonth: p.month,
        amount: p.amount.toFixed(2),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/payment-planner"] }),
    onError: (e: Error) =>
      toast({ title: "更新失敗", description: e.message, variant: "destructive" }),
  })

  const distributeMut = useMutation({
    mutationFn: (p: { category: string; amount: number; months: string[] }) =>
      apiRequest("POST", "/api/payment-planner/distribute", p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-planner"] })
      toast({ title: "已分攤" })
      setDistributeFor(null)
    },
    onError: (e: Error) =>
      toast({ title: "分攤失敗", description: e.message, variant: "destructive" }),
  })

  const reclassifyMut = useMutation({
    mutationFn: (p: { paymentItemId: number; category: string }) =>
      apiRequest("PUT", "/api/payment-planner/item-category", p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-planner"] })
      toast({ title: "已重新分類" })
    },
    onError: (e: Error) =>
      toast({ title: "分類失敗", description: e.message, variant: "destructive" }),
  })

  function toggleExpand(cat: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const distributeDefault = distributeFor
    ? SPECIAL_BLOCKS.includes(distributeFor)
      ? 0
      : Math.max(0, catUnallocated(distributeFor))
    : 0

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-indigo-600" />
            排程分配規劃台
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            依類別分配應付款（本月及之前的帳）+ 營運成本 + 生活所需，三大塊組出每月需賺到的收入
          </p>
        </div>
        <Link href="/financial-cockpit">
          <span className="text-sm text-indigo-600 hover:underline cursor-pointer inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> 回駕駛艙
          </span>
        </Link>
      </div>

      {/* 粒度切換 */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">彙總粒度：</span>
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
          <span className="text-xs text-muted-foreground ml-2">
            （「月」模式可直接點格輸入或用各類「分攤」勾月份平均攤）
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">載入中…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="sticky left-0 bg-background text-left p-2 min-w-[220px] z-10">
                      類別 / 區塊
                    </th>
                    {columns.map((c) => (
                      <th key={c.key} className="text-right p-2 min-w-[88px] whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* ① 應付款項（依類別） */}
                  <tr className="bg-indigo-50/40">
                    <td
                      colSpan={columns.length + 1}
                      className="p-1.5 px-2 font-medium text-xs text-indigo-700 sticky left-0 z-10"
                    >
                      ① 應付款項（依類別 · 僅本月及之前的帳，未來到期歸營運費用）
                    </td>
                  </tr>
                  {payableCategories.length === 0 && (
                    <tr>
                      <td
                        colSpan={columns.length + 1}
                        className="p-3 text-center text-muted-foreground"
                      >
                        目前沒有應付款
                      </td>
                    </tr>
                  )}
                  {payableCategories.map((cat) => {
                    const isOpen = expanded.has(cat)
                    const un = catUnallocated(cat)
                    return (
                      <CategoryRows
                        key={cat}
                        category={cat}
                        isOpen={isOpen}
                        unpaid={catUnpaid(cat)}
                        unallocated={un}
                        items={itemsByCategory.get(cat) ?? []}
                        columns={columns}
                        editable={mode === "month"}
                        categoryOptions={categoryOptions}
                        cellBudget={cellBudget}
                        onToggle={() => toggleExpand(cat)}
                        onDistribute={() => setDistributeFor(cat)}
                        onEdit={(month, amount) =>
                          budgetMut.mutate({ category: cat, month, amount })
                        }
                        onReclassify={(id, category) =>
                          reclassifyMut.mutate({ paymentItemId: id, category })
                        }
                      />
                    )
                  })}

                  {/* ②③ 營運成本 / 生活所需 */}
                  <tr className="bg-emerald-50/40">
                    <td
                      colSpan={columns.length + 1}
                      className="p-1.5 px-2 font-medium text-xs text-emerald-700 sticky left-0 z-10"
                    >
                      ②③ 營運成本 + 生活所需
                    </td>
                  </tr>
                  {SPECIAL_BLOCKS.map((blk) => (
                    <tr key={blk} className="border-b hover:bg-muted/30">
                      <td className="sticky left-0 bg-background p-2 z-10">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{blk}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs"
                            onClick={() => setDistributeFor(blk)}
                          >
                            <Wand2 className="h-3 w-3 mr-1" />
                            分攤
                          </Button>
                        </div>
                      </td>
                      {columns.map((c) => {
                        const val = cellBudget(blk, c.months)
                        return (
                          <td key={c.key} className={mode === "month" ? "p-1" : "text-right p-2"}>
                            {mode === "month" ? (
                              <BudgetCell
                                value={val}
                                onCommit={(amount) =>
                                  budgetMut.mutate({ category: blk, month: c.months[0], amount })
                                }
                              />
                            ) : val > 0 ? (
                              fmt(val)
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="font-medium">
                  <tr className="border-t-2 bg-muted/30">
                    <td className="sticky left-0 bg-muted/30 p-2 z-10">每月所需收入（三塊合計）</td>
                    {columns.map((c) => (
                      <td key={c.key} className="text-right p-2 whitespace-nowrap">
                        {fmt(monthNeeded(c.months))}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-green-50/50">
                    <td className="sticky left-0 bg-green-50/50 p-2 z-10">
                      預估營運收入
                      <span className="text-xs text-muted-foreground"> · 可輸入覆寫</span>
                    </td>
                    {columns.map((c) => {
                      const val = colRevenue(c.months)
                      return (
                        <td
                          key={c.key}
                          className={mode === "month" ? "p-1" : "text-right p-2 text-green-700"}
                        >
                          {mode === "month" ? (
                            <BudgetCell
                              value={val}
                              onCommit={(amount) =>
                                budgetMut.mutate({
                                  category: REVENUE_KEY,
                                  month: c.months[0],
                                  amount,
                                })
                              }
                            />
                          ) : (
                            fmt(val)
                          )}
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td className="sticky left-0 bg-background p-2 z-10">差額（收入 − 所需）</td>
                    {columns.map((c) => {
                      const diff = colRevenue(c.months) - monthNeeded(c.months)
                      return (
                        <td
                          key={c.key}
                          className={`text-right p-2 whitespace-nowrap ${diff < 0 ? "text-red-600 font-bold" : "text-green-700"}`}
                        >
                          {diff >= 0 ? "+" : ""}
                          {fmt(diff)}
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
        💡 點類別前箭頭可展開該類項目並重新分類；「分攤」勾選月份把該類金額平均攤入。 紅字差額 =
        該月預估收入不足以支應三大塊所需。純規劃，不影響實際到期日。
      </p>

      {distributeFor && (
        <DistributeDialog
          category={distributeFor}
          defaultAmount={distributeDefault}
          months={months}
          isPending={distributeMut.isPending}
          onClose={() => setDistributeFor(null)}
          onConfirm={(amount, selectedMonths) =>
            distributeMut.mutate({ category: distributeFor, amount, months: selectedMonths })
          }
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 類別列（含展開項目 + 重新分類）
// ─────────────────────────────────────────────
function CategoryRows({
  category,
  isOpen,
  unpaid,
  unallocated,
  items,
  columns,
  editable,
  categoryOptions,
  cellBudget,
  onToggle,
  onDistribute,
  onEdit,
  onReclassify,
}: {
  category: string
  isOpen: boolean
  unpaid: number
  unallocated: number
  items: PlanItem[]
  columns: ColGroup[]
  editable: boolean
  categoryOptions: string[]
  cellBudget: (cat: string, months: string[]) => number
  onToggle: () => void
  onDistribute: () => void
  onEdit: (month: string, amount: number) => void
  onReclassify: (id: number, category: string) => void
}) {
  return (
    <>
      <tr className="border-b hover:bg-muted/30">
        <td className="sticky left-0 bg-background p-2 z-10">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="flex items-center gap-1 font-medium"
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {category}
              <span className="text-xs text-muted-foreground">（{items.length}）</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                未付 {fmt(unpaid)}
                {unallocated > 0 && (
                  <span className="text-amber-600">·待排 {fmt(unallocated)}</span>
                )}
              </span>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={onDistribute}>
                <Wand2 className="h-3 w-3 mr-1" />
                分攤
              </Button>
            </div>
          </div>
        </td>
        {columns.map((c) => {
          const val = cellBudget(category, c.months)
          return (
            <td key={c.key} className={editable ? "p-1" : "text-right p-2"}>
              {editable ? (
                <BudgetCell value={val} onCommit={(amount) => onEdit(c.months[0], amount)} />
              ) : val > 0 ? (
                fmt(val)
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          )
        })}
      </tr>
      {isOpen &&
        items.map((it) => (
          <tr key={it.id} className="border-b bg-muted/10 text-xs">
            <td className="sticky left-0 bg-muted/10 p-2 pl-8 z-10">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate max-w-[120px]" title={it.itemName}>
                  {it.itemName}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">{fmt(it.unpaidAmount)}</span>
                  <input
                    list="planner-cat-options"
                    defaultValue={it.category}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== it.category) onReclassify(it.id, v)
                    }}
                    className="h-6 w-20 text-xs border rounded px-1"
                    title="重新分類"
                  />
                </div>
              </div>
            </td>
            {columns.map((c) => (
              <td key={c.key} className="text-right p-2 text-muted-foreground">
                {it.dueDate
                  ? it.dueDate.slice(0, 7) === c.months[0] && c.months.length === 1
                    ? "到期"
                    : ""
                  : ""}
              </td>
            ))}
          </tr>
        ))}
      <datalist id="planner-cat-options">
        {categoryOptions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  )
}

// ─────────────────────────────────────────────
// 可編輯預算格
// ─────────────────────────────────────────────
function BudgetCell({ value, onCommit }: { value: number; onCommit: (amount: number) => void }) {
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
