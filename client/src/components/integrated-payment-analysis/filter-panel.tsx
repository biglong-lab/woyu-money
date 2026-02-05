import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Filter } from "lucide-react";
import type { PaymentProject } from "./types";

// ========================================
// 篩選面板元件
// ========================================

interface FilterPanelProps {
  /** 搜尋關鍵字 */
  searchTerm: string;
  /** 搜尋關鍵字變更處理 */
  onSearchTermChange: (value: string) => void;
  /** 選中的專案 ID */
  selectedProject: string;
  /** 專案選擇變更處理 */
  onSelectedProjectChange: (value: string) => void;
  /** 選中的狀態 */
  selectedStatus: string;
  /** 狀態選擇變更處理 */
  onSelectedStatusChange: (value: string) => void;
  /** 日期範圍 */
  dateRange: string;
  /** 日期範圍變更處理 */
  onDateRangeChange: (value: string) => void;
  /** 是否顯示已刪除項目 */
  showDeletedItems: boolean;
  /** 已刪除項目切換處理 */
  onShowDeletedItemsChange: (value: boolean) => void;
  /** 已選擇的項目數量 */
  selectedItemsCount: number;
  /** 是否顯示批量操作 */
  showBatchActions: boolean;
  /** 批量操作切換處理 */
  onShowBatchActionsToggle: () => void;
  /** 專案列表 */
  projects: PaymentProject[];
}

/** 篩選和搜尋面板，包含關鍵字搜尋、專案篩選、狀態篩選、日期範圍 */
export function FilterPanel({
  searchTerm,
  onSearchTermChange,
  selectedProject,
  onSelectedProjectChange,
  selectedStatus,
  onSelectedStatusChange,
  dateRange,
  onDateRangeChange,
  showDeletedItems,
  onShowDeletedItemsChange,
  selectedItemsCount,
  showBatchActions,
  onShowBatchActionsToggle,
  projects,
}: FilterPanelProps) {
  /** 是否有篩選條件套用中 */
  const hasActiveFilters =
    searchTerm !== "" ||
    selectedProject !== "all" ||
    selectedStatus !== "all";

  /** 清除所有篩選條件 */
  const handleClearFilters = () => {
    onSearchTermChange("");
    onSelectedProjectChange("all");
    onSelectedStatusChange("all");
    onDateRangeChange("current_month");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          篩選和搜尋
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 搜尋關鍵字 */}
          <div className="space-y-2">
            <Label htmlFor="search">搜尋關鍵字</Label>
            <Input
              id="search"
              placeholder="項目名稱、專案、分類..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="w-full"
            />
          </div>

          {/* 專案篩選 */}
          <div className="space-y-2">
            <Label htmlFor="project">專案篩選</Label>
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
          </div>

          {/* 狀態篩選 */}
          <div className="space-y-2">
            <Label htmlFor="status">狀態篩選</Label>
            <Select value={selectedStatus} onValueChange={onSelectedStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="選擇狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有狀態</SelectItem>
                <SelectItem value="pending">待付款</SelectItem>
                <SelectItem value="partial">部分付款</SelectItem>
                <SelectItem value="paid">已付款</SelectItem>
                <SelectItem value="overdue">逾期</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 日期範圍 */}
          <div className="space-y-2">
            <Label htmlFor="range">日期範圍</Label>
            <Select value={dateRange} onValueChange={onDateRangeChange}>
              <SelectTrigger>
                <SelectValue placeholder="選擇範圍" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">本月</SelectItem>
                <SelectItem value="last_month">上月</SelectItem>
                <SelectItem value="quarter">本季</SelectItem>
                <SelectItem value="year">本年</SelectItem>
                <SelectItem value="all">全部</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 底部操作列 */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showDeleted"
                checked={showDeletedItems}
                onCheckedChange={(checked) => onShowDeletedItemsChange(!!checked)}
              />
              <Label htmlFor="showDeleted" className="text-sm">顯示已刪除項目</Label>
            </div>

            {selectedItemsCount > 0 && (
              <Badge variant="secondary">
                已選擇 {selectedItemsCount} 項
              </Badge>
            )}
          </div>

          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
              >
                清除篩選
              </Button>
            )}

            {selectedItemsCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onShowBatchActionsToggle}
              >
                批量操作
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
