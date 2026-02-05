// 專案付款管理 - 篩選排序與統計計算 Hook
// 負責：根據篩選條件過濾、排序付款項目，並計算統計資料

import { useMemo } from "react";
import type { PaymentItem, PaymentStats } from "@/components/payment-project-types";

interface UseFilteredPaymentItemsParams {
  /** 所有付款項目 */
  paymentItems: PaymentItem[];
  /** 搜尋關鍵字 */
  searchTerm: string;
  /** 選中的專案 */
  selectedProject: string;
  /** 選中的分類 */
  selectedCategory: string;
  /** 選中的狀態 */
  selectedStatus: string;
  /** 選中的付款類型 */
  selectedPaymentType: string;
  /** 日期範圍模式 */
  dateRange: string;
  /** 優先級篩選 */
  priorityFilter: string;
  /** 是否顯示已付款項目 */
  showPaidItems: boolean;
  /** 自訂開始日期 */
  startDate: string;
  /** 自訂結束日期 */
  endDate: string;
  /** 排序欄位 */
  sortBy: string;
  /** 排序方向 */
  sortOrder: string;
  /** 專案列表 */
  projects: any[] | undefined;
  /** 付款記錄 */
  paymentRecords: any;
  /** 選中的月份 */
  selectedMonth: number;
  /** 選中的年度 */
  selectedYear: number;
  /** 是否顯示已刪除項目 */
  showDeleted: boolean;
}

interface UseFilteredPaymentItemsReturn {
  /** 經過篩選和排序的項目 */
  filteredAndSortedItems: PaymentItem[];
  /** 統計資料 */
  stats: PaymentStats;
}

/** 根據付款項目取得有效日期 */
function getItemDate(item: PaymentItem): Date {
  if (item.paymentType === "single") {
    return new Date(item.startDate);
  }
  if (item.endDate) {
    return new Date(item.endDate);
  }
  return new Date(item.startDate);
}

/** 篩選付款項目 */
function filterItems(
  items: PaymentItem[],
  params: UseFilteredPaymentItemsParams
): PaymentItem[] {
  const now = new Date();

  return items.filter((item: PaymentItem) => {
    // 搜尋匹配
    const matchesSearch = !params.searchTerm ||
      item.itemName.toLowerCase().includes(params.searchTerm.toLowerCase()) ||
      (item.projectName && item.projectName.toLowerCase().includes(params.searchTerm.toLowerCase()));

    // 專案匹配
    const matchesProject = params.selectedProject === "all" ||
      (params.selectedProject && Array.isArray(params.projects) &&
       item.projectName === params.projects.find((p: any) => p.id.toString() === params.selectedProject)?.projectName);

    // 分類匹配
    let matchesCategory = true;
    if (params.selectedCategory !== "all") {
      const [categoryType, categoryId] = params.selectedCategory.split(":");
      if (categoryType === "fixed") {
        matchesCategory = item.fixedCategoryId === parseInt(categoryId);
      } else if (categoryType === "project") {
        matchesCategory = item.categoryId === parseInt(categoryId);
      }
    }

    // 狀態匹配
    let matchesStatus = true;
    if (params.selectedStatus === "unpaid") {
      matchesStatus = item.status !== "paid";
    } else if (params.selectedStatus === "paid") {
      matchesStatus = item.status === "paid";
    } else if (params.selectedStatus === "overdue") {
      const itemDate = getItemDate(item);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      matchesStatus = itemDate < today && item.status !== "paid";
    } else if (params.selectedStatus !== "all") {
      matchesStatus = item.status === params.selectedStatus;
    }

    // 付款類型匹配
    const matchesPaymentType = params.selectedPaymentType === "all" || item.paymentType === params.selectedPaymentType;

    // 日期範圍匹配
    let matchesDateRange = true;
    const itemDate = getItemDate(item);

    if (params.dateRange === "currentMonth") {
      matchesDateRange = itemDate.getMonth() === params.selectedMonth && itemDate.getFullYear() === params.selectedYear;
    } else if (params.dateRange === "currentMonthPayment") {
      const targetYear = params.selectedYear;
      const targetMonth = params.selectedMonth;

      if (params.paymentRecords && Array.isArray(params.paymentRecords)) {
        const itemPayments = params.paymentRecords.filter((record: any) =>
          record.itemId === item.id && record.paymentDate
        );

        matchesDateRange = itemPayments.some((payment: any) => {
          const paymentDate = new Date(payment.paymentDate);
          return paymentDate.getMonth() === targetMonth && paymentDate.getFullYear() === targetYear;
        });
      } else {
        matchesDateRange = false;
      }
    } else if (params.dateRange === "custom" && params.startDate && params.endDate) {
      const start = new Date(params.startDate);
      const end = new Date(params.endDate);
      matchesDateRange = itemDate >= start && itemDate <= end;
    } else if (params.dateRange === "upcoming") {
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      matchesDateRange = itemDate >= now && itemDate <= weekFromNow;
    }

    // 優先級匹配
    let matchesPriority = true;
    if (params.priorityFilter === "high") {
      matchesPriority = item.priority >= 3;
    } else if (params.priorityFilter === "medium") {
      matchesPriority = item.priority === 2;
    } else if (params.priorityFilter === "low") {
      matchesPriority = item.priority <= 1;
    }

    // 已刪除和已付款匹配
    const matchesDeleted = params.showDeleted ? (item as any).isDeleted : !(item as any).isDeleted;
    const matchesShowPaid = params.showPaidItems ? true : item.status !== "paid";

    return matchesSearch && matchesProject && matchesCategory && matchesStatus &&
           matchesPaymentType && matchesDateRange && matchesPriority && matchesDeleted && matchesShowPaid;
  });
}

