import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Building2,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Plug
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Area, 
  AreaChart 
} from "recharts";

import { DailyRevenueDialog } from "@/components/daily-revenue-dialog";

// 收入統計概覽
interface RevenueStats {
  totalRevenue: number
  recordCount: number
  avgDaily: number
}

// 專案收入分布
interface ProjectRevenue {
  projectId: number
  projectName: string
  totalRevenue: number
  recordCount: number
}

// 專案收入餅圖資料
interface ProjectChartEntry extends ProjectRevenue {
  fill: string
}

// 每日收入趨勢
interface DailyTrendItem {
  date: string
  totalRevenue: number
}

// 月度收入趨勢
interface MonthlyTrendItem {
  month: string
  totalRevenue: number
}

// 年度比較資料
interface YearlyComparisonItem {
  year: number
  month: number
  totalRevenue: number
}

// 每日收款記錄（手動新增）
interface DailyRevenueRecord {
  id: number
  description: string | null
  date: string
  amount: string
}

// 來源統計
interface RevenueSource {
  sourceName: string
  sourceKey: string
  totalRevenue: number
  recordCount: number
}

// 處理後的年度資料
interface ProcessedYearlyEntry {
  month: string
  [yearKey: string]: string | number
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function RevenueReports() {
  const [selectedTab, setSelectedTab] = useState("overview");

  // 每日收入統計
  const { data: revenueStats } = useQuery<RevenueStats>({
    queryKey: ["/api/revenue/reports/stats"],
  });

  // 專案收入分布
  const { data: projectRevenues = [] } = useQuery<ProjectRevenue[]>({
    queryKey: ["/api/revenue/reports/by-project"],
  });

  // 每日收入趨勢
  const { data: dailyTrend = [] } = useQuery<DailyTrendItem[]>({
    queryKey: ["/api/revenue/reports/daily-trend"],
  });

  // 月度收入趨勢
  const { data: monthlyTrend = [] } = useQuery<MonthlyTrendItem[]>({
    queryKey: ["/api/revenue/reports/monthly-trend"],
  });

  // 年度同期比較
  const { data: yearlyComparison = [] } = useQuery<YearlyComparisonItem[]>({
    queryKey: ["/api/revenue/reports/yearly-comparison"],
  });

  // 每日收款記錄（手動新增）
  const { data: dailyRevenues = [] } = useQuery<DailyRevenueRecord[]>({
    queryKey: ["/api/daily-revenues"],
  });

  // 來源統計（各系統貢獻）
  const { data: revenueSources = [] } = useQuery<RevenueSource[]>({
    queryKey: ["/api/revenue/reports/sources"],
  });

  // 處理月度趨勢數據
  const processedMonthlyTrend = monthlyTrend.map((item) => ({
    ...item,
    month: `${item.month.substring(0, 4)}年${item.month.substring(5, 7)}月`
  }));

  // 處理年度比較數據
  const processedYearlyData = (): ProcessedYearlyEntry[] => {
    const grouped = yearlyComparison.reduce(
      (acc: Record<string, ProcessedYearlyEntry>, item) => {
        const monthKey = `${item.month}月`;
        if (!acc[monthKey]) {
          acc[monthKey] = { month: monthKey };
        }
        acc[monthKey][`${item.year}年`] = item.totalRevenue;
        return acc;
      },
      {}
    );
    return Object.values(grouped);
  };

  // 準備專案收入餅圖數據
  const projectChartData: ProjectChartEntry[] = projectRevenues.map((project, index) => ({
    ...project,
    fill: COLORS[index % COLORS.length]
  }));

  return (
    
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">每日收入分析報表</h1>
            <p className="text-gray-600 mt-1">專案收款記錄與趨勢分析</p>
          </div>
          <DailyRevenueDialog />
        </div>

        {/* 統計概覽 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總收入</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                NT$ {(revenueStats?.totalRevenue || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                累計收款金額
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">收款次數</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {revenueStats?.recordCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                總記錄筆數
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">日均收入</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                NT$ {Math.round(revenueStats?.avgDaily || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                平均每日收入
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活躍專案</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {projectRevenues.length}
              </div>
              <p className="text-xs text-muted-foreground">
                有收款記錄的專案
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 來源統計提示條 */}
        {revenueSources.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center text-sm bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <Plug className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="text-blue-700 font-medium text-sm">資料來源：</span>
            {revenueSources.map((s) => {
              const color =
                s.sourceKey === "pms-bridge" ? "bg-blue-100 text-blue-800" :
                s.sourceKey === "pm-bridge"  ? "bg-emerald-100 text-emerald-800" :
                s.sourceKey === "manual"     ? "bg-gray-100 text-gray-700" :
                "bg-purple-100 text-purple-800"
              return (
                <Badge key={s.sourceKey} variant="secondary" className={color}>
                  {s.sourceName}
                  &nbsp;·&nbsp;{s.recordCount.toLocaleString()} 筆
                  &nbsp;NT${Math.round(s.totalRevenue).toLocaleString()}
                </Badge>
              )
            })}
          </div>
        )}

        {/* 詳細分析 Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">總覽</TabsTrigger>
            <TabsTrigger value="daily">每日趨勢</TabsTrigger>
            <TabsTrigger value="monthly">月度趨勢</TabsTrigger>
            <TabsTrigger value="yearly">年度比較</TabsTrigger>
            <TabsTrigger value="projects">專案分析</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 專案收入分布 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    專案收入分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {projectChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={projectChartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="totalRevenue"
                          label={({ projectName, percent }: { projectName: string; percent: number }) =>
                            `${projectName} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {projectChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`NT$ ${value.toLocaleString()}`, '收入']} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      尚無收入數據
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 近期每日收款（含所有來源） */}
              <Card>
                <CardHeader>
                  <CardTitle>近期每日收款</CardTitle>
                  <CardDescription>最近 10 天收款彙總（含 PM 系統 + 手動輸入）</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[...dailyTrend].reverse().slice(0, 10).map((item) => (
                      <div key={item.date} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
                        <div className="text-sm font-medium text-gray-700">{item.date}</div>
                        <div className="font-bold text-green-600">
                          NT$ {item.totalRevenue.toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {dailyTrend.length === 0 && (
                      <div className="text-center py-6 text-gray-500">
                        尚無收款記錄
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="daily" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5" />
                  每日收入趨勢
                </CardTitle>
                <CardDescription>顯示每日收款金額變化</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [`NT$ ${value.toLocaleString()}`, '收入']} />
                      <Area type="monotone" dataKey="totalRevenue" stroke="#0088FE" fill="#0088FE" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-gray-500">
                    尚無每日收入數據
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  月度收入趨勢
                </CardTitle>
                <CardDescription>每月累計收入統計</CardDescription>
              </CardHeader>
              <CardContent>
                {processedMonthlyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={processedMonthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [`NT$ ${value.toLocaleString()}`, '收入']} />
                      <Bar dataKey="totalRevenue" fill="#00C49F" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-gray-500">
                    尚無月度收入數據
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="yearly" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5" />
                  年度同期比較
                </CardTitle>
                <CardDescription>不同年度同月份收入比較</CardDescription>
              </CardHeader>
              <CardContent>
                {processedYearlyData().length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={processedYearlyData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [`NT$ ${value?.toLocaleString() || 0}`, '收入']} />
                      {Object.keys(processedYearlyData()[0] || {})
                        .filter(key => key !== 'month')
                        .map((year, index) => (
                          <Line 
                            key={year} 
                            type="monotone" 
                            dataKey={year} 
                            stroke={COLORS[index % COLORS.length]} 
                            strokeWidth={2}
                          />
                        ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-gray-500">
                    尚無年度比較數據
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  專案收入排行
                </CardTitle>
                <CardDescription>各專案收入統計與排名</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {projectRevenues.map((project, index) => (
                    <div key={project.projectId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{project.projectName}</div>
                          <div className="text-sm text-gray-500">
                            {project.recordCount} 筆記錄
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          NT$ {project.totalRevenue.toLocaleString()}
                        </div>
                        <Badge variant="secondary">
                          {((project.totalRevenue / (revenueStats?.totalRevenue || 1)) * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {projectRevenues.length === 0 && (
                    <div className="text-center py-6 text-gray-500">
                      尚無專案收入數據
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    
  );
}