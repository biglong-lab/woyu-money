/**
 * 帳單到期看板 — 通盤本月/近期應繳（法定付款日 + 強執分期），避免遲繳
 */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarClock, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatNT } from "@/lib/utils"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"

interface Bill {
  source: string
  refId: number
  name: string
  amount: number
  billIssuedDate: string | null
  dueDate: string | null
  daysUntil: number
  overdue: boolean
  urgency: "overdue" | "soon" | "upcoming"
}
interface BillsData {
  today: string
  days: number
  count: number
  totalDue: number
  overdueTotal: number
  bills: Bill[]
}

const URGENCY: Record<string, { label: string; cls: string }> = {
  overdue: { label: "逾期", cls: "bg-red-100 text-red-800 border-red-300" },
  soon: { label: "7天內", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  upcoming: { label: "近期", cls: "bg-gray-100 text-gray-600 border-gray-200" },
}

export default function BillsPage() {
  useDocumentTitle("帳單到期看板")
  const [days, setDays] = useState("45")
  const { data, isLoading } = useQuery<BillsData>({
    queryKey: [`/api/bills/upcoming?days=${days}`],
  })

  return (
    <div className="container mx-auto py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <CalendarClock className="h-6 w-6 text-indigo-600" />
            帳單到期看板
          </h1>
          <p className="text-gray-500 text-sm">
            通盤近期應繳：法定付款日優先 + 強執分期每月應付，逾期/即將到期一眼看，避免遲繳
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-32" data-testid="days-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["15", "30", "45", "60", "90"].map((d) => (
              <SelectItem key={d} value={d}>
                未來 {d} 天
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">應繳合計</div>
              <div className="text-xl font-bold">{formatNT(data.totalDue)}</div>
              <div className="text-xs text-gray-400">{data.count} 筆</div>
            </CardContent>
          </Card>
          <Card className={data.overdueTotal > 0 ? "border-red-200 bg-red-50/50" : ""}>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <AlertCircle
                  className={`h-3 w-3 ${data.overdueTotal > 0 ? "text-red-500" : "text-gray-400"}`}
                />
                逾期金額
              </div>
              <div className={`text-xl font-bold ${data.overdueTotal > 0 ? "text-red-600" : ""}`}>
                {formatNT(data.overdueTotal)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">應繳清單</CardTitle>
          <CardDescription>依到期日排序；強執分期自動投影本月與下月應付</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {isLoading ? (
            <div className="text-center text-gray-400 py-6">載入中…</div>
          ) : !data || data.bills.length === 0 ? (
            <div className="text-center text-gray-400 py-6">近期無待繳帳單 🎉</div>
          ) : (
            data.bills.map((b, i) => {
              const u = URGENCY[b.urgency]
              return (
                <div
                  key={`${b.source}-${b.refId}-${i}`}
                  className="flex items-center gap-3 border-b py-2 text-sm flex-wrap"
                  data-testid={`bill-${b.source}-${b.refId}`}
                >
                  <span className="font-bold w-24 shrink-0">{formatNT(b.amount)}</span>
                  <Badge className={`shrink-0 border ${u.cls}`}>{u.label}</Badge>
                  <div className="flex-1 min-w-[140px]">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-gray-400">
                      法定付款 {b.dueDate ?? "—"}
                      {b.billIssuedDate ? ` · 帳單到 ${b.billIssuedDate}` : ""}
                    </div>
                  </div>
                  <span
                    className={`text-xs shrink-0 ${b.overdue ? "text-red-600 font-medium" : "text-gray-500"}`}
                  >
                    {b.overdue ? `逾期 ${-b.daysUntil} 天` : `${b.daysUntil} 天後`}
                  </span>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
      <BackToTop />
    </div>
  )
}
