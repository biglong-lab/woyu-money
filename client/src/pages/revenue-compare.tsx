/**
 * 收入比對儀表板 — PMS vs PM
 *
 * PMS（開發票/正式收款，最準）vs PM（每日逐筆收款記錄）
 * 目標：兩系統每月趨近一致，差距 = 待補齊的記錄落差
 */

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts"
import {
  RefreshCw, TrendingUp, TrendingDown, CheckCircle2,
  AlertTriangle, BarChart3, Info, ChevronDown, ChevronRight, Minus,
} from "lucide-react"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────

interface BranchDetail {
  branchId: number
  branchName: string
  branchCode: string
  revenue: number
  lastDate: string
}

interface CompareRow {
  month: string
  pms: { total: number; branches: number; branchDetail: BranchDetail[] }
  pm: { total: number; records: number }
  diff: number
  diffPct: number | null
  status: "match" | "pms_higher" | "pm_higher" | "insufficient_pm"
}

interface CompareData {
  startMonth: string
  endMonth: string
  comparison: CompareRow[]
}

// ─────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────

const fmtM = (v: number) => `NT$${Math.round(v).toLocaleString()}`
const fmtDiff = (v: number) => {
  const abs = Math.abs(Math.round(v)).toLocaleString()
  return v >= 0 ? `+${abs}` : `-${abs}`
}

