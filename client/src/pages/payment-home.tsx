/**
 * PaymentHome - 付款首頁（行動中心）
 * 重新設計為行動優先：
 * 1. 快速動作區（拍單據 + 手動記帳）
 * 2. 待處理區（逾期/即將到期/待歸檔，可直接操作）
 * 3. 本月摘要
 * 4. 最近動態
 */
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Camera,
  ArrowRight,
  Calendar,
  Building2,
  Home as HomeIcon,
  CreditCard,
  FileText,
  Inbox,
  Loader2,
  X,
} from "lucide-react"
import { Link } from "wouter"
import { useState, useMemo, useCallback } from "react"
import type { PaymentItem, PaymentRecord, PaymentSchedule } from "@shared/schema"
import { QuickAddDrawer, useQuickCameraUpload } from "@/components/quick-add-drawer"
import { QuickPaymentDialog } from "@/components/quick-payment-dialog"
import { TodayFocusCard } from "@/components/today-focus-card"
import { FinancialAssistantQuickCard } from "@/components/financial-assistant-quick-card"
import { FinancialHealthSummaryCard } from "@/components/financial-health-summary-card"
import { ActiveRentalsCard } from "@/components/active-rentals-card"
import { RecentPaymentsCard } from "@/components/recent-payments-card"

/** API 回傳的付款項目（含關聯專案名） */
interface PaymentItemWithProject extends PaymentItem {
  projectName?: string
}

/** API 回傳的專案統計摘要 */
interface ProjectStatsOverall {
  totalPlanned?: string | number
  totalPaid?: string | number
  totalUnpaid?: string | number
}

/** API 回傳的單一專案統計 */
interface ProjectStatItem {
  id: number
  projectName?: string
  projectType?: string
  completionRate?: number
  totalPaid?: string | number
  totalPlanned?: string | number
}

/** API 回傳的專案統計資料結構 */
interface ProjectStatsResponse {
  projects?: ProjectStatItem[]
}

/** API 回傳的排程（含關聯名稱） */
interface ScheduleWithNames extends PaymentSchedule {
  itemName?: string
  projectName?: string
}

/** API 回傳的付款記錄（含關聯名稱） */
interface RecordWithNames extends PaymentRecord {
  itemName?: string
  projectName?: string
  amount?: string
}

/** 緊急待辦項目（帶到期日與天數差） */
interface UrgentItem extends PaymentItemWithProject {
  dueDate: Date
  diffDays: number
}

/** 單據收件箱統計 */
interface InboxStats {
  pending?: number
  processing?: number
  recognized?: number
  total?: number
}

