// 分期付款編輯對話框元件（僅可編輯備註）

import { UseFormReturn } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { PaymentItem } from "./installment-types";

export interface InstallmentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<any>;
  onSubmit: (data: any) => void;
  isPending: boolean;
  editingItem: PaymentItem | null;
}

export default function InstallmentEditDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  isPending,
  editingItem,
}: InstallmentEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>編輯分期項目</DialogTitle>
          <p className="text-sm text-gray-600">
            為避免資料錯誤，僅可修改備註欄位。如需修改其他資訊，請刪除後重新建立。
          </p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 唯讀欄位顯示 */}
            <div className="p-4 bg-gray-50 rounded-lg border">
              <h4 className="font-medium text-gray-800 mb-3">項目資訊（唯讀）</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">項目名稱</p>
                  <p className="font-medium">{editingItem?.itemName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">總金額</p>
                  <p className="font-medium">
                    NT${" "}
                    {editingItem?.totalAmount
                      ? parseFloat(editingItem.totalAmount).toLocaleString()
                      : "0"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-sm text-gray-500">分期期數</p>
                  <p className="font-medium">{editingItem?.installmentMonths} 期</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">開始日期</p>
                  <p className="font-medium">
                    {editingItem?.startDate
                      ? new Date(editingItem.startDate).toLocaleDateString()
                      : "未設定"}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-sm text-gray-500">每期金額</p>
                <p className="font-medium">
                  NT${" "}
                  {editingItem?.amount
                    ? parseFloat(editingItem.amount).toLocaleString()
                    : "0"}
                </p>
              </div>
            </div>

            {/* 可編輯備註欄 */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註（可編輯）</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="輸入備註..." rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "更新中..." : "更新備註"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
