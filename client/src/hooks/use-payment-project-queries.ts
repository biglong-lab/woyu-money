// 專案付款管理 - 資料查詢 Hook
// 負責：所有 React Query 資料查詢

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PaymentProject } from "@shared/schema";

interface UsePaymentProjectQueriesParams {
  /** 統計模式，決定是否啟用現金流查詢 */
  statisticsMode: 'expense' | 'cashflow';
  /** 選中的年度 */
  selectedYear: number;
  /** 選中的月份 */
  selectedMonth: number;
  /** 選中的專案 ID */
  selectedProject: string;
}

export function usePaymentProjectQueries(params: UsePaymentProjectQueriesParams) {
  const { statisticsMode, selectedYear, selectedMonth, selectedProject } = params;

  // 付款項目查詢
  const { data: paymentItemsRaw, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/payment/items", { includeAll: true }],
    queryFn: async () => {
      const response = await fetch('/api/payment/items?includeAll=true');
      if (!response.ok) {
        throw new Error('Failed to fetch payment items');
      }
      return response.json();
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  // 正規化付款項目陣列
  const paymentItems = useMemo(() => {
    if (!paymentItemsRaw) return [];
    return Array.isArray(paymentItemsRaw) ? paymentItemsRaw : (paymentItemsRaw.items || []);
  }, [paymentItemsRaw]);

  // 現金流統計查詢
  const { data: cashflowStats } = useQuery({
    queryKey: ["/api/payment/cashflow/stats", {
      year: selectedYear,
      month: selectedMonth + 1,
      projectId: selectedProject
    }],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        year: selectedYear.toString(),
        month: (selectedMonth + 1).toString(),
      });
      if (selectedProject && selectedProject !== 'all') {
        queryParams.append('projectId', selectedProject);
      }
      const response = await fetch(`/api/payment/cashflow/stats?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch cashflow stats');
      }
      return response.json();
    },
    enabled: statisticsMode === 'cashflow',
    staleTime: 60000,
  });

  // 現金流明細查詢
  const { data: cashflowDetails, isLoading: cashflowDetailsLoading } = useQuery({
    queryKey: ["/api/payment/cashflow/details", selectedYear, selectedMonth, selectedProject],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        year: selectedYear.toString(),
        month: (selectedMonth + 1).toString(),
        limit: '100',
      });
      if (selectedProject && selectedProject !== 'all') {
        queryParams.append('projectId', selectedProject);
      }
      const response = await fetch(`/api/payment/cashflow/details?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch cashflow details');
      }
      return response.json();
    },
    enabled: statisticsMode === 'cashflow',
    staleTime: 60000,
  });

  // 付款記錄查詢
  const { data: paymentRecords } = useQuery({
    queryKey: ["/api/payment/records"],
    staleTime: 30000,
  });

  // 專案列表查詢
  const { data: projects } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
    staleTime: 60000,
  });

  // 固定分類查詢
  const { data: fixedCategoriesData } = useQuery({
    queryKey: ["/api/fixed-categories"],
    staleTime: 60000,
  });

  // 專案分類查詢
  const { data: projectCategoriesData } = useQuery({
    queryKey: ["/api/categories/project"],
    staleTime: 60000,
  });

  return {
    paymentItems,
    itemsLoading,
    cashflowStats,
    cashflowDetails,
    cashflowDetailsLoading,
    paymentRecords,
    projects,
    fixedCategoriesData,
    projectCategoriesData,
  };
}
