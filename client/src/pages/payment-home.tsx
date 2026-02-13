/**
 * PaymentHome - 付款首頁（操作中心）
 * 重新設計為以操作為核心的儀表板：
 * 1. 全域搜尋列
 * 2. 緊急待辦（逾期 + 3日內到期）
 * 3. 本月摘要 + 快速記錄入口
 * 4. 近期付款時間線
 * 5. 專案狀況矩陣
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Plus,
  Camera,
  ArrowRight,
  Calendar,
  Building2,
  Home as HomeIcon,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
import type { PaymentItem, PaymentRecord, PaymentSchedule } from "@shared/schema";

/** API 回傳的付款項目（含關聯專案名） */
interface PaymentItemWithProject extends PaymentItem {
  projectName?: string;
}

/** API 回傳的專案統計摘要 */
interface ProjectStatsOverall {
  totalPlanned?: string | number;
  totalPaid?: string | number;
  totalUnpaid?: string | number;
}

/** API 回傳的單一專案統計 */
interface ProjectStatItem {
  id: number;
  projectName?: string;
  projectType?: string;
  completionRate?: number;
  totalPaid?: string | number;
  totalPlanned?: string | number;
}

/** API 回傳的專案統計資料結構 */
interface ProjectStatsResponse {
  projects?: ProjectStatItem[];
}

/** API 回傳的排程（含關聯名稱） */
interface ScheduleWithNames extends PaymentSchedule {
  itemName?: string;
  projectName?: string;
}

/** API 回傳的付款記錄（含關聯名稱） */
interface RecordWithNames extends PaymentRecord {
  itemName?: string;
  projectName?: string;
  amount?: string;
}

/** 緊急待辦項目（帶到期日與天數差） */
interface UrgentItem extends PaymentItemWithProject {
  dueDate: Date;
  diffDays: number;
}

