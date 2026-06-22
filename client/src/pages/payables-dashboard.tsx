/**
 * 應付 / 現金總覽看板 — 單一窗口
 * 一頁看完：給付狀況、應付狀況、還有多少未付。
 *
 * 資料來源：聚合既有 /api/payment/items（含分期/租金/勞健保/固定/強執產生的應付項目），
 * 依「起始月份」投影到 12 個月矩陣，無需新增資料表。
 */
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import {
  Wallet,
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Calendar,
  CalendarRange,
  Shield,
  Layers,
  Gavel,
  CalendarClock,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { formatNT } from "@/lib/utils"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"
import type { PaymentItem } from "@/components/installment-types"
import type { DebtCategory, PaymentProject } from "@/../../shared/schema/category"

type GroupBy = "category" | "project"

interface Cell {
  payable: number
  paid: number
  unpaid: number
  overdue: boolean
  dueSoon: boolean
}
interface Row {
  key: string
  name: string
  cells: Cell[] // 12 個月
  totalPayable: number
  totalPaid: number
  totalUnpaid: number
}

const MONTHS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
]
const emptyCell = (): Cell => ({ payable: 0, paid: 0, unpaid: 0, overdue: false, dueSoon: false })

export default function PayablesDashboard() {
  useDocumentTitle("應付總覽看板")
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-11

  const [year, setYear] = useState(currentYear)
  const [groupBy, setGroupBy] = useState<GroupBy>("category")
  const [detail, setDetail] = useState<{ title: string; rows: PaymentItem[] } | null>(null)

  const { data: itemsResp, isLoading } = useQuery({
    queryKey: ["/api/payment/items", { includeAll: true }],
    queryFn: () => fetch("/api/payment/items?includeAll=true").then((r) => r.json()),
  })
  const items: PaymentItem[] = Array.isArray(itemsResp) ? itemsResp : itemsResp?.items || []

  const { data: categories = [] } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories/project"],
  })
  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  })

  const nameOf = useMemo(() => {
    const cat = new Map<number, string>()
    for (const c of categories)
      cat.set(c.id, (c as { categoryName?: string }).categoryName || `分類 ${c.id}`)
    const proj = new Map<number, string>()
    for (const p of projects)
      proj.set(p.id, (p as { projectName?: string }).projectName || `專案 ${p.id}`)
    return { cat, proj }
  }, [categories, projects])

  // 聚合: 依群組 × 12 月
  const { rows, monthTotals, grand } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const map = new Map<string, Row>()

    for (const it of items) {
      if (!it.startDate) continue
      const d = new Date(it.startDate)
      if (d.getFullYear() !== year) continue
      const m = d.getMonth()
      const payable = parseFloat(it.totalAmount || "0") || 0
      const paid = parseFloat(it.paidAmount || "0") || 0
      const unpaid = Math.max(0, payable - paid)

      const id = groupBy === "category" ? it.categoryId : it.projectId
      const key = String(id ?? "none")
      const name =
        groupBy === "category"
          ? nameOf.cat.get(it.categoryId) || "未分類"
          : nameOf.proj.get(it.projectId) || "未指定專案"

      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          cells: Array.from({ length: 12 }, emptyCell),
          totalPayable: 0,
          totalPaid: 0,
          totalUnpaid: 0,
        })
      }
      const row = map.get(key)!
      const cell = row.cells[m]
      cell.payable += payable
      cell.paid += paid
      cell.unpaid += unpaid
      const dd = new Date(it.startDate)
      dd.setHours(0, 0, 0, 0)
      const days = Math.ceil((dd.getTime() - today.getTime()) / 86400000)
      if (unpaid > 0 && days < 0) cell.overdue = true
      if (unpaid > 0 && days >= 0 && days <= 7) cell.dueSoon = true
      row.totalPayable += payable
      row.totalPaid += paid
      row.totalUnpaid += unpaid
    }

    const rows = Array.from(map.values()).sort((a, b) => b.totalUnpaid - a.totalUnpaid)
    const monthTotals = Array.from({ length: 12 }, (_, m) =>
      rows.reduce(
        (acc, r) => {
          acc.payable += r.cells[m].payable
          acc.paid += r.cells[m].paid
          acc.unpaid += r.cells[m].unpaid
          return acc
        },
        { payable: 0, paid: 0, unpaid: 0 }
      )
    )
    const grand = rows.reduce(
      (acc, r) => {
        acc.payable += r.totalPayable
        acc.paid += r.totalPaid
        acc.unpaid += r.totalUnpaid
        return acc
      },
      { payable: 0, paid: 0, unpaid: 0 }
    )
    return { rows, monthTotals, grand }
  }, [items, year, groupBy, nameOf])

  // KPI 一律以「現在」為準：本月(應付/已付/未付) + 今年累積逾期, 不受矩陣年份切換影響
  const kpi = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let mPayable = 0,
      mPaid = 0,
      mUnpaid = 0,
      mCount = 0,
      overdueYear = 0,
      overdueCount = 0
    for (const it of items) {
      if (!it.startDate) continue
      const d = new Date(it.startDate)
      const payable = parseFloat(it.totalAmount || "0") || 0
      const paid = parseFloat(it.paidAmount || "0") || 0
      const unpaid = Math.max(0, payable - paid)
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        mPayable += payable
        mPaid += paid
        mUnpaid += unpaid
        mCount++
      }
      if (d.getFullYear() === currentYear && unpaid > 0) {
        const dd = new Date(it.startDate)
        dd.setHours(0, 0, 0, 0)
        if (dd.getTime() < today.getTime()) {
          overdueYear += unpaid
          overdueCount++
        }
      }
    }
    return { mPayable, mPaid, mUnpaid, mCount, overdueYear, overdueCount }
  }, [items, currentYear, currentMonth])

  const monthLabel = `${currentMonth + 1}月`
  const years = [currentYear - 1, currentYear, currentYear + 1]

  // 取某格 (群組 × 月) 的實際應付項目, 供點擊看明細
  const cellItems = (rowKey: string, monthIdx: number): PaymentItem[] =>
    items.filter((it) => {
      if (!it.startDate) return false
      const d = new Date(it.startDate)
      if (d.getFullYear() !== year || d.getMonth() !== monthIdx) return false
      const gid = groupBy === "category" ? it.categoryId : it.projectId
      return String(gid ?? "none") === rowKey
    })

  const openCell = (rowKey: string, rowName: string, monthIdx: number) => {
    const rows = cellItems(rowKey, monthIdx)
    if (rows.length === 0) return
    setDetail({ title: `${rowName} · ${MONTHS[monthIdx]}`, rows })
  }

  const cellClass = (c: Cell) => {
    if (c.payable === 0) return "bg-gray-50 text-gray-300"
    if (c.unpaid === 0) return "bg-emerald-50 text-emerald-700"
    if (c.overdue) return "bg-red-50 text-red-700 font-semibold"
    if (c.dueSoon) return "bg-amber-50 text-amber-700 font-medium"
    return "bg-blue-50 text-blue-700"
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 sm:px-0">
      {/* 標題 + 控制 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Wallet className="w-7 h-7 text-blue-600" />
            應付總覽看板
          </h1>
          <p className="text-sm text-gray-600 mt-1">一頁看完：給付、應付、還有多少未付</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y} 年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border overflow-hidden">
            <Button
              type="button"
              size="sm"
              variant={groupBy === "category" ? "default" : "ghost"}
              className="rounded-none"
              onClick={() => setGroupBy("category")}
            >
              依分類
            </Button>
            <Button
              type="button"
              size="sm"
              variant={groupBy === "project" ? "default" : "ghost"}
              className="rounded-none"
              onClick={() => setGroupBy("project")}
            >
              依專案
            </Button>
          </div>
        </div>
      </div>

      {/* KPI：聚焦本月 + 今年逾期 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<CircleDollarSign className="w-5 h-5 text-blue-600" />}
          label={`本月應付（${monthLabel}）`}
          value={kpi.mPayable}
          sub={`本月共 ${kpi.mCount} 筆應付`}
          tone="blue"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          label={`本月已付（${monthLabel}）`}
          value={kpi.mPaid}
          sub={
            kpi.mPayable > 0
              ? `本月已付 ${Math.round((kpi.mPaid / kpi.mPayable) * 100)}%`
              : "本月無應付"
          }
          tone="emerald"
        />
        <KpiCard
          icon={<Wallet className="w-5 h-5 text-indigo-600" />}
          label={`本月未付（${monthLabel}）`}
          value={kpi.mUnpaid}
          sub={kpi.mUnpaid > 0 ? "本月尚待支付" : "本月已付清"}
          tone="indigo"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          label="逾期未付（今年累積）"
          value={kpi.overdueYear}
          sub={kpi.overdueYear > 0 ? `共 ${kpi.overdueCount} 筆 · 請優先處理` : "今年無逾期 👍"}
          tone="red"
        />
      </div>

      {/* 應付矩陣 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            應付矩陣（{groupBy === "category" ? "分類" : "專案"} × 月份）
          </CardTitle>
          <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
            <span>
              <i className="inline-block w-3 h-3 rounded bg-red-100 align-middle" /> 逾期
            </span>
            <span>
              <i className="inline-block w-3 h-3 rounded bg-amber-100 align-middle" /> 7 日內到期
            </span>
            <span>
              <i className="inline-block w-3 h-3 rounded bg-blue-100 align-middle" /> 未付
            </span>
            <span>
              <i className="inline-block w-3 h-3 rounded bg-emerald-100 align-middle" /> 已付清
            </span>
            <span>格內顯示未付金額 · 點格看明細</span>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">此年度尚無應付資料</p>
          ) : (
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left p-2 sticky left-0 bg-white">
                    {groupBy === "category" ? "分類" : "專案"}
                  </th>
                  {MONTHS.map((m, i) => (
                    <th
                      key={m}
                      className={`p-2 text-right ${year === currentYear && i === currentMonth ? "text-blue-600 font-bold" : ""}`}
                    >
                      {m}
                    </th>
                  ))}
                  <th className="p-2 text-right font-semibold">未付小計</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="p-2 font-medium text-gray-800 sticky left-0 bg-white whitespace-nowrap">
                      {r.name}
                    </td>
                    {r.cells.map((c, i) => (
                      <td
                        key={i}
                        onClick={() => openCell(r.key, r.name, i)}
                        className={`p-2 text-right tabular-nums rounded ${cellClass(c)} ${c.payable > 0 ? "cursor-pointer hover:ring-2 hover:ring-blue-300" : ""}`}
                        title={
                          c.payable === 0
                            ? undefined
                            : `應付 ${formatNT(c.payable)} / 已付 ${formatNT(c.paid)} / 未付 ${formatNT(c.unpaid)}（點擊看明細）`
                        }
                      >
                        {c.payable === 0 ? "–" : c.unpaid === 0 ? "✓" : formatNT(c.unpaid)}
                      </td>
                    ))}
                    <td className="p-2 text-right font-semibold text-gray-900 tabular-nums">
                      {formatNT(r.totalUnpaid)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold text-gray-900">
                  <td className="p-2 sticky left-0 bg-white">月未付合計</td>
                  {monthTotals.map((t, i) => (
                    <td key={i} className="p-2 text-right tabular-nums">
                      {t.unpaid === 0 ? "–" : formatNT(t.unpaid)}
                    </td>
                  ))}
                  <td className="p-2 text-right text-indigo-700 tabular-nums">
                    {formatNT(grand.unpaid)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 深入工具：下鑽既有矩陣與看板 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">深入查看</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {DRILL_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                <div className="flex items-center gap-3 p-3 rounded-lg border hover:border-blue-400 hover:bg-blue-50/40 transition cursor-pointer h-full">
                  <l.icon className="w-5 h-5 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800">{l.title}</div>
                    <div className="text-xs text-gray-500 truncate">{l.desc}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 格子明細 Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.title} — 應付明細</DialogTitle>
            <DialogDescription className="sr-only">應付項目明細清單</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-2">
              {detail.rows.map((it) => {
                const payable = parseFloat(it.totalAmount || "0") || 0
                const paid = parseFloat(it.paidAmount || "0") || 0
                const unpaid = Math.max(0, payable - paid)
                const done = unpaid === 0
                return (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-3 border rounded-lg p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        {it.itemName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {it.startDate?.slice(0, 10)}
                        {" · "}應付 {formatNT(payable)} / 已付 {formatNT(paid)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm font-semibold tabular-nums ${done ? "text-emerald-600" : "text-indigo-700"}`}
                      >
                        {done ? "已付清" : `未付 ${formatNT(unpaid)}`}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="flex justify-between border-t pt-2 mt-2 text-sm font-semibold">
                <span>合計（{detail.rows.length} 筆）</span>
                <span className="tabular-nums text-indigo-700">
                  未付{" "}
                  {formatNT(
                    detail.rows.reduce(
                      (s, it) =>
                        s +
                        Math.max(
                          0,
                          (parseFloat(it.totalAmount || "0") || 0) -
                            (parseFloat(it.paidAmount || "0") || 0)
                        ),
                      0
                    )
                  )}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BackToTop />
    </div>
  )
}

const DRILL_LINKS = [
  { href: "/rental-matrix", title: "租金月度矩陣", desc: "合約 × 12 月 給付狀態", icon: Calendar },
  {
    href: "/fixed-expense-matrix",
    title: "固定開銷矩陣",
    desc: "預算 vs 實際 × 12 月",
    icon: CalendarRange,
  },
  {
    href: "/labor-insurance-matrix",
    title: "勞健保矩陣",
    desc: "勞保/健保/勞退 × 12 月",
    icon: Shield,
  },
  { href: "/cost-overview", title: "成本結構中樞", desc: "全年成本結構 + 占比", icon: Layers },
  { href: "/enforcement", title: "強制執行管理", desc: "公文/圈存/分期對帳", icon: Gavel },
  { href: "/bills", title: "帳單到期看板", desc: "近期應繳/逾期提醒", icon: CalendarClock },
]

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub?: string
  tone: "blue" | "emerald" | "indigo" | "red"
}) {
  const toneClass = {
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    indigo: "text-indigo-700",
    red: "text-red-700",
  }[tone]
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {icon}
          {label}
        </div>
        <div className={`text-2xl font-bold mt-1 ${toneClass} tabular-nums`}>{formatNT(value)}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  )
}
