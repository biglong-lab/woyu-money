import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// 共用型別與工具函式
import {
  loanInvestmentSchema,
  isHighRisk,
  calculateMonthlyInterest,
} from "@/components/loan-enhanced-types";
import type {
  LoanInvestmentFormData,
  LoanInvestmentRecord,
  LoanStats,
  QuickPaymentFormData,
} from "@/components/loan-enhanced-types";

// 子元件
import { LoanEnhancedStatsPanel } from "@/components/loan-enhanced-stats-panel";
import { LoanEnhancedRecordTable } from "@/components/loan-enhanced-record-table";
import { LoanEnhancedAddDialog, LoanEnhancedEditDialog } from "@/components/loan-enhanced-form-dialog";
import { LoanEnhancedDetailDialog } from "@/components/loan-enhanced-detail-dialog";
import { LoanEnhancedDeleteDialog } from "@/components/loan-enhanced-delete-dialog";
import { LoanEnhancedQuickPaymentDialog } from "@/components/loan-enhanced-quick-payment-dialog";

// ==========================================
// 借貸投資管理 - 主頁面
// ==========================================

const INITIAL_QUICK_PAYMENT: QuickPaymentFormData = {
  amount: "",
  paymentType: "interest",
  paymentMethod: "cash",
  notes: "",
  paymentDate: new Date().toISOString().split("T")[0],
};

