import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, DollarSign, Clock, AlertTriangle } from "lucide-react";

// 統計資料介面
export interface RentalStatsData {
  activeContracts?: number;
  monthlyRevenue?: number;
  pendingPayments?: number;
  overduePayments?: number;
}

interface RentalStatsCardsProps {
  readonly stats: RentalStatsData;
}

// 租金管理系統 - 統計卡片元件
export function RentalStatsCards({ stats }: RentalStatsCardsProps) {
  return (
    <div className="grid gap-3 md:gap-6 grid-cols-2 lg:grid-cols-4">
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs md:text-sm font-medium text-gray-600">活躍租約</CardTitle>
          <Building2 className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-xl md:text-2xl font-bold text-gray-900">{stats.activeContracts || 0}</div>
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
            NT${(stats.monthlyRevenue || 0).toLocaleString()}
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
          <div className="text-xl md:text-2xl font-bold text-orange-600">{stats.pendingPayments || 0}</div>
          <p className="text-xs text-gray-500 mt-1">筆待處理</p>
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs md:text-sm font-medium text-gray-600">逾期項目</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-xl md:text-2xl font-bold text-red-600">{stats.overduePayments || 0}</div>
          <p className="text-xs text-gray-500 mt-1">需緊急處理</p>
        </CardContent>
      </Card>
    </div>
  );
}
