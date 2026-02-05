import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatsSkeleton } from "@/components/table-skeleton";
import { LoanAnalyticsCharts } from "@/components/responsive-chart";
import {
  DollarSign,
  Calendar,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import type { LoanInvestmentRecord, LoanStats } from "./loan-enhanced-types";
import { formatCurrency } from "./loan-enhanced-types";

// ==========================================
// 借貸投資管理 - 統計面板
// ==========================================

export interface LoanEnhancedStatsPanelProps {
  stats: LoanStats;
  records: LoanInvestmentRecord[];
  statsLoading: boolean;
  recordsLoading: boolean;
}

export function LoanEnhancedStatsPanel({
  stats,
  records,
  statsLoading,
  recordsLoading,
}: LoanEnhancedStatsPanelProps) {
  const hasData = !statsLoading && !recordsLoading && records.length > 0;

  if (hasData) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 左側：風險分析圓餅圖 */}
        <div>
          <LoanAnalyticsCharts records={records} />
        </div>

        {/* 右側：統計卡片直列排列 */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總金額</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.totalLoanAmount || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                借貸: {formatCurrency(stats.activeLoanAmount || 0)} |
                投資: {formatCurrency(stats.activeInvestmentAmount || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均利率</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {records.length > 0
                  ? (
                      records.reduce(
                        (sum, r) => sum + parseFloat(r.annualInterestRate || "0"),
                        0
                      ) / records.length
                    ).toFixed(1)
                  : "0.0"}
                %
              </div>
              <p className="text-xs text-muted-foreground">
                活躍項目平均年利率
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">高風險項目</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.highRiskCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                利息15%以上需優先處理
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活躍項目</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {records.filter((r) => r.status === "active").length}
              </div>
              <p className="text-xs text-muted-foreground">
                進行中的借貸投資項目
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 備用統計區（當沒有數據或載入中時）
  if (statsLoading) {
    return <StatsSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">總金額</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">無數據</div>
          <p className="text-xs text-muted-foreground">
            尚未建立借貸投資記錄
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
