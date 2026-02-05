import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, BarChart3 } from "lucide-react";

// ============================================================
// 分類列表面板 - 顯示左側可選取的分類清單
// ============================================================

interface CategoryListPanelProps {
  /** 分類資料陣列 */
  categories: any[];
  /** 是否載入中 */
  isLoading: boolean;
  /** 目前選取的分類 */
  selectedCategory: any;
  /** 選取分類的回呼 */
  onSelectCategory: (category: any) => void;
  /** 編輯分類的回呼 */
  onEditCategory: (category: any) => void;
  /** 刪除分類的回呼 */
  onDeleteCategory: (id: number) => void;
}

export function CategoryListPanel({
  categories,
  isLoading,
  selectedCategory,
  onSelectCategory,
  onEditCategory,
  onDeleteCategory,
}: CategoryListPanelProps) {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          分類列表
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-4">載入中...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-4 text-gray-500">暫無分類</div>
          ) : (
            categories.map((category: any) => (
              <div
                key={category.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedCategory?.id === category.id
                    ? "bg-blue-50 border-blue-200"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => onSelectCategory(category)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{category.categoryName}</h3>
                    <p className="text-sm text-gray-500">
                      {category.categoryType}
                    </p>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCategory(category);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("確定要刪除此分類嗎？")) {
                          onDeleteCategory(category.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
