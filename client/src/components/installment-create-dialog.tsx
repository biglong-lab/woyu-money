// 分期付款建立對話框元件

import { UseFormReturn, Control, FieldValues } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus } from "lucide-react";
import CategorySelector from "@/components/category-selector";
import type { PaymentCalculation } from "./installment-types";

export interface InstallmentCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<FieldValues>;
  onSubmit: (data: FieldValues) => void;
  isPending: boolean;
  paymentCalculation: PaymentCalculation;
  watchTotalAmount: string;
  watchInstallments: number;
}

export default function InstallmentCreateDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  isPending,
  paymentCalculation,
  watchTotalAmount,
  watchInstallments,
}: InstallmentCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          <span className="text-sm sm:text-base">新增分期項目</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增分期項目</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 統一分類選擇組件 */}
            <CategorySelector
              form={form as unknown as { control: Control<FieldValues>; watch: (name: string) => string; setValue: (name: string, value: string) => void; }}
              onCategoryChange={() => {
                // 分類變更回呼
              }}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>項目名稱</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="輸入分期項目名稱" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>總金額</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="分期總金額" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="installments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分期期數</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="1" max="60" placeholder="期數（月）" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>開始日期</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 分期計算結果顯示 */}
            {watchTotalAmount &&
              watchInstallments &&
              paymentCalculation.calculations.length > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg border">
                  <h4 className="font-medium text-blue-800 mb-2">分期付款計算結果</h4>
                  <div className="text-sm space-y-1">
                    <div className="font-medium">
                      總金額: NT$ {parseFloat(watchTotalAmount).toLocaleString()}
                    </div>
                    <div className="font-medium">分期期數: {watchInstallments} 期</div>
                    <div className="mt-2">
                      <div className="font-medium mb-1 text-blue-700">各期付款明細:</div>
                      <div className="grid grid-cols-1 gap-1">
                        {paymentCalculation.calculations.map((calc, index) => (
                          <div
                            key={index}
                            className="text-xs bg-white p-2 rounded border flex justify-between"
                          >
                            <span>第 {calc.period} 期</span>
                            <span className="font-medium">
                              NT$ {calc.amount.toLocaleString()}
                            </span>
                            <span className="text-gray-500">({calc.type})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="輸入備註..." rows={3} />
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
                {isPending ? "建立中..." : "建立分期項目"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
