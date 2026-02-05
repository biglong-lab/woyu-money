// 一般付款管理 - 篩選面板元件
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, X, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import type { PaymentProject, CategoryWithSource, StatusCounts } from "./general-payment-types";

export interface GeneralPaymentFilterPanelProps {
  // 篩選狀態
  searchTerm: string;
  selectedProject: string;
  selectedCategory: string;
  selectedStatus: string;
  selectedPaymentType: string;
  dateRange: string;
  selectedYear: number | null;
  selectedMonth: number | null;
  startDate: string;
  endDate: string;
  priorityFilter: string;
  showPaidItems: boolean;
  sortBy: string;
  sortOrder: "asc" | "desc";
  isPriorityFilterOpen: boolean;

  // 資料
  projects: PaymentProject[];
  allCategories: CategoryWithSource[];
  filteredCount: number;
  totalCount: number;
  statusCounts: StatusCounts;

  // 回調
  onSearchTermChange: (value: string) => void;
  onSelectedProjectChange: (value: string) => void;
  onSelectedCategoryChange: (value: string) => void;
  onSelectedStatusChange: (value: string) => void;
  onSelectedPaymentTypeChange: (value: string) => void;
  onDateRangeChange: (value: string) => void;
  onSelectedYearChange: (value: number | null) => void;
  onSelectedMonthChange: (value: number | null) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onPriorityFilterChange: (value: string) => void;
  onShowPaidItemsChange: (value: boolean) => void;
  onSortByChange: (value: string) => void;
  onSortOrderChange: (value: "asc" | "desc") => void;
  onIsPriorityFilterOpenChange: (value: boolean) => void;
  onResetAllFilters: () => void;
  onClearAllFilters: () => void;
  onRefreshData: () => void;
  onApplyQuickFilter: (filterType: string) => void;
}

