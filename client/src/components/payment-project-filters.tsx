// 專案付款管理 - 搜尋篩選區域元件
import { Ref } from "react";
import { Search, Filter, MoreHorizontal, Calendar, DollarSign, TrendingUp, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Star, Clock, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveButtonGroup } from "@/components/enhanced-responsive-components";
import type { PaymentItem, PaymentProject } from "./payment-project-types";
import type { FixedCategory, DebtCategory } from "@/../../shared/schema/category";

export interface PaymentProjectFiltersProps {
  // 統計模式
  statisticsMode: 'expense' | 'cashflow';
  setStatisticsMode: (mode: 'expense' | 'cashflow') => void;
  // 專案管理對話框
  onOpenProjectCategoryDialog: () => void;
  // 效能指標
  filteredItemsCount: number;
  isLoadingMore: boolean;
  selectedItemsCount: number;
  // 搜尋
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  debouncedSearchTerm: string;
  setDebouncedSearchTerm: (term: string) => void;
  searchInputRef: Ref<HTMLInputElement>;
  // 篩選器
  selectedProject: string;
  setSelectedProject: (value: string) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  selectedStatus: string;
  setSelectedStatus: (value: string) => void;
  selectedPaymentType: string;
  setSelectedPaymentType: (value: string) => void;
  dateRange: string;
  setDateRange: (value: string) => void;
  priorityFilter: string;
  setPriorityFilter: (value: string) => void;
  showPaidItems: boolean;
  setShowPaidItems: (value: boolean) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  sortOrder: string;
  setSortOrder: (value: string) => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (value: boolean) => void;
  // 時間導航
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  // 操作函數
  resetFilters: () => void;
  applySmartFilter: (filterType: 'urgent' | 'thisMonth' | 'highAmount' | 'overdue') => void;
  // 資料
  projects: PaymentProject[] | undefined;
  fixedCategoriesData: FixedCategory[];
  projectCategoriesData: DebtCategory[];
}

export default function PaymentProjectFilters({
  statisticsMode,
  setStatisticsMode,
  onOpenProjectCategoryDialog,
  filteredItemsCount,
  isLoadingMore,
  selectedItemsCount,
  searchTerm,
  setSearchTerm,
  debouncedSearchTerm,
  setDebouncedSearchTerm,
  searchInputRef,
  selectedProject,
  setSelectedProject,
  selectedCategory,
  setSelectedCategory,
  selectedStatus,
  setSelectedStatus,
  selectedPaymentType,
  setSelectedPaymentType,
  dateRange,
  setDateRange,
  priorityFilter,
  setPriorityFilter,
  showPaidItems,
  setShowPaidItems,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  showAdvancedFilters,
  setShowAdvancedFilters,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  resetFilters,
  applySmartFilter,
  projects,
  fixedCategoriesData,
  projectCategoriesData,
}: PaymentProjectFiltersProps) {
  return (
    <>
      {/* 標題區域 - 手機版簡化 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 px-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">專案付款管理</h1>
          <p className="text-sm sm:text-base text-muted-foreground hidden sm:block">管理專案相關的付款項目和記錄</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* 統計邏輯模式切換 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button
              variant={statisticsMode === 'expense' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatisticsMode('expense')}
              className={`px-2 py-1 text-xs rounded-md transition-all ${
                statisticsMode === 'expense'
                  ? 'bg-white shadow-sm text-blue-600 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="h-3 w-3 mr-1" />
              費用歸屬
            </Button>
            <Button
              variant={statisticsMode === 'cashflow' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatisticsMode('cashflow')}
              className={`px-2 py-1 text-xs rounded-md transition-all ${
                statisticsMode === 'cashflow'
                  ? 'bg-white shadow-sm text-green-600 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              現金流
            </Button>
          </div>

          <ResponsiveButtonGroup
            buttons={[
              {
                label: "專案管理",
                onClick: onOpenProjectCategoryDialog,
                variant: "outline",
              },
            ]}
            orientation="horizontal"
          />
        </div>
      </div>

      {/* 效能監控指標 - 手機版隱藏 */}
      <Card className="border border-blue-200 bg-blue-50/30 hidden sm:block">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-gray-600 text-xs sm:text-sm">載入: <span className="font-mono text-green-600">0.3s</span></span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                <span className="text-gray-600 text-xs sm:text-sm">項目: <span className="font-mono text-blue-600">{filteredItemsCount}</span></span>
              </div>
              {isLoadingMore && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <RefreshCw className="h-3 w-3 animate-spin text-orange-500" />
                  <span className="text-orange-600 text-xs sm:text-sm">載入中...</span>
                </div>
              )}
            </div>
            <div className="hidden lg:flex items-center gap-2 text-xs text-gray-500">
              <span>虛擬滾動: 啟用</span>
              <span>•</span>
              <span>智能篩選: 可用</span>
              <span>•</span>
              <span>批量操作: {selectedItemsCount > 0 ? `已選擇 ${selectedItemsCount} 項` : '就緒'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 搜尋與篩選區域 - 手機版優化 */}
      <Card className="border-2 mx-1 sm:mx-0">
        <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <CardTitle className="text-base sm:text-lg">搜尋與篩選</CardTitle>
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 text-muted-foreground"
              >
                <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">重置</span>
              </Button>

              {/* 智能篩選按鈕群組 - 手機版橫向滾動 */}
              <div className="flex gap-1 overflow-x-auto scrollbar-none">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applySmartFilter('urgent')}
                  className="h-7 sm:h-8 text-xs bg-red-50 hover:bg-red-100 border-red-200 text-red-700 flex-shrink-0"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  緊急
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applySmartFilter('thisMonth')}
                  className="h-7 sm:h-8 text-xs bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 flex-shrink-0"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  本月
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applySmartFilter('highAmount')}
                  className="h-7 sm:h-8 text-xs bg-green-50 hover:bg-green-100 border-green-200 text-green-700 flex-shrink-0"
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  高額
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applySmartFilter('overdue')}
                  className="h-7 sm:h-8 text-xs bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 flex-shrink-0"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  逾期
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="h-8"
              >
                <Filter className="h-4 w-4 mr-1" />
                {showAdvancedFilters ? "簡化" : "進階"}
                {showAdvancedFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 搜尋欄與重置按鈕 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                ref={searchInputRef}
                placeholder="搜尋項目名稱、分類或專案... (Ctrl+K快速搜尋)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-12 h-10"
              />
              {searchTerm !== debouncedSearchTerm && (
                <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                </div>
              )}
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setDebouncedSearchTerm("");
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-10 px-3"
              title="重置所有篩選條件 (Alt+0)"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* 快捷篩選按鈕 - 移到搜尋欄下方 */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedStatus === "overdue" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("overdue")}
              className="h-8"
            >
              <AlertTriangle className="h-4 w-4 mr-1" />
              逾期項目
            </Button>
            <Button
              variant={dateRange === "currentMonth" && selectedStatus === "unpaid" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateRange("currentMonth");
                setSelectedStatus("unpaid");
              }}
              className="h-8"
            >
              <Calendar className="h-4 w-4 mr-1" />
              本月到期
            </Button>
            <Button
              variant={dateRange === "currentMonthPayment" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateRange("currentMonthPayment");
                setSelectedStatus("all");
                setShowPaidItems(true);
              }}
              className="h-8"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              本月實付
            </Button>
            <Button
              variant={priorityFilter === "high" ? "default" : "outline"}
              size="sm"
              onClick={() => setPriorityFilter("high")}
              className="h-8"
            >
              <Star className="h-4 w-4 mr-1" />
              高優先級
            </Button>
            <Button
              variant={selectedStatus === "partial" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("partial")}
              className="h-8"
            >
              <Clock className="h-4 w-4 mr-1" />
              部分付款
            </Button>
            <Button
              variant={selectedPaymentType === "installment" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedPaymentType("installment");
                setSelectedStatus("all");
              }}
              className="h-8 bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              分期付款
            </Button>
            <Button
              variant={selectedPaymentType === "installment" && selectedStatus === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedPaymentType("installment");
                setSelectedStatus("pending");
              }}
              className="h-8"
            >
              <Clock className="h-4 w-4 mr-1" />
              分期待付
            </Button>
          </div>

          {/* 基本篩選 */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">專案</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選擇專案" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部專案</SelectItem>
                  {(Array.isArray(projects) ? projects : []).map((project: PaymentProject) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">狀態</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選擇狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部狀態</SelectItem>
                  <SelectItem value="pending">待付款</SelectItem>
                  <SelectItem value="partial">部分付款</SelectItem>
                  <SelectItem value="paid">已付清</SelectItem>
                  <SelectItem value="unpaid">未付款</SelectItem>
                  <SelectItem value="overdue">逾期項目</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">付款類型</Label>
              <Select value={selectedPaymentType} onValueChange={setSelectedPaymentType}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選擇類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部類型</SelectItem>
                  <SelectItem value="single">單次付款</SelectItem>
                  <SelectItem value="installment">分期付款</SelectItem>
                  <SelectItem value="monthly">月付</SelectItem>
                  <SelectItem value="recurring">定期付款</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">時間範圍</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選擇時間範圍" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部時間</SelectItem>
                  <SelectItem value="currentMonth">本月</SelectItem>
                  <SelectItem value="nextMonth">下月</SelectItem>
                  <SelectItem value="currentYear">今年</SelectItem>
                  <SelectItem value="upcoming">即將到期(7天內)</SelectItem>
                  <SelectItem value="overdue">已逾期</SelectItem>
                  <SelectItem value="custom">自訂範圍</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">優先級</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選擇優先級" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部優先級</SelectItem>
                  <SelectItem value="high">高優先級</SelectItem>
                  <SelectItem value="medium">中優先級</SelectItem>
                  <SelectItem value="low">低優先級</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 時間導航 */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-sm font-medium">時間導航</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      setSelectedYear(now.getFullYear());
                      setSelectedMonth(now.getMonth());
                    }}
                    className="h-8 text-xs btn-hover-lift"
                  >
                    回到當前月份
                  </Button>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="show-paid-items"
                      checked={showPaidItems}
                      onCheckedChange={setShowPaidItems}
                    />
                    <Label htmlFor="show-paid-items" className="text-sm">顯示已付款項目</Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* 年份選擇器 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">年份</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="選擇年份" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 30 }, (_, i) => {
                      const currentYear = new Date().getFullYear();
                      const year = currentYear - 10 + i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}年
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* 月份按鈕 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">月份</Label>
                <div className="grid grid-cols-6 gap-1">
                  {Array.from({ length: 12 }, (_, i) => (
                    <Button
                      key={i}
                      variant={selectedMonth === i ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedMonth(i)}
                      className="h-8 text-xs"
                    >
                      {i + 1}月
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 進階篩選 */}
          {showAdvancedFilters && (
            <div className="border-t pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">分類</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="選擇分類" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部分類</SelectItem>
                      {(Array.isArray(fixedCategoriesData) ? fixedCategoriesData : []).map((category: FixedCategory) => (
                        <SelectItem key={`fixed:${category.id}`} value={`fixed:${category.id}`}>
                          {category.categoryName} (固定)
                        </SelectItem>
                      ))}
                      {(Array.isArray(projectCategoriesData) ? projectCategoriesData : []).map((category: DebtCategory) => (
                        <SelectItem key={`project:${category.id}`} value={`project:${category.id}`}>
                          {category.categoryName} (專案)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">時間範圍</Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="選擇時間範圍" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部時間</SelectItem>
                      <SelectItem value="currentMonth">本月（項目日期）</SelectItem>
                      <SelectItem value="currentMonthPayment">本月（付款日期）</SelectItem>
                      <SelectItem value="upcoming">未來一週</SelectItem>
                      <SelectItem value="custom">自訂範圍</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">排序</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="排序方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dueDate">到期日期</SelectItem>
                      <SelectItem value="amount">金額</SelectItem>
                      <SelectItem value="name">項目名稱</SelectItem>
                      <SelectItem value="project">專案名稱</SelectItem>
                      <SelectItem value="status">狀態</SelectItem>
                      <SelectItem value="priority">優先級</SelectItem>
                      {/* 分期項目專屬排序 */}
                      <SelectItem value="installmentProgress">分期進度</SelectItem>
                      <SelectItem value="installmentDueDate">分期到期</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 自訂日期範圍 */}
              {dateRange === "custom" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">開始日期</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">結束日期</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              )}

              {/* 其他選項 */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-paid"
                    checked={showPaidItems}
                    onCheckedChange={setShowPaidItems}
                  />
                  <Label htmlFor="show-paid" className="text-sm">顯示已付清項目</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sort-order"
                    checked={sortOrder === "desc"}
                    onCheckedChange={(checked) => setSortOrder(checked ? "desc" : "asc")}
                  />
                  <Label htmlFor="sort-order" className="text-sm">降序排列</Label>
                </div>
              </div>
            </div>
          )}

          {/* 篩選結果統計 */}
          <div className="border-t pt-4">
            <div className="text-sm text-muted-foreground">
              顯示 <span className="font-medium text-foreground">{filteredItemsCount}</span> 個項目
              {searchTerm && (
                <>
                  ，搜尋「<span className="font-medium text-foreground">{searchTerm}</span>」
                </>
              )}
              {selectedProject !== "all" && projects && (
                <>
                  ，專案：<span className="font-medium text-foreground">
                    {projects.find((p: PaymentProject) => p.id.toString() === selectedProject)?.projectName}
                  </span>
                </>
              )}
              {selectedStatus !== "all" && (
                <>
                  ，狀態：<span className="font-medium text-foreground">
                    {selectedStatus === "pending" ? "待付款" :
                     selectedStatus === "partial" ? "部分付款" :
                     selectedStatus === "paid" ? "已付清" :
                     selectedStatus === "unpaid" ? "未付款" :
                     selectedStatus === "overdue" ? "逾期項目" : selectedStatus}
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
