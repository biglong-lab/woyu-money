// 分期付款篩選與排序控制列

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface InstallmentFilterBarProps {
  // 搜尋
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  // 狀態篩選
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  // 專案篩選
  projectFilter: string;
  onProjectFilterChange: (value: string) => void;
  projects: Array<{ id: number; projectName: string }>;
  // 分類篩選
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categories: Array<{ id: number; categoryName: string }>;
  // 排序
  sortBy: string;
  onSortByChange: (value: string) => void;
  sortOrder: "asc" | "desc";
  onSortOrderToggle: () => void;
  // 結果數量
  resultCount: number;
}

export default function InstallmentFilterBar({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  projectFilter,
  onProjectFilterChange,
  projects,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderToggle,
  resultCount,
}: InstallmentFilterBarProps) {
  return (
    <>
      {/* 快速篩選按鈕 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => onStatusFilterChange("all")}
          className="bg-purple-600 hover:bg-purple-700"
        >
          全部項目
        </Button>
        <Button
          variant={statusFilter === "due-soon" ? "default" : "outline"}
          size="sm"
          onClick={() => onStatusFilterChange("due-soon")}
          className="border-amber-500 text-amber-700 hover:bg-amber-50"
        >
          即將到期
        </Button>
        <Button
          variant={statusFilter === "overdue" ? "default" : "outline"}
          size="sm"
          onClick={() => onStatusFilterChange("overdue")}
          className="border-red-500 text-red-700 hover:bg-red-50"
        >
          逾期項目
        </Button>
        <Button
          variant={statusFilter === "unpaid" ? "default" : "outline"}
          size="sm"
          onClick={() => onStatusFilterChange("unpaid")}
          className="border-orange-500 text-orange-700 hover:bg-orange-50"
        >
          未付清
        </Button>
        <Button
          variant={statusFilter === "paid" ? "default" : "outline"}
          size="sm"
          onClick={() => onStatusFilterChange("paid")}
          className="border-green-500 text-green-700 hover:bg-green-50"
        >
          已完成
        </Button>
      </div>

      {/* 排序控制 */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">排序方式:</label>
            <Select value={sortBy} onValueChange={onSortByChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dueDate">到期日期</SelectItem>
                <SelectItem value="progress">完成進度</SelectItem>
                <SelectItem value="amount">金額大小</SelectItem>
                <SelectItem value="installmentNumber">期數順序</SelectItem>
                <SelectItem value="name">項目名稱</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">順序:</label>
            <Button variant="outline" size="sm" onClick={onSortOrderToggle}>
              {sortOrder === "asc" ? "升序 ↑" : "降序 ↓"}
            </Button>
          </div>
        </div>
      </Card>

      {/* 搜尋與篩選欄 */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 搜尋輸入 */}
          <div className="lg:col-span-2">
            <Input
              placeholder="搜尋項目名稱或備註..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="w-full"
            />
          </div>

          {/* 狀態篩選 */}
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="付款狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="paid">已付清</SelectItem>
              <SelectItem value="unpaid">未付清</SelectItem>
            </SelectContent>
          </Select>

          {/* 專案篩選 */}
          <Select value={projectFilter} onValueChange={onProjectFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="專案篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部專案</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 分類篩選 */}
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="分類篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分類</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.categoryName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 篩選摘要 */}
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <span>顯示 {resultCount} 個項目</span>
          {searchTerm && <Badge variant="outline">搜尋: {searchTerm}</Badge>}
          {statusFilter !== "all" && (
            <Badge variant="outline">
              狀態: {statusFilter === "paid" ? "已付清" : "未付清"}
            </Badge>
          )}
          {projectFilter !== "all" && (
            <Badge variant="outline">
              專案: {projects.find((p) => p.id.toString() === projectFilter)?.projectName}
            </Badge>
          )}
          {categoryFilter !== "all" && (
            <Badge variant="outline">
              分類: {categories.find((c) => c.id.toString() === categoryFilter)?.categoryName}
            </Badge>
          )}
        </div>
      </Card>
    </>
  );
}
