// 月付管理 - 項目列表元件
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Edit, Trash2 } from "lucide-react";
import type { PaymentItem, PaymentProject, DebtCategory, FixedCategory } from "./monthly-payment-types";

export interface MonthlyPaymentItemListProps {
  items: PaymentItem[];
  projects: PaymentProject[];
  categories: DebtCategory[];
  fixedCategories: FixedCategory[];
  isBatchMode: boolean;
  selectedIds: Set<number>;
  onSelectItem: (id: number, checked: boolean) => void;
  onEdit: (item: PaymentItem) => void;
  onDelete: (id: number) => void;
  isDeletePending: boolean;
}

// 金額等級標籤
function getPriorityBadge(item: PaymentItem) {
  const amount = parseFloat(item.totalAmount);
  if (amount >= 50000) return <Badge variant="destructive">高額</Badge>;
  if (amount >= 20000) return <Badge variant="outline">中額</Badge>;
  return <Badge variant="secondary">一般</Badge>;
}

export function MonthlyPaymentItemList({
  items,
  projects,
  categories,
  fixedCategories,
  isBatchMode,
  selectedIds,
  onSelectItem,
  onEdit,
  onDelete,
  isDeletePending,
}: MonthlyPaymentItemListProps) {
  if (items.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <Calendar className="w-12 h-12 text-gray-400" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">還沒有月付項目</h3>
            <p className="text-gray-500 mt-1">建立您的第一個月付項目來開始管理定期付款</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <Card
          key={item.id}
          className={`p-4 transition-all ${
            isBatchMode && selectedIds.has(item.id)
              ? 'ring-2 ring-blue-500 bg-blue-50'
              : ''
          }`}
          data-testid={`payment-item-${item.id}`}
        >
          <div className="flex items-center justify-between">
            {/* 批量模式下顯示複選框 */}
            {isBatchMode && (
              <div className="mr-4">
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={(checked) => onSelectItem(item.id, checked as boolean)}
                  data-testid={`checkbox-item-${item.id}`}
                />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{item.itemName}</h3>
                {getPriorityBadge(item)}
                <Badge variant={item.status === "paid" ? "default" : "secondary"}>
                  {item.status === "paid" ? "已付款" : "待付款"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>金額: NT$ {item.totalAmount ? parseFloat(item.totalAmount).toLocaleString() : '0'}</div>
                <div>付款日: {item.startDate || '未設定'}</div>
                <div>專案: {projects.find(p => p.id === item.projectId)?.projectName}</div>
                <div>分類: {categories.find(c => c.id === item.categoryId)?.categoryName || fixedCategories.find(c => c.id === item.fixedCategoryId)?.categoryName}</div>
              </div>
              {item.notes && (
                <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">{item.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(item)}
                data-testid={`edit-item-${item.id}`}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(item.id)}
                disabled={isDeletePending}
                data-testid={`delete-item-${item.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
