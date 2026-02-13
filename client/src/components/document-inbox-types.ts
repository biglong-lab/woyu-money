import React from "react";
// 單據收件箱共用型別與常數
import { FileText, CreditCard, Receipt, Clock, Loader2, CheckCircle2, AlertCircle, Archive } from "lucide-react";

export interface InboxStats {
  bill: { pending: number; processing: number; recognized: number; failed: number; total: number };
  payment: { pending: number; processing: number; recognized: number; failed: number; total: number };
  invoice: { pending: number; processing: number; recognized: number; failed: number; total: number };
  totalPending: number;
}

export const DOCUMENT_TYPES = [
  { value: 'bill', label: '帳單', icon: FileText, color: 'bg-blue-100 text-blue-700', description: '需要付款的帳單' },
  { value: 'payment', label: '付款憑證', icon: CreditCard, color: 'bg-green-100 text-green-700', description: '已付款的收據' },
  { value: 'invoice', label: '發票', icon: Receipt, color: 'bg-purple-100 text-purple-700', description: '統一發票、電子發票' },
] as const;

export const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: '待處理', color: 'bg-gray-200 text-gray-800 border border-gray-300', icon: Clock },
  processing: { label: '辨識中', color: 'bg-amber-200 text-amber-900 border border-amber-300', icon: Loader2 },
  recognized: { label: '已辨識', color: 'bg-emerald-500 text-white border border-emerald-600', icon: CheckCircle2 },
  failed: { label: '辨識失敗', color: 'bg-red-500 text-white border border-red-600', icon: AlertCircle },
  archived: { label: '已歸檔', color: 'bg-blue-500 text-white border border-blue-600', icon: Archive },
};

// 取得狀態 Badge 資訊
export const getStatusConfig = (status: string | null) => {
  return STATUS_LABELS[status || 'pending'] || STATUS_LABELS.pending;
};

// 取得文件類型 Badge 資訊
export const getTypeConfig = (type: string) => {
  return DOCUMENT_TYPES.find(t => t.value === type) || DOCUMENT_TYPES[0];
};