/** 排序付款項目 */
function sortItems(items: PaymentItem[], sortBy: string, sortOrder: string): PaymentItem[] {
  const sorted = [...items];

  sorted.sort((a: PaymentItem, b: PaymentItem) => {
    let comparison = 0;

    switch (sortBy) {
      case "dueDate":
        comparison = new Date(a.endDate || a.startDate).getTime() - new Date(b.endDate || b.startDate).getTime();
        break;
      case "amount":
        comparison = parseFloat(a.totalAmount) - parseFloat(b.totalAmount);
        break;
      case "name":
        comparison = a.itemName.localeCompare(b.itemName);
        break;
      case "project":
        comparison = (a.projectName || "").localeCompare(b.projectName || "");
        break;
      case "priority":
        comparison = (a.priority || 0) - (b.priority || 0);
        break;
      case "status": {
        const statusOrder = { "overdue": 0, "pending": 1, "partial": 2, "paid": 3 };
        const statusA = statusOrder[a.status as keyof typeof statusOrder] ?? 1;
        const statusB = statusOrder[b.status as keyof typeof statusOrder] ?? 1;
        comparison = statusA - statusB;
        break;
      }
      default:
        comparison = 0;
    }

    return sortOrder === "desc" ? -comparison : comparison;
  });

  return sorted;
}

/** 計算統計資料 */
function calculateStats(items: PaymentItem[]): PaymentStats {
  let totalAmount = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;
  let paidCount = 0;
  let installmentCount = 0;
  let installmentPaidCount = 0;
  let installmentInProgressCount = 0;
  let installmentDueThisMonthCount = 0;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  items.forEach((item: PaymentItem) => {
    const itemTotal = parseFloat(item.totalAmount);
    const itemPaid = parseFloat(item.paidAmount || "0");

    if (!isNaN(itemTotal)) {
      totalAmount += itemTotal;
    }

    if (!isNaN(itemPaid) && itemPaid > 0) {
      paidAmount += itemPaid;

      if (itemPaid >= itemTotal) {
        paidCount++;
      }
    }

    const remainingAmount = itemTotal - itemPaid;
    if (remainingAmount > 0) {
      unpaidAmount += remainingAmount;
    }

    if (item.paymentType === "installment") {
      installmentCount++;

      if (item.status === "paid") {
        installmentPaidCount++;
      } else if (item.status === "pending" || item.status === "unpaid" || item.status === "partial") {
        installmentInProgressCount++;

        const dueDate = new Date(item.startDate);
        if (dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear) {
          installmentDueThisMonthCount++;
        }
      }
    }
  });

  return {
    totalAmount,
    paidAmount,
    unpaidAmount,
    paidCount,
    totalCount: items.length,
    installment: {
      total: installmentCount,
      paid: installmentPaidCount,
      inProgress: installmentInProgressCount,
      dueThisMonth: installmentDueThisMonthCount,
      completionRate: installmentCount > 0 ? Math.round((installmentPaidCount / installmentCount) * 100) : 0
    }
  };
}

export function useFilteredPaymentItems(params: UseFilteredPaymentItemsParams): UseFilteredPaymentItemsReturn {
  const filteredAndSortedItems = useMemo(() => {
    if (!params.paymentItems || !Array.isArray(params.paymentItems)) return [];

    const filtered = filterItems(params.paymentItems, params);
    return sortItems(filtered, params.sortBy, params.sortOrder);
  }, [
    params.paymentItems, params.searchTerm, params.selectedProject,
    params.selectedCategory, params.selectedStatus, params.selectedPaymentType,
    params.dateRange, params.priorityFilter, params.showPaidItems,
    params.startDate, params.endDate, params.sortBy, params.sortOrder,
    params.projects, params.paymentRecords, params.selectedMonth,
    params.selectedYear, params.showDeleted
  ]);

  const stats = useMemo(() => calculateStats(filteredAndSortedItems), [filteredAndSortedItems]);

  return { filteredAndSortedItems, stats };
}
