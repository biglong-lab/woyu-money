import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, AlertCircle } from "lucide-react";
import type { LoanInvestmentStats } from "./types";

/**
 * 借貸投資管理 -- 統計卡片區塊
 * 包含「投資組合概況」與「風險評估」兩張卡片
 */

interface StatCardsProps {
  stats: LoanInvestmentStats;
}

export default function StatCards({ stats }: StatCardsProps) {
  // 計算平均收益率，避免除以零
  const avgReturnRate =
    ((stats.expectedReturn || 0) / Math.max(stats.totalPrincipal || 1, 1)) * 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 投資組合概況 */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            投資組合概況
          </CardTitle>
          <CardDescription>資金配置與收益分析</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                ${stats.totalPrincipal?.toLocaleString() || "0"}
              </div>
              <div className="text-sm text-muted-foreground">總投入本金</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ${stats.expectedReturn?.toLocaleString() || "0"}
              </div>
              <div className="text-sm text-muted-foreground">預期年收益</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {avgReturnRate.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">平均收益率</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {stats.totalParties || 0}
              </div>
              <div className="text-sm text-muted-foreground">合作對象</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 風險評估 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            風險評估
          </CardTitle>
          <CardDescription>投資組合風險分析</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">低風險</span>
              <Badge variant="secondary">{stats.lowRiskCount || 0} 項</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">中風險</span>
              <Badge variant="default">{stats.mediumRiskCount || 0} 項</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">高風險</span>
              <Badge variant="destructive">{stats.highRiskCount || 0} 項</Badge>
            </div>

            {(stats.highRiskCount ?? 0) > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">風險提醒</span>
                </div>
                <p className="text-sm text-red-700 mt-1">
                  您有 {stats.highRiskCount} 項高風險投資需要關注
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
