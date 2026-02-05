import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { KeyMetrics } from "./types";

// ========================================
// 關鍵指標卡片元件
// ========================================

interface KeyMetricsCardsProps {
  /** 關鍵指標資料 */
  metrics: KeyMetrics;
}

/** 顯示四張關鍵指標卡片：總計劃金額、已付金額、待付金額、逾期項目 */
export function KeyMetricsCards({ metrics }: KeyMetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 總計劃金額 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">總計劃金額</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            NT$ {metrics.totalPlanned.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            共 {metrics.totalItems} 項目
          </p>
        </CardContent>
      </Card>

      {/* 已付金額 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">已付金額</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            NT$ {metrics.totalPaid.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            完成率 {metrics.completionRate.toFixed(1)}%
          </p>
        </CardContent>
      </Card>

      {/* 待付金額 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">待付金額</CardTitle>
          <Clock className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            NT$ {metrics.totalPending.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.pendingItems} 項待付款
          </p>
        </CardContent>
      </Card>

      {/* 逾期項目 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">逾期項目</CardTitle>
          <AlertCircle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {metrics.overdueItems}
          </div>
          <p className="text-xs text-muted-foreground">
            需要立即處理
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
