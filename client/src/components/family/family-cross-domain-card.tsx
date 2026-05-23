/**
 * 跨領域整合視圖 Card（階段 4.3）
 * - 聚合家用 / 小孩任務 / PM / PMS / 待批准 5 個 KPI
 * - 顯示收支差額（淨值）
 */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CrossDomainOverview {
  month: string
  kpis: {
    householdExpense: number
    kidsApproved: number
    pmConfirmed: number
    pmsConfirmed: number
    pendingAmount: number
    pendingCount: number
  }
  totals: {
    totalIncome: number
    totalExpense: number
    netDiff: number
  }
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function recentMonths(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`)
  }
  return out
}

export function FamilyCrossDomainCard() {
  const [month, setMonth] = useState<string>(currentMonth)
  const { data, isLoading } = useQuery<CrossDomainOverview>({
    queryKey: [`/api/family/cross-domain-overview?month=${month}`],
    staleTime: 60 * 1000,
  })

  const months = recentMonths(12)

  return (
    <Card className="border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">🌐 跨領域整合視圖</CardTitle>
          <CardDescription>{month} · 家用 + 小孩 + PM/PMS 收支總覽</CardDescription>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="text-sm text-gray-500">載入中...</div>}
        {!isLoading && data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
              <Kpi label="家用支出" value={data.kpis.householdExpense} color="rose" icon="🏠" />
              <Kpi label="小孩任務" value={data.kpis.kidsApproved} color="amber" icon="🧒" />
              <Kpi label="PM 確認" value={data.kpis.pmConfirmed} color="emerald" icon="🏨" />
              <Kpi label="PMS 完成" value={data.kpis.pmsConfirmed} color="cyan" icon="📊" />
              <Kpi
                label="待批准"
                value={data.kpis.pendingAmount}
                color="orange"
                icon="⏳"
                subtitle={`${data.kpis.pendingCount} 筆`}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <SummaryRow
                label="總收入"
                value={data.totals.totalIncome}
                color="text-emerald-700 bg-emerald-50 border-emerald-200"
              />
              <SummaryRow
                label="總支出"
                value={data.totals.totalExpense}
                color="text-rose-700 bg-rose-50 border-rose-200"
              />
              <SummaryRow
                label={data.totals.netDiff >= 0 ? "淨流入" : "淨流出"}
                value={Math.abs(data.totals.netDiff)}
                color={
                  data.totals.netDiff >= 0
                    ? "text-emerald-800 bg-emerald-100 border-emerald-300 font-bold"
                    : "text-rose-800 bg-rose-100 border-rose-300 font-bold"
                }
                sign={data.totals.netDiff >= 0 ? "+" : "-"}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Kpi({
  label,
  value,
  color,
  icon,
  subtitle,
}: {
  label: string
  value: number
  color: "rose" | "amber" | "emerald" | "cyan" | "orange"
  icon: string
  subtitle?: string
}) {
  const colorMap: Record<typeof color, string> = {
    rose: "border-rose-200 text-rose-700",
    amber: "border-amber-200 text-amber-700",
    emerald: "border-emerald-200 text-emerald-700",
    cyan: "border-cyan-200 text-cyan-700",
    orange: "border-orange-200 text-orange-700",
  }
  return (
    <div className={`bg-white rounded-lg border p-2 ${colorMap[color]}`}>
      <div className="text-[10px] text-gray-500 flex items-center gap-1">
        <span>{icon}</span>
        {label}
      </div>
      <div className="font-bold text-sm">NT$ {value.toLocaleString()}</div>
      {subtitle && <div className="text-[9px] text-gray-400">{subtitle}</div>}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  color,
  sign,
}: {
  label: string
  value: number
  color: string
  sign?: string
}) {
  return (
    <div className={`rounded-lg border p-2 text-center ${color}`}>
      <div className="text-[10px]">{label}</div>
      <div className="text-sm">
        {sign ?? ""}NT$ {value.toLocaleString()}
      </div>
    </div>
  )
}
