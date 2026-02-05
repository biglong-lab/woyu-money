/**
 * 智慧排程建議項目卡片
 * 顯示單個優先級項目的資訊
 */

import { Badge } from '@/components/ui/badge';
import type { PrioritizedItem } from './types';

/** 優先級對應的樣式設定 */
const priorityColors: Record<PrioritizedItem['priorityLevel'], string> = {
  critical: 'bg-red-50 border-red-300 text-red-800',
  high: 'bg-orange-50 border-orange-300 text-orange-800',
  medium: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  low: 'bg-gray-50 border-gray-300 text-gray-700',
};

/** 優先級對應的標籤文字 */
const priorityLabels: Record<PrioritizedItem['priorityLevel'], string> = {
  critical: '緊急',
  high: '高',
  medium: '中',
  low: '低',
};

interface SmartScheduleItemCardProps {
  /** 優先級項目資料 */
  item: PrioritizedItem;
}

export function SmartScheduleItemCard({ item }: SmartScheduleItemCardProps) {
  return (
    <div className={`p-3 rounded-lg border ${priorityColors[item.priorityLevel]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{item.itemName}</span>
            <Badge
              variant={item.priorityLevel === 'critical' ? 'destructive' : 'secondary'}
              className="text-xs shrink-0"
            >
              {priorityLabels[item.priorityLevel]}
            </Badge>
          </div>
          <div className="text-xs mt-1 opacity-75">{item.reason}</div>
          {item.projectName && (
            <div className="text-xs mt-0.5 opacity-60">專案：{item.projectName}</div>
          )}
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="text-sm font-bold">${item.remainingAmount.toLocaleString()}</div>
          {item.isOverdue && (
            <div className="text-xs text-red-600">逾期 {item.overdueDays} 天</div>
          )}
        </div>
      </div>
    </div>
  );
}
