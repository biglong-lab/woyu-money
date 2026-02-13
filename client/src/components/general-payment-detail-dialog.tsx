// 一般付款管理 - 詳情對話框元件
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import type { PaymentItem } from "./general-payment-types";
import type { AuditLog } from "@shared/schema";

export interface GeneralPaymentDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  detailItem: PaymentItem | null;
}

export function GeneralPaymentDetailDialog({
  isOpen,
  onOpenChange,
  detailItem,
}: GeneralPaymentDetailDialogProps) {
  const [showAuditHistory, setShowAuditHistory] = useState(false);

  // 獲取審計日誌
  const { data: auditLogs = [], isLoading: isLoadingAuditLogs } = useQuery<AuditLog[]>({
    queryKey: [`/api/payment/items/${detailItem?.id}/audit-logs`],
    enabled: !!detailItem && showAuditHistory,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>付款項目詳細資訊</DialogTitle>
        </DialogHeader>
        {detailItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">項目名稱</Label>
                <p className="text-lg font-medium">{detailItem.itemName}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">總金額</Label>
                <p className="text-lg font-medium">NT$ {parseFloat(detailItem.totalAmount).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">已付金額</Label>
                <p className="text-lg">NT$ {parseFloat(detailItem.paidAmount || "0").toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">待付金額</Label>
                <p className="text-lg text-red-600">
                  NT$ {(parseFloat(detailItem.totalAmount) - parseFloat(detailItem.paidAmount || "0")).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">專案</Label>
                <p>{detailItem.projectName || "無"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">分類</Label>
                <p>{detailItem.categoryName || "無"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">預計付款日期</Label>
                <p>{detailItem.startDate ? new Date(detailItem.startDate).toLocaleDateString('zh-TW') : '未設定'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">付款狀態</Label>
                <Badge variant={detailItem.status === "paid" ? "default" : "secondary"}>
                  {detailItem.status === "paid" ? "已付款" : "未付款"}
                </Badge>
              </div>
            </div>

            {detailItem.notes && (
              <div>
                <Label className="text-sm font-medium text-gray-500">備註</Label>
                <p className="mt-1 p-3 bg-gray-50 rounded whitespace-pre-wrap">{detailItem.notes}</p>
              </div>
            )}

            {/* 項目來源追蹤區塊 */}
            <SourceTrackingSection detailItem={detailItem} />

            {/* 操作歷史記錄區塊 */}
            <div className="border-t pt-4 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAuditHistory(!showAuditHistory)}
                className="w-full justify-between"
                data-testid="button-toggle-audit-history"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  操作歷史記錄
                </span>
                {showAuditHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>

              {showAuditHistory && (
                <AuditHistoryList
                  auditLogs={auditLogs}
                  isLoading={isLoadingAuditLogs}
                />
              )}
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            關閉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 來源追蹤區塊
function SourceTrackingSection({ detailItem }: { detailItem: PaymentItem }) {
  return (
    <div className="border-t pt-4 mt-4">
      <Label className="text-sm font-medium text-gray-500 block mb-2">項目來源</Label>
      <div className="p-3 bg-gray-50 rounded space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">來源類型：</span>
          {detailItem.source === 'ai_scan' ? (
            <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
              <span className="mr-1">AI</span>掃描歸檔
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-700">手動新增</Badge>
          )}
        </div>
        {detailItem.source === 'ai_scan' && (
          <>
            {detailItem.documentUploadedByUsername && (
              <div className="text-sm">
                <span className="font-medium">單據上傳者：</span>
                <span>{detailItem.documentUploadedByUsername}</span>
                {detailItem.documentUploadedAt && (
                  <span className="text-gray-500 ml-2">
                    ({new Date(detailItem.documentUploadedAt).toLocaleString('zh-TW')})
                  </span>
                )}
              </div>
            )}
            {detailItem.archivedByUsername && (
              <div className="text-sm">
                <span className="font-medium">歸檔操作者：</span>
                <span>{detailItem.archivedByUsername}</span>
                {detailItem.archivedAt && (
                  <span className="text-gray-500 ml-2">
                    ({new Date(detailItem.archivedAt).toLocaleString('zh-TW')})
                  </span>
                )}
              </div>
            )}
            {detailItem.sourceDocumentId && (
              <div className="text-sm text-gray-500">
                <span className="font-medium">來源單據ID：</span>#{detailItem.sourceDocumentId}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// 審計歷史列表
function AuditHistoryList({ auditLogs, isLoading }: { auditLogs: AuditLog[]; isLoading: boolean }) {
  return (
    <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm text-gray-500">載入中...</span>
        </div>
      ) : auditLogs.length === 0 ? (
        <div className="text-center py-4 text-sm text-gray-500">
          暫無操作記錄
        </div>
      ) : (
        auditLogs.map((log) => (
          <div key={log.id} className="border rounded-lg p-3 text-sm bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center justify-between mb-1">
              <Badge variant={
                log.action === "CREATE" ? "default" :
                log.action === "UPDATE" ? "secondary" :
                log.action === "DELETE" ? "destructive" :
                log.action === "RESTORE" ? "default" : "outline"
              }>
                {log.action === "CREATE" ? "建立" :
                 log.action === "UPDATE" ? "更新" :
                 log.action === "DELETE" ? "刪除" :
                 log.action === "RESTORE" ? "恢復" :
                 log.action === "PERMANENT_DELETE" ? "永久刪除" : log.action}
              </Badge>
              <span className="text-xs text-gray-500">
                {log.createdAt ? new Date(log.createdAt).toLocaleString('zh-TW') : '未知時間'}
              </span>
            </div>
            <div className="text-gray-600 dark:text-gray-300">
              <span className="font-medium">{log.userInfo}</span>
              {log.changeReason && <span> - {log.changeReason}</span>}
            </div>
            {log.changedFields && log.changedFields.length > 0 && (
              <div className="text-xs text-gray-400 mt-1">
                變更欄位: {log.changedFields.join(", ")}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
