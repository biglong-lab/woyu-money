// 一般付款管理 - 詳情對話框元件
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Clock,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Receipt,
  Calendar,
  Image,
  DollarSign,
  CreditCard,
} from "lucide-react";
import type { PaymentItem } from "./general-payment-types";
import type { AuditLog } from "@shared/schema";

// 付款紀錄型別
interface PaymentRecordData {
  id: number;
  itemId: number;
  amount?: string;
  amountPaid?: string;
  paymentDate: string;
  paymentMethod?: string;
  notes?: string;
  receiptImageUrl?: string;
  receiptText?: string;
  isPartialPayment?: boolean;
  createdAt?: string;
}

// 付款方式中文對照
const PAYMENT_METHOD_MAP: Record<string, string> = {
  bank_transfer: "銀行轉帳",
  cash: "現金",
  credit_card: "信用卡",
  digital_payment: "數位支付",
  check: "支票",
  other: "其他",
};

function getPaymentMethodText(method: string): string {
  return PAYMENT_METHOD_MAP[method] || method || "未指定";
}

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
  const [showPaymentRecords, setShowPaymentRecords] = useState(true);

  // 獲取付款紀錄
  const { data: paymentRecords = [], isLoading: isLoadingRecords } = useQuery<
    PaymentRecordData[]
  >({
    queryKey: ["/api/payment/items", detailItem?.id, "records"],
    queryFn: async () => {
      if (!detailItem?.id) return [];
      const response = await fetch(
        `/api/payment/items/${detailItem.id}/records`
      );
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isOpen && !!detailItem?.id,
    staleTime: 30000,
  });

  // 獲取審計日誌
  const { data: auditLogs = [], isLoading: isLoadingAuditLogs } = useQuery<
    AuditLog[]
  >({
    queryKey: [`/api/payment/items/${detailItem?.id}/audit-logs`],
    enabled: !!detailItem && showAuditHistory,
  });

  // 計算付款進度
  const totalAmount = parseFloat(detailItem?.totalAmount || "0");
  const paidAmount = parseFloat(detailItem?.paidAmount || "0");
  const remainingAmount = totalAmount - paidAmount;
  const progressPercent =
    totalAmount > 0 ? Math.min((paidAmount / totalAmount) * 100, 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {detailItem?.itemName || "付款項目詳情"}
          </DialogTitle>
        </DialogHeader>
        {detailItem && (
          <div className="space-y-4">
            {/* 付款進度條 */}
            <PaymentProgressBar
              totalAmount={totalAmount}
              paidAmount={paidAmount}
              remainingAmount={remainingAmount}
              progressPercent={progressPercent}
              status={detailItem.status}
            />

            {/* 基本資訊 */}
            <div className="grid grid-cols-2 gap-4">
              <InfoField label="專案" value={detailItem.projectName || "無"} />
              <InfoField
                label="分類"
                value={detailItem.categoryName || "無"}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InfoField
                label="預計付款日期"
                value={
                  detailItem.startDate
                    ? new Date(detailItem.startDate).toLocaleDateString("zh-TW")
                    : "未設定"
                }
              />
              <div>
                <Label className="text-sm font-medium text-gray-500">
                  付款狀態
                </Label>
                <div className="mt-1">
                  <StatusBadge status={detailItem.status} />
                </div>
              </div>
            </div>

            {detailItem.notes && (
              <div>
                <Label className="text-sm font-medium text-gray-500">
                  項目備註
                </Label>
                <p className="mt-1 p-3 bg-gray-50 rounded whitespace-pre-wrap text-sm">
                  {detailItem.notes}
                </p>
              </div>
            )}

            {/* 付款紀錄區塊 */}
            <div className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPaymentRecords(!showPaymentRecords)}
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  付款紀錄
                  {paymentRecords.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-xs px-1.5 py-0"
                    >
                      {paymentRecords.length}
                    </Badge>
                  )}
                </span>
                {showPaymentRecords ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>

              {showPaymentRecords && (
                <PaymentRecordsList
                  records={paymentRecords}
                  isLoading={isLoadingRecords}
                />
              )}
            </div>

            {/* 項目來源追蹤區塊 */}
            <SourceTrackingSection detailItem={detailItem} />

            {/* 操作歷史記錄區塊 */}
            <div className="border-t pt-4">
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
                {showAuditHistory ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
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
          <Button onClick={() => onOpenChange(false)}>關閉</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 簡易資訊欄位
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-sm font-medium text-gray-500">{label}</Label>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

// 狀態 Badge
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    paid: { label: "已付款", variant: "default" },
    partial: { label: "部分付款", variant: "outline" },
    overdue: { label: "逾期", variant: "destructive" },
    pending: { label: "未付款", variant: "secondary" },
  };
  const { label, variant } = config[status] || { label: "未付款", variant: "secondary" };
  return <Badge variant={variant}>{label}</Badge>;
}

// 付款進度條
function PaymentProgressBar({
  totalAmount,
  paidAmount,
  remainingAmount,
  progressPercent,
  status,
}: {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  progressPercent: number;
  status: string;
}) {
  return (
    <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-transparent">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">付款進度</span>
          <StatusBadge status={status} />
        </div>
        <Progress value={progressPercent} className="h-2" />
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-0.5 flex items-center justify-center gap-1">
              <DollarSign className="w-3 h-3" />
              總金額
            </div>
            <p className="font-bold">NT${totalAmount.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <div className="text-xs text-green-600 mb-0.5 flex items-center justify-center gap-1">
              <DollarSign className="w-3 h-3" />
              已付款
            </div>
            <p className="font-bold text-green-600">
              NT${paidAmount.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <div className="text-xs text-red-600 mb-0.5 flex items-center justify-center gap-1">
              <DollarSign className="w-3 h-3" />
              待付款
            </div>
            <p className="font-bold text-red-600">
              NT${Math.max(0, remainingAmount).toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 付款紀錄列表
function PaymentRecordsList({
  records,
  isLoading,
}: {
  records: PaymentRecordData[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm text-gray-500">載入付款紀錄...</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400">
        <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">尚無付款紀錄</p>
      </div>
    );
  }

  const sorted = [...records].sort(
    (a, b) =>
      new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  );

  return (
    <div className="mt-3 space-y-3">
      {sorted.map((record) => (
        <PaymentRecordCard key={record.id} record={record} />
      ))}
    </div>
  );
}

// 單筆付款紀錄卡片
function PaymentRecordCard({ record }: { record: PaymentRecordData }) {
  const amount = parseFloat(
    record.amount || record.amountPaid || "0"
  );

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        {/* 第一行：金額與日期 */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              {getPaymentMethodText(record.paymentMethod || "")}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Calendar className="w-3 h-3" />
              {new Date(record.paymentDate).toLocaleDateString("zh-TW")}
            </span>
            {record.isPartialPayment && (
              <Badge variant="secondary" className="text-xs">
                部分付款
              </Badge>
            )}
          </div>
          <p className="font-bold text-green-600 text-lg whitespace-nowrap ml-2">
            +NT${amount.toLocaleString()}
          </p>
        </div>

        {/* 備註 */}
        {record.notes && (
          <div className="mb-2 p-2 bg-gray-50 rounded text-sm text-gray-700 whitespace-pre-wrap">
            {record.notes}
          </div>
        )}

        {/* 收據圖片 */}
        {record.receiptImageUrl && (
          <div className="mb-2">
            <Dialog>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200 hover:bg-blue-100 transition-colors w-full text-left">
                  <Image className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm text-blue-700">查看付款憑證</span>
                  <img
                    src={record.receiptImageUrl}
                    alt="收據縮圖"
                    className="w-10 h-10 object-cover rounded ml-auto border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    付款憑證 -{" "}
                    {new Date(record.paymentDate).toLocaleDateString("zh-TW")}
                  </DialogTitle>
                </DialogHeader>
                <div className="flex justify-center">
                  <img
                    src={record.receiptImageUrl}
                    alt="付款憑證"
                    className="max-w-full max-h-[60vh] object-contain rounded-lg border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWcluePh+eEoeazleaoquWFpTwvdGV4dD48L3N2Zz4=";
                    }}
                  />
                </div>
                {/* AI 辨識文字 */}
                {record.receiptText && (
                  <div className="mt-3 p-3 bg-gray-50 rounded border text-sm">
                    <p className="text-xs text-gray-500 mb-1 font-medium">
                      AI 辨識內容：
                    </p>
                    <p className="whitespace-pre-wrap text-gray-700">
                      {record.receiptText}
                    </p>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* 建立時間 */}
        {record.createdAt && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            紀錄建立於{" "}
            {new Date(record.createdAt).toLocaleString("zh-TW")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// 來源追蹤區塊
function SourceTrackingSection({
  detailItem,
}: {
  detailItem: PaymentItem;
}) {
  return (
    <div className="border-t pt-4">
      <Label className="text-sm font-medium text-gray-500 block mb-2">
        項目來源
      </Label>
      <div className="p-3 bg-gray-50 rounded space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">來源類型：</span>
          {detailItem.source === "ai_scan" ? (
            <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
              <span className="mr-1">AI</span>掃描歸檔
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-700">手動新增</Badge>
          )}
        </div>
        {detailItem.source === "ai_scan" && (
          <>
            {detailItem.documentUploadedByUsername && (
              <div className="text-sm">
                <span className="font-medium">單據上傳者：</span>
                <span>{detailItem.documentUploadedByUsername}</span>
                {detailItem.documentUploadedAt && (
                  <span className="text-gray-500 ml-2">
                    (
                    {new Date(
                      detailItem.documentUploadedAt
                    ).toLocaleString("zh-TW")}
                    )
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
                    (
                    {new Date(detailItem.archivedAt).toLocaleString(
                      "zh-TW"
                    )}
                    )
                  </span>
                )}
              </div>
            )}
            {detailItem.sourceDocumentId && (
              <div className="text-sm text-gray-500">
                <span className="font-medium">來源單據ID：</span>#
                {detailItem.sourceDocumentId}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// 審計歷史列表
function AuditHistoryList({
  auditLogs,
  isLoading,
}: {
  auditLogs: AuditLog[];
  isLoading: boolean;
}) {
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
          <div
            key={log.id}
            className="border rounded-lg p-3 text-sm bg-gray-50"
          >
            <div className="flex items-center justify-between mb-1">
              <Badge
                variant={
                  log.action === "CREATE"
                    ? "default"
                    : log.action === "UPDATE"
                      ? "secondary"
                      : log.action === "DELETE"
                        ? "destructive"
                        : log.action === "RESTORE"
                          ? "default"
                          : "outline"
                }
              >
                {log.action === "CREATE"
                  ? "建立"
                  : log.action === "UPDATE"
                    ? "更新"
                    : log.action === "DELETE"
                      ? "刪除"
                      : log.action === "RESTORE"
                        ? "恢復"
                        : log.action === "PERMANENT_DELETE"
                          ? "永久刪除"
                          : log.action}
              </Badge>
              <span className="text-xs text-gray-500">
                {log.createdAt
                  ? new Date(log.createdAt).toLocaleString("zh-TW")
                  : "未知時間"}
              </span>
            </div>
            <div className="text-gray-600">
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
