import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangleIcon, Search, Filter, ArrowUpDown } from "lucide-react";
import type { PaymentItem, SortOrder } from "./types";
import { PaymentItemRow } from "./payment-item-row";
import { PaginationControls } from "./pagination-controls";

interface OverduePaymentListProps {
  // 逾期項目資料
  readonly overdueCount: number;
  readonly paginatedItems: PaymentItem[];
  readonly totalFilteredItems: number;
  // 篩選狀態
  readonly searchKeyword: string;
  readonly onSearchChange: (value: string) => void;
  readonly selectedCategory: string;
  readonly onCategoryChange: (value: string) => void;
  readonly selectedProject: string;
  readonly onProjectChange: (value: string) => void;
  readonly sortBy: string;
  readonly sortOrder: SortOrder;
  readonly onSortChange: (sortBy: string, sortOrder: SortOrder) => void;
  // 分頁
  readonly currentPage: number;
  readonly totalPages: number;
  readonly itemsPerPage: number;
  readonly onPageChange: (page: number) => void;
  // 分類和專案選項
  readonly categories: Array<{ id: number; categoryName: string }>;
  readonly projects: Array<{ id: number; projectName: string }>;
  // 付款動作
  readonly onPayClick: (item: PaymentItem) => void;
}

// 逾期付款清單區塊（含標題、篩選、列表、分頁）
export function OverduePaymentList({
  overdueCount,
  paginatedItems,
  totalFilteredItems,
  searchKeyword,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedProject,
  onProjectChange,
  sortBy,
  sortOrder,
  onSortChange,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  categories,
  projects,
  onPayClick,
}: OverduePaymentListProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* 逾期區塊標題和篩選 */}
      <div className="px-6 py-4 bg-red-50 border-b border-red-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangleIcon className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-red-900">
                逾期未付款項目
              </h3>
              <p className="text-sm sm:text-base text-red-700">
                {overdueCount} 個項目已逾期
              </p>
            </div>
          </div>
        </div>

        {/* 搜尋和篩選 */}
        <div className="mt-4 space-y-4">
          {/* 搜尋列 */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜尋逾期項目名稱、專案或分類..."
              value={searchKeyword}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 h-10 bg-white border-gray-300 focus:border-red-500 focus:ring-red-500"
            />
          </div>

          {/* 篩選列 */}
          <div className="flex flex-wrap gap-3">
            {/* 分類篩選 */}
            <Select value={selectedCategory} onValueChange={onCategoryChange}>
              <SelectTrigger className="w-auto min-w-[140px] h-9 bg-white border-gray-300">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="選擇分類" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有分類</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.categoryName}>
                    {cat.categoryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 專案篩選 */}
            <Select value={selectedProject} onValueChange={onProjectChange}>
              <SelectTrigger className="w-auto min-w-[140px] h-9 bg-white border-gray-300">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="選擇專案" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有專案</SelectItem>
                {projects.map((proj) => (
                  <SelectItem key={proj.id} value={proj.projectName}>
                    {proj.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 排序 */}
            <Select
              value={`${sortBy}-${sortOrder}`}
              onValueChange={(value) => {
                const [newSortBy, newSortOrder] = value.split("-");
                onSortChange(newSortBy, newSortOrder as SortOrder);
              }}
            >
              <SelectTrigger className="w-auto min-w-[140px] h-9 bg-white border-gray-300">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="startDate-desc">到期日 (新到舊)</SelectItem>
                <SelectItem value="startDate-asc">到期日 (舊到新)</SelectItem>
                <SelectItem value="remainingAmount-desc">
                  金額 (高到低)
                </SelectItem>
                <SelectItem value="remainingAmount-asc">
                  金額 (低到高)
                </SelectItem>
                <SelectItem value="itemName-asc">名稱 (A-Z)</SelectItem>
                <SelectItem value="itemName-desc">名稱 (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 逾期項目列表 */}
      <div className="divide-y divide-gray-100">
        {paginatedItems.map((item) => (
          <PaymentItemRow
            key={item.id}
            item={item}
            onPayClick={onPayClick}
            isOverdue
          />
        ))}
      </div>

      {/* 分頁 */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalFilteredItems}
        itemsPerPage={itemsPerPage}
        onPageChange={onPageChange}
        variant="danger"
      />
    </div>
  );
}
