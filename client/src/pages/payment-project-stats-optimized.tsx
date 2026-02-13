import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart as PieChartIcon,
  Target,
  DollarSign,
  Calendar,
  Building2,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from "recharts";

interface PaymentItem {
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
  projectId?: number;
  categoryId?: number;
  notes?: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface PaymentProject {
  id: number;
  projectName: string;
  projectType: string;
  description?: string;
  isActive: boolean;
}


interface ProjectStat {
  id: number;
  name: string;
  totalPlanned: number;
  totalPaid: number;
  itemCount: number;
  pendingItems: number;
  completedItems: number;
  overdueItems: number;
  completionRate?: number;
  pendingAmount?: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

export default function PaymentProjectStatsOptimized() {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("current_month");
  const [activeTab, setActiveTab] = useState("overview");

  // 資料查詢
  const { data: paymentItems = [] } = useQuery<PaymentItem[]>({
    queryKey: [`/api/payment/items?includeDeleted=false`],
  });

  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  });

  // 篩選數據
  const filteredItems = useMemo(() => {
    return paymentItems.filter(item => {
      if (selectedProject !== "all" && item.projectId !== parseInt(selectedProject)) {
        return false;
      }
      return !item.isDeleted;
    });
  }, [paymentItems, selectedProject]);

  // 專案統計概覽
  const projectStats = useMemo(() => {
    const stats = filteredItems.reduce((acc, item) => {
      const projectName = item.projectName || "未分類";
      const projectId = item.projectId || 0;
      
      if (!acc[projectId]) {
        acc[projectId] = {
          id: projectId,
          name: projectName,
          totalPlanned: 0,
          totalPaid: 0,
          itemCount: 0,
          pendingItems: 0,
          completedItems: 0,
          overdueItems: 0
        };
      }

      const planned = parseFloat(item.totalAmount || "0");
      const paid = parseFloat(item.paidAmount || "0");
      
      acc[projectId].totalPlanned += planned;
      acc[projectId].totalPaid += paid;
      acc[projectId].itemCount += 1;

      if (item.status === "pending") acc[projectId].pendingItems += 1;
      else if (item.status === "paid") acc[projectId].completedItems += 1;
      else if (item.status === "overdue") acc[projectId].overdueItems += 1;

      return acc;
    }, {} as Record<number, ProjectStat>);

    return Object.values(stats).map((stat: ProjectStat) => ({
      ...stat,
      completionRate: stat.totalPlanned > 0 ? (stat.totalPaid / stat.totalPlanned * 100) : 0,
      pendingAmount: stat.totalPlanned - stat.totalPaid
    }));
  }, [filteredItems]);

