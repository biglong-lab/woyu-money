import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  // 檢查是否為 FormData (檔案上傳)
  const isFormData = data instanceof FormData;
  
  const res = await fetch(url, {
    method,
    headers: isFormData ? {} : (data ? { "Content-Type": "application/json" } : {}),
    body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // 如果是DELETE請求且成功，返回空對象
  if (method === "DELETE" && res.ok) {
    return {} as T;
  }
  
  // 其他情況返回JSON數據
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // 禁用視窗焦點刷新
      staleTime: 10 * 60 * 1000, // 延長至10分鐘緩存時間
      gcTime: 30 * 60 * 1000, // 30分鐘垃圾回收時間
      retry: (failureCount, error: Error) => {
        // 智能重試策略
        if (error?.message?.includes('Too many database connection attempts')) {
          return failureCount < 3;
        }
        if (error?.message?.includes('timeout')) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnMount: false, // 禁用自動重新獲取以提升效能
      networkMode: 'online', // 只在線上時執行查詢
    },
    mutations: {
      retry: (failureCount, error: Error) => {
        // 對連線錯誤進行重試
        if (error?.message?.includes('Too many database connection attempts')) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: 1000,
      networkMode: 'online',
    },
  },
});
