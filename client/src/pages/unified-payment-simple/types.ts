/**
 * 統一付款管理 - 共用型別與工具函式
 */
import type { PaymentItem, PaymentRecord, PaymentProject, DebtCategory } from "@shared/schema";

// 重新匯出供子元件使用
export type { PaymentItem, PaymentRecord, PaymentProject, DebtCategory };

/** 付款統計資料介面 */
export interface PaymentStats {
  totalAmount: number;
  overdueAmount: number;
  currentMonthAmount: number;
  futureAmount: number;
}

/** 付款方式中文對照表 */
const PAYMENT_METHOD_MAP: Record<string, string> = {
  bank_transfer: "銀行轉帳",
  cash: "現金",
  credit_card: "信用卡",
  digital_payment: "數位支付",
  check: "支票",
  other: "其他",
};

/** 取得付款方式中文文字 */
export const getPaymentMethodText = (method: string): string => {
  return PAYMENT_METHOD_MAP[method] || method || "未知方式";
};

/** 計算付款統計資料（不可變模式） */
export const calculatePaymentStats = (items: PaymentItem[]): PaymentStats => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return items.reduce<PaymentStats>(
    (acc, item) => {
      const remaining =
        parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0");
      const itemDate = new Date(item.startDate);
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;

      const isOverdue =
        itemYear < currentYear ||
        (itemYear === currentYear && itemMonth < currentMonth);
      const isCurrentMonth =
        itemYear === currentYear && itemMonth === currentMonth;

      return {
        totalAmount: acc.totalAmount + remaining,
        overdueAmount: acc.overdueAmount + (isOverdue ? remaining : 0),
        currentMonthAmount:
          acc.currentMonthAmount + (isCurrentMonth ? remaining : 0),
        futureAmount:
          acc.futureAmount +
          (!isOverdue && !isCurrentMonth ? remaining : 0),
      };
    },
    { totalAmount: 0, overdueAmount: 0, currentMonthAmount: 0, futureAmount: 0 }
  );
};
