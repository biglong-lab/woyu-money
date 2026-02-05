// 專案付款管理 - 付款對話框元件
import { Upload, X, Image } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { PaymentItem, PaymentFormValues } from "./payment-project-types";

export interface PaymentProjectPaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  paymentItem: PaymentItem | null;
  paymentForm: UseFormReturn<PaymentFormValues>;
  onSubmit: (data: PaymentFormValues) => void;
  isPending: boolean;
  // 圖片上傳
  selectedImage: File | null;
  imagePreview: string | null;
  onImageSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}

export default function PaymentProjectPaymentDialog({
  isOpen,
  onOpenChange,
  paymentItem,
  paymentForm,
  onSubmit,
  isPending,
  selectedImage,
  imagePreview,
  onImageSelect,
  onRemoveImage,
}: PaymentProjectPaymentDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        paymentForm.reset();
      }
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>新增付款記錄</DialogTitle>
          <DialogDescription>
            為「{paymentItem?.itemName}」新增付款記錄
          </DialogDescription>
        </DialogHeader>

        {paymentItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg text-sm">
              <div>
                <span className="text-gray-600">總金額:</span>
                <div className="font-medium">${parseFloat(paymentItem.totalAmount).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-gray-600">已付金額:</span>
                <div className="font-medium">${parseFloat(paymentItem.paidAmount).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-gray-600">剩餘金額:</span>
                <div className="font-medium text-orange-600">
                  ${(parseFloat(paymentItem.totalAmount) - parseFloat(paymentItem.paidAmount)).toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-gray-600">狀態:</span>
                <div className="font-medium">{paymentItem.status}</div>
              </div>
            </div>

            <Form {...paymentForm}>
              <form onSubmit={paymentForm.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={paymentForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>付款金額</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="請輸入付款金額" />
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
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>付款方式</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇付款方式" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                          <SelectItem value="cash">現金</SelectItem>
                          <SelectItem value="credit_card">信用卡</SelectItem>
                          <SelectItem value="digital_payment">數位支付</SelectItem>
                          <SelectItem value="check">支票</SelectItem>
                          <SelectItem value="other">其他</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={paymentForm.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>備註 (選填)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="付款備註" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 圖片上傳字段 */}
                <div className="space-y-4">
                  <Label>付款憑證 (選填)</Label>

                  {!imagePreview ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={onImageSelect}
                        className="hidden"
                        id="receipt-upload"
                      />
                      <label htmlFor="receipt-upload" className="cursor-pointer">
                        <div className="flex flex-col items-center space-y-2">
                          <Upload className="h-8 w-8 text-gray-400" />
                          <div className="text-sm text-gray-600">
                            <span className="font-medium text-blue-600 hover:text-blue-500">
                              點擊上傳圖片
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              支援 JPG, PNG, JPEG 格式，最大 10MB
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <Image className="h-5 w-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {selectedImage?.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {selectedImage && (selectedImage.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onRemoveImage}
                            className="flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* 圖片預覽 */}
                        <div className="mt-3">
                          <img
                            src={imagePreview}
                            alt="付款憑證預覽"
                            className="max-w-full h-32 object-cover rounded border"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onRemoveImage();
                    }}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? '處理中...' : '確認付款'}
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
