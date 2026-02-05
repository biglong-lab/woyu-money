// 分期付款統計面板元件

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Calendar, TrendingUp, Calculator } from "lucide-react";
import type { InstallmentStats } from "./installment-types";

export interface InstallmentStatsPanelProps {
  stats: InstallmentStats;
}

export default function InstallmentStatsPanel({ stats }: InstallmentStatsPanelProps) {
  return (
    <>
      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">分期項目總數</p>
                <p className="text-2xl font-bold text-purple-900">{stats.total}</p>
              </div>
              <CreditCard className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">即將到期</p>
                <p className="text-2xl font-bold text-amber-900">{stats.dueSoon}</p>
                <p className="text-xs text-amber-600">7天內到期</p>
              </div>
              <Calendar className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">逾期項目</p>
                <p className="text-2xl font-bold text-red-900">{stats.overdue}</p>
                <p className="text-xs text-red-600">需要處理</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">平均完成率</p>
                <p className="text-2xl font-bold text-green-900">{stats.averageProgress}%</p>
                <p className="text-xs text-green-600">整體進度</p>
              </div>
              <Calculator className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 財務概況 */}
      <Card className="mb-6 border-2 border-purple-200 bg-gradient-to-r from-purple-50 via-white to-purple-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-purple-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            分期付款財務概況
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg border">
              <p className="text-sm text-blue-600 font-medium">總分期金額</p>
              <p className="text-xl font-bold text-blue-800">
                NT$ {stats.totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border">
              <p className="text-sm text-green-600 font-medium">已付金額</p>
              <p className="text-xl font-bold text-green-800">
                NT$ {stats.paidAmount.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg border">
              <p className="text-sm text-orange-600 font-medium">剩餘金額</p>
              <p className="text-xl font-bold text-orange-800">
                NT$ {stats.remainingAmount.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-purple-600 font-medium">整體完成進度</span>
              <span className="text-purple-800 font-semibold">{stats.averageProgress}%</span>
            </div>
            <Progress value={stats.averageProgress} className="h-3 bg-purple-100" />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
