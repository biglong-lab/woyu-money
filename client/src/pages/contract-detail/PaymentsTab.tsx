/** 付款記錄 Tab 內容 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign } from "lucide-react";
import type { PaymentItem } from "./types";

interface PaymentsTabProps {
  paymentItems: PaymentItem[] | undefined;
  isLoading: boolean;
}

/** 付款狀態文字對應 */
const STATUS_LABELS: Record<PaymentItem["status"], string> = {
  paid: "已付清",
  partial: "部分付款",
  pending: "待付款",
};

/** 付款狀態 Badge variant 對應 */
const STATUS_VARIANTS: Record<
  PaymentItem["status"],
  "default" | "secondary" | "outline"
> = {
  paid: "default",
  partial: "secondary",
  pending: "outline",
};

/** 顯示合約的相關付款記錄 */
export function PaymentsTab({ paymentItems, isLoading }: PaymentsTabProps) {
  const hasItems = Array.isArray(paymentItems) && paymentItems.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>相關付款記錄</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">載入中...</div>
        ) : hasItems ? (
          <PaymentItemsTable items={paymentItems} />
        ) : (
          <EmptyPaymentsState />
        )}
      </CardContent>
    </Card>
  );
}

/** 付款項目表格 */
function PaymentItemsTable({ items }: { items: PaymentItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>項目名稱</TableHead>
          <TableHead>總金額</TableHead>
          <TableHead>已付金額</TableHead>
          <TableHead>預計日期</TableHead>
          <TableHead>狀態</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.itemName}</TableCell>
            <TableCell>
              {parseInt(item.totalAmount || "0").toLocaleString()}
            </TableCell>
            <TableCell>
              {parseInt(item.paidAmount || "0").toLocaleString()}
            </TableCell>
            <TableCell>
              {item.startDate
                ? new Date(item.startDate).toLocaleDateString("zh-TW")
                : "-"}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANTS[item.status]}>
                {STATUS_LABELS[item.status]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** 無付款記錄時的空狀態 */
function EmptyPaymentsState() {
  return (
    <div className="text-center py-8 text-gray-500">
      <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
      <p>尚無相關付款記錄</p>
    </div>
  );
}
