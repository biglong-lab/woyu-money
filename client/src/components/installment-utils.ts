// 分期付款管理共用工具函式

import type { PaymentItem, AnalyzedInstallmentItem, InstallmentStats, PaymentCalculation } from "./installment-types";

/**
 * 分析單一分期項目，計算期數進度、金額、狀態等
 */
export function analyzeInstallmentItem(item: PaymentItem): AnalyzedInstallmentItem {
  // 從項目名稱解析分期資訊
  const installmentMatch = item.itemName.match(/第(\d+)期\/共(\d+)期/);
  const currentPeriod = installmentMatch ? parseInt(installmentMatch[1]) : 1;
  const totalPeriods = installmentMatch ? parseInt(installmentMatch[2]) : 1;

  // 提取基本專案名稱
  const baseName = item.itemName.replace(/\s*\(第\d+期\/共\d+期\)/, "");

  // 使用 startDate 計算正確到期日
  const startDateValue = item.startDate || new Date().toISOString().split("T")[0];
  const dueDate = new Date(startDateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 付款狀態計算
  const paidAmount = parseFloat(item.paidAmount || "0");
  const totalAmount = parseFloat(item.totalAmount || "0");
  const remainingAmount = totalAmount - paidAmount;
  const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
  const isPaid = progress >= 100;

  // 狀態判斷
  const isOverdue = !isPaid && daysUntilDue < 0;
  const isDueSoon = !isPaid && daysUntilDue >= 0 && daysUntilDue <= 7;

  // 從備註解析專案總額
  const notesMatch = item.notes?.match(/總費用\s*=\s*([\d,]+)/);
  const projectTotalAmount = notesMatch
    ? parseInt(notesMatch[1].replace(/,/g, ""))
    : totalAmount * totalPeriods;

  // 計算期數進度
  const periodProgress = (currentPeriod / totalPeriods) * 100;
  const paidPeriods = isPaid ? currentPeriod : Math.max(0, currentPeriod - 1);
  const remainingPeriods = totalPeriods - paidPeriods;

  // 每期金額
  const monthlyAmount = totalAmount;
  const averageMonthlyAmount = projectTotalAmount / totalPeriods;

  return {
    ...item,
    currentPeriod,
    totalPeriods,
    baseName,
    dueDate,
    daysUntilDue,
    paidAmount,
    totalAmount,
    remainingAmount,
    progress,
    periodProgress,
    isPaid,
    isOverdue,
    isDueSoon,
    projectTotalAmount,
    paidPeriods,
    remainingPeriods,
    monthlyAmount,
    averageMonthlyAmount,
    status: isPaid ? "paid" : isOverdue ? "overdue" : isDueSoon ? "due-soon" : "normal",
  };
}

/**
 * 計算分期付款統計資料
 */
export function calculateInstallmentStats(paymentItems: PaymentItem[]): InstallmentStats {
  const installmentItems = paymentItems.filter(
    (item) => item.paymentType === "installment"
  );
  const total = installmentItems.length;

  const today = new Date();

  let dueSoon = 0;
  let overdue = 0;
  let completed = 0;
  let totalAmount = 0;
  let paidAmount = 0;

  installmentItems.forEach((item) => {
    const dueDate = new Date(item.dueDate);
    const isPaid =
      parseFloat(item.paidAmount || "0") >= parseFloat(item.totalAmount || "0");

    totalAmount += parseFloat(item.totalAmount || "0");
    paidAmount += parseFloat(item.paidAmount || "0");

    if (isPaid) {
      completed++;
    } else {
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilDue < 0) {
        overdue++;
      } else if (daysUntilDue <= 7) {
        dueSoon++;
      }
    }
  });

  const averageProgress = total > 0 ? (paidAmount / totalAmount) * 100 : 0;

  return {
    total,
    dueSoon,
    overdue,
    completed,
    totalAmount,
    paidAmount,
    remainingAmount: totalAmount - paidAmount,
    averageProgress: Math.round(averageProgress * 10) / 10,
  };
}

/**
 * 分期付款計算邏輯（頭期含零頭）
 */
export function calculateInstallmentPayments(
  totalAmount: number,
  months: number
): PaymentCalculation {
  if (!totalAmount || !months || months <= 0) {
    return { monthlyAmount: 0, firstPayment: 0, calculations: [] };
  }

  const monthlyAmount = Math.floor(totalAmount / months);
  const remainder = totalAmount - monthlyAmount * months;
  const firstPayment = monthlyAmount + remainder;

  const calculations = [];
  for (let i = 1; i <= months; i++) {
    calculations.push({
      period: i,
      amount: i === 1 ? firstPayment : monthlyAmount,
      type: i === 1 ? "頭期（含零頭）" : "一般期數",
    });
  }

  return { monthlyAmount, firstPayment, calculations };
}

/**
 * 計算付款進度百分比
 */
export function calculateProgress(item: PaymentItem): number {
  const paid = parseFloat(item.paidAmount) || 0;
  const total = parseFloat(item.totalAmount) || 0;
  return total > 0 ? (paid / total) * 100 : 0;
}
