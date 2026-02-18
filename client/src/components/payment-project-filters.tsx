// 專案付款管理 - 搜尋篩選區域元件（重構版）
// 合併重複控制項，提供乾淨易用的介面
import { Ref } from "react";
import {
  Search, Filter, Calendar, DollarSign, TrendingUp, AlertTriangle,
  ChevronDown, ChevronUp, Star, Clock, RotateCcw, X, ChevronLeft,
  ChevronRight, Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

/** 計算已啟用的篩選條件數量 */
function countActiveFilters(props: PaymentProjectFiltersProps): number {
  let count = 0;
  if (props.selectedProject !== "all") count++;
  if (props.selectedStatus !== "all") count++;
  if (props.selectedPaymentType !== "all") count++;
  if (props.dateRange !== "all" && props.dateRange !== "currentMonth") count++;
  if (props.priorityFilter !== "all") count++;
  if (props.selectedCategory !== "all") count++;
  if (props.searchTerm) count++;
  return count;
}

const MONTH_NAMES = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

// 快捷篩選設定
interface QuickFilter {
  label: string;
  icon?: React.ReactNode;
  isActive: (props: PaymentProjectFiltersProps) => boolean;
  apply: (props: PaymentProjectFiltersProps) => void;
}

const QUICK_FILTERS: QuickFilter[] = [
  {
    label: "逾期",
    icon: <AlertTriangle className="h-3 w-3" />,
    isActive: (p) => p.selectedStatus === "overdue",
    apply: (p) => { p.setSelectedStatus("overdue"); p.setDateRange("all"); },
  },
  {
    label: "本月到期",
    icon: <Calendar className="h-3 w-3" />,
    isActive: (p) => p.dateRange === "currentMonth" && p.selectedStatus === "unpaid",
    apply: (p) => { p.setDateRange("currentMonth"); p.setSelectedStatus("unpaid"); },
  },
  {
    label: "本月實付",
    icon: <DollarSign className="h-3 w-3" />,
    isActive: (p) => p.dateRange === "currentMonthPayment",
    apply: (p) => { p.setDateRange("currentMonthPayment"); p.setSelectedStatus("all"); p.setShowPaidItems(true); },
  },
  {
    label: "分期待付",
    icon: <Clock className="h-3 w-3" />,
    isActive: (p) => p.selectedPaymentType === "installment" && p.selectedStatus === "pending",
    apply: (p) => { p.setSelectedPaymentType("installment"); p.setSelectedStatus("pending"); p.setDateRange("all"); },
  },
  {
    label: "高優先",
    icon: <Star className="h-3 w-3" />,
    isActive: (p) => p.priorityFilter === "high",
    apply: (p) => p.setPriorityFilter(p.priorityFilter === "high" ? "all" : "high"),
  },
  {
    label: "分期付款",
    icon: <TrendingUp className="h-3 w-3" />,
    isActive: (p) => p.selectedPaymentType === "installment" && p.selectedStatus !== "pending",
    apply: (p) => { p.setSelectedPaymentType("installment"); p.setSelectedStatus("all"); p.setDateRange("all"); },
  },
];

export default function PaymentProjectFilters(props: PaymentProjectFiltersProps) {
  const {
    statisticsMode, setStatisticsMode,
    onOpenProjectCategoryDialog,
    filteredItemsCount,
    searchTerm, setSearchTerm, debouncedSearchTerm, setDebouncedSearchTerm, searchInputRef,
    selectedProject, setSelectedProject,
    selectedCategory, setSelectedCategory,
    selectedStatus, setSelectedStatus,
    selectedPaymentType, setSelectedPaymentType,
    dateRange, setDateRange,
    priorityFilter, setPriorityFilter,
    showPaidItems, setShowPaidItems,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    showAdvancedFilters, setShowAdvancedFilters,
    selectedYear, setSelectedYear,
    selectedMonth, setSelectedMonth,
    startDate, setStartDate,
    endDate, setEndDate,
    resetFilters,
    projects,
    fixedCategoriesData,
    projectCategoriesData,
  } = props;

  const activeFilterCount = countActiveFilters(props);

  // 月份導航
  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };
  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };
  const goToToday = () => {
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth());
  };

  return (
    <div className="space-y-3">
      {/* ── 標題列 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">專案付款管理</h1>
          <p className="text-xs text-muted-foreground">
            共 <span className="font-semibold text-foreground">{filteredItemsCount}</span> 筆
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs py-0 h-5">
                {activeFilterCount} 個篩選中
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 費用模式切換 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
            <Button
              variant={statisticsMode === 'expense' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatisticsMode('expense')}
              className={`h-7 px-2 text-xs rounded-md transition-all ${
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
              className={`h-7 px-2 text-xs rounded-md transition-all ${
                statisticsMode === 'cashflow'
                  ? 'bg-white shadow-sm text-green-600 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              現金流
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenProjectCategoryDialog} className="h-7 text-xs">
            <Settings2 className="h-3 w-3 mr-1" />
            專案管理
          </Button>
        </div>
      </div>

      {/* ── 篩選主卡片 ── */}
      <Card className="border-2">
        <CardContent className="p-3 sm:p-4 space-y-3">

          {/* 第一行：搜尋 + 重置 + 進階展開 */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                ref={searchInputRef}
                placeholder="搜尋項目名稱或專案… (Ctrl+K)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-9 text-sm"
              />
              {searchTerm !== debouncedSearchTerm && (
                <div className="absolute right-8 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              )}
              {searchTerm && (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { setSearchTerm(""); setDebouncedSearchTerm(""); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            <Button
              variant="outline" size="sm"
              onClick={resetFilters}
              className={`h-9 px-3 flex-shrink-0 ${activeFilterCount > 0 ? 'border-orange-300 text-orange-600 bg-orange-50 hover:bg-orange-100' : ''}`}
              title="重置所有篩選 (Alt+0)"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              重置
              {activeFilterCount > 0 && (
                <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-orange-500">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            <Button
              variant="ghost" size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="h-9 px-3 flex-shrink-0"
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              {showAdvancedFilters ? "收起" : "進階"}
              {showAdvancedFilters ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
            </Button>
          </div>

          {/* 第二行：快捷篩選（合併後，不重複） */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_FILTERS.map((qf) => (
              <Button
                key={qf.label}
                variant={qf.isActive(props) ? "default" : "outline"}
                size="sm"
                onClick={() => qf.apply(props)}
                className="h-7 text-xs px-2 flex items-center gap-1"
              >
                {qf.icon}
                {qf.label}
              </Button>
            ))}
          </div>

          {/* 第三行：月份導航（緊湊版，含左右箭頭） */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">時間：</span>
            <div className="flex items-center gap-1 bg-gray-50 rounded-md border px-2 py-1">
              <Button variant="ghost" size="sm" onClick={goToPrevMonth} className="h-6 w-6 p-0">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-sm font-medium min-w-[72px] text-center">
                {selectedYear}年{MONTH_NAMES[selectedMonth]}
              </span>
              <Button variant="ghost" size="sm" onClick={goToNextMonth} className="h-6 w-6 p-0">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={goToToday} className="h-6 text-xs px-2 ml-0.5 text-blue-600 hover:text-blue-700">
                今月
              </Button>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <Switch
                id="show-paid-compact"
                checked={showPaidItems}
                onCheckedChange={setShowPaidItems}
              />
              <Label htmlFor="show-paid-compact" className="text-xs text-muted-foreground cursor-pointer select-none">
                顯示已付清
              </Label>
            </div>
          </div>

          {/* 第四行：基本篩選（2+2 佈局） */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="全部專案" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部專案</SelectItem>
                {(Array.isArray(projects) ? projects : []).map((p: PaymentProject) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.projectName}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="全部狀態" />
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

            <Select value={selectedPaymentType} onValueChange={setSelectedPaymentType}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="付款類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部類型</SelectItem>
                <SelectItem value="single">單次付款</SelectItem>
                <SelectItem value="installment">分期付款</SelectItem>
                <SelectItem value="monthly">月付</SelectItem>
                <SelectItem value="recurring">定期付款</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="時間範圍" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部時間</SelectItem>
                <SelectItem value="currentMonth">本月（項目日期）</SelectItem>
                <SelectItem value="currentMonthPayment">本月（付款日期）</SelectItem>
                <SelectItem value="upcoming">7天內到期</SelectItem>
                <SelectItem value="custom">自訂範圍</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 自訂日期範圍 */}
          {dateRange === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">開始日期</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">結束日期</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          )}

          {/* 進階篩選 */}
          {showAdvancedFilters && (
            <div className="border-t pt-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="全部分類" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分類</SelectItem>
                    {(Array.isArray(fixedCategoriesData) ? fixedCategoriesData : []).map((c: FixedCategory) => (
                      <SelectItem key={`fixed:${c.id}`} value={`fixed:${c.id}`}>{c.categoryName}（固定）</SelectItem>
                    ))}
                    {(Array.isArray(projectCategoriesData) ? projectCategoriesData : []).map((c: DebtCategory) => (
                      <SelectItem key={`project:${c.id}`} value={`project:${c.id}`}>{c.categoryName}（專案）</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="全部優先級" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部優先級</SelectItem>
                    <SelectItem value="high">高優先級</SelectItem>
                    <SelectItem value="medium">中優先級</SelectItem>
                    <SelectItem value="low">低優先級</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="排序方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dueDate">到期日期</SelectItem>
                    <SelectItem value="amount">金額</SelectItem>
                    <SelectItem value="name">項目名稱</SelectItem>
                    <SelectItem value="project">專案名稱</SelectItem>
                    <SelectItem value="status">狀態</SelectItem>
                    <SelectItem value="priority">優先級</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="sort-order-adv"
                    checked={sortOrder === "desc"}
                    onCheckedChange={(c) => setSortOrder(c ? "desc" : "asc")}
                  />
                  <Label htmlFor="sort-order-adv" className="text-xs cursor-pointer select-none">降序排列</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-paid-adv"
                    checked={showPaidItems}
                    onCheckedChange={setShowPaidItems}
                  />
                  <Label htmlFor="show-paid-adv" className="text-xs cursor-pointer select-none">顯示已付清項目</Label>
                </div>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
