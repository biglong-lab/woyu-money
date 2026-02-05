// 月付管理 - 批量操作工具列元件
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, CheckCircle2, XCircle } from "lucide-react";

export interface MonthlyPaymentBatchToolbarProps {
  selectedCount: number;
  totalCount: number;
  selectedItemsTotal: number;
  selectedUnpaidCount: number;
  isBatchDeletePending: boolean;
  isBatchPayPending: boolean;
  onSelectAll: (checked: boolean) => void;
  onClearSelection: () => void;
  onBatchDelete: () => void;
  onBatchMarkPaid: () => void;
}

export function MonthlyPaymentBatchToolbar({
  selectedCount,
  totalCount,
  selectedItemsTotal,
  selectedUnpaidCount,
  isBatchDeletePending,
  isBatchPayPending,
  onSelectAll,
  onClearSelection,
  onBatchDelete,
  onBatchMarkPaid,
}: MonthlyPaymentBatchToolbarProps) {
  return (
    <Card className="p-4 bg-blue-50 border-blue-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedCount === totalCount && totalCount > 0}
              onCheckedChange={onSelectAll}
              data-testid="select-all-checkbox"
            />
            <span className="text-sm font-medium text-blue-800">全選</span>
          </div>
          <div className="text-sm text-blue-700">
            已選擇 <span className="font-bold">{selectedCount}</span> 個項目
            {selectedCount > 0 && (
              <span className="ml-2">
                (總金額: NT$ <span className="font-bold">{selectedItemsTotal.toLocaleString()}</span>)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onBatchMarkPaid}
            disabled={selectedUnpaidCount === 0 || isBatchPayPending}
            className="bg-white hover:bg-green-50 text-green-700 border-green-300"
            data-testid="batch-mark-paid-btn"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            批量標記已付 ({selectedUnpaidCount})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onBatchDelete}
            disabled={selectedCount === 0 || isBatchDeletePending}
            className="bg-white hover:bg-red-50 text-red-700 border-red-300"
            data-testid="batch-delete-btn"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            批量刪除 ({selectedCount})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={selectedCount === 0}
            data-testid="clear-selection-btn"
          >
            <XCircle className="w-4 h-4 mr-1" />
            清除選擇
          </Button>
        </div>
      </div>
    </Card>
  );
}
