import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

// ============================================================
// 空狀態提示 - 未選取分類時顯示的佔位畫面
// ============================================================

export function EmptyState() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center h-96">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">選擇分類</h3>
          <p className="text-gray-500">
            請從左側選擇一個分類來查看詳細資訊
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
