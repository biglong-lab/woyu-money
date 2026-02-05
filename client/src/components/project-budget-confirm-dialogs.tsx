// 預算管理確認對話框群組（刪除計劃、刪除項目、轉換項目）

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { BudgetPlan, BudgetItem } from "./project-budget-types";

// 刪除計劃確認對話框
export interface DeletePlanDialogProps {
  plan: BudgetPlan | null;
  onClose: () => void;
  onConfirm: (id: number) => void;
}

export function DeletePlanDialog({
  plan,
  onClose,
  onConfirm,
}: DeletePlanDialogProps) {
  return (
    <AlertDialog open={!!plan} onOpenChange={() => onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確認刪除預算計劃？</AlertDialogTitle>
          <AlertDialogDescription>
            此操作將永久刪除預算計劃「{plan?.planName}
            」及其所有預算項目，無法復原。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => plan && onConfirm(plan.id)}
            className="bg-red-600 hover:bg-red-700"
            data-testid="button-confirm-delete-plan"
          >
            確認刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// 刪除項目確認對話框
export interface DeleteItemDialogProps {
  item: BudgetItem | null;
  onClose: () => void;
  onConfirm: (id: number) => void;
}

export function DeleteItemDialog({
  item,
  onClose,
  onConfirm,
}: DeleteItemDialogProps) {
  return (
    <AlertDialog open={!!item} onOpenChange={() => onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確認刪除預算項目？</AlertDialogTitle>
          <AlertDialogDescription>
            此操作將刪除預算項目「{item?.itemName}」。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => item && onConfirm(item.id)}
            className="bg-red-600 hover:bg-red-700"
            data-testid="button-confirm-delete-item"
          >
            確認刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// 轉換項目確認對話框
export interface ConvertItemDialogProps {
  item: BudgetItem | null;
  onClose: () => void;
  onConfirm: (id: number) => void;
}

export function ConvertItemDialog({
  item,
  onClose,
  onConfirm,
}: ConvertItemDialogProps) {
  return (
    <AlertDialog open={!!item} onOpenChange={() => onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確認轉換為付款項目？</AlertDialogTitle>
          <AlertDialogDescription>
            將預算項目「{item?.itemName}」轉換為實際付款項目。
            轉換後將建立新的付款項目，預算項目保持原狀並標記為已轉換。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => item && onConfirm(item.id)}
            data-testid="button-confirm-convert-item"
          >
            確認轉換
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
