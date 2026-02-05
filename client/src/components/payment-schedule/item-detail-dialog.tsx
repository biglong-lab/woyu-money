/**
 * 項目詳情對話框
 * 顯示項目的完整資訊、排程歷史與付款記錄
 */

import { CheckCircle, CreditCard } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { IntegratedPaymentItem, Schedule } from './types';

interface ItemDetailDialogProps {
  /** 是否開啟對話框 */
  open: boolean;
  /** 控制對話框開關 */
  onOpenChange: (open: boolean) => void;
  /** 選中的付款項目 */
  selectedItem: IntegratedPaymentItem | null;
  /** 快速付款的回呼 */
  onQuickPayment: (item: IntegratedPaymentItem, schedule?: Schedule) => void;
}

export function ItemDetailDialog({
  open,
  onOpenChange,
  selectedItem,
  onQuickPayment,
}: ItemDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" data-testid="dialog-item-detail">
        <DialogHeader>
          <DialogTitle>項目詳情與排程歷史</DialogTitle>
        </DialogHeader>

        {selectedItem && (
          <div className="space-y-6">
            {/* 項目基本資訊 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-3">{selectedItem.itemName}</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">應付總額</div>
                  <div className="text-xl font-bold">${parseFloat(selectedItem.totalAmount).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">實際已付</div>
                  <div className="text-xl font-bold text-green-600">${parseFloat(selectedItem.actualPaid).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">計劃金額</div>
                  <div className="text-xl font-bold text-blue-600">${parseFloat(selectedItem.scheduledTotal).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">待付金額</div>
                  <div className="text-xl font-bold text-orange-600">${parseFloat(selectedItem.pendingAmount).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <Separator />

            {/* 排程歷史 */}
            <div>
              <h4 className="font-semibold mb-3">排程歷史記錄 ({selectedItem.scheduleCount})</h4>
              {selectedItem.schedules.length > 0 ? (
                <div className="space-y-2">
                  {selectedItem.schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`p-3 rounded-lg border ${
                        schedule.isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {schedule.scheduledDate}
                            {schedule.isOverdue && <Badge variant="destructive" className="ml-2">逾期</Badge>}
                            {schedule.status === 'completed' && <Badge className="ml-2">已完成</Badge>}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            計劃金額：${parseFloat(schedule.scheduledAmount).toLocaleString()}
                          </div>
                          {schedule.notes && (
                            <div className="text-sm text-gray-500 mt-1">備註：{schedule.notes}</div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => onQuickPayment(selectedItem, schedule)}
                          data-testid={`btn-quick-pay-${schedule.id}`}
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          立即付款
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">尚無排程記錄</div>
              )}
            </div>

            <Separator />

            {/* 付款記錄 */}
            <div>
              <h4 className="font-semibold mb-3">實際付款記錄 ({selectedItem.recordCount})</h4>
              {selectedItem.paymentRecords.length > 0 ? (
                <div className="space-y-2">
                  {selectedItem.paymentRecords.map((record) => (
                    <div key={record.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{record.paymentDate}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            付款金額：${parseFloat(record.amount).toLocaleString()}
                            {record.paymentMethod && ` · ${record.paymentMethod}`}
                          </div>
                          {record.notes && (
                            <div className="text-sm text-gray-500 mt-1">{record.notes}</div>
                          )}
                        </div>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">尚無付款記錄</div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                關閉
              </Button>
              <Button onClick={() => onQuickPayment(selectedItem)} data-testid="btn-quick-payment">
                <CreditCard className="h-4 w-4 mr-2" />
                執行付款
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
