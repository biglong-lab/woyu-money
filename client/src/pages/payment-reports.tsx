import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { zhTW } from "date-fns/locale";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, 
  FileText, Download, Filter, Eye, Users, Target, BarChart3
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";


const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function PaymentReports() {
  const [selectedPeriod, setSelectedPeriod] = useState("6months");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");

  // 查詢穩定的數據來源 - 統計報表需要所有數據，不使用分頁
  const { data: paymentItems = [] } = useQuery<any[]>({
    queryKey: ["/api/payment/items?includeAll=true"]
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/payment/projects"]
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories/project"]
  });

  // 基於實際數據計算統計
  const projectStats = React.useMemo(() => {
    if (!paymentItems.length) return { totalPlanned: 0, totalPaid: 0, totalPending: 0, completionRate: 0 };
    
    const totalPlanned = paymentItems.reduce((sum: number, item: any) => sum + parseFloat(item.totalAmount || "0"), 0);
    
    // 已付金額計算：優先使用 paidAmount，若無則根據 status 判斷
    const totalPaid = paymentItems.reduce((sum: number, item: any) => {
      if (item.status === "paid") {
        // 如果狀態是已付款，使用 paidAmount 或 totalAmount
        return sum + parseFloat(item.paidAmount || item.totalAmount || "0");
      } else if (item.paidAmount && parseFloat(item.paidAmount) > 0) {
        // 部分付款情況
        return sum + parseFloat(item.paidAmount);
      }
      return sum;
    }, 0);
    
    const totalPending = totalPlanned - totalPaid;
    const completionRate = totalPlanned > 0 ? (totalPaid / totalPlanned * 100) : 0;
    
    return { totalPlanned, totalPaid, totalPending, completionRate };
  }, [paymentItems]);

  // 按專案分組統計
  const projectBreakdown = React.useMemo(() => {
    const breakdown = paymentItems.reduce((acc: any, item: any) => {
      const projectId = item.projectId || 0;
      // 從專案列表中找到對應的專案名稱
      const project = projects.find((p: any) => p.id === projectId);
      const projectName = project?.projectName || "未分類";
      
      if (!acc[projectId]) {
        acc[projectId] = {
          name: projectName,
          planned: 0,
          paid: 0,
          pending: 0,
          count: 0
        };
      }
      
      acc[projectId].planned += parseFloat(item.totalAmount || "0");
      
      // 使用與 projectStats 相同的已付金額計算邏輯
      if (item.status === "paid") {
        acc[projectId].paid += parseFloat(item.paidAmount || item.totalAmount || "0");
      } else if (item.paidAmount && parseFloat(item.paidAmount) > 0) {
        acc[projectId].paid += parseFloat(item.paidAmount);
      }
      
      acc[projectId].count += 1;
      
      return acc;
    }, {});
    
    return Object.values(breakdown).map((project: any) => ({
      ...project,
      pending: project.planned - project.paid
    }));
  }, [paymentItems, projects]);

  // 準備圖表數據
  const overviewData = projectBreakdown.length > 0 ? projectBreakdown : [
    { name: '暫無數據', planned: 0, paid: 0, pending: 0 }
  ];

  const statusData = projectStats.totalPlanned > 0 ? [
    { name: '已付款', value: projectStats.totalPaid, fill: '#00C49F' },
    { name: '待付款', value: projectStats.totalPending, fill: '#FF8042' }
  ] : [
    { name: '暫無數據', value: 1, fill: '#E5E7EB' }
  ];

  // 月份趨勢數據（基於付款項目的日期）
  const trendData = React.useMemo(() => {
    const monthlyData = paymentItems.reduce((acc: any, item: any) => {
      const date = new Date(item.startDate || new Date());
      const monthKey = format(date, 'yyyy-MM');
      const monthLabel = format(date, 'MM月', { locale: zhTW });
      
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthLabel, planned: 0, paid: 0, pending: 0 };
      }
      
      acc[monthKey].planned += parseFloat(item.totalAmount || "0");
      acc[monthKey].paid += parseFloat(item.paidAmount || "0");
      
      return acc;
    }, {});
    
    const sortedData = Object.values(monthlyData).map((item: any) => ({
      ...item,
      pending: item.planned - item.paid
    }));
    
    return sortedData.length > 0 ? sortedData : [
      { month: '本月', planned: projectStats.totalPlanned, paid: projectStats.totalPaid, pending: projectStats.totalPending }
    ];
  }, [paymentItems, projectStats]);

  // 分類分析數據
  const categoryData = React.useMemo(() => {
    const categoryStats = paymentItems.reduce((acc: any, item: any) => {
      const categoryName = item.categoryName || "未分類";
      
      if (!acc[categoryName]) {
        acc[categoryName] = { name: categoryName, value: 0 };
      }
      
      acc[categoryName].value += parseFloat(item.totalAmount || "0");
      
      return acc;
    }, {});
    
    return Object.values(categoryStats).length > 0 ? Object.values(categoryStats) : [
      { name: '暫無數據', value: 0 }
    ];
  }, [paymentItems]);

  // 付款方式數據 - 基於付款記錄統計
  const methodData = React.useMemo(() => {
    const methodStats = paymentItems.reduce((acc: any, item: any) => {
      const method = item.paymentType || "未知方式";
      
      if (!acc[method]) {
        acc[method] = { name: method, amount: 0, count: 0 };
      }
      
      acc[method].amount += parseFloat(item.totalAmount || "0");
      acc[method].count += 1;
      
      return acc;
    }, {});
    
    return Object.values(methodStats).length > 0 ? Object.values(methodStats).map((method: any) => ({
      ...method,
      fill: `hsl(${Math.random() * 360}, 60%, 55%)`
    })) : [
      { name: '暫無付款方式數據', amount: 0, count: 0, fill: '#E5E7EB' }
    ];
  }, [paymentItems]);

  // 安全的數據訪問
  const safeProjects = projects || [];
  const safePaymentMethods = methodData || [];
  const safeProjectStats = { ...projectStats, projectBreakdown: projectBreakdown };

  // 提取統計數據 - 直接使用計算結果
  const totalPlanned = projectStats?.totalPlanned || 0;
  const totalPaid = projectStats?.totalPaid || 0;
  const totalPending = projectStats?.totalPending || 0;
  const completionRate = projectStats?.completionRate || 0;

  // 圖表顏色配置
  const COLORS = ['#00C49F', '#8884d8', '#FF8042', '#FFBB28', '#82ca9d', '#ffc658', '#ff7300'];

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-6">
      {/* 頁面標題和操作 - 響應式優化 */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            專案付款統計報表
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            專案付款管理系統分析報告
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            <span className="text-sm">匯出報表</span>
          </Button>
          <Button variant="outline" className="w-full sm:w-auto">
            <Eye className="w-4 h-4 mr-2" />
            <span className="text-sm">預覽列印</span>
          </Button>
        </div>
      </div>

      {/* 篩選器 - 響應式優化 */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">時間範圍</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3months">近3個月</SelectItem>
                  <SelectItem value="6months">近6個月</SelectItem>
                  <SelectItem value="1year">近1年</SelectItem>
                  <SelectItem value="all">全部</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">專案</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部專案</SelectItem>
                  {safeProjects.map((project: any) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full">
                <Filter className="w-4 h-4 mr-2" />
                應用篩選
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 總體統計卡片 - 響應式網格 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0">
            <CardTitle className="text-xs sm:text-sm font-medium">總計畫金額</CardTitle>
            <Target className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-0">
            <div className="text-base sm:text-2xl font-bold">NT$ {totalPlanned.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">全部付款項目</p>
          </CardContent>
        </Card>
        <Card className="p-3 sm:p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0">
            <CardTitle className="text-xs sm:text-sm font-medium">已付金額</CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
          </CardHeader>
          <CardContent className="px-0">
            <div className="text-base sm:text-2xl font-bold text-green-600">NT$ {totalPaid.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              完成率 {completionRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="p-3 sm:p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0">
            <CardTitle className="text-xs sm:text-sm font-medium">待付金額</CardTitle>
            <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" />
          </CardHeader>
          <CardContent className="px-0">
            <div className="text-base sm:text-2xl font-bold text-orange-600">NT$ {totalPending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              剩餘 {(100 - completionRate).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均完成率</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate.toFixed(1)}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${Math.min(completionRate, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 圖表分析 - 響應式標籤頁 */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">總覽分析</TabsTrigger>
          <TabsTrigger value="trend" className="text-xs sm:text-sm">趨勢分析</TabsTrigger>
          <TabsTrigger value="category" className="text-xs sm:text-sm">分類分析</TabsTrigger>
          <TabsTrigger value="method" className="text-xs sm:text-sm">付款方式</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">專案支出總覽</CardTitle>
                <CardDescription className="text-sm">各專案付款項目比較</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={overviewData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value: number) => [`NT$ ${value.toLocaleString()}`, '']} />
                    <Legend />
                    <Bar dataKey="planned" fill="#8884d8" name="計畫金額" />
                    <Bar dataKey="paid" fill="#00C49F" name="已付金額" />
                    <Bar dataKey="pending" fill="#FF8042" name="待付金額" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">付款狀態分布</CardTitle>
                <CardDescription className="text-sm">已付款與待付款比例</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`NT$ ${value.toLocaleString()}`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">專案付款趨勢</CardTitle>
              <CardDescription className="text-sm">各專案付款金額變化趨勢</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value: number) => [`NT$ ${value.toLocaleString()}`, '']} />
                  <Legend />
                  <Line type="monotone" dataKey="paid" stroke="#00C49F" name="已付金額" strokeWidth={2} />
                  <Line type="monotone" dataKey="planned" stroke="#8884d8" name="計畫金額" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">專案分類排行</CardTitle>
              <CardDescription className="text-sm">各專案類別支出金額統計</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={80} fontSize={12} />
                  <Tooltip formatter={(value: number) => [`NT$ ${value.toLocaleString()}`, '支出金額']} />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="method" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">付款方式分布</CardTitle>
              <CardDescription className="text-sm">各種付款方式使用統計</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={methodData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {methodData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} 筆`, '交易數量']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 詳細統計表格 - 響應式改善 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            專案統計摘要
          </CardTitle>
          <CardDescription className="text-sm">專案付款項目詳細數據分析</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-center">
              <div className="p-3 sm:p-4 border rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-blue-600">
                  {safeProjectStats.projectBreakdown?.length || 0}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">總付款項目</div>
              </div>
              <div className="p-3 sm:p-4 border rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-green-600">
                  {safeProjects.length}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">活躍專案</div>
              </div>
              <div className="p-3 sm:p-4 border rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-purple-600">
                  {safePaymentMethods.reduce((sum: number, method: any) => sum + (method.count || 0), 0)}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">總交易筆數</div>
              </div>
              <div className="p-3 sm:p-4 border rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-orange-600">
                  NT$ {totalPaid > 0 ? (totalPaid / Math.max(safePaymentMethods.reduce((sum: number, method: any) => sum + (method.count || 0), 0), 1)).toLocaleString() : 0}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">平均交易金額</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 專案詳細分析表格 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            專案付款詳細分析
          </CardTitle>
          <CardDescription className="text-sm">各專案付款進度和完成率統計</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-sm">專案名稱</th>
                  <th className="text-right p-3 font-medium text-sm">預計金額</th>
                  <th className="text-right p-3 font-medium text-sm">已付金額</th>
                  <th className="text-right p-3 font-medium text-sm">待付金額</th>
                  <th className="text-center p-3 font-medium text-sm">完成率</th>
                  <th className="text-center p-3 font-medium text-sm">項目數</th>
                </tr>
              </thead>
              <tbody>
                {projectBreakdown.map((project: any, index: number) => {
                  const planned = Number(project.planned || 0);
                  const paid = Number(project.paid || 0);
                  const pending = Number(project.pending || 0);
                  const completion = planned > 0 ? (paid / planned * 100) : 0;
                  
                  return (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium text-sm">{project.name || '未命名專案'}</div>
                        <div className="text-xs text-muted-foreground">專案分析</div>
                      </td>
                      <td className="p-3 text-right font-mono text-sm">
                        NT$ {planned.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-sm text-green-600">
                        NT$ {paid.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-sm text-orange-600">
                        NT$ {pending.toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(completion, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{completion.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {project.count || 0} 項
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {projectBreakdown.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-lg mb-2">暫無專案數據</div>
                <div className="text-sm">請先建立專案付款項目</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    
  );
}