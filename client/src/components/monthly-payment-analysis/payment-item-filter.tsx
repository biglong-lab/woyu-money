import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, SortAsc, SortDesc } from "lucide-react";
import type { SortOrder } from "./types";

interface PaymentItemFilterProps {
  // 搜尋
  readonly searchKeyword: string;
  readonly onSearchChange: (value: string) => void;
  readonly searchPlaceholder?: string;
  // 分類篩選
  readonly selectedCategory: string;
  readonly onCategoryChange: (value: string) => void;
  readonly categories: Array<{ id: number; categoryName: string }>;
  // 專案篩選
  readonly selectedProject: string;
  readonly onProjectChange: (value: string) => void;
  readonly projects: Array<{ id: number; projectName: string }>;
  // 排序
  readonly sortBy: string;
  readonly sortOrder: SortOrder;
  readonly onSortChange: (sortBy: string, sortOrder: SortOrder) => void;
}

// 付款項目搜尋與篩選控制列
export function PaymentItemFilter({
  searchKeyword,
  onSearchChange,
  searchPlaceholder = "搜尋項目名稱、專案或分類...",
  selectedCategory,
  onCategoryChange,
  categories,
  selectedProject,
  onProjectChange,
  projects,
  sortBy,
  sortOrder,
  onSortChange,
}: PaymentItemFilterProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
      {/* 搜尋輸入框 */}
      <div className="relative lg:col-span-2">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder={searchPlaceholder}
          value={searchKeyword}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* 分類篩選 */}
      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger>
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
        <SelectTrigger>
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

      {/* 排序控制 */}
      <Select
        value={`${sortBy}-${sortOrder}`}
        onValueChange={(value) => {
          const [field, order] = value.split("-");
          onSortChange(field, order as SortOrder);
        }}
      >
        <SelectTrigger>
          {sortOrder === "asc" ? (
            <SortAsc className="h-4 w-4 mr-2" />
          ) : (
            <SortDesc className="h-4 w-4 mr-2" />
          )}
          <SelectValue placeholder="排序" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="startDate-desc">到期日 (最新)</SelectItem>
          <SelectItem value="startDate-asc">到期日 (最舊)</SelectItem>
          <SelectItem value="remainingAmount-desc">
            剩餘金額 (高到低)
          </SelectItem>
          <SelectItem value="remainingAmount-asc">
            剩餘金額 (低到高)
          </SelectItem>
          <SelectItem value="itemName-asc">項目名稱 (A-Z)</SelectItem>
          <SelectItem value="itemName-desc">項目名稱 (Z-A)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
