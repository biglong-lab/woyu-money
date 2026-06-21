/**
 * 成本結構年度視圖（中樞）
 * 五桶（租金/人事含勞健保/固定開銷/流水雜支/其他單項）× 12 月，
 * 成本組成占比 + 預算 vs 實際 + 下鑽到各矩陣/明細。
 */
import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ExternalLink } from "lucide-react"
import { formatNT } from "@/lib/utils"

interface BucketCell {
  month: number
  budget: number
  actual: number
}
interface BucketRow {
  key: string
  label: string
  cells: BucketCell[]
  budgetTotal: number
  actualTotal: number
  sharePct: number
}
interface AnnualData {
  year: number
  months: number[]
  buckets: BucketRow[]
  monthly: Array<{ month: number; budget: number; actual: number }>
  totals: { budget: number; actual: number; diff: number }
}

const MONTH_LABELS = [
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

// 各桶顏色 + 下鑽連結
const BUCKET_META: Record<string, { bar: string; chip: string; href: string; drill: string }> = {
  rental: {
    bar: "bg-rose-400",
    chip: "bg-rose-50 text-rose-700",
    href: "/rental-matrix",
    drill: "租金矩陣",
  },
  hr: {
    bar: "bg-purple-400",
    chip: "bg-purple-50 text-purple-700",
    href: "/labor-insurance-matrix",
    drill: "勞健保矩陣",
  },
  fixed: {
    bar: "bg-amber-400",
    chip: "bg-amber-50 text-amber-700",
    href: "/fixed-expense-matrix",
    drill: "固定開銷矩陣",
  },
  ledger: {
    bar: "bg-emerald-400",
    chip: "bg-emerald-50 text-emerald-700",
    href: "/document-inbox",
    drill: "記帳窗口",
  },
  manual: {
    bar: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700",
    href: "/payment-records",
    drill: "付款記錄",
  },
}

export default function CostStructureAnnualView({ year }: { year: number }) {
  const { data, isLoading } = useQuery<AnnualData>({
    queryKey: [`/api/dashboard/cost-structure/annual?year=${year}`],
  })

  if (isLoading) return <div className="text-center text-gray-400 py-8">載入中…</div>
  if (!data) return null

  const grand = data.totals.actual

  return (
    <div className="space-y-4">
      {/* 預算 vs 實際 總結 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">年度預算</div>
            <div className="text-xl font-bold">{formatNT(data.totals.budget)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">年度實際</div>
            <div className="text-xl font-bold">{formatNT(data.totals.actual)}</div>
          </CardContent>
        </Card>
        <Card
          className={
            data.totals.diff > 0 ? "border-red-200 bg-red-50/50" : "border-green-200 bg-green-50/50"
          }
        >
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">差異（實際−預算）</div>
            <div
              className={`text-xl font-bold ${data.totals.diff > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {data.totals.diff > 0 ? "+" : ""}
              {formatNT(data.totals.diff)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 成本組成占比 */}
      <Card>
        <CardHeader>
          <CardTitle>成本組成（依實際）</CardTitle>
          <CardDescription>各成本類別占比，點類別前往對應矩陣/明細</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 堆疊條 */}
          <div className="flex w-full h-5 rounded overflow-hidden border">
            {data.buckets.map((b) =>
              b.actualTotal > 0 ? (
                <div
                  key={b.key}
                  className={BUCKET_META[b.key]?.bar ?? "bg-gray-300"}
                  style={{ width: `${grand > 0 ? (b.actualTotal / grand) * 100 : 0}%` }}
                  title={`${b.label} ${b.sharePct}%`}
                />
              ) : null
            )}
          </div>
          {/* 圖例 + 下鑽 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.buckets.map((b) => {
              const meta = BUCKET_META[b.key]
              return (
                <Link key={b.key} href={meta?.href ?? "#"}>
                  <div
                    className={`flex items-center justify-between rounded px-3 py-2 cursor-pointer hover:opacity-80 ${meta?.chip ?? "bg-gray-50"}`}
                    data-testid={`bucket-${b.key}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-3 h-3 rounded-sm ${meta?.bar ?? "bg-gray-300"}`}
                      />
                      <span className="font-medium">{b.label}</span>
                      <span className="text-xs opacity-70">{b.sharePct}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      {formatNT(b.actualTotal)}
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 五桶 ×12 月矩陣 */}
      <Card>
        <CardHeader>
          <CardTitle>{year} 年成本結構矩陣</CardTitle>
          <CardDescription>每格上=實際、下=預算；點左側類別前往對應矩陣下鑽</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 sticky left-0 bg-white z-10 min-w-[120px]">類別</th>
                {MONTH_LABELS.map((m) => (
                  <th key={m} className="p-1 text-center text-xs text-gray-500 min-w-[66px]">
                    {m}
                  </th>
                ))}
                <th className="p-2 text-center text-xs text-gray-500 min-w-[84px]">小計</th>
              </tr>
            </thead>
            <tbody>
              {data.buckets.map((b) => {
                const meta = BUCKET_META[b.key]
                return (
                  <tr key={b.key} className="border-t" data-testid={`row-${b.key}`}>
                    <td className="p-2 sticky left-0 bg-white z-10">
                      <Link href={meta?.href ?? "#"}>
                        <div className="flex items-center gap-1 cursor-pointer hover:text-blue-600">
                          <span
                            className={`inline-block w-3 h-3 rounded-sm ${meta?.bar ?? "bg-gray-300"}`}
                          />
                          <span className="font-medium">{b.label}</span>
                          <ExternalLink className="h-3 w-3 opacity-40" />
                        </div>
                        <div className="text-[10px] text-gray-400">{meta?.drill}</div>
                      </Link>
                    </td>
                    {b.cells.map((c) => (
                      <td key={c.month} className="p-1 text-center">
                        <div
                          className={`rounded px-0.5 py-1 ${c.actual > 0 || c.budget > 0 ? "bg-gray-50" : ""}`}
                          title={`${MONTH_LABELS[c.month - 1]} ${b.label}\n實際 ${formatNT(c.actual)}\n預算 ${formatNT(c.budget)}`}
                        >
                          <div className="text-[11px] font-semibold leading-tight">
                            {c.actual > 0 ? formatNT(c.actual) : c.budget > 0 ? "—" : ""}
                          </div>
                          {c.budget > 0 && (
                            <div className="text-[10px] text-gray-400 leading-tight">
                              {formatNT(c.budget)}
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="p-2 text-center">
                      <div className="font-bold text-xs">{formatNT(b.actualTotal)}</div>
                      {b.budgetTotal > 0 && (
                        <div className="text-[10px] text-gray-400">/ {formatNT(b.budgetTotal)}</div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {/* 每月合計 */}
              <tr className="border-t-2 bg-gray-50 font-medium">
                <td className="p-2 sticky left-0 bg-gray-50 z-10">每月合計</td>
                {data.monthly.map((mt) => (
                  <td key={mt.month} className="p-1 text-center text-[11px]">
                    <div className="font-semibold">{mt.actual > 0 ? formatNT(mt.actual) : "—"}</div>
                    {mt.budget > 0 && (
                      <div className="text-[10px] text-gray-400">{formatNT(mt.budget)}</div>
                    )}
                  </td>
                ))}
                <td className="p-2 text-center text-xs font-bold">
                  {formatNT(data.totals.actual)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
