// 虛擬滾動與無限載入 Hook
// 負責：虛擬滾動效果、無限載入邏輯

import { useState, useEffect, useRef } from "react";

interface UseVirtualScrollParams {
  /** 總項目數量 */
  totalItems: number;
  /** 每個項目的高度（px） */
  itemHeight?: number;
  /** 初始每頁項目數 */
  initialPageSize?: number;
  /** 每次載入更多的增量 */
  loadMoreIncrement?: number;
}

interface UseVirtualScrollReturn {
  /** 每頁項目數 */
  itemsPerPage: number;
  /** 可見範圍 */
  visibleRange: { start: number; end: number };
  /** 是否正在載入更多 */
  isLoadingMore: boolean;
  /** 容器 ref */
  containerRef: React.RefObject<HTMLDivElement>;
}

export function useVirtualScroll(params: UseVirtualScrollParams): UseVirtualScrollReturn {
  const {
    totalItems,
    itemHeight = 120,
    initialPageSize = 50,
    loadMoreIncrement = 50,
  } = params;

  const [itemsPerPage, setItemsPerPage] = useState(initialPageSize);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 虛擬滾動效果
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;

      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(
        startIndex + Math.ceil(containerHeight / itemHeight) + 5,
        totalItems
      );

      setVisibleRange({ start: startIndex, end: endIndex });
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll();

      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [totalItems, itemHeight]);

  // 無限滾動邏輯
  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setItemsPerPage(prev => prev + loadMoreIncrement);
            setIsLoadingMore(false);
          }, 300);
        }
      },
      { threshold: 0.1 }
    );

    const sentinel = containerRef.current.querySelector('.scroll-sentinel');
    if (sentinel && observerRef.current) {
      observerRef.current.observe(sentinel);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isLoadingMore, loadMoreIncrement]);

  return {
    itemsPerPage,
    visibleRange,
    isLoadingMore,
    containerRef,
  };
}
