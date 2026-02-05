// 一般付款管理 - 新增對話框元件
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, FileSpreadsheet } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import CategorySelector from "@/components/category-selector";

export interface GeneralPaymentCreateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  createForm: UseFormReturn<any>;
  onSubmit: (data: any) => void;
  isPending: boolean;
  onBatchImportOpen: () => void;
}

export function GeneralPaymentCreateDialog({
  isOpen,
  onOpenChange,
  createForm,
  onSubmit,
  isPending,
  onBatchImportOpen,
}: GeneralPaymentCreateDialogProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="text-sm sm:text-base">新增付款項目</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="create-payment-description">
          <DialogHeader>
            <DialogTitle>新增一般付款項目</DialogTitle>
          </DialogHeader>
          <div id="create-payment-description" className="sr-only">
            建立新的一般付款項目，設定分類、專案、金額及付款日期
          </div>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onSubmit)} className="space-y-4">
              {/* 使用 CategorySelector 組件 */}
              <CategorySelector
                form={createForm}
                onCategoryChange={(categoryData) => {
                  // 處理分類變更
                  if (categoryData.itemName) {
                    createForm.setValue("itemName", categoryData.itemName);
                  }
                }}
              />

              {/* 第三行：項目名稱和付款金額 */}
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
                          placeholder="輸入付款項目名稱（可自定義專案專屬項目）"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>金額</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="輸入金額" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 第四行：日期欄位 */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>預計付款日期</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
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

              {/* 第五行：備註 */}
              <FormField
                control={createForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="付款項目相關備註" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "建立中..." : "建立付款項目"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Button
        onClick={onBatchImportOpen}
        variant="outline"
        className="flex items-center gap-2"
      >
        <FileSpreadsheet className="w-4 h-4" />
        <span className="text-sm sm:text-base">批量導入</span>
      </Button>
    </div>
  );
}