export default function PaymentHome() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showQuickPay, setShowQuickPay] = useState(false)
  const { openCamera, isUploading } = useQuickCameraUpload()

  // API 查詢
  const { data: overallStats } = useQuery({
    queryKey: ["/api/payment/project/stats"],
  })

  const { data: paymentItems } = useQuery({
    queryKey: ["/api/payment/items"],
  })

  const { data: projectStatsData } = useQuery({
    queryKey: ["/api/payment/projects/stats"],
  })

  const { data: recentRecords } = useQuery({
    queryKey: ["/api/payment/records"],
    select: (data: RecordWithNames[]) => (Array.isArray(data) ? data.slice(0, 5) : []),
  })

  const { data: scheduleData } = useQuery({
    queryKey: ["/api/payment-schedules"],
  })

  const { data: inboxStats } = useQuery<InboxStats>({
    queryKey: ["/api/document-inbox/stats"],
  })

  // 安全的資料取出
  const stats = (overallStats as ProjectStatsOverall) || {}
  const items: PaymentItemWithProject[] = Array.isArray(paymentItems) ? paymentItems : []
  const projectStatsTyped = projectStatsData as ProjectStatsResponse | undefined
  const projectStats: ProjectStatItem[] = Array.isArray(projectStatsTyped?.projects)
    ? projectStatsTyped.projects
    : []
  const schedules: ScheduleWithNames[] = Array.isArray(scheduleData) ? scheduleData : []
  const pendingDocs = (inboxStats?.pending || 0) + (inboxStats?.recognized || 0)

  // 格式化函數
  const formatCurrency = useCallback((value: string | number | null | undefined) => {
    const num = parseFloat(String(value || "0"))
    return isNaN(num) ? "0" : Math.round(num).toLocaleString()
  }, [])

  // 計算緊急待辦（逾期 + 3日內到期）
  const urgentItems = useMemo(() => {
    const now = new Date()
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    return items
      .filter((item: PaymentItemWithProject) => {
        if (item.isDeleted || item.status === "completed") return false
        const paid = parseFloat(item.paidAmount || "0")
        const total = parseFloat(item.totalAmount || "0")
        if (paid >= total) return false

        const dueDate = item.endDate
          ? new Date(item.endDate)
          : item.startDate
            ? new Date(item.startDate)
            : null
        if (!dueDate) return false

        return dueDate <= threeDaysLater
      })
      .map((item: PaymentItemWithProject) => {
        const dueDate = item.endDate ? new Date(item.endDate) : new Date(item.startDate)
        const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return { ...item, dueDate, diffDays } as UrgentItem
      })
      .sort((a: UrgentItem, b: UrgentItem) => a.diffDays - b.diffDays)
      .slice(0, 5)
  }, [items])

  // 本月摘要
  const monthlySummary = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const thisMonthItems = items.filter((item: PaymentItemWithProject) => {
      if (!item?.startDate) return false
      const d = new Date(item.startDate)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })

    const totalDue = thisMonthItems.reduce(
      (sum: number, item: PaymentItemWithProject) => sum + parseFloat(item.totalAmount || "0"),
      0
    )
    const totalPaid = thisMonthItems.reduce(
      (sum: number, item: PaymentItemWithProject) => sum + parseFloat(item.paidAmount || "0"),
      0
    )

    return {
      totalDue,
      totalPaid,
      remaining: totalDue - totalPaid,
      itemCount: thisMonthItems.length,
    }
  }, [items])

  // 近期排程時間線
  const upcomingSchedules = useMemo(() => {
    const now = new Date()
    return schedules
      .filter((s: ScheduleWithNames) => {
        const d = new Date(s.scheduledDate)
        return d >= now && s.status !== "completed"
      })
      .sort(
        (a: ScheduleWithNames, b: ScheduleWithNames) =>
          new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
      )
      .slice(0, 6)
  }, [schedules])

  // 全域搜尋
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return items
      .filter(
        (item: PaymentItemWithProject) =>
          item.itemName?.toLowerCase().includes(q) || item.projectName?.toLowerCase().includes(q)
      )
      .slice(0, 5)
  }, [items, searchQuery])

  const getDueBadge = (diffDays: number) => {
    if (diffDays < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          逾期 {Math.abs(diffDays)} 天
        </Badge>
      )
    }
    if (diffDays === 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          今日到期
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
        {diffDays} 天後到期
      </Badge>
    )
  }

  // 待處理總數（緊急 + 待歸檔單據）
  const totalPending = urgentItems.length + pendingDocs

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ===== 快速動作區（置頂、最醒目）===== */}
      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">浯島財務</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              {new Date().toLocaleDateString("zh-TW", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </p>
          </div>
          {totalPending > 0 && (
            <Badge variant="destructive" className="text-xs px-2 py-1">
              {totalPending} 項待處理
            </Badge>
          )}
        </div>

        {/* 兩個大按鈕 — 拍單據 + 手動記帳 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={openCamera}
            disabled={isUploading}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg active:scale-95 transition-transform"
          >
            {isUploading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <Camera className="w-8 h-8" />
            )}
            <span className="text-sm font-semibold">{isUploading ? "上傳中..." : "拍單據"}</span>
          </button>
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg active:scale-95 transition-transform"
          >
            <FileText className="w-8 h-8" />
            <span className="text-sm font-semibold">手動記帳</span>
          </button>
        </div>

        {/* 快速付款按鈕 — 次要但常用 */}
        <Button
          variant="outline"
          className="w-full mt-2 h-11 gap-2 text-green-700 border-green-200 bg-green-50 hover:bg-green-100"
          onClick={() => setShowQuickPay(true)}
        >
          <DollarSign className="w-4 h-4" />
          記錄已付款
        </Button>
      </div>

      {/* ===== 搜尋列 ===== */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="搜尋項目或專案..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSearchQuery("")
          }}
          className="pl-10 pr-10 h-10 bg-white"
          data-testid="home-search-input"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="清除搜尋（Esc）"
            data-testid="home-search-clear"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {searchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-[250px] overflow-y-auto">
            {searchResults.length > 0 ? (
              <>
                <div className="px-4 py-1.5 text-xs text-gray-500 border-b bg-gray-50">
                  找到 {searchResults.length} 個結果
                </div>
                {searchResults.map((item: PaymentItemWithProject) => (
                  <Link key={item.id} href="/payment-records" onClick={() => setSearchQuery("")}>
                    <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
                        <p className="text-xs text-gray-500">{item.projectName || "無專案"}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">
                        ${formatCurrency(item.totalAmount)}
                      </span>
                    </div>
                  </Link>
                ))}
              </>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                <Search className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                找不到符合「{searchQuery}」的項目
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== 財務健康度摘要（一眼看現狀）===== */}
      <FinancialHealthSummaryCard />

      {/* ===== 財務助理快速入口（5 大決策工具）===== */}
      <FinancialAssistantQuickCard />

      {/* ===== 今日焦點（破解「看到欠款就逃避」的惡性循環）===== */}
      <TodayFocusCard />

      {/* ===== 本月主要租金狀態（一鍵付款）===== */}
      <ActiveRentalsCard />

      {/* ===== 最近已付（成就回饋）===== */}
      <RecentPaymentsCard />

      {/* ===== 待處理區（可直接操作）===== */}
      {(urgentItems.length > 0 || pendingDocs > 0) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">待處理</h2>

          {/* 待歸檔單據提示 */}
          {pendingDocs > 0 && (
            <Link href="/document-inbox">
              <Card className="border-purple-200 bg-purple-50/50 hover:bg-purple-50 transition-colors cursor-pointer">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Inbox className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-900">
                        {pendingDocs} 張單據待處理
                      </p>
                      <p className="text-xs text-purple-600">點擊查看並歸檔</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-purple-400" />
                </CardContent>
              </Card>
            </Link>
          )}

          {/* 緊急付款項目 — 可直接點擊付款 */}
          {urgentItems.map((item: UrgentItem) => {
            const remaining =
              parseFloat(item.totalAmount || "0") - parseFloat(item.paidAmount || "0")
            return (
              <Card
                key={item.id}
                className="border-red-200 bg-red-50/30 hover:bg-red-50 transition-colors"
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.itemName}
                        </p>
                        {getDueBadge(item.diffDays)}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.projectName || "無專案"} · 待付 ${formatCurrency(remaining)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="ml-2 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => setShowQuickPay(true)}
                    >
                      付款
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ===== 本月摘要 ===== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">本月摘要</h3>
            <span className="text-xs text-gray-400">{monthlySummary.itemCount} 筆項目</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 bg-blue-50 rounded-xl">
              <p className="text-[10px] text-blue-600 font-medium">應付</p>
              <p className="text-sm sm:text-base font-bold text-blue-900 mt-0.5">
                ${formatCurrency(monthlySummary.totalDue)}
              </p>
            </div>
            <div className="text-center p-2 bg-green-50 rounded-xl">
              <p className="text-[10px] text-green-600 font-medium">已付</p>
              <p className="text-sm sm:text-base font-bold text-green-900 mt-0.5">
                ${formatCurrency(monthlySummary.totalPaid)}
              </p>
            </div>
            <div className="text-center p-2 bg-orange-50 rounded-xl">
              <p className="text-[10px] text-orange-600 font-medium">待付</p>
              <p className="text-sm sm:text-base font-bold text-orange-900 mt-0.5">
                ${formatCurrency(monthlySummary.remaining)}
              </p>
            </div>
          </div>
          {/* 進度條 */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    monthlySummary.totalDue > 0
                      ? Math.min((monthlySummary.totalPaid / monthlySummary.totalDue) * 100, 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== 全局統計卡片 ===== */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500">總計劃</p>
              <p className="text-sm font-bold text-gray-900">
                ${formatCurrency(stats.totalPlanned)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500">已完成</p>
              <p className="text-sm font-bold text-gray-900">${formatCurrency(stats.totalPaid)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500">待付款</p>
              <p className="text-sm font-bold text-gray-900">
                ${formatCurrency(stats.totalUnpaid)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500">專案數</p>
              <p className="text-sm font-bold text-gray-900">{projectStats.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ===== 近期付款時間線 ===== */}
      {upcomingSchedules.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                近期排程
              </CardTitle>
              <Link href="/payment-schedule">
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                  全部 <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {upcomingSchedules.map((schedule: ScheduleWithNames) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-blue-700">
                        {new Date(schedule.scheduledDate).getDate()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {schedule.itemName || "付款項目"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(schedule.scheduledDate).toLocaleDateString("zh-TW", {
                          month: "short",
                          day: "numeric",
                        })}
                        {schedule.projectName ? ` · ${schedule.projectName}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 flex-shrink-0 ml-2">
                    ${formatCurrency(schedule.scheduledAmount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== 專案狀況 ===== */}
      {projectStats.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              專案狀況
            </h2>
            <Link href="/payment-project">
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                全部 <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {projectStats.slice(0, 6).map((project: ProjectStatItem) => {
              const rate = Math.min(project.completionRate || 0, 100)
              return (
                <Card key={project.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {project.projectType === "business" ? (
                          <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        ) : (
                          <HomeIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {project.projectName || "未命名"}
                        </span>
                      </div>
                      <span className="text-xs text-blue-600 font-medium">{rate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>已付 ${formatCurrency(project.totalPaid)}</span>
                      <span>總額 ${formatCurrency(project.totalPlanned)}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== 最近付款記錄 ===== */}
      {recentRecords && recentRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">最近付款</CardTitle>
              <Link href="/payment-records">
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                  全部 <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {recentRecords.map((record: RecordWithNames) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {record.itemName || "付款項目"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {record.projectName} ·{" "}
                      {new Date(record.paymentDate).toLocaleDateString("zh-TW")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-green-600 flex-shrink-0 ml-2">
                    ${formatCurrency(record.amount || record.amountPaid)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== 對話框/抽屜 ===== */}
      <QuickAddDrawer open={showQuickAdd} onOpenChange={setShowQuickAdd} />
      <QuickPaymentDialog open={showQuickPay} onOpenChange={setShowQuickPay} />
    </div>
  )
}
