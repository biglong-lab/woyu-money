import { z } from "zod";

// ========================================
// Schema 定義
// ========================================

/** 付款項目表單驗證 Schema */
export const paymentItemSchema = z.object({
  categoryId: z.number(),
  projectId: z.number(),
  itemName: z.string().min(1, "項目名稱為必填"),
  totalAmount: z.string().min(1, "金額為必填"),
  paymentType: z.enum(["single", "recurring", "installment"]),
  startDate: z.string().min(1, "開始日期為必填"),
  endDate: z.string().optional(),
  recurringInterval: z.string().optional(),
  installmentCount: z.number().optional(),
  priority: z.number().default(1),
  notes: z.string().optional(),
});

/** 專案表單驗證 Schema */
export const projectSchema = z.object({
  projectName: z.string().min(1, "專案名稱為必填"),
  projectType: z.enum(["general", "business", "personal", "investment"]),
  description: z.string().optional(),
});

// ========================================
// 型別定義
// ========================================

/** 付款項目型別 */
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
  projectId?: number;
  categoryId?: number;
  notes?: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/** 付款專案型別 */
export type PaymentProject = {
  id: number;
  projectName: string;
  projectType: string;
  description?: string;
  isActive: boolean;
};

/** 審計日誌型別 */
export interface AuditLog {
  id: number;
  tableName: string;
  recordId: number;
  action: string;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  changedFields: string[];
  userId?: number;
  userInfo?: string;
  changeReason?: string;
  createdAt: string;
}

/** 關鍵指標型別 */
export interface KeyMetrics {
  totalPlanned: number;
  totalPaid: number;
  totalPending: number;
  completionRate: number;
  totalItems: number;
  overdueItems: number;
  pendingItems: number;
  paidItems: number;
}

/** 專案統計型別 */
export interface ProjectBreakdownItem {
  name: string;
  planned: number;
  paid: number;
  pending: number;
  count: number;
  completionRate: number;
}

// ========================================
// 常數定義
// ========================================

/** 狀態對應的樣式 */
export const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  partial: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

/** 圖表配色 */
export const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
