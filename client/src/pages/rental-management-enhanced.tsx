import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Calendar, DollarSign, Building2, Edit, Trash2, Play, Pause, Download, Upload, FileText, Eye, Settings, RefreshCw, AlertTriangle, CheckCircle, Clock, TrendingUp, Search, Filter, SortAsc, SortDesc, X, Info } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

// 租約表單驗證
const rentalContractSchema = z.object({
  projectId: z.number().min(1, "請選擇專案"),
  contractName: z.string().min(1, "請輸入租約名稱"),
  startDate: z.string().min(1, "請選擇開始日期"),
  endDate: z.string().min(1, "請選擇結束日期"),
  totalYears: z.number().min(1, "租約年數至少1年"),
  baseAmount: z.number().min(0, "基礎金額不能為負數"),
  hasBufferPeriod: z.boolean().default(false),
  bufferMonths: z.number().min(0, "緩衝期月數不能為負數").default(0),
  bufferIncludedInTerm: z.boolean().default(true),
  notes: z.string().optional(),
  priceTiers: z.array(z.object({
    yearStart: z.number().min(1),
    yearEnd: z.number().min(1),
    monthlyAmount: z.number().min(0),
  })).min(1, "請至少添加一個價格階段"),
});

type RentalContractForm = z.infer<typeof rentalContractSchema>;

