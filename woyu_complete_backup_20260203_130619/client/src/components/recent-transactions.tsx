import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UtensilsIcon, BusIcon, Banknote, ShoppingCartIcon, FilmIcon } from "lucide-react";
import { format } from "date-fns";
import type { Debt } from "@shared/schema";

export default function RecentTransactions() {
  const { data: debts, isLoading } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
  });

  const getIcon = (categoryId: number) => {
    // This is a simple mapping - in a real app, you'd want to store icons with categories
    const icons = [UtensilsIcon, BusIcon, Banknote, ShoppingCartIcon, FilmIcon];
    return icons[categoryId % icons.length];
  };

  const getIconBg = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100";
      case "partial":
        return "bg-yellow-100";
      default:
        return "bg-red-100";
    }
  };

  const getIconColor = (status: string) => {
    switch (status) {
      case "paid":
        return "text-green-600";
      case "partial":
        return "text-yellow-600";
      default:
        return "text-red-600";
    }
  };

  const getAmountColor = (status: string) => {
    switch (status) {
      case "paid":
        return "text-green-600";
      default:
        return "text-red-600";
    }
  };

  if (isLoading) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>最近交易</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">載入中...</div>
        </CardContent>
      </Card>
    );
  }

  const recentDebts = debts?.slice(0, 5) || [];

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>最近交易</CardTitle>
          <Button variant="link" className="text-primary hover:text-blue-700 font-medium text-sm p-0">
            查看全部
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentDebts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              尚無交易記錄
            </div>
          ) : (
            recentDebts.map((debt) => {
              const Icon = getIcon(debt.categoryId);
              return (
                <div
                  key={debt.id}
                  className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 ${getIconBg(debt.status || "pending")} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${getIconColor(debt.status || "pending")}`} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{debt.debtName}</p>
                      <p className="text-sm text-slate-500">
                        {debt.firstDueDate ? format(new Date(debt.firstDueDate), "yyyy年MM月dd日") : "無日期"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${getAmountColor(debt.status || "pending")}`}>
                      {debt.status === "paid" ? "+" : "-"}NT$ {parseInt(debt.totalAmount).toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">
                      {debt.status === "paid" ? "已付清" : debt.status === "partial" ? "部分支付" : "待付款"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
