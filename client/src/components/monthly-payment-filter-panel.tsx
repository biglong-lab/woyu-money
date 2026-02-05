// 月付管理 - 篩選面板元件
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, X, ChevronDown, ChevronUp, AlertTriangle, Star, Clock, RotateCcw } from "lucide-react";
import type { PaymentProject, DebtCategory, FixedCategory } from "./monthly-payment-types";

export interface MonthlyPaymentFilterPanelProps {
  // 篩選狀態
  searchTerm: string;
  filterProject: string;
  filterStatus: string;
  filterCategory: string;
  sortBy: string;
  sortOrder: string;
  showAdvancedFilters: boolean;

  // 資料
  projects: PaymentProject[];
  categories: DebtCategory[];
  fixedCategories: FixedCategory[];

  // 回調
  onSearchTermChange: (value: string) => void;
  onFilterProjectChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onFilterCategoryChange: (value: string) => void;
  onSortByChange: (value: string) => void;
  onSortOrderChange: (value: string) => void;
  onShowAdvancedFiltersChange: (value: boolean) => void;
  onResetFilters: () => void;
}

export function MonthlyPaymentFilterPanel({
  searchTerm,
  filterProject,
  filterStatus,
  filterCategory,
  sortBy,
  sortOrder,
  showAdvancedFilters,
  projects,
  categories,
  fixedCategories,
  onSearchTermChange,
  onFilterProjectChange,
  onFilterStatusChange,
  onFilterCategoryChange,
  onSortByChange,
  onSortOrderChange,
  onShowAdvancedFiltersChange,
  onResetFilters,
}: MonthlyPaymentFilterPanelProps) {
  return (
    <div className="space-y-4">
      {/* 搜尋列 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="搜尋項目名稱、分類或專案..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="pl-10 pr-4"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSearchTermChange("")}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* 基本篩選與排序 */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* 專案篩選 */}
        <Select value={filterProject} onValueChange={onFilterProjectChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="所有專案" />
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

        {/* 狀態篩選 */}
        <Select value={filterStatus} onValueChange={onFilterStatusChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="所有狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有狀態</SelectItem>
            <SelectItem value="paid">已付清</SelectItem>
            <SelectItem value="unpaid">未付清</SelectItem>
            <SelectItem value="overdue">已逾期</SelectItem>
          </SelectContent>
        </Select>

        {/* 排序 */}
        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="startDate">開始日期</SelectItem>
            <SelectItem value="amount">金額</SelectItem>
            <SelectItem value="name">名稱</SelectItem>
            <SelectItem value="project">專案</SelectItem>
            <SelectItem value="status">狀態</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
        >
          {sortOrder === "asc" ? "升序" : "降序"}
        </Button>

        {/* 進階篩選按鈕 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onShowAdvancedFiltersChange(!showAdvancedFilters)}
        >
          <Filter className="w-4 h-4 mr-1" />
          進階篩選
          {showAdvancedFilters ? (
            <ChevronUp className="w-4 h-4 ml-1" />
          ) : (
            <ChevronDown className="w-4 h-4 ml-1" />
          )}
        </Button>

        {/* 重置篩選 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetFilters}
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          重置
        </Button>
      </div>

      {/* 進階篩選面板 */}
      {showAdvancedFilters && (
        <Card className="p-4 bg-gray-50">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">進階篩選選項</h4>

            {/* 分類篩選 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                分類篩選
              </label>
              <Select value={filterCategory} onValueChange={onFilterCategoryChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="所有分類" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有分類</SelectItem>
                  {/* 固定分類 */}
                  {fixedCategories.length > 0 && (
                    <>
                      <SelectItem value="fixed-header" disabled>
                        固定分類
                      </SelectItem>
                      {fixedCategories.map((category) => (
                        <SelectItem
                          key={`fixed-${category.id}`}
                          value={`fixed:${category.id}`}
                          className="pl-6"
                        >
                          {category.categoryName}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {/* 專案分類 */}
                  {categories.length > 0 && (
                    <>
                      <SelectItem value="project-header" disabled>
                        專案分類
                      </SelectItem>
                      {categories.map((category) => (
                        <SelectItem
                          key={`project-${category.id}`}
                          value={`project:${category.id}`}
                          className="pl-6"
                        >
                          {category.categoryName}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// 篩選結果統計與快捷按鈕
export interface FilterStatsBarProps {
  filteredCount: number;
  totalMonthlyCount: number;
  isBatchMode: boolean;
  filterStatus: string;
  sortBy: string;
  sortOrder: string;
  onToggleBatchMode: () => void;
  onFilterStatusChange: (value: string) => void;
  onSortByChange: (value: string) => void;
  onSortOrderChange: (value: string) => void;
}

export function FilterStatsBar({
  filteredCount,
  totalMonthlyCount,
  isBatchMode,
  filterStatus,
  sortBy,
  sortOrder,
  onToggleBatchMode,
  onFilterStatusChange,
  onSortByChange,
  onSortOrderChange,
}: FilterStatsBarProps) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-600">
      <div className="flex items-center gap-3">
        <span>
          顯示 {filteredCount} 個項目
          {totalMonthlyCount !== filteredCount &&
            ` (共 ${totalMonthlyCount} 個)`
          }
        </span>
        <Button
          variant={isBatchMode ? "default" : "outline"}
          size="sm"
          onClick={onToggleBatchMode}
          className="h-7 text-xs"
          data-testid="toggle-batch-mode"
        >
          {isBatchMode ? "退出批量模式" : "批量管理"}
        </Button>
      </div>

      {/* 快捷篩選按鈕 */}
      <div className="flex gap-2">
        <Button
          variant={filterStatus === "overdue" ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterStatusChange(filterStatus === "overdue" ? "all" : "overdue")}
          className="h-7 text-xs"
        >
          <AlertTriangle className="w-3 h-3 mr-1" />
          逾期項目
        </Button>
        <Button
          variant={sortBy === "amount" && sortOrder === "desc" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            onSortByChange("amount");
            onSortOrderChange("desc");
          }}
          className="h-7 text-xs"
        >
          <Star className="w-3 h-3 mr-1" />
          高金額優先
        </Button>
        <Button
          variant={sortBy === "startDate" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            onSortByChange("startDate");
            onSortOrderChange("asc");
          }}
          className="h-7 text-xs"
        >
          <Clock className="w-3 h-3 mr-1" />
          按日期排序
        </Button>
      </div>
    </div>
  );
}
