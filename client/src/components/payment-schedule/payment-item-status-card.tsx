/**
 * 付款項目狀態卡片
 * 根據項目狀態（逾期/已計劃/未排程/已完成）顯示不同樣式
 */

import { AlertCircle, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { IntegratedPaymentItem, ItemStatus } from './types';

/** 各狀態的樣式與圖標設定 */
const statusConfig = {
  overdue: { color: 'bg-red-50 border-red-200', badge: 'destructive', icon: XCircle, label: '逾期未付' },
  scheduled: { color: 'bg-yellow-50 border-yellow-200', badge: 'default', icon: Clock, label: '已計劃' },
  unscheduled: { color: 'bg-gray-50 border-gray-200', badge: 'secondary', icon: AlertCircle, label: '未排程' },
  completed: { color: 'bg-green-50 border-green-200', badge: 'default', icon: CheckCircle, label: '已完成' },
} as const;

interface PaymentItemStatusCardProps {
  /** 付款項目資料 */
  item: IntegratedPaymentItem;
  /** 項目狀態類型 */
  status: ItemStatus;
  /** 點擊詳情按鈕的回呼 */
  onViewDetail: (item: IntegratedPaymentItem) => void;
}

export function PaymentItemStatusCard({ item, status, onViewDetail }: PaymentItemStatusCardProps) {
  const totalAmount = parseFloat(item.totalAmount);
  const actualPaid = parseFloat(item.actualPaid);
  const scheduledTotal = parseFloat(item.scheduledTotal);
  const pending = parseFloat(item.pendingAmount);
  const paymentProgress = totalAmount > 0 ? (actualPaid / totalAmount) * 100 : 0;

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card
      className={`${config.color} border-2 cursor-move hover:shadow-md transition-shadow`}
      data-testid={`item-card-${item.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <StatusIcon className="h-4 w-4" />
              {item.itemName}
            </CardTitle>
            <div className="text-xs text-gray-500 mt-1">
              {item.projectName && <span className="mr-2">📁 {item.projectName}</span>}
              {item.categoryName && <span>🏷️ {item.categoryName}</span>}
            </div>
          </div>
          <Badge variant={config.badge as "default" | "destructive" | "secondary"} className="ml-2">{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 三維金額顯示 */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-gray-500">應付總額</div>
            <div className="font-semibold text-gray-900">${totalAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-gray-500">實際已付</div>
            <div className="font-semibold text-green-600">${actualPaid.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-gray-500">計劃金額</div>
            <div className="font-semibold text-blue-600">${scheduledTotal.toLocaleString()}</div>
          </div>
        </div>

        {/* 付款進度條 */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">付款進度</span>
            <span className="font-medium">{paymentProgress.toFixed(0)}%</span>
          </div>
          <Progress value={paymentProgress} className="h-2" />
        </div>

        {/* 待付金額 */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <div className="text-xs text-gray-500">待付金額</div>
            <div className="text-lg font-bold text-orange-600">${pending.toLocaleString()}</div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewDetail(item)}
              data-testid={`btn-view-detail-${item.id}`}
            >
              <Eye className="h-3 w-3 mr-1" />
              詳情
            </Button>
          </div>
        </div>

        {/* 排程記錄提示 */}
        {item.scheduleCount > 0 && (
          <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
            📅 已安排 {item.scheduleCount} 次排程
            {item.recordCount > 0 && ` · ✅ 已付款 ${item.recordCount} 次`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
