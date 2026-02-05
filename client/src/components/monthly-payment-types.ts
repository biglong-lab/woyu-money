// 月付管理共用型別

export type PaymentItem = {
  id: number;
  itemName: string;
  totalAmount: string;
  categoryId: number;
  projectId: number;
  paymentType: "monthly" | "installment" | "single";
  startDate: string;
  endDate?: string;
  paidAmount: string;
  status: string;
  notes?: string;
  fixedCategoryId?: number;
  priority: number;
  createdAt: string;
  updatedAt: string;
  // 關聯欄位
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

export type ProjectCategoryTemplate = {
  id: number;
  projectId: number;
  categoryId: number;
  templateName: string;
  accountInfo: string;
  notes: string;
};

export type FixedCategorySubOption = {
  id: number;
  fixedCategoryId: number;
  projectId: number;
  subOptionName: string;
  displayName: string;
  categoryType: string;
};
