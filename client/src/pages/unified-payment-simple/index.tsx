/**
 * UnifiedPaymentSimple - 統一付款管理主頁
 * 專案+分類雙維度智能付款系統
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, ArrowLeft } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { FilterSection } from "./FilterSection";
import { SummaryCards } from "./SummaryCards";
import { PaymentItemList } from "./PaymentItemList";
import { RecentPaymentRecords } from "./RecentPaymentRecords";
import { ItemDetailDialog } from "./ItemDetailDialog";
import { calculatePaymentStats } from "./types";
import type {
  PaymentItem,
  PaymentRecord,
  PaymentProject,
  DebtCategory,
} from "./types";

/** 統一付款管理頁面 */
export default function UnifiedPaymentSimple() {
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<PaymentItem | null>(null);

  // --- 資料查詢 ---
  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  });

  const { data: categories = [] } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories/project"],
  });

  const { data: items = [] } = useQuery<PaymentItem[]>({
    queryKey: ["/api/payment/items"],
  });

  const { data: paymentRecords = [] } = useQuery<PaymentRecord[]>({
    queryKey: ["/api/payment/records"],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    refetchOnMount: false,
  });

  // --- 篩選邏輯 ---
  const filteredItems = items.filter((item) => {
    if (item.status === "paid" || item.isDeleted) return false;
    if (selectedProject && item.projectId !== selectedProject) return false;
    if (selectedCategory && item.categoryId !== selectedCategory) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const nameMatch = item.itemName.toLowerCase().includes(term);
      const notesMatch = item.notes?.toLowerCase().includes(term);
      if (!nameMatch && !notesMatch) return false;
    }
    return true;
  });

  const stats = calculatePaymentStats(filteredItems);

  // --- 付款 Mutation ---
  const paymentMutation = useMutation({
    mutationFn: async (data: { amount: number; notes?: string }) => {
      const firstItem = filteredItems[0];
      if (!firstItem) throw new Error("沒有可付款的項目");

      return await apiRequest("PUT", `/api/payment/items/${firstItem.id}`, {
        paidAmount: (
          parseFloat(firstItem.paidAmount || "0") + data.amount
        ).toString(),
        status: "partial",
      });
    },
    onSuccess: () => {
      toast({ title: "付款成功", description: "付款已成功記錄" });
      setPaymentAmount("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
    },
    onError: (error: Error) => {
      toast({
        title: "付款失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePayment = () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "無效金額",
        description: "請輸入有效的付款金額",
        variant: "destructive",
      });
      return;
    }

    if (filteredItems.length === 0) {
      toast({
        title: "沒有項目",
        description: "所選範圍內沒有待付款項目",
        variant: "destructive",
      });
      return;
    }

    paymentMutation.mutate({ amount, notes });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導航 */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  返回首頁
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">
                    統一付款管理
                  </h1>
                  <p className="text-sm text-gray-600">
                    專案+分類雙維度智能付款系統
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/payment/records">
                <Button variant="outline" size="sm">
                  付款記錄
                </Button>
              </Link>
              <Link href="/payment-project">
                <Button variant="outline" size="sm">
                  付款項目
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 主要內容 */}
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          {/* 篩選器 */}
          <FilterSection
            projects={projects}
            categories={categories}
            selectedProject={selectedProject}
            selectedCategory={selectedCategory}
            searchTerm={searchTerm}
            onProjectChange={setSelectedProject}
            onCategoryChange={setSelectedCategory}
            onSearchChange={setSearchTerm}
          />

          {/* 概況卡片 */}
          <SummaryCards stats={stats} />

          {/* 付款執行區域 */}
          {filteredItems.length > 0 && (
            <Card className="mb-8 border border-gray-200 shadow-sm">
              <CardHeader className="pb-5">
                <CardTitle className="text-lg font-semibold text-gray-900 tracking-tight">
                  執行統一付款
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 mt-1">
                  輸入付款金額，系統將優先處理逾期項目
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium">
                      付款金額
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-medium">
                      付款備註
                    </Label>
                    <Input
                      id="notes"
                      placeholder="統一付款備註（可選）"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
                <Button
                  onClick={handlePayment}
                  disabled={paymentMutation.isPending || !paymentAmount}
                  className="w-full text-sm sm:text-base py-2 sm:py-3"
                >
                  {paymentMutation.isPending ? "處理中..." : "執行統一付款"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 付款項目列表 */}
          <PaymentItemList
            items={filteredItems}
            onItemClick={setSelectedItem}
          />

          {/* 最近付款記錄 */}
          <RecentPaymentRecords
            paymentRecords={paymentRecords}
            items={items}
            projects={projects}
            categories={categories}
          />

          {/* 項目詳情對話框 */}
          <ItemDetailDialog
            selectedItem={selectedItem}
            onClose={() => setSelectedItem(null)}
            paymentRecords={paymentRecords}
          />
        </div>
      </div>
    </div>
  );
}
