/**
 * 預算概覽面板
 * 顯示月度預算摘要、進度條和警示訊息
 */

import { TrendingUp, AlertCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface BudgetOverviewPanelProps {
  /** 當前選擇的日期 */
  currentDate: Date;
  /** 月度預算（等於當月排程金額） */
  monthlyBudget: number;
  /** 已排程金額 */
  scheduledAmount: number;
  /** 排程筆數 */
  totalScheduled: number;
  /** 當月實際已付金額 */
  currentMonthPaid: number;
  /** 可用額度 */
  availableBudget: number;
  /** 預算使用率百分比 */
  budgetUsageRate: number;
  /** 排程執行率百分比 */
  scheduleExecutionRate: number;
  /** 逾期項目數 */
  overdueCount: number;
}

export function BudgetOverviewPanel({
  currentDate,
  monthlyBudget,
  scheduledAmount,
  totalScheduled,
  currentMonthPaid,
  availableBudget,
  budgetUsageRate,
  scheduleExecutionRate,
  overdueCount,
}: BudgetOverviewPanelProps) {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200" data-testid="card-budget-overview">
      <CardHeader className="pb-2 sm:pb-4">
        <CardTitle className="flex items-center text-base sm:text-lg">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600" />
          <span className="truncate">{format(currentDate, 'yyyy年MM月')} 預算概覽</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 響應式網格：手機 2x3，平板 3x2，桌面 5x1 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
          <div className="text-center p-2 sm:p-0">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">月度預算</div>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">${monthlyBudget.toLocaleString()}</div>
          </div>
          <div className="text-center p-2 sm:p-0">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">已排程金額</div>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">${scheduledAmount.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">{totalScheduled} 筆排程</div>
          </div>
          <div className="text-center p-2 sm:p-0">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">已執行付款</div>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">${currentMonthPaid.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">實際已付款</div>
          </div>
          <div className="text-center p-2 sm:p-0">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">可用額度</div>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600">${availableBudget.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">剩餘可規劃</div>
          </div>
          <div className="text-center p-2 sm:p-0 col-span-2 sm:col-span-3 lg:col-span-1">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">計劃執行率</div>
            <div className={`text-lg sm:text-xl lg:text-2xl font-bold ${scheduleExecutionRate >= 80 ? 'text-green-600' : scheduleExecutionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {scheduleExecutionRate.toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">已付/已排程</div>
          </div>
        </div>

        {/* 進度條 */}
        <div className="mt-4 space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">預算使用進度</span>
              <span className="font-medium">{budgetUsageRate.toFixed(1)}%</span>
            </div>
            <Progress value={budgetUsageRate} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">排程執行進度</span>
              <span className="font-medium">{scheduleExecutionRate.toFixed(1)}%</span>
            </div>
            <Progress value={scheduleExecutionRate} className="h-2" />
          </div>
        </div>

        {/* 警示訊息 */}
        <div className="mt-4 flex items-start gap-3 text-sm">
          {scheduleExecutionRate < 50 && scheduledAmount > 0 && (
            <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center text-yellow-800">
                <AlertCircle className="h-4 w-4 mr-2" />
                <span className="font-medium">執行率偏低</span>
              </div>
              <div className="text-yellow-700 mt-1">
                本月已排程 ${scheduledAmount.toLocaleString()}，但僅執行 ${currentMonthPaid.toLocaleString()}，請加快付款進度
              </div>
            </div>
          )}
          {overdueCount > 0 && (
            <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center text-red-800">
                <XCircle className="h-4 w-4 mr-2" />
                <span className="font-medium">逾期提醒</span>
              </div>
              <div className="text-red-700 mt-1">
                有 {overdueCount} 個項目逾期未執行，請盡快處理
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
