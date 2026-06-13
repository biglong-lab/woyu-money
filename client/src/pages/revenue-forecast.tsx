/**
 * 收入預測（/revenue-forecast）
 *
 * Phase 1 - 累積走勢 + 簡單線性推估
 *
 * 顯示：
 *  - 該月每日累積曲線（從 forecast_snapshots）
 *  - 簡單線性推估月底總額
 *  - 與最近 N 月同期比較（同 daysElapsed 累積值差異）
 *  - 支援切換 targetMonth + 公司
 */
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts"
import { TrendingUp, RefreshCw, Calendar, AlertCircle } from "lucide-react"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { BackToTop } from "@/components/back-to-top"

interface Snapshot {
  id: number
  snapshotDate: string
  companyId: number | null
  targetMonth: string
  accumulatedRevenue: string
  bookedRevenue: string
  daysAheadOfTarget: number | null
  source: string
}

interface SeasonalForecast {
  targetMonth: string
  daysElapsed: number
  currentAccumulated: number
  history: Array<{ month: string; accAtSameDay: number; finalAcc: number; ratio: number }>
  sampleSize: number
  avgRatio: number
  stdRatio: number
  pointEstimate: number
  ci80: { lower: number; upper: number }
  ci95: { lower: number; upper: number }
  confidence: "high" | "medium" | "low" | "insufficient"
}

interface CalibratedPrediction {
  targetMonth: string
  companyId: number | null
  currentEstimate: number
  daysAhead: number
  bucket: {
    bucket: string
    samples: number
    medianRatio: number
    p25Ratio: number
    p75Ratio: number
  } | null
  pointEstimate: number
  ci80Lower: number
  ci80Upper: number
  confidence: "high" | "medium" | "low" | "insufficient"
  note: string
}

interface CalibrationCurve {
  companyId: number | null
  buckets: Array<{
    bucket: string
    samples: number
    medianRatio: number
    p25Ratio: number
    p75Ratio: number
    meanRatio: number
  }>
  totalSamples: number
}

const CONFIDENCE_LABEL: Record<SeasonalForecast["confidence"], { label: string; color: string }> = {
  high: { label: "高（≥6 樣本 & 波動低）", color: "bg-green-100 text-green-800" },
  medium: { label: "中（≥4 樣本）", color: "bg-blue-100 text-blue-800" },
  low: { label: "低（≥2 樣本）", color: "bg-amber-100 text-amber-800" },
  insufficient: { label: "資料不足（< 2 樣本，僅線性推估）", color: "bg-red-100 text-red-800" },
}

// 大號文創 (6) / 大哉文旅 (7) 不納入 Money、見 shared/pm-excluded-companies.ts
const PM_COMPANIES = [
  { id: 1, name: "浯島文旅" },
  { id: 2, name: "浯島輕旅" },
  { id: 3, name: "小六路厝" },
  { id: 4, name: "總兵招待所" },
  { id: 5, name: "魁星背包棧" },
]

function monthOptions(count: number): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = -2; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    months.push(d.toISOString().slice(0, 7))
  }
  return months.reverse()
}

