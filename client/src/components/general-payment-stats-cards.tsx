// 一般付款管理 - 統計卡片元件
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, DollarSign, AlertCircle, FileText } from "lucide-react";
import type { GeneralPaymentStatistics } from "./general-payment-types";

// 月度統計卡片 Props
export interface MonthlyStatsCardsProps {
  statistics: GeneralPaymentStatistics;
}

// 月度統計卡片（本月應付/已付/未付/逾期）
export function MonthlyStatsCards({ statistics }: MonthlyStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4 mb-6">
      <Card className="p-4 border border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-0">
          <CardTitle className="text-sm font-medium text-gray-700 tracking-wide">本月應付</CardTitle>
          <Calendar className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent className="px-0">
          <div className="text-xl font-bold text-blue-700 leading-none">NT$ {statistics.monthlyDue.toLocaleString()}</div>
        </CardContent>
      </Card>
      <Card className="p-4 border border-green-100 shadow-sm bg-green-50/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-0">
          <CardTitle className="text-sm font-medium text-gray-700 tracking-wide">本月已付</CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent className="px-0">
          <div className="text-xl font-bold text-green-700 leading-none">NT$ {statistics.monthlyPaid.toLocaleString()}</div>
        </CardContent>
      </Card>
      <Card className="p-4 border border-orange-100 shadow-sm bg-orange-50/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-0">
          <CardTitle className="text-sm font-medium text-gray-700 tracking-wide">本月未付</CardTitle>
          <Clock className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent className="px-0">
          <div className="text-xl font-bold text-orange-700 leading-none">NT$ {statistics.monthlyUnpaid.toLocaleString()}</div>
        </CardContent>
      </Card>
      <Card className="p-4 border border-red-100 shadow-sm bg-red-50/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-0">
          <CardTitle className="text-sm font-medium text-gray-700 tracking-wide">應付未付（本月之前）</CardTitle>
          <AlertCircle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent className="px-0">
          <div className="text-xl font-bold text-red-700 leading-none">NT$ {statistics.overdueUnpaid.toLocaleString()}</div>
        </CardContent>
      </Card>
    </div>
  );
}

// 總覽統計卡片 Props
export interface OverviewStatsCardsProps {
  statistics: GeneralPaymentStatistics;
}

// 總覽統計卡片（總項目數/總金額/已付/待付）
export function OverviewStatsCards({ statistics }: OverviewStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">總項目數</p>
              <p className="text-2xl font-bold text-blue-600">{statistics.totalItems}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">總金額</p>
              <p className="text-2xl font-bold text-green-600">
                ${statistics.totalAmount.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">已付金額</p>
              <p className="text-2xl font-bold text-green-600">
                ${statistics.paidAmount.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">待付金額</p>
              <p className="text-2xl font-bold text-orange-600">
                ${(statistics.totalAmount - statistics.paidAmount).toLocaleString()}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
