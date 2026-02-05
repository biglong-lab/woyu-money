import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Edit, Trash2, Activity, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import type { PaymentItem } from "./types";
import { statusColors } from "./types";

// ========================================
// 付款項目列表元件
// ========================================

/** 狀態對應的圖示 */
const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  partial: AlertCircle,
  paid: CheckCircle2,
  overdue: AlertCircle,
};

interface PaymentItemListProps {
  /** 篩選後的項目列表 */
  filteredItems: PaymentItem[];
  /** 全部項目數量（用於顯示總數） */
  totalItemsCount: number;
  /** 編輯項目處理 */
  onEditItem: (item: PaymentItem) => void;
  /** 刪除項目處理 */
  onDeleteItem: (id: number, reason: string) => void;
}

/** 取得狀態 Badge（含圖示和文字） */
function getStatusBadge(status: string) {
  const Icon = statusIcons[status] || Clock;
  return (
    <Badge className={statusColors[status] || statusColors.pending}>
      <Icon className="w-3 h-3 mr-1" />
      {status === 'pending' ? '待付款' :
       status === 'partial' ? '部分付款' :
       status === 'paid' ? '已付款' : '逾期'}
    </Badge>
  );
}

/** 項目管理頁籤：顯示付款項目列表，支援編輯和刪除 */
export function PaymentItemList({
  filteredItems,
  totalItemsCount,
  onEditItem,
  onDeleteItem,
}: PaymentItemListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>付款項目列表</CardTitle>
        <CardDescription>
          顯示 {filteredItems.length} 項結果，共 {totalItemsCount} 項記錄
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {/* 項目資訊 */}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium">{item.itemName}</h3>
                  {getStatusBadge(item.status)}
                  {item.isDeleted && (
                    <Badge variant="destructive">已刪除</Badge>
                  )}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  <span>{item.projectName} • {item.categoryName}</span>
                  <span className="ml-4">
                    NT$ {parseFloat(item.paidAmount || "0").toLocaleString()} / {parseFloat(item.totalAmount).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.startDate} {item.endDate && `- ${item.endDate}`}
                </div>
              </div>

              {/* 操作按鈕 */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => onEditItem(item)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>確認刪除</AlertDialogTitle>
                      <AlertDialogDescription>
                        確定要刪除項目「{item.itemName}」嗎？此操作無法撤銷。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDeleteItem(item.id, "手動刪除項目")}
                      >
                        確認刪除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}

          {/* 空狀態 */}
          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>沒有找到符合條件的項目</p>
              <p className="text-sm">請調整篩選條件或新增付款項目</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
