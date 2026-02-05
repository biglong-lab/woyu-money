// 專案付款管理 - 編輯項目對話框 + 刪除確認對話框
import { Trash2 } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { PaymentItem, EditItemFormValues } from "./payment-project-types";

// -- 編輯對話框 --

export interface PaymentProjectEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editForm: UseFormReturn<EditItemFormValues>;
  onSubmit: (data: EditItemFormValues) => void;
  isPending: boolean;
}

export function PaymentProjectEditDialog({
  isOpen,
  onOpenChange,
  editForm,
  onSubmit,
  isPending,
}: PaymentProjectEditDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>修改付款項目</DialogTitle>
          <DialogDescription>
            修改項目的基本資訊
          </DialogDescription>
        </DialogHeader>

        <Form {...editForm}>
          <form onSubmit={editForm.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={editForm.control}
              name="itemName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>項目名稱</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="請輸入項目名稱" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={editForm.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>總金額</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" placeholder="請輸入總金額" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={editForm.control}
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

              <FormField
                control={editForm.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>結束日期 (選填)</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={editForm.control}
                name="paymentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>付款類型</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇付款類型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">單次付款</SelectItem>
                        <SelectItem value="installment">分期付款</SelectItem>
                        <SelectItem value="monthly">月付</SelectItem>
                        <SelectItem value="recurring">定期付款</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>優先級</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇優先級" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">低優先級</SelectItem>
                        <SelectItem value="2">中優先級</SelectItem>
                        <SelectItem value="3">高優先級</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={editForm.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註 (選填)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="項目備註" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '修改中...' : '確認修改'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// -- 刪除確認對話框 --

export interface PaymentProjectDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  deleteItem: PaymentItem | null;
  onConfirm: () => void;
  isPending: boolean;
}

export function PaymentProjectDeleteDialog({
  isOpen,
  onOpenChange,
  deleteItem,
  onConfirm,
  isPending,
}: PaymentProjectDeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            刪除付款項目
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              確定要刪除付款項目「<span className="font-medium">{deleteItem?.itemName}</span>」嗎？
            </p>
            <p className="text-sm text-gray-500">
              此項目將移至回收站，您可以在回收站中恢復或永久刪除。
            </p>
            <div className="bg-gray-50 p-3 rounded-lg text-sm">
              <p>金額：NT$ {deleteItem ? parseFloat(deleteItem.totalAmount).toLocaleString() : 0}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700"
            data-testid="button-confirm-delete"
          >
            {isPending ? "刪除中..." : "移至回收站"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
