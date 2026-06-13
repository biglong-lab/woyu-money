/**
 * 沙盤推演 2.0 · 未來 12 月現金健康模擬（/scenario-planner）
 *
 * 三軸一起推：收入↑（成長%）+ 成本↓（營運成本刪減%）+ 還款計畫（採用排程規劃台）
 * → 模擬未來 12 個月的收入 / 營運成本 / 還款 / 淨現金流 / 期末現金走勢。
 *
 * 純前端沙盤，重用：
 * - /api/cashflow/forecast          基準營運收入
 * - /api/payment-planner            還款計畫（每月規劃應付款）
 * - /api/recurring-expense-templates 營運固定成本基準
 */
import { useMemo, useState, useEffect } from "react"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import { Sparkles, ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Save } from "lucide-react"

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────
interface ForecastMonth {
  year: number
  month: number
  estimated: number
}
interface ForecastResponse {
  forecast: { months: ForecastMonth[] }
}
interface CategoryBudget {
  category: string
  plannedMonth: string
  amount: number
}
interface PlannerData {
  categoryBudgets: CategoryBudget[]
}
// 排程規劃台非還款的類別：營運/生活兩塊（沙盤另有營運成本輸入）+ 收入覆寫
const PLANNER_NON_DEBT = ["營運成本", "生活所需", "預估營運收入"]
interface Template {
  id: number
  estimatedAmount: string
  isActive: boolean
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
function ymOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
function buildMonths(count: number): string[] {
  const now = new Date()
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(ymOf(new Date(now.getFullYear(), now.getMonth() + i, 1)))
  return out
}

const STORAGE_KEY = "scenario-planner:v1"
interface Levers {
  revenueGrowth: number // %
  costCut: number // %
  extraIncome: number // 每月額外增收
  startingCash: number // 期初現金
  operatingCost: number // 每月營運固定成本
  usePlanner: boolean // 採用排程規劃台還款
}

const MONTHS_AHEAD = 12

export default function ScenarioPlannerPage() {
  useDocumentTitle("沙盤推演 2.0")

  const { data: forecast } = useQuery<ForecastResponse>({
    queryKey: ["/api/cashflow/forecast?monthsAhead=12"],
  })
  const { data: planner } = useQuery<PlannerData>({ queryKey: ["/api/payment-planner"] })
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/recurring-expense-templates"],
  })

  // 營運成本基準 = 啟用中模板月總額
  const operatingBase = useMemo(
    () =>
      templates
        .filter((t) => t.isActive)
        .reduce((s, t) => s + (parseFloat(t.estimatedAmount) || 0), 0),
    [templates]
  )

  const [levers, setLevers] = useState<Levers>({
    revenueGrowth: 0,
    costCut: 0,
    extraIncome: 0,
    startingCash: 0,
    operatingCost: 0,
    usePlanner: true,
  })
  const [loaded, setLoaded] = useState(false)

  // 載入 localStorage / 帶入營運成本預設
  useEffect(() => {
    if (loaded) return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setLevers(JSON.parse(saved))
        setLoaded(true)
        return
      } catch {
        /* ignore */
      }
    }
    if (operatingBase > 0) {
      setLevers((l) => ({ ...l, operatingCost: Math.round(operatingBase) }))
      setLoaded(true)
    }
  }, [operatingBase, loaded])

  const months = useMemo(() => buildMonths(MONTHS_AHEAD), [])

  const revenueByMonth = useMemo(() => {
    const map = new Map<string, number>()
    forecast?.forecast.months.forEach((m) =>
      map.set(`${m.year}-${String(m.month).padStart(2, "0")}`, m.estimated)
    )
    return map
  }, [forecast])

  const repayByMonth = useMemo(() => {
    const map = new Map<string, number>()
    planner?.categoryBudgets
      .filter((b) => !PLANNER_NON_DEBT.includes(b.category))
      .forEach((b) => map.set(b.plannedMonth, (map.get(b.plannedMonth) ?? 0) + b.amount))
    return map
  }, [planner])

  // 投影
  const projection = useMemo(() => {
    let cum = levers.startingCash
    return months.map((m) => {
      const baseRev = revenueByMonth.get(m) ?? 0
      const revenue = baseRev * (1 + levers.revenueGrowth / 100) + levers.extraIncome
      const opCost = levers.operatingCost * (1 - levers.costCut / 100)
      const repay = levers.usePlanner ? (repayByMonth.get(m) ?? 0) : 0
      const net = revenue - opCost - repay
      cum += net
      return { month: m, label: m.replace("-", "/"), revenue, opCost, repay, net, cash: cum }
    })
  }, [months, revenueByMonth, repayByMonth, levers])

  const summary = useMemo(() => {
    const annualNet = projection.reduce((s, r) => s + r.net, 0)
    const lowest = projection.reduce((a, b) => (a.cash <= b.cash ? a : b), projection[0])
    const shortageMonths = projection.filter((r) => r.cash < 0).length
    return { annualNet, lowest, shortageMonths }
  }, [projection])

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levers))
  }
  function setLever<K extends keyof Levers>(k: K, v: Levers[K]) {
    setLevers((l) => ({ ...l, [k]: v }))
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            沙盤推演 2.0 · 未來現金模擬
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            調整「收入成長 / 成本刪減 / 還款計畫」，看未來 12 個月現金走勢與最低點
          </p>
        </div>
        <Link href="/financial-cockpit">
          <span className="text-sm text-indigo-600 hover:underline cursor-pointer inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> 回駕駛艙
          </span>
        </Link>
      </div>

      {/* 三軸控制 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">情境調整</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SliderField
            label={`收入成長 ${levers.revenueGrowth > 0 ? "+" : ""}${levers.revenueGrowth}%`}
            icon={<TrendingUp className="h-4 w-4 text-green-600" />}
            value={levers.revenueGrowth}
            min={-30}
            max={50}
            onChange={(v) => setLever("revenueGrowth", v)}
          />
          <SliderField
            label={`營運成本刪減 ${levers.costCut}%`}
            icon={<TrendingDown className="h-4 w-4 text-red-500" />}
            value={levers.costCut}
            min={0}
            max={40}
            onChange={(v) => setLever("costCut", v)}
          />
          <div>
            <Label className="text-xs">每月額外增收</Label>
            <Input
              type="number"
              value={levers.extraIncome || ""}
              onChange={(e) => setLever("extraIncome", parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div>
            <Label className="text-xs">期初現金餘額</Label>
            <Input
              type="number"
              value={levers.startingCash || ""}
              onChange={(e) => setLever("startingCash", parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div>
            <Label className="text-xs">每月營運固定成本（預設帶入模板）</Label>
            <Input
              type="number"
              value={levers.operatingCost || ""}
              onChange={(e) => setLever("operatingCost", parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={levers.usePlanner}
                onChange={(e) => setLever("usePlanner", e.target.checked)}
              />
              採用排程規劃台的還款計畫
            </label>
          </div>
        </CardContent>
      </Card>

      {/* 摘要卡 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          title="12 月累計淨現金流"
          value={fmt(summary.annualNet)}
          tone={summary.annualNet < 0 ? "text-red-600" : "text-green-600"}
        />
        <SummaryCard
          title="最低現金點"
          value={summary.lowest ? `${summary.lowest.label} · ${fmt(summary.lowest.cash)}` : "—"}
          tone={summary.lowest && summary.lowest.cash < 0 ? "text-red-600" : "text-indigo-600"}
        />
        <SummaryCard
          title="現金為負月數"
          value={`${summary.shortageMonths} 個月`}
          tone={summary.shortageMonths > 0 ? "text-red-600" : "text-green-600"}
        />
      </div>

      {summary.lowest && summary.lowest.cash < 0 && (
        <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          依此情境，現金將在 <span className="font-bold">{summary.lowest.label}</span> 跌到{" "}
          <span className="font-bold">{fmt(summary.lowest.cash)}</span>
          。建議提高收入成長、刪減成本，或到排程規劃台把還款往後延。
        </div>
      )}

      {/* 現金走勢圖 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">期末現金走勢</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={projection} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="cash"
                name="期末現金"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 逐月明細 */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">逐月明細</CardTitle>
          <Button size="sm" variant="outline" onClick={save}>
            <Save className="h-4 w-4 mr-1" /> 儲存情境
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月份</TableHead>
                  <TableHead className="text-right">收入</TableHead>
                  <TableHead className="text-right">營運成本</TableHead>
                  <TableHead className="text-right">還款</TableHead>
                  <TableHead className="text-right">淨現金流</TableHead>
                  <TableHead className="text-right">期末現金</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projection.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="whitespace-nowrap">{r.label}</TableCell>
                    <TableCell className="text-right text-green-700">{fmt(r.revenue)}</TableCell>
                    <TableCell className="text-right text-red-500">{fmt(r.opCost)}</TableCell>
                    <TableCell className="text-right text-orange-600">{fmt(r.repay)}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${r.net < 0 ? "text-red-600" : "text-green-700"}`}
                    >
                      {r.net >= 0 ? "+" : ""}
                      {fmt(r.net)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold ${r.cash < 0 ? "text-red-600" : ""}`}
                    >
                      {fmt(r.cash)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        💡 收入基準採現金流預測、還款採排程規劃台的規劃、營運成本採週期模板月總額（可調）。
        純沙盤模擬，不影響任何實際資料。
      </p>
    </div>
  )
}

function SliderField({
  label,
  icon,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  icon: React.ReactNode
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <Label className="text-xs flex items-center gap-1">
        {icon}
        {label}
      </Label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full mt-2 accent-indigo-600"
      />
    </div>
  )
}

function SummaryCard({ title, value, tone }: { title: string; value: string; tone: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className={`text-lg font-bold mt-1 ${tone}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