export default function LoanInvestmentEnhanced() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ==========================================
  // Dialog 狀態
  // ==========================================
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [quickPaymentDialogOpen, setQuickPaymentDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LoanInvestmentRecord | null>(null);
  const [quickPaymentForm, setQuickPaymentForm] = useState<QuickPaymentFormData>(INITIAL_QUICK_PAYMENT);

  // ==========================================
  // 表單設定
  // ==========================================
  const form = useForm<LoanInvestmentFormData>({
    resolver: zodResolver(loanInvestmentSchema),
    defaultValues: {
      recordType: "loan",
      hasAgreedReturn: false,
    },
  });

  // ==========================================
  // 資料查詢
  // ==========================================
  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["/api/loan-investment/records"],
  });

  const { data: stats = {} as LoanStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/loan-investment/stats"],
  });

  const safeStats = stats as LoanStats;
  const safeRecords = records as LoanInvestmentRecord[];

  // ==========================================
  // Mutations
  // ==========================================
  const addRecordMutation = useMutation({
    mutationFn: (data: unknown) => apiRequest("POST", "/api/loan-investment/records", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setAddDialogOpen(false);
      form.reset();
      toast({ title: "成功", description: "借貸投資紀錄已新增" });
    },
    onError: (error: Error) => {
      toast({
        title: "錯誤",
        description: error.message || "新增失敗",
        variant: "destructive",
      });
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      apiRequest("PUT", `/api/loan-investment/records/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setEditDialogOpen(false);
      toast({ title: "成功", description: "借貸投資紀錄已更新" });
    },
    onError: (error: Error) => {
      toast({
        title: "錯誤",
        description: error.message || "更新失敗",
        variant: "destructive",
      });
    },
  });

  const deleteRecordMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/loan-investment/records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setDeleteDialogOpen(false);
      setSelectedRecord(null);
      toast({ title: "成功", description: "借貸投資紀錄已刪除" });
    },
    onError: (error: Error) => {
      toast({
        title: "錯誤",
        description: error.message || "刪除失敗",
        variant: "destructive",
      });
    },
  });

  const quickPaymentMutation = useMutation({
    mutationFn: ({ recordId, paymentData }: { recordId: number; paymentData: unknown }) =>
      apiRequest("POST", `/api/loan-investment/records/${recordId}/payments`, paymentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setQuickPaymentDialogOpen(false);
      setSelectedRecord(null);
      setQuickPaymentForm(INITIAL_QUICK_PAYMENT);
      toast({ title: "還款記錄新增成功", description: "還款已成功記錄" });
    },
    onError: (error: Error) => {
      toast({
        title: "新增還款記錄失敗",
        description: error.message || "新增失敗",
        variant: "destructive",
      });
    },
  });

  // ==========================================
  // 事件處理
  // ==========================================
  const handleAddSubmit = (data: LoanInvestmentFormData) => {
    const enhancedData = {
      ...data,
      isHighRisk: isHighRisk(data.annualInterestRate),
    };
    addRecordMutation.mutate(enhancedData);
  };

  const handleEditSubmit = (data: LoanInvestmentFormData) => {
    if (!selectedRecord) return;

    const enhancedData = {
      ...data,
      agreedPaymentDay: data.agreedPaymentDay ? parseInt(String(data.agreedPaymentDay)) : null,
      installmentCount: data.installmentCount ? parseInt(String(data.installmentCount)) : null,
      isHighRisk: isHighRisk(data.annualInterestRate),
      endDate: data.endDate || null,
      partyPhone: data.partyPhone || null,
      partyRelationship: data.partyRelationship || null,
      partyNotes: data.partyNotes || null,
    };

    updateRecordMutation.mutate({ id: selectedRecord.id, data: enhancedData });
  };

  const openEditDialog = (record: LoanInvestmentRecord) => {
    setSelectedRecord(record);

    const formData = {
      itemName: record.itemName || "",
      recordType: record.recordType || "loan",
      principalAmount: record.principalAmount || "",
      partyName: record.partyName || "",
      partyPhone: record.partyPhone || "",
      partyRelationship: record.partyRelationship || "",
      partyNotes: record.partyNotes || "",
      annualInterestRate: record.annualInterestRate || "",
      monthlyPaymentAmount: record.monthlyPaymentAmount || "",
      agreedPaymentDay: record.agreedPaymentDay?.toString() || "",
      interestPaymentMethod: record.interestPaymentMethod || "monthly",
      startDate: record.startDate || "",
      endDate: record.endDate || "",
      status: record.status || "active",
      notes: record.notes || "",
      fixedReturnRate: record.fixedReturnRate || "",
      otherReturnPlan: record.otherReturnPlan || "",
      hasAgreedReturn: record.hasAgreedReturn || false,
      returnMethod: record.returnMethod || "",
      installmentCount: record.installmentCount?.toString() || "",
      installmentAmount: record.installmentAmount || "",
      annualPaymentDate: record.annualPaymentDate || "",
    };

    form.reset(formData as unknown as LoanInvestmentFormData);
    setEditDialogOpen(true);
  };

  const openDetailDialog = (record: LoanInvestmentRecord) => {
    setSelectedRecord(record);
    setDetailDialogOpen(true);
  };

  const openDeleteDialog = (record: LoanInvestmentRecord) => {
    setSelectedRecord(record);
    setDeleteDialogOpen(true);
  };

  const openQuickPaymentDialog = (record: LoanInvestmentRecord) => {
    setSelectedRecord(record);
    const monthlyInterest = calculateMonthlyInterest(
      record.principalAmount,
      record.annualInterestRate
    );
    setQuickPaymentForm({
      ...INITIAL_QUICK_PAYMENT,
      amount: monthlyInterest.toString(),
      paymentDate: new Date().toISOString().split("T")[0],
    });
    setQuickPaymentDialogOpen(true);
  };

  const handleQuickPayment = () => {
    if (!selectedRecord || !quickPaymentForm.amount) return;

    const paymentData = {
      amount: quickPaymentForm.amount,
      paymentType: quickPaymentForm.paymentType,
      paymentMethod: quickPaymentForm.paymentMethod,
      paymentDate: quickPaymentForm.paymentDate,
      notes: quickPaymentForm.notes,
      paymentStatus: "completed",
      isVerified: true,
      recordedBy: "系統用戶",
    };

    quickPaymentMutation.mutate({
      recordId: selectedRecord.id,
      paymentData,
    });
  };

  const handleDetailRecordPayment = () => {
    setDetailDialogOpen(false);
    setPaymentDialogOpen(true);
  };

  // ==========================================
  // 渲染
  // ==========================================
  return (
    <div className="space-y-6 p-6">
      {/* 統計面板 */}
      <LoanEnhancedStatsPanel
        stats={safeStats}
        records={safeRecords}
        statsLoading={statsLoading}
        recordsLoading={recordsLoading}
      />

      {/* 紀錄列表 */}
      <LoanEnhancedRecordTable
        records={safeRecords}
        isLoading={recordsLoading}
        onAdd={() => setAddDialogOpen(true)}
        onView={openDetailDialog}
        onEdit={openEditDialog}
        onDelete={openDeleteDialog}
        onQuickPayment={openQuickPaymentDialog}
      />

      {/* 新增 Dialog */}
      <LoanEnhancedAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        form={form}
        onSubmit={handleAddSubmit}
        isPending={addRecordMutation.isPending}
      />

      {/* 編輯 Dialog */}
      <LoanEnhancedEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        form={form}
        onSubmit={handleEditSubmit}
        isPending={updateRecordMutation.isPending}
      />

      {/* 詳情 Dialog */}
      <LoanEnhancedDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        record={selectedRecord}
        onEdit={openEditDialog}
        onRecordPayment={handleDetailRecordPayment}
      />

      {/* 刪除確認 Dialog */}
      <LoanEnhancedDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        record={selectedRecord}
        onConfirm={(id) => deleteRecordMutation.mutate(id)}
        isPending={deleteRecordMutation.isPending}
      />

      {/* 快速還款 Dialog */}
      <LoanEnhancedQuickPaymentDialog
        open={quickPaymentDialogOpen}
        onOpenChange={setQuickPaymentDialogOpen}
        record={selectedRecord}
        formData={quickPaymentForm}
        onFormChange={setQuickPaymentForm}
        onSubmit={handleQuickPayment}
        isPending={quickPaymentMutation.isPending}
      />
    </div>
  );
}
