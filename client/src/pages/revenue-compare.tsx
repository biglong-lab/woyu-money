/**
 * 收入比對儀表板
 *
 * PMS（發票/管理系統，最準）vs PM（每日收款記錄）
 * 每月差距視覺化，協助找出收入記錄落差
 */

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Building2,
  BarChart3,
  Info,
} from "lucide-react"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────

interface CompareRow {
  month: string
  pms: { total: number; branches: number }
  pm: { total: number; records: number }
  diff: number
  diffPct: number | null
  status: "match" | "pms_higher" | "pm_higher"
}

interface CompareData {
  startMonth: string
  endMonth: string
  comparison: CompareRow[]
}

// ─────────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────────

function fmtMoney(v: number): string {
  return `NT$${Math.round(v).toLocaleString()}`
}

function fmtDiff(v: number): string {
  const abs = Math.abs(Math.round(v))
  return v >= 0 ? `+${abs.toLocaleString()}` : `-${abs.toLocaleString()}`
}

function monthOptions(): string[] {
  const months: string[] = []
  const start = new Date("2025-07-01")
  const now = new Date()
  let cur = start
  while (cur <= now) {
    months.push(cur.toISOString().slice(0, 7))
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return months.reverse()
}

// ─────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────

export default function RevenueCompare() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const currentMonth = new Date().toISOString().slice(0, 7)
  const [startMonth, setStartMonth] = useState("2025-07")
  const [endMonth, setEndMonth] = useState(currentMonth)

  // 比對資料
  const { data, isLoading, refetch } = useQuery<CompareData>({
    queryKey: ["/api/pms-bridge/compare", startMonth, endMonth],
    queryFn: async () => {
      const res = await fetch(
        `/api/pms-bridge/compare?startMonth=${startMonth}&endMonth=${endMonth}`
      )
      if (!res.ok) throw new Error("載入失敗")
      return res.json()
    },
  })

  // 同步 PMS
  const syncPms = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/pms-bridge/sync", {
        startMonth,
        endMonth,
      }),
    onSuccess: (res: any) => {
      toast({
        title: "PMS 同步完成",
        description: res.message,
      })
      queryClient.invalidateQueries({ queryKey: ["/api/pms-bridge/compare"] })
      refetch()
    },
    onError: () => {
      toast({ title: "同步失敗", variant: "destructive" })
    },
  })

  // 同步 PM
  const syncPm = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/pm-bridge/sync", {
        startDate: `${startMonth}-01`,
        endDate: `${endMonth}-31`,
      }),
    onSuccess: (res: any) => {
      toast({
        title: "PM 同步完成",
        description: `新增 ${res.synced} 筆，略過 ${res.skipped} 筆`,
      })
      queryClient.invalidateQueries({ queryKey: ["/api/pms-bridge/compare"] })
      refetch()
    },
    onError: () => {
      toast({ title: "PM 同步失敗", variant: "destructive" })
    },
  })

  const comparison = data?.comparison ?? []

  // 統計卡片數據
  const totalPms = comparison.reduce((s, r) => s + r.pms.total, 0)
  const totalPm = comparison.reduce((s, r) => s + r.pm.total, 0)
  const totalDiff = totalPms - totalPm
  const matchCount = comparison.filter((r) => r.status === "match").length
  const avgDiffPct =
    comparison.length > 0
      ? comparison.reduce((s, r) => s + Math.abs(r.diffPct ?? 0), 0) /
        comparison.length
      : 0

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* 標題 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            收入比對分析
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            PMS（發票管理，最準）vs PM（每日收款記錄）差距分析
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncPm.mutate()}
            disabled={syncPm.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${syncPm.isPending ? "animate-spin" : ""}`}
            />
            同步 PM
          </Button>
          <Button
            size="sm"
            onClick={() => syncPms.mutate()}
            disabled={syncPms.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${syncPms.isPending ? "animate-spin" : ""}`}
            />
            同步 PMS
          </Button>
        </div>
      </div>

      {/* 系統說明 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p>
            <strong>PMS（績效管理系統）</strong>
            ：開立發票、正式收款記錄，為最準確的收入數據。4個分店，月底彙總。
          </p>
          <p>
            <strong>PM（旅館管理系統）</strong>
            ：每日逐筆收款記錄，涵蓋所有房型與訂單。
          </p>
          <p>
            目標：兩系統每月合計趨近一致。差距表示有部分收入在其中一個系統未完整記錄。
          </p>
        </div>
      </div>

      {/* 篩選 */}
      <div className="flex gap-3 items-center flex-wrap">
        <span className="text-sm font-medium">期間：</span>
        <Select value={startMonth} onValueChange={setStartMonth}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions().map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">～</span>
        <Select value={endMonth} onValueChange={setEndMonth}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions().map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          查詢
        </Button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              PMS 合計
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-600">
              {fmtMoney(totalPms)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">發票管理系統</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              PM 合計
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">
              {fmtMoney(totalPm)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">每日收款記錄</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>總差距</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-xl font-bold ${
                Math.abs(totalDiff) < 5000
                  ? "text-green-600"
                  : totalDiff > 0
                    ? "text-orange-500"
                    : "text-red-500"
              }`}
            >
              {fmtDiff(totalDiff)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalDiff > 0 ? "PMS 較高" : totalDiff < 0 ? "PM 較高" : "相符"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>月份吻合</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {matchCount}/{comparison.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              平均差距 {avgDiffPct.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 月度比對表格 */}
      <Card>
        <CardHeader>
          <CardTitle>月度比對明細</CardTitle>
          <CardDescription>
            每月 PMS 與 PM 收入對照，找出差距原因
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">
              載入中...
            </div>
          ) : comparison.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              無資料，請先執行同步
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月份</TableHead>
                  <TableHead className="text-right">
                    PMS 收入
                    <span className="block text-xs font-normal text-muted-foreground">
                      分店數
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    PM 收入
                    <span className="block text-xs font-normal text-muted-foreground">
                      筆數
                    </span>
                  </TableHead>
                  <TableHead className="text-right">差距</TableHead>
                  <TableHead className="text-right">差距率</TableHead>
                  <TableHead className="text-center">狀態</TableHead>
                  <TableHead>吻合度</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.map((row) => {
                  const absPct = Math.abs(row.diffPct ?? 0)
                  const progressVal =
                    absPct >= 100 ? 100 : 100 - Math.min(absPct, 100)

                  return (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">{row.month}</TableCell>

                      {/* PMS */}
                      <TableCell className="text-right">
                        <div className="font-semibold text-blue-600">
                          {fmtMoney(row.pms.total)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.pms.branches} 個分店
                        </div>
                      </TableCell>

                      {/* PM */}
                      <TableCell className="text-right">
                        <div className="font-semibold text-green-600">
                          {fmtMoney(row.pm.total)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.pm.records.toLocaleString()} 筆
                        </div>
                      </TableCell>

                      {/* 差距 */}
                      <TableCell className="text-right">
                        <span
                          className={`font-semibold ${
                            Math.abs(row.diff) < 5000
                              ? "text-green-600"
                              : row.diff > 0
                                ? "text-orange-500"
                                : "text-red-500"
                          }`}
                        >
                          {fmtDiff(row.diff)}
                        </span>
                      </TableCell>

                      {/* 差距率 */}
                      <TableCell className="text-right">
                        {row.diffPct !== null ? (
                          <span
                            className={`text-sm ${
                              absPct < 2
                                ? "text-green-600"
                                : absPct < 10
                                  ? "text-yellow-600"
                                  : "text-red-500"
                            }`}
                          >
                            {row.diff >= 0 ? "+" : ""}
                            {row.diffPct?.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>

                      {/* 狀態 */}
                      <TableCell className="text-center">
                        {row.status === "match" ? (
                          <Badge
                            variant="outline"
                            className="border-green-500 text-green-600"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            吻合
                          </Badge>
                        ) : row.status === "pms_higher" ? (
                          <Badge
                            variant="outline"
                            className="border-orange-400 text-orange-600"
                          >
                            <TrendingUp className="h-3 w-3 mr-1" />
                            PMS 較高
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-red-400 text-red-600"
                          >
                            <TrendingDown className="h-3 w-3 mr-1" />
                            PM 較高
                          </Badge>
                        )}
                      </TableCell>

                      {/* 吻合度進度條 */}
                      <TableCell className="min-w-28">
                        <Progress
                          value={progressVal}
                          className={`h-2 ${
                            progressVal >= 98
                              ? "[&>div]:bg-green-500"
                              : progressVal >= 90
                                ? "[&>div]:bg-yellow-500"
                                : "[&>div]:bg-red-500"
                          }`}
                        />
                        <span className="text-xs text-muted-foreground">
                          {progressVal.toFixed(0)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 差距說明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            差距解讀參考
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-foreground mb-1">PMS 較高（常見）</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>現金收款有在 PMS 開發票，但 PM 未記錄</li>
                <li>轉帳收款只在 PMS 確認，PM 尚未登錄</li>
                <li>PMS 月底結算時加入了先前漏記的金額</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">PM 較高（需查）</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>PM 有記錄但 PMS 尚未開立發票</li>
                <li>月底 PMS 更新資料可能尚未完成</li>
                <li>退款已在 PM 退回但 PMS 未扣除</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
