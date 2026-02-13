/**
 * 統一付款管理 - 項目詳情對話框
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, Receipt } from "lucide-react";
import type { PaymentItem, PaymentRecord } from "./types";

interface ItemDetailDialogProps {
  /** 選中的項目（null 表示關閉） */
  selectedItem: PaymentItem | null;
  /** 關閉對話框回呼 */
  onClose: () => void;
  /** 該項目的付款記錄 */
  paymentRecords: PaymentRecord[];
}

/** 取得狀態中文與 Badge variant */
function getStatusDisplay(status: string | null): {
  label: string;
  variant: "default" | "destructive" | "secondary";
} {
  switch (status) {
    case "paid":
      return { label: "已付款", variant: "default" };
    case "overdue":
      return { label: "逾期", variant: "destructive" };
    case "partial":
      return { label: "部分付款", variant: "secondary" };
    default:
      return { label: "待付款", variant: "secondary" };
  }
}

/** 取得付款類型中文 */
function getPaymentTypeText(type: string | null): string {
  switch (type) {
    case "single":
      return "單次付款";
    case "recurring":
      return "定期付款";
    default:
      return "分期付款";
  }
}

/** 項目詳情對話框 */
export function ItemDetailDialog({
  selectedItem,
  onClose,
  paymentRecords,
}: ItemDetailDialogProps) {
  const [showRecords, setShowRecords] = useState(false);

  if (!selectedItem) return null;

  const statusDisplay = getStatusDisplay(selectedItem.status);
  const itemRecords = paymentRecords
    .filter((r) => r.itemId === selectedItem.id)
    .sort(
      (a, b) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );
  const remainingAmount =
    parseFloat(selectedItem.totalAmount) -
    parseFloat(selectedItem.paidAmount || "0");

  return (
    <Dialog open={!!selectedItem} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            項目詳情
          </DialogTitle>
          <DialogDescription>查看付款項目的完整資訊</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本資訊 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">
                項目名稱
              </Label>
              <p className="mt-1 text-sm text-gray-900">
                {selectedItem.itemName}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">
                項目類型
              </Label>
              <p className="mt-1 text-sm text-gray-900">
                {selectedItem.itemType === "home" ? "家用" : "專案"}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">
                付款類型
              </Label>
              <p className="mt-1 text-sm text-gray-900">
                {getPaymentTypeText(selectedItem.paymentType)}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">狀態</Label>
              <Badge variant={statusDisplay.variant} className="mt-1">
                {statusDisplay.label}
              </Badge>
            </div>
          </div>

          {/* 金額資訊 */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-sm font-medium text-gray-700">
                總金額
              </Label>
              <p className="mt-1 text-lg font-bold text-gray-900">
                ${parseInt(selectedItem.totalAmount).toLocaleString()}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">
                已付金額
              </Label>
              <p className="mt-1 text-lg font-bold text-green-600">
                $
                {parseInt(selectedItem.paidAmount || "0").toLocaleString()}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">
                剩餘金額
              </Label>
              <p className="mt-1 text-lg font-bold text-red-600">
                ${remainingAmount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 日期資訊 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">
                開始日期
              </Label>
              <p className="mt-1 text-sm text-gray-900">
                {selectedItem.startDate}
              </p>
            </div>
            {selectedItem.endDate && (
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  結束日期
                </Label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedItem.endDate}
                </p>
              </div>
            )}
          </div>

          {/* 備註 */}
          {selectedItem.notes && (
            <div>
              <Label className="text-sm font-medium text-gray-700">備註</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-900">{selectedItem.notes}</p>
              </div>
            </div>
          )}

          {/* 付款記錄 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">
                付款記錄
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRecords(!showRecords)}
                className="flex items-center gap-2"
              >
                <Receipt className="w-4 h-4" />
                {showRecords ? "隱藏記錄" : "查看記錄"}
              </Button>
            </div>

            {showRecords && (
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                {itemRecords.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">尚無付款記錄</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {itemRecords.map((record) => (
                      <div
                        key={record.id}
                        className="p-3 hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="secondary"
                                className="text-xs"
                              >
                                {record.paymentMethod || "未知"}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {new Date(
                                  record.paymentDate
                                ).toLocaleDateString()}
                              </span>
                            </div>
                            {record.notes && (
                              <p className="text-sm text-gray-600 mb-1">
                                {record.notes}
                              </p>
                            )}
                            {record.receiptImageUrl && (
                              <p className="text-xs text-blue-600">
                                有收據圖片
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-green-600">
                              +$
                              {parseInt(
                                record.amountPaid
                              ).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(
                                record.createdAt || ""
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 時間戳 */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <Label className="text-sm font-medium text-gray-700">
                創建時間
              </Label>
              <p className="mt-1 text-xs text-gray-500">
                {selectedItem.createdAt
                  ? new Date(selectedItem.createdAt).toLocaleString()
                  : "未知"}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">
                更新時間
              </Label>
              <p className="mt-1 text-xs text-gray-500">
                {selectedItem.updatedAt
                  ? new Date(selectedItem.updatedAt).toLocaleString()
                  : "未知"}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
