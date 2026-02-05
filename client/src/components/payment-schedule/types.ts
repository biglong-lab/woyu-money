/**
 * 付款排程模組的共用型別定義
 */

import { z } from 'zod';

/** 付款記錄 */
export interface PaymentRecord {
  id: number;
  itemId: number;
  amount: string;
  paymentDate: string;
  paymentMethod?: string;
  notes?: string;
}

/** 排程記錄 */
export interface Schedule {
  id: number;
  paymentItemId: number;
  scheduledDate: string;
  scheduledAmount: string;
  status: string;
  notes?: string;
  isOverdue: boolean;
}

/** 當月排程記錄 */
export interface MonthSchedule {
  id: number;
  paymentItemId: number;
  scheduledDate: string;
  scheduledAmount: string;
  status: string;
  notes?: string;
  isOverdue: boolean;
}

/** 整合付款項目（含排程和付款記錄） */
export interface IntegratedPaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  actualPaid: string;
  scheduledTotal: string;
  pendingAmount: string;
  priority: number;
  startDate?: string;
  categoryName?: string;
  projectName?: string;
  paymentRecords: PaymentRecord[];
  schedules: Schedule[];       // 所有排程記錄
  monthSchedules: Schedule[];  // 當月排程記錄
  scheduleCount: number;
  recordCount: number;
  hasOverdueSchedule: boolean; // 是否有逾期未執行的排程
}

/** 智慧排程優先級項目 */
export interface PrioritizedItem {
  id: number;
  itemName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  paymentType?: string;
  categoryType?: string;
  isOverdue: boolean;
  overdueDays: number;
  hasLateFee: boolean;
  projectName?: string;
  priority: number;
  priorityLevel: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}

/** 智慧排程結果 */
export interface SmartScheduleResult {
  budget: number;
  totalNeeded: number;
  isOverBudget: boolean;
  criticalItems: PrioritizedItem[];
  scheduledItems: PrioritizedItem[];
  deferredItems: PrioritizedItem[];
  scheduledTotal: number;
  remainingBudget: number;
}

/** 項目分類結果 */
export interface CategorizedItems {
  completed: IntegratedPaymentItem[];
  overdueUnexecuted: IntegratedPaymentItem[];
  scheduledPending: IntegratedPaymentItem[];
  unscheduled: IntegratedPaymentItem[];
}

/** 統計數據 */
export interface ScheduleStats {
  totalScheduled: number;
  scheduledAmount: number;
  totalPending: number;
  overdueCount: number;
}

/** 項目狀態類型 */
export type ItemStatus = 'overdue' | 'scheduled' | 'unscheduled' | 'completed';

/** 排程表單驗證 schema */
export const scheduleFormSchema = z.object({
  scheduledAmount: z.string().min(1, '請輸入金額'),
  notes: z.string().optional(),
});

/** 排程表單資料型別 */
export type ScheduleFormData = z.infer<typeof scheduleFormSchema>;
