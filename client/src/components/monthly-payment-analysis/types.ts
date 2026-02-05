import { z } from "zod";

// 付款記錄表單驗證 schema
export const paymentRecordSchema = z.object({
  amount: z.string().min(1, "付款金額為必填"),
  paymentDate: z.string().min(1, "付款日期為必填"),
  paymentMethod: z.string().min(1, "付款方式為必填"),
  notes: z.string().optional(),
  receiptImage: z.any().optional(),
});

export type PaymentRecordInput = z.infer<typeof paymentRecordSchema>;

// 付款項目介面
export interface PaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  startDate: string;
  projectName: string;
  categoryName: string;
  status: string;
}

// 月度分析資料介面
export interface MonthlyAnalysis {
  currentMonth: {
    year: number;
    month: number;
    due: {
      count: number;
      totalAmount: string;
      items: PaymentItem[];
    };
    paid: {
      count: number;
      totalAmount: string;
    };
  };
  overdue: {
    count: number;
    totalAmount: string;
    items: PaymentItem[];
  };
}

// 排序方向型別
export type SortOrder = "asc" | "desc";

// 篩選與分頁狀態介面
export interface FilterState {
  searchKeyword: string;
  selectedCategory: string;
  selectedProject: string;
  sortBy: string;
  sortOrder: SortOrder;
  currentPage: number;
}
