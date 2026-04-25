/**
 * 館別損益報表（PR-5）
 *
 * 對應 API: GET /api/reports/property-pl?year=YYYY&month=MM
 *
 * 功能：
 * - 全公司彙總（收入、開銷、淨利、淨利率）
 * - 各館卡片（收入、直接開銷、共用攤提、淨利、淨利率）
 * - 公司級費用清單
 * - 開銷細項展開（依分類）
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  Building2,
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Briefcase,
} from "lucide-react"
import { formatNT, friendlyApiError } from "@/lib/utils"

interface ExpenseBreakdownItem {
  categoryName: string
  amount: number
}

interface PropertyRow {
  projectId: number
  projectName: string
  revenue: number
  directExpense: number
  allocatedExpense: number
  netProfit: number
  marginPercent: number
  expenseBreakdown: ExpenseBreakdownItem[]
}

interface CompanyItem {
  itemName: string
  amount: number
  categoryName: string | null
}

interface ReportResponse {
  year: number
  month: number
  totals: {
    revenue: number
    expense: number
    netProfit: number
    marginPercent: number
  }
  properties: PropertyRow[]
  companyLevel: {
    totalExpense: number
    items: CompanyItem[]
  }
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function PropertyPLReport() {
  useDocumentTitle("館別損益")

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showCompanyItems, setShowCompanyItems] = useState(false)

  const { data, isLoading, error } = useQuery<ReportResponse>({
    queryKey: [`/api/reports/property-pl?year=${year}&month=${month}`],
  })

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <PieChart className="h-7 w-7 text-emerald-600" />
          館別損益報表
        </h1>
        <p className="text-sm text-muted-foreground mt-1">各館收入、開銷、共用攤提、淨利分析</p>
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
            載入損益資料中...
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
          {/* 全公司彙總 */}
          <Card className="mb-4 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-700" />
                全公司彙總 {data.year}/{data.month}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat
                  label="總收入"
                  value={formatNT(data.totals.revenue)}
                  icon={<TrendingUp className="h-4 w-4 text-green-600" />}
                  valueColor="text-green-700"
                />
                <Stat
                  label="總開銷"
                  value={formatNT(data.totals.expense)}
                  icon={<TrendingDown className="h-4 w-4 text-red-600" />}
                  valueColor="text-red-700"
                />
                <Stat
                  label="淨利"
                  value={formatNT(data.totals.netProfit)}
                  icon={<Wallet className="h-4 w-4 text-blue-600" />}
                  valueColor={data.totals.netProfit >= 0 ? "text-blue-700" : "text-orange-700"}
                />
                <Stat
                  label="淨利率"
                  value={`${data.totals.marginPercent}%`}
                  icon={<PieChart className="h-4 w-4 text-purple-600" />}
                  valueColor={
                    data.totals.marginPercent >= 20
                      ? "text-emerald-700"
                      : data.totals.marginPercent >= 0
                        ? "text-yellow-700"
                        : "text-red-700"
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* 各館明細 */}
          {data.properties.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>該月沒有任何館別有收入或開銷紀錄</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                各館損益（{data.properties.length} 個）
              </h2>
              {data.properties.map((p) => {
                const expanded = expandedId === p.projectId
                const totalExpense = p.directExpense + p.allocatedExpense
                return (
                  <Card key={p.projectId}>
                    <CardHeader
                      className="pb-3 cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedId(expanded ? null : p.projectId)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{p.projectName}</CardTitle>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={p.netProfit >= 0 ? "default" : "destructive"}
                            className="font-semibold"
                          >
                            {p.netProfit >= 0 ? "+" : ""}
                            {formatNT(p.netProfit)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              p.marginPercent >= 20
                                ? "border-emerald-300 text-emerald-700"
                                : p.marginPercent >= 0
                                  ? "border-yellow-300 text-yellow-700"
                                  : "border-red-300 text-red-700"
                            }
                          >
                            {p.marginPercent}%
                          </Badge>
                          {expanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                      <CardDescription className="grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <span className="text-xs text-green-700">收入</span>
                          <div className="font-semibold text-green-700 text-sm">
                            {formatNT(p.revenue)}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-red-700">開銷</span>
                          <div className="font-semibold text-red-700 text-sm">
                            {formatNT(totalExpense)}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">含共用攤提</span>
                          <div className="font-semibold text-orange-700 text-sm">
                            {formatNT(p.allocatedExpense)}
                          </div>
                        </div>
                      </CardDescription>
                    </CardHeader>
                    {expanded && p.expenseBreakdown.length > 0 && (
                      <CardContent className="pt-0">
                        <div className="text-xs font-medium text-muted-foreground mb-1.5">
                          開銷細項分類：
                        </div>
                        <div className="space-y-1">
                          {p.expenseBreakdown.map((item, i) => (
                            <div
                              key={i}
                              className="flex justify-between items-center text-sm py-1 border-b border-gray-100 last:border-0"
                            >
                              <span>{item.categoryName}</span>
                              <span className="font-medium">{formatNT(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

          {/* 公司級費用 */}
          {data.companyLevel.totalExpense > 0 && (
            <Card>
              <CardHeader
                className="pb-3 cursor-pointer hover:bg-muted/30"
                onClick={() => setShowCompanyItems(!showCompanyItems)}
              >
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-gray-600" />
                    公司級費用
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {formatNT(data.companyLevel.totalExpense)}
                    </span>
                    {showCompanyItems ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
                <CardDescription>
                  {data.companyLevel.items.length} 筆，不歸屬到任何館
                </CardDescription>
              </CardHeader>
              {showCompanyItems && (
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {data.companyLevel.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100 last:border-0"
                      >
                        <div>
                          <span>{item.itemName}</span>
                          {item.categoryName && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {item.categoryName}
                            </Badge>
                          )}
                        </div>
                        <span className="font-medium">{formatNT(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* 說明 */}
          <Card className="mt-4 border-blue-200 bg-blue-50/30">
            <CardContent className="pt-4 pb-4 text-xs text-blue-900 space-y-1">
              <div className="font-medium">📊 報表說明</div>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>收入：來自 daily_revenues 該月實際營收</li>
                <li>直接開銷：payment_records 該月該館已付款</li>
                <li>共用攤提：budget_item_allocations 該館分到的金額（如人事、洗滌）</li>
                <li>公司級：attribution=&quot;company&quot; 的預估項目</li>
                <li>淨利率 = 淨利 / 收入 × 100%</li>
              </ul>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────
// Stat 子元件
// ─────────────────────────────────────────────

interface StatProps {
  label: string
  value: string
  icon?: React.ReactNode
  valueColor?: string
}

function Stat({ label, value, icon, valueColor = "text-foreground" }: StatProps) {
  return (
    <div className="bg-white rounded-lg p-3 border">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`text-base sm:text-lg font-bold mt-1 ${valueColor}`}>{value}</div>
    </div>
  )
}