function monthOptions() {
  const list: string[] = []
  let cur = new Date("2025-07-01")
  const now = new Date()
  while (cur <= now) {
    list.push(cur.toISOString().slice(0, 7))
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return list.reverse()
}

function statusBadge(status: CompareRow["status"], diff: number) {
  if (status === "insufficient_pm")
    return (
      <Badge variant="outline" className="border-gray-300 text-gray-500 text-xs">
        <Minus className="h-3 w-3 mr-1" />PM 資料不足
      </Badge>
    )
  if (status === "match")
    return (
      <Badge variant="outline" className="border-green-500 text-green-600 text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1" />吻合
      </Badge>
    )
  if (status === "pms_higher")
    return (
      <Badge variant="outline" className="border-orange-400 text-orange-600 text-xs">
        <TrendingUp className="h-3 w-3 mr-1" />PMS 高 {fmtDiff(diff)}
      </Badge>
    )
  return (
    <Badge variant="outline" className="border-red-400 text-red-600 text-xs">
      <TrendingDown className="h-3 w-3 mr-1" />PM 高 {fmtDiff(Math.abs(diff))}
    </Badge>
  )
}

// ─────────────────────────────────────────────
// 圖表 Tooltip
// ─────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-900 border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-6">
          <span style={{ color: p.fill || p.stroke }}>{p.name}</span>
          <span className="font-medium">NT${Math.round(p.value).toLocaleString()}</span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="border-t mt-2 pt-2 flex justify-between gap-6 text-muted-foreground">
          <span>差距</span>
          <span className={payload[0].value - payload[1].value >= 0 ? "text-orange-500" : "text-red-500"}>
            {fmtDiff(payload[0].value - payload[1].value)}
          </span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────

export default function RevenueCompare() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const currentMonth = new Date().toISOString().slice(0, 7)
  const [startMonth, setStartMonth] = useState("2025-08")
  const [endMonth, setEndMonth]     = useState(currentMonth)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

  // ── 資料查詢 ──
  const { data, isLoading, refetch } = useQuery<CompareData>({
    queryKey: ["/api/pms-bridge/compare", startMonth, endMonth],
    queryFn: async () => {
      const res = await fetch(`/api/pms-bridge/compare?startMonth=${startMonth}&endMonth=${endMonth}`)
      if (!res.ok) throw new Error("載入失敗")
      return res.json()
    },
  })

  // ── 同步 PMS ──
  const syncPms = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pms-bridge/sync", { startMonth, endMonth }),
    onSuccess: (res: any) => {
      toast({ title: "PMS 同步完成", description: res.message })
      queryClient.invalidateQueries({ queryKey: ["/api/pms-bridge/compare"] })
      refetch()
    },
    onError: () => toast({ title: "PMS 同步失敗", variant: "destructive" }),
  })

  // ── 同步 PM ──
  const syncPm = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/pm-bridge/sync", {
        startDate: `${startMonth}-01`,
        endDate:   `${endMonth}-31`,
      }),
    onSuccess: (res: any) => {
      toast({ title: "PM 同步完成", description: `新增 ${res.synced} 筆，略過 ${res.skipped} 筆` })
      queryClient.invalidateQueries({ queryKey: ["/api/pms-bridge/compare"] })
      refetch()
    },
    onError: () => toast({ title: "PM 同步失敗", variant: "destructive" }),
  })

  // ── 一鍵同步兩者 ──
  const syncBoth = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/pms-bridge/sync", { startMonth, endMonth })
      return apiRequest("POST", "/api/pm-bridge/sync", {
        startDate: `${startMonth}-01`,
        endDate:   `${endMonth}-31`,
      })
    },
    onSuccess: () => {
      toast({ title: "同步完成", description: "PMS 與 PM 資料已更新" })
      queryClient.invalidateQueries({ queryKey: ["/api/pms-bridge/compare"] })
      refetch()
    },
    onError: () => toast({ title: "同步失敗", variant: "destructive" }),
  })

  const comparison = data?.comparison ?? []

  // 過濾有效月份（PM 有足夠資料）
  const validComparison = comparison.filter((r) => r.status !== "insufficient_pm")

  // 統計
  const totalPms   = validComparison.reduce((s, r) => s + r.pms.total, 0)
  const totalPm    = validComparison.reduce((s, r) => s + r.pm.total,  0)
  const totalDiff  = totalPms - totalPm
  const matchCount = validComparison.filter((r) => r.status === "match").length
  const avgAbsDiffPct =
    validComparison.length > 0
      ? validComparison.reduce((s, r) => s + Math.abs(r.diffPct ?? 0), 0) / validComparison.length
      : 0

  // 圖表資料
  const chartData = comparison.map((r) => ({
    month:  r.month.slice(2),   // 短月份 "25-08"
    PMS:    r.pms.total,
    PM:     r.pm.total,
    差距:   Math.abs(r.diff),
    status: r.status,
  }))

  const isSyncing = syncBoth.isPending || syncPms.isPending || syncPm.isPending

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">

      {/* ── 標題列 ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            PMS vs PM 收入比對
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            PMS 為基準（最準）·  目標：兩系統每月數字一致
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => syncPm.mutate()}
            disabled={isSyncing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncPm.isPending ? "animate-spin" : ""}`} />
            更新 PM
          </Button>
          <Button variant="outline" size="sm" onClick={() => syncPms.mutate()}
            disabled={isSyncing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncPms.isPending ? "animate-spin" : ""}`} />
            更新 PMS
          </Button>
          <Button size="sm" onClick={() => syncBoth.mutate()} disabled={isSyncing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncBoth.isPending ? "animate-spin" : ""}`} />
            兩者同步
          </Button>
        </div>
      </div>

      {/* ── 說明條 ── */}
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-700 dark:text-blue-300">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
        <div className="space-y-0.5">
          <span className="font-medium">PMS</span>（績效/發票系統）= 官方收款，4個分店月底彙總。
          <span className="font-medium ml-2">PM</span>（旅館系統）= 每日逐筆記錄。
          差距需找出原因補齊。
        </div>
      </div>

      {/* ── 期間篩選 ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">期間</span>
        <Select value={startMonth} onValueChange={setStartMonth}>
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions().map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">～</span>
        <Select value={endMonth} onValueChange={setEndMonth}>
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions().map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 text-sm">
          查詢
        </Button>
      </div>

      {/* ── 統計卡片 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "PMS 合計", sub: "發票/正式收款",
            value: fmtM(totalPms), color: "text-blue-600",
          },
          {
            label: "PM 合計", sub: "每日逐筆",
            value: fmtM(totalPm), color: "text-emerald-600",
          },
          {
            label: "總差距", sub: totalDiff > 0 ? "PMS 較高" : totalDiff < 0 ? "PM 較高" : "完全吻合",
            value: `${fmtDiff(totalDiff)}`,
            color: Math.abs(totalDiff) < 5000 ? "text-green-600" : totalDiff > 0 ? "text-orange-500" : "text-red-500",
          },
          {
            label: "月份吻合", sub: `平均差距 ${avgAbsDiffPct.toFixed(1)}%`,
            value: `${matchCount} / ${validComparison.length}`,
            color: matchCount === validComparison.length ? "text-green-600" : "text-orange-500",
          },
        ].map(({ label, sub, value, color }) => (
          <Card key={label}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">{label}</CardDescription>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── 長條圖：PMS vs PM ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">月度收入對比圖</CardTitle>
          <CardDescription className="text-xs">藍色 = PMS，綠色 = PM（差距越小越好）</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">載入中…</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `${(v / 10000).toFixed(0)}萬`}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="PMS" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={48} />
                <Bar dataKey="PM"  fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── 月度比對明細表 ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">月度比對明細</CardTitle>
          <CardDescription className="text-xs">點選月份可展開 PMS 各分店明細</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">載入中…</div>
          ) : comparison.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              無資料，請點「兩者同步」後再查詢
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8" />
                  <TableHead className="text-xs">月份</TableHead>
                  <TableHead className="text-right text-xs text-blue-600">PMS 收入</TableHead>
                  <TableHead className="text-right text-xs text-emerald-600">PM 收入</TableHead>
                  <TableHead className="text-right text-xs">差距</TableHead>
                  <TableHead className="text-center text-xs">狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.map((row) => {
                  const isExpanded = expandedMonth === row.month
                  const absDiff   = Math.abs(row.diff)
                  const diffColor =
                    row.status === "insufficient_pm"  ? "text-gray-400" :
                    row.status === "match"             ? "text-green-600" :
                    row.diff > 0                       ? "text-orange-500" : "text-red-500"

                  return (
                    <>
                      <Collapsible
                        key={row.month}
                        open={isExpanded}
                        onOpenChange={(open) => setExpandedMonth(open ? row.month : null)}
                        asChild
                      >
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer hover:bg-muted/50">
                              {/* 展開按鈕 */}
                              <TableCell className="w-8 py-2 pl-4">
                                {row.pms.branchDetail.length > 0
                                  ? isExpanded
                                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  : null}
                              </TableCell>

                              {/* 月份 */}
                              <TableCell className="py-2 font-medium text-sm">{row.month}</TableCell>

                              {/* PMS */}
                              <TableCell className="text-right py-2">
                                <div className="font-semibold text-blue-600 text-sm">
                                  {fmtM(row.pms.total)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {row.pms.branches} 分店
                                </div>
                              </TableCell>

                              {/* PM */}
                              <TableCell className="text-right py-2">
                                <div className={`font-semibold text-sm ${row.status === "insufficient_pm" ? "text-gray-400" : "text-emerald-600"}`}>
                                  {row.status === "insufficient_pm"
                                    ? <span className="text-xs text-muted-foreground">({row.pm.records} 筆，資料不足)</span>
                                    : fmtM(row.pm.total)}
                                </div>
                                {row.status !== "insufficient_pm" && (
                                  <div className="text-xs text-muted-foreground">
                                    {row.pm.records.toLocaleString()} 筆
                                  </div>
                                )}
                              </TableCell>

                              {/* 差距 */}
                              <TableCell className="text-right py-2">
                                {row.status === "insufficient_pm" ? (
                                  <span className="text-xs text-muted-foreground">–</span>
                                ) : (
                                  <>
                                    <span className={`font-semibold text-sm ${diffColor}`}>
                                      {fmtDiff(row.diff)}
                                    </span>
                                    {row.diffPct !== null && (
                                      <div className={`text-xs ${diffColor}`}>
                                        {row.diff >= 0 ? "+" : ""}{row.diffPct?.toFixed(1)}%
                                      </div>
                                    )}
                                  </>
                                )}
                              </TableCell>

                              {/* 狀態 */}
                              <TableCell className="text-center py-2">
                                {statusBadge(row.status, row.diff)}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>

                          {/* 分店明細展開 */}
                          <CollapsibleContent asChild>
                            <>
                              {row.pms.branchDetail.map((b) => (
                                <TableRow
                                  key={`${row.month}-${b.branchId}`}
                                  className="bg-blue-50/50 dark:bg-blue-950/10"
                                >
                                  <TableCell />
                                  <TableCell className="py-1.5 pl-8 text-xs text-muted-foreground">
                                    <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 mr-2">
                                      {b.branchCode}
                                    </span>
                                    {b.branchName}
                                    <span className="ml-2 text-gray-400 text-[11px]">
                                      ({b.lastDate})
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right py-1.5 text-sm text-blue-600 font-medium">
                                    {fmtM(b.revenue)}
                                  </TableCell>
                                  <TableCell colSpan={3} />
                                </TableRow>
                              ))}
                            </>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    </>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── 差距解讀 ── */}
      <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/10">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            差距解讀參考
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-orange-600 mb-1">PMS 較高（常見）</p>
              <ul className="space-y-0.5 list-disc list-inside text-xs">
                <li>現金收款已開發票，但 PM 未登錄</li>
                <li>轉帳收款只在 PMS 確認，PM 尚未補錄</li>
                <li>月底 PMS 結算包含先前漏記金額</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-red-600 mb-1">PM 較高（需追查）</p>
              <ul className="space-y-0.5 list-disc list-inside text-xs">
                <li>PM 已收款但 PMS 尚未開立發票</li>
                <li>月底 PMS 更新尚未完成</li>
                <li>退款已在 PM 退回，但 PMS 未扣除</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
