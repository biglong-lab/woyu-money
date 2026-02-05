import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import type { PaymentItem } from "./types";
import { formatAmount, formatDate } from "./utils";

interface PaymentItemRowProps {
  readonly item: PaymentItem;
  readonly onPayClick: (item: PaymentItem) => void;
  // 是否為逾期項目（影響顏色樣式）
  readonly isOverdue?: boolean;
}

// 單一付款項目行（包含手機和桌面版面）
export function PaymentItemRow({
  item,
  onPayClick,
  isOverdue = false,
}: PaymentItemRowProps) {
  // 根據逾期狀態決定顏色樣式
  const amountColor = isOverdue ? "text-red-600" : "text-orange-600";
  const buttonColor = isOverdue
    ? "bg-red-600 hover:bg-red-700"
    : "bg-orange-600 hover:bg-orange-700";
  const rowBg = isOverdue
    ? "bg-red-50/30 hover:bg-red-50/50"
    : "hover:bg-gray-50";

  return (
    <div
      className={`p-4 sm:p-6 ${rowBg} transition-colors`}
    >
      {/* 手機版面 */}
      <div className="block sm:hidden space-y-3">
        <div>
          <h4 className="text-base font-medium text-gray-900 mb-2">
            {item.itemName}
          </h4>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {item.projectName}
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {item.categoryName}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                逾期
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-3">
            到期日：{formatDate(item.startDate)}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div className={isOverdue ? "text-center flex-1" : ""}>
            <p className={`text-lg font-semibold ${amountColor}`}>
              {formatAmount(item.remainingAmount)}
            </p>
            <p className="text-sm text-gray-500">
              總額 {formatAmount(item.totalAmount)}
            </p>
          </div>
          <Button
            onClick={() => onPayClick(item)}
            className={`${buttonColor} text-white px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isOverdue ? "ml-4" : ""}`}
          >
            <CreditCard className="h-4 w-4 mr-1" />
            付款
          </Button>
        </div>
      </div>

      {/* 桌面版面 */}
      <div className="hidden sm:flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-lg font-semibold text-gray-900 truncate">
              {item.itemName}
            </h4>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {item.projectName}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
              {item.categoryName}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                逾期
              </span>
            )}
          </div>
          <p className="text-base text-gray-600">
            到期日：{formatDate(item.startDate)}
          </p>
        </div>
        <div className="flex items-center gap-6 ml-4">
          <div className="text-right">
            <p className={`text-xl font-bold ${amountColor}`}>
              {formatAmount(item.remainingAmount)}
            </p>
            <p className="text-base text-gray-500">
              總額 {formatAmount(item.totalAmount)}
            </p>
          </div>
          <Button
            onClick={() => onPayClick(item)}
            className={`${buttonColor} text-white px-5 py-3 text-base font-medium rounded-lg transition-colors`}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            付款
          </Button>
        </div>
      </div>
    </div>
  );
}
