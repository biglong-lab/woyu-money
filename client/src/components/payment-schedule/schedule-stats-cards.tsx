/**
 * 排程統計卡片
 * 顯示本月排程、總待付金額、未排程項目、逾期未執行的統計摘要
 */

import { Calendar, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScheduleStats } from './types';

interface ScheduleStatsCardsProps {
  /** 統計數據 */
  stats: ScheduleStats;
  /** 未排程項目數量 */
  unscheduledCount: number;
}

export function ScheduleStatsCards({ stats, unscheduledCount }: ScheduleStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <Card data-testid="card-scheduled">
        <CardHeader className="pb-1 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 flex items-center">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            本月排程
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.totalScheduled}</div>
          <div className="text-xs text-gray-500">${stats.scheduledAmount.toLocaleString()}</div>
        </CardContent>
      </Card>

      <Card data-testid="card-pending">
        <CardHeader className="pb-1 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 flex items-center">
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            總待付金額
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-xl sm:text-2xl font-bold text-orange-600">${stats.totalPending.toLocaleString()}</div>
        </CardContent>
      </Card>

      <Card data-testid="card-unscheduled">
        <CardHeader className="pb-1 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 flex items-center">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            未排程項目
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-xl sm:text-2xl font-bold text-gray-600">{unscheduledCount}</div>
        </CardContent>
      </Card>

      <Card data-testid="card-overdue">
        <CardHeader className="pb-1 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 flex items-center">
            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            逾期未執行
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-xl sm:text-2xl font-bold text-red-600">{stats.overdueCount}</div>
        </CardContent>
      </Card>
    </div>
  );
}