export function GeneralPaymentFilterPanel({
  searchTerm,
  selectedProject,
  selectedCategory,
  selectedStatus,
  selectedPaymentType,
  dateRange,
  selectedYear,
  selectedMonth,
  startDate,
  endDate,
  priorityFilter,
  showPaidItems,
  sortBy,
  sortOrder,
  isPriorityFilterOpen,
  projects,
  allCategories,
  filteredCount,
  totalCount,
  statusCounts,
  onSearchTermChange,
  onSelectedProjectChange,
  onSelectedCategoryChange,
  onSelectedStatusChange,
  onSelectedPaymentTypeChange,
  onDateRangeChange,
  onSelectedYearChange,
  onSelectedMonthChange,
  onStartDateChange,
  onEndDateChange,
  onPriorityFilterChange,
  onShowPaidItemsChange,
  onSortByChange,
  onSortOrderChange,
  onIsPriorityFilterOpenChange,
  onResetAllFilters,
  onClearAllFilters,
  onRefreshData,
  onApplyQuickFilter,
}: GeneralPaymentFilterPanelProps) {
  return (
    <Card className="mb-6 border-2 border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800">進階篩選與搜尋</span>
            <span className="text-sm font-normal text-gray-500">
              (顯示 {filteredCount} / {totalCount} 筆)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onResetAllFilters}
              className="flex items-center gap-2 hover:bg-red-50 text-red-600 border-red-200"
              data-testid="btn-reset-filters"
            >
              <X className="w-4 h-4" />
              重置篩選
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshData}
              className="flex items-center gap-2 hover:bg-blue-100"
            >
              <RefreshCw className="w-4 h-4" />
              刷新數據
            </Button>
          </div>
        </CardTitle>

        {/* 快速篩選按鈕 */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge
            variant="outline"
            className="cursor-pointer px-3 py-1 hover:bg-orange-100 border-orange-300 text-orange-700"
            onClick={() => onApplyQuickFilter("pending")}
            data-testid="quick-filter-pending"
          >
            待付款 ({statusCounts.pending})
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer px-3 py-1 hover:bg-red-100 border-red-300 text-red-700"
            onClick={() => onApplyQuickFilter("overdue")}
            data-testid="quick-filter-overdue"
          >
            已逾期 ({statusCounts.overdue})
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer px-3 py-1 hover:bg-blue-100 border-blue-300 text-blue-700"
            onClick={() => onApplyQuickFilter("thisMonth")}
            data-testid="quick-filter-thismonth"
          >
            本月 ({statusCounts.thisMonth})
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer px-3 py-1 hover:bg-gray-100 border-gray-300 text-gray-700"
            onClick={() => onApplyQuickFilter("unpaid")}
            data-testid="quick-filter-unpaid"
          >
            所有未付
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 第一行：搜尋和基本篩選 */}
        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">第一行</span>
            基本搜尋與篩選
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜尋項目名稱或備註..."
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedProject} onValueChange={onSelectedProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="選擇專案" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有專案</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={onSelectedCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="選擇分類" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有分類</SelectItem>
                {allCategories.map((category) => (
                  <SelectItem key={`${category.categoryType}-${category.id}`} value={category.id.toString()}>
                    <div className="flex items-center justify-between w-full">
                      <span>{category.categoryName}</span>
                      <span className="text-xs text-gray-500 ml-2">{category.source}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={onSelectedStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="付款狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有狀態</SelectItem>
                <SelectItem value="unpaid">未付款</SelectItem>
                <SelectItem value="partial">部分付款</SelectItem>
                <SelectItem value="paid">已付款</SelectItem>
                <SelectItem value="overdue">逾期</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={onDateRangeChange}>
              <SelectTrigger>
                <SelectValue placeholder="時間範圍" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有時間</SelectItem>
                <SelectItem value="today">今日</SelectItem>
                <SelectItem value="week">近7天</SelectItem>
                <SelectItem value="month">近30天</SelectItem>
                <SelectItem value="current-month">本月</SelectItem>
                <SelectItem value="quarter">近90天</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={onClearAllFilters}
            >
              清除篩選
            </Button>
          </div>
        </div>

        {/* 第二行：時間範圍篩選 */}
        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">第二行</span>
            時間範圍篩選
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-8 items-end">
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">年份</label>
              <Select value={selectedYear?.toString() || "all"} onValueChange={(value) => onSelectedYearChange(value === "all" ? null : parseInt(value))}>
                <SelectTrigger className="bg-blue-50 border-blue-200">
                  <SelectValue placeholder="選擇年份" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有年份</SelectItem>
                  {Array.from({length: 12}, (_, i) => new Date().getFullYear() - 2 + i).map(year => {
                    const currentYear = new Date().getFullYear();
                    const isCurrentYear = year === currentYear;
                    return (
                      <SelectItem
                        key={year}
                        value={year.toString()}
                        className={isCurrentYear ? "bg-blue-100 font-semibold text-blue-800" : ""}
                      >
                        {year}年 {isCurrentYear && "本年"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">月份</label>
              <Select
                value={selectedMonth !== null ? selectedMonth.toString() : "all"}
                onValueChange={(value) => onSelectedMonthChange(value === "all" ? null : parseInt(value))}
              >
                <SelectTrigger className="bg-green-50 border-green-200">
                  <SelectValue placeholder="選擇月份" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有月份</SelectItem>
                  {Array.from({length: 12}, (_, i) => i + 1).map(month => {
                    const currentMonth = new Date().getMonth() + 1;
                    const isCurrentMonth = month === currentMonth;
                    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
                    return (
                      <SelectItem
                        key={month}
                        value={month.toString()}
                        className={isCurrentMonth ? "bg-green-100 font-semibold text-green-800" : ""}
                      >
                        {monthNames[month - 1]} {isCurrentMonth && "本月"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">排序方式</label>
              <Select value={sortBy} onValueChange={onSortByChange}>
                <SelectTrigger className="bg-purple-50 border-purple-200">
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate">到期日期</SelectItem>
                  <SelectItem value="amount">金額大小</SelectItem>
                  <SelectItem value="itemName">項目名稱</SelectItem>
                  <SelectItem value="projectName">專案名稱</SelectItem>
                  <SelectItem value="status">付款狀態</SelectItem>
                  <SelectItem value="createdAt">建立時間</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">排序順序</label>
              <Select value={sortOrder} onValueChange={(value: "asc" | "desc") => onSortOrderChange(value)}>
                <SelectTrigger className="bg-purple-50 border-purple-200">
                  <SelectValue placeholder="排序順序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">升序 ↑</SelectItem>
                  <SelectItem value="desc">降序 ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">開始日期</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">結束日期</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 第三行：優先級篩選 - 可收納 */}
        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div
            className="text-sm font-medium text-gray-700 mb-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded"
            onClick={() => onIsPriorityFilterOpenChange(!isPriorityFilterOpen)}
          >
            <div className="flex items-center gap-2">
              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">第三行</span>
              優先級與進階篩選
            </div>
            {isPriorityFilterOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>

          {isPriorityFilterOpen && (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 items-end">
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium">優先順序</label>
                <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="優先順序" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有項目</SelectItem>
                    <SelectItem value="overdue">逾期項目</SelectItem>
                    <SelectItem value="urgent">急迫項目</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="show-paid"
                  checked={showPaidItems}
                  onCheckedChange={onShowPaidItemsChange}
                />
                <label htmlFor="show-paid" className="text-sm">顯示已付款</label>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