export default function RevenueForecastPage() {
  useDocumentTitle("收入預測")
  const { toast } = useToast()

  const [targetMonth, setTargetMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [companyId, setCompanyId] = useState<string>("all") // 'all' = 合計

  const companyParam = companyId === "all" ? "null" : companyId

  // 該月走勢
  const { data: trend = [], isLoading } = useQuery<Snapshot[]>({
    queryKey: [`/api/forecast/trend?targetMonth=${targetMonth}&companyId=${companyParam}`],
  })

  // 季節性預測
  const { data: seasonal } = useQuery<SeasonalForecast>({
    queryKey: [`/api/forecast/seasonal?targetMonth=${targetMonth}&companyId=${companyParam}`],
  })

  // PMS 校準預測
  const { data: pmsPrediction } = useQuery<CalibratedPrediction>({
    queryKey: [`/api/forecast/pms-prediction?targetMonth=${targetMonth}&companyId=${companyParam}`],
  })

  // PMS 校準曲線
  const { data: calibrationCurve } = useQuery<CalibrationCurve>({
    queryKey: [`/api/forecast/calibration?companyId=${companyParam}`],
  })

  // PM vs PMS 月底對照（含 2024 historical）
  interface PmVsPmsRow {
    month: string
    pmFinal: number | null
    pmsFinal: number | null
    diff: number | null
    diffPct: number | null
    source: string
  }
  const { data: pmVsPms = [] } = useQuery<PmVsPmsRow[]>({
    queryKey: [`/api/forecast/pm-vs-pms-monthly`],
  })

  // 同期比較：拉過去 3 個月相同 targetMonth offset
  const compareMonths = useMemo(() => {
    const [y, m] = targetMonth.split("-").map(Number)
    return [-3, -2, -1].map((offset) => {
      const d = new Date(y, m - 1 + offset, 1)
      return d.toISOString().slice(0, 7)
    })
  }, [targetMonth])

  const comparisonQueries = useQuery<{ month: string; data: Snapshot[] }[]>({
    queryKey: [`/api/forecast/comparison`, targetMonth, companyParam],
    queryFn: async () => {
      const results = await Promise.all(
        compareMonths.map(async (m) => {
          const data = await apiRequest<Snapshot[]>(
            "GET",
            `/api/forecast/trend?targetMonth=${m}&companyId=${companyParam}`
          )
          return { month: m, data }
        })
      )
      return results
    },
  })

  const captureMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ ok: boolean; inserted: number; skipped: number }>(
        "POST",
        "/api/forecast/capture",
        {}
      ),
    onSuccess: (r) => {
      toast({
        title: r.ok ? "✅ 已拍 PM 快照" : "失敗",
        description: r.ok
          ? `新增 ${r.inserted} 筆、跳過 ${r.skipped} 筆`
          : "請確認 PM_DATABASE_URL 設定",
        variant: r.ok ? "default" : "destructive",
      })
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/forecast"),
      })
    },
  })

  const pmsSyncMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ ok: boolean; inserted: number; skipped: number; error?: string }>(
        "POST",
        "/api/forecast/pms-sync",
        { sinceDays: 14 }
      ),
    onSuccess: (r) => {
      toast({
        title: r.ok ? "✅ 已同步 PMS" : "失敗",
        description: r.ok
          ? `新增 ${r.inserted} 筆、更新 ${r.skipped} 筆`
          : r.error || "請確認 PMS_DATABASE_URL 設定",
        variant: r.ok ? "default" : "destructive",
      })
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/forecast"),
      })
    },
  })

  // 組合圖表資料：x 軸為「離月初第 N 天」
  const chartData = useMemo(() => {
    if (trend.length === 0) return []

    const byDay = new Map<number, Record<string, number | null>>()

    // PM 已實現累積（source = pm-daily-snapshot 含 accumulatedRevenue）
    const addAccumulated = (key: string, snaps: Snapshot[]) => {
      for (const s of snaps) {
        if (s.source !== "pm-daily-snapshot") continue
        const day = new Date(s.snapshotDate).getDate()
        if (!byDay.has(day)) byDay.set(day, { day })
        byDay.get(day)![key] = parseFloat(s.accumulatedRevenue)
      }
    }

    // PMS 預期月底總額 = PMS booked（未實現訂單、各館加總）+ PM accumulated（已實現）
    //
    // 修正紀錄（2026-05-24）：PMS booked_revenue 設計是「截至 snapshot 那天、target_month 月內
    // 尚未實現的訂單」。隨時間流逝、已實現的會從 booked 扣除、轉到 PM accumulated。
    // 直接顯示 booked 會看到「往下掉」、誤導使用者。
    // 正確顯示：booked + PM accumulated = 該日的「總訂單原始額」、單調遞增。
    const addBooked = (snaps: Snapshot[]) => {
      // 先建立 PM 同日 accumulated 對照
      const pmByDay = new Map<number, number>()
      for (const s of snaps) {
        if (s.source !== "pm-daily-snapshot") continue
        if (s.snapshotDate.slice(0, 7) !== targetMonth) continue
        if (s.companyId !== null) continue // 只取合計列、不重覆計算各館
        pmByDay.set(new Date(s.snapshotDate).getDate(), parseFloat(s.accumulatedRevenue))
      }
      // 加 PMS booked 各館合計
      for (const s of snaps) {
        if (s.source !== "pms-bridge") continue
        if (s.snapshotDate.slice(0, 7) !== targetMonth) continue
        const day = new Date(s.snapshotDate).getDate()
        if (!byDay.has(day)) byDay.set(day, { day })
        const existing = (byDay.get(day)!["PMS 累積"] as number | undefined) ?? 0
        byDay.get(day)!["PMS 累積"] = existing + parseFloat(s.bookedRevenue)
      }
      // 對每日：PMS 累積 += PM accumulated（補回已實現的部分、避免「下降」假象）
      pmByDay.forEach((pmAcc, day) => {
        const entry = byDay.get(day)
        if (entry && entry["PMS 累積"] !== undefined) {
          entry["PMS 累積"] = (entry["PMS 累積"] as number) + pmAcc
        }
      })
    }

    addAccumulated(targetMonth, trend)
    addBooked(trend)
    if (comparisonQueries.data) {
      for (const c of comparisonQueries.data) {
        if (c.data.length > 0) addAccumulated(c.month, c.data)
      }
    }

    return Array.from(byDay.values()).sort((a, b) => (a.day as number) - (b.day as number))
  }, [trend, comparisonQueries.data, targetMonth])

  // 簡單線性推估
  //
  // 累積數字優先順序（避免 PM 21:00 才結帳、白天卡片顯示 $0 的問題）：
  // 1. seasonal.currentAccumulated（payment_items income 即時值、與季節性同口徑）
  // 2. fallback：trend 最後一筆 snapshot.accumulatedRevenue
  const forecast = useMemo(() => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
    const isCurrent =
      targetMonth === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

    const [y, m] = targetMonth.split("-").map(Number)
    const monthEnd = new Date(y, m, 0).getDate()

    const seasonalAcc = seasonal?.currentAccumulated ?? 0
    // 只取「PM 累積快照」（合計列）、忽略 pms-bridge 各館列、否則 trend.last 可能是 0
    const pmSnapshots = trend.filter((s) => s.source === "pm-daily-snapshot")
    const snapshotLatest = pmSnapshots[pmSnapshots.length - 1] ?? trend[trend.length - 1]
    const snapshotAcc = snapshotLatest ? parseFloat(snapshotLatest.accumulatedRevenue) : 0

    // 使用者要求「PM 是多少就是多少」、優先 PM snapshot、不再 fallback payment_items（避免不一致）
    const useSeasonal = snapshotAcc === 0 && seasonalAcc > 0
    const accumulated = snapshotAcc > 0 ? snapshotAcc : seasonalAcc

    if (accumulated === 0 && trend.length === 0) return null

    const referenceDate = useSeasonal ? todayStr : (snapshotLatest?.snapshotDate ?? todayStr)
    const refDay = new Date(referenceDate).getDate()
    const daysElapsed = isCurrent ? Math.min(refDay, monthEnd) : monthEnd
    const daysRemaining = monthEnd - daysElapsed
    const linear = daysElapsed > 0 ? (accumulated / daysElapsed) * monthEnd : 0

    return {
      latestSnapshot:
        snapshotLatest ??
        ({
          snapshotDate: todayStr,
          accumulatedRevenue: accumulated.toString(),
          source: "payment-items",
        } as Snapshot),
      latestAmount: accumulated,
      accumulatedSource: useSeasonal ? "payment_items" : "pm-snapshot",
      daysElapsed,
      daysRemaining,
      daysInMonth: monthEnd,
      linearProjection: Math.round(linear),
    }
  }, [trend, targetMonth, seasonal])

  // 同期比較：相同 daysElapsed 時對方累積值
  const comparison = useMemo(() => {
    if (!comparisonQueries.data || !forecast) return []
    return comparisonQueries.data.map((c) => {
      // 找該月在 day == daysElapsed 時的累積（找最接近的）
      const sorted = [...c.data].sort(
        (a, b) =>
          Math.abs(new Date(a.snapshotDate).getDate() - forecast.daysElapsed) -
          Math.abs(new Date(b.snapshotDate).getDate() - forecast.daysElapsed)
      )
      const sameDayAcc = sorted[0] ? parseFloat(sorted[0].accumulatedRevenue) : 0
      const finalAcc =
        c.data.length > 0 ? Math.max(...c.data.map((s) => parseFloat(s.accumulatedRevenue))) : 0
      return { month: c.month, sameDayAcc, finalAcc }
    })
  }, [comparisonQueries.data, forecast])

  const formatMoney = (v: number) => "$" + Math.round(v).toLocaleString()

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            收入預測
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            每日從 PM 系統拉「截至今日累積」快照，提供月底推估與同期比較
          </p>
          {(() => {
            // 顯示資料新鮮度：取 trend 中最新的 snapshot_date
            const latestPm = trend
              .filter((s) => s.source === "pm-daily-snapshot")
              .reduce<
                string | null
              >((max, s) => (max === null || s.snapshotDate > max ? s.snapshotDate : max), null)
            const latestPms = trend
              .filter((s) => s.source === "pms-bridge")
              .reduce<
                string | null
              >((max, s) => (max === null || s.snapshotDate > max ? s.snapshotDate : max), null)
            if (!latestPm && !latestPms) return null
            // 標示資料新鮮度（PMS 是使用者不定期填、可能延遲）
            const todayStr = new Date().toISOString().slice(0, 10)
            const pmDate = latestPm?.slice(0, 10)
            const pmsDate = latestPms?.slice(0, 10)
            const pmsBehindDays = pmsDate
              ? Math.round((new Date(todayStr).getTime() - new Date(pmsDate).getTime()) / 86400000)
              : 0
            return (
              <div className="text-xs text-gray-400 mt-1 flex gap-3 flex-wrap items-center">
                {latestPm && (
                  <span>
                    📊 PM 累積：
                    <span
                      className={`font-mono ${pmDate === todayStr ? "text-emerald-600" : "text-orange-600"}`}
                    >
                      {pmDate}
                    </span>
                  </span>
                )}
                {latestPms && (
                  <span title="PMS 累積是使用者在 PMS 系統不定期手動填入、Money 每天 cron 同步、可能比 PM 晚 1-N 天">
                    🎯 PMS 累積：
                    <span
                      className={`font-mono ${pmsBehindDays === 0 ? "text-emerald-600" : pmsBehindDays >= 3 ? "text-red-600" : "text-orange-600"}`}
                    >
                      {pmsDate}
                    </span>
                    {pmsBehindDays >= 1 && (
                      <span className="ml-1 text-gray-500">
                        （PMS 還沒填到今天、落後 {pmsBehindDays} 天）
                      </span>
                    )}
                  </span>
                )}
              </div>
            )
          })()}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => captureMutation.mutate()}
          disabled={captureMutation.isPending}
        >
          <RefreshCw
            className={`h-4 w-4 mr-1 ${captureMutation.isPending ? "animate-spin" : ""}`}
          />
          PM 拍快照
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => pmsSyncMutation.mutate()}
          disabled={pmsSyncMutation.isPending}
        >
          <RefreshCw
            className={`h-4 w-4 mr-1 ${pmsSyncMutation.isPending ? "animate-spin" : ""}`}
          />
          PMS 同步
        </Button>
      </div>

      {/* 切換器 */}
      <Card>
        <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-xs text-gray-500 mb-1">目標月</div>
            <Select value={targetMonth} onValueChange={setTargetMonth}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions(2).map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">公司</div>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部（合計）</SelectItem>
                {PM_COMPANIES.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 推估卡片 */}
      {forecast && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="py-3 px-3">
              <div className="text-xs text-blue-700">
                截至 {forecast.latestSnapshot.snapshotDate.slice(5)}
              </div>
              <div className="text-lg font-bold text-blue-900">
                {formatMoney(forecast.latestAmount)}
              </div>
              <div
                className="text-xs text-blue-600 mt-0.5"
                title={
                  forecast.accumulatedSource === "payment_items"
                    ? "來自 payment_items（即時、PM 入帳前先顯示）"
                    : "來自 PM 每日快照"
                }
              >
                已累積
                {forecast.accumulatedSource === "payment_items" && (
                  <span className="ml-1 text-[10px] text-blue-500">（即時）</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="py-3 px-3">
              <div className="text-xs text-purple-700">
                <Calendar className="h-3 w-3 inline mr-0.5" />第 {forecast.daysElapsed} /{" "}
                {forecast.daysInMonth} 天
              </div>
              <div className="text-lg font-bold text-purple-900">
                還 {forecast.daysRemaining} 天
              </div>
              <div className="text-xs text-purple-600 mt-0.5">月份進度</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="py-3 px-3">
              <div className="text-xs text-green-700">線性推估月底</div>
              <div className="text-lg font-bold text-green-900">
                {formatMoney(forecast.linearProjection)}
              </div>
              <div className="text-xs text-green-600 mt-0.5">
                = 累積 / {forecast.daysElapsed}天 × {forecast.daysInMonth}天
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-3 px-3">
              <div className="text-xs text-amber-700">
                <AlertCircle className="h-3 w-3 inline mr-0.5" />
                精準度
              </div>
              <div className="text-sm font-medium text-amber-900">線性推估</div>
              <div className="text-xs text-amber-600 mt-0.5">
                {trend.length > 7 ? "資料 OK" : "資料 < 7 天、僅供參考"}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 季節性預測（更精準）*/}
      {seasonal && (
        <Card className="border-2 border-indigo-200">
          <CardContent className="py-4 px-3 sm:px-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
                季節性預測（用歷史同期累積比率）
              </div>
              <Badge className={CONFIDENCE_LABEL[seasonal.confidence].color}>
                信心：{CONFIDENCE_LABEL[seasonal.confidence].label}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div className="bg-indigo-50 rounded-lg p-3">
                <div className="text-xs text-indigo-700">點估計（月底總額）</div>
                <div className="text-2xl font-bold text-indigo-900">
                  {formatMoney(seasonal.pointEstimate)}
                </div>
                <div className="text-xs text-indigo-600 mt-1">
                  基於 {seasonal.sampleSize} 個歷史月
                  {seasonal.sampleSize > 0 && (
                    <>、平均比率 {(seasonal.avgRatio * 100).toFixed(1)}%</>
                  )}
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-blue-700">80% 信心區間</div>
                {seasonal.confidence === "insufficient" || seasonal.sampleSize < 2 ? (
                  <>
                    <div className="text-sm font-medium text-gray-400">— 資料不足 —</div>
                    <div className="text-xs text-blue-600 mt-1">需至少 2 個歷史月樣本</div>
                  </>
                ) : seasonal.ci80.lower === seasonal.ci80.upper ? (
                  <>
                    <div className="text-sm font-medium text-gray-400">— 樣本相同 —</div>
                    <div className="text-xs text-blue-600 mt-1">歷史比率無波動、僅單點估</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-bold text-blue-900">
                      {formatMoney(seasonal.ci80.lower)} ~ {formatMoney(seasonal.ci80.upper)}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">8 成機會落在此範圍</div>
                  </>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-700">95% 信心區間</div>
                {seasonal.confidence === "insufficient" || seasonal.sampleSize < 2 ? (
                  <>
                    <div className="text-sm font-medium text-gray-400">— 資料不足 —</div>
                    <div className="text-xs text-gray-600 mt-1">需至少 2 個歷史月樣本</div>
                  </>
                ) : seasonal.ci95.lower === seasonal.ci95.upper ? (
                  <>
                    <div className="text-sm font-medium text-gray-400">— 樣本相同 —</div>
                    <div className="text-xs text-gray-600 mt-1">歷史比率無波動、僅單點估</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-bold text-gray-900">
                      {formatMoney(seasonal.ci95.lower)} ~ {formatMoney(seasonal.ci95.upper)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">幾乎都會落在此範圍</div>
                  </>
                )}
              </div>
            </div>

            {seasonal.history.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="text-xs text-gray-500 mb-2">
                  歷史同期比率（第 {seasonal.daysElapsed} 天累積 / 月底最終）
                </div>
                <div className="space-y-1.5 text-xs">
                  {seasonal.history.map((h) => (
                    <div
                      key={h.month}
                      className="grid grid-cols-[5rem_1fr_3rem] sm:grid-cols-[5rem_8rem_1fr_3rem] gap-2 items-center"
                    >
                      <span className="font-mono text-gray-700">{h.month}</span>
                      <span className="text-gray-500 text-right text-[10px] sm:text-xs truncate hidden sm:inline">
                        {formatMoney(h.accAtSameDay)} / {formatMoney(h.finalAcc)}
                      </span>
                      <div>
                        <div className="bg-gray-200 rounded-full h-2 relative overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full"
                            style={{ width: `${(h.ratio * 100).toFixed(1)}%` }}
                          />
                        </div>
                      </div>
                      <span className="font-semibold text-indigo-700 text-right">
                        {(h.ratio * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {seasonal.confidence === "insufficient" && (
              <div className="mt-3 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                ⚠️ 目前歷史快照不足、退化為線性推估。建議：等資料累積 3+ 個月後此預測會大幅準確。
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PMS 校準預估（使用「我多年來不定期填入的預估 vs 實際」訓練）*/}
      {pmsPrediction && pmsPrediction.currentEstimate > 0 && (
        <Card className="border-2 border-orange-200">
          <CardContent className="py-4 px-3 sm:px-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="text-orange-600">📊</span>
                PMS 校準預估（用歷史「預估 vs 實際」訓練）
              </div>
              <Badge className={CONFIDENCE_LABEL[pmsPrediction.confidence].color}>
                {CONFIDENCE_LABEL[pmsPrediction.confidence].label}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="text-xs text-orange-700">PMS 當前預估</div>
                <div className="text-lg font-semibold text-orange-900">
                  {formatMoney(pmsPrediction.currentEstimate)}
                </div>
                <div className="text-xs text-orange-600 mt-1">
                  離月底 {pmsPrediction.daysAhead} 天
                </div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 border-2 border-indigo-300">
                <div className="text-xs text-indigo-700">校準後最終估</div>
                <div className="text-2xl font-bold text-indigo-900">
                  {formatMoney(pmsPrediction.pointEstimate)}
                </div>
                <div className="text-xs text-indigo-600 mt-1">
                  × {pmsPrediction.bucket?.medianRatio.toFixed(2) ?? "—"} 中位 ratio
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-blue-700">80% 信心區間</div>
                <div className="text-sm font-bold text-blue-900">
                  {formatMoney(pmsPrediction.ci80Lower)}
                </div>
                <div className="text-sm font-bold text-blue-900">
                  ~ {formatMoney(pmsPrediction.ci80Upper)}
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-600 mt-2">{pmsPrediction.note}</div>
          </CardContent>
        </Card>
      )}

      {/* 歷史準確度報表 */}
      {calibrationCurve && calibrationCurve.totalSamples > 0 && (
        <Card className="border-emerald-200">
          <CardContent className="py-4 px-3 sm:px-4">
            <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between flex-wrap gap-2">
              <span>📈 歷史準確度（PMS 校準模型可信度）</span>
              <Badge className="bg-emerald-100 text-emerald-800">
                共 {calibrationCurve.totalSamples} 筆訓練樣本
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(() => {
                const close = calibrationCurve.buckets.find(
                  (b) => b.bucket === "0-7天" || b.bucket === "8-15天"
                )
                const mid = calibrationCurve.buckets.find((b) => b.bucket === "16-30天")
                const far = calibrationCurve.buckets.find(
                  (b) => b.bucket === "31-60天" || b.bucket === "60+天"
                )

                // 「精準度」分數 = 1 / (1 + std)
                // 越接近 1 越準
                const score = (b: typeof close) => {
                  if (!b) return 0
                  const spread = (b.p75Ratio - b.p25Ratio) / b.medianRatio
                  return Math.max(0, Math.min(1, 1 - spread / 2))
                }

                return (
                  <>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs text-green-700">近月底（0-15 天）</div>
                      <div className="text-xl font-bold text-green-900">
                        {close ? `${(score(close) * 100).toFixed(0)}%` : "—"}
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        {close
                          ? `${close.samples} 筆 / 中位 ${close.medianRatio.toFixed(2)}×`
                          : "無樣本"}
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3">
                      <div className="text-xs text-amber-700">中期（16-30 天）</div>
                      <div className="text-xl font-bold text-amber-900">
                        {mid ? `${(score(mid) * 100).toFixed(0)}%` : "—"}
                      </div>
                      <div className="text-xs text-amber-600 mt-1">
                        {mid ? `${mid.samples} 筆 / 中位 ${mid.medianRatio.toFixed(2)}×` : "無樣本"}
                      </div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3">
                      <div className="text-xs text-red-700">早期（31+ 天）</div>
                      <div className="text-xl font-bold text-red-900">
                        {far ? `${(score(far) * 100).toFixed(0)}%` : "—"}
                      </div>
                      <div className="text-xs text-red-600 mt-1">
                        {far ? `${far.samples} 筆 / 中位 ${far.medianRatio.toFixed(2)}×` : "無樣本"}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="text-xs text-gray-500 mt-3 leading-relaxed">
              💡 <strong>解讀</strong>：% 越高代表預估離散度小（同樣 N 天前填的、最終差距小）。
              近月底通常 80%+ 精準、早期 30+ 天 % 偏低代表使用者早期填的較保守、無法精準推算。
            </div>
          </CardContent>
        </Card>
      )}

      {/* 校準曲線表 */}
      {calibrationCurve && calibrationCurve.buckets.length > 0 && (
        <Card>
          <CardContent className="py-4 px-3 sm:px-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              校準曲線（離月底天數 → 歷史 ratio）
            </div>
            <div className="text-xs text-gray-500 mb-2">
              ratio = 實際最終 / PMS 預估、共 {calibrationCurve.totalSamples} 筆訓練樣本
            </div>
            <div className="space-y-2">
              {calibrationCurve.buckets.map((b) => (
                <div
                  key={b.bucket}
                  className="text-xs grid grid-cols-[5rem_3.5rem_1fr_4rem] sm:grid-cols-[5rem_3.5rem_1fr_4rem_6.5rem] gap-2 items-center"
                >
                  <span className="font-mono">{b.bucket}</span>
                  <span className="text-gray-500">{b.samples} 筆</span>
                  <div>
                    <div className="bg-gray-100 rounded h-5 relative overflow-hidden">
                      <div
                        className="bg-blue-300 h-full absolute"
                        style={{
                          left: `${Math.min(100, b.p25Ratio * 20)}%`,
                          width: `${Math.min(100, (b.p75Ratio - b.p25Ratio) * 20)}%`,
                        }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-indigo-700"
                        style={{ left: `${Math.min(100, b.medianRatio * 20)}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-semibold text-indigo-700 text-right">
                    {b.medianRatio.toFixed(2)}x
                  </span>
                  <span className="text-gray-400 text-right hidden sm:inline">
                    [{b.p25Ratio.toFixed(2)} ~ {b.p75Ratio.toFixed(2)}]
                  </span>
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-3 leading-relaxed">
              💡 <strong>解讀</strong>：藍色條 = P25~P75 範圍、深紫線 = 中位數。離月底越遠、ratio
              越大代表 PMS 早期預估較保守、實際通常會比預估多很多。
            </div>
          </CardContent>
        </Card>
      )}

      {/* 累積曲線圖 */}
      <Card>
        <CardContent className="py-4 px-3 sm:px-4">
          <div className="text-sm font-medium text-gray-700 mb-3">
            累積收入走勢（{targetMonth} vs 過去 3 月同期）
          </div>
          {isLoading ? (
            <div className="h-72 flex items-center justify-center text-gray-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              載入中...
            </div>
          ) : trend.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-gray-400 gap-2">
              <AlertCircle className="h-8 w-8" />
              <div>該月份還沒有 forecast snapshot</div>
              <div className="text-xs">點「立即拍快照」抓 PM 資料</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  label={{ value: "日", position: "insideBottom", offset: -2, fontSize: 11 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}K` : v)}
                />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey={targetMonth}
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#2563eb" }}
                  activeDot={{ r: 6 }}
                  connectNulls
                  name={`${targetMonth}（已實現累積）`}
                />
                <Line
                  type="monotone"
                  dataKey="PMS 累積"
                  stroke="#ea580c"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 4, fill: "#ea580c", stroke: "#fff", strokeWidth: 1 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                  name="PMS 訂單總額（已實現 + 未來訂單）"
                />
                {compareMonths.map((m, i) => (
                  <Line
                    key={m}
                    type="monotone"
                    dataKey={m}
                    stroke={["#94a3b8", "#cbd5e1", "#e2e8f0"][i]}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    name={m}
                  />
                ))}
                {forecast && (
                  <ReferenceLine
                    x={forecast.daysElapsed}
                    stroke="#dc2626"
                    strokeDasharray="3 3"
                    label={{ value: "今日", fontSize: 11, fill: "#dc2626" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 同期比較表 */}
      {forecast && comparison.length > 0 && (
        <Card>
          <CardContent className="py-3 px-3 sm:px-4">
            <div className="text-sm font-medium text-gray-700 mb-3">
              同期比較（第 {forecast.daysElapsed} 天）
            </div>
            <div className="space-y-2">
              {comparison.map((c) => {
                const diff = forecast.latestAmount - c.sameDayAcc
                const pct = c.sameDayAcc > 0 ? (diff / c.sameDayAcc) * 100 : 0
                return (
                  <div
                    key={c.month}
                    className="flex justify-between items-center py-2 border-b last:border-0 text-sm flex-wrap"
                  >
                    <span className="text-gray-600 w-20">{c.month}</span>
                    <span className="text-gray-700">
                      第 {forecast.daysElapsed} 天：
                      <span className="font-semibold">{formatMoney(c.sameDayAcc)}</span>
                    </span>
                    <span className="text-gray-500 text-xs">
                      最終：<span className="font-medium">{formatMoney(c.finalAcc)}</span>
                    </span>
                    <Badge
                      className={
                        diff > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }
                    >
                      {diff > 0 ? "+" : ""}
                      {pct.toFixed(1)}%
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 年度 PM vs PMS 月底對照（訓練校準模型用）*/}
      {pmVsPms.length > 0 && (
        <Card>
          <CardContent className="py-4 px-4 sm:px-6">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  📊 PM vs PMS 月底對照（歷年）
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  PM 實際入帳 vs PMS 訂單收尾、看訂單轉換率。差距為正 = PMS
                  訂單比實際入帳多（部分訂單未實現）；差距為負 = PMS 估保守
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {pmVsPms.length} 個月 ·{" "}
                {pmVsPms.filter((r) => r.pmFinal !== null && r.pmsFinal !== null).length} 個可對比
              </Badge>
            </div>

            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">月份</th>
                    <th className="text-right px-3 py-2 font-medium">PM 實際入帳</th>
                    <th className="text-right px-3 py-2 font-medium">PMS 訂單收尾</th>
                    <th className="text-right px-3 py-2 font-medium">差距</th>
                    <th className="text-right px-3 py-2 font-medium">差距 %</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">來源</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...pmVsPms].reverse().map((r) => {
                    const hasBoth = r.pmFinal !== null && r.pmsFinal !== null
                    const diffColor =
                      r.diff === null
                        ? "text-gray-400"
                        : r.diff > 0
                          ? "text-orange-600"
                          : r.diff < 0
                            ? "text-blue-600"
                            : "text-gray-500"
                    return (
                      <tr key={r.month} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs">{r.month}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {r.pmFinal !== null ? formatMoney(r.pmFinal) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {r.pmsFinal !== null ? formatMoney(r.pmsFinal) : "—"}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${diffColor}`}>
                          {r.diff !== null ? (r.diff > 0 ? "+" : "") + formatMoney(r.diff) : "—"}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${diffColor}`}>
                          {r.diffPct !== null
                            ? (r.diffPct > 0 ? "+" : "") + r.diffPct.toFixed(1) + "%"
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-400 hidden sm:table-cell">
                          {r.source.replace("pms-", "")}
                          {!hasBoth && <span className="ml-1 text-amber-600">（單邊）</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 統計區 */}
            {(() => {
              const valid = pmVsPms.filter(
                (r) => r.pmFinal !== null && r.pmsFinal !== null && r.diffPct !== null
              )
              if (valid.length === 0) return null
              const avgDiffPct = valid.reduce((s, r) => s + (r.diffPct ?? 0), 0) / valid.length
              const maxOver = valid.reduce(
                (m, r) => ((r.diffPct ?? 0) > (m?.diffPct ?? -Infinity) ? r : m),
                valid[0]
              )
              const maxUnder = valid.reduce(
                (m, r) => ((r.diffPct ?? 0) < (m?.diffPct ?? Infinity) ? r : m),
                valid[0]
              )
              return (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">平均差距</div>
                    <div
                      className={`font-mono font-semibold ${avgDiffPct > 0 ? "text-orange-600" : "text-blue-600"}`}
                    >
                      {avgDiffPct > 0 ? "+" : ""}
                      {avgDiffPct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">PMS 最樂觀</div>
                    <div className="font-mono font-semibold text-orange-600">
                      {maxOver.month} +{maxOver.diffPct?.toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">PMS 最保守</div>
                    <div className="font-mono font-semibold text-blue-600">
                      {maxUnder.month} {maxUnder.diffPct?.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )
            })()}

            <p className="text-[10px] text-gray-400 mt-2">
              💡 樣本越多、校準模型越準。建議定期回頭看「平均差距」、若 PMS 持續高估或低估
              一致幅度、可作為手動調整係數的依據
            </p>
          </CardContent>
        </Card>
      )}

      <BackToTop />
    </div>
  )
}
