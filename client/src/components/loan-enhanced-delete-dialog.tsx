import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { LoanInvestmentRecord } from "./loan-enhanced-types";
import { formatCurrency } from "./loan-enhanced-types";

// ==========================================
// 借貸投資管理 - 刪除確認 Dialog
// ==========================================

export interface LoanEnhancedDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: LoanInvestmentRecord | null;
  onConfirm: (id: number) => void;
  isPending: boolean;
}

export function LoanEnhancedDeleteDialog({
  open,
  onOpenChange,
  record,
  onConfirm,
  isPending,
}: LoanEnhancedDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="delete-confirmation-description">
        <DialogHeader>
          <DialogTitle>確認刪除</DialogTitle>
          <DialogDescription id="delete-confirmation-description">
            您確定要刪除這筆借貸投資紀錄嗎？此操作無法復原。
          </DialogDescription>
        </DialogHeader>

        {record && (
          <div className="py-4">
            <p className="font-medium">{record.itemName}</p>
            <p className="text-sm text-muted-foreground">
              {record.recordType === "loan" ? "借貸" : "投資"} -{" "}
              {formatCurrency(record.principalAmount)}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={() => record && onConfirm(record.id)}
            disabled={isPending}
          >
            {isPending ? "刪除中..." : "確定刪除"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
