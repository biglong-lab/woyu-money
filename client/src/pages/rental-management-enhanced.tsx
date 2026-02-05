import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, DollarSign, FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// 子元件
import { RentalStatsCards } from "@/components/rental-stats-cards";
import { RentalContractList } from "@/components/rental-contract-list";
import { RentalPaymentsTab } from "@/components/rental-payments-tab";
import { RentalDocumentsTab } from "@/components/rental-documents-tab";
import {
  RentalContractDialog,
  SmartAdjustDialog,
  rentalContractSchema,
  type RentalContractForm,
  type PriceTier,
} from "@/components/rental-contract-dialog";
import { RentalContractDetailsDialog } from "@/components/rental-contract-details-dialog";
import { RentalPaymentDetailDialog } from "@/components/rental-payment-detail-dialog";

export default function RentalManagementEnhanced() {
  // 主要導航狀態
  const [activeTab, setActiveTab] = useState("contracts");

  // 對話框狀態
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [isSmartAdjustDialogOpen, setIsSmartAdjustDialogOpen] = useState(false);
  const [isContractDetailsDialogOpen, setIsContractDetailsDialogOpen] = useState(false);
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(false);

  // 編輯和查看狀態
  const [editingContract, setEditingContract] = useState<any>(null);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [viewingContract, setViewingContract] = useState<any>(null);
  const [viewingPayment, setViewingPayment] = useState<any>(null);

  // 表單資料狀態
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([{ yearStart: 1, yearEnd: 3, monthlyAmount: 0 }]);

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

  // ==========================================
  // 查詢數據
  // ==========================================
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

  // ==========================================
  // 表單設置
  // ==========================================
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
      adjustmentType: "percentage",
      adjustmentValue: 0,
      effectiveDate: "",
      reason: "",
    },
  });

  // ==========================================
  // Mutations
  // ==========================================
  const createContractMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/rental/contracts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/contracts"] });
      setIsDialogOpen(false);
      form.reset();
      setPriceTiers([{ yearStart: 1, yearEnd: 3, monthlyAmount: 0 }]);
      toast({ title: "租約建立成功", description: "新的租約已成功建立並開始生成付款項目" });
    },
    onError: (error: any) => {
      toast({ title: "建立失敗", description: error.message || "建立租約時發生錯誤", variant: "destructive" });
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
      toast({ title: "租約更新成功", description: "租約資訊已更新，付款項目已重新生成（保留已付款項目）" });
    },
    onError: (error: any) => {
      toast({ title: "更新失敗", description: error.message || "更新租約時發生錯誤", variant: "destructive" });
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
      toast({ title: "租約刪除成功", description: "租約和未付款項目已成功刪除（已付款項目保留）" });
    },
    onError: (error: any) => {
      toast({ title: "刪除失敗", description: error.message || "刪除租約時發生錯誤", variant: "destructive" });
    },
  });

  const generatePaymentsMutation = useMutation({
    mutationFn: async (contractId: number) => {
      return apiRequest("POST", `/api/rental/contracts/${contractId}/generate-payments`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/payments"] });
      toast({ title: "付款項目生成成功", description: `已生成 ${data.generatedCount} 個付款項目` });
    },
    onError: (error: any) => {
      toast({ title: "生成失敗", description: error.message || "生成付款項目時發生錯誤", variant: "destructive" });
    },
  });

  const smartAdjustMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/rental/contracts/${selectedContract?.id}/smart-adjust`, data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/payments"] });
      setIsSmartAdjustDialogOpen(false);
      setAdjustmentPreview(null);
      toast({ title: "智慧調整完成", description: `已調整 ${data.adjustedCount} 個未來付款項目` });
    },
    onError: (error: any) => {
      toast({ title: "調整失敗", description: error.message || "智慧調整時發生錯誤", variant: "destructive" });
    },
  });

  // ==========================================
  // 智慧調整預覽
  // ==========================================
  const [adjustmentPreview, setAdjustmentPreview] = useState<any>(null);

  const previewAdjustment = async () => {
    const formData = adjustForm.getValues();
    try {
      const response = await apiRequest("POST", `/api/rental/contracts/${selectedContract?.id}/preview-adjustment`, formData);
      setAdjustmentPreview(response);
    } catch (error: any) {
      toast({ title: "預覽失敗", description: error.message || "預覽調整時發生錯誤", variant: "destructive" });
    }
  };

  // ==========================================
  // 事件處理
  // ==========================================
  const handleCreateContract = () => {
    setEditingContract(null);
    form.reset();
    setPriceTiers([{ yearStart: 1, yearEnd: 3, monthlyAmount: 0 }]);
    setIsDialogOpen(true);
  };

  const handleEditContract = async (contract: any) => {
    setEditingContract(contract);

    try {
      const detailResponse: any = await apiRequest("GET", `/api/rental/contracts/${contract.id}`);

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
      toast({ title: "載入合約資料失敗", description: error.message || "無法載入合約詳細資料", variant: "destructive" });
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
      totalMonths: data.totalYears * 12,
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
      if (!response.ok) throw new Error('匯出失敗');

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

      toast({ title: "匯出成功", description: `${monthlyPaymentYear}年租金付款記錄已匯出為 ${format.toUpperCase()} 格式` });
    } catch (error) {
      toast({ title: "匯出失敗", description: "檔案下載失敗，請稍後再試", variant: "destructive" });
    }
  };

  // 文件操作處理
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

      toast({ title: "成功", description: "文件下載完成" });
    } catch (error: any) {
      toast({ title: "下載失敗", description: error.message || "文件下載失敗", variant: "destructive" });
    }
  };

  const handleDocumentDelete = async (documentId: number) => {
    if (!confirm('確定要刪除此文件嗎？此操作無法復原。')) return;

    try {
      const response = await fetch(`/api/rental/documents/${documentId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('刪除失敗');

      queryClient.invalidateQueries({ queryKey: [`/api/rental/contracts/${selectedContract?.id}/documents`] });
      toast({ title: "成功", description: "文件已刪除" });
    } catch (error: any) {
      toast({ title: "刪除失敗", description: error.message || "文件刪除失敗", variant: "destructive" });
    }
  };

  const handleUploadDocument = async (file: File, version: string, description: string) => {
    if (!selectedContract) return;

    try {
      const formData = new FormData();
      formData.append('document', file);
      if (version) formData.append('versionLabel', version);
      if (description) formData.append('description', description);

      const response = await fetch(`/api/rental/contracts/${selectedContract.id}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      queryClient.invalidateQueries({
        queryKey: [`/api/rental/contracts/${selectedContract.id}/documents`]
      });
      toast({ title: "文件上傳成功", description: "合約文件已成功上傳" });
    } catch (error: any) {
      toast({ title: "上傳失敗", description: error.message || "文件上傳失敗，請重試", variant: "destructive" });
    }
  };

  // 價格階層操作
  const addPriceTier = () => {
    const lastTier = priceTiers[priceTiers.length - 1];
    setPriceTiers([
      ...priceTiers,
      { yearStart: lastTier.yearEnd + 1, yearEnd: lastTier.yearEnd + 3, monthlyAmount: 0 },
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

  // ==========================================
  // 載入狀態
  // ==========================================
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // ==========================================
  // 渲染
  // ==========================================
  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* 頁面標題 */}
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

      {/* 統計卡片 */}
      {rentalStats && <RentalStatsCards stats={rentalStats} />}

      {/* 主要內容 Tabs */}
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

        {/* 租約管理 Tab */}
        <TabsContent value="contracts">
          <RentalContractList
            contracts={contracts}
            projects={projects}
            onViewDetails={handleViewDetails}
            onEdit={handleEditContract}
            onDelete={handleDeleteContract}
            onSmartAdjust={(contract) => {
              setSelectedContract(contract);
              setIsSmartAdjustDialogOpen(true);
            }}
            onGeneratePayments={(contractId) => generatePaymentsMutation.mutate(contractId)}
            isGenerating={generatePaymentsMutation.isPending}
          />
        </TabsContent>

        {/* 付款項目 Tab */}
        <TabsContent value="payments">
          <RentalPaymentsTab
            rentalPayments={rentalPayments}
            monthlyPaymentYear={monthlyPaymentYear}
            onMonthlyPaymentYearChange={setMonthlyPaymentYear}
            onExportPayments={handleExportPayments}
            onViewPaymentDetail={(payment) => {
              setViewingPayment(payment);
              setIsPaymentDetailOpen(true);
            }}
          />
        </TabsContent>

        {/* 合約文件 Tab */}
        <TabsContent value="documents">
          <RentalDocumentsTab
            contracts={contracts}
            projects={projects}
            selectedContract={selectedContract}
            onSelectContract={setSelectedContract}
            documents={documents}
            onDocumentDownload={handleDocumentDownload}
            onDocumentDelete={handleDocumentDelete}
            isDocumentDialogOpen={isDocumentDialogOpen}
            onDocumentDialogOpenChange={setIsDocumentDialogOpen}
            onUploadDocument={handleUploadDocument}
            isUploading={false}
          />
        </TabsContent>
      </Tabs>

      {/* ==========================================
          對話框區域
          ========================================== */}

      {/* 建立/編輯租約對話框 */}
      <RentalContractDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingContract={editingContract}
        form={form}
        projects={projects}
        priceTiers={priceTiers}
        onAddPriceTier={addPriceTier}
        onRemovePriceTier={removePriceTier}
        onUpdatePriceTier={updatePriceTier}
        onSubmit={handleSubmit}
        isSubmitting={createContractMutation.isPending || updateContractMutation.isPending}
      />

      {/* 智慧調整對話框 */}
      <SmartAdjustDialog
        isOpen={isSmartAdjustDialogOpen}
        onOpenChange={setIsSmartAdjustDialogOpen}
        selectedContract={selectedContract}
        adjustForm={adjustForm}
        adjustmentPreview={adjustmentPreview}
        onPreview={previewAdjustment}
        onConfirm={() => smartAdjustMutation.mutate(adjustForm.getValues())}
        isSubmitting={smartAdjustMutation.isPending}
      />

      {/* 租約詳情對話框 */}
      <RentalContractDetailsDialog
        isOpen={isContractDetailsDialogOpen}
        onOpenChange={setIsContractDetailsDialogOpen}
        viewingContract={viewingContract}
        viewingContractDetails={viewingContractDetails}
        isLoading={isLoadingContractDetails}
        projects={projects}
        contractPaymentItems={contractPaymentItems}
        contractDetailsTab={contractDetailsTab}
        onContractDetailsTabChange={setContractDetailsTab}
        monthlyPaymentYear={monthlyPaymentYear}
        onMonthlyPaymentYearChange={setMonthlyPaymentYear}
        onEditContract={handleEditContract}
      />

      {/* 付款詳情對話框 */}
      <RentalPaymentDetailDialog
        isOpen={isPaymentDetailOpen}
        onOpenChange={setIsPaymentDetailOpen}
        viewingPayment={viewingPayment}
      />
    </div>
  );
}
