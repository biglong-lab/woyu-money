import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DollarSign,
  CheckCircle2,
  Clock,
  TrendingUp,
  Building2,
  Home,
  AlertCircle,
} from "lucide-react";
import { Link } from "wouter";

export default function PaymentHome() {
  const { data: projectStatsData, isLoading: projectStatsLoading } = useQuery({
    queryKey: ["/api/payment/projects/stats"]
  });

  const { data: overallStats, isLoading: overallStatsLoading } = useQuery({
    queryKey: ["/api/payment/project/stats"]
  });

  const { data: recentRecords } = useQuery({
    queryKey: ["/api/payment/records"],
    select: (data: any) => Array.isArray(data) ? data.slice(0, 5) : [],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    refetchOnMount: false,
  });

  const { data: paymentItems } = useQuery({
    queryKey: ["/api/payment/items"]
  });

  // Safe data extraction
  const projectStats = Array.isArray(projectStatsData?.projects) ? projectStatsData.projects : [];
  const stats = overallStats || {};
  const items = Array.isArray(paymentItems) ? paymentItems : [];

  // Helper function for safe number formatting
  const formatCurrency = (value: any) => {
    const num = parseInt(value || "0");
    return isNaN(num) ? "0" : num.toLocaleString();
  };

  // Helper function for monthly calculations
  const calculateMonthlyStats = (monthOffset: number = 0) => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthOffset);
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();

    return items.filter((item: any) => {
      if (!item?.startDate) return false;
      const dueDate = new Date(item.startDate);
      return dueDate.getMonth() === targetMonth && dueDate.getFullYear() === targetYear;
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* 頁面標題 */}
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">付款管理系統</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2 leading-relaxed">專案狀況概覽和付款管理</p>
      </div>

      {/* 統計概覽卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Card className="p-4 sm:p-6 border border-gray-100 shadow-sm bg-gray-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-0">
            <CardTitle className="text-sm font-medium text-gray-700 tracking-wide">計劃總額</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent className="px-0">
            <div className="text-xl sm:text-2xl font-bold text-gray-900 leading-none">
              NT$ {formatCurrency(stats.totalPlanned)}
            </div>
          </CardContent>
        </Card>

        <Card className="p-4 sm:p-6 border border-green-100 shadow-sm bg-green-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-0">
            <CardTitle className="text-sm font-medium text-gray-700 tracking-wide">已付金額</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="px-0">
            <div className="text-xl sm:text-2xl font-bold text-green-700 leading-none">
              NT$ {formatCurrency(stats.totalPaid)}
            </div>
          </CardContent>
        </Card>

        <Card className="p-4 sm:p-6 border border-orange-100 shadow-sm bg-orange-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-0">
            <CardTitle className="text-sm font-medium text-gray-700 tracking-wide">待付金額</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent className="px-0">
            <div className="text-xl sm:text-2xl font-bold text-orange-700 leading-none">
              NT$ {formatCurrency(stats.totalUnpaid)}
            </div>
          </CardContent>
        </Card>

        <Card className="p-4 sm:p-6 border border-blue-100 shadow-sm bg-blue-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-0">
            <CardTitle className="text-sm font-medium text-gray-700 tracking-wide">完成率</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="px-0">
            <div className="text-xl sm:text-2xl font-bold text-blue-700 leading-none">
              {stats.completionRate || '0'}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 月度快速概覽卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Link href="/payment-items">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border border-blue-200 bg-blue-50/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">本月到期</CardTitle>
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
            </CardHeader>
            <CardContent className="px-0">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                NT${(() => {
                  const currentMonthItems = calculateMonthlyStats(0);
                  const total = currentMonthItems.reduce((sum, item: any) => 
                    sum + parseFloat(item?.totalAmount || "0"), 0
                  );
                  return total.toLocaleString();
                })()}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/payment-items">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border border-green-200 bg-green-50/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">本月已付</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                NT${(() => {
                  const currentMonthItems = calculateMonthlyStats(0);
                  const total = currentMonthItems.reduce((sum, item: any) => 
                    sum + parseFloat(item?.paidAmount || "0"), 0
                  );
                  return total.toLocaleString();
                })()}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/payment-items">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border border-orange-200 bg-orange-50/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">本月未付</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                NT${(() => {
                  const currentMonthItems = calculateMonthlyStats(0);
                  const total = currentMonthItems.reduce((sum, item: any) => {
                    const totalAmount = parseFloat(item?.totalAmount || "0");
                    const paidAmount = parseFloat(item?.paidAmount || "0");
                    return sum + Math.max(0, totalAmount - paidAmount);
                  }, 0);
                  return total.toLocaleString();
                })()}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/payment-items">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border border-red-200 bg-red-50/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">過期未付</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                NT${(() => {
                  const currentDate = new Date();
                  const overdueItems = items.filter((item: any) => {
                    if (!item?.startDate) return false;
                    const dueDate = new Date(item.startDate);
                    const paidAmount = parseFloat(item?.paidAmount || "0");
                    const totalAmount = parseFloat(item?.totalAmount || "0");
                    return dueDate < currentDate && paidAmount < totalAmount;
                  });
                  const total = overdueItems.reduce((sum, item: any) => {
                    const paidAmount = parseFloat(item?.paidAmount || "0");
                    const totalAmount = parseFloat(item?.totalAmount || "0");
                    return sum + (totalAmount - paidAmount);
                  }, 0);
                  return total.toLocaleString();
                })()}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 專案狀況概覽 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">專案狀況概覽</h2>
          <Link href="/payment-items" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            查看全部 →
          </Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projectStats && projectStats.length > 0 ? (
            projectStats.map((project: any) => (
              <Card key={project.id} className="hover:shadow-lg transition-all duration-200 border border-gray-200 p-6">
                <CardHeader className="pb-5 px-0">
                  <div className="flex items-start justify-between mb-3">
                    <CardTitle className="text-lg font-semibold flex items-center text-gray-900 leading-tight">
                      {project.projectType === 'business' ? (
                        <Building2 className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
                      ) : (
                        <Home className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                      )}
                      <span className="break-words">{project.name || '未命名專案'}</span>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-0 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 mb-1">計劃總額</p>
                      <p className="font-semibold text-gray-900">NT$ {formatCurrency(project.totalPlanned)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">已付金額</p>
                      <p className="font-semibold text-green-600">NT$ {formatCurrency(project.totalPaid)}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">完成進度</span>
                      <span className="font-medium">{project.completionRate || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(project.completionRate || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-gray-500">
              {projectStatsLoading ? "載入中..." : "暫無專案資料"}
            </div>
          )}
        </div>
      </div>

      {/* 最近付款記錄 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">最近付款記錄</h2>
          <Link href="/payment-records" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            查看全部 →
          </Link>
        </div>
        
        <Card className="p-6">
          <div className="space-y-4">
            {recentRecords && recentRecords.length > 0 ? (
              recentRecords.map((record: any) => (
                <div key={record.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{record.itemName || '付款項目'}</p>
                    <p className="text-sm text-gray-600">
                      {record.projectName} • {new Date(record.paymentDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      NT$ {formatCurrency(record.amount)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">暫無付款記錄</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}