import { Card, CardContent } from "@/components/ui/card";
import {
  ClockIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from "lucide-react";
import type { MonthlyAnalysis } from "./types";
import { formatAmount } from "./utils";

interface StatisticsCardsProps {
  readonly analysis: MonthlyAnalysis | undefined;
}

// 月度統計卡片組（本月應付、已付、逾期）
export function StatisticsCards({ analysis }: StatisticsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* 本月應付款卡片 */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100/50">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base font-medium text-orange-700 mb-1 sm:mb-2">
                本月應付款
              </p>
              <p className="text-xl sm:text-3xl font-bold text-orange-900 truncate">
                {formatAmount(analysis?.currentMonth.due.totalAmount || 0)}
              </p>
              <p className="text-sm text-orange-600 mt-1">
                {analysis?.currentMonth.due.count || 0} 個項目
              </p>
            </div>
            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-orange-200 rounded-full flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
              <ClockIcon className="h-6 w-6 sm:h-7 sm:w-7 text-orange-700" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 本月已付款卡片 */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base font-medium text-green-700 mb-1 sm:mb-2">
                本月已付款
              </p>
              <p className="text-xl sm:text-3xl font-bold text-green-900 truncate">
                {formatAmount(analysis?.currentMonth.paid.totalAmount || 0)}
              </p>
              <p className="text-sm text-green-600 mt-1">
                {analysis?.currentMonth.paid.count || 0} 個項目
              </p>
            </div>
            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-green-200 rounded-full flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
              <CheckCircleIcon className="h-6 w-6 sm:h-7 sm:w-7 text-green-700" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 逾期未付款卡片 */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100/50 sm:col-span-2 lg:col-span-1">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base font-medium text-red-700 mb-1 sm:mb-2">
                逾期未付款
              </p>
              <p className="text-xl sm:text-3xl font-bold text-red-900 truncate">
                {formatAmount(analysis?.overdue.totalAmount || 0)}
              </p>
              <p className="text-sm text-red-600 mt-1">
                {analysis?.overdue.count || 0} 個項目
              </p>
            </div>
            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-red-200 rounded-full flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
              <AlertTriangleIcon className="h-6 w-6 sm:h-7 sm:w-7 text-red-700" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