  // 整體統計
  const overallStats = useMemo(() => {
    const totalPlanned = filteredItems.reduce((sum, item) => sum + parseFloat(item.totalAmount || "0"), 0);
    const totalPaid = filteredItems.reduce((sum, item) => sum + parseFloat(item.paidAmount || "0"), 0);
    const totalProjects = new Set(filteredItems.map(item => item.projectId)).size;
    
    const statusCounts = filteredItems.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPlanned,
      totalPaid,
      totalPending: totalPlanned - totalPaid,
      completionRate: totalPlanned > 0 ? (totalPaid / totalPlanned * 100) : 0,
      totalItems: filteredItems.length,
      totalProjects,
      statusCounts
    };
  }, [filteredItems]);

  // 專案表現排名
  const projectRanking = useMemo(() => {
    return [...projectStats]
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 10);
  }, [projectStats]);

  // 金額分布數據
  const amountDistribution = useMemo(() => {
    const ranges = [
      { name: "< 1萬", min: 0, max: 10000 },
      { name: "1-5萬", min: 10000, max: 50000 },
      { name: "5-10萬", min: 50000, max: 100000 },
      { name: "10-50萬", min: 100000, max: 500000 },
      { name: "> 50萬", min: 500000, max: Infinity }
    ];

    return ranges.map(range => {
      const items = filteredItems.filter(item => {
        const amount = parseFloat(item.totalAmount || "0");
        return amount >= range.min && amount < range.max;
      });
      
      return {
        name: range.name,
        count: items.length,
        totalAmount: items.reduce((sum, item) => sum + parseFloat(item.totalAmount || "0"), 0),
        paidAmount: items.reduce((sum, item) => sum + parseFloat(item.paidAmount || "0"), 0)
      };
    }).filter(range => range.count > 0);
  }, [filteredItems]);

  // 狀態分布數據
  const statusDistribution = useMemo(() => {
    const statusMap = {
      pending: { name: "待付款", color: "#fbbf24" },
      partial: { name: "部分付款", color: "#60a5fa" },
      paid: { name: "已付款", color: "#10b981" },
      overdue: { name: "逾期", color: "#ef4444" }
    };

    return Object.entries(overallStats.statusCounts).map(([status, count]) => ({
      name: statusMap[status as keyof typeof statusMap]?.name || status,
      value: count,
      color: statusMap[status as keyof typeof statusMap]?.color || "#6b7280"
    }));
  }, [overallStats.statusCounts]);

  // 趨勢指標
  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    if (current < previous) return <ArrowDownRight className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        {/* 頁面標題和控制項 */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">專案付款統計報表</h1>
            <p className="text-muted-foreground">
              詳細的專案付款分析與統計數據
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="選擇專案" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部專案</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="選擇期間" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">本月</SelectItem>
                <SelectItem value="last_month">上月</SelectItem>
                <SelectItem value="quarter">本季</SelectItem>
                <SelectItem value="year">本年</SelectItem>
                <SelectItem value="all">全部</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 整體統計卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總計劃金額</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                NT$ {overallStats.totalPlanned.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                共 {overallStats.totalItems} 項目
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已付金額</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                NT$ {overallStats.totalPaid.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                完成率 {overallStats.completionRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待付金額</CardTitle>
              <Target className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                NT$ {overallStats.totalPending.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                剩餘 {(100 - overallStats.completionRate).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活躍專案</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {overallStats.totalProjects}
              </div>
              <p className="text-xs text-muted-foreground">
                專案類別
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 詳細統計標籤 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">總覽</TabsTrigger>
            <TabsTrigger value="projects">專案分析</TabsTrigger>
            <TabsTrigger value="distribution">分布統計</TabsTrigger>
            <TabsTrigger value="ranking">表現排名</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 專案金額比較 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    專案金額比較
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={projectStats.slice(0, 8)}>
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => [
                          `NT$ ${Number(value).toLocaleString()}`,
                          name === 'totalPaid' ? '已付' : '計劃'
                        ]}
                      />
                      <Bar dataKey="totalPlanned" fill="#e5e7eb" name="totalPlanned" />
                      <Bar dataKey="totalPaid" fill="#10b981" name="totalPaid" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 狀態分布圓餅圖 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    付款狀態分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {projectStats.map((project) => (
                <Card key={project.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <CardDescription>
                          {project.itemCount} 項目 • 完成率 {project.completionRate.toFixed(1)}%
                        </CardDescription>
                      </div>
                      <Badge variant={project.completionRate >= 80 ? "default" : project.completionRate >= 50 ? "secondary" : "destructive"}>
                        {project.completionRate >= 80 ? "優秀" : project.completionRate >= 50 ? "良好" : "需關注"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">計劃金額</p>
                          <p className="font-semibold">NT$ {project.totalPlanned.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">已付金額</p>
                          <p className="font-semibold text-green-600">NT$ {project.totalPaid.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">待付金額</p>
                          <p className="font-semibold text-yellow-600">NT$ {project.pendingAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">完成項目</p>
                          <p className="font-semibold">{project.completedItems} / {project.itemCount}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>完成進度</span>
                          <span>{project.completionRate.toFixed(1)}%</span>
                        </div>
                        <Progress value={project.completionRate} className="h-2" />
                      </div>

                      {(project.pendingItems > 0 || project.overdueItems > 0) && (
                        <div className="flex gap-2 pt-2">
                          {project.pendingItems > 0 && (
                            <Badge variant="outline" className="text-yellow-600">
                              {project.pendingItems} 項待付款
                            </Badge>
                          )}
                          {project.overdueItems > 0 && (
                            <Badge variant="destructive">
                              {project.overdueItems} 項逾期
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 金額範圍分布 */}
              <Card>
                <CardHeader>
                  <CardTitle>金額範圍分布</CardTitle>
                  <CardDescription>按付款金額大小分組統計</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={amountDistribution}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => [
                          name === 'count' ? `${value} 項` : `NT$ ${Number(value).toLocaleString()}`,
                          name === 'count' ? '項目數' : name === 'totalAmount' ? '總金額' : '已付金額'
                        ]}
                      />
                      <Bar dataKey="count" fill="#8884d8" name="count" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 詳細分布表格 */}
              <Card>
                <CardHeader>
                  <CardTitle>分布詳情</CardTitle>
                  <CardDescription>各金額範圍的詳細統計</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {amountDistribution.map((range, index) => (
                      <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{range.name}</p>
                          <p className="text-sm text-muted-foreground">{range.count} 項目</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">NT$ {range.totalAmount.toLocaleString()}</p>
                          <p className="text-sm text-green-600">
                            已付 {((range.paidAmount / range.totalAmount) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ranking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>專案表現排名</CardTitle>
                <CardDescription>按完成率排序的專案表現</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projectRanking.map((project, index) => (
                    <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-medium">{project.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {project.itemCount} 項目 • NT$ {project.totalPlanned.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold">
                            {project.completionRate.toFixed(1)}%
                          </span>
                          {getTrendIcon(project.completionRate, 70)}
                        </div>
                        <Progress value={project.completionRate} className="w-24 h-2 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}