import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Calendar, DollarSign, AlertTriangle } from "lucide-react";

interface PaymentItemProps {
  item: {
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
    projectType?: string;
  };
  onEdit: (item: any) => void;
  onViewDetails: (item: any) => void;
}

// 記憶化的付款項目組件
const OptimizedPaymentItem = memo(({ item, onEdit, onViewDetails }: PaymentItemProps) => {
  // 記憶化計算狀態顏色和圖標
  const statusConfig = useMemo(() => {
    switch (item.status) {
      case "paid":
        return { variant: "success" as const, label: "已付款", color: "text-green-600" };
      case "pending":
        return { variant: "warning" as const, label: "待付款", color: "text-yellow-600" };
      case "overdue":
        return { variant: "destructive" as const, label: "逾期", color: "text-red-600" };
      case "partial":
        return { variant: "secondary" as const, label: "部分付款", color: "text-blue-600" };
      default:
        return { variant: "outline" as const, label: item.status, color: "text-gray-600" };
    }
  }, [item.status]);

  // 記憶化計算金額顯示
  const amountDisplay = useMemo(() => {
    const total = parseFloat(item.totalAmount || "0");
    const paid = parseFloat(item.paidAmount || "0");
    const remaining = total - paid;
    
    return {
      total: total.toLocaleString('zh-TW'),
      paid: paid.toLocaleString('zh-TW'),
      remaining: remaining.toLocaleString('zh-TW'),
      isPartiallyPaid: paid > 0 && paid < total
    };
  }, [item.totalAmount, item.paidAmount]);

  // 記憶化計算優先級顯示
  const priorityDisplay = useMemo(() => {
    if (item.priority >= 3) return { label: "高", color: "text-red-500" };
    if (item.priority === 2) return { label: "中", color: "text-yellow-500" };
    return { label: "低", color: "text-green-500" };
  }, [item.priority]);

  // 記憶化計算日期格式
  const formattedDate = useMemo(() => {
    return new Date(item.startDate).toLocaleDateString('zh-TW');
  }, [item.startDate]);

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate mb-1">{item.itemName}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{item.projectName}</span>
              {item.categoryName && (
                <>
                  <span>•</span>
                  <span>{item.categoryName}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-2">
            <Badge variant={statusConfig.variant} className="text-xs">
              {statusConfig.label}
            </Badge>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">NT$ {amountDisplay.remaining}</span>
              {amountDisplay.isPartiallyPaid && (
                <span className="text-muted-foreground">
                  / {amountDisplay.total}
                </span>
              )}
            </div>
            
            <div className={`text-xs ${priorityDisplay.color}`}>
              {priorityDisplay.label}優先級
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formattedDate}</span>
            </div>
            
            {item.paymentType && (
              <Badge variant="outline" className="text-xs">
                {item.paymentType === "single" ? "一次付款" : 
                 item.paymentType === "monthly" ? "月付" : 
                 item.paymentType === "installment" ? "分期" : item.paymentType}
              </Badge>
            )}
          </div>

          {amountDisplay.isPartiallyPaid && (
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(parseFloat(item.paidAmount) / parseFloat(item.totalAmount)) * 100}%` 
                }}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 h-8 text-xs"
            onClick={() => onViewDetails(item)}
          >
            查看詳情
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 h-8 text-xs"
            onClick={() => onEdit(item)}
          >
            編輯
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

OptimizedPaymentItem.displayName = "OptimizedPaymentItem";

export default OptimizedPaymentItem;