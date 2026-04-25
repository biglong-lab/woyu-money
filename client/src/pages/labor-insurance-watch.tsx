/**
 * 勞健保滯納金監控頁面
 * 針對使用者 40% 滯納金損失專項的「痛處可視化」儀表。
 */

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { AlertTriangle, TrendingDown, Clock, Calendar, CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { localDateISO, formatNT } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useCopyAmount } from "@/hooks/use-copy-amount"
import { useDocumentTitle } from "@/hooks/use-document-title"

type ReminderLevel = "none" | "early" | "warning" | "final"
type LateFeeStatus = "unpaid" | "paid_late" | "paid_on_time"

interface AnnualLossItem {
  itemId: number
  itemName: string
  dueDate: string
  paymentDate?: string
  daysOverdue: number
  amount: number
  lateFee: number
  status: LateFeeStatus
}

interface AnnualLossReport {
  year: number
  itemCount: number
  totalPrincipal: number
  totalLateFee: number
  lossPercentage: number
  items: AnnualLossItem[]
  generatedAt: string
}

interface ReminderStatus {
  today: string
  level: ReminderLevel
  shouldRemind: boolean
  pendingCount: number
  pendingTotalAmount: number
  pendingTotalLateFee: number
  items: Array<{
    id: number
    itemName: string
    dueDate: string
    daysOverdue: number
    unpaidAmount: number
    lateFee: number
  }>
}

const LEVEL_META: Record<
  ReminderLevel,
  { label: string; desc: string; color: string; icon: string }
> = {
  none: {
    label: "無提醒",
    desc: "距離 25 日截止還有幾天",
    color: "text-gray-600 bg-gray-50 border-gray-200",
    icon: "💤",
  },
  early: {
    label: "早期提醒",
    desc: "距 25 日截止 5 天內，建議開始準備",
    color: "text-blue-700 bg-blue-50 border-blue-200",
    icon: "📅",
  },
  warning: {
    label: "警告",
    desc: "截止日臨近，未付清將產生滯納金",
    color: "text-amber-700 bg-amber-50 border-amber-300",
    icon: "⚠️",
  },
  final: {
    label: "最後警告",
    desc: "已逾期，每天都在產生滯納金",
    color: "text-red-700 bg-red-50 border-red-300",
    icon: "🔴",
  },
}

const STATUS_META: Record<LateFeeStatus, { label: string; color: string }> = {
  unpaid: { label: "未付", color: "bg-red-100 text-red-800" },
  paid_late: { label: "逾期付款", color: "bg-orange-100 text-orange-800" },
  paid_on_time: { label: "準時付款", color: "bg-green-100 text-green-800" },
}

function ReminderCard() {
  const { toast } = useToast()
  const copyAmount = useCopyAmount()
  const [pendingId, setPendingId] = useState<number | null>(null)
  const { data, isLoading } = useQuery<ReminderStatus>({
    queryKey: ["/api/late-fee/reminder-status"],
  })

  const markPaidMutation = useMutation<
    unknown,
    Error,
    { id: number; itemName: string; unpaidAmount: number }
  >({
    mutationFn: (input) =>
      apiRequest("POST", "/api/payment/records", {
        itemId: input.id,
        amountPaid: input.unpaidAmount,
        paymentDate: localDateISO(),
      }),
    onMutate: (input) => setPendingId(input.id),
    onSuccess: (_data, input) => {
      toast({
        title: "已標記為已付",
        description: `${input.itemName}（${formatNT(input.unpaidAmount)}）`,
      })
      queryClient.invalidateQueries({ queryKey: ["/api/late-fee/reminder-status"] })
      queryClient.invalidateQueries({ queryKey: ["/api/late-fee/annual-loss"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/priority-report?includeLow=true"] })
    },
    onSettled: () => setPendingId(null),
    onError: (err) =>
      toast({ title: "標記失敗", description: err.message, variant: "destructive" }),
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-gray-500">載入提醒狀態中...</CardContent>
      </Card>
    )
  }
  if (!data) return null

  const meta = LEVEL_META[data.level]
  return (
    <Card className={`border-l-4 ${meta.color}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <span className="text-2xl">{meta.icon}</span>
            今日提醒狀態：{meta.label}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {data.today}
          </Badge>
        </div>
        <CardDescription className="text-xs sm:text-sm">{meta.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.pendingCount === 0 ? (
          <div className="text-sm text-green-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            目前沒有未付的勞健保項目
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-gray-500">未付筆數</div>
                <div className="font-bold text-lg">{data.pendingCount}</div>
              </div>
              <div>
                <div className="text-gray-500">未付金額</div>
                <div className="font-bold text-lg">{formatNT(data.pendingTotalAmount)}</div>
              </div>
              <div>
                <div className="text-gray-500">已產生滯納金</div>
                <div className="font-bold text-lg text-red-700">
                  {formatNT(data.pendingTotalLateFee)}
                </div>
              </div>
            </div>
            <div className="space-y-3 pt-2 border-t">
              {data.items.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-sm rounded p-2 bg-white/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.itemName}</div>
                    <div className="text-xs text-gray-500">
                      到期：{item.dueDate}
                      {item.daysOverdue > 0 && (
                        <span className="ml-1 text-red-700">（逾期 {item.daysOverdue} 天）</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyAmount(item.unpaidAmount, item.itemName)
                      }}
                      className="font-semibold hover:text-blue-600 hover:underline cursor-pointer"
                      title="點擊複製金額（轉帳用）"
                      data-testid={`copy-labor-amount-${item.id}`}
                    >
                      {formatNT(item.unpaidAmount)}
                    </button>
                    {item.lateFee > 0 && (
                      <div className="text-xs text-red-700">+{formatNT(item.lateFee)} 滯納金</div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-xs h-7 shrink-0"
                    onClick={() =>
                      markPaidMutation.mutate({
                        id: item.id,
                        itemName: item.itemName,
                        unpaidAmount: item.unpaidAmount,
                      })
                    }
                    disabled={pendingId === item.id}
                    data-testid={`labor-mark-paid-${item.id}`}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {pendingId === item.id ? "處理中" : "已付"}
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AnnualLossCard({
  year,
  onYearChange,
}: {
  year: number
  onYearChange: (y: number) => void
}) {
  const { data, isLoading } = useQuery<AnnualLossReport>({
    queryKey: [`/api/late-fee/annual-loss?year=${year}`],
  })

  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-gray-500">載入年度損失中...</CardContent>
      </Card>
    )
  }
  if (!data) return null

  const hasLoss = data.totalLateFee > 0
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              {year} 年度勞健保損失
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              因延遲付款實際發生的滯納金損失，讓拖延成本可見
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {years.map((y) => (
              <Button
                key={y}
                variant={y === year ? "default" : "outline"}
                size="sm"
                onClick={() => onYearChange(y)}
                className="text-xs"
              >
                {y}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.itemCount === 0 ? (
          <div className="text-sm text-gray-600">此年度尚無勞健保相關記錄。</div>
        ) : (
          <>
            <div
              className={`rounded-lg p-4 ${
                hasLoss ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-600">本金</div>
                  <div className="text-xl font-bold">{formatNT(data.totalPrincipal)}</div>
                  <div className="text-xs text-gray-500">{data.itemCount} 筆</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">已損失滯納金</div>
                  <div
                    className={`text-xl font-bold ${hasLoss ? "text-red-700" : "text-green-700"}`}
                  >
                    {formatNT(data.totalLateFee)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">損失比例</div>
                  <div
                    className={`text-xl font-bold ${hasLoss ? "text-red-700" : "text-green-700"}`}
                  >
                    {data.lossPercentage.toFixed(2)}%
                  </div>
                </div>
              </div>
              {hasLoss && (
                <div className="mt-3 pt-3 border-t border-red-200 text-sm text-red-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    今年因延遲付款已損失 <strong>{formatNT(data.totalLateFee)}</strong>
                    。每筆按時付款可避免此損失。
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">明細（依滯納金由高至低）</h3>
              {data.items.map((item) => {
                const status = STATUS_META[item.status]
                return (
                  <div
                    key={`${item.itemId}-${item.status}`}
                    className="flex items-center justify-between border rounded-lg p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{item.itemName}</span>
                        <Badge className={`text-xs ${status.color}`} variant="outline">
                          {status.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                        <Calendar className="h-3 w-3" />
                        <span>到期 {item.dueDate}</span>
                        {item.paymentDate && (
                          <>
                            <span>→</span>
                            <span>付款 {item.paymentDate}</span>
                          </>
                        )}
                        {item.daysOverdue > 0 && (
                          <span className="text-red-700 font-medium">
                            逾期 {item.daysOverdue} 天
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold">{formatNT(item.amount)}</div>
                      {item.lateFee > 0 && (
                        <div className="text-xs text-red-700">+{formatNT(item.lateFee)}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function LaborInsuranceWatchPage() {
  useDocumentTitle("勞健保監控")
  const [year, setYear] = useState(new Date().getFullYear())

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="h-7 w-7 text-red-600" />
          勞健保滯納金監控
        </h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600">
          三層提醒（20/25/28 日）+ 年度損失可視化，解決 40% 滯納金問題
        </p>
      </div>

      <ReminderCard />
      <AnnualLossCard year={year} onYearChange={setYear} />

      <Card className="bg-gray-50 border-dashed">
        <CardContent className="pt-6 text-xs text-gray-600 space-y-1">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            <span>未付款：尚未繳交的勞健保費，每日累積滯納金</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span>逾期付款：付款日晚於到期日，實際已發生滯納金損失</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>準時付款：無滯納金損失</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
