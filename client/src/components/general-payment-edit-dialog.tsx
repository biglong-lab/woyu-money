// 一般付款管理 - 編輯對話框元件
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";

export interface GeneralPaymentEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editForm: UseFormReturn<any>;
  onSubmit: (data: any) => void;
  isPending: boolean;
}

export function GeneralPaymentEditDialog({
  isOpen,
  onOpenChange,
  editForm,
  onSubmit,
  isPending,
}: GeneralPaymentEditDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>編輯付款項目</DialogTitle>
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
                    <Input {...field} placeholder="輸入項目名稱" />
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
                    <Input {...field} type="number" step="0.01" placeholder="輸入總金額" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={editForm.control}
              name="startDate"
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
              control={editForm.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="備註內容" />
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
                {isPending ? "更新中..." : "更新"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