export default function PaymentHome() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  // API 查詢
  const { data: overallStats } = useQuery({
    queryKey: ["/api/payment/project/stats"],
  });

  const { data: paymentItems } = useQuery({
    queryKey: ["/api/payment/items"],
  });

  const { data: projectStatsData } = useQuery({
    queryKey: ["/api/payment/projects/stats"],
  });

  const { data: recentRecords } = useQuery({
    queryKey: ["/api/payment/records"],
    select: (data: RecordWithNames[]) => (Array.isArray(data) ? data.slice(0, 5) : []),
  });

  const { data: scheduleData } = useQuery({
    queryKey: ["/api/payment-schedules"],
  });

  // 安全的資料取出
  const stats = (overallStats as ProjectStatsOverall) || {};
  const items: PaymentItemWithProject[] = Array.isArray(paymentItems) ? paymentItems : [];
  const projectStatsTyped = projectStatsData as ProjectStatsResponse | undefined;
  const projectStats: ProjectStatItem[] = Array.isArray(projectStatsTyped?.projects)
    ? projectStatsTyped.projects
    : [];
  const schedules: ScheduleWithNames[] = Array.isArray(scheduleData) ? scheduleData : [];

  // 格式化函數
  const formatCurrency = (value: string | number | null | undefined) => {
    const num = parseFloat(String(value || "0"));
    return isNaN(num) ? "0" : Math.round(num).toLocaleString();
  };

  // 計算緊急待辦（逾期 + 3日內到期）
  const urgentItems = useMemo(() => {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    return items
      .filter((item: PaymentItemWithProject) => {
        if (item.isDeleted || item.status === "completed") return false;
        const paid = parseFloat(item.paidAmount || "0");
        const total = parseFloat(item.totalAmount || "0");
        if (paid >= total) return false;

        const dueDate = item.endDate
          ? new Date(item.endDate)
          : item.startDate
          ? new Date(item.startDate)
          : null;
        if (!dueDate) return false;

        return dueDate <= threeDaysLater;
      })
      .map((item: PaymentItemWithProject) => {
        const dueDate = item.endDate
          ? new Date(item.endDate)
          : new Date(item.startDate);
        const diffDays = Math.ceil(
          (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return { ...item, dueDate, diffDays } as UrgentItem;
      })
      .sort((a: UrgentItem, b: UrgentItem) => a.diffDays - b.diffDays)
      .slice(0, 5);
  }, [items]);

  // 本月摘要
  const monthlySummary = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthItems = items.filter((item: PaymentItemWithProject) => {
      if (!item?.startDate) return false;
      const d = new Date(item.startDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalDue = thisMonthItems.reduce(
      (sum: number, item: PaymentItemWithProject) => sum + parseFloat(item.totalAmount || "0"),
      0
    );
    const totalPaid = thisMonthItems.reduce(
      (sum: number, item: PaymentItemWithProject) => sum + parseFloat(item.paidAmount || "0"),
      0
    );

    return {
      totalDue,
      totalPaid,
      remaining: totalDue - totalPaid,
      itemCount: thisMonthItems.length,
    };
  }, [items]);

  // 近期排程時間線
  const upcomingSchedules = useMemo(() => {
    const now = new Date();
    return schedules
      .filter((s: ScheduleWithNames) => {
        const d = new Date(s.scheduledDate);
        return d >= now && s.status !== "completed";
      })
      .sort(
        (a: ScheduleWithNames, b: ScheduleWithNames) =>
          new Date(a.scheduledDate).getTime() -
          new Date(b.scheduledDate).getTime()
      )
      .slice(0, 6);
  }, [schedules]);

  // 全域搜尋
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return items
      .filter(
        (item: PaymentItemWithProject) =>
          item.itemName?.toLowerCase().includes(q) ||
          item.projectName?.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [items, searchQuery]);

  const getDueBadge = (diffDays: number) => {
    if (diffDays < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          逾期 {Math.abs(diffDays)} 天
        </Badge>
      );
    }
    if (diffDays === 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          今日到期
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-xs border-orange-300 text-orange-700 bg-orange-50"
      >
        {diffDays} 天後到期
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          浯島財務管理
        </h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString("zh-TW", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </p>
      </div>

      {/* 全域搜尋列 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="搜尋項目名稱、專案、金額..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-white"
        />
        {/* 搜尋結果下拉 */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-[300px] overflow-y-auto">
            {searchResults.map((item: PaymentItemWithProject) => (
              <Link
                key={item.id}
                href={`/payment-records`}
                onClick={() => setSearchQuery("")}
              >
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {item.itemName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.projectName || "無專案"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    ${formatCurrency(item.totalAmount)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 緊急待辦 */}
      {urgentItems.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-4 h-4" />
              緊急待辦
              <Badge variant="destructive" className="ml-auto">
                {urgentItems.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {urgentItems.map((item: UrgentItem) => {
              const remaining =
                parseFloat(item.totalAmount || "0") -
                parseFloat(item.paidAmount || "0");
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.itemName}
                      </p>
                      {getDueBadge(item.diffDays)}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.projectName || "無專案"} / 待付 $
                      {formatCurrency(remaining)}
                    </p>
                  </div>
                  <Link href="/payment-records">
                    <Button size="sm" variant="outline" className="ml-2 text-xs">
                      處理
                    </Button>
                  </Link>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 本月摘要 + 快速記錄 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 本月摘要 */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">本月摘要</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-medium">應付總額</p>
                <p className="text-lg sm:text-xl font-bold text-blue-900 mt-1">
                  ${formatCurrency(monthlySummary.totalDue)}
                </p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600 font-medium">已付金額</p>
                <p className="text-lg sm:text-xl font-bold text-green-900 mt-1">
                  ${formatCurrency(monthlySummary.totalPaid)}
                </p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-xs text-orange-600 font-medium">待付餘額</p>
                <p className="text-lg sm:text-xl font-bold text-orange-900 mt-1">
                  ${formatCurrency(monthlySummary.remaining)}
                </p>
              </div>
            </div>
            {/* 進度條 */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>本月完成進度</span>
                <span>
                  {monthlySummary.totalDue > 0
                    ? Math.round(
                        (monthlySummary.totalPaid / monthlySummary.totalDue) * 100
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      monthlySummary.totalDue > 0
                        ? Math.min(
                            (monthlySummary.totalPaid / monthlySummary.totalDue) *
                              100,
                            100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 快速記錄 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">快速操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/document-inbox">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-11"
              >
                <Camera className="w-4 h-4 text-purple-500" />
                掃描單據
              </Button>
            </Link>
            <Link href="/general-payment-management">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-11"
              >
                <Plus className="w-4 h-4 text-blue-500" />
                新增項目
              </Button>
            </Link>
            <Link href="/financial-overview">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-11"
              >
                <TrendingUp className="w-4 h-4 text-green-500" />
                財務總覽
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 全局統計 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">總計劃</p>
              <p className="text-lg font-bold text-gray-900">
                ${formatCurrency(stats.totalPlanned)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">已完成</p>
              <p className="text-lg font-bold text-gray-900">
                ${formatCurrency(stats.totalPaid)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">待付款</p>
              <p className="text-lg font-bold text-gray-900">
                ${formatCurrency(stats.totalUnpaid)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">專案數</p>
              <p className="text-lg font-bold text-gray-900">
                {projectStats.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* 近期付款時間線 */}
      {upcomingSchedules.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                近期付款時間線
              </CardTitle>
              <Link href="/payment-schedule">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  查看全部 <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {upcomingSchedules.map((schedule: ScheduleWithNames) => (
                  <div key={schedule.id} className="flex items-start gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center z-10 flex-shrink-0">
                      <span className="text-xs font-medium text-blue-700">
                        {new Date(schedule.scheduledDate).getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {schedule.itemName || "付款項目"}
                        </p>
                        <span className="text-sm font-semibold text-gray-700 flex-shrink-0 ml-2">
                          ${formatCurrency(schedule.scheduledAmount)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(schedule.scheduledDate).toLocaleDateString(
                          "zh-TW",
                          { month: "short", day: "numeric" }
                        )}
                        {schedule.projectName ? ` / ${schedule.projectName}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 專案狀況矩陣 */}
      {projectStats.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">專案狀況</h2>
            <Link href="/payment-project">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                查看全部 <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectStats.slice(0, 6).map((project: ProjectStatItem) => {
              const rate = Math.min(project.completionRate || 0, 100);
              return (
                <Card key={project.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {project.projectType === "business" ? (
                          <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        ) : (
                          <HomeIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                        )}
                        <span className="font-medium text-gray-900 truncate">
                          {project.projectName || "未命名"}
                        </span>
                      </div>
                      <span className="text-xs text-blue-600 font-medium">
                        {rate}%
                      </span>
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
              );
            })}
          </div>
        </div>
      )}

      {/* 最近付款記錄 */}
      {recentRecords && recentRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">最近付款記錄</CardTitle>
              <Link href="/payment-records">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  全部記錄 <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentRecords.map((record: RecordWithNames) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {record.itemName || "付款項目"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {record.projectName} /{" "}
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
    </div>
  );
}