export default function RentalManagementEnhanced() {
  // 主要導航狀態
  const [activeTab, setActiveTab] = useState("contracts");
  
  // 對話框狀態
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [isPaymentInfoDialogOpen, setIsPaymentInfoDialogOpen] = useState(false);
  const [isSmartAdjustDialogOpen, setIsSmartAdjustDialogOpen] = useState(false);
  const [isContractDetailsDialogOpen, setIsContractDetailsDialogOpen] = useState(false);
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(false);
  const [isDocumentViewOpen, setIsDocumentViewOpen] = useState(false);
  
  // 編輯和查看狀態
  const [editingContract, setEditingContract] = useState<any>(null);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [viewingContract, setViewingContract] = useState<any>(null);
  const [viewingPayment, setViewingPayment] = useState<any>(null);
  const [viewingDocument, setViewingDocument] = useState<any>(null);
  
  // 表單和資料狀態
  const [priceTiers, setPriceTiers] = useState<any[]>([{ yearStart: 1, yearEnd: 3, monthlyAmount: 0 }]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadVersion, setUploadVersion] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [adjustmentPreview, setAdjustmentPreview] = useState<any>(null);
  
  // 付款項目過濾和搜尋狀態
  const [paymentSearchTerm, setPaymentSearchTerm] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [paymentProjectFilter, setPaymentProjectFilter] = useState<string>("all");
  const [paymentSortBy, setPaymentSortBy] = useState<string>("date");
  const [paymentSortOrder, setPaymentSortOrder] = useState<string>("desc");
  
  // 分頁狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // 租約詳情頁籤狀態
  const [contractDetailsTab, setContractDetailsTab] = useState("details");
  const [monthlyPaymentYear, setMonthlyPaymentYear] = useState(new Date().getFullYear());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 當查看的租約改變時，更新月付記錄的預設年份為合約開始年份
  useEffect(() => {
    if (viewingContract?.startDate) {
      const contractStartYear = new Date(viewingContract.startDate).getFullYear();
      setMonthlyPaymentYear(contractStartYear);
    }
  }, [viewingContract]);

  // 查詢數據
  const { data: contracts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/rental/contracts"],
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/payment/projects"],
  });

  const { data: rentalStats } = useQuery<any>({
    queryKey: ["/api/rental/stats"],
  });

  const { data: rentalPayments = [] } = useQuery<any[]>({
    queryKey: ["/api/rental/payments"],
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: [`/api/rental/contracts/${selectedContract?.id}/documents`],
    enabled: !!selectedContract?.id,
  });

  // 查詢選中租約的詳細資料（包含價格階層）
  const { data: contractDetails } = useQuery<any>({
    queryKey: ["/api/rental/contracts", editingContract?.id],
    enabled: !!editingContract?.id,
  });

  // 查詢檢視租約的詳細資料
  const { data: viewingContractDetails, isLoading: isLoadingContractDetails } = useQuery<any>({
    queryKey: [`/api/rental/contracts/${viewingContract?.id}`],
    enabled: !!viewingContract?.id,
  });

  // 查詢特定租約的付款項目
  const { data: contractPaymentItems = [] } = useQuery<any[]>({
    queryKey: [`/api/rental/contracts/${viewingContract?.id}/payments`],
    enabled: !!viewingContract?.id,
  });



  // 處理付款項目過濾和排序
  const filteredAndSortedPayments = useMemo(() => {
    if (!rentalPayments || !Array.isArray(rentalPayments)) return [];
    
    let filtered = rentalPayments.filter((payment: any) => {
      // 搜尋過濾
      const matchesSearch = !paymentSearchTerm || 
        payment.itemName?.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
        payment.notes?.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
        payment.projectName?.toLowerCase().includes(paymentSearchTerm.toLowerCase());
      
      // 狀態過濾
      const amount = payment.totalAmount ? parseFloat(payment.totalAmount) : 0;
      const paidAmount = payment.paidAmount ? parseFloat(payment.paidAmount) : 0;
      const isPaid = payment.status === 'paid' || paidAmount >= amount;
      const matchesStatus = paymentStatusFilter === "all" || 
        (paymentStatusFilter === "paid" && isPaid) ||
        (paymentStatusFilter === "pending" && !isPaid);
      
      // 專案過濾
      const matchesProject = paymentProjectFilter === "all" || 
        payment.projectName === paymentProjectFilter;
      
      return matchesSearch && matchesStatus && matchesProject;
    });
    
    // 排序
    filtered.sort((a: any, b: any) => {
      let aValue, bValue;
      
      switch (paymentSortBy) {
        case "amount":
          aValue = parseFloat(a.totalAmount || 0);
          bValue = parseFloat(b.totalAmount || 0);
          break;
        case "name":
          aValue = a.itemName || "";
          bValue = b.itemName || "";
          break;
        case "project":
          aValue = a.projectName || "";
          bValue = b.projectName || "";
          break;
        case "date":
        default:
          aValue = new Date(a.startDate || a.createdAt);
          bValue = new Date(b.startDate || b.createdAt);
          break;
      }
      
      if (paymentSortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    return filtered;
  }, [rentalPayments, paymentSearchTerm, paymentStatusFilter, paymentProjectFilter, paymentSortBy, paymentSortOrder]);

  // 獲取唯一的專案列表
  const uniqueProjects = useMemo(() => {
    if (!rentalPayments || !Array.isArray(rentalPayments)) return [];
    const projectNames = rentalPayments.map((payment: any) => payment.projectName).filter(Boolean);
    const uniqueProjectNames = projectNames.filter((name, index) => projectNames.indexOf(name) === index);
    return uniqueProjectNames;
  }, [rentalPayments]);

  // 表單設置
  const form = useForm<RentalContractForm>({
    resolver: zodResolver(rentalContractSchema),
    defaultValues: {
      projectId: 0,
      contractName: "",
      startDate: "",
      endDate: "",
      totalYears: 10,
      baseAmount: 0,
      hasBufferPeriod: false,
      bufferMonths: 0,
      bufferIncludedInTerm: true,
      notes: "",
      priceTiers: [{ yearStart: 1, yearEnd: 3, monthlyAmount: 0 }],
    },
  });

  // 智慧調整表單
  const adjustForm = useForm({
    defaultValues: {
      adjustmentType: "percentage", // percentage | fixed
      adjustmentValue: 0,
      effectiveDate: "",
      reason: "",
    },
  });



  // Mutations
  const createContractMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/rental/contracts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/contracts"] });
      setIsDialogOpen(false);
      form.reset();
      setPriceTiers([{ yearStart: 1, yearEnd: 3, monthlyAmount: 0 }]);
      toast({
        title: "租約建立成功",
        description: "新的租約已成功建立並開始生成付款項目",
      });
    },
    onError: (error: any) => {
      toast({
        title: "建立失敗",
        description: error.message || "建立租約時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const updateContractMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/rental/contracts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project/stats"] });
      setIsDialogOpen(false);
      setEditingContract(null);
      form.reset();
      toast({
        title: "租約更新成功",
        description: "租約資訊已更新，付款項目已重新生成（保留已付款項目）",
      });
    },
    onError: (error: any) => {
      toast({
        title: "更新失敗",
        description: error.message || "更新租約時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/rental/contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project/stats"] });
      toast({
        title: "租約刪除成功", 
        description: "租約和未付款項目已成功刪除（已付款項目保留）",
      });
    },
    onError: (error: any) => {
      toast({
        title: "刪除失敗",
        description: error.message || "刪除租約時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const generatePaymentsMutation = useMutation({
    mutationFn: async (contractId: number) => {
      return apiRequest("POST", `/api/rental/contracts/${contractId}/generate-payments`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/payments"] });
      toast({
        title: "付款項目生成成功",
        description: `已生成 ${data.generatedCount} 個付款項目`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "生成失敗",
        description: error.message || "生成付款項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!selectedContract) throw new Error("請先選擇租約");
      
      return fetch(`/api/rental/contracts/${selectedContract.id}/documents`, {
        method: "POST",
        body: data,
      }).then(res => {
        if (!res.ok) throw new Error(`上傳失敗: ${res.statusText}`);
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rental/contracts/${selectedContract?.id}/documents`] });
      setIsDocumentDialogOpen(false);
      setUploadFile(null);
      setUploadVersion("");
      setUploadDescription("");
      toast({
        title: "文件上傳成功",
        description: "合約文件已成功上傳",
      });
    },
    onError: (error: any) => {
      toast({
        title: "上傳失敗",
        description: error.message || "上傳合約文件時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // 文件下載處理
  const handleDocumentDownload = async (document: any) => {
    try {
      const response = await fetch(`/api/rental/documents/${document.id}/download`);
      if (!response.ok) throw new Error('下載失敗');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.fileName;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
      
      toast({
        title: "成功",
        description: "文件下載完成",
      });
    } catch (error: any) {
      toast({
        title: "下載失敗",
        description: error.message || "文件下載失敗",
        variant: "destructive",
      });
    }
  };

  // 文件刪除處理
  const handleDocumentDelete = async (documentId: number) => {
    if (!confirm('確定要刪除此文件嗎？此操作無法復原。')) return;
    
    try {
      const response = await fetch(`/api/rental/documents/${documentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('刪除失敗');
      
      queryClient.invalidateQueries({ queryKey: ["/api/rental/documents", selectedContract?.id] });
      
      toast({
        title: "成功",
        description: "文件已刪除",
      });
    } catch (error: any) {
      toast({
        title: "刪除失敗",
        description: error.message || "文件刪除失敗",
        variant: "destructive",
      });
    }
  };

  const smartAdjustMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/rental/contracts/${selectedContract?.id}/smart-adjust`, data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/payments"] });
      setIsSmartAdjustDialogOpen(false);
      setAdjustmentPreview(null);
      toast({
        title: "智慧調整完成",
        description: `已調整 ${data.adjustedCount} 個未來付款項目`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "調整失敗",
        description: error.message || "智慧調整時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // 智慧調整預覽
  const previewAdjustment = async () => {
    const formData = adjustForm.getValues();
    try {
      const response = await apiRequest("POST", `/api/rental/contracts/${selectedContract?.id}/preview-adjustment`, formData);
      setAdjustmentPreview(response);
    } catch (error: any) {
      toast({
        title: "預覽失敗",
        description: error.message || "預覽調整時發生錯誤",
        variant: "destructive",
      });
    }
  };

  // 事件處理
  const handleCreateContract = () => {
    setEditingContract(null);
    form.reset();
    setPriceTiers([{ yearStart: 1, yearEnd: 3, monthlyAmount: 0 }]);
    setIsDialogOpen(true);
  };

  const handleEditContract = async (contract: any) => {
    setEditingContract(contract);
    
    // 獲取完整的合約詳情資料
    try {
      const detailResponse: any = await apiRequest("GET", `/api/rental/contracts/${contract.id}`);
      
      // 填充表單資料
      form.reset({
        projectId: detailResponse.projectId || 0,
        contractName: detailResponse.contractName || "",
        startDate: detailResponse.startDate ? detailResponse.startDate.split('T')[0] : "",
        endDate: detailResponse.endDate ? detailResponse.endDate.split('T')[0] : "",
        totalYears: detailResponse.totalYears || 10,
        baseAmount: parseFloat(detailResponse.baseAmount || 0),
        hasBufferPeriod: detailResponse.hasBufferPeriod || false,
        bufferMonths: detailResponse.bufferMonths || 0,
        bufferIncludedInTerm: detailResponse.bufferIncludedInTerm !== false,
        notes: detailResponse.notes || "",
        priceTiers: detailResponse.priceTiers && detailResponse.priceTiers.length > 0 
          ? detailResponse.priceTiers.map((tier: any) => ({
              yearStart: tier.yearStart,
              yearEnd: tier.yearEnd,
              monthlyAmount: parseFloat(tier.monthlyAmount || 0)
            }))
          : [{ yearStart: 1, yearEnd: 3, monthlyAmount: parseFloat(detailResponse.baseAmount || 0) }],
      });
      
      // 更新價格階層狀態
      if (detailResponse.priceTiers && detailResponse.priceTiers.length > 0) {
        setPriceTiers(detailResponse.priceTiers.map((tier: any) => ({
          yearStart: tier.yearStart,
          yearEnd: tier.yearEnd,
          monthlyAmount: parseFloat(tier.monthlyAmount || 0)
        })));
      } else {
        setPriceTiers([{ yearStart: 1, yearEnd: 3, monthlyAmount: parseFloat(detailResponse.baseAmount || 0) }]);
      }
      
      setIsDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "載入合約資料失敗",
        description: error.message || "無法載入合約詳細資料",
        variant: "destructive",
      });
    }
  };

  const handleViewDetails = (contract: any) => {
    setViewingContract(contract);
    setIsContractDetailsDialogOpen(true);
  };

  const handleSubmit = (data: RentalContractForm) => {
    const formData = {
      ...data,
      baseAmount: data.baseAmount.toString(),
      totalMonths: data.totalYears * 12, // 計算總月數
      hasBufferPeriod: data.hasBufferPeriod || false,
      bufferMonths: data.bufferMonths || 0,
      bufferIncludedInTerm: data.bufferIncludedInTerm !== false,
      priceTiers: priceTiers.map(tier => ({
        ...tier,
        monthlyAmount: tier.monthlyAmount.toString(),
      })),
    };

    if (editingContract) {
      updateContractMutation.mutate({ id: editingContract.id, data: formData });
    } else {
      createContractMutation.mutate(formData);
    }
  };

  const handleDeleteContract = (contractId: number) => {
    if (confirm("確定要刪除這個租約嗎？此操作將刪除所有相關的付款項目。")) {
      deleteContractMutation.mutate(contractId);
    }
  };

  const handleExportPayments = async (format: 'excel' | 'csv') => {
    try {
      const params = new URLSearchParams();
      params.append('year', monthlyPaymentYear.toString());
      params.append('format', format);
      if (viewingContract?.id) {
        params.append('contractId', viewingContract.id.toString());
      }

      const response = await fetch(`/api/rental/payments/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('匯出失敗');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      const filename = `租金付款記錄_${monthlyPaymentYear}年${viewingContract ? `_${viewingContract.contractName}` : ''}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "匯出成功",
        description: `${monthlyPaymentYear}年租金付款記錄已匯出為 ${format.toUpperCase()} 格式`,
      });
    } catch (error) {
      console.error('匯出失敗:', error);
      toast({
        title: "匯出失敗",
        description: "檔案下載失敗，請稍後再試",
        variant: "destructive",
      });
    }
  };

  const handleUploadDocument = () => {
    if (!uploadFile || !selectedContract) return;

    const formData = new FormData();
    formData.append("document", uploadFile);
    if (uploadVersion) formData.append("versionLabel", uploadVersion);
    if (uploadDescription) formData.append("description", uploadDescription);

    uploadDocumentMutation.mutate(formData);
  };

  const addPriceTier = () => {
    const lastTier = priceTiers[priceTiers.length - 1];
    setPriceTiers([
      ...priceTiers,
      {
        yearStart: lastTier.yearEnd + 1,
        yearEnd: lastTier.yearEnd + 3,
        monthlyAmount: 0,
      },
    ]);
  };

  const removePriceTier = (index: number) => {
    if (priceTiers.length > 1) {
      setPriceTiers(priceTiers.filter((_, i) => i !== index));
    }
  };

  const updatePriceTier = (index: number, field: string, value: any) => {
    const updated = [...priceTiers];
    updated[index] = { ...updated[index], [field]: value };
    setPriceTiers(updated);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Building2 className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
            <span className="break-words">租金管理系統</span>
          </h1>
          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
            完整的租約管理，支援10年週期調整和智慧付款生成
          </p>
        </div>
        <Button 
          onClick={handleCreateContract} 
          className="flex items-center gap-2 w-full sm:w-auto justify-center"
          size="default"
        >
          <Plus className="w-4 h-4" />
          <span className="whitespace-nowrap">新增租約</span>
        </Button>
      </div>

      {/* Statistics Cards - Responsive Grid */}
      {rentalStats && (
        <div className="grid gap-3 md:gap-6 grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-gray-600">活躍租約</CardTitle>
              <Building2 className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-gray-900">{rentalStats.activeContracts || 0}</div>
              <p className="text-xs text-gray-500 mt-1">個合約</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-gray-600">月收入總額</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg md:text-2xl font-bold text-gray-900">
                NT${(rentalStats.monthlyRevenue || 0).toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">本月預計</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-gray-600">待收租金</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-orange-600">{rentalStats.pendingPayments || 0}</div>
              <p className="text-xs text-gray-500 mt-1">筆待處理</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-gray-600">逾期項目</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-red-600">{rentalStats.overduePayments || 0}</div>
              <p className="text-xs text-gray-500 mt-1">需緊急處理</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content - Responsive Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger 
            value="contracts" 
            className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 sm:px-4 text-xs sm:text-sm"
          >
            <Building2 className="w-4 h-4" />
            <span className="whitespace-nowrap">租約管理</span>
          </TabsTrigger>
          <TabsTrigger 
            value="payments" 
            className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 sm:px-4 text-xs sm:text-sm"
          >
            <DollarSign className="w-4 h-4" />
            <span className="whitespace-nowrap">付款項目</span>
          </TabsTrigger>
          <TabsTrigger 
            value="documents" 
            className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 sm:px-4 text-xs sm:text-sm"
          >
            <FileText className="w-4 h-4" />
            <span className="whitespace-nowrap">合約文件</span>
          </TabsTrigger>
        </TabsList>

        {/* 租約管理 */}
        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <CardTitle>租約列表</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contracts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">無租約資料</p>
                    <p>請新增第一個租約合約</p>
                  </div>
                ) : (
                  contracts.map((contract: any) => {
                    const project = projects.find((p: any) => p.id === contract.projectId);
                    const progress = contract.totalYears > 0 ? 
                      ((new Date().getFullYear() - new Date(contract.startDate).getFullYear()) / contract.totalYears) * 100 : 0;

                    return (
                      <div key={contract.id} className="border rounded-lg p-3 md:p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                              <h3 className="font-medium text-base md:text-lg truncate">{contract.contractName}</h3>
                              <Badge variant={contract.isActive ? "default" : "secondary"} className="self-start">
                                {contract.isActive ? "進行中" : "已結束"}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 text-xs md:text-sm text-gray-600 mb-3">
                              <div className="break-words">
                                <span className="font-medium">專案：</span>
                                <span className="text-gray-900">{project?.projectName || "無"}</span>
                              </div>
                              <div className="break-words sm:col-span-2 lg:col-span-1">
                                <span className="font-medium">期間：</span>
                                <span className="text-gray-900">
                                  {new Date(contract.startDate).toLocaleDateString('zh-TW')} - {new Date(contract.endDate).toLocaleDateString('zh-TW')}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium">總年數：</span>
                                <span className="text-gray-900">{contract.totalYears}年</span>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-3">
                              <div className="flex justify-between text-xs md:text-sm mb-1">
                                <span className="text-gray-600">合約進度</span>
                                <span className="font-medium text-gray-900">{Math.min(Math.round(progress), 100)}%</span>
                              </div>
                              <Progress value={Math.min(progress, 100)} className="h-2" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm text-gray-600">
                              <div>
                                <span className="font-medium">基礎金額：</span>
                                NT${contract.baseAmount?.toLocaleString() || 0}
                              </div>
                              <div>
                                <span className="font-medium">當前階段：</span>
                                {contract.currentTier ? `第${contract.currentTier.yearStart}-${contract.currentTier.yearEnd}年` : "未設定"}
                              </div>
                            </div>

                            {contract.notes && (
                              <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded mt-2">
                                <strong>備註：</strong>{contract.notes}
                              </div>
                            )}
                          </div>
                          
                          {/* 當月租金顯示 - 響應式佈局 */}
                          <div className="flex flex-col sm:items-end sm:text-right mt-3 sm:mt-0 sm:ml-4">
                            <div className="text-lg md:text-2xl font-bold text-blue-600 mb-1">
                              NT${contract.currentMonthlyAmount?.toLocaleString() || contract.baseAmount?.toLocaleString() || 0}
                            </div>
                            <div className="text-xs md:text-sm text-gray-500 mb-2">當月租金</div>
                          </div>
                        </div>

                        {/* 操作按鈕區 - 響應式佈局 */}
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(contract)}
                            className="flex items-center gap-1 text-xs"
                          >
                            <Eye className="w-3 h-3" />
                            <span className="hidden sm:inline">查看</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedContract(contract);
                              setIsSmartAdjustDialogOpen(true);
                            }}
                            className="flex items-center gap-1 text-xs"
                          >
                            <Settings className="w-3 h-3" />
                            <span className="hidden sm:inline">調整</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditContract(contract)}
                            className="flex items-center gap-1 text-xs"
                          >
                            <Edit className="w-3 h-3" />
                            <span className="hidden sm:inline">編輯</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generatePaymentsMutation.mutate(contract.id)}
                            disabled={generatePaymentsMutation.isPending}
                            className="flex items-center gap-1 text-xs"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span className="hidden sm:inline">生成</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteContract(contract.id)}
                            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 ml-auto"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span className="hidden sm:inline">刪除</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 付款項目 */}
        <TabsContent value="payments">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg md:text-xl">租金付款項目</CardTitle>
              <div className="flex flex-col gap-3 mt-4">
                {/* 搜尋框 - 響應式 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="搜尋租約名稱、備註或專案..."
                    value={paymentSearchTerm}
                    onChange={(e) => setPaymentSearchTerm(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {paymentSearchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPaymentSearchTerm("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* 過濾選項 - 響應式網格 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                    <SelectTrigger className="w-full text-xs sm:text-sm">
                      <SelectValue placeholder="狀態" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部狀態</SelectItem>
                      <SelectItem value="paid">已付款</SelectItem>
                      <SelectItem value="pending">待付款</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={paymentProjectFilter} onValueChange={setPaymentProjectFilter}>
                    <SelectTrigger className="w-full text-xs sm:text-sm">
                      <SelectValue placeholder="專案" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部專案</SelectItem>
                      {uniqueProjects.map((project: string) => (
                        <SelectItem key={project} value={project}>
                          {project}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={paymentSortBy} onValueChange={setPaymentSortBy}>
                    <SelectTrigger className="w-full text-xs sm:text-sm">
                      <SelectValue placeholder="排序" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">日期</SelectItem>
                      <SelectItem value="amount">金額</SelectItem>
                      <SelectItem value="name">名稱</SelectItem>
                      <SelectItem value="project">專案</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentSortOrder(paymentSortOrder === "asc" ? "desc" : "asc")}
                    className="px-3"
                  >
                    {paymentSortOrder === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                  </Button>

                  {/* 重置按鈕 */}
                  {(paymentSearchTerm || paymentStatusFilter !== "all" || paymentProjectFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPaymentSearchTerm("");
                        setPaymentStatusFilter("all");
                        setPaymentProjectFilter("all");
                        setPaymentSortBy("date");
                        setPaymentSortOrder("desc");
                      }}
                      className="px-3"
                    >
                      <X className="w-4 h-4 mr-1" />
                      重置
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 付款統計摘要卡片 - 響應式網格 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
                  {(() => {
                    const totalItems = filteredAndSortedPayments.length;
                    const completedItems = filteredAndSortedPayments.filter((p: any) => {
                      const total = p.totalAmount ? parseFloat(p.totalAmount) : 0;
                      const paid = p.paidAmount ? parseFloat(p.paidAmount) : 0;
                      return p.status === 'paid' || paid >= total;
                    }).length;
                    const partialItems = filteredAndSortedPayments.filter((p: any) => {
                      const total = p.totalAmount ? parseFloat(p.totalAmount) : 0;
                      const paid = p.paidAmount ? parseFloat(p.paidAmount) : 0;
                      return paid > 0 && paid < total;
                    }).length;
                    const pendingItems = totalItems - completedItems - partialItems;
                    
                    return (
                      <>
                        <Card className="p-2 md:p-4">
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-gray-400" />
                            <div>
                              <p className="text-lg md:text-2xl font-bold">{totalItems}</p>
                              <p className="text-xs md:text-sm text-gray-600">總計項目</p>
                            </div>
                          </div>
                        </Card>
                        <Card className="p-2 md:p-4">
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-500" />
                            <div>
                              <p className="text-lg md:text-2xl font-bold text-green-600">{completedItems}</p>
                              <p className="text-xs md:text-sm text-gray-600">已完成</p>
                            </div>
                          </div>
                        </Card>
                        <Card className="p-2 md:p-4">
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-blue-500" />
                            <div>
                              <p className="text-lg md:text-2xl font-bold text-blue-600">{partialItems}</p>
                              <p className="text-xs md:text-sm text-gray-600">部分付款</p>
                            </div>
                          </div>
                        </Card>
                        <Card className="p-2 md:p-4">
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-orange-400" />
                            <div>
                              <p className="text-lg md:text-2xl font-bold text-orange-600">{pendingItems}</p>
                              <p className="text-xs md:text-sm text-gray-600">待付款</p>
                            </div>
                          </div>
                        </Card>
                      </>
                    );
                  })()}
                </div>

                {/* 年度統計報表 */}
                <Card className="border-2 border-blue-100" data-testid="annual-stats-card">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        年度統計報表
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium">年度:</Label>
                          <Select 
                            value={monthlyPaymentYear.toString()} 
                            onValueChange={(value) => setMonthlyPaymentYear(parseInt(value))}
                          >
                            <SelectTrigger className="w-24" data-testid="select-year-trigger">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 10 }, (_, i) => {
                                const year = new Date().getFullYear() - 2 + i;
                                return (
                                  <SelectItem key={year} value={year.toString()} data-testid={`select-year-${year}`}>
                                    {year}年
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportPayments('excel')}
                            className="flex items-center gap-1 text-green-600 border-green-300 hover:bg-green-50"
                            data-testid="btn-export-excel"
                          >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Excel</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportPayments('csv')}
                            className="flex items-center gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                            data-testid="btn-export-csv"
                          >
                            <FileText className="w-4 h-4" />
                            <span className="hidden sm:inline">CSV</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {(() => {
                      const yearPayments = rentalPayments.filter((item: any) => {
                        if (!item.startDate) return false;
                        const itemDate = new Date(item.startDate);
                        return itemDate.getFullYear() === monthlyPaymentYear;
                      });
                      
                      const totalAmount = yearPayments.reduce((sum: number, item: any) => 
                        sum + (parseFloat(item.totalAmount) || 0), 0);
                      const paidAmount = yearPayments.reduce((sum: number, item: any) => 
                        sum + (parseFloat(item.paidAmount) || 0), 0);
                      const paidCount = yearPayments.filter((item: any) => 
                        parseFloat(item.paidAmount || 0) >= parseFloat(item.totalAmount || 0)).length;
                      const completionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

                      const monthlyStats = Array.from({ length: 12 }, (_, month) => {
                        const monthPayments = yearPayments.filter((item: any) => {
                          const itemDate = new Date(item.startDate);
                          return itemDate.getMonth() === month;
                        });
                        const monthTotal = monthPayments.reduce((s: number, i: any) => s + (parseFloat(i.totalAmount) || 0), 0);
                        const monthPaid = monthPayments.reduce((s: number, i: any) => s + (parseFloat(i.paidAmount) || 0), 0);
                        const monthPaidCount = monthPayments.filter((i: any) => 
                          parseFloat(i.paidAmount || 0) >= parseFloat(i.totalAmount || 0)).length;
                        return { 
                          month: month + 1, 
                          count: monthPayments.length, 
                          total: monthTotal, 
                          paid: monthPaid,
                          paidCount: monthPaidCount,
                          rate: monthTotal > 0 ? (monthPaid / monthTotal) * 100 : 0,
                          items: monthPayments
                        };
                      });

                      const quarterlyStats = [0, 1, 2, 3].map(q => {
                        const quarterMonths = monthlyStats.slice(q * 3, q * 3 + 3);
                        const quarterItems = yearPayments.filter((item: any) => {
                          const itemDate = new Date(item.startDate);
                          const itemMonth = itemDate.getMonth();
                          return itemMonth >= q * 3 && itemMonth < (q + 1) * 3;
                        });
                        return {
                          quarter: q + 1,
                          count: quarterMonths.reduce((s, m) => s + m.count, 0),
                          total: quarterMonths.reduce((s, m) => s + m.total, 0),
                          paid: quarterMonths.reduce((s, m) => s + m.paid, 0),
                          paidCount: quarterMonths.reduce((s, m) => s + m.paidCount, 0),
                          rate: quarterMonths.reduce((s, m) => s + m.total, 0) > 0 
                            ? (quarterMonths.reduce((s, m) => s + m.paid, 0) / quarterMonths.reduce((s, m) => s + m.total, 0)) * 100 
                            : 0,
                          items: quarterItems
                        };
                      });

                      return (
                        <>
                          {/* 年度總覽 */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="annual-overview-grid">
                            <div className="p-3 bg-blue-50 rounded-lg text-center" data-testid="stat-total-periods">
                              <div className="text-xl md:text-2xl font-bold text-blue-600">{yearPayments.length}</div>
                              <div className="text-xs text-gray-600">總期數</div>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg text-center" data-testid="stat-paid-count">
                              <div className="text-xl md:text-2xl font-bold text-green-600">{paidCount}</div>
                              <div className="text-xs text-gray-600">已付清</div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg text-center" data-testid="stat-total-amount">
                              <div className="text-xl md:text-2xl font-bold text-blue-700">NT${(totalAmount/10000).toFixed(1)}萬</div>
                              <div className="text-xs text-gray-600">應付總額</div>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg text-center" data-testid="stat-paid-amount">
                              <div className="text-xl md:text-2xl font-bold text-green-700">NT${(paidAmount/10000).toFixed(1)}萬</div>
                              <div className="text-xs text-gray-600">已付金額</div>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-lg text-center col-span-2 md:col-span-1" data-testid="stat-completion-rate">
                              <div className="text-xl md:text-2xl font-bold text-purple-600">{completionRate.toFixed(0)}%</div>
                              <div className="text-xs text-gray-600">完成率</div>
                            </div>
                          </div>

                          {/* 進度條 */}
                          <div data-testid="annual-progress-section">
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-gray-600">年度付款進度</span>
                              <span className="font-medium" data-testid="progress-percentage">{completionRate.toFixed(1)}%</span>
                            </div>
                            <Progress value={completionRate} className="h-3" data-testid="progress-bar" />
                          </div>

                          {/* 季度統計表格 */}
                          <div data-testid="quarterly-stats-section">
                            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              季度統計
                            </h4>
                            <div className="overflow-x-auto">
                              <Table data-testid="quarterly-stats-table">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>季度</TableHead>
                                    <TableHead className="text-center">期數</TableHead>
                                    <TableHead className="text-right">應付金額</TableHead>
                                    <TableHead className="text-right">已付金額</TableHead>
                                    <TableHead className="text-center">完成率</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {quarterlyStats.map((q) => (
                                    <TableRow key={q.quarter} data-testid={`quarter-row-${q.quarter}`}>
                                      <TableCell className="font-medium">Q{q.quarter}</TableCell>
                                      <TableCell className="text-center">
                                        <HoverCard>
                                          <HoverCardTrigger asChild>
                                            <button className="inline-flex items-center gap-1 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors">
                                              <span className="text-green-600">{q.paidCount}</span>
                                              <span className="text-gray-400">/</span>
                                              <span>{q.count}</span>
                                              <Info className="w-3 h-3 text-gray-400 ml-1" />
                                            </button>
                                          </HoverCardTrigger>
                                          <HoverCardContent className="w-80" align="start">
                                            <div className="space-y-2">
                                              <h4 className="text-sm font-semibold">Q{q.quarter} 付款項目明細</h4>
                                              {q.items.length === 0 ? (
                                                <p className="text-xs text-gray-500">本季無付款項目</p>
                                              ) : (
                                                <ScrollArea className="h-[200px]">
                                                  <div className="space-y-2 pr-3">
                                                    {q.items.map((item: any) => {
                                                      const isPaid = parseFloat(item.paidAmount || 0) >= parseFloat(item.totalAmount || 0);
                                                      const isPartial = parseFloat(item.paidAmount || 0) > 0 && parseFloat(item.paidAmount || 0) < parseFloat(item.totalAmount || 0);
                                                      return (
                                                        <div key={item.id} className="flex items-center justify-between text-xs border-b pb-2">
                                                          <div className="flex-1 min-w-0">
                                                            <div className="font-medium truncate">{item.itemName}</div>
                                                            <div className="text-gray-500">{new Date(item.startDate).toLocaleDateString('zh-TW')}</div>
                                                          </div>
                                                          <div className="text-right ml-2">
                                                            <div className="font-medium">NT${parseFloat(item.totalAmount || 0).toLocaleString()}</div>
                                                            <div className={isPaid ? "text-green-600" : isPartial ? "text-yellow-600" : "text-red-600"}>
                                                              {isPaid ? "已付清" : isPartial ? `已付 ${((parseFloat(item.paidAmount || 0) / parseFloat(item.totalAmount || 0)) * 100).toFixed(0)}%` : "待付款"}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </ScrollArea>
                                              )}
                                            </div>
                                          </HoverCardContent>
                                        </HoverCard>
                                      </TableCell>
                                      <TableCell className="text-right">NT${q.total.toLocaleString()}</TableCell>
                                      <TableCell className="text-right text-green-600">NT${q.paid.toLocaleString()}</TableCell>
                                      <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-2">
                                          <div className="w-16 bg-gray-200 rounded-full h-2">
                                            <div 
                                              className="bg-green-500 h-2 rounded-full transition-all" 
                                              style={{ width: `${Math.min(100, q.rate)}%` }}
                                            />
                                          </div>
                                          <span className="text-xs font-medium w-12">{q.rate.toFixed(0)}%</span>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow className="bg-gray-50 font-medium">
                                    <TableCell>年度合計</TableCell>
                                    <TableCell className="text-center">
                                      <span className="text-green-600">{paidCount}</span>
                                      <span className="text-gray-400">/</span>
                                      <span>{yearPayments.length}</span>
                                    </TableCell>
                                    <TableCell className="text-right">NT${totalAmount.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-green-600">NT${paidAmount.toLocaleString()}</TableCell>
                                    <TableCell className="text-center">
                                      <Badge className={completionRate >= 80 ? "bg-green-100 text-green-700" : completionRate >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                                        {completionRate.toFixed(0)}%
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          </div>

                          {/* 月度統計矩陣 */}
                          <div data-testid="monthly-stats-section">
                            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              月度付款狀況
                            </h4>
                            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2" data-testid="monthly-stats-grid">
                              {monthlyStats.map((m) => {
                                const isComplete = m.rate >= 100;
                                const isPartial = m.rate > 0 && m.rate < 100;
                                const statusColor = isComplete ? 'bg-green-100 border-green-300 text-green-700' 
                                  : isPartial ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                                  : m.count > 0 ? 'bg-red-100 border-red-300 text-red-700'
                                  : 'bg-gray-50 border-gray-200 text-gray-400';
                                
                                return (
                                  <HoverCard key={m.month}>
                                    <HoverCardTrigger asChild>
                                      <div
                                        className={`p-2 rounded-lg border text-center cursor-pointer hover:shadow-md transition-shadow ${statusColor}`}
                                        data-testid={`month-stat-${m.month}`}
                                      >
                                        <div className="font-semibold text-sm">{m.month}月</div>
                                        {m.count > 0 ? (
                                          <>
                                            <div className="text-xs mt-1">{m.paidCount}/{m.count}期</div>
                                            <div className="text-xs font-medium">{m.rate.toFixed(0)}%</div>
                                          </>
                                        ) : (
                                          <div className="text-xs mt-1">無資料</div>
                                        )}
                                      </div>
                                    </HoverCardTrigger>
                                    <HoverCardContent className="w-72" align="center">
                                      <div className="space-y-2">
                                        <h4 className="text-sm font-semibold">{m.month}月 付款項目明細</h4>
                                        <div className="flex justify-between text-xs text-gray-500 pb-2 border-b">
                                          <span>應付：NT${m.total.toLocaleString()}</span>
                                          <span>已付：NT${m.paid.toLocaleString()}</span>
                                        </div>
                                        {m.items.length === 0 ? (
                                          <p className="text-xs text-gray-500 py-2">本月無付款項目</p>
                                        ) : (
                                          <ScrollArea className="h-[180px]">
                                            <div className="space-y-2 pr-3">
                                              {m.items.map((item: any) => {
                                                const isPaid = parseFloat(item.paidAmount || 0) >= parseFloat(item.totalAmount || 0);
                                                const isItemPartial = parseFloat(item.paidAmount || 0) > 0 && parseFloat(item.paidAmount || 0) < parseFloat(item.totalAmount || 0);
                                                return (
                                                  <div key={item.id} className="flex items-center justify-between text-xs border-b pb-2">
                                                    <div className="flex-1 min-w-0">
                                                      <div className="font-medium truncate">{item.itemName}</div>
                                                      <div className="text-gray-500">{new Date(item.startDate).toLocaleDateString('zh-TW')}</div>
                                                    </div>
                                                    <div className="text-right ml-2">
                                                      <div className="font-medium">NT${parseFloat(item.totalAmount || 0).toLocaleString()}</div>
                                                      <div className={isPaid ? "text-green-600" : isItemPartial ? "text-yellow-600" : "text-red-600"}>
                                                        {isPaid ? "已付清" : isItemPartial ? `已付 ${((parseFloat(item.paidAmount || 0) / parseFloat(item.totalAmount || 0)) * 100).toFixed(0)}%` : "待付款"}
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </ScrollArea>
                                        )}
                                      </div>
                                    </HoverCardContent>
                                  </HoverCard>
                                );
                              })}
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs mt-3">
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                                <span>已付清</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
                                <span>部分付款</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                                <span>未付款</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
                                <span>無資料</span>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* 顯示過濾結果統計與分頁控制 */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-sm text-gray-600">
                  <span>
                    顯示第 {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedPayments.length)} 筆，
                    共 {filteredAndSortedPayments.length} 筆結果
                    {rentalPayments.length !== filteredAndSortedPayments.length && 
                      ` (總計 ${rentalPayments.length} 筆)`
                    }
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">每頁顯示：</span>
                    <Select 
                      value={itemsPerPage.toString()} 
                      onValueChange={(value) => {
                        setItemsPerPage(parseInt(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-gray-500">筆</span>
                  </div>
                </div>

                {filteredAndSortedPayments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">無付款項目</p>
                    <p>請先建立租約合約</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>租約名稱</TableHead>
                        <TableHead>付款期間</TableHead>
                        <TableHead>應付金額</TableHead>
                        <TableHead>已付金額</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead>到期日</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedPayments
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((payment: any) => {
                        const amount = payment.totalAmount ? parseFloat(payment.totalAmount) : 0;
                        const paidAmount = payment.paidAmount ? parseFloat(payment.paidAmount) : 0;
                        const isPaid = payment.status === 'paid' || paidAmount >= amount;
                        const isPartiallyPaid = paidAmount > 0 && paidAmount < amount;
                        const dueDate = payment.startDate || payment.createdAt;
                        const paymentProgress = amount > 0 ? (paidAmount / amount) * 100 : 0;
                        
                        return (
                          <TableRow key={payment.id} className={isPaid ? "bg-green-50/50" : isPartiallyPaid ? "bg-blue-50/50" : ""}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isPaid ? 'bg-green-500' : isPartiallyPaid ? 'bg-blue-500' : 'bg-orange-400'}`} />
                                {payment.itemName || '未命名租約'}
                              </div>
                            </TableCell>
                            <TableCell>{payment.notes || '租金付款'}</TableCell>
                            <TableCell className="font-medium">
                              <div className="space-y-1">
                                <div>NT${amount.toLocaleString()}</div>
                                {isPartiallyPaid && (
                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div 
                                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                                      style={{ width: `${paymentProgress}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-green-600 font-medium">
                              <div className="flex items-center gap-2">
                                NT${paidAmount.toLocaleString()}
                                {isPartiallyPaid && (
                                  <span className="text-xs text-gray-500">
                                    ({Math.round(paymentProgress)}%)
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {isPaid ? (
                                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  已完成
                                </Badge>
                              ) : isPartiallyPaid ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  部分付款
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                                  <Clock className="w-3 h-3 mr-1" />
                                  待付款
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {dueDate ? new Date(dueDate).toLocaleDateString('zh-TW') : '待確認'}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setViewingPayment(payment);
                                  setIsPaymentDetailOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
                
                {/* 分頁導覽 */}
                {filteredAndSortedPayments.length > 0 && (
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t">
                    <div className="text-sm text-gray-500">
                      第 {currentPage} / {Math.ceil(filteredAndSortedPayments.length / itemsPerPage)} 頁
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        首頁
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        上一頁
                      </Button>
                      
                      {/* 頁碼按鈕 */}
                      <div className="flex items-center gap-1">
                        {(() => {
                          const totalPages = Math.ceil(filteredAndSortedPayments.length / itemsPerPage);
                          const pages = [];
                          let startPage = Math.max(1, currentPage - 2);
                          let endPage = Math.min(totalPages, startPage + 4);
                          
                          if (endPage - startPage < 4) {
                            startPage = Math.max(1, endPage - 4);
                          }
                          
                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(
                              <Button
                                key={i}
                                variant={currentPage === i ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(i)}
                                className="w-8 h-8 p-0"
                              >
                                {i}
                              </Button>
                            );
                          }
                          return pages;
                        })()}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredAndSortedPayments.length / itemsPerPage), prev + 1))}
                        disabled={currentPage >= Math.ceil(filteredAndSortedPayments.length / itemsPerPage)}
                      >
                        下一頁
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.ceil(filteredAndSortedPayments.length / itemsPerPage))}
                        disabled={currentPage >= Math.ceil(filteredAndSortedPayments.length / itemsPerPage)}
                      >
                        末頁
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 合約文件 */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <div className="flex flex-row items-center justify-between">
                <CardTitle>合約文件管理</CardTitle>
                <Button
                  onClick={() => setIsDocumentDialogOpen(true)}
                  disabled={!selectedContract}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  上傳文件
                </Button>
              </div>
              
              {/* 合約選擇器 */}
              <div className="flex items-center gap-4 mt-4">
                <label className="text-sm font-medium">選擇租約:</label>
                <Select 
                  value={selectedContract?.id?.toString() || ""} 
                  onValueChange={(value) => {
                    const contract = contracts?.find((c: any) => c.id.toString() === value);
                    setSelectedContract(contract || null);
                  }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="請選擇要管理文件的租約" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts?.map((contract: any) => {
                      const project = projects?.find((p: any) => p.id === contract.projectId);
                      return (
                        <SelectItem key={contract.id} value={contract.id.toString()}>
                          <div className="flex flex-col">
                            <span className="font-medium">{contract.contractName}</span>
                            <span className="text-xs text-gray-500">專案：{project?.projectName || "未知專案"}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedContract ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">請選擇租約</p>
                  <p>從租約列表中選擇一個租約來管理文件</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 顯示選中的合約資訊 */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-blue-900">{selectedContract.contractName}</h3>
                        <p className="text-sm text-blue-700">
                          專案：{projects?.find((p: any) => p.id === selectedContract.projectId)?.projectName || "未知專案"}
                        </p>
                      </div>
                      <div className="text-right text-sm text-blue-600">
                        <p>合約ID: {selectedContract.id}</p>
                      </div>
                    </div>
                  </div>
                  
                  {documents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p>此租約尚無上傳文件</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>文件名稱</TableHead>
                          <TableHead>文件類型</TableHead>
                          <TableHead>上傳日期</TableHead>
                          <TableHead>版本</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.map((doc: any) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium">{doc.fileName}</TableCell>
                            <TableCell>{doc.documentType}</TableCell>
                            <TableCell>{new Date(doc.uploadDate).toLocaleDateString('zh-TW')}</TableCell>
                            <TableCell>{doc.version}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setViewingDocument(doc);
                                    setIsDocumentViewOpen(true);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleDocumentDownload(doc)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleDocumentDelete(doc.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 建立/編輯租約對話框 - 響應式優化 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl font-semibold">
              {editingContract ? "編輯租約" : "新增租約"}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-2">
              請填寫租約基本資訊和價格階段設定
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contractName">租約名稱</Label>
                <Input
                  id="contractName"
                  {...form.register("contractName")}
                  placeholder="輸入租約名稱"
                />
                {form.formState.errors.contractName && (
                  <p className="text-sm text-red-600">{form.formState.errors.contractName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectId">選擇專案</Label>
                <Select onValueChange={(value) => form.setValue("projectId", parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇專案" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project: any) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.projectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.projectId && (
                  <p className="text-sm text-red-600">{form.formState.errors.projectId.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-sm font-medium">開始日期</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...form.register("startDate")}
                  className="w-full"
                />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-red-600">{form.formState.errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-sm font-medium">結束日期</Label>
                <Input
                  id="endDate"
                  type="date"
                  {...form.register("endDate")}
                  className="w-full"
                />
                {form.formState.errors.endDate && (
                  <p className="text-xs text-red-600">{form.formState.errors.endDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalYears" className="text-sm font-medium">總年數</Label>
                <Input
                  id="totalYears"
                  type="number"
                  {...form.register("totalYears", { valueAsNumber: true })}
                  placeholder="租約總年數"
                  className="w-full"
                />
                {form.formState.errors.totalYears && (
                  <p className="text-xs text-red-600">{form.formState.errors.totalYears.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseAmount">基礎金額</Label>
              <Input
                id="baseAmount"
                type="number"
                step="0.01"
                {...form.register("baseAmount", { valueAsNumber: true })}
                placeholder="基礎租金金額"
              />
              {form.formState.errors.baseAmount && (
                <p className="text-sm text-red-600">{form.formState.errors.baseAmount.message}</p>
              )}
            </div>

            {/* 緩衝期設定 */}
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasBufferPeriod"
                  checked={form.watch("hasBufferPeriod")}
                  onCheckedChange={(checked) => {
                    form.setValue("hasBufferPeriod", !!checked);
                    if (!checked) {
                      form.setValue("bufferMonths", 0);
                    }
                  }}
                />
                <Label htmlFor="hasBufferPeriod" className="text-base font-medium">
                  租約緩衝期設定
                </Label>
              </div>
              
              {form.watch("hasBufferPeriod") && (
                <div className="space-y-3 pl-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bufferMonths">緩衝期月數</Label>
                      <Input
                        id="bufferMonths"
                        type="number"
                        min="0"
                        max="12"
                        {...form.register("bufferMonths", { valueAsNumber: true })}
                        placeholder="免租金月數"
                      />
                      {form.formState.errors.bufferMonths && (
                        <p className="text-sm text-red-600">{form.formState.errors.bufferMonths.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">緩衝期計算方式</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="bufferIncluded"
                          name="bufferCalculation"
                          checked={form.watch("bufferIncludedInTerm")}
                          onChange={() => form.setValue("bufferIncludedInTerm", true)}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="bufferIncluded" className="text-sm">
                          包含在租期內（緩衝期{form.watch("bufferMonths") || 0}個月免租金 + 租約{form.watch("totalYears") || 0}年 = 租期{form.watch("totalYears") || 0}年）
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="bufferNotIncluded"
                          name="bufferCalculation"
                          checked={!form.watch("bufferIncludedInTerm")}
                          onChange={() => form.setValue("bufferIncludedInTerm", false)}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="bufferNotIncluded" className="text-sm">
                          未包含在租期內（緩衝期{form.watch("bufferMonths") || 0}個月免租金 + 租約{form.watch("totalYears") || 0}年 = 租期{form.watch("totalYears") || 0}年+{form.watch("bufferMonths") || 0}個月）
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 價格階段設定 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">價格階段設定</Label>
                <Button type="button" onClick={addPriceTier} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  新增階段
                </Button>
              </div>
              
              <div className="space-y-3">
                {priceTiers.map((tier, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">開始年份</Label>
                        <Input
                          type="number"
                          value={tier.yearStart}
                          onChange={(e) => updatePriceTier(index, "yearStart", parseInt(e.target.value))}
                          placeholder="開始年"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">結束年份</Label>
                        <Input
                          type="number"
                          value={tier.yearEnd}
                          onChange={(e) => updatePriceTier(index, "yearEnd", parseInt(e.target.value))}
                          placeholder="結束年"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">月租金額</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={tier.monthlyAmount}
                          onChange={(e) => updatePriceTier(index, "monthlyAmount", parseFloat(e.target.value))}
                          placeholder="月租金"
                        />
                      </div>
                    </div>
                    {priceTiers.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removePriceTier(index)}
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">備註</Label>
              <Textarea
                id="notes"
                {...form.register("notes")}
                placeholder="租約相關備註"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createContractMutation.isPending || updateContractMutation.isPending}>
                {editingContract ? "更新租約" : "建立租約"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 智慧調整對話框 */}
      <Dialog open={isSmartAdjustDialogOpen} onOpenChange={setIsSmartAdjustDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              智慧調整 - {selectedContract?.contractName}
            </DialogTitle>
            <DialogDescription>
              智慧調整會自動識別已付款和未來項目，只調整現在和未來的付款金額
            </DialogDescription>
          </DialogHeader>
          
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>調整規則</AlertTitle>
            <AlertDescription>
              • 已付款項目：保持不變<br/>
              • 過期項目：保持原設定<br/>
              • 現在和未來項目：套用新設定
            </AlertDescription>
          </Alert>

          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>調整方式</Label>
                <Select
                  value={adjustForm.watch("adjustmentType")}
                  onValueChange={(value) => adjustForm.setValue("adjustmentType", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">百分比調整</SelectItem>
                    <SelectItem value="fixed">固定金額調整</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {adjustForm.watch("adjustmentType") === "percentage" ? "調整百分比 (%)" : "調整金額 (NT$)"}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  {...adjustForm.register("adjustmentValue", { valueAsNumber: true })}
                  placeholder={adjustForm.watch("adjustmentType") === "percentage" ? "如：5 表示增加5%" : "如：1000 表示增加1000元"}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>生效日期</Label>
              <Input
                type="date"
                {...adjustForm.register("effectiveDate")}
              />
            </div>

            <div className="space-y-2">
              <Label>調整原因</Label>
              <Textarea
                {...adjustForm.register("reason")}
                placeholder="記錄調整原因，如：市場價格調整、通膨因應等"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={previewAdjustment} className="flex-1">
                預覽調整結果
              </Button>
            </div>

            {adjustmentPreview && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>預覽結果</AlertTitle>
                <AlertDescription>
                  將調整 {adjustmentPreview.affectedItems} 個未來付款項目<br/>
                  調整總金額：NT${adjustmentPreview.totalAdjustment?.toLocaleString() || 0}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsSmartAdjustDialogOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                onClick={() => smartAdjustMutation.mutate(adjustForm.getValues())}
                disabled={!adjustmentPreview || smartAdjustMutation.isPending}
              >
                確認調整
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 文件上傳對話框 - 響應式優化 */}
      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">上傳合約文件</DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              支援 PDF、Word 文件和圖片格式 (最大 20MB)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">選擇文件</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 20 * 1024 * 1024) {
                      toast({
                        title: "文件過大",
                        description: "文件大小不能超過 20MB",
                        variant: "destructive",
                      });
                      return;
                    }
                    setUploadFile(file);
                  }
                }}
              />
              {uploadFile && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                  已選擇：{uploadFile.name}
                </div>
              )}
            </div>
            
            <div>
              <Label htmlFor="version-label">版本標籤</Label>
              <Input
                id="version-label"
                value={uploadVersion}
                onChange={(e) => setUploadVersion(e.target.value)}
                placeholder="例如：v1.0、修訂版、最終版"
              />
            </div>
            
            <div>
              <Label htmlFor="description">備註說明</Label>
              <Textarea
                id="description"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="文件說明或備註..."
                rows={3}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsDocumentDialogOpen(false);
                  setUploadFile(null);
                  setUploadVersion("");
                  setUploadDescription("");
                }}
              >
                取消
              </Button>
              <Button 
                onClick={handleUploadDocument} 
                disabled={!uploadFile || uploadDocumentMutation.isPending}
              >
                {uploadDocumentMutation.isPending ? "上傳中..." : "上傳"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 租約詳情對話框 */}
      <Dialog open={isContractDetailsDialogOpen} onOpenChange={setIsContractDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>租約詳情 - {viewingContractDetails?.contractName || "載入中..."}</DialogTitle>
          </DialogHeader>
          
          {isLoadingContractDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              <span className="ml-2">載入租約詳情中...</span>
            </div>
          ) : viewingContractDetails ? (
            <Tabs value={contractDetailsTab} onValueChange={setContractDetailsTab}>
              <TabsList>
                <TabsTrigger value="details">租約詳情</TabsTrigger>
                <TabsTrigger value="monthly-payments">月付記錄</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                <div className="space-y-6">
              {/* 基本資訊 */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">基本資訊</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <strong>租約名稱：</strong>{viewingContractDetails.contractName}
                    </div>
                    <div>
                      <strong>專案：</strong>{projects?.find((p: any) => p.id === viewingContractDetails.projectId)?.projectName || "未知"}
                    </div>
                    <div>
                      <strong>合約期間：</strong>
                      {viewingContractDetails.startDate ? new Date(viewingContractDetails.startDate).toLocaleDateString('zh-TW') : '未設定'} - {viewingContractDetails.endDate ? new Date(viewingContractDetails.endDate).toLocaleDateString('zh-TW') : '未設定'}
                    </div>
                    <div>
                      <strong>總年數：</strong>{viewingContractDetails.totalYears || 0}年
                    </div>
                    <div>
                      <strong>基礎金額：</strong>NT${parseFloat(viewingContractDetails.baseAmount || 0).toLocaleString()}
                    </div>
                    {viewingContractDetails.hasBufferPeriod && (
                      <div className="bg-blue-50 p-3 rounded">
                        <strong>緩衝期設定：</strong>
                        <div className="text-sm mt-1">
                          緩衝期月數：{viewingContractDetails.bufferMonths}個月<br/>
                          計入合約期間：{viewingContractDetails.bufferIncludedInTerm ? "是" : "否"}
                        </div>
                      </div>
                    )}
                    <div className="bg-green-50 p-3 rounded border-l-4 border-green-400">
                      <strong>租金起算月份：</strong>
                      <span className="text-green-700 font-medium">
                        {(() => {
                          if (!viewingContractDetails.startDate) return '未設定';
                          
                          const startDate = new Date(viewingContractDetails.startDate);
                          const hasBuffer = viewingContractDetails.hasBufferPeriod;
                          const bufferMonths = viewingContractDetails.bufferMonths || 0;
                          const bufferIncluded = viewingContractDetails.bufferIncludedInTerm;
                          
                          let paymentStartDate = new Date(startDate);
                          
                          if (hasBuffer && !bufferIncluded) {
                            // 緩衝期不計入合約期間，租金從緩衝期後開始
                            paymentStartDate.setMonth(paymentStartDate.getMonth() + bufferMonths);
                          }
                          
                          return paymentStartDate.toLocaleDateString('zh-TW', { 
                            year: 'numeric', 
                            month: 'long' 
                          });
                        })()}
                      </span>
                      {viewingContractDetails.hasBufferPeriod && !viewingContractDetails.bufferIncludedInTerm && (
                        <div className="text-xs text-green-600 mt-1">
                          (合約開始日期 + {viewingContractDetails.bufferMonths}個月緩衝期)
                        </div>
                      )}
                    </div>
                    {viewingContractDetails.notes && (
                      <div>
                        <strong>備註：</strong>
                        <div className="bg-gray-50 p-2 rounded text-sm mt-1">
                          {viewingContractDetails.notes}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">合約狀態</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <strong>建立時間：</strong>
                      {viewingContractDetails.createdAt ? new Date(viewingContractDetails.createdAt).toLocaleString('zh-TW') : '未設定'}
                    </div>
                    <div>
                      <strong>更新時間：</strong>
                      {viewingContractDetails.updatedAt ? new Date(viewingContractDetails.updatedAt).toLocaleString('zh-TW') : '未設定'}
                    </div>
                    <div>
                      <strong>合約狀態：</strong>
                      <Badge variant="outline" className="ml-2">
                        {viewingContractDetails.isActive ? '進行中' : '已結束'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 價格階層 */}
              {viewingContractDetails.priceTiers && viewingContractDetails.priceTiers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">價格階層設定</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>階層</TableHead>
                            <TableHead>年份範圍</TableHead>
                            <TableHead>月租金</TableHead>
                            <TableHead>年租金總額</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewingContractDetails.priceTiers.map((tier: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>第 {index + 1} 階層</TableCell>
                              <TableCell>第 {tier.yearStart} - {tier.yearEnd} 年</TableCell>
                              <TableCell>NT${parseFloat(tier.monthlyAmount || 0).toLocaleString()}</TableCell>
                              <TableCell>NT${(parseFloat(tier.monthlyAmount || 0) * 12).toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 合約進度 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">合約進度</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    if (!viewingContractDetails.startDate || !viewingContractDetails.endDate) {
                      return (
                        <div className="text-gray-500">
                          合約日期資訊不完整，無法計算進度
                        </div>
                      );
                    }

                    const startDate = new Date(viewingContractDetails.startDate);
                    const endDate = new Date(viewingContractDetails.endDate);
                    const currentDate = new Date();
                    
                    // Validate dates
                    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                      return (
                        <div className="text-gray-500">
                          合約日期格式錯誤，無法計算進度
                        </div>
                      );
                    }

                    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                    const passedDays = Math.ceil((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                    const progress = totalDays > 0 ? Math.max(0, Math.min(100, (passedDays / totalDays) * 100)) : 0;
                    
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>合約進度</span>
                          <span className="font-medium">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-3" />
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <strong>已過天數：</strong>{Math.max(0, passedDays)}天
                          </div>
                          <div>
                            <strong>總天數：</strong>{totalDays}天
                          </div>
                          <div>
                            <strong>剩餘天數：</strong>{Math.max(0, totalDays - passedDays)}天
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
                </div>
              </TabsContent>

              <TabsContent value="monthly-payments" className="space-y-6">
                <div className="space-y-4">
                  {/* 年份選擇器 */}
                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium">查看年份</Label>
                    <Select value={monthlyPaymentYear.toString()} onValueChange={(value) => setMonthlyPaymentYear(parseInt(value))}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          if (!viewingContractDetails?.startDate || !viewingContractDetails?.endDate) {
                            // 如果沒有合約日期，回退到預設5年範圍
                            return Array.from({ length: 5 }, (_, i) => {
                              const year = new Date().getFullYear() - 2 + i;
                              return (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}年
                                </SelectItem>
                              );
                            });
                          }
                          
                          const startYear = new Date(viewingContractDetails.startDate).getFullYear();
                          const endYear = new Date(viewingContractDetails.endDate).getFullYear();
                          const yearRange = endYear - startYear + 1;
                          
                          return Array.from({ length: yearRange }, (_, i) => {
                            const year = startYear + i;
                            return (
                              <SelectItem key={year} value={year.toString()}>
                                {year}年
                              </SelectItem>
                            );
                          });
                        })()}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 年度月份矩陣視圖 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        {monthlyPaymentYear}年度房租付款概覽
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-12 gap-2 mb-4">
                        {Array.from({ length: 12 }, (_, index) => {
                          const month = index + 1;
                          const monthName = `${month}月`;
                          
                          // 計算該月份的付款狀況
                          const monthlyPayments = contractPaymentItems.filter((item: any) => {
                            if (!item.startDate) return false;
                            const itemDate = new Date(item.startDate);
                            return itemDate.getFullYear() === monthlyPaymentYear && 
                                   itemDate.getMonth() + 1 === month;
                          });
                          
                          let paymentStatus = 'not-due'; // 未到期
                          let statusColor = 'bg-gray-100 text-gray-600';
                          
                          if (monthlyPayments.length > 0) {
                            const totalAmount = monthlyPayments.reduce((sum: number, item: any) => 
                              sum + (parseFloat(item.totalAmount) || 0), 0);
                            const paidAmount = monthlyPayments.reduce((sum: number, item: any) => 
                              sum + (parseFloat(item.paidAmount) || 0), 0);
                            
                            if (paidAmount >= totalAmount) {
                              paymentStatus = 'paid';
                              statusColor = 'bg-green-100 text-green-700 border-green-200';
                            } else if (paidAmount > 0) {
                              paymentStatus = 'partial';
                              statusColor = 'bg-yellow-100 text-yellow-700 border-yellow-200';
                            } else {
                              const currentDate = new Date();
                              const monthDate = new Date(monthlyPaymentYear, month - 1, 1);
                              if (monthDate <= currentDate) {
                                paymentStatus = 'unpaid';
                                statusColor = 'bg-red-100 text-red-700 border-red-200';
                              }
                            }
                          }
                          
                          return (
                            <div
                              key={month}
                              className={`p-3 rounded-lg border text-center text-sm font-medium ${statusColor}`}
                            >
                              <div className="font-semibold">{monthName}</div>
                              <div className="text-xs mt-1">
                                {paymentStatus === 'paid' && '已付清'}
                                {paymentStatus === 'partial' && '部分付款'}
                                {paymentStatus === 'unpaid' && '未付款'}
                                {paymentStatus === 'not-due' && '未到期'}
                              </div>
                              {monthlyPayments.length > 0 && (
                                <div className="text-xs mt-1">
                                  NT${monthlyPayments.reduce((sum: number, item: any) => 
                                    sum + (parseFloat(item.totalAmount) || 0), 0).toLocaleString()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* 狀態說明 */}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                          <span>已付清</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></div>
                          <span>部分付款</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
                          <span>未付款</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
                          <span>未到期</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 年度統計摘要 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(() => {
                      const yearPayments = contractPaymentItems.filter((item: any) => {
                        if (!item.startDate) return false;
                        const itemDate = new Date(item.startDate);
                        return itemDate.getFullYear() === monthlyPaymentYear;
                      });
                      
                      const totalAmount = yearPayments.reduce((sum: number, item: any) => 
                        sum + (parseFloat(item.totalAmount) || 0), 0);
                      const paidAmount = yearPayments.reduce((sum: number, item: any) => 
                        sum + (parseFloat(item.paidAmount) || 0), 0);
                      const unpaidAmount = totalAmount - paidAmount;
                      const completionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
                      const paidCount = yearPayments.filter((item: any) => 
                        parseFloat(item.paidAmount || 0) >= parseFloat(item.totalAmount || 0)).length;
                      
                      return (
                        <>
                          <Card>
                            <CardContent className="p-4">
                              <div className="text-2xl font-bold text-blue-600">
                                NT${totalAmount.toLocaleString()}
                              </div>
                              <div className="text-sm text-gray-600">年度總金額</div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4">
                              <div className="text-2xl font-bold text-green-600">
                                NT${paidAmount.toLocaleString()}
                              </div>
                              <div className="text-sm text-gray-600">已付金額</div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4">
                              <div className="text-2xl font-bold text-red-600">
                                NT${unpaidAmount.toLocaleString()}
                              </div>
                              <div className="text-sm text-gray-600">未付金額</div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4">
                              <div className="text-2xl font-bold text-purple-600">
                                {paidCount}/{yearPayments.length}期
                              </div>
                              <div className="text-sm text-gray-600">已付期數 ({completionRate.toFixed(0)}%)</div>
                            </CardContent>
                          </Card>
                        </>
                      );
                    })()}
                  </div>

                  {/* 付款進度總覽 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        租約總進度統計
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const allPayments = contractPaymentItems || [];
                        const totalCount = allPayments.length;
                        const paidCount = allPayments.filter((item: any) => 
                          parseFloat(item.paidAmount || 0) >= parseFloat(item.totalAmount || 0)).length;
                        const partialCount = allPayments.filter((item: any) => {
                          const paid = parseFloat(item.paidAmount || 0);
                          const total = parseFloat(item.totalAmount || 0);
                          return paid > 0 && paid < total;
                        }).length;
                        const unpaidCount = totalCount - paidCount - partialCount;
                        
                        const totalAmount = allPayments.reduce((sum: number, item: any) => 
                          sum + (parseFloat(item.totalAmount) || 0), 0);
                        const paidAmount = allPayments.reduce((sum: number, item: any) => 
                          sum + (parseFloat(item.paidAmount) || 0), 0);
                        const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

                        return (
                          <div className="space-y-4">
                            <div className="flex justify-between text-sm mb-2">
                              <span>付款進度</span>
                              <span className="font-medium">{progress.toFixed(1)}%</span>
                            </div>
                            <Progress value={progress} className="h-3" />
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                              <div className="p-3 bg-blue-50 rounded-lg text-center">
                                <div className="text-2xl font-bold text-blue-600">{totalCount}</div>
                                <div className="text-sm text-gray-600">總期數</div>
                              </div>
                              <div className="p-3 bg-green-50 rounded-lg text-center">
                                <div className="text-2xl font-bold text-green-600">{paidCount}</div>
                                <div className="text-sm text-gray-600">已付清</div>
                              </div>
                              <div className="p-3 bg-yellow-50 rounded-lg text-center">
                                <div className="text-2xl font-bold text-yellow-600">{partialCount}</div>
                                <div className="text-sm text-gray-600">部分付款</div>
                              </div>
                              <div className="p-3 bg-red-50 rounded-lg text-center">
                                <div className="text-2xl font-bold text-red-600">{unpaidCount}</div>
                                <div className="text-sm text-gray-600">未付款</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm mt-4 pt-4 border-t">
                              <div>
                                <span className="text-gray-600">總應付金額：</span>
                                <span className="font-bold text-blue-600">NT${totalAmount.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">已付金額：</span>
                                <span className="font-bold text-green-600">NT${paidAmount.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">待付金額：</span>
                                <span className="font-bold text-red-600">NT${(totalAmount - paidAmount).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* 付款記錄詳細表格 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        {monthlyPaymentYear}年度付款記錄
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const yearPayments = contractPaymentItems.filter((item: any) => {
                          if (!item.startDate) return false;
                          const itemDate = new Date(item.startDate);
                          return itemDate.getFullYear() === monthlyPaymentYear;
                        }).sort((a: any, b: any) => {
                          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
                        });

                        if (yearPayments.length === 0) {
                          return (
                            <div className="text-center text-gray-500 py-8">
                              <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                              <p>{monthlyPaymentYear}年度暫無付款記錄</p>
                            </div>
                          );
                        }

                        return (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>期別</TableHead>
                                  <TableHead>付款日期</TableHead>
                                  <TableHead className="text-right">應付金額</TableHead>
                                  <TableHead className="text-right">已付金額</TableHead>
                                  <TableHead>狀態</TableHead>
                                  <TableHead>操作</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {yearPayments.map((item: any, index: number) => {
                                  const paid = parseFloat(item.paidAmount || 0);
                                  const total = parseFloat(item.totalAmount || 0);
                                  const isPaid = paid >= total;
                                  const isPartial = paid > 0 && paid < total;
                                  const itemDate = new Date(item.startDate);
                                  const currentDate = new Date();
                                  const isOverdue = !isPaid && itemDate < currentDate;

                                  return (
                                    <TableRow key={item.id} data-testid={`payment-row-${item.id}`}>
                                      <TableCell className="font-medium">
                                        {itemDate.getMonth() + 1}月
                                      </TableCell>
                                      <TableCell>
                                        {itemDate.toLocaleDateString('zh-TW')}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        NT${total.toLocaleString()}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <span className={isPaid ? 'text-green-600 font-medium' : isPartial ? 'text-yellow-600' : ''}>
                                          NT${paid.toLocaleString()}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        {isPaid ? (
                                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            已付清
                                          </Badge>
                                        ) : isPartial ? (
                                          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                                            <Clock className="w-3 h-3 mr-1" />
                                            部分付款
                                          </Badge>
                                        ) : isOverdue ? (
                                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                                            <AlertTriangle className="w-3 h-3 mr-1" />
                                            逾期未付
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                                            <Clock className="w-3 h-3 mr-1" />
                                            待付款
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <Link href={`/general-payment-management?itemId=${item.id}`}>
                                          <Button variant="outline" size="sm" data-testid={`btn-view-payment-${item.id}`}>
                                            <Eye className="w-4 h-4 mr-1" />
                                            查看
                                          </Button>
                                        </Link>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center text-gray-500">
              無法載入租約詳情
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsContractDetailsDialogOpen(false)}>
              關閉
            </Button>
            <Button onClick={() => {
              setIsContractDetailsDialogOpen(false);
              handleEditContract(viewingContract);
            }}>
              編輯租約
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 文件上傳對話框 */}
      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>上傳合約文件</DialogTitle>
            <DialogDescription>
              支援 PDF、Word 文件和圖片格式 (最大 10MB)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">選擇文件</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      toast({
                        title: "文件過大",
                        description: "文件大小不能超過 10MB",
                        variant: "destructive",
                      });
                      return;
                    }
                    setUploadFile(file);
                  }
                }}
                className="mt-1"
              />
              {uploadFile && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">
                    已選擇：{uploadFile.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    大小：{(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="document-type">文件類型</Label>
                <Select onValueChange={(value) => setUploadVersion(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="選擇文件類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="合約正本">合約正本</SelectItem>
                    <SelectItem value="合約修正版">合約修正版</SelectItem>
                    <SelectItem value="附件">附件</SelectItem>
                    <SelectItem value="補充協議">補充協議</SelectItem>
                    <SelectItem value="身分證明">身分證明</SelectItem>
                    <SelectItem value="財力證明">財力證明</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="document-version">版本號 (可選)</Label>
                <Input
                  id="document-version"
                  placeholder="例如：v1.0, 修訂版, 最終版"
                  value={uploadVersion}
                  onChange={(e) => setUploadVersion(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="document-description">文件描述 (可選)</Label>
                <Textarea
                  id="document-description"
                  placeholder="描述文件內容或變更說明"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDocumentDialogOpen(false);
                setUploadFile(null);
              }}
            >
              取消
            </Button>
            <Button
              onClick={async () => {
                if (!uploadFile) {
                  toast({
                    title: "請選擇文件",
                    description: "請先選擇要上傳的文件",
                    variant: "destructive",
                  });
                  return;
                }
                
                if (!selectedContract) {
                  toast({
                    title: "請選擇租約",
                    description: "請先選擇要上傳文件的租約",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  const versionLabel = (document.getElementById('version-label') as HTMLInputElement)?.value || "原始版本";
                  const description = (document.getElementById('document-description') as HTMLTextAreaElement)?.value || "";
                  
                  const formData = new FormData();
                  formData.append('document', uploadFile);
                  formData.append('versionLabel', versionLabel);
                  formData.append('description', description);
                  
                  const response = await fetch(`/api/rental/contracts/${selectedContract.id}/documents`, {
                    method: 'POST',
                    body: formData,
                  });
                  
                  if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`${response.status}: ${errorText}`);
                  }
                  
                  await response.json();
                  
                  // 更新文件列表
                  queryClient.invalidateQueries({ 
                    queryKey: [`/api/rental/contracts/${selectedContract.id}/documents`] 
                  });
                  
                  setIsDocumentDialogOpen(false);
                  setUploadFile(null);
                  
                  toast({
                    title: "文件上傳成功",
                    description: "合約文件已成功上傳",
                  });
                } catch (error: any) {
                  toast({
                    title: "上傳失敗",
                    description: error.message || "文件上傳失敗，請重試",
                    variant: "destructive",
                  });
                }
              }}
              disabled={!uploadFile}
            >
              上傳文件
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 租金付款項目詳細資訊對話框 */}
      <Dialog open={isPaymentDetailOpen} onOpenChange={setIsPaymentDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>租金付款項目詳細資訊</DialogTitle>
            <DialogDescription>
              查看租金付款項目的完整狀態和付款記錄
            </DialogDescription>
          </DialogHeader>
          
          {viewingPayment && (
            <div className="space-y-6">
              {/* 基本資訊卡片 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    基本資訊
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">租約名稱</Label>
                      <p className="font-medium">{viewingPayment.itemName || '未命名租約'}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">付款期間</Label>
                      <p className="font-medium">{viewingPayment.notes || '租金付款'}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">應付金額</Label>
                      <p className="font-medium text-lg">NT${(viewingPayment.totalAmount ? parseFloat(viewingPayment.totalAmount) : 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">已付金額</Label>
                      <p className="font-medium text-lg text-green-600">NT${(viewingPayment.paidAmount ? parseFloat(viewingPayment.paidAmount) : 0).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {/* 付款進度條 */}
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">付款進度</Label>
                    {(() => {
                      const totalAmount = viewingPayment.totalAmount ? parseFloat(viewingPayment.totalAmount) : 0;
                      const paidAmount = viewingPayment.paidAmount ? parseFloat(viewingPayment.paidAmount) : 0;
                      const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
                      
                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>已完成 {Math.round(progress)}%</span>
                            <span>剩餘 NT${(totalAmount - paidAmount).toLocaleString()}</span>
                          </div>
                          <Progress value={progress} className="h-3" />
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* 狀態徽章 */}
                  <div>
                    <Label className="text-sm text-gray-600">付款狀態</Label>
                    <div className="mt-1">
                      {(() => {
                        const totalAmount = viewingPayment.totalAmount ? parseFloat(viewingPayment.totalAmount) : 0;
                        const paidAmount = viewingPayment.paidAmount ? parseFloat(viewingPayment.paidAmount) : 0;
                        const isPaid = viewingPayment.status === 'paid' || paidAmount >= totalAmount;
                        
                        if (isPaid) {
                          return (
                            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              已完成付款
                            </Badge>
                          );
                        } else if (paidAmount > 0) {
                          return (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                              <TrendingUp className="w-4 h-4 mr-2" />
                              部分付款 ({Math.round((paidAmount / totalAmount) * 100)}%)
                            </Badge>
                          );
                        } else {
                          return (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                              <Clock className="w-4 h-4 mr-2" />
                              待付款
                            </Badge>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 付款記錄預覽 - 增強版 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    付款記錄概覽
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* 付款摘要 */}
                  <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">累計已付款</span>
                      <span className="font-bold text-green-600">
                        NT${parseFloat(viewingPayment.paidAmount || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">待付金額</span>
                      <span className="font-bold text-orange-600">
                        NT${(parseFloat(viewingPayment.totalAmount || 0) - parseFloat(viewingPayment.paidAmount || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* 詳細付款記錄列表 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      付款詳細記錄
                    </h4>
                    
                    {viewingPayment.paidAmount && parseFloat(viewingPayment.paidAmount) > 0 ? (
                      <ScrollArea className="h-[280px]">
                        <div className="space-y-3 pr-3">
                          {/* 模擬顯示付款記錄 - 實際使用時會查詢 API */}
                          <div className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className="bg-green-100 text-green-700 border-green-200">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    已付款
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    {viewingPayment.updatedAt 
                                      ? new Date(viewingPayment.updatedAt).toLocaleDateString('zh-TW', { 
                                          year: 'numeric', 
                                          month: 'long', 
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })
                                      : '日期未知'}
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-gray-500">付款金額：</span>
                                    <span className="font-medium text-green-600">
                                      NT${parseFloat(viewingPayment.paidAmount || 0).toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">付款方式：</span>
                                    <span className="font-medium">銀行轉帳</span>
                                  </div>
                                </div>
                                
                                {/* 備註 */}
                                {viewingPayment.notes && (
                                  <div className="mt-2 p-2 bg-gray-100 rounded text-sm">
                                    <span className="text-gray-500 flex items-center gap-1 mb-1">
                                      <FileText className="w-3 h-3" />
                                      備註：
                                    </span>
                                    <p className="text-gray-700">{viewingPayment.notes}</p>
                                  </div>
                                )}
                              </div>
                              
                              {/* 收據/附件區域 */}
                              <div className="ml-4 flex-shrink-0">
                                {viewingPayment.receiptImageUrl ? (
                                  <div 
                                    className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                                    onClick={() => {
                                      window.open(viewingPayment.receiptImageUrl, '_blank');
                                    }}
                                  >
                                    <img 
                                      src={viewingPayment.receiptImageUrl} 
                                      alt="收據附件"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400"><svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>';
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                                    <FileText className="w-8 h-8" />
                                  </div>
                                )}
                                <p className="text-xs text-center text-gray-400 mt-1">
                                  {viewingPayment.receiptImageUrl ? '點擊查看' : '無附件'}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* 提示查看完整記錄 */}
                          <div className="text-center py-2">
                            <p className="text-xs text-gray-500">
                              查看完整付款歷史記錄請點擊下方「查看完整記錄」按鈕
                            </p>
                          </div>
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                        <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium mb-2">尚無付款記錄</p>
                        <p className="text-sm">此項目尚未有任何付款記錄</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setIsPaymentDetailOpen(false)}>
              關閉
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href={`/payment-records?search=${viewingPayment?.itemName || ''}`}>
                  查看完整記錄
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/payment-project-fixed">
                  前往付款管理
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 文件查看對話框 */}
      <Dialog open={isDocumentViewOpen} onOpenChange={setIsDocumentViewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>文件詳細資訊</DialogTitle>
            <DialogDescription>
              查看合約文件的詳細資訊和版本記錄
            </DialogDescription>
          </DialogHeader>
          
          {viewingDocument && (
            <div className="space-y-6">
              {/* 文件基本資訊 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    文件資訊
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">文件名稱</Label>
                      <p className="text-base font-medium">{viewingDocument.fileName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">文件類型</Label>
                      <Badge variant="outline">{viewingDocument.documentType}</Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">版本</Label>
                      <p className="text-base">{viewingDocument.version || 'v1.0'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">上傳日期</Label>
                      <p className="text-base">{new Date(viewingDocument.uploadDate).toLocaleDateString('zh-TW')}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">文件大小</Label>
                      <p className="text-base">{viewingDocument.fileSize || '未知'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">上傳者</Label>
                      <p className="text-base">{viewingDocument.uploadedBy || '系統'}</p>
                    </div>
                  </div>
                  
                  {viewingDocument.description && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">文件描述</Label>
                      <p className="text-base mt-1 p-3 bg-gray-50 rounded-lg">{viewingDocument.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 文件預覽或下載選項 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    文件操作
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2"
                      onClick={() => handleDocumentDownload(viewingDocument)}
                    >
                      <Download className="w-4 h-4" />
                      下載文件
                    </Button>
                    
                    {viewingDocument.fileName?.toLowerCase().endsWith('.pdf') && (
                      <Button 
                        variant="outline" 
                        className="flex items-center gap-2"
                        onClick={() => {
                          // 在新視窗開啟 PDF 預覽
                          window.open(`/api/rental/documents/${viewingDocument.id}/preview`, '_blank');
                        }}
                      >
                        <Eye className="w-4 h-4" />
                        在線預覽
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2 text-red-600 hover:text-red-700"
                      onClick={() => {
                        setIsDocumentViewOpen(false);
                        handleDocumentDelete(viewingDocument.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      刪除文件
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 版本歷史記錄 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    版本歷史
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div>
                        <p className="font-medium text-blue-900">當前版本 {viewingDocument.version || 'v1.0'}</p>
                        <p className="text-sm text-blue-700">
                          上傳於 {new Date(viewingDocument.uploadDate).toLocaleDateString('zh-TW')}
                        </p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">最新</Badge>
                    </div>
                    
                    {/* 這裡可以顯示歷史版本，目前顯示提示 */}
                    <div className="text-center py-4 text-gray-500">
                      <p className="text-sm">版本歷史功能將在後續版本中提供</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsDocumentViewOpen(false)}>
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}