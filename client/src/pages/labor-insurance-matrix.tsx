/**
 * 勞健保月度矩陣
 * 三列（勞保/健保/勞退）× 12 月，跨員工加總雇主負擔 + 每月已繳狀態，可一鍵標記整月已繳
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Shield, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { formatNT } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"

type MonthPayStatus = "paid" | "partial" | "unpaid" | "none"

interface MatrixCell {
  month: number
  amount: number
}
interface MatrixRow {
  key: string
  label: string
  cells: MatrixCell[]
  total: number
}
interface MonthSummary {
  month: number
  total: number
  paidCount: number
  recordCount: number
  status: MonthPayStatus
}
interface MatrixData {
  year: number
  months: number[]
  rows: MatrixRow[]
  monthly: MonthSummary[]
  grandTotal: number
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

const STATUS_META: Record<MonthPayStatus, { label: string; bg: string; icon: string }> = {
  paid: { label: "已繳", bg: "bg-green-100 text-green-800 border-green-200", icon: "✅" },
  partial: { label: "部分", bg: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: "🟡" },
  unpaid: { label: "未繳", bg: "bg-red-100 text-red-800 border-red-300", icon: "🔴" },
  none: { label: "無資料", bg: "bg-gray-50 text-gray-300 border-transparent", icon: "—" },
}

export default function LaborInsuranceMatrixPage() {
  useDocumentTitle("勞健保矩陣")
  const { toast } = useToast()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())

  const url = `/api/labor-insurance-matrix?year=${year}`
  const { data, isLoading } = useQuery<MatrixData>({ queryKey: [url] })
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  const invalidate = () => {
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0] as string).startsWith("/api/labor-insurance-matrix"),
    })
  }

  const markPaidMutation = useMutation({
    mutationFn: async (month: number) =>
      apiRequest("POST", "/api/labor-insurance-matrix/mark-paid", { year, month }),
    onSuccess: (_d, month) => {
      invalidate()
      toast({ title: "✅ 已標記已繳", description: `${year} 年 ${month} 月勞健保` })
    },
    onError: (e: Error) =>
      toast({ title: "操作失敗", description: e.message, variant: "destructive" }),
  })

  const statusOf = (m: number): MonthPayStatus =>
    data?.monthly.find((x) => x.month === m)?.status ?? "none"

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <Shield className="h-6 w-6" />
            勞健保月度矩陣
          </h1>
          <p className="text-gray-500">
            勞保 / 健保 / 勞退 ×12 月（雇主負擔），全年成本一眼看。勞保列含就業＋職災保險
          </p>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28" data-testid="year-select">
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
      </div>

      {/* 彙總 */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.rows.map((r) => (
            <Card key={r.key}>
              <CardContent className="p-4">
                <div className="text-xs text-gray-500">{r.label}（年）</div>
                <div className="text-xl font-bold">{formatNT(r.total)}</div>
              </CardContent>
            </Card>
          ))}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">年度合計</div>
              <div className="text-xl font-bold text-blue-700">{formatNT(data.grandTotal)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 圖例 */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-700">
        {(
          Object.entries(STATUS_META) as [MonthPayStatus, (typeof STATUS_META)[MonthPayStatus]][]
        ).map(([k, meta]) => (
          <span key={k} className={`px-2 py-0.5 rounded border ${meta.bg}`}>
            {meta.icon} {meta.label}
          </span>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{year} 年勞健保矩陣</CardTitle>
          <CardDescription>
            金額為雇主每月負擔；底部「狀態」列可一鍵把整月標記已繳。資料來自人事費（先到「人事費管理」產生月度記錄）
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">載入中…</div>
          ) : !data || data.grandTotal === 0 ? (
            <div className="text-center text-gray-400 py-8">
              {year} 年尚無勞健保資料。請先到「人事費管理」產生各月人事費記錄。
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-white z-10 min-w-[90px]">項目</th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} className="p-1 text-center text-xs text-gray-500 min-w-[70px]">
                      {m}
                    </th>
                  ))}
                  <th className="p-2 text-center text-xs text-gray-500 min-w-[90px]">小計</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.key} className="border-t" data-testid={`row-${r.key}`}>
                    <td className="p-2 sticky left-0 bg-white z-10 font-medium">{r.label}</td>
                    {r.cells.map((c) => {
                      const st = STATUS_META[statusOf(c.month)]
                      return (
                        <td key={c.month} className="p-1 text-center">
                          <div
                            className={`border rounded py-1 px-0.5 text-[11px] font-semibold ${c.amount > 0 ? st.bg : "bg-gray-50 text-gray-300 border-transparent"}`}
                            title={`${MONTH_LABELS[c.month - 1]} ${r.label}：${formatNT(c.amount)}`}
                            data-testid={`cell-${r.key}-${c.month}`}
                          >
                            {c.amount > 0 ? formatNT(c.amount) : "—"}
                          </div>
                        </td>
                      )
                    })}
                    <td className="p-2 text-center font-bold text-xs">{formatNT(r.total)}</td>
                  </tr>
                ))}
                {/* 每月合計 */}
                <tr className="border-t-2 bg-gray-50 font-medium">
                  <td className="p-2 sticky left-0 bg-gray-50 z-10">每月合計</td>
                  {data.monthly.map((mt) => (
                    <td key={mt.month} className="p-1 text-center text-[11px] font-semibold">
                      {mt.total > 0 ? formatNT(mt.total) : "—"}
                    </td>
                  ))}
                  <td className="p-2 text-center text-xs font-bold">{formatNT(data.grandTotal)}</td>
                </tr>
                {/* 狀態 + 一鍵已繳 */}
                <tr className="border-t">
                  <td className="p-2 sticky left-0 bg-white z-10 text-xs text-gray-500">
                    繳費狀態
                  </td>
                  {data.monthly.map((mt) => {
                    const meta = STATUS_META[mt.status]
                    const canPay = mt.status === "unpaid" || mt.status === "partial"
                    return (
                      <td key={mt.month} className="p-1 text-center">
                        <button
                          type="button"
                          disabled={!canPay || markPaidMutation.isPending}
                          onClick={() => canPay && markPaidMutation.mutate(mt.month)}
                          className={`w-full border rounded py-1 text-[11px] ${meta.bg} ${canPay ? "cursor-pointer hover:opacity-80 active:scale-95" : "cursor-default"}`}
                          title={
                            canPay
                              ? `👆 點此標記 ${mt.month} 月勞健保已繳`
                              : `${meta.label}（${mt.paidCount}/${mt.recordCount}）`
                          }
                          data-testid={`status-${mt.month}`}
                        >
                          {meta.icon}
                        </button>
                      </td>
                    )
                  })}
                  <td className="p-2 text-center">
                    <CheckCircle2 className="h-4 w-4 text-gray-300 mx-auto" />
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <BackToTop />
    </div>
  )
}
