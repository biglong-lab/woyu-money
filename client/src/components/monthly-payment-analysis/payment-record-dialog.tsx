import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { PaymentItem, PaymentRecordInput } from "./types";

interface PaymentRecordDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly selectedItem: PaymentItem | null;
  readonly form: UseFormReturn<PaymentRecordInput>;
  readonly onSubmit: (data: PaymentRecordInput) => void;
  readonly isPending: boolean;
  // 圖片相關
  readonly imagePreview: string | null;
  readonly selectedImageName: string | undefined;
  readonly onImageSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onImageRemove: () => void;
}

// 付款記錄對話框
export function PaymentRecordDialog({
  isOpen,
  onOpenChange,
  selectedItem,
  form,
  onSubmit,
  isPending,
  imagePreview,
  selectedImageName,
  onImageSelect,
  onImageRemove,
}: PaymentRecordDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>記錄付款</DialogTitle>
          <DialogDescription>
            為「{selectedItem?.itemName}」記錄付款
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {/* 付款金額 */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>付款金額</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 付款日期 */}
            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>付款日期</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 付款方式 */}
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>付款方式</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇付款方式" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                      <SelectItem value="cash">現金</SelectItem>
                      <SelectItem value="credit_card">信用卡</SelectItem>
                      <SelectItem value="check">支票</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 備註 */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註 (選填)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="付款相關備註..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 圖片上傳區域 */}
            <div className="space-y-2">
              <Label>付款單據圖片（選填）</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="付款單據預覽"
                      className="max-w-full h-auto max-h-48 mx-auto rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={onImageRemove}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <p className="text-sm text-gray-600 mt-2 text-center">
                      {selectedImageName}
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-2">
                      <label className="cursor-pointer">
                        <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                          點擊上傳圖片
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={onImageSelect}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      支援 PNG、JPG、JPEG 格式，最大 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
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
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
