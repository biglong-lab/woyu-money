/**
 * 智慧排程工具列
 * 提供預算輸入、智慧建議觸發、逾期重排功能
 */

import { Zap, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SmartScheduleToolbarProps {
  /** 預算輸入值 */
  budgetInput: string;
  /** 更新預算輸入 */
  onBudgetInputChange: (value: string) => void;
  /** 觸發智慧排程建議 */
  onSmartSchedule: () => void;
  /** 智慧排程是否載入中 */
  isSmartSchedulePending: boolean;
  /** 逾期項目數量 */
  overdueCount: number;
  /** 觸發自動重排逾期項目 */
  onAutoReschedule: () => void;
  /** 自動重排是否載入中 */
  isAutoReschedulePending: boolean;
}

export function SmartScheduleToolbar({
  budgetInput,
  onBudgetInputChange,
  onSmartSchedule,
  isSmartSchedulePending,
  overdueCount,
  onAutoReschedule,
  isAutoReschedulePending,
}: SmartScheduleToolbarProps) {
  return (
    <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="flex items-center text-base sm:text-lg">
          <Zap className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-purple-600" />
          智慧排程助手
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 預算輸入 + 智慧建議 */}
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                type="number"
                placeholder="輸入本月可用預算..."
                value={budgetInput}
                onChange={(e) => onBudgetInputChange(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              onClick={onSmartSchedule}
              disabled={isSmartSchedulePending}
              className="bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
            >
              <Zap className="h-4 w-4 mr-1" />
              {isSmartSchedulePending ? '分析中...' : '智慧建議'}
            </Button>
          </div>
          {/* 逾期重排按鈕 */}
          {overdueCount > 0 && (
            <Button
              variant="outline"
              onClick={onAutoReschedule}
              disabled={isAutoReschedulePending}
              className="border-red-300 text-red-700 hover:bg-red-50 whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {isAutoReschedulePending
                ? '重排中...'
                : `重排 ${overdueCount} 筆逾期`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
