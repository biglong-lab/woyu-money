/**
 * 統一付款管理 - 付款項目列表
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Eye } from "lucide-react";
import type { PaymentItem } from "./types";

interface PaymentItemListProps {
  /** 篩選後的付款項目 */
  items: PaymentItem[];
  /** 點擊項目回呼 */
  onItemClick: (item: PaymentItem) => void;
}

/** 判斷項目的時間狀態 */
function getItemTimeStatus(startDate: string): {
  label: string;
  variant: "destructive" | "default" | "secondary";
} {
  const itemDate = new Date(startDate);
  const now = new Date();
  const isOverdue = itemDate < now;
  const isCurrentMonth = itemDate.getMonth() === now.getMonth() &&
    itemDate.getFullYear() === now.getFullYear();

  if (isOverdue) return { label: "逾期", variant: "destructive" };
  if (isCurrentMonth) return { label: "本月", variant: "default" };
  return { label: "未來", variant: "secondary" };
}

/** 付款項目列表 */
export function PaymentItemList({ items, onItemClick }: PaymentItemListProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">沒有待付款項目</h3>
          <p className="text-gray-600">
            所選範圍內的所有項目都已完成付款
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-5">
        <CardTitle className="text-lg font-semibold text-gray-900 tracking-tight">
          包含的付款項目 ({items.length})
        </CardTitle>
        <CardDescription className="text-sm text-gray-600 mt-1">
          符合條件的待付款項目
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item) => {
            const timeStatus = getItemTimeStatus(item.startDate);

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-5 border border-gray-100 rounded-lg hover:border-gray-200 hover:bg-gray-50/50 transition-colors cursor-pointer"
                onClick={() => onItemClick(item)}
              >
                <div className="flex-1 pr-8">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-base text-gray-900">
                      {item.itemName}
                    </h4>
                    <Eye className="w-4 h-4 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    開始日期：{item.startDate}
                  </p>
                  {item.notes && (
                    <p className="text-sm text-gray-500 truncate">
                      備註：{item.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  <Badge
                    variant={timeStatus.variant}
                    className="px-3 py-1 text-xs font-medium"
                  >
                    {timeStatus.label}
                  </Badge>

                  <div className="text-right min-w-[120px]">
                    <p className="text-lg font-bold text-gray-900 leading-none mb-1">
                      NT$ {parseInt(item.totalAmount).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      已付：NT$ {parseInt(item.paidAmount || "0").toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
