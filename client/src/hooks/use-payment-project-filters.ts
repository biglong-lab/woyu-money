// 專案付款管理 - 篩選狀態管理 Hook
// 負責：篩選狀態、防抖搜尋、localStorage 持久化、鍵盤快捷鍵、智能篩選、重置

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

/** 從 localStorage 載入持久化的篩選器狀態 */
function loadFilterState(): Record<string, any> {
  try {
    const saved = localStorage.getItem('paymentProjectFilters');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

/** 篩選器狀態的完整型別 */
export interface FilterState {
  selectedProject: string;
  searchTerm: string;
  debouncedSearchTerm: string;
  selectedCategory: string;
  selectedStatus: string;
  selectedPaymentType: string;
  dateRange: string;
  dateFilterType: string;
  selectedYear: number;
  selectedMonth: number;
  startDate: string;
  endDate: string;
  priorityFilter: string;
  showPaidItems: boolean;
  sortBy: string;
  sortOrder: string;
  showDeleted: boolean;
  showAdvancedFilters: boolean;
  statisticsMode: 'expense' | 'cashflow';
}

/** 篩選器的 setter 集合 */
export interface FilterSetters {
  setSelectedProject: (v: string) => void;
  setSearchTerm: (v: string) => void;
  setDebouncedSearchTerm: (v: string) => void;
  setSelectedCategory: (v: string) => void;
  setSelectedStatus: (v: string) => void;
  setSelectedPaymentType: (v: string) => void;
  setDateRange: (v: string) => void;
  setDateFilterType: (v: string) => void;
  setSelectedYear: (v: number) => void;
  setSelectedMonth: (v: number) => void;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  setPriorityFilter: (v: string) => void;
  setShowPaidItems: (v: boolean) => void;
  setSortBy: (v: string) => void;
  setSortOrder: (v: string) => void;
  setShowDeleted: (v: boolean) => void;
  setShowAdvancedFilters: (v: boolean) => void;
  setStatisticsMode: (v: 'expense' | 'cashflow') => void;
}

/** 篩選器操作 */
export interface FilterActions {
  resetFilters: () => void;
  applySmartFilter: (filterType: 'urgent' | 'thisMonth' | 'highAmount' | 'overdue') => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
}

export type UsePaymentProjectFiltersReturn = FilterState & FilterSetters & FilterActions;

export function usePaymentProjectFilters(): UsePaymentProjectFiltersReturn {
  const { toast } = useToast();
  const savedFilters = loadFilterState();

  // 統計邏輯模式切換
  const [statisticsMode, setStatisticsMode] = useState<'expense' | 'cashflow'>('expense');

  // 篩選狀態
  const [selectedProject, setSelectedProject] = useState<string>(savedFilters.selectedProject || "all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(savedFilters.selectedCategory || "all");
  const [selectedStatus, setSelectedStatus] = useState<string>(savedFilters.selectedStatus || "all");
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>(savedFilters.selectedPaymentType || "all");
  const [dateRange, setDateRange] = useState<string>(savedFilters.dateRange || "currentMonth");
  const [dateFilterType, setDateFilterType] = useState<string>(savedFilters.dateFilterType || "itemDate");
  const [selectedYear, setSelectedYear] = useState<number>(savedFilters.selectedYear || new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(savedFilters.selectedMonth || new Date().getMonth());
  const [startDate, setStartDate] = useState<string>(savedFilters.startDate || "");
  const [endDate, setEndDate] = useState<string>(savedFilters.endDate || "");
  const [priorityFilter, setPriorityFilter] = useState<string>(savedFilters.priorityFilter || "all");
  const [showPaidItems, setShowPaidItems] = useState<boolean>(savedFilters.showPaidItems !== undefined ? savedFilters.showPaidItems : true);
  const [sortBy, setSortBy] = useState<string>(savedFilters.sortBy || "dueDate");
  const [sortOrder, setSortOrder] = useState<string>(savedFilters.sortOrder || "asc");
  const [showDeleted, setShowDeleted] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // 防抖動搜尋定時器
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 優化的防抖動搜尋邏輯
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchTerm === "") {
      setDebouncedSearchTerm("");
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // 保存篩選器狀態到 localStorage
  const saveFilterState = useCallback(() => {
    const filterState = {
      selectedProject,
      selectedCategory,
      selectedStatus,
      selectedPaymentType,
      dateRange,
      dateFilterType,
      selectedYear,
      selectedMonth,
      startDate,
      endDate,
      priorityFilter,
      showPaidItems,
      sortBy,
      sortOrder
    };

    try {
      localStorage.setItem('paymentProjectFilters', JSON.stringify(filterState));
    } catch {
      // 無法保存篩選器狀態
    }
  }, [selectedProject, selectedCategory, selectedStatus, selectedPaymentType, dateRange, dateFilterType, selectedYear, selectedMonth, startDate, endDate, priorityFilter, showPaidItems, sortBy, sortOrder]);

  useEffect(() => {
    saveFilterState();
  }, [saveFilterState]);

  // 鍵盤快捷鍵支援
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      if (event.key === 'Escape' && document.activeElement === searchInputRef.current) {
        event.preventDefault();
        setSearchTerm('');
        searchInputRef.current?.blur();
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            setSelectedStatus(selectedStatus === "pending" ? "all" : "pending");
            break;
          case '2':
            event.preventDefault();
            setSelectedStatus(selectedStatus === "paid" ? "all" : "paid");
            break;
          case '3':
            event.preventDefault();
            setSelectedStatus(selectedStatus === "overdue" ? "all" : "overdue");
            break;
          case '0':
            event.preventDefault();
            setSelectedProject("all");
            setSelectedCategory("all");
            setSelectedStatus("all");
            setSelectedPaymentType("all");
            setSearchTerm("");
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedStatus]);

  // 智能篩選預設
  const applySmartFilter = useCallback((filterType: 'urgent' | 'thisMonth' | 'highAmount' | 'overdue') => {
    const today = new Date();
    const thisMonth = today.getMonth() + 1;
    const thisYear = today.getFullYear();

    switch (filterType) {
      case 'urgent':
        setSelectedStatus("pending");
        setPriorityFilter("high");
        setDateRange("next7Days");
        setSortBy("dueDate");
        setSortOrder("asc");
        break;
      case 'thisMonth':
        setDateRange("currentMonth");
        setSelectedMonth(thisMonth);
        setSelectedYear(thisYear);
        setSelectedStatus("pending");
        break;
      case 'highAmount':
        setSelectedStatus("pending");
        setSortBy("amount");
        setSortOrder("desc");
        break;
      case 'overdue':
        setSelectedStatus("overdue");
        setSortBy("dueDate");
        setSortOrder("asc");
        break;
    }

    toast({
      title: "已套用智能篩選",
      description: `篩選條件已設定為${filterType === 'urgent' ? '緊急項目' :
                   filterType === 'thisMonth' ? '本月項目' :
                   filterType === 'highAmount' ? '高金額項目' : '逾期項目'}`,
    });
  }, [toast]);

  // 重置篩選器
  const resetFilters = useCallback(() => {
    setSelectedProject("all");
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setSelectedPaymentType("all");
    setDateRange("currentMonth");
    setDateFilterType("itemDate");
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth() + 1);
    setStartDate("");
    setEndDate("");
    setPriorityFilter("all");
    setShowPaidItems(true);
    setSortBy("dueDate");
    setSortOrder("asc");

    try {
      localStorage.removeItem('paymentProjectFilters');
    } catch {
      // 無法清除篩選器狀態
    }

    toast({
      title: "篩選器已重置",
      description: "所有篩選條件已恢復為預設值",
    });
  }, [toast]);

  return {
    // 狀態
    statisticsMode,
    selectedProject,
    searchTerm,
    debouncedSearchTerm,
    selectedCategory,
    selectedStatus,
    selectedPaymentType,
    dateRange,
    dateFilterType,
    selectedYear,
    selectedMonth,
    startDate,
    endDate,
    priorityFilter,
    showPaidItems,
    sortBy,
    sortOrder,
    showDeleted,
    showAdvancedFilters,
    // Setters
    setStatisticsMode,
    setSelectedProject,
    setSearchTerm,
    setDebouncedSearchTerm,
    setSelectedCategory,
    setSelectedStatus,
    setSelectedPaymentType,
    setDateRange,
    setDateFilterType,
    setSelectedYear,
    setSelectedMonth,
    setStartDate,
    setEndDate,
    setPriorityFilter,
    setShowPaidItems,
    setSortBy,
    setSortOrder,
    setShowDeleted,
    setShowAdvancedFilters,
    // 操作
    resetFilters,
    applySmartFilter,
    searchInputRef,
  };
}
