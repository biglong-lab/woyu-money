import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

// ============================================================
// 分析報告分頁 - 開發中佔位元件
// ============================================================

export function AnalyticsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          分析報告
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-gray-500">
          分析報告功能開發中...
        </div>
      </CardContent>
    </Card>
  );
}
