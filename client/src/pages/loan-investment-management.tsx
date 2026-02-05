import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import LoanPaymentHistory from "@/components/loan-payment-history";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import {
  StatCards,
  RecordTable,
  RecordCardList,
  RecordFormDialog,
  loanInvestmentSchema,
} from "@/components/loan-investment-mgmt";
import type {
  LoanInvestmentFormData,
  LoanInvestmentRecord,
  LoanInvestmentStats,
} from "@/components/loan-investment-mgmt";

/**
 * 借貸投資管理頁面
 * 負責狀態管理、API 互動與子元件組合
 */
export default function LoanInvestmentManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LoanInvestmentRecord | null>(null);
  const [selectedTab, setSelectedTab] = useState("all");
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [selectedRecordForPayments, setSelectedRecordForPayments] =
    useState<LoanInvestmentRecord | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 取得借貸投資記錄
  const { data: records = [], isLoading } = useQuery<LoanInvestmentRecord[]>({
    queryKey: ["/api/loan-investment/records"],
  });

  // 取得統計資料
  const { data: stats = {} as LoanInvestmentStats } = useQuery<LoanInvestmentStats>({
    queryKey: ["/api/loan-investment/stats"],
  });

  const form = useForm<LoanInvestmentFormData>({
    resolver: zodResolver(loanInvestmentSchema),
    defaultValues: {
      recordType: "loan",
      status: "active",
      paymentMethod: "monthly",
      riskLevel: "medium",
    },
  });

  // ========== Mutations ==========

  const createMutation = useMutation({
    mutationFn: async (data: LoanInvestmentFormData) => {
      return await apiRequest("POST", "/api/loan-investment/records", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "成功", description: "借貸投資記錄已建立" });
    },
    onError: (error: Error) => {
      toast({
        title: "錯誤",
        description: error.message || "建立記錄時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LoanInvestmentFormData> }) => {
      return await apiRequest("PUT", `/api/loan-investment/records/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setIsDialogOpen(false);
      setEditingRecord(null);
      form.reset();
      toast({ title: "成功", description: "借貸投資記錄已更新" });
    },
    onError: (error: Error) => {
      toast({
        title: "錯誤",
        description: error.message || "更新記錄時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/loan-investment/records/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      toast({ title: "成功", description: "借貸投資記錄已刪除" });
    },
    onError: (error: Error) => {
      toast({
        title: "錯誤",
        description: error.message || "刪除記錄時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // ========== 事件處理 ==========

  const onSubmit = (data: LoanInvestmentFormData) => {
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (record: LoanInvestmentRecord) => {
    setEditingRecord(record);
    form.reset({
      itemName: record.itemName,
      recordType: record.recordType as "loan" | "investment",
      partyName: record.partyName,
      partyPhone: record.partyPhone || "",
      partyRelationship: record.partyRelationship || "",
      principalAmount: record.principalAmount,
      annualInterestRate: record.annualInterestRate,
      startDate: record.startDate,
      endDate: record.endDate || "",
      status: record.status as "active" | "completed" | "overdue",
      paymentMethod: record.paymentMethod as "monthly" | "quarterly" | "annually" | "maturity",
      installmentCount: record.installmentCount,
      collateralInfo: record.collateralInfo || "",
      notes: record.notes || "",
      partyNotes: record.partyNotes || "",
      riskLevel: record.riskLevel as "low" | "medium" | "high",
      contractDate: record.contractDate || "",
      maturityDate: record.maturityDate || "",
      guarantorInfo: record.guarantorInfo || "",
      legalDocuments: record.legalDocuments || "",
      documentNotes: record.documentNotes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("確定要刪除這筆記錄嗎？此操作無法復原。")) {
      deleteMutation.mutate(id);
    }
  };

  const openNewDialog = () => {
    setEditingRecord(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleViewPayments = (record: LoanInvestmentRecord) => {
    setSelectedRecordForPayments(record);
    setPaymentHistoryOpen(true);
  };

  // ========== 資料篩選 ==========

  const filteredRecords = records.filter((record) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "loans") return record.recordType === "loan";
    if (selectedTab === "investments") return record.recordType === "investment";
    if (selectedTab === "high-risk") return record.riskLevel === "high";
    return true;
  });

  // ========== 載入中 ==========

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // ========== 渲染 ==========

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">借貸投資管理</h1>
          <p className="text-muted-foreground">管理個人借貸與投資記錄，追蹤資金流向與收益</p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          新增記錄
        </Button>
      </div>

      {/* 統計卡片 */}
      <StatCards stats={stats} />

      {/* 記錄表格 */}
      <Card>
        <CardHeader>
          <CardTitle>借貸投資記錄</CardTitle>
          <CardDescription>查看和管理所有借貸與投資項目</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">全部記錄</TabsTrigger>
              <TabsTrigger value="loans">借出項目</TabsTrigger>
              <TabsTrigger value="investments">投資項目</TabsTrigger>
              <TabsTrigger value="high-risk">高風險項目</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-6">
              <RecordTable
                records={filteredRecords}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onViewPayments={handleViewPayments}
              />
              <RecordCardList
                records={filteredRecords}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onViewPayments={handleViewPayments}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 新增/編輯對話框 */}
      <RecordFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        form={form}
        editingRecord={editingRecord}
        onSubmit={onSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* 還款記錄對話框 */}
      <Dialog open={paymentHistoryOpen} onOpenChange={setPaymentHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>還款記錄管理</DialogTitle>
          </DialogHeader>
          {selectedRecordForPayments && (
            <LoanPaymentHistory
              recordId={selectedRecordForPayments.id}
              recordTitle={selectedRecordForPayments.itemName}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
