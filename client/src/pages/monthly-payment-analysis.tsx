import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon, AlertTriangleIcon, CheckCircleIcon, ClockIcon, CreditCard, Upload, X, Image, Search, Filter, SortAsc, SortDesc, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

import { useToast } from "@/hooks/use-toast";

const paymentRecordSchema = z.object({
  amount: z.string().min(1, "付款金額為必填"),
  paymentDate: z.string().min(1, "付款日期為必填"),
  paymentMethod: z.string().min(1, "付款方式為必填"),
  notes: z.string().optional(),
  receiptImage: z.any().optional(),
});

type PaymentRecordInput = z.infer<typeof paymentRecordSchema>;

interface PaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  startDate: string;
  projectName: string;
  categoryName: string;
  status: string;
}

interface MonthlyAnalysis {
  currentMonth: {
    year: number;
    month: number;
    due: {
      count: number;
      totalAmount: string;
      items: PaymentItem[];
    };
    paid: {
      count: number;
      totalAmount: string;
    };
  };
  overdue: {
    count: number;
    totalAmount: string;
    items: PaymentItem[];
  };
}

export default function MonthlyPaymentAnalysis() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedPaymentItem, setSelectedPaymentItem] = useState<PaymentItem | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // 分頁和篩選狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");
  const [sortBy, setSortBy] = useState("startDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  // 逾期項目的篩選狀態
  const [overdueSearchKeyword, setOverdueSearchKeyword] = useState("");
  const [overdueCurrentPage, setOverdueCurrentPage] = useState(1);
  const [overdueSelectedCategory, setOverdueSelectedCategory] = useState("all");
  const [overdueSelectedProject, setOverdueSelectedProject] = useState("all");
  const [overdueSortBy, setOverdueSortBy] = useState("startDate");
  const [overdueSortOrder, setOverdueSortOrder] = useState<"asc" | "desc">("desc");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<PaymentRecordInput>({
    resolver: zodResolver(paymentRecordSchema),
    defaultValues: {
      amount: "",
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: "bank_transfer",
      notes: "",
    },
  });

  const { data: analysis, isLoading } = useQuery<MonthlyAnalysis>({
    queryKey: ["/api/payment/monthly-analysis", selectedYear, selectedMonth],
    queryFn: async () => {
      const response = await fetch(`/api/payment/monthly-analysis?year=${selectedYear}&month=${selectedMonth}`);
      if (!response.ok) throw new Error('Failed to fetch analysis');
      return response.json();
    }
  });

  const { data: categories } = useQuery({
    queryKey: ["/api/categories/project"],
  });

  const { data: projects } = useQuery({
    queryKey: ["/api/payment/projects"],
  });

  // 篩選和分頁邏輯
  const filteredAndSortedItems = useMemo(() => {
    if (!analysis?.currentMonth.due.items) return [];
    
    let items = [...analysis.currentMonth.due.items];
    
    // 搜尋篩選
    if (searchKeyword) {
      items = items.filter(item => 
        item.itemName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        item.projectName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        item.categoryName.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    }
    
    // 分類篩選
    if (selectedCategory !== "all") {
      items = items.filter(item => item.categoryName === selectedCategory);
    }
    
    // 專案篩選
    if (selectedProject !== "all") {
      items = items.filter(item => item.projectName === selectedProject);
    }
    
    // 排序
    items.sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case "startDate":
          aValue = new Date(a.startDate).getTime();
          bValue = new Date(b.startDate).getTime();
          break;
        case "remainingAmount":
          aValue = parseFloat(a.remainingAmount);
          bValue = parseFloat(b.remainingAmount);
          break;
        case "itemName":
          aValue = a.itemName.toLowerCase();
          bValue = b.itemName.toLowerCase();
          break;
        default:
          aValue = a.itemName.toLowerCase();
          bValue = b.itemName.toLowerCase();
      }
      
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return items;
  }, [analysis?.currentMonth.due.items, searchKeyword, selectedCategory, selectedProject, sortBy, sortOrder]);

  // 分頁計算
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);
  const paginatedItems = filteredAndSortedItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 逾期項目的篩選和分頁邏輯
  const filteredOverdueItems = useMemo(() => {
    if (!analysis?.overdue.items) return [];
    
    let items = [...analysis.overdue.items];
    
    // 搜尋篩選
    if (overdueSearchKeyword) {
      items = items.filter(item => 
        item.itemName.toLowerCase().includes(overdueSearchKeyword.toLowerCase()) ||
        item.projectName.toLowerCase().includes(overdueSearchKeyword.toLowerCase()) ||
        item.categoryName.toLowerCase().includes(overdueSearchKeyword.toLowerCase())
      );
    }
    
    // 分類篩選
    if (overdueSelectedCategory !== "all") {
      items = items.filter(item => item.categoryName === overdueSelectedCategory);
    }
    
    // 專案篩選
    if (overdueSelectedProject !== "all") {
      items = items.filter(item => item.projectName === overdueSelectedProject);
    }
    
    // 排序
    items.sort((a, b) => {
      let aValue, bValue;
      switch (overdueSortBy) {
        case "startDate":
          aValue = new Date(a.startDate).getTime();
          bValue = new Date(b.startDate).getTime();
          break;
        case "remainingAmount":
          aValue = parseFloat(a.remainingAmount);
          bValue = parseFloat(b.remainingAmount);
          break;
        case "itemName":
          aValue = a.itemName.toLowerCase();
          bValue = b.itemName.toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (overdueSortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return items;
  }, [analysis?.overdue.items, overdueSearchKeyword, overdueSelectedCategory, overdueSelectedProject, overdueSortBy, overdueSortOrder]);

  const overdueTotalPages = Math.ceil(filteredOverdueItems.length / itemsPerPage);
  const paginatedOverdueItems = filteredOverdueItems.slice(
    (overdueCurrentPage - 1) * itemsPerPage,
    overdueCurrentPage * itemsPerPage
  );

  // 重置分頁當篩選條件改變
  const resetToFirstPage = () => {
    setCurrentPage(1);
  };

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentRecordInput & { itemId: number }) => {
      const formData = new FormData();
      formData.append("itemId", data.itemId.toString());
      formData.append("amount", data.amount);
      formData.append("paymentDate", data.paymentDate);
      formData.append("paymentMethod", data.paymentMethod);
      if (data.notes) formData.append("notes", data.notes);
      if (selectedImage) formData.append("receiptImage", selectedImage);
      
      return fetch("/api/payment/records", {
        method: "POST",
        body: formData,
      }).then(res => {
        if (!res.ok) throw new Error("付款記錄創建失敗");
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: "付款記錄已建立",
        description: "付款記錄已成功建立",
      });
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

  const handlePaymentSubmit = (data: PaymentRecordInput) => {
    if (!selectedPaymentItem) return;
    
    createPaymentMutation.mutate({
      ...data,
      itemId: selectedPaymentItem.id,
    });
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
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
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const openPaymentDialog = (item: PaymentItem) => {
    setSelectedPaymentItem(item);
    form.setValue("amount", item.remainingAmount);
    setSelectedImage(null);
    setImagePreview(null);
    setIsPaymentDialogOpen(true);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const formatAmount = (amount: string | number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0
    }).format(Number(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-TW');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    
      <div className="space-y-8">
        {/* Clean Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900">月度付款分析</h1>
              <p className="text-sm sm:text-lg text-gray-600 mt-1">查看本月應付款、已付款和逾期未付款項目</p>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-2 bg-gray-50 rounded-lg p-2">
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number(value))}>
                <SelectTrigger className="w-20 h-8 border-0 bg-white shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-gray-500 text-sm">年</span>
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(Number(value))}>
                <SelectTrigger className="w-16 h-8 border-0 bg-white shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                    <SelectItem key={month} value={month.toString()}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-gray-500 text-sm">月</span>
            </div>
          </div>
        </div>

        {/* Clean Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100/50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-medium text-orange-700 mb-1 sm:mb-2">本月應付款</p>
                  <p className="text-xl sm:text-3xl font-bold text-orange-900 truncate">
                    {formatAmount(analysis?.currentMonth.due.totalAmount || 0)}
                  </p>
                  <p className="text-sm text-orange-600 mt-1">
                    {analysis?.currentMonth.due.count || 0} 個項目
                  </p>
                </div>
                <div className="h-12 w-12 sm:h-14 sm:w-14 bg-orange-200 rounded-full flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                  <ClockIcon className="h-6 w-6 sm:h-7 sm:w-7 text-orange-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-medium text-green-700 mb-1 sm:mb-2">本月已付款</p>
                  <p className="text-xl sm:text-3xl font-bold text-green-900 truncate">
                    {formatAmount(analysis?.currentMonth.paid.totalAmount || 0)}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    {analysis?.currentMonth.paid.count || 0} 個項目
                  </p>
                </div>
                <div className="h-12 w-12 sm:h-14 sm:w-14 bg-green-200 rounded-full flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                  <CheckCircleIcon className="h-6 w-6 sm:h-7 sm:w-7 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100/50 sm:col-span-2 lg:col-span-1">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-medium text-red-700 mb-1 sm:mb-2">逾期未付款</p>
                  <p className="text-xl sm:text-3xl font-bold text-red-900 truncate">
                    {formatAmount(analysis?.overdue.totalAmount || 0)}
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    {analysis?.overdue.count || 0} 個項目
                  </p>
                </div>
                <div className="h-12 w-12 sm:h-14 sm:w-14 bg-red-200 rounded-full flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                  <AlertTriangleIcon className="h-6 w-6 sm:h-7 sm:w-7 text-red-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        {analysis?.currentMonth.due.items && analysis.currentMonth.due.items.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">本月應付款項目</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>顯示 {filteredAndSortedItems.length} / {analysis.currentMonth.due.count} 項目</span>
                </div>
              </div>
              
              {/* Search and Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search */}
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="搜尋項目名稱、專案或分類..."
                    value={searchKeyword}
                    onChange={(e) => {
                      setSearchKeyword(e.target.value);
                      resetToFirstPage();
                    }}
                    className="pl-10"
                  />
                </div>
                
                {/* Category Filter */}
                <Select value={selectedCategory} onValueChange={(value) => {
                  setSelectedCategory(value);
                  resetToFirstPage();
                }}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="選擇分類" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有分類</SelectItem>
                    {Array.isArray(categories) && categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.categoryName}>
                        {cat.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Project Filter */}
                <Select value={selectedProject} onValueChange={(value) => {
                  setSelectedProject(value);
                  resetToFirstPage();
                }}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="選擇專案" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有專案</SelectItem>
                    {Array.isArray(projects) && projects.map((proj: any) => (
                      <SelectItem key={proj.id} value={proj.projectName}>
                        {proj.projectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Sort */}
                <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                  const [field, order] = value.split('-');
                  setSortBy(field);
                  setSortOrder(order as "asc" | "desc");
                }}>
                  <SelectTrigger>
                    {sortOrder === 'asc' ? <SortAsc className="h-4 w-4 mr-2" /> : <SortDesc className="h-4 w-4 mr-2" />}
                    <SelectValue placeholder="排序" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startDate-desc">到期日 (最新)</SelectItem>
                    <SelectItem value="startDate-asc">到期日 (最舊)</SelectItem>
                    <SelectItem value="remainingAmount-desc">剩餘金額 (高到低)</SelectItem>
                    <SelectItem value="remainingAmount-asc">剩餘金額 (低到高)</SelectItem>
                    <SelectItem value="itemName-asc">項目名稱 (A-Z)</SelectItem>
                    <SelectItem value="itemName-desc">項目名稱 (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Payment Items List with Pagination */}
        {filteredAndSortedItems.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {paginatedItems.map((item) => (
                <div key={item.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                  {/* Mobile Layout */}
                  <div className="block sm:hidden space-y-3">
                    <div>
                      <h4 className="text-base font-medium text-gray-900 mb-2">{item.itemName}</h4>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {item.projectName}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {item.categoryName}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">
                        到期日：{formatDate(item.startDate)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold text-orange-600">
                          {formatAmount(item.remainingAmount)}
                        </p>
                        <p className="text-sm text-gray-500">
                          總額 {formatAmount(item.totalAmount)}
                        </p>
                      </div>
                      <Button
                        onClick={() => openPaymentDialog(item)}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        付款
                      </Button>
                    </div>
                  </div>
                  
                  {/* Desktop Layout */}
                  <div className="hidden sm:flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900 truncate">{item.itemName}</h4>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {item.projectName}
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                          {item.categoryName}
                        </span>
                      </div>
                      <p className="text-base text-gray-600">
                        到期日：{formatDate(item.startDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 ml-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-orange-600">
                          {formatAmount(item.remainingAmount)}
                        </p>
                        <p className="text-base text-gray-500">
                          總額 {formatAmount(item.totalAmount)}
                        </p>
                      </div>
                      <Button
                        onClick={() => openPaymentDialog(item)}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-3 text-base font-medium rounded-lg transition-colors"
                      >
                        <CreditCard className="h-5 w-5 mr-2" />
                        付款
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    顯示第 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedItems.length)} 項，共 {filteredAndSortedItems.length} 項
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="h-8 w-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Clean Overdue Payments List */}
        {analysis?.overdue.items && analysis.overdue.items.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-red-50 border-b border-red-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangleIcon className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold text-red-900">逾期未付款項目</h3>
                    <p className="text-sm sm:text-base text-red-700">{analysis.overdue.count} 個項目已逾期</p>
                  </div>
                </div>
              </div>
              
              {/* Search and Filters for Overdue Items */}
              <div className="mt-4 space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜尋逾期項目名稱、專案或分類..."
                    value={overdueSearchKeyword}
                    onChange={(e) => {
                      setOverdueSearchKeyword(e.target.value);
                      setOverdueCurrentPage(1);
                    }}
                    className="pl-10 h-10 bg-white border-gray-300 focus:border-red-500 focus:ring-red-500"
                  />
                </div>
                
                {/* Filters Row */}
                <div className="flex flex-wrap gap-3">
                  {/* Category Filter */}
                  <Select 
                    value={overdueSelectedCategory} 
                    onValueChange={(value) => {
                      setOverdueSelectedCategory(value);
                      setOverdueCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-auto min-w-[140px] h-9 bg-white border-gray-300">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="選擇分類" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有分類</SelectItem>
                      {Array.isArray(categories) && categories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.categoryName}>
                          {cat.categoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Project Filter */}
                  <Select 
                    value={overdueSelectedProject} 
                    onValueChange={(value) => {
                      setOverdueSelectedProject(value);
                      setOverdueCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-auto min-w-[140px] h-9 bg-white border-gray-300">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="選擇專案" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有專案</SelectItem>
                      {Array.isArray(projects) && projects.map((proj: any) => (
                        <SelectItem key={proj.id} value={proj.projectName}>
                          {proj.projectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Sort */}
                  <Select 
                    value={`${overdueSortBy}-${overdueSortOrder}`} 
                    onValueChange={(value) => {
                      const [sortBy, sortOrder] = value.split('-');
                      setOverdueSortBy(sortBy);
                      setOverdueSortOrder(sortOrder as "asc" | "desc");
                      setOverdueCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-auto min-w-[140px] h-9 bg-white border-gray-300">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="排序方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="startDate-desc">到期日 (新到舊)</SelectItem>
                      <SelectItem value="startDate-asc">到期日 (舊到新)</SelectItem>
                      <SelectItem value="remainingAmount-desc">金額 (高到低)</SelectItem>
                      <SelectItem value="remainingAmount-asc">金額 (低到高)</SelectItem>
                      <SelectItem value="itemName-asc">名稱 (A-Z)</SelectItem>
                      <SelectItem value="itemName-desc">名稱 (Z-A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {paginatedOverdueItems.map((item) => (
                <div key={item.id} className="p-4 sm:p-6 bg-red-50/30 hover:bg-red-50/50 transition-colors">
                  {/* Mobile Layout */}
                  <div className="block sm:hidden space-y-3">
                    <div>
                      <h4 className="text-base font-medium text-gray-900 mb-2">{item.itemName}</h4>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {item.projectName}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {item.categoryName}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          逾期
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">
                        到期日：{formatDate(item.startDate)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-center flex-1">
                        <p className="text-lg font-semibold text-red-600">
                          {formatAmount(item.remainingAmount)}
                        </p>
                        <p className="text-sm text-gray-500">
                          總額 {formatAmount(item.totalAmount)}
                        </p>
                      </div>
                      <Button
                        onClick={() => openPaymentDialog(item)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-medium rounded-lg transition-colors ml-4"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        付款
                      </Button>
                    </div>
                  </div>
                  
                  {/* Desktop Layout */}
                  <div className="hidden sm:flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900 truncate">{item.itemName}</h4>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {item.projectName}
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                          {item.categoryName}
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                          逾期
                        </span>
                      </div>
                      <p className="text-base text-gray-600">
                        到期日：{formatDate(item.startDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 ml-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-red-600">
                          {formatAmount(item.remainingAmount)}
                        </p>
                        <p className="text-base text-gray-500">
                          總額 {formatAmount(item.totalAmount)}
                        </p>
                      </div>
                      <Button
                        onClick={() => openPaymentDialog(item)}
                        className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 text-base font-medium rounded-lg transition-colors"
                      >
                        <CreditCard className="h-5 w-5 mr-2" />
                        付款
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls for Overdue Items */}
            {overdueTotalPages > 1 && (
              <div className="px-6 py-4 bg-red-50 border-t border-red-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-red-700">
                    顯示第 {(overdueCurrentPage - 1) * itemsPerPage + 1} - {Math.min(overdueCurrentPage * itemsPerPage, filteredOverdueItems.length)} 項，共 {filteredOverdueItems.length} 項
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOverdueCurrentPage(Math.max(1, overdueCurrentPage - 1))}
                      disabled={overdueCurrentPage === 1}
                      className="h-8 w-8 p-0 border-red-300 hover:bg-red-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, overdueTotalPages) }, (_, i) => {
                        let pageNum;
                        if (overdueTotalPages <= 5) {
                          pageNum = i + 1;
                        } else if (overdueCurrentPage <= 3) {
                          pageNum = i + 1;
                        } else if (overdueCurrentPage >= overdueTotalPages - 2) {
                          pageNum = overdueTotalPages - 4 + i;
                        } else {
                          pageNum = overdueCurrentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={overdueCurrentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setOverdueCurrentPage(pageNum)}
                            className={`h-8 w-8 p-0 ${overdueCurrentPage === pageNum 
                              ? "bg-red-600 hover:bg-red-700 text-white" 
                              : "border-red-300 hover:bg-red-50"
                            }`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOverdueCurrentPage(Math.min(overdueTotalPages, overdueCurrentPage + 1))}
                      disabled={overdueCurrentPage === overdueTotalPages}
                      className="h-8 w-8 p-0 border-red-300 hover:bg-red-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Clean Empty State */}
        {(!analysis?.currentMonth.due.items?.length && !analysis?.overdue.items?.length) && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">暫無付款項目</h3>
            <p className="text-gray-600">
              {selectedYear}年{selectedMonth}月沒有需要付款的項目
            </p>
          </div>
        )}

      {/* 付款記錄對話框 */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>記錄付款</DialogTitle>
            <DialogDescription>
              為「{selectedPaymentItem?.itemName}」記錄付款
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePaymentSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>付款金額</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>付款日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
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
                        <SelectItem value="check">支票</SelectItem>
                        <SelectItem value="other">其他</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註 (選填)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="付款相關備註..." 
                        {...field} 
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 圖片上傳區域 */}
              <div className="space-y-2">
                <Label>付款單據圖片（選填）</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  {imagePreview ? (
                    <div className="relative">
                      <img 
                        src={imagePreview} 
                        alt="付款單據預覽" 
                        className="max-w-full h-auto max-h-48 mx-auto rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={removeImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <p className="text-sm text-gray-600 mt-2 text-center">
                        {selectedImage?.name}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-2">
                        <label className="cursor-pointer">
                          <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                            點擊上傳圖片
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageSelect}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        支援 PNG、JPG、JPEG 格式，最大 10MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsPaymentDialogOpen(false)}
                >
                  取消
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPaymentMutation.isPending}
                >
                  {createPaymentMutation.isPending ? "處理中..." : "確認付款"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
    
  );
}