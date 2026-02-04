import { useState, useEffect } from "react";
import { Search, Filter, X, Calendar, DollarSign, Tag, Building2, SortAsc, SortDesc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface EnhancedSearchFilterProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterStatus: string | null;
  setFilterStatus: (status: string | null) => void;
  filterCategory: number | null;
  setFilterCategory: (categoryId: number | null) => void;
  selectedProjects: number[];
  setSelectedProjects: (projectIds: number[]) => void;
  amountRange: { min: string; max: string };
  setAmountRange: (range: { min: string; max: string }) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  categories: Array<{ id: number; categoryName: string }>;
  projects: Array<{ id: number; projectName: string }>;
  onClearAll: () => void;
}

export function EnhancedSearchFilter({
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  filterCategory,
  setFilterCategory,
  selectedProjects,
  setSelectedProjects,
  amountRange,
  setAmountRange,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  categories,
  projects,
  onClearAll
}: EnhancedSearchFilterProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // 從 localStorage 載入搜索歷史
  useEffect(() => {
    const saved = localStorage.getItem('payment-search-history');
    if (saved) {
      setSearchHistory(JSON.parse(saved));
    }
  }, []);

  // 保存搜索歷史
  const saveSearchHistory = (term: string) => {
    if (term.trim() && !searchHistory.includes(term)) {
      const newHistory = [term, ...searchHistory.slice(0, 4)]; // 保留最近5個搜索
      setSearchHistory(newHistory);
      localStorage.setItem('payment-search-history', JSON.stringify(newHistory));
    }
  };

  // 處理搜索輸入
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (value.trim()) {
      saveSearchHistory(value);
    }
  };

  // 獲取活動篩選器數量
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filterStatus) count++;
    if (filterCategory) count++;
    if (selectedProjects.length > 0) count++;
    if (amountRange.min || amountRange.max) count++;
    if (startDate || endDate) count++;
    return count;
  };

  // 快速篩選預設
  const quickFilters = [
    { label: "待處理", action: () => setFilterStatus("pending") },
    { label: "已完成", action: () => setFilterStatus("completed") },
    { label: "本月", action: () => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    }},
    { label: "高額項目", action: () => setAmountRange({ min: "50000", max: "" }) }
  ];

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className="space-y-4">
      {/* 搜索欄和主要控制 */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* 搜索輸入框 */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="搜索項目名稱、專案或備註..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          
          {/* 搜索建議 */}
          {searchTerm.length > 0 && searchHistory.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-40 overflow-auto">
              {searchHistory
                .filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()))
                .slice(0, 3)
                .map((item, index) => (
                  <button
                    key={index}
                    onClick={() => setSearchTerm(item)}
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                  >
                    {item}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* 排序控制 */}
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="startDate">日期</SelectItem>
              <SelectItem value="totalAmount">金額</SelectItem>
              <SelectItem value="itemName">名稱</SelectItem>
              <SelectItem value="status">狀態</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3"
          >
            {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </Button>
        </div>

        {/* 篩選按鈕 */}
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              篩選
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <Card className="border-0 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  進階篩選
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={onClearAll} className="h-6 text-xs">
                      清除全部
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 快速篩選 */}
                <div>
                  <Label className="text-xs text-muted-foreground">快速篩選</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {quickFilters.map((filter, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={filter.action}
                        className="text-xs h-7"
                      >
                        {filter.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* 狀態篩選 */}
                <div>
                  <Label className="text-xs text-muted-foreground">狀態</Label>
                  <Select value={filterStatus || ""} onValueChange={(value) => setFilterStatus(value || null)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="選擇狀態" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部狀態</SelectItem>
                      <SelectItem value="pending">待處理</SelectItem>
                      <SelectItem value="processing">處理中</SelectItem>
                      <SelectItem value="completed">已完成</SelectItem>
                      <SelectItem value="overdue">逾期</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 分類篩選 */}
                <div>
                  <Label className="text-xs text-muted-foreground">分類</Label>
                  <Select value={filterCategory?.toString() || ""} onValueChange={(value) => setFilterCategory(value ? parseInt(value) : null)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="選擇分類" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部分類</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.categoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 金額範圍 */}
                <div>
                  <Label className="text-xs text-muted-foreground">金額範圍</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      type="number"
                      placeholder="最小金額"
                      value={amountRange.min}
                      onChange={(e) => setAmountRange({ ...amountRange, min: e.target.value })}
                      className="text-sm"
                    />
                    <Input
                      type="number"
                      placeholder="最大金額"
                      value={amountRange.max}
                      onChange={(e) => setAmountRange({ ...amountRange, max: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* 日期範圍 */}
                <div>
                  <Label className="text-xs text-muted-foreground">日期範圍</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </PopoverContent>
        </Popover>
      </div>

      {/* 活動篩選器顯示 */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">已套用篩選:</span>
          {filterStatus && (
            <Badge variant="secondary" className="gap-1">
              狀態: {filterStatus}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setFilterStatus(null)}
              />
            </Badge>
          )}
          {filterCategory && (
            <Badge variant="secondary" className="gap-1">
              分類: {categories.find(cat => cat.id === filterCategory)?.categoryName}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setFilterCategory(null)}
              />
            </Badge>
          )}
          {selectedProjects.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              專案: {selectedProjects.length}個
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setSelectedProjects([])}
              />
            </Badge>
          )}
          {(amountRange.min || amountRange.max) && (
            <Badge variant="secondary" className="gap-1">
              金額: {amountRange.min || '0'} - {amountRange.max || '無限'}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setAmountRange({ min: "", max: "" })}
              />
            </Badge>
          )}
          {(startDate || endDate) && (
            <Badge variant="secondary" className="gap-1">
              日期範圍
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => { setStartDate(""); setEndDate(""); }}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}