import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// 優化的付款項目查詢Hook
export function useOptimizedPaymentItems(params: {
  projectId?: string;
  categoryId?: string;
  page?: string;
  limit?: string;
  includeAll?: string;
  itemType?: string;
  enabled?: boolean;
}) {
  // 記憶化查詢鍵以避免不必要的重新查詢
  const queryKey = useMemo(() => {
    const baseKey = ['/api/payment/items'];
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && key !== 'enabled') {
        searchParams.append(key, String(value));
      }
    });
    
    if (searchParams.toString()) {
      baseKey.push(`?${searchParams.toString()}`);
    }
    
    return baseKey;
  }, [params.projectId, params.categoryId, params.page, params.limit, params.includeAll, params.itemType]);

  return useQuery({
    queryKey,
    enabled: params.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5分鐘快取
  });
}

// 優化的付款記錄查詢Hook
export function useOptimizedPaymentRecords(enabled = true) {
  return useQuery({
    queryKey: ['/api/payment/records'],
    enabled,
    staleTime: 10 * 60 * 1000, // 10分鐘快取
  });
}

// 優化的專案查詢Hook
export function useOptimizedProjects(enabled = true) {
  return useQuery({
    queryKey: ['/api/payment/projects'],
    enabled,
    staleTime: 15 * 60 * 1000, // 15分鐘快取（專案變動較少）
  });
}

// 優化的分類查詢Hook
export function useOptimizedCategories(type: 'fixed' | 'project' | 'all' = 'all', enabled = true) {
  const queryKey = useMemo(() => {
    switch (type) {
      case 'fixed':
        return ['/api/fixed-categories'];
      case 'project':
        return ['/api/categories/project'];
      default:
        return ['/api/categories'];
    }
  }, [type]);

  return useQuery({
    queryKey,
    enabled,
    staleTime: 15 * 60 * 1000, // 15分鐘快取（分類變動較少）
  });
}

// 優化的統計數據查詢Hook
export function useOptimizedStats(type: 'project' | 'projects' = 'project', enabled = true) {
  const queryKey = useMemo(() => {
    return type === 'project' ? ['/api/payment/project/stats'] : ['/api/payment/projects/stats'];
  }, [type]);

  return useQuery({
    queryKey,
    enabled,
    staleTime: 2 * 60 * 1000, // 2分鐘快取（統計需要較新數據）
  });
}

// 預載查詢Hook - 用於提前載入可能需要的數據
export function usePrefetchQueries() {
  const queryClient = useQueryClient();
  
  const prefetchCategories = () => {
    if (!queryClient) return;
    queryClient.prefetchQuery({
      queryKey: ['/api/fixed-categories'],
      staleTime: 15 * 60 * 1000,
    });
    queryClient.prefetchQuery({
      queryKey: ['/api/categories/project'],
      staleTime: 15 * 60 * 1000,
    });
  };

  const prefetchProjects = () => {
    if (!queryClient) return;
    queryClient.prefetchQuery({
      queryKey: ['/api/payment/projects'],
      staleTime: 15 * 60 * 1000,
    });
  };

  return {
    prefetchCategories,
    prefetchProjects,
  };
}

// 智能重新整理Hook - 根據頁面活躍度決定是否重新整理
export function useSmartRefresh(queryKeys: string[], intervalMs = 30000) {
  const queryClient = useQueryClient();
  
  const refreshQueries = () => {
    if (!queryClient || document.hidden) return;
    
    queryKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  };

  return { refreshQueries };
}
