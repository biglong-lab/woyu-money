/**
 * 月底差異對賬報表（Phase 4 PR-2）
 *
 * GET /api/reports/variance?year=YYYY&month=MM
 *
 * 功能：
 * - 全月預估 vs 實際彙總
 * - 大幅差異清單（critical/warning）
 * - 預估未發生（疑似漏記）
 * - 完美對賬
 * - 自動產生洞察文字
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Scale,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { formatNT, friendlyApiError } from "@/lib/utils"

interface VarianceItem {
  id: number
  itemName: string
  attribution: string
  projectName: string | null
  categoryName: string | null
  plannedAmount: number
  actualAmount: number
  variance: number
  variancePercentage: number
  severity: "critical" | "warning" | "normal" | "missing"
}

interface VarianceTotals {
  plannedTotal: number
  actualTotal: number
  variance: number
  variancePercent: number
  overspent: number
  saved: number
}

interface VarianceResponse {
  year: number
  month: number
  totals: VarianceTotals
  bigVariance: VarianceItem[]
  suspectMissing: VarianceItem[]
  normalItems: VarianceItem[]
  insights: string[]
  itemCount: number
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function VarianceReport() {
  useDocumentTitle("月度差異對賬")

  const now = new Date()
  // 預設上月（差異報表通常看上月，因為當月還沒結束）
  const defaultMonth = now.getMonth() // 0-indexed → 上月
  const [year, setYear] = useState(defaultMonth === 0 ? now.getFullYear() - 1 : now.getFullYear())
  const [month, setMonth] = useState(defaultMonth === 0 ? 12 : defaultMonth)
  const [showNormal, setShowNormal] = useState(false)

  const { data, isLoading, error } = useQuery<VarianceResponse>({
    queryKey: [`/api/reports/variance?year=${year}&month=${month}`],
  })

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Scale className="h-7 w-7 text-indigo-600" />
          月度差異對賬報表
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          每筆預估 vs 實際差異分析，找出超支項目與漏記提醒
        </p>
      </div>

      {/* 年月選擇 */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">年</label>
              <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">月</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} 月
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 載入 / 錯誤 */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            載入差異資料中...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 text-red-800">
            <AlertCircle className="h-5 w-5 inline mr-1" />
            載入失敗：{friendlyApiError(error as Error)}
          </CardContent>
        </Card>
      ) : data ? (
        <>
          {/* 摘要卡 */}
          <SummaryCard totals={data.totals} year={data.year} month={data.month} />

          {/* 洞察 */}
          {data.insights.length > 0 && (
            <Card className="mb-4 border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                  系統洞察
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {data.insights.map((text, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">▸</span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {data.itemCount === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Scale className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>
                  {data.year}/{data.month} 沒有預估資料
                </p>
                <p className="text-xs mt-2">請先到「月度預估自動產生」建立該月預估表</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 大幅差異 */}
              {data.bigVariance.length > 0 && (
                <Card className="mb-4 border-red-200">
                  <CardHeader className="pb-3 bg-red-50/50">
                    <CardTitle className="text-base flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-5 w-5" />
                      大幅差異
                      <Badge variant="destructive">{data.bigVariance.length}</Badge>
                    </CardTitle>
                    <CardDescription>差異 ≥ 20% 的項目（請審視）</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <div className="space-y-2">
                      {data.bigVariance.map((item) => (
                        <VarianceRow key={item.id} item={item} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 預估未發生 */}
              {data.suspectMissing.length > 0 && (
                <Card className="mb-4 border-orange-200">
                  <CardHeader className="pb-3 bg-orange-50/50">
                    <CardTitle className="text-base flex items-center gap-2 text-orange-800">
                      <HelpCircle className="h-5 w-5" />
                      預估未發生
                      <Badge variant="outline" className="border-orange-400 text-orange-700">
                        {data.suspectMissing.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      建立了預估但實際金額為 0 — 是否漏記？或這個月真的沒發生？
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <div className="space-y-2">
                      {data.suspectMissing.map((item) => (
                        <VarianceRow key={item.id} item={item} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 完美對賬（可收合） */}
              {data.normalItems.length > 0 && (
                <Card className="mb-4">
                  <CardHeader
                    className="pb-3 cursor-pointer hover:bg-muted/30"
                    onClick={() => setShowNormal(!showNormal)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2 text-green-800">
                        <CheckCircle2 className="h-5 w-5" />
                        完美對賬
                        <Badge variant="outline" className="border-green-300 text-green-700">
                          {data.normalItems.length}
                        </Badge>
                      </CardTitle>
                      {showNormal ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                    <CardDescription>差異 &lt; 20% 的項目</CardDescription>
                  </CardHeader>
                  {showNormal && (
                    <CardContent className="pt-3">
                      <div className="space-y-2">
                        {data.normalItems.map((item) => (
                          <VarianceRow key={item.id} item={item} />
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────
// 摘要卡
// ─────────────────────────────────────────────

interface SummaryCardProps {
  totals: VarianceTotals
  year: number
  month: number
}

function SummaryCard({ totals, year, month }: SummaryCardProps) {
  const isOverspent = totals.variance > 0
  const isExact = totals.variance === 0
  const accentColor = isExact ? "text-blue-700" : isOverspent ? "text-red-700" : "text-emerald-700"

  return (
    <Card className="mb-4 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {year}/{month} 對賬摘要
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="預估總額" value={formatNT(totals.plannedTotal)} colorClass="text-gray-700" />
          <Stat label="實際總額" value={formatNT(totals.actualTotal)} colorClass="text-gray-900" />
          <Stat
            label="差異"
            value={`${isOverspent ? "+" : ""}${formatNT(totals.variance)}`}
            subtext={`${totals.variancePercent >= 0 ? "+" : ""}${totals.variancePercent}%`}
            colorClass={accentColor}
          />
          <Stat
            label="超支 / 節省"
            value={`${formatNT(totals.overspent)} / ${formatNT(totals.saved)}`}
            colorClass="text-gray-700"
            small
          />
        </div>
      </CardContent>
    </Card>
  )
}

interface StatProps {
  label: string
  value: string
  subtext?: string
  colorClass?: string
  small?: boolean
}

function Stat({ label, value, subtext, colorClass = "text-foreground", small }: StatProps) {
  return (
    <div className="bg-white rounded-lg p-3 border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`${small ? "text-sm" : "text-base sm:text-lg"} font-bold mt-1 ${colorClass}`}>
        {value}
      </div>
      {subtext && <div className={`text-xs mt-0.5 ${colorClass}`}>{subtext}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────
// 差異列
// ─────────────────────────────────────────────

function VarianceRow({ item }: { item: VarianceItem }) {
  const sign = item.variance > 0 ? "+" : ""
  const isOverspent = item.variance > 0
  const isMissing = item.severity === "missing"

  const severityClass = {
    critical: "border-l-4 border-red-500 bg-red-50",
    warning: "border-l-4 border-yellow-500 bg-yellow-50",
    missing: "border-l-4 border-orange-500 bg-orange-50",
    normal: "border-l-4 border-gray-200 bg-gray-50",
  }[item.severity]

  return (
    <div className={`p-3 rounded ${severityClass}`}>
      <div className="flex justify-between items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{item.itemName}</span>
            {item.categoryName && (
              <Badge variant="outline" className="text-[10px]">
                {item.categoryName}
              </Badge>
            )}
            {item.attribution === "shared" && (
              <Badge variant="secondary" className="text-[10px]">
                共用
              </Badge>
            )}
          </div>
          {item.projectName && (
            <div className="text-xs text-muted-foreground mt-0.5">{item.projectName}</div>
          )}
        </div>
        <div className="text-right">
          {isMissing ? (
            <div className="text-orange-700">
              <div className="text-sm">預估 {formatNT(item.plannedAmount)}</div>
              <div className="text-xs font-semibold">疑似漏記</div>
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                預估 {formatNT(item.plannedAmount)} → 實際 {formatNT(item.actualAmount)}
              </div>
              <div
                className={`text-sm font-bold flex items-center gap-1 justify-end ${
                  isOverspent ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {isOverspent ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {sign}
                {formatNT(item.variance)}（{sign}
                {item.variancePercentage}%）
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
