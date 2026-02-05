import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { LoanInvestmentRecord, QuickPaymentFormData } from "./loan-enhanced-types";

// ==========================================
// 借貸投資管理 - 快速還款 Dialog
// ==========================================

export interface LoanEnhancedQuickPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: LoanInvestmentRecord | null;
  formData: QuickPaymentFormData;
  onFormChange: (data: QuickPaymentFormData) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function LoanEnhancedQuickPaymentDialog({
  open,
  onOpenChange,
  record,
  formData,
  onFormChange,
  onSubmit,
  isPending,
}: LoanEnhancedQuickPaymentDialogProps) {
  /** 以不可變方式更新表單欄位 */
  const updateField = <K extends keyof QuickPaymentFormData>(
    key: K,
    value: QuickPaymentFormData[K]
  ) => {
    onFormChange({ ...formData, [key]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>快速還款記錄</DialogTitle>
          <DialogDescription>
            為 {record?.itemName} 記錄還款
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="paymentAmount">還款金額 *</Label>
            <Input
              id="paymentAmount"
              type="number"
              value={formData.amount}
              onChange={(e) => updateField("amount", e.target.value)}
              placeholder="0"
            />
          </div>

          <div>
            <Label htmlFor="paymentType">還款類型</Label>
            <Select
              value={formData.paymentType}
              onValueChange={(value: "interest" | "principal" | "mixed") =>
                updateField("paymentType", value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interest">利息</SelectItem>
                <SelectItem value="principal">本金</SelectItem>
                <SelectItem value="mixed">本金+利息</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="paymentMethod">付款方式</Label>
            <Select
              value={formData.paymentMethod}
              onValueChange={(value: "cash" | "bank_transfer" | "check" | "other") =>
                updateField("paymentMethod", value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">現金</SelectItem>
                <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                <SelectItem value="check">支票</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="paymentDate">還款日期</Label>
            <Input
              id="paymentDate"
              type="date"
              value={formData.paymentDate}
              onChange={(e) => updateField("paymentDate", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="paymentNotes">備註</Label>
            <Textarea
              id="paymentNotes"
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="還款相關備註..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || !formData.amount}
          >
            {isPending ? "記錄中..." : "記錄還款"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
