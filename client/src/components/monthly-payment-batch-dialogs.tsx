// 月付管理 - 批量操作確認對話框元件
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// 批量刪除確認對話框
export interface BatchDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  selectedItemsTotal: number;
  onConfirm: () => void;
  isPending: boolean;
}

export function BatchDeleteDialog({
  isOpen,
  onOpenChange,
  selectedCount,
  selectedItemsTotal,
  onConfirm,
  isPending,
}: BatchDeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確認批量刪除</AlertDialogTitle>
          <AlertDialogDescription>
            您確定要將 <span className="font-bold text-red-600">{selectedCount}</span> 個項目移至回收站嗎？
            <br />
            <span className="text-sm text-gray-500">
              總金額: NT$ {selectedItemsTotal.toLocaleString()}
            </span>
            <br />
            <span className="text-sm text-gray-500">
              已刪除的項目可從回收站恢復。
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
            data-testid="confirm-batch-delete"
          >
            {isPending ? "刪除中..." : "確認刪除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// 批量付款確認對話框
export interface BatchPayDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUnpaidCount: number;
  onConfirm: () => void;
  isPending: boolean;
}

export function BatchPayDialog({
  isOpen,
  onOpenChange,
  selectedUnpaidCount,
  onConfirm,
  isPending,
}: BatchPayDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確認批量付款</AlertDialogTitle>
          <AlertDialogDescription>
            您確定要將 <span className="font-bold text-green-600">{selectedUnpaidCount}</span> 個未付款項目標記為已付款嗎？
            <br />
            <span className="text-sm text-gray-500">
              付款日期將設為今天
            </span>
            <br />
            <span className="text-sm text-gray-500">
              注意：已付款的項目不會受影響。
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-green-600 hover:bg-green-700"
            data-testid="confirm-batch-pay"
          >
            {isPending ? "處理中..." : "確認付款"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
