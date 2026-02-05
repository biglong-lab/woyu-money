// 一般付款管理 - 刪除確認對話框元件
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import type { PaymentItem } from "./general-payment-types";

export interface GeneralPaymentDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  deleteItem: PaymentItem | null;
  onConfirm: () => void;
  isPending: boolean;
}

export function GeneralPaymentDeleteDialog({
  isOpen,
  onOpenChange,
  deleteItem,
  onConfirm,
  isPending,
}: GeneralPaymentDeleteDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-amber-500" />
            刪除付款項目
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-gray-600 mb-3">
            確定要刪除付款項目「<span className="font-medium">{deleteItem?.itemName}</span>」嗎？
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
            <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <span className="text-base">i</span>
              此項目將被移至回收站，您可以隨時恢復。
            </p>
          </div>
          <div className="text-xs text-gray-500">
            金額：NT$ {deleteItem ? parseFloat(deleteItem.totalAmount).toLocaleString() : 0}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            data-testid="button-confirm-delete"
          >
            {isPending ? "刪除中..." : "移至回收站"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
