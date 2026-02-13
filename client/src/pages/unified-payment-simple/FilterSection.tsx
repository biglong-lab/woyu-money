/**
 * 統一付款管理 - 篩選器區域
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Target, Search, X } from "lucide-react";
import type { PaymentProject, DebtCategory } from "./types";

interface FilterSectionProps {
  /** 所有專案列表 */
  projects: PaymentProject[];
  /** 所有分類列表 */
  categories: DebtCategory[];
  /** 選中的專案 ID */
  selectedProject: number | null;
  /** 選中的分類 ID */
  selectedCategory: number | null;
  /** 搜尋關鍵字 */
  searchTerm: string;
  /** 專案變更回呼 */
  onProjectChange: (id: number | null) => void;
  /** 分類變更回呼 */
  onCategoryChange: (id: number | null) => void;
  /** 搜尋變更回呼 */
  onSearchChange: (term: string) => void;
}

/** 篩選器區域元件 */
export function FilterSection({
  projects,
  categories,
  selectedProject,
  selectedCategory,
  searchTerm,
  onProjectChange,
  onCategoryChange,
  onSearchChange,
}: FilterSectionProps) {
  return (
    <Card className="mb-6 border border-gray-200 shadow-sm">
      <CardHeader className="pb-5">
        <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 tracking-tight">
          <Target className="w-5 h-5 text-blue-600" />
          選擇付款範圍
        </CardTitle>
        <CardDescription className="text-sm text-gray-600 mt-1">
          選擇專案、分類或兩者組合來定義付款範圍
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* 專案選擇 */}
          <div className="space-y-2">
            <Label>專案</Label>
            <Select
              value={selectedProject?.toString() || "none"}
              onValueChange={(value) =>
                onProjectChange(value === "none" ? null : parseInt(value))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇專案（可選）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">所有專案</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 分類選擇 */}
          <div className="space-y-2">
            <Label>分類</Label>
            <Select
              value={selectedCategory?.toString() || "none"}
              onValueChange={(value) =>
                onCategoryChange(value === "none" ? null : parseInt(value))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇分類（可選）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">所有分類</SelectItem>
                {categories.map((category) => (
                  <SelectItem
                    key={category.id}
                    value={category.id.toString()}
                  >
                    {category.categoryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 搜尋 */}
          <div className="space-y-2">
            <Label>搜尋項目</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜尋項目名稱或備註..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-8 w-8 p-0"
                  onClick={() => onSearchChange("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
