// 月付管理 - 編輯對話框元件
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import type { PaymentItem, PaymentProject, DebtCategory, FixedCategory } from "./monthly-payment-types";

export interface MonthlyPaymentEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editForm: UseFormReturn<any>;
  editingItem: PaymentItem | null;
  isEditUnlocked: boolean;
  onToggleEditLock: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
  projects: PaymentProject[];
  categories: DebtCategory[];
  fixedCategories: FixedCategory[];
}

export function MonthlyPaymentEditDialog({
  isOpen,
  onOpenChange,
  editForm,
  editingItem,
  isEditUnlocked,
  onToggleEditLock,
  onSubmit,
  isPending,
  projects,
  categories,
  fixedCategories,
}: MonthlyPaymentEditDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>編輯月付項目</span>
            <Button
              type="button"
              variant={isEditUnlocked ? "destructive" : "outline"}
              size="sm"
              onClick={onToggleEditLock}
              className="text-xs"
            >
              {isEditUnlocked ? "鎖定編輯" : "解鎖編輯"}
            </Button>
          </DialogTitle>
          <div className={`text-sm p-3 rounded-lg ${isEditUnlocked ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
            <p className={`font-medium mb-1 ${isEditUnlocked ? 'text-red-800' : 'text-blue-800'}`}>
              {isEditUnlocked ? '編輯模式已解鎖' : '編輯模式已鎖定'}
            </p>
            <p className={isEditUnlocked ? 'text-red-700' : 'text-blue-700'}>
              {isEditUnlocked
                ? '現在可以編輯所有項目資訊，請謹慎修改以避免數據不一致'
                : '預設僅能修改付款狀態、實際付款日期和備註，其他欄位為唯讀'
              }
            </p>
          </div>
        </DialogHeader>
        <Form {...editForm}>
          <form onSubmit={editForm.handleSubmit(onSubmit)} className="space-y-4">
            {/* 顯示分類資訊（唯讀） */}
            <div className="p-4 bg-gray-50 rounded-lg border">
              <h4 className="font-medium text-gray-700 mb-2">分類資訊（不可編輯）</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">分類類型: </span>
                  <span className="font-medium">
                    {editingItem?.fixedCategoryId ? "固定分類" : "專案分類"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">專案: </span>
                  <span className="font-medium">
                    {projects.find(p => p.id === editingItem?.projectId)?.projectName || "未設定"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">分類: </span>
                  <span className="font-medium">
                    {editingItem?.fixedCategoryId
                      ? fixedCategories.find(c => c.id === editingItem.fixedCategoryId)?.categoryName
                      : categories.find(c => c.id === editingItem?.categoryId)?.categoryName
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* 項目基本資訊 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={editForm.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      項目名稱{!isEditUnlocked && "（鎖定）"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly={!isEditUnlocked}
                        className={!isEditUnlocked ? "bg-gray-50" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      月付金額{!isEditUnlocked && "（鎖定）"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        readOnly={!isEditUnlocked}
                        className={!isEditUnlocked ? "bg-gray-50" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={editForm.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      預計付款日期{!isEditUnlocked && "（鎖定）"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        readOnly={!isEditUnlocked}
                        className={!isEditUnlocked ? "bg-gray-50" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>實際付款日期</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 付款狀態選擇 */}
            <FormField
              control={editForm.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>付款狀態</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="w-full p-2 border border-input rounded-md bg-background"
                    >
                      <option value="pending">待付款</option>
                      <option value="paid">已付款</option>
                      <option value="overdue">逾期</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={editForm.control}
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
                {isPending ? "更新中..." : "更新月付項目"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
