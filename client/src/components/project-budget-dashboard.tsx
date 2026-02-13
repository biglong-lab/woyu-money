// 預算儀表板元件

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, Check } from "lucide-react";
import { formatCurrency } from "./project-budget-utils";


export interface PlanSummary {
  summary: {
    totalBudget: string | number;
    totalPlanned: string | number;
    totalActual: string | number;
    variance: number;
    utilizationRate: string | number;
    conversionRate: string | number;
    convertedCount: number;
    itemCount: number;
    pendingCount: number;
    byPaymentType: {
      single: number;
      installment: number;
      monthly: number;
    };
  };
}

export interface ProjectBudgetDashboardProps {
  planSummary: PlanSummary | null;
}

export default function ProjectBudgetDashboard({
  planSummary,
}: ProjectBudgetDashboardProps) {
  if (!planSummary) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          請先選擇一個預算計劃查看統計
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">預算總額</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(String(planSummary.summary.totalBudget))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">已規劃金額</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(String(planSummary.summary.totalPlanned))}
          </div>
          <p className="text-sm text-gray-500">
            使用率: {String(planSummary.summary.utilizationRate)}%
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">實際支出</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(String(planSummary.summary.totalActual))}
          </div>
          <p
            className={`text-sm ${
              planSummary.summary.variance >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            差異: {planSummary.summary.variance >= 0 ? "+" : ""}
            {formatCurrency(String(planSummary.summary.variance))}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">轉換進度</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {String(planSummary.summary.conversionRate)}%
          </div>
          <p className="text-sm text-gray-500">
            {planSummary.summary.convertedCount} / {planSummary.summary.itemCount} 項目
          </p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">預算使用狀況</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>已規劃</span>
                <span>{String(planSummary.summary.utilizationRate)}%</span>
              </div>
              <Progress
                value={parseFloat(String(planSummary.summary.utilizationRate))}
                className="h-3"
              />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {planSummary.summary.byPaymentType.single}
                </div>
                <div className="text-xs text-gray-500">一般付款</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {planSummary.summary.byPaymentType.installment}
                </div>
                <div className="text-xs text-gray-500">分期付款</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {planSummary.summary.byPaymentType.monthly}
                </div>
                <div className="text-xs text-gray-500">月付款項</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">項目狀態</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
              <div className="text-2xl font-bold text-yellow-600">
                {planSummary.summary.pendingCount}
              </div>
              <div className="text-sm text-yellow-600">待轉換項目</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Check className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-green-600">
                {planSummary.summary.convertedCount}
              </div>
              <div className="text-sm text-green-600">已轉換項目</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
