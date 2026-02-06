/**
 * QuickPaymentDialog - 快速付款對話框
 * 3 步驟完成付款：搜尋項目 → 確認金額 → 完成
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Search,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface QuickPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "search" | "confirm" | "done";

export function QuickPaymentDialog({ open, onOpenChange }: QuickPaymentDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // 查詢所有付款項目（使用 includeAll 取得完整陣列）
  const { data: paymentItemsData, isLoading } = useQuery<{ items?: any[] } | any[]>({
    queryKey: ["/api/payment/items?includeAll=true"],
    enabled: open,
  });

  // 處理 API 回傳格式（可能是陣列或物件）
  const paymentItems = Array.isArray(paymentItemsData)
    ? paymentItemsData
    : (paymentItemsData?.items || []);

  // 篩選待付款項目
  const filteredItems = useMemo(() => {
    const pendingItems = paymentItems.filter((item: any) => {
      const paid = parseFloat(item.paidAmount || "0");
      const total = parseFloat(item.totalAmount || "0");
      return paid < total && item.status !== "completed" && !item.isDeleted;
    });

    if (!searchQuery.trim()) return pendingItems.slice(0, 10);

    const query = searchQuery.toLowerCase();
    return pendingItems.filter((item: any) =>
      item.itemName?.toLowerCase().includes(query) ||
      item.projectName?.toLowerCase().includes(query) ||
      item.categoryName?.toLowerCase().includes(query)
    );
  }, [paymentItems, searchQuery]);

  // 建立付款記錄
  const paymentMutation = useMutation({
    mutationFn: async (data: {
      itemId: number;
      amountPaid: string;
      paymentDate: string;
      paymentMethod: string;
    }) => {
      return apiRequest("POST", "/api/payment/records", {
        itemId: data.itemId,
        amountPaid: data.amountPaid,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project/stats"] });
      setStep("done");
    },
    onError: (error: Error) => {
      toast({
        title: "付款失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelectItem = (item: any) => {
    setSelectedItem(item);
    const remaining = parseFloat(item.totalAmount || "0") - parseFloat(item.paidAmount || "0");
    setAmount(remaining.toString());
    setStep("confirm");
  };

  const handleConfirmPayment = () => {
    if (!selectedItem || !amount) return;
    paymentMutation.mutate({
      itemId: selectedItem.id,
      amountPaid: amount,
      paymentDate,
      paymentMethod,
    });
  };

  const handleClose = () => {
    setStep("search");
    setSearchQuery("");
    setSelectedItem(null);
    setAmount("");
    setPaymentMethod("bank_transfer");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    onOpenChange(false);
  };

  const formatCurrency = (value: any) => {
    const num = parseFloat(value || "0");
    return isNaN(num) ? "0" : num.toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            快速付款
          </DialogTitle>
        </DialogHeader>

        {/* 步驟指示器 */}
        <div className="flex items-center justify-center gap-2 py-2">
          {(["search", "confirm", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? "bg-blue-600 text-white"
                    : i < ["search", "confirm", "done"].indexOf(step)
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <ArrowRight className="w-4 h-4 text-gray-300" />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: 搜尋付款項目 */}
        {step === "search" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜尋項目名稱、專案..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">載入中...</span>
                </div>
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item: any) => {
                  const remaining =
                    parseFloat(item.totalAmount || "0") -
                    parseFloat(item.paidAmount || "0");
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {item.itemName}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.projectName || "無專案"}
                            {item.categoryName ? ` / ${item.categoryName}` : ""}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-sm font-semibold text-red-600">
                            ${formatCurrency(remaining)}
                          </p>
                          <p className="text-[10px] text-gray-400">待付</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400">
                  {searchQuery ? "找不到匹配的項目" : "目前沒有待付款項目"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: 確認金額 */}
        {step === "confirm" && selectedItem && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-medium text-blue-900">{selectedItem.itemName}</p>
              <p className="text-sm text-blue-700">
                {selectedItem.projectName || "無專案"} / 總額 $
                {formatCurrency(selectedItem.totalAmount)}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="amount">付款金額</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    $
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-8"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="method">付款方式</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                    <SelectItem value="cash">現金</SelectItem>
                    <SelectItem value="credit_card">信用卡</SelectItem>
                    <SelectItem value="check">支票</SelectItem>
                    <SelectItem value="mobile_payment">行動支付</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="date">付款日期</Label>
                <Input
                  id="date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep("search")}
              >
                上一步
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmPayment}
                disabled={paymentMutation.isPending || !amount}
              >
                {paymentMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                確認付款
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: 完成 */}
        {step === "done" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">付款成功</h3>
              <p className="text-sm text-gray-500 mt-1">
                已為「{selectedItem?.itemName}」記錄 ${formatCurrency(amount)} 的付款
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              完成
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default QuickPaymentDialog;
