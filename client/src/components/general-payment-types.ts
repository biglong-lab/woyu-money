// 一般付款管理共用型別

export type PaymentItem = {
  id: number;
  itemName: string;
  totalAmount: string;
  categoryId?: number;
  projectId: number;
  paymentType: "monthly" | "installment" | "single";
  startDate: string;
  endDate?: string;
  installmentMonths?: number;
  paidAmount: string;
  status: string;
  notes?: string;
  fixedCategoryId?: number;
  createdAt: string;
  updatedAt: string;
  // 項目來源追蹤
  source?: 'manual' | 'ai_scan';
  sourceDocumentId?: number;
  documentUploadedAt?: string;
  documentUploadedByUserId?: number;
  documentUploadedByUsername?: string;
  archivedByUserId?: number;
  archivedByUsername?: string;
  archivedAt?: string;
  // 計算屬性
  categoryName?: string;
  projectName?: string;
  projectType?: string;
};

export type DebtCategory = {
  id: number;
  categoryName: string;
  categoryType: string;
};

export type PaymentProject = {
  id: number;
  projectName: string;
  projectType: string;
};

export type FixedCategory = {
  id: number;
  categoryName: string;
  categoryType: string;
};

export type CategoryWithSource = {
  id: number;
  categoryName: string;
  categoryType: string;
  source: string;
};

// 統計資料型別
export interface GeneralPaymentStatistics {
  totalItems: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  unpaidItems: number;
  urgentItems: number;
  overdueItems: number;
  monthlyDue: number;
  monthlyPaid: number;
  monthlyUnpaid: number;
  overdueUnpaid: number;
}

// 篩選狀態計數
export interface StatusCounts {
  pending: number;
  paid: number;
  overdue: number;
  thisMonth: number;
}
