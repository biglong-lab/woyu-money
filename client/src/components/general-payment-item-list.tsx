// 一般付款管理 - 項目列表元件
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, DollarSign, RefreshCw } from "lucide-react";
import type { PaymentItem, PaymentProject, CategoryWithSource } from "./general-payment-types";

export interface GeneralPaymentItemListProps {
  filteredItems: PaymentItem[];
  generalItems: PaymentItem[];
  projects: PaymentProject[];
  allCategories: CategoryWithSource[];
  onViewDetails: (item: PaymentItem) => void;
  onEdit: (item: PaymentItem) => void;
  onPayment: (item: PaymentItem) => void;
  onDelete: (item: PaymentItem) => void;
  onRefreshData: () => void;
  onResetAllFilters: () => void;
  onApplyQuickFilter: (filterType: string) => void;
}

// 優先級標籤
function getPriorityBadge(item: PaymentItem) {
  // 已付款項目不顯示優先級標籤
  if (item.status === "paid") return null;

  const today = new Date();
  const startDate = new Date(item.startDate);
  const daysDiff = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    return <Badge variant="destructive">逾期 {Math.abs(daysDiff)} 天</Badge>;
  } else if (daysDiff <= 7) {
    return <Badge variant="secondary" className="bg-orange-100 text-orange-800">急迫 {daysDiff} 天內</Badge>;
  }
  return null;
}

export function GeneralPaymentItemList({
  filteredItems,
  generalItems,
  projects,
  allCategories,
  onViewDetails,
  onEdit,
  onPayment,
  onDelete,
  onRefreshData,
  onResetAllFilters,
  onApplyQuickFilter,
}: GeneralPaymentItemListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>一般付款項目列表</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            顯示 {filteredItems.length} / {generalItems.length} 項目
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={onRefreshData}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            重新載入
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <EmptyState
              generalItemsCount={generalItems.length}
              onResetAllFilters={onResetAllFilters}
              onApplyQuickFilter={onApplyQuickFilter}
            />
          ) : (
            filteredItems.map((item) => (
              <PaymentItemRow
                key={item.id}
                item={item}
                projects={projects}
                allCategories={allCategories}
                onViewDetails={onViewDetails}
                onEdit={onEdit}
                onPayment={onPayment}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// 空狀態元件
interface EmptyStateProps {
  generalItemsCount: number;
  onResetAllFilters: () => void;
  onApplyQuickFilter: (filterType: string) => void;
}

function EmptyState({ generalItemsCount, onResetAllFilters, onApplyQuickFilter }: EmptyStateProps) {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
      <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
      <p className="text-lg font-medium mb-2 text-gray-600">
        {generalItemsCount === 0 ? "尚無付款項目" : "找不到符合條件的項目"}
      </p>
      <p className="text-gray-500 mb-4">
        {generalItemsCount === 0
          ? "點擊右上角「新增付款項目」開始建立您的付款項目"
          : `共有 ${generalItemsCount} 筆付款項目，但目前篩選條件沒有匹配結果`}
      </p>
      {generalItemsCount > 0 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onResetAllFilters}
            className="flex items-center gap-2"
            data-testid="btn-reset-filters-empty"
          >
            <RefreshCw className="w-4 h-4" />
            重置所有篩選
          </Button>
          <span className="text-sm text-gray-400">或</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApplyQuickFilter("pending")}
            className="flex items-center gap-2"
            data-testid="btn-quick-pending-empty"
          >
            查看待付款項目
          </Button>
        </div>
      )}
    </div>
  );
}

// 單筆項目列元件
interface PaymentItemRowProps {
  item: PaymentItem;
  projects: PaymentProject[];
  allCategories: CategoryWithSource[];
  onViewDetails: (item: PaymentItem) => void;
  onEdit: (item: PaymentItem) => void;
  onPayment: (item: PaymentItem) => void;
  onDelete: (item: PaymentItem) => void;
}

function PaymentItemRow({
  item,
  projects,
  allCategories,
  onViewDetails,
  onEdit,
  onPayment,
  onDelete,
}: PaymentItemRowProps) {
  const project = projects.find(p => p.id === item.projectId);
  const category = allCategories.find(c => c.id === item.categoryId || c.id === item.fixedCategoryId);
  const isPaid = item.status === "paid";
  const isOverdue = !isPaid && item.startDate && new Date(item.startDate) < new Date();

  return (
    <div
      className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${
        isPaid ? "border-green-200 bg-green-50" :
        isOverdue ? "border-red-200 bg-red-50" : "border-gray-200"
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-medium text-lg">{item.itemName}</h3>
            <Badge variant="secondary" className="bg-green-100 text-green-800">一般付款</Badge>
            {item.source === 'ai_scan' ? (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 border border-purple-300">
                <span className="mr-1">AI</span>掃描
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                手動新增
              </Badge>
            )}
            {isPaid && <Badge variant="default" className="bg-green-600">已付款</Badge>}
            {getPriorityBadge(item)}
          </div>

          <div className="grid md:grid-cols-4 gap-4 text-sm text-gray-600 mb-2">
            <div>
              <span className="font-medium">專案：</span>
              {project?.projectName || "無"}
            </div>
            <div>
              <span className="font-medium">分類：</span>
              {category ? `${category.categoryName} (${category.source})` : "無"}
            </div>
            <div>
              <span className="font-medium">到期日：</span>
              {item.startDate ? new Date(item.startDate).toLocaleDateString('zh-TW') : '未設定'}
            </div>
          </div>

          {item.notes && (
            <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded mt-2">
              <strong>備註：</strong>{item.notes}
            </div>
          )}
        </div>

        <div className="text-right ml-4 min-w-[200px]">
          <div className="space-y-1 mb-3">
            <div className="text-sm text-gray-600">
              <span className="font-medium">應付總額：</span>NT${parseFloat(item.totalAmount).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">應付餘款：</span>NT${(parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0")).toLocaleString()}
            </div>
            <div className="text-sm text-red-600">
              <span className="font-medium">累積應付未付：</span>NT${(parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0")).toLocaleString()}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(item)}
                className="flex-1"
              >
                <FileText className="w-4 h-4 mr-1" />
                詳細
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(item)}
                className="flex-1"
              >
                編輯
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => onPayment(item)}
                className="bg-green-600 hover:bg-green-700 text-white flex-1"
                disabled={isPaid}
              >
                <DollarSign className="w-4 h-4 mr-1" />
                {isPaid ? "已付款" : "付款"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(item)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                刪除
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
