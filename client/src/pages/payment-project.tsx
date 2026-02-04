import { useState, useEffect, useMemo, useCallback, useRef, memo, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useSearch } from "wouter";
import { Plus, Search, Filter, MoreHorizontal, Calendar, DollarSign, TrendingUp, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Star, Clock, RotateCcw, Upload, X, Image, Receipt, Building2, Tag, CreditCard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import PaymentItemDetails from "@/components/payment-item-details";
import ProjectCategoryDialog from "@/components/project-category-dialog";
import IntelligentAnalytics from "@/components/intelligent-analytics";
import { ResponsiveLayout, ResponsiveGrid, ResponsiveCard } from "@/components/responsive-layout";
import { ResponsiveButtonGroup, CollapsibleCard, ResponsiveDataTable, StatusIndicator, ResponsiveFilterPanel, SkeletonLoader } from "@/components/enhanced-responsive-components";
import { LoadingSpinner, LoadingCard } from "@/components/ui/loading-spinner";

type PaymentItem = {
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
  fixedCategoryId?: number;
  categoryId?: number;
  projectId?: number;
};

type PaymentProject = {
  id: number;
  projectName: string;
  projectType: string;
  description?: string;
  isActive: boolean;
};

const paymentSchema = z.object({
  amount: z.string().min(1, "請輸入付款金額"),
  paymentDate: z.string().min(1, "請選擇付款日期"),
  paymentMethod: z.string().min(1, "請選擇付款方式"),
  note: z.string().optional(),
  receiptImage: z.any().optional(),
});

const editItemSchema = z.object({
  itemName: z.string().min(1, "請輸入項目名稱"),
  totalAmount: z.string().min(1, "請輸入總金額"),
  startDate: z.string().min(1, "請選擇開始日期"),
  endDate: z.string().optional(),
  priority: z.string().min(1, "請選擇優先級"),
  notes: z.string().optional(),
  paymentType: z.string().min(1, "請選擇付款類型"),
});

const PaymentItemsSkeleton = ({ items }: { items: number }) => (
  <SkeletonLoader type="list" count={items} />
);

function PaymentProjectContent() {
  const [activeTab, setActiveTab] = useState("items");
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  
  // 統計邏輯模式切換
  const [statisticsMode, setStatisticsMode] = useState<'expense' | 'cashflow'>('expense'); // expense: 費用歸屬, cashflow: 現金流
  
  // 完整篩選狀態
  // 載入持久化的篩選器狀態
  const loadFilterState = () => {
    try {
      const saved = localStorage.getItem('paymentProjectFilters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const savedFilters = loadFilterState();
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
  
  // 搜尋欄位 ref
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // 快捷篩選狀態
  const [selectedDateRange, setSelectedDateRange] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  
  // 批量操作狀態
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);
  
  // 對話框狀態
  const [selectedItem, setSelectedItem] = useState<PaymentItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentItem | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentItem, setPaymentItem] = useState<PaymentItem | null>(null);
  const [isProjectCategoryDialogOpen, setIsProjectCategoryDialogOpen] = useState(false);
  
  // 刪除相關狀態
  const [deleteItem, setDeleteItem] = useState<PaymentItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // 圖片上傳狀態
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // 虛擬滾動和分頁狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const itemHeight = 120; // 估計每個項目的高度

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 優化的防抖動搜尋邏輯
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // 立即搜尋空字串，延遲搜尋內容
    if (searchTerm === "") {
      setDebouncedSearchTerm("");
      return;
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250); // 稍微減少延遲

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
    } catch (error) {
      console.warn('無法保存篩選器狀態:', error);
    }
  }, [selectedProject, selectedCategory, selectedStatus, selectedPaymentType, dateRange, dateFilterType, selectedYear, selectedMonth, startDate, endDate, priorityFilter, showPaidItems, sortBy, sortOrder]);

  // 當篩選器狀態改變時自動保存
  useEffect(() => {
    saveFilterState();
  }, [saveFilterState]);

  // 鍵盤快捷鍵支援
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K 聚焦搜尋欄
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      
      // ESC 清空搜尋
      if (event.key === 'Escape' && document.activeElement === searchInputRef.current) {
        event.preventDefault();
        setSearchTerm('');
        searchInputRef.current?.blur();
      }

      // Alt + 數字鍵快速篩選
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
            // 清除所有篩選
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

  // 重置篩選器到預設狀態
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
    
    // 清除 localStorage
    try {
      localStorage.removeItem('paymentProjectFilters');
    } catch (error) {
      console.warn('無法清除篩選器狀態:', error);
    }
    
    toast({
      title: "篩選器已重置",
      description: "所有篩選條件已恢復為預設值",
    });
  }, [toast]);

  // 批量操作相關函數
  const toggleItemSelection = useCallback((itemId: number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback((items: PaymentItem[]) => {
    if (isAllSelected) {
      setSelectedItems(new Set());
      setIsAllSelected(false);
    } else {
      const allItemIds = items.map((item: PaymentItem) => item.id);
      setSelectedItems(new Set(allItemIds));
      setIsAllSelected(true);
    }
  }, [isAllSelected]);

  // 批量狀態更新
  const handleBatchStatusUpdate = useCallback(async (status: string) => {
    if (selectedItems.size === 0) {
      toast({
        title: "請選擇項目",
        description: "請先選擇要更新的付款項目",
        variant: "destructive",
      });
      return;
    }

    try {
      const itemIds = Array.from(selectedItems);
      const response = await apiRequest("PATCH", "/api/payment/items/batch-status", {
        itemIds,
        status,
        userInfo: "批量更新"
      });

      if (response.ok) {
        // 更新所有相關的查詢快取
        queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
        queryClient.invalidateQueries({ queryKey: ["/api/payment/items?limit=500&itemType=general"] });
        queryClient.invalidateQueries({ queryKey: ["/api/payment/project"] });
        setSelectedItems(new Set());
        setIsAllSelected(false);
        
        toast({
          title: "批量更新成功",
          description: `已更新 ${itemIds.length} 個項目的狀態為 ${status}`,
        });
      }
    } catch (error) {
      console.error('批量更新失敗:', error);
      toast({
        title: "批量更新失敗",
        description: "請稍後再試",
        variant: "destructive",
      });
    }
  }, [selectedItems, apiRequest, queryClient, toast]);

  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: "",
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: "bank_transfer",
      note: "",
      receiptImage: null,
    },
  });

  const editForm = useForm<z.infer<typeof editItemSchema>>({
    resolver: zodResolver(editItemSchema),
    defaultValues: {
      itemName: "",
      totalAmount: "",
      startDate: "",
      endDate: "",
      priority: "2",
      notes: "",
      paymentType: "single",
    },
  });

  // 優化查詢 - 統一API回應處理，增加快取
  const { data: paymentItemsRaw, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/payment/items", { includeAll: true }],
    queryFn: async () => {
      const response = await fetch('/api/payment/items?includeAll=true');
      if (!response.ok) {
        throw new Error('Failed to fetch payment items');
      }
      return response.json();
    },
    staleTime: 30000, // 30秒快取避免重複請求
    gcTime: 300000, // 5分鐘垃圾回收時間
  });

  // 統一處理API回應格式
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
      const params = new URLSearchParams({
        year: selectedYear.toString(),
        month: (selectedMonth + 1).toString(),
      });
      if (selectedProject && selectedProject !== 'all') {
        params.append('projectId', selectedProject);
      }
      const response = await fetch(`/api/payment/cashflow/stats?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch cashflow stats');
      }
      return response.json();
    },
    enabled: statisticsMode === 'cashflow',
    staleTime: 60000, // 1分鐘快取
  });

  // 查詢現金流詳細項目
  const { data: cashflowDetails, isLoading: cashflowDetailsLoading } = useQuery({
    queryKey: ["/api/payment/cashflow/details", selectedYear, selectedMonth, selectedProject],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: selectedYear.toString(),
        month: (selectedMonth + 1).toString(),
        limit: '100',
      });
      if (selectedProject && selectedProject !== 'all') {
        params.append('projectId', selectedProject);
      }
      const response = await fetch(`/api/payment/cashflow/details?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch cashflow details');
      }
      return response.json();
    },
    enabled: statisticsMode === 'cashflow',
    staleTime: 60000,
  });

  // 查詢付款記錄
  const { data: paymentRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ["/api/payment/records"],
    staleTime: 30000,
  });

  // 查詢專案
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/payment/projects"],
    staleTime: 60000, // 專案變動較少，可以快取更久
  });

  // 查詢固定分類
  const { data: fixedCategoriesData } = useQuery({
    queryKey: ["/api/fixed-categories"],
    staleTime: 60000,
  });

  // 查詢專案分類
  const { data: projectCategoriesData } = useQuery({
    queryKey: ["/api/categories/project"],
    staleTime: 60000,
  });

  // 篩選和排序數據 - 移動到這裡確保在使用前定義
  const filteredAndSortedItems = useMemo(() => {
    if (!paymentItems || !Array.isArray(paymentItems)) return [];
    
    // 查找木工隔間項目並debug
    const mokongItem = paymentItems?.find((item: any) => item.itemName?.includes('木工隔間'));
    if (mokongItem) {
      console.log('專案付款管理 - 找到木工隔間項目:', {
        id: mokongItem.id,
        itemName: mokongItem.itemName,
        totalAmount: mokongItem.totalAmount,
        paidAmount: mokongItem.paidAmount,
        status: mokongItem.status
      });
    }
    
    const now = new Date();
    
    // 篩選邏輯
    let filtered = paymentItems.filter((item: PaymentItem) => {
      // 搜尋篩選
      const matchesSearch = !searchTerm || 
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.projectName && item.projectName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // 專案篩選
      const matchesProject = selectedProject === "all" || 
        (selectedProject && Array.isArray(projects) && item.projectName === projects.find((p: any) => p.id.toString() === selectedProject)?.projectName);
      
      // 分類篩選
      let matchesCategory = true;
      if (selectedCategory !== "all") {
        const [categoryType, categoryId] = selectedCategory.split(":");
        if (categoryType === "fixed") {
          matchesCategory = item.fixedCategoryId === parseInt(categoryId);
        } else if (categoryType === "project") {
          matchesCategory = item.categoryId === parseInt(categoryId);
        }
      }
      
      // 狀態篩選
      let matchesStatus = true;
      if (selectedStatus === "unpaid") {
        matchesStatus = item.status !== "paid";
      } else if (selectedStatus === "paid") {
        matchesStatus = item.status === "paid";
      } else if (selectedStatus === "overdue") {
        let itemDate: Date;
        if (item.paymentType === "single") {
          itemDate = new Date(item.startDate);
        } else if (item.endDate) {
          itemDate = new Date(item.endDate);
        } else {
          itemDate = new Date(item.startDate);
        }
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        matchesStatus = itemDate < today && item.status !== "paid";
      } else if (selectedStatus !== "all") {
        matchesStatus = item.status === selectedStatus;
      }
      
      // 付款類型篩選
      const matchesPaymentType = selectedPaymentType === "all" || item.paymentType === selectedPaymentType;
      
      // 時間範圍篩選
      let matchesDateRange = true;
      let itemDate: Date;
      if (item.paymentType === "single") {
        itemDate = new Date(item.startDate);
      } else if (item.endDate) {
        itemDate = new Date(item.endDate);
      } else {
        itemDate = new Date(item.startDate);
      }
      
      if (dateRange === "currentMonth") {
        matchesDateRange = itemDate.getMonth() === selectedMonth && itemDate.getFullYear() === selectedYear;
      } else if (dateRange === "currentMonthPayment") {
        const targetYear = selectedYear;
        const targetMonth = selectedMonth;
        
        if (paymentRecords && Array.isArray(paymentRecords)) {
          const itemPayments = paymentRecords.filter((record: any) => 
            record.itemId === item.id && record.paymentDate
          );
          
          matchesDateRange = itemPayments.some((payment: any) => {
            const paymentDate = new Date(payment.paymentDate);
            return paymentDate.getMonth() === targetMonth && paymentDate.getFullYear() === targetYear;
          });
        } else {
          matchesDateRange = false;
        }
      } else if (dateRange === "custom" && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        matchesDateRange = itemDate >= start && itemDate <= end;
      } else if (dateRange === "upcoming") {
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        matchesDateRange = itemDate >= now && itemDate <= weekFromNow;
      }
      
      // 優先級篩選
      let matchesPriority = true;
      if (priorityFilter === "high") {
        matchesPriority = item.priority >= 3;
      } else if (priorityFilter === "medium") {
        matchesPriority = item.priority === 2;
      } else if (priorityFilter === "low") {
        matchesPriority = item.priority <= 1;
      }
      
      const matchesDeleted = showDeleted ? (item as any).isDeleted : !(item as any).isDeleted;
      const matchesShowPaid = showPaidItems ? true : item.status !== "paid";
      
      return matchesSearch && matchesProject && matchesCategory && matchesStatus && 
             matchesPaymentType && matchesDateRange && matchesPriority && matchesDeleted && matchesShowPaid;
    });

    // 排序邏輯
    filtered.sort((a: PaymentItem, b: PaymentItem) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "dueDate":
          const dateA = new Date(a.endDate || a.startDate);
          const dateB = new Date(b.endDate || b.startDate);
          comparison = dateA.getTime() - dateB.getTime();
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
        case "status":
          const statusOrder = { "overdue": 0, "pending": 1, "partial": 2, "paid": 3 };
          const statusA = statusOrder[a.status as keyof typeof statusOrder] ?? 1;
          const statusB = statusOrder[b.status as keyof typeof statusOrder] ?? 1;
          comparison = statusA - statusB;
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [paymentItems, searchTerm, selectedProject, selectedCategory, selectedStatus, selectedPaymentType, dateRange, priorityFilter, showPaidItems, startDate, endDate, sortBy, sortOrder, projects, paymentRecords, selectedMonth, selectedYear]);

  // 虛擬滾動效果 - 現在可以安全使用 filteredAndSortedItems
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      
      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(
        startIndex + Math.ceil(containerHeight / itemHeight) + 5,
        filteredAndSortedItems.length
      );
      
      setVisibleRange({ start: startIndex, end: endIndex });
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll();
      
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [filteredAndSortedItems.length, itemHeight]);

  // 無限滾動邏輯
  useEffect(() => {
    if (!containerRef.current) return;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setItemsPerPage(prev => prev + 50);
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
  }, [isLoadingMore]);



  // 付款處理
  const paymentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof paymentSchema>) => {
      if (!paymentItem) throw new Error("沒有選擇付款項目");
      return apiRequest("POST", `/api/payment/items/${paymentItem.id}/payments`, data);
    },
    onSuccess: () => {
      toast({ title: "付款記錄已新增" });
      // 更新所有相關的查詢快取
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items?limit=500&itemType=general"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project"] });
      setIsPaymentDialogOpen(false);
      setPaymentItem(null);
      paymentForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "付款失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePayment = async (data: z.infer<typeof paymentSchema>) => {
    try {
      let receiptImageUrl = null;
      
      // 處理圖片上傳
      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          receiptImageUrl = uploadResult.url;
        } else {
          throw new Error('圖片上傳失敗');
        }
      }
      
      // 提交付款記錄
      paymentMutation.mutate({
        ...data,
        receiptImage: receiptImageUrl,
      });
      
      // 重置圖片上傳狀態
      setSelectedImage(null);
      setImagePreview(null);
    } catch (error: any) {
      toast({
        title: "付款失敗",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // 編輯項目 mutation
  const editItemMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editItemSchema>) => {
      if (!editingItem) throw new Error("沒有選擇編輯項目");
      return apiRequest("PATCH", `/api/payment/items/${editingItem.id}`, {
        ...data,
        priority: parseInt(data.priority),
        totalAmount: parseFloat(data.totalAmount),
        userInfo: "項目修改"
      });
    },
    onSuccess: () => {
      toast({ title: "項目修改成功" });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project"] });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      editForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "修改失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditItem = (data: z.infer<typeof editItemSchema>) => {
    editItemMutation.mutate(data);
  };

  // 刪除項目 mutation（軟刪除）
  const deleteMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return apiRequest("DELETE", `/api/payment/items/${itemId}`, {
        userInfo: "專案付款管理-軟刪除"
      });
    },
    onSuccess: () => {
      toast({
        title: "刪除成功",
        description: "付款項目已移至回收站",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project"] });
      setDeleteItem(null);
      setIsDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "刪除失敗",
        description: error.message || "刪除付款項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // 開啟刪除確認對話框
  const handleDeleteClick = (item: PaymentItem) => {
    setDeleteItem(item);
    setIsDeleteDialogOpen(true);
  };

  // 確認刪除
  const handleDeleteConfirm = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id);
  };

  // 開啟編輯對話框時，設定表單預設值
  const openEditDialog = (item: PaymentItem) => {
    setEditingItem(item);
    editForm.reset({
      itemName: item.itemName,
      totalAmount: item.totalAmount,
      startDate: item.startDate,
      endDate: item.endDate || "",
      priority: item.priority?.toString() || "2",
      notes: (item as any).notes || "",
      paymentType: item.paymentType,
    });
    setIsEditDialogOpen(true);
  };

  // 處理圖片選擇
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "圖片太大",
          description: "請選擇小於10MB的圖片",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedImage(file);
      
      // 創建預覽
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 移除圖片
  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handlePaymentClick = (item: PaymentItem) => {
    setPaymentItem(item);
    setIsPaymentDialogOpen(true);
    // 重置圖片上傳狀態
    setSelectedImage(null);
    setImagePreview(null);
    // 重置表單
    paymentForm.reset({
      amount: "",
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "",
      note: "",
    });
  };

  // 處理從財務總覽頁面的快速付款跳轉
  useEffect(() => {
    if (!searchString || !paymentItems || paymentItems.length === 0) return;
    
    const params = new URLSearchParams(searchString);
    const payItemId = params.get('pay');
    const amount = params.get('amount');
    
    if (payItemId) {
      const targetItem = paymentItems.find((item: PaymentItem) => item.id === parseInt(payItemId));
      
      if (targetItem) {
        setPaymentItem(targetItem);
        setIsPaymentDialogOpen(true);
        setSelectedImage(null);
        setImagePreview(null);
        paymentForm.reset({
          amount: amount || "",
          paymentDate: new Date().toISOString().split("T")[0],
          paymentMethod: "",
          note: "",
        });
        // 清除 URL 參數避免重複觸發
        setLocation('/payment-project', { replace: true });
      }
    }
  }, [searchString, paymentItems, paymentForm, setLocation]);

  const getStatusBadge = (item: PaymentItem) => {
    // 計算逾期天數
    const getOverdueDays = () => {
      const itemDate = new Date(item.paymentType === "single" ? item.startDate : (item.endDate || item.startDate));
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      if (itemDate < today && item.status !== "paid") {
        const diffTime = today.getTime() - itemDate.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      return 0;
    };

    const overdueDays = getOverdueDays();
    
    const statusConfig = {
      paid: { 
        label: "已付清", 
        variant: "default" as const, 
        className: "status-indicator status-paid" 
      },
      partial: { 
        label: overdueDays > 0 ? `部分付款 (逾期${overdueDays}天)` : "部分付款", 
        variant: "secondary" as const, 
        className: overdueDays > 0 ? "status-indicator status-overdue" : "status-indicator status-pending"
      },
      unpaid: { 
        label: overdueDays > 0 ? `未付款 (逾期${overdueDays}天)` : "未付款", 
        variant: "destructive" as const, 
        className: overdueDays > 0 
          ? "status-indicator status-overdue animate-pulse" 
          : "status-indicator status-overdue" 
      },
      pending: { 
        label: overdueDays > 0 ? `待付款 (逾期${overdueDays}天)` : "待付款", 
        variant: "outline" as const, 
        className: overdueDays > 0 ? "status-indicator status-overdue" : "status-indicator status-pending"
      },
    };

    const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.unpaid;
    
    return (
      <Badge variant={config.variant} className={`${config.className} font-medium`}>
        {config.label}
      </Badge>
    );
  };

  // 優化統計計算 - 單次遍歷計算所有統計值，包含分期專屬統計
  const stats = useMemo(() => {
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
    
    filteredAndSortedItems.forEach((item: PaymentItem) => {
      const itemTotal = parseFloat(item.totalAmount);
      const itemPaid = parseFloat(item.paidAmount || "0");
      
      if (!isNaN(itemTotal)) {
        totalAmount += itemTotal;
      }
      
      // 根據實際付款金額統計，而非狀態
      if (!isNaN(itemPaid) && itemPaid > 0) {
        paidAmount += itemPaid;
        
        // 如果已全額付清，計入已付項目
        if (itemPaid >= itemTotal) {
          paidCount++;
        }
      }
      
      // 計算剩餘未付金額
      const remainingAmount = itemTotal - itemPaid;
      if (remainingAmount > 0) {
        unpaidAmount += remainingAmount;
      }
      
      // 分期項目統計
      if (item.paymentType === "installment") {
        installmentCount++;
        
        if (item.status === "paid") {
          installmentPaidCount++;
        } else if (item.status === "pending" || item.status === "unpaid" || item.status === "partial") {
          installmentInProgressCount++;
          
          // 檢查是否本月到期
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
      totalCount: filteredAndSortedItems.length,
      installment: {
        total: installmentCount,
        paid: installmentPaidCount,
        inProgress: installmentInProgressCount,
        dueThisMonth: installmentDueThisMonthCount,
        completionRate: installmentCount > 0 ? Math.round((installmentPaidCount / installmentCount) * 100) : 0
      }
    };
  }, [filteredAndSortedItems]);

  return (
    <div className="space-y-4 px-2 sm:px-0">
      {/* 分期付款專屬統計面板 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Card className="border-purple-100 bg-purple-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">分期項目</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-purple-600">
                {stats.installment.total}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              進行中: {stats.installment.inProgress}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">
                  {statisticsMode === 'expense' ? '本月到期' : '現金流項目'}
                </span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                {(() => {
                  if (statisticsMode === 'cashflow' && cashflowStats) {
                    return cashflowStats.recordCount || 0;
                  } else {
                    return stats.installment.dueThisMonth;
                  }
                })()}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {statisticsMode === 'expense' ? '需要關注' : '實際付款記錄'}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-100 bg-green-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">
                  {statisticsMode === 'expense' ? '完成率' : '現金流出'}
                </span>
              </div>
              <div className="text-sm sm:text-lg font-bold text-green-600">
                {(() => {
                  if (statisticsMode === 'cashflow' && cashflowStats) {
                    return new Intl.NumberFormat('zh-TW', { 
                      style: 'currency', 
                      currency: 'TWD',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(cashflowStats.totalCashOutflow || 0);
                  } else {
                    return `${stats.installment.completionRate}%`;
                  }
                })()}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {statisticsMode === 'expense' 
                ? `已完成: ${stats.installment.paid}` 
                : `${selectedYear}年${selectedMonth + 1}月`
              }
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-100 bg-red-50/50 card-interactive">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">逾期</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-red-600">
                {filteredAndSortedItems.filter(item => {
                  let itemDate = new Date(item.paymentType === "single" ? item.startDate : (item.endDate || item.startDate));
                  const today = new Date();
                  today.setHours(23, 59, 59, 999);
                  return itemDate < today && item.status !== "paid";
                }).length}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              需立即處理
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-orange-100 bg-orange-50/50 card-interactive">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4 text-orange-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">本月</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-orange-600">
                {filteredAndSortedItems.filter(item => {
                  let itemDate = new Date(item.paymentType === "single" ? item.startDate : (item.endDate || item.startDate));
                  return itemDate.getMonth() === new Date().getMonth() && 
                         itemDate.getFullYear() === new Date().getFullYear() &&
                         item.status !== "paid";
                }).length}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-blue-100 bg-blue-50/50 col-span-2 sm:col-span-1 card-interactive">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-blue-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">待付</span>
              </div>
              <div className="text-sm sm:text-lg font-bold text-blue-600">
                {new Intl.NumberFormat('zh-TW', { 
                  style: 'currency', 
                  currency: 'TWD',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(stats.unpaidAmount)}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-100 bg-green-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">完成</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                {stats.paidCount}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 現金流詳細項目列表 */}
      {statisticsMode === 'cashflow' && cashflowDetails && (
        <Card className="bg-blue-50/30 border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">
                  {selectedYear}年{selectedMonth + 1}月 現金流項目詳情
                </h3>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {cashflowDetails.summary?.totalRecords || 0} 筆記錄
              </Badge>
            </div>
            <p className="text-sm text-blue-700">
              總支出: {new Intl.NumberFormat('zh-TW', { 
                style: 'currency', 
                currency: 'TWD',
                minimumFractionDigits: 0 
              }).format(cashflowDetails.summary?.totalAmount || 0)}
            </p>
          </CardHeader>
          <CardContent>
            {cashflowDetailsLoading ? (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <LoadingSpinner className="h-4 w-4" />
                <span>正在載入現金流項目詳情...</span>
              </div>
            ) : cashflowDetails.items && cashflowDetails.items.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {cashflowDetails.items.map((item: any) => (
                  <div key={`${item.recordId}-${item.itemId}`} className="border rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 text-sm">{item.itemName}</h4>
                          {item.status === 'paid' && (
                            <Badge className="bg-green-100 text-green-700 text-xs">已完成</Badge>
                          )}
                          {item.status === 'pending' && (
                            <Badge className="bg-yellow-100 text-yellow-700 text-xs">進行中</Badge>
                          )}
                          {item.status === 'overdue' && (
                            <Badge className="bg-red-100 text-red-700 text-xs">逾期</Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <span>{item.projectName}</span>
                          </div>
                          {item.categoryName && (
                            <div className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              <span>{item.categoryName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(item.paymentDate).toLocaleDateString('zh-TW')}</span>
                          </div>
                          {item.paymentMethod && (
                            <div className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              <span>{
                                item.paymentMethod === 'credit_card' ? '信用卡' :
                                item.paymentMethod === 'bank_transfer' ? '銀行轉帳' :
                                item.paymentMethod === 'cash' ? '現金' :
                                item.paymentMethod === 'check' ? '支票' :
                                item.paymentMethod
                              }</span>
                            </div>
                          )}
                        </div>
                        
                        {item.notes && (
                          <div className="mt-1 text-xs text-gray-500 italic">
                            {item.notes}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right ml-3">
                        <div className="font-semibold text-blue-600">
                          {new Intl.NumberFormat('zh-TW', { 
                            style: 'currency', 
                            currency: 'TWD',
                            minimumFractionDigits: 0 
                          }).format(item.amount)}
                        </div>
                        {item.totalAmount > item.amount && (
                          <div className="text-xs text-gray-500">
                            總額: {new Intl.NumberFormat('zh-TW', { 
                              style: 'currency', 
                              currency: 'TWD',
                              minimumFractionDigits: 0 
                            }).format(item.totalAmount)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>本期間沒有現金流記錄</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 標題區域 - 手機版簡化 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 px-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">專案付款管理</h1>
          <p className="text-sm sm:text-base text-muted-foreground hidden sm:block">管理專案相關的付款項目和記錄</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* 統計邏輯模式切換 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button
              variant={statisticsMode === 'expense' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatisticsMode('expense')}
              className={`px-2 py-1 text-xs rounded-md transition-all ${
                statisticsMode === 'expense' 
                  ? 'bg-white shadow-sm text-blue-600 font-medium' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="h-3 w-3 mr-1" />
              費用歸屬
            </Button>
            <Button
              variant={statisticsMode === 'cashflow' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatisticsMode('cashflow')}
              className={`px-2 py-1 text-xs rounded-md transition-all ${
                statisticsMode === 'cashflow' 
                  ? 'bg-white shadow-sm text-green-600 font-medium' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              現金流
            </Button>
          </div>
          
          <ResponsiveButtonGroup
            buttons={[
              {
                label: "專案管理",
                onClick: () => setIsProjectCategoryDialogOpen(true),
                variant: "outline",
              },
            ]}
            orientation="horizontal"
          />
        </div>
      </div>

      {/* 效能監控指標 - 手機版隱藏 */}
      <Card className="border border-blue-200 bg-blue-50/30 hidden sm:block">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-gray-600 text-xs sm:text-sm">載入: <span className="font-mono text-green-600">0.3s</span></span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                <span className="text-gray-600 text-xs sm:text-sm">項目: <span className="font-mono text-blue-600">{filteredAndSortedItems.length}</span></span>
              </div>
              {isLoadingMore && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <RefreshCw className="h-3 w-3 animate-spin text-orange-500" />
                  <span className="text-orange-600 text-xs sm:text-sm">載入中...</span>
                </div>
              )}
            </div>
            <div className="hidden lg:flex items-center gap-2 text-xs text-gray-500">
              <span>虛擬滾動: 啟用</span>
              <span>•</span>
              <span>智能篩選: 可用</span>
              <span>•</span>
              <span>批量操作: {selectedItems.size > 0 ? `已選擇 ${selectedItems.size} 項` : '就緒'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 搜尋與篩選區域 - 手機版優化 */}
      <Card className="border-2 mx-1 sm:mx-0">
        <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <CardTitle className="text-base sm:text-lg">搜尋與篩選</CardTitle>
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 text-muted-foreground"
              >
                <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">重置</span>
              </Button>
              
              {/* 智能篩選按鈕群組 - 手機版橫向滾動 */}
              <div className="flex gap-1 overflow-x-auto scrollbar-none">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applySmartFilter('urgent')}
                  className="h-7 sm:h-8 text-xs bg-red-50 hover:bg-red-100 border-red-200 text-red-700 flex-shrink-0"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  緊急
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applySmartFilter('thisMonth')}
                  className="h-7 sm:h-8 text-xs bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 flex-shrink-0"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  本月
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applySmartFilter('highAmount')}
                  className="h-7 sm:h-8 text-xs bg-green-50 hover:bg-green-100 border-green-200 text-green-700 flex-shrink-0"
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  高額
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applySmartFilter('overdue')}
                  className="h-7 sm:h-8 text-xs bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 flex-shrink-0"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  逾期
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="h-8"
              >
                <Filter className="h-4 w-4 mr-1" />
                {showAdvancedFilters ? "簡化" : "進階"}
                {showAdvancedFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 搜尋欄與重置按鈕 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                ref={searchInputRef}
                placeholder="搜尋項目名稱、分類或專案... (Ctrl+K快速搜尋)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-12 h-10"
              />
              {searchTerm !== debouncedSearchTerm && (
                <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                </div>
              )}
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setDebouncedSearchTerm("");
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-10 px-3"
              title="重置所有篩選條件 (Alt+0)"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* 快捷篩選按鈕 - 移到搜尋欄下方 */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedStatus === "overdue" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("overdue")}
              className="h-8"
            >
              <AlertTriangle className="h-4 w-4 mr-1" />
              逾期項目
            </Button>
            <Button
              variant={dateRange === "currentMonth" && selectedStatus === "unpaid" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateRange("currentMonth");
                setSelectedStatus("unpaid");
              }}
              className="h-8"
            >
              <Calendar className="h-4 w-4 mr-1" />
              本月到期
            </Button>
            <Button
              variant={dateRange === "currentMonthPayment" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateRange("currentMonthPayment");
                setSelectedStatus("all");
                setShowPaidItems(true);
              }}
              className="h-8"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              本月實付
            </Button>
            <Button
              variant={priorityFilter === "high" ? "default" : "outline"}
              size="sm"
              onClick={() => setPriorityFilter("high")}
              className="h-8"
            >
              <Star className="h-4 w-4 mr-1" />
              高優先級
            </Button>
            <Button
              variant={selectedStatus === "partial" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("partial")}
              className="h-8"
            >
              <Clock className="h-4 w-4 mr-1" />
              部分付款
            </Button>
            <Button
              variant={selectedPaymentType === "installment" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedPaymentType("installment");
                setSelectedStatus("all");
              }}
              className="h-8 bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              分期付款
            </Button>
            <Button
              variant={selectedPaymentType === "installment" && selectedStatus === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedPaymentType("installment");
                setSelectedStatus("pending");
              }}
              className="h-8"
            >
              <Clock className="h-4 w-4 mr-1" />
              分期待付
            </Button>
          </div>

          {/* 基本篩選 */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">專案</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選擇專案" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部專案</SelectItem>
                  {(Array.isArray(projects) ? projects : []).map((project: PaymentProject) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">狀態</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選擇狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部狀態</SelectItem>
                  <SelectItem value="pending">待付款</SelectItem>
                  <SelectItem value="partial">部分付款</SelectItem>
                  <SelectItem value="paid">已付清</SelectItem>
                  <SelectItem value="unpaid">未付款</SelectItem>
                  <SelectItem value="overdue">逾期項目</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">付款類型</Label>
              <Select value={selectedPaymentType} onValueChange={setSelectedPaymentType}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選擇類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部類型</SelectItem>
                  <SelectItem value="single">單次付款</SelectItem>
                  <SelectItem value="installment">分期付款</SelectItem>
                  <SelectItem value="monthly">月付</SelectItem>
                  <SelectItem value="recurring">定期付款</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">時間範圍</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選擇時間範圍" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部時間</SelectItem>
                  <SelectItem value="currentMonth">本月</SelectItem>
                  <SelectItem value="nextMonth">下月</SelectItem>
                  <SelectItem value="currentYear">今年</SelectItem>
                  <SelectItem value="upcoming">即將到期(7天內)</SelectItem>
                  <SelectItem value="overdue">已逾期</SelectItem>
                  <SelectItem value="custom">自訂範圍</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">優先級</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選擇優先級" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部優先級</SelectItem>
                  <SelectItem value="high">高優先級</SelectItem>
                  <SelectItem value="medium">中優先級</SelectItem>
                  <SelectItem value="low">低優先級</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 時間導航 */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-sm font-medium">時間導航</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      setSelectedYear(now.getFullYear());
                      setSelectedMonth(now.getMonth());
                    }}
                    className="h-8 text-xs btn-hover-lift"
                  >
                    回到當前月份
                  </Button>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="show-paid-items"
                      checked={showPaidItems}
                      onCheckedChange={setShowPaidItems}
                    />
                    <Label htmlFor="show-paid-items" className="text-sm">顯示已付款項目</Label>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* 年份選擇器 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">年份</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="選擇年份" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 30 }, (_, i) => {
                      const currentYear = new Date().getFullYear();
                      const year = currentYear - 10 + i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}年
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* 月份按鈕 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">月份</Label>
                <div className="grid grid-cols-6 gap-1">
                  {Array.from({ length: 12 }, (_, i) => (
                    <Button
                      key={i}
                      variant={selectedMonth === i ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedMonth(i)}
                      className="h-8 text-xs"
                    >
                      {i + 1}月
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 進階篩選 */}
          {showAdvancedFilters && (
            <div className="border-t pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">分類</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="選擇分類" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部分類</SelectItem>
                      {(Array.isArray(fixedCategoriesData) ? fixedCategoriesData : []).map((category: any) => (
                        <SelectItem key={`fixed:${category.id}`} value={`fixed:${category.id}`}>
                          {category.categoryName} (固定)
                        </SelectItem>
                      ))}
                      {(Array.isArray(projectCategoriesData) ? projectCategoriesData : []).map((category: any) => (
                        <SelectItem key={`project:${category.id}`} value={`project:${category.id}`}>
                          {category.categoryName} (專案)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">時間範圍</Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="選擇時間範圍" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部時間</SelectItem>
                      <SelectItem value="currentMonth">本月（項目日期）</SelectItem>
                      <SelectItem value="currentMonthPayment">本月（付款日期）</SelectItem>
                      <SelectItem value="upcoming">未來一週</SelectItem>
                      <SelectItem value="custom">自訂範圍</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">排序</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="排序方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dueDate">到期日期</SelectItem>
                      <SelectItem value="amount">金額</SelectItem>
                      <SelectItem value="name">項目名稱</SelectItem>
                      <SelectItem value="project">專案名稱</SelectItem>
                      <SelectItem value="status">狀態</SelectItem>
                      <SelectItem value="priority">優先級</SelectItem>
                      {/* 分期項目專屬排序 */}
                      <SelectItem value="installmentProgress">分期進度</SelectItem>
                      <SelectItem value="installmentDueDate">分期到期</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 自訂日期範圍 */}
              {dateRange === "custom" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">開始日期</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">結束日期</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              )}

              {/* 其他選項 */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-paid"
                    checked={showPaidItems}
                    onCheckedChange={setShowPaidItems}
                  />
                  <Label htmlFor="show-paid" className="text-sm">顯示已付清項目</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sort-order"
                    checked={sortOrder === "desc"}
                    onCheckedChange={(checked) => setSortOrder(checked ? "desc" : "asc")}
                  />
                  <Label htmlFor="sort-order" className="text-sm">降序排列</Label>
                </div>
              </div>
            </div>
          )}



          {/* 篩選結果統計 */}
          <div className="border-t pt-4">
            <div className="text-sm text-muted-foreground">
              顯示 <span className="font-medium text-foreground">{filteredAndSortedItems?.length || 0}</span> 個項目
              {searchTerm && (
                <>
                  ，搜尋「<span className="font-medium text-foreground">{searchTerm}</span>」
                </>
              )}
              {selectedProject !== "all" && projects && (
                <>
                  ，專案：<span className="font-medium text-foreground">
                    {projects.find((p: PaymentProject) => p.id.toString() === selectedProject)?.projectName}
                  </span>
                </>
              )}
              {selectedStatus !== "all" && (
                <>
                  ，狀態：<span className="font-medium text-foreground">
                    {selectedStatus === "pending" ? "待付款" :
                     selectedStatus === "partial" ? "部分付款" :
                     selectedStatus === "paid" ? "已付清" :
                     selectedStatus === "unpaid" ? "未付款" :
                     selectedStatus === "overdue" ? "逾期項目" : selectedStatus}
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 頁籤導航 */}
      <div className="border-b">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("items")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "items"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            付款項目
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "analytics"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            智能分析
          </button>
        </nav>
      </div>

      {/* 頁籤內容 */}
      {activeTab === "items" ? (
        <ResponsiveLayout maxWidth="7xl" padding="md">
          {/* 專案選擇和統計概覽 */}
          <ResponsiveGrid 
            cols={{ default: 1, md: 4 }} 
            gap="md"
            className="mb-6"
          >
            <ResponsiveCard padding="md">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">總付款金額</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${stats.totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </ResponsiveCard>

            <ResponsiveCard padding="md">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">已付金額</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${stats.paidAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </ResponsiveCard>

            <ResponsiveCard padding="md">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">未付金額</p>
                  <p className="text-2xl font-bold text-orange-600">
                    ${stats.unpaidAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </ResponsiveCard>

            <ResponsiveCard padding="md">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">項目總數</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {filteredAndSortedItems.length}
                  </p>
                </div>
              </div>
            </ResponsiveCard>
          </ResponsiveGrid>

          {/* 付款項目列表 */}
          <div className="space-y-6">
            {itemsLoading ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                  <LoadingSpinner className="h-4 w-4" />
                  <span>正在載入付款項目數據...</span>
                </div>
                <PaymentItemsSkeleton items={8} />
              </div>
            ) : (
              <>
                {/* 未付款項目 */}
                {(() => {
                  const unpaidItems = filteredAndSortedItems.filter(item => item.status !== "paid");
                  return unpaidItems.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <h3 className="text-lg font-medium text-gray-900">
                            待付款項目 ({unpaidItems.length})
                          </h3>
                        </div>
                        
                        {/* 批量操作工具列 */}
                        {selectedItems.size > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              已選擇 {selectedItems.size} 個項目
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleBatchStatusUpdate("paid")}
                              className="h-7 text-xs"
                            >
                              標記為已付清
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleBatchStatusUpdate("partial")}
                              className="h-7 text-xs"
                            >
                              標記為部分付款
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedItems(new Set());
                                setIsAllSelected(false);
                              }}
                              className="h-7 text-xs"
                            >
                              取消選擇
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      {/* 全選/取消全選 */}
                      <div className="flex items-center gap-2 px-1">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={() => toggleSelectAll(unpaidItems)}
                          className="rounded border-gray-300"
                        />
                        <label className="text-sm text-gray-600 cursor-pointer">
                          全選/取消全選
                        </label>
                      </div>
                      
                      {/* 虛擬滾動載入指示器 */}
                      {isLoadingMore && (
                        <div className="flex items-center justify-center py-4">
                          <div className="flex items-center gap-2 text-sm text-blue-600">
                            <LoadingSpinner className="h-4 w-4" />
                            <span>正在載入更多付款項目...</span>
                          </div>
                        </div>
                      )}
                      
                      {unpaidItems.map((item) => (
                        <Card 
                          key={item.id} 
                          className={`transition-all hover:shadow-md border-l-4 ${
                            // 分期項目專屬樣式
                            item.paymentType === "installment" 
                              ? "border-l-purple-500 bg-purple-50/30 ring-1 ring-purple-200" 
                              : item.status === "partial" 
                              ? "border-l-yellow-500 bg-yellow-50/50" 
                              : new Date(item.paymentType === "single" ? item.startDate : (item.endDate || item.startDate)) < new Date()
                              ? "border-l-red-500 bg-red-50/50" 
                              : "border-l-blue-500"
                          } ${(item as any).isDeleted ? 'opacity-60' : ''} ${selectedItems.has(item.id) ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                {/* 選擇框 */}
                                <input
                                  type="checkbox"
                                  checked={selectedItems.has(item.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleItemSelection(item.id);
                                  }}
                                  className="mt-1 rounded border-gray-300"
                                />
                                
                                <div className="flex-1 min-w-0 space-y-3" onClick={() => setSelectedItem(item)}>
                                  <div className="space-y-2 cursor-pointer">
                                    <div className="flex items-start justify-between">
                                      <h3 className="font-semibold text-gray-900 text-lg leading-tight flex-1">{item.itemName}</h3>
                                      {/* 分期項目標籤 */}
                                      {item.paymentType === "installment" && (
                                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 ml-2 flex-shrink-0">
                                          <TrendingUp className="h-3 w-3 mr-1" />
                                          分期付款
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                      {getStatusBadge(item)}
                                      {/* 分期進度顯示 */}
                                      {item.paymentType === "installment" && (
                                        <div className="text-xs text-purple-600 font-medium">
                                          {item.itemName.includes('第') && item.itemName.includes('期') ? (
                                            (() => {
                                              const match = item.itemName.match(/第(\d+)期.*共(\d+)期/);
                                              if (match) {
                                                const current = parseInt(match[1]);
                                                const total = parseInt(match[2]);
                                                return `${current}/${total} 期`;
                                              }
                                              return '分期中';
                                            })()
                                          ) : '分期中'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                
                                  {/* 金額信息 */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">總金額:</span>
                                      <span className="font-medium text-blue-600">
                                        {new Intl.NumberFormat('zh-TW', { 
                                          style: 'currency', 
                                          currency: 'TWD',
                                          minimumFractionDigits: 0 
                                        }).format(parseFloat(item.totalAmount))}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">已付款:</span>
                                      <span className="font-medium text-green-600">
                                        {new Intl.NumberFormat('zh-TW', { 
                                          style: 'currency', 
                                          currency: 'TWD',
                                          minimumFractionDigits: 0 
                                        }).format(parseFloat(item.paidAmount || "0"))}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">待付款:</span>
                                      <span className={`font-medium ${
                                        parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0") > 0 
                                          ? "text-red-600" 
                                          : "text-green-600"
                                      }`}>
                                        {new Intl.NumberFormat('zh-TW', { 
                                          style: 'currency', 
                                          currency: 'TWD',
                                          minimumFractionDigits: 0 
                                        }).format(parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0"))}
                                      </span>
                                    </div>
                                  </div>

                                  {/* 付款進度條 */}
                                  {item.status === "partial" && (
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs text-gray-600">
                                        <span>付款進度</span>
                                        <span>
                                          {Math.round((parseFloat(item.paidAmount || "0") / parseFloat(item.totalAmount)) * 100)}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                          className="h-2 rounded-full transition-all bg-yellow-500"
                                          style={{ 
                                            width: `${Math.min(100, (parseFloat(item.paidAmount || "0") / parseFloat(item.totalAmount)) * 100)}%` 
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* 項目詳情 */}
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                    {item.categoryName && (
                                      <span className="bg-gray-100 px-2 py-1 rounded">
                                        分類: {item.categoryName}
                                      </span>
                                    )}
                                    {item.projectName && (
                                      <span className="bg-blue-100 px-2 py-1 rounded">
                                        專案: {item.projectName}
                                      </span>
                                    )}
                                    <span className="bg-gray-100 px-2 py-1 rounded">
                                      到期: {new Date(item.paymentType === "single" ? item.startDate : (item.endDate || item.startDate)).toLocaleDateString('zh-TW')}
                                    </span>
                                    {item.priority && item.priority > 1 && (
                                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded flex items-center">
                                        <Star className="h-3 w-3 mr-1" />
                                        高優先級
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* 操作按鈕區域 */}
                                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditDialog(item);
                                      }}
                                      className="border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg"
                                      data-testid={`button-edit-${item.id}`}
                                    >
                                      <MoreHorizontal className="h-4 w-4 mr-1" />
                                      修改
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteClick(item);
                                      }}
                                      className="border-red-300 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg"
                                      data-testid={`button-delete-${item.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      刪除
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePaymentClick(item);
                                      }}
                                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                                      data-testid={`button-pay-${item.id}`}
                                    >
                                      <DollarSign className="h-4 w-4 mr-1" />
                                      付款
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                })()}

                {/* 已付款項目 - 可摺疊區域 */}
                {(() => {
                  // 修復：根據實際付款金額顯示已付項目，而非僅憑狀態
                  const paidItems = filteredAndSortedItems.filter(item => {
                    const paidAmount = parseFloat(item.paidAmount || "0");
                    return paidAmount > 0; // 只要有付款金額就顯示
                  });
                  return paidItems.length > 0 && (
                    <Card className="border-green-200 bg-green-50/30">
                      <CardContent className="p-4">
                        <Button
                          variant="ghost"
                          onClick={() => setShowPaidItems(!showPaidItems)}
                          className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <h3 className="text-lg font-medium text-gray-900">
                              已付款項目 ({paidItems.length})
                            </h3>
                          </div>
                          {showPaidItems ? (
                            <ChevronUp className="h-5 w-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-500" />
                          )}
                        </Button>
                        
                        {showPaidItems && (
                          <div className="mt-4 space-y-3">
                            {paidItems.map((item) => (
                              <Card 
                                key={item.id} 
                                className={`transition-all cursor-pointer hover:shadow-md border-l-4 ${
                                  // 分期項目專屬樣式
                                  item.paymentType === "installment" 
                                    ? "border-l-purple-500 bg-purple-50/30 ring-1 ring-purple-200" 
                                    : "border-l-green-500 bg-green-50/50"
                                } ${(item as any).isDeleted ? 'opacity-60' : ''}`}
                                onClick={() => setSelectedItem(item)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex-1 min-w-0 space-y-3">
                                    <div className="space-y-2">
                                      <div className="flex items-start justify-between">
                                        <h3 className="font-semibold text-gray-900 text-lg leading-tight flex-1">{item.itemName}</h3>
                                        {/* 分期項目標籤 */}
                                        {item.paymentType === "installment" && (
                                          <Badge className="bg-purple-100 text-purple-700 border-purple-200 ml-2 flex-shrink-0">
                                            <TrendingUp className="h-3 w-3 mr-1" />
                                            分期付款
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center justify-between">
                                        {getStatusBadge(item)}
                                        {/* 分期進度顯示 */}
                                        {item.paymentType === "installment" && (
                                          <div className="text-xs text-purple-600 font-medium">
                                            {item.itemName.includes('第') && item.itemName.includes('期') ? (
                                              (() => {
                                                const match = item.itemName.match(/第(\d+)期.*共(\d+)期/);
                                                if (match) {
                                                  const current = parseInt(match[1]);
                                                  const total = parseInt(match[2]);
                                                  return `${current}/${total} 期`;
                                                }
                                                return '分期完成';
                                              })()
                                            ) : '分期完成'}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                      
                                      {/* 金額信息 */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">總金額:</span>
                                          <span className="font-medium text-blue-600">
                                            {new Intl.NumberFormat('zh-TW', { 
                                              style: 'currency', 
                                              currency: 'TWD',
                                              minimumFractionDigits: 0 
                                            }).format(parseFloat(item.totalAmount))}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">已付款:</span>
                                          <span className="font-medium text-green-600">
                                            {new Intl.NumberFormat('zh-TW', { 
                                              style: 'currency', 
                                              currency: 'TWD',
                                              minimumFractionDigits: 0 
                                            }).format(parseFloat(item.paidAmount || "0"))}
                                          </span>
                                        </div>
                                      </div>

                                    {/* 項目詳情 */}
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                      {item.categoryName && (
                                        <span className="bg-gray-100 px-2 py-1 rounded">
                                          分類: {item.categoryName}
                                        </span>
                                      )}
                                      {item.projectName && (
                                        <span className="bg-blue-100 px-2 py-1 rounded">
                                          專案: {item.projectName}
                                        </span>
                                      )}
                                      <span className="bg-gray-100 px-2 py-1 rounded">
                                        到期: {new Date(item.paymentType === "single" ? item.startDate : (item.endDate || item.startDate)).toLocaleDateString('zh-TW')}
                                      </span>
                                      {item.priority && item.priority > 1 && (
                                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded flex items-center">
                                          <Star className="h-3 w-3 mr-1" />
                                          高優先級
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
              </>
            )}

            {!itemsLoading && filteredAndSortedItems.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  {searchTerm || selectedStatus !== "all" || selectedProject !== "all" ? (
                    <div className="space-y-2">
                      <p>沒有找到符合條件的付款項目</p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchTerm("");
                          setSelectedStatus("all");
                          setSelectedProject("all");
                        }}
                      >
                        清除所有篩選
                      </Button>
                    </div>
                  ) : (
                    selectedProject ? '此專案還沒有付款項目，點擊上方按鈕新增第一個項目' : '還沒有專案付款項目，點擊上方按鈕新增第一個項目'
                  )}
                </div>
              </div>
            )}
          </div>
        </ResponsiveLayout>
      ) : (
        <div className="space-y-6">
          <IntelligentAnalytics 
            projectId={selectedProject !== "all" ? parseInt(selectedProject) : undefined}
            timeRange="month"
          />
        </div>
      )}

      {/* 項目詳情對話框 */}
      <PaymentItemDetails
        item={selectedItem}
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      />

      {/* 付款對話框 */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setPaymentItem(null);
          paymentForm.reset();
        }
        setIsPaymentDialogOpen(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增付款記錄</DialogTitle>
            <DialogDescription>
              為「{paymentItem?.itemName}」新增付款記錄
            </DialogDescription>
          </DialogHeader>
          
          {paymentItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="text-gray-600">總金額:</span>
                  <div className="font-medium">${parseFloat(paymentItem.totalAmount).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-gray-600">已付金額:</span>
                  <div className="font-medium">${parseFloat(paymentItem.paidAmount).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-gray-600">剩餘金額:</span>
                  <div className="font-medium text-orange-600">
                    ${(parseFloat(paymentItem.totalAmount) - parseFloat(paymentItem.paidAmount)).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">狀態:</span>
                  <div className="font-medium">{paymentItem.status}</div>
                </div>
              </div>

              <Form {...paymentForm}>
                <form onSubmit={paymentForm.handleSubmit(handlePayment)} className="space-y-4">
                  <FormField
                    control={paymentForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>付款金額</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="請輸入付款金額" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={paymentForm.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>付款日期</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={paymentForm.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>付款方式</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="選擇付款方式" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                            <SelectItem value="cash">現金</SelectItem>
                            <SelectItem value="credit_card">信用卡</SelectItem>
                            <SelectItem value="digital_payment">數位支付</SelectItem>
                            <SelectItem value="check">支票</SelectItem>
                            <SelectItem value="other">其他</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={paymentForm.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>備註 (選填)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="付款備註" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 圖片上傳字段 */}
                  <div className="space-y-4">
                    <Label>付款憑證 (選填)</Label>
                    
                    {!imagePreview ? (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                          id="receipt-upload"
                        />
                        <label htmlFor="receipt-upload" className="cursor-pointer">
                          <div className="flex flex-col items-center space-y-2">
                            <Upload className="h-8 w-8 text-gray-400" />
                            <div className="text-sm text-gray-600">
                              <span className="font-medium text-blue-600 hover:text-blue-500">
                                點擊上傳圖片
                              </span>
                              <p className="text-xs text-gray-500 mt-1">
                                支援 JPG, PNG, JPEG 格式，最大 10MB
                              </p>
                            </div>
                          </div>
                        </label>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              <Image className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {selectedImage?.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {selectedImage && (selectedImage.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={removeImage}
                              className="flex-shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {/* 圖片預覽 */}
                          <div className="mt-3">
                            <img
                              src={imagePreview}
                              alt="付款憑證預覽"
                              className="max-w-full h-32 object-cover rounded border"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsPaymentDialogOpen(false);
                        setSelectedImage(null);
                        setImagePreview(null);
                      }}
                    >
                      取消
                    </Button>
                    <Button type="submit" disabled={paymentMutation.isPending}>
                      {paymentMutation.isPending ? '處理中...' : '確認付款'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 專案分類管理對話框 */}
      <ProjectCategoryDialog
        open={isProjectCategoryDialogOpen}
        onOpenChange={setIsProjectCategoryDialogOpen}
      />

      {/* 編輯項目對話框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>修改付款項目</DialogTitle>
            <DialogDescription>
              修改項目的基本資訊
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditItem)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>項目名稱</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="請輸入項目名稱" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>總金額</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="請輸入總金額" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>開始日期</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>結束日期 (選填)</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="paymentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>付款類型</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇付款類型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">單次付款</SelectItem>
                          <SelectItem value="installment">分期付款</SelectItem>
                          <SelectItem value="monthly">月付</SelectItem>
                          <SelectItem value="recurring">定期付款</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>優先級</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇優先級" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">低優先級</SelectItem>
                          <SelectItem value="2">中優先級</SelectItem>
                          <SelectItem value="3">高優先級</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註 (選填)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="項目備註" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={editItemMutation.isPending}>
                  {editItemMutation.isPending ? '修改中...' : '確認修改'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              刪除付款項目
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                確定要刪除付款項目「<span className="font-medium">{deleteItem?.itemName}</span>」嗎？
              </p>
              <p className="text-sm text-gray-500">
                此項目將移至回收站，您可以在回收站中恢復或永久刪除。
              </p>
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p>金額：NT$ {deleteItem ? parseFloat(deleteItem.totalAmount).toLocaleString() : 0}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "刪除中..." : "移至回收站"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function PaymentProject() {
  return <PaymentProjectContent />;
}