import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, Target, DollarSign, TrendingUp } from "lucide-react";
import {
  formatCurrency,
  calcBudgetProgress,
  type CategoryStats,
} from "./types";
interface SelectedCategory {
  categoryName: string;
  categoryType: string;
  description?: string | null;
}


// ============================================================
// 概覽分頁 - 分類基本資訊、本月統計卡片、預算進度條
// ============================================================

interface CategoryOverviewTabProps {
  /** 目前選取的分類 */
  selectedCategory: SelectedCategory;
  /** 分類統計資料 */
  categoryStats: CategoryStats | undefined;
}

export function CategoryOverviewTab({
  selectedCategory,
  categoryStats,
}: CategoryOverviewTabProps) {
  const budgetProgress = calcBudgetProgress(categoryStats);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Eye className="h-5 w-5 mr-2" />
          {selectedCategory.categoryName} - 概覽
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 分類基本資訊 */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">分類資訊</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">分類名稱</p>
              <p className="font-medium">{selectedCategory.categoryName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">分類類型</p>
              <Badge variant="outline">
                {selectedCategory.categoryType}
              </Badge>
            </div>
          </div>
          {selectedCategory.description && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">描述</p>
              <p className="text-sm">{selectedCategory.description}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* 本月統計卡片 */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-4">本月統計</h3>
          <div className="grid grid-cols-3 gap-4">
            {/* 預算金額 */}
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Target className="h-6 w-6 mx-auto text-blue-600 mb-2" />
              <p className="text-sm text-gray-600">預算金額</p>
              <p className="text-xl font-bold text-blue-600">
                NT$ {formatCurrency(categoryStats?.currentBudget || "0")}
              </p>
            </div>

            {/* 總支出 */}
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <DollarSign className="h-6 w-6 mx-auto text-green-600 mb-2" />
              <p className="text-sm text-gray-600">總支出</p>
              <p className="text-xl font-bold text-green-600">
                NT$ {formatCurrency(categoryStats?.totalExpenses || "0")}
              </p>
            </div>

            {/* 剩餘預算 */}
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <TrendingUp className="h-6 w-6 mx-auto text-orange-600 mb-2" />
              <p className="text-sm text-gray-600">剩餘預算</p>
              <p className="text-xl font-bold text-orange-600">
                NT${" "}
                {formatCurrency(
                  (
                    parseFloat(categoryStats?.currentBudget || "0") -
                    parseFloat(categoryStats?.totalExpenses || "0")
                  ).toString()
                )}
              </p>
            </div>
          </div>

          {/* 預算進度條 */}
          {categoryStats?.currentBudget && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>預算使用率</span>
                <span>{budgetProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    budgetProgress > 100
                      ? "bg-red-500"
                      : budgetProgress > 80
                        ? "bg-orange-500"
                        : "bg-green-500"
                  }`}
                  style={{
                    width: `${Math.min(budgetProgress, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
