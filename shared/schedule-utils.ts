/**
 * 排程計算工具（前後端共用）
 * 包含：
 * - 付款優先級計算引擎
 * - 智慧排程建議
 * - 逾期重排邏輯
 */

// 付款項目類型（簡化版）
export interface ScheduleItem {
  id: number;
  itemName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  paymentType?: string;     // single, monthly, installment
  categoryType?: string;    // rent, insurance, utility, installment, general
  isOverdue: boolean;
  overdueDays: number;
  hasLateFee: boolean;
  projectName?: string;
}

// 優先級結果
export interface PrioritizedItem extends ScheduleItem {
  priority: number;
  priorityLevel: "critical" | "high" | "medium" | "low";
  reason: string;
}

// 排程建議
export interface ScheduleSuggestion {
  date: string;
  items: PrioritizedItem[];
  dailyTotal: number;
}

// 智慧排程結果
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

// 計算付款優先級
export function calculatePriority(item: ScheduleItem): PrioritizedItem {
  let priority = 0;
  const reasons: string[] = [];

  // 逾期最高優先
  if (item.isOverdue) {
    priority += 100;
    reasons.push(`逾期${item.overdueDays}天`);
  }

  // 會產生罰款的優先
  if (item.hasLateFee) {
    priority += 80;
    reasons.push("有罰款風險");
  }

  // 租金不可拖延
  if (item.categoryType === "rent") {
    priority += 60;
    reasons.push("租金合約");
  }

  // 勞健保不可拖延
  if (item.categoryType === "insurance") {
    priority += 50;
    reasons.push("勞健保費");
  }

  // 即將到期（3天內）
  if (item.dueDate) {
    const now = new Date();
    const due = new Date(item.dueDate);
    const daysUntilDue = Math.ceil(
      (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDue >= 0 && daysUntilDue <= 3) {
      priority += 40;
      reasons.push("3天內到期");
    } else if (daysUntilDue >= 4 && daysUntilDue <= 7) {
      priority += 20;
      reasons.push("7天內到期");
    }
  }

  // 分期有合約義務
  if (item.paymentType === "installment") {
    priority += 30;
    reasons.push("分期合約");
  }

  // 月付也有一定優先性
  if (item.paymentType === "monthly") {
    priority += 15;
    reasons.push("月付項目");
  }

  // 判斷優先級等級
  let priorityLevel: PrioritizedItem["priorityLevel"];
  if (priority >= 100) {
    priorityLevel = "critical";
  } else if (priority >= 50) {
    priorityLevel = "high";
  } else if (priority >= 20) {
    priorityLevel = "medium";
  } else {
    priorityLevel = "low";
  }

  return {
    ...item,
    priority,
    priorityLevel,
    reason: reasons.join("、") || "一般項目",
  };
}

// 智慧排程建議
export function generateSmartSchedule(
  items: ScheduleItem[],
  budget: number
): SmartScheduleResult {
  // 計算所有項目的優先級
  const prioritizedItems = items
    .map(calculatePriority)
    .sort((a, b) => b.priority - a.priority);

  const totalNeeded = prioritizedItems.reduce(
    (sum, item) => sum + item.remainingAmount,
    0
  );

  // 關鍵項目（優先級 critical 和 high，必須付款）
  const criticalItems = prioritizedItems.filter(
    (item) => item.priorityLevel === "critical" || item.priorityLevel === "high"
  );

  const criticalTotal = criticalItems.reduce(
    (sum, item) => sum + item.remainingAmount,
    0
  );

  // 排程項目（在預算內按優先級排入）
  let remainingBudget = budget;
  const scheduledItems: PrioritizedItem[] = [];
  const deferredItems: PrioritizedItem[] = [];

  for (const item of prioritizedItems) {
    if (remainingBudget >= item.remainingAmount) {
      scheduledItems.push(item);
      remainingBudget -= item.remainingAmount;
    } else {
      deferredItems.push(item);
    }
  }

  return {
    budget,
    totalNeeded,
    isOverBudget: totalNeeded > budget,
    criticalItems,
    scheduledItems,
    deferredItems,
    scheduledTotal: budget - remainingBudget,
    remainingBudget,
  };
}

// 計算逾期項目重排建議
export function getOverdueRescheduleItems(
  items: ScheduleItem[]
): PrioritizedItem[] {
  return items
    .filter((item) => item.isOverdue)
    .map(calculatePriority)
    .sort((a, b) => b.priority - a.priority);
}
