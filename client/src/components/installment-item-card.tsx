// 分期付款項目卡片元件

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Eye, Edit, Trash2, Calculator, Plus } from "lucide-react";
import type { AnalyzedInstallmentItem, PaymentItem } from "./installment-types";

export interface InstallmentItemCardProps {
  item: AnalyzedInstallmentItem;
  onView: (item: AnalyzedInstallmentItem) => void;
  onEdit: (item: PaymentItem) => void;
  onDelete: (id: number) => void;
  isDeletePending: boolean;
}

function getPriorityBadge(item: PaymentItem) {
  const amount = parseFloat(item.totalAmount);
  if (amount >= 100000) return <Badge variant="destructive">高額</Badge>;
  if (amount >= 50000) return <Badge variant="outline">中額</Badge>;
  return <Badge variant="secondary">一般</Badge>;
}

export default function InstallmentItemCard({
  item,
  onView,
  onEdit,
  onDelete,
  isDeletePending,
}: InstallmentItemCardProps) {
  let cardStyle =
    "border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-white hover:shadow-lg";
  let statusBadge = "進行中";
  let badgeVariant: "default" | "destructive" | "outline" | "secondary" = "secondary";

  if (item.isPaid) {
    cardStyle =
      "border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white hover:shadow-lg";
    statusBadge = "已完成";
    badgeVariant = "default";
  } else if (item.isOverdue) {
    cardStyle =
      "border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-white hover:shadow-lg";
    statusBadge = "逾期";
    badgeVariant = "destructive";
  } else if (item.isDueSoon) {
    cardStyle =
      "border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white hover:shadow-lg";
    statusBadge = "即將到期";
    badgeVariant = "outline";
  }

  return (
    <Card className={`${cardStyle} transition-all duration-300`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-purple-600" />
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                分期付款
              </Badge>
              <Badge variant="outline" className="text-xs">
                {item.currentPeriod}/{item.totalPeriods} 期
              </Badge>
            </div>
            <CardTitle className="text-lg text-gray-900 leading-tight">
              {item.itemName}
            </CardTitle>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getPriorityBadge(item as unknown as PaymentItem)}
            <Badge variant={badgeVariant}>{statusBadge}</Badge>
          </div>
        </div>

        {/* 期數進度條 */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-purple-600 font-medium">期數進度</span>
            <span className="text-purple-800 font-semibold">
              {Math.round((item.currentPeriod / item.totalPeriods) * 100)}%
            </span>
          </div>
          <Progress
            value={(item.currentPeriod / item.totalPeriods) * 100}
            className="h-3 bg-purple-100"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">總金額</p>
            <p className="font-semibold text-lg">NT$ {item.totalAmount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">每期金額</p>
            <p className="font-medium">NT$ {item.totalAmount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">已付 / 總期數</p>
            <p className="font-medium">
              {item.paidPeriods || 0} / {item.totalPeriods || 6} 期
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">剩餘金額</p>
            <p className="font-medium text-orange-600">
              NT$ {item.remainingAmount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* 還款進度條 */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>還款進度</span>
            <span>{item.progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(item.progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>已付: NT$ {item.paidAmount.toLocaleString()}</span>
            <span>
              剩餘{" "}
              {item.totalPeriods -
                (item.isPaid ? item.currentPeriod : item.currentPeriod - 1)}{" "}
              期
            </span>
          </div>
        </div>

        {item.notes && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-1">備註</p>
            <p className="text-sm bg-gray-50 p-2 rounded">{item.notes}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onView(item)}>
            <Eye className="w-4 h-4 mr-1" />
            詳細
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(item as unknown as PaymentItem)}
          >
            <Edit className="w-4 h-4 mr-1" />
            編輯
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(item.id)}
            disabled={isDeletePending}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            刪除
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// 空狀態元件
export interface InstallmentEmptyStateProps {
  onCreateClick: () => void;
}

export function InstallmentEmptyState({ onCreateClick }: InstallmentEmptyStateProps) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">尚無分期項目</h3>
        <p className="text-gray-500 mb-4">開始新增您的第一個分期項目</p>
        <Button onClick={onCreateClick}>
          <Plus className="w-4 h-4 mr-2" />
          新增分期項目
        </Button>
      </CardContent>
    </Card>
  );
}
