/**
 * 建立排程對話框
 * 供使用者為指定項目建立付款計劃
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { UseFormReturn } from 'react-hook-form';
import type { IntegratedPaymentItem, ScheduleFormData } from './types';

interface CreateScheduleDialogProps {
  /** 是否開啟對話框 */
  open: boolean;
  /** 控制對話框開關 */
  onOpenChange: (open: boolean) => void;
  /** 選中的付款項目 */
  selectedItem: IntegratedPaymentItem | null;
  /** 選擇的排程日期 */
  selectedDate: string;
  /** react-hook-form 的 form 實例 */
  form: UseFormReturn<ScheduleFormData>;
  /** 提交表單的回呼 */
  onSubmit: (data: ScheduleFormData) => void;
  /** 是否正在建立中 */
  isPending: boolean;
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  selectedItem,
  selectedDate,
  form,
  onSubmit,
  isPending,
}: CreateScheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-create-schedule">
        <DialogHeader>
          <DialogTitle>建立付款計劃</DialogTitle>
        </DialogHeader>

        {selectedItem && (
          <div className="space-y-4">
            {/* 項目摘要資訊 */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="font-semibold">{selectedItem.itemName}</div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-gray-500">應付總額</div>
                  <div className="font-medium">${parseFloat(selectedItem.totalAmount).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">實際已付</div>
                  <div className="font-medium text-green-600">${parseFloat(selectedItem.actualPaid).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">待付金額</div>
                  <div className="font-medium text-orange-600">${parseFloat(selectedItem.pendingAmount).toLocaleString()}</div>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                計劃日期：{selectedDate}
              </div>
            </div>

            {/* 排程表單 */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="scheduledAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>計劃金額</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="請輸入計劃金額" data-testid="input-scheduled-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>備註</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="選填" rows={3} data-testid="textarea-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={isPending} data-testid="btn-submit-schedule">
                    {isPending ? '建立中...' : '建立計劃'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
