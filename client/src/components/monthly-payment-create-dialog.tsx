// 月付管理 - 新增對話框元件
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, CreditCard } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import CategorySelector from "@/components/category-selector";

export interface MonthlyPaymentCreateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  createForm: UseFormReturn<any>;
  onSubmit: (data: any) => void;
  isPending: boolean;
}

export function MonthlyPaymentCreateDialog({
  isOpen,
  onOpenChange,
  createForm,
  onSubmit,
  isPending,
}: MonthlyPaymentCreateDialogProps) {
  const watchTotalAmount = createForm.watch("totalAmount");
  const watchInstallments = createForm.watch("installments");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          <span className="text-sm sm:text-base">新增月付項目</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增月付項目</DialogTitle>
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            <p className="font-medium text-blue-800 mb-1">月付分期說明：</p>
            <p>* 設定期數、開始付款日期、月付金額，系統將自動創建連續月份的付款項目</p>
            <p>* 例如：4期、2025/04/01開始、每月10000元 - 自動創建 04/01、05/01、06/01、07/01 四個付款項目</p>
          </div>
        </DialogHeader>
        <Form {...createForm}>
          <form onSubmit={createForm.handleSubmit(onSubmit)} className="space-y-4">
            {/* 統一分類選擇組件 */}
            <CategorySelector
              form={createForm}
              onCategoryChange={() => {}}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={createForm.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>項目名稱</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="輸入付款項目名稱"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={createForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>月付金額</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="每月應付金額" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={createForm.control}
                name="dueDate"
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
              <FormField
                control={createForm.control}
                name="installments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>幾個月</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="1"
                        max="60"
                        placeholder="期數"
                        defaultValue="1"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>實際付款日期（選填）</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 費用計算明細 */}
            <PaymentCalculationPreview
              totalAmount={watchTotalAmount}
              installments={watchInstallments}
              startDate={createForm.watch("dueDate")}
            />

            <FormField
              control={createForm.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="付款備註..." rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "建立中..." : "建立月付項目"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// 費用計算預覽子元件
interface PaymentCalculationPreviewProps {
  totalAmount: string;
  installments: string;
  startDate: string;
}

function PaymentCalculationPreview({ totalAmount, installments, startDate }: PaymentCalculationPreviewProps) {
  const monthlyAmount = parseFloat(totalAmount) || 0;
  const installmentCount = parseInt(installments) || 0;

  if (monthlyAmount <= 0 || installmentCount <= 0) return null;

  const totalCost = monthlyAmount * installmentCount;
  const parsedStartDate = new Date(startDate || new Date());

  return (
    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg space-y-3">
      <h4 className="font-semibold text-blue-900 flex items-center gap-2">
        <CreditCard className="w-4 h-4" />
        費用計算明細
      </h4>

      <div className="space-y-3">
        {/* 基本計算 */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-white p-2 rounded border">
            <div className="text-gray-600 text-xs">每月金額</div>
            <div className="font-bold text-blue-900">NT$ {monthlyAmount.toLocaleString()}</div>
          </div>
          <div className="bg-white p-2 rounded border">
            <div className="text-gray-600 text-xs">付款期數</div>
            <div className="font-bold text-blue-900">{installmentCount} 個月</div>
          </div>
          <div className="bg-white p-2 rounded border">
            <div className="text-gray-600 text-xs">總計費用</div>
            <div className="font-bold text-green-700">NT$ {totalCost.toLocaleString()}</div>
          </div>
        </div>

        {/* 付款時程預覽 */}
        <div className="bg-white p-3 rounded border">
          <div className="text-xs text-gray-600 mb-2">付款時程預覽 (前3期)</div>
          <div className="space-y-1 text-xs">
            {Array.from({ length: Math.min(3, installmentCount) }, (_, i) => {
              const paymentDate = new Date(parsedStartDate);
              paymentDate.setMonth(parsedStartDate.getMonth() + i);
              return (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-600">第 {i + 1} 期:</span>
                  <span className="font-medium">{paymentDate.toLocaleDateString()} - NT$ {monthlyAmount.toLocaleString()}</span>
                </div>
              );
            })}
            {installmentCount > 3 && (
              <div className="text-gray-500 text-center">... 共 {installmentCount} 期</div>
            )}
          </div>
        </div>

        {/* 計算公式 */}
        <div className="bg-amber-50 border border-amber-200 p-2 rounded text-xs">
          <span className="text-amber-800">
            <strong>計算公式:</strong> NT$ {monthlyAmount.toLocaleString()} x {installmentCount} 期 = NT$ {totalCost.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
