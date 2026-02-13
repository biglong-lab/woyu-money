// 一般付款管理 - 付款對話框元件
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UseFormReturn, FieldValues } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import type { PaymentItem } from "./general-payment-types";

export interface GeneralPaymentPaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  paymentForm: UseFormReturn<FieldValues>;
  paymentItem: PaymentItem | null;
  onSubmit: (data: FieldValues, receiptFile: File | null) => void;
  isPending: boolean;
}

export function GeneralPaymentPaymentDialog({
  isOpen,
  onOpenChange,
  paymentForm,
  paymentItem,
  onSubmit,
  isPending,
}: GeneralPaymentPaymentDialogProps) {
  const { toast } = useToast();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  // 圖片上傳處理
  const handleReceiptUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "文件過大",
          description: "請選擇小於5MB的圖片文件",
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "文件格式錯誤",
          description: "請選擇圖片文件",
          variant: "destructive",
        });
        return;
      }

      setReceiptFile(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReceiptFile = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const handleFormSubmit = (data: FieldValues) => {
    onSubmit(data, receiptFile);
    // 清除本地檔案狀態
    removeReceiptFile();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>付款記錄</DialogTitle>
          {paymentItem && (
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>項目：</strong>{paymentItem.itemName}</p>
              <p><strong>總金額：</strong>NT$ {parseFloat(paymentItem.totalAmount).toLocaleString()}</p>
              <p><strong>已付金額：</strong>NT$ {parseFloat(paymentItem.paidAmount || "0").toLocaleString()}</p>
              <p><strong>待付金額：</strong>NT$ {(parseFloat(paymentItem.totalAmount) - parseFloat(paymentItem.paidAmount || "0")).toLocaleString()}</p>
            </div>
          )}
        </DialogHeader>
        <Form {...paymentForm}>
          <form onSubmit={paymentForm.handleSubmit(handleFormSubmit)} className="space-y-4">
            <FormField
              control={paymentForm.control}
              name="paymentAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>付款金額</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" placeholder="輸入付款金額" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={paymentForm.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>付款日期</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={paymentForm.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註（選填）</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="付款相關備註" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 圖片上傳欄位 */}
            <div className="space-y-3">
              <Label>付款單據（選填）</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptUpload}
                    className="file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700"
                  />
                  {receiptFile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={removeReceiptFile}
                      className="text-red-600 hover:text-red-700"
                    >
                      移除
                    </Button>
                  )}
                </div>

                {receiptPreview && (
                  <div className="mt-2">
                    <img
                      src={receiptPreview}
                      alt="付款單據預覽"
                      className="max-w-full h-32 object-cover rounded border"
                    />
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  支援格式：JPG, PNG, GIF（最大 5MB）
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "處理中..." : "確認付款"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
