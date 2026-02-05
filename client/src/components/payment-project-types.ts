// 專案付款管理 - 共用型別定義

import { z } from "zod";

export type PaymentItem = {
  id: number;
  itemName: string;
  totalAmount: string;
  paidAmount: string;
  status: string;
  paymentType: string;
  startDate: string;
  endDate?: string;
  priority: number;
  categoryName?: string;
  projectName?: string;
  fixedCategoryId?: number;
  categoryId?: number;
  projectId?: number;
};

export type PaymentProject = {
  id: number;
  projectName: string;
  projectType: string;
  description?: string;
  isActive: boolean;
};

export const paymentSchema = z.object({
  amount: z.string().min(1, "請輸入付款金額"),
  paymentDate: z.string().min(1, "請選擇付款日期"),
  paymentMethod: z.string().min(1, "請選擇付款方式"),
  note: z.string().optional(),
  receiptImage: z.any().optional(),
});

export const editItemSchema = z.object({
  itemName: z.string().min(1, "請輸入項目名稱"),
  totalAmount: z.string().min(1, "請輸入總金額"),
  startDate: z.string().min(1, "請選擇開始日期"),
  endDate: z.string().optional(),
  priority: z.string().min(1, "請選擇優先級"),
  notes: z.string().optional(),
  paymentType: z.string().min(1, "請選擇付款類型"),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;
export type EditItemFormValues = z.infer<typeof editItemSchema>;

// 統計資料型別
export interface PaymentStats {
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  paidCount: number;
  totalCount: number;
  installment: {
    total: number;
    paid: number;
    inProgress: number;
    dueThisMonth: number;
    completionRate: number;
  };
}

// 取得狀態標籤的輔助函數
export function getStatusBadgeConfig(item: PaymentItem) {
  const getOverdueDays = () => {
    const itemDate = new Date(item.paymentType === "single" ? item.startDate : (item.endDate || item.startDate));
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (itemDate < today && item.status !== "paid") {
      const diffTime = today.getTime() - itemDate.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return 0;
  };

  const overdueDays = getOverdueDays();

  const statusConfig = {
    paid: {
      label: "已付清",
      variant: "default" as const,
      className: "status-indicator status-paid"
    },
    partial: {
      label: overdueDays > 0 ? `部分付款 (逾期${overdueDays}天)` : "部分付款",
      variant: "secondary" as const,
      className: overdueDays > 0 ? "status-indicator status-overdue" : "status-indicator status-pending"
    },
    unpaid: {
      label: overdueDays > 0 ? `未付款 (逾期${overdueDays}天)` : "未付款",
      variant: "destructive" as const,
      className: overdueDays > 0
        ? "status-indicator status-overdue animate-pulse"
        : "status-indicator status-overdue"
    },
    pending: {
      label: overdueDays > 0 ? `待付款 (逾期${overdueDays}天)` : "待付款",
      variant: "outline" as const,
      className: overdueDays > 0 ? "status-indicator status-overdue" : "status-indicator status-pending"
    },
  };

  return statusConfig[item.status as keyof typeof statusConfig] || statusConfig.unpaid;
}
