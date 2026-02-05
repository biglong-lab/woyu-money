import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";

import {
  StatisticsCards,
  PaymentItemFilter,
  PaymentItemRow,
  PaginationControls,
  OverduePaymentList,
  PaymentRecordDialog,
  paymentRecordSchema,
  filterItems,
  sortItems,
  paginateItems,
} from "@/components/monthly-payment-analysis";
import type {
  PaymentItem,
  MonthlyAnalysis,
  PaymentRecordInput,
  SortOrder,
} from "@/components/monthly-payment-analysis";

// 每頁顯示項目數
const ITEMS_PER_PAGE = 10;

export default function MonthlyPaymentAnalysis() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  // 付款對話框狀態
  const [selectedPaymentItem, setSelectedPaymentItem] = useState<PaymentItem | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // 本月應付項目的篩選和分頁狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");
  const [sortBy, setSortBy] = useState("startDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // 逾期項目的篩選和分頁狀態
  const [overdueCurrentPage, setOverdueCurrentPage] = useState(1);
  const [overdueSearchKeyword, setOverdueSearchKeyword] = useState("");
  const [overdueSelectedCategory, setOverdueSelectedCategory] = useState("all");
  const [overdueSelectedProject, setOverdueSelectedProject] = useState("all");
  const [overdueSortBy, setOverdueSortBy] = useState("startDate");
  const [overdueSortOrder, setOverdueSortOrder] = useState<SortOrder>("desc");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 表單初始化
  const form = useForm<PaymentRecordInput>({
    resolver: zodResolver(paymentRecordSchema),
    defaultValues: {
      amount: "",
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "bank_transfer",
      notes: "",
    },
  });

  // API 查詢：月度分析資料
  const { data: analysis, isLoading } = useQuery<MonthlyAnalysis>({
    queryKey: ["/api/payment/monthly-analysis", selectedYear, selectedMonth],
    queryFn: async () => {
      const response = await fetch(
        `/api/payment/monthly-analysis?year=${selectedYear}&month=${selectedMonth}`
      );
      if (!response.ok) throw new Error("Failed to fetch analysis");
      return response.json();
    },
  });

  // API 查詢：分類和專案清單
  const { data: categories } = useQuery({ queryKey: ["/api/categories/project"] });
  const { data: projects } = useQuery({ queryKey: ["/api/payment/projects"] });

  // 安全的分類/專案陣列
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  // 本月應付項目的篩選、排序和分頁
  const filteredAndSortedItems = useMemo(() => {
    const items = analysis?.currentMonth.due.items ?? [];
    const filtered = filterItems(items, searchKeyword, selectedCategory, selectedProject);
    return sortItems(filtered, sortBy, sortOrder);
  }, [analysis?.currentMonth.due.items, searchKeyword, selectedCategory, selectedProject, sortBy, sortOrder]);

  const { paginatedItems, totalPages } = paginateItems(
    filteredAndSortedItems,
    currentPage,
    ITEMS_PER_PAGE
  );

  // 逾期項目的篩選、排序和分頁
  const filteredOverdueItems = useMemo(() => {
    const items = analysis?.overdue.items ?? [];
    const filtered = filterItems(items, overdueSearchKeyword, overdueSelectedCategory, overdueSelectedProject);
    return sortItems(filtered, overdueSortBy, overdueSortOrder);
  }, [analysis?.overdue.items, overdueSearchKeyword, overdueSelectedCategory, overdueSelectedProject, overdueSortBy, overdueSortOrder]);

  const {
    paginatedItems: paginatedOverdueItems,
    totalPages: overdueTotalPages,
  } = paginateItems(filteredOverdueItems, overdueCurrentPage, ITEMS_PER_PAGE);

  // 建立付款記錄 mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentRecordInput & { itemId: number }) => {
      const formData = new FormData();
      formData.append("itemId", data.itemId.toString());
      formData.append("amount", data.amount);
      formData.append("paymentDate", data.paymentDate);
      formData.append("paymentMethod", data.paymentMethod);
      if (data.notes) formData.append("notes", data.notes);
      if (selectedImage) formData.append("receiptImage", selectedImage);

      const res = await fetch("/api/payment/records", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("付款記錄創建失敗");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "付款記錄已建立", description: "付款記錄已成功建立" });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/monthly-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsPaymentDialogOpen(false);
      form.reset();
      setSelectedPaymentItem(null);
      setSelectedImage(null);
      setImagePreview(null);
    },
    onError: (error: Error) => {
      toast({
        title: "建立付款記錄失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 事件處理函式
  const handlePaymentSubmit = (data: PaymentRecordInput) => {
    if (!selectedPaymentItem) return;
    createPaymentMutation.mutate({ ...data, itemId: selectedPaymentItem.id });
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "檔案過大",
        description: "圖片檔案大小不能超過 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const openPaymentDialog = (item: PaymentItem) => {
    setSelectedPaymentItem(item);
    form.setValue("amount", item.remainingAmount);
    setSelectedImage(null);
    setImagePreview(null);
    setIsPaymentDialogOpen(true);
  };

  // 重置分頁至第一頁（篩選條件變更時）
  const resetCurrentPage = () => setCurrentPage(1);
  const resetOverduePage = () => setOverdueCurrentPage(1);

  // 載入中骨架畫面
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 頁面標題與年月選擇器 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
              月度付款分析
            </h1>
            <p className="text-sm sm:text-lg text-gray-600 mt-1">
              查看本月應付款、已付款和逾期未付款項目
            </p>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-2 bg-gray-50 rounded-lg p-2">
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(Number(value))}
            >
              <SelectTrigger className="w-20 h-8 border-0 bg-white shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-gray-500 text-sm">年</span>
            <Select
              value={selectedMonth.toString()}
              onValueChange={(value) => setSelectedMonth(Number(value))}
            >
              <SelectTrigger className="w-16 h-8 border-0 bg-white shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <SelectItem key={month} value={month.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-gray-500 text-sm">月</span>
          </div>
        </div>
      </div>

      {/* 統計卡片 */}
      <StatisticsCards analysis={analysis} />

      {/* 本月應付款項目篩選區 */}
      {analysis?.currentMonth.due.items &&
        analysis.currentMonth.due.items.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                  本月應付款項目
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>
                    顯示 {filteredAndSortedItems.length} /{" "}
                    {analysis.currentMonth.due.count} 項目
                  </span>
                </div>
              </div>
              <PaymentItemFilter
                searchKeyword={searchKeyword}
                onSearchChange={(v) => { setSearchKeyword(v); resetCurrentPage(); }}
                selectedCategory={selectedCategory}
                onCategoryChange={(v) => { setSelectedCategory(v); resetCurrentPage(); }}
                categories={safeCategories}
                selectedProject={selectedProject}
                onProjectChange={(v) => { setSelectedProject(v); resetCurrentPage(); }}
                projects={safeProjects}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={(field, order) => { setSortBy(field); setSortOrder(order); }}
              />
            </div>
          </div>
        )}

      {/* 本月應付款項目列表（含分頁） */}
      {filteredAndSortedItems.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {paginatedItems.map((item) => (
              <PaymentItemRow
                key={item.id}
                item={item}
                onPayClick={openPaymentDialog}
              />
            ))}
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredAndSortedItems.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* 逾期未付款項目列表 */}
      {analysis?.overdue.items && analysis.overdue.items.length > 0 && (
        <OverduePaymentList
          overdueCount={analysis.overdue.count}
          paginatedItems={paginatedOverdueItems}
          totalFilteredItems={filteredOverdueItems.length}
          searchKeyword={overdueSearchKeyword}
          onSearchChange={(v) => { setOverdueSearchKeyword(v); resetOverduePage(); }}
          selectedCategory={overdueSelectedCategory}
          onCategoryChange={(v) => { setOverdueSelectedCategory(v); resetOverduePage(); }}
          selectedProject={overdueSelectedProject}
          onProjectChange={(v) => { setOverdueSelectedProject(v); resetOverduePage(); }}
          sortBy={overdueSortBy}
          sortOrder={overdueSortOrder}
          onSortChange={(field, order) => {
            setOverdueSortBy(field);
            setOverdueSortOrder(order);
            resetOverduePage();
          }}
          currentPage={overdueCurrentPage}
          totalPages={overdueTotalPages}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setOverdueCurrentPage}
          categories={safeCategories}
          projects={safeProjects}
          onPayClick={openPaymentDialog}
        />
      )}

      {/* 空狀態 */}
      {!analysis?.currentMonth.due.items?.length &&
        !analysis?.overdue.items?.length && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              暫無付款項目
            </h3>
            <p className="text-gray-600">
              {selectedYear}年{selectedMonth}月沒有需要付款的項目
            </p>
          </div>
        )}

      {/* 付款記錄對話框 */}
      <PaymentRecordDialog
        isOpen={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        selectedItem={selectedPaymentItem}
        form={form}
        onSubmit={handlePaymentSubmit}
        isPending={createPaymentMutation.isPending}
        imagePreview={imagePreview}
        selectedImageName={selectedImage?.name}
        onImageSelect={handleImageSelect}
        onImageRemove={() => {
          setSelectedImage(null);
          setImagePreview(null);
        }}
      />
    </div>
  );
}
