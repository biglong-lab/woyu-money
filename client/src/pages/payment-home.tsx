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
  Zap,
  Activity,
  BarChart3,
  Wallet,
  Shield,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Timer,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";

export default function PaymentHome() {
  const [animationTrigger, setAnimationTrigger] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // API queries
  const { data: projectStatsData, isLoading: projectStatsLoading } = useQuery({
    queryKey: ["/api/payment/projects/stats"]
  });

  const { data: overallStats, isLoading: overallStatsLoading } = useQuery({
    queryKey: ["/api/payment/project/stats"]
  });

  const { data: recentRecords } = useQuery({
    queryKey: ["/api/payment/records"],
    select: (data: any) => Array.isArray(data) ? data.slice(0, 3) : [],
  });

  const { data: paymentItems } = useQuery({
    queryKey: ["/api/payment/items"]
  });

  // Animation and time effects
  useEffect(() => {
    setAnimationTrigger(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Safe data extraction
  const projectStats = Array.isArray((projectStatsData as any)?.projects) ? (projectStatsData as any).projects : [];
  const stats = (overallStats as any) || {};
  const items = Array.isArray(paymentItems) ? paymentItems : [];

  // Enhanced formatting functions
  const formatCurrency = (value: any) => {
    const num = parseInt(value || "0");
    return isNaN(num) ? "0" : num.toLocaleString();
  };

  const formatPercentage = (value: any) => {
    const num = parseFloat(value || "0");
    return isNaN(num) ? "0" : num.toFixed(1);
  };

  // Advanced analytics calculations
  const calculateAdvancedStats = () => {
    const totalPlanned = parseInt(stats?.totalPlanned || "0");
    const totalPaid = parseInt(stats?.totalPaid || "0");
    const totalUnpaid = parseInt(stats?.totalUnpaid || "0");
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Current month calculations
    const thisMonthItems = items.filter((item: any) => {
      if (!item?.startDate) return false;
      const itemDate = new Date(item.startDate);
      return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
    });

    const thisMonthTotal = thisMonthItems.reduce((sum, item: any) => 
      sum + parseFloat(item?.totalAmount || "0"), 0
    );

    const thisMonthPaid = thisMonthItems.reduce((sum, item: any) => 
      sum + parseFloat(item?.paidAmount || "0"), 0
    );

    // Overdue calculations
    const overdueItems = items.filter((item: any) => {
      if (!item?.startDate) return false;
      const dueDate = new Date(item.startDate);
      const paidAmount = parseFloat(item?.paidAmount || "0");
      const totalAmount = parseFloat(item?.totalAmount || "0");
      return dueDate < currentDate && paidAmount < totalAmount;
    });

    const overdueAmount = overdueItems.reduce((sum, item: any) => {
      const paidAmount = parseFloat(item?.paidAmount || "0");
      const totalAmount = parseFloat(item?.totalAmount || "0");
      return sum + (totalAmount - paidAmount);
    }, 0);

    // Calculate trends
    const completionRate = totalPlanned > 0 ? (totalPaid / totalPlanned) * 100 : 0;
    const monthlyProgress = thisMonthTotal > 0 ? (thisMonthPaid / thisMonthTotal) * 100 : 0;

    return {
      totalPlanned,
      totalPaid,
      totalUnpaid,
      thisMonthTotal,
      thisMonthPaid,
      thisMonthUnpaid: thisMonthTotal - thisMonthPaid,
      overdueAmount,
      overdueCount: overdueItems.length,
      completionRate,
      monthlyProgress,
      activeProjects: projectStats.length,
      recentActivity: recentRecords?.length || 0
    };
  };

  const analytics = calculateAdvancedStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 relative overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-96 h-96 bg-gray-200/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full">
          <div className="grid grid-cols-12 gap-4 opacity-[0.02]">
            {[...Array(144)].map((_, i) => (
              <div 
                key={i} 
                className="w-1 h-1 bg-gray-400 rounded-full"
                style={{ animationDelay: `${i * 50}ms` }}
              ></div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 p-6 space-y-8">
        {/* Clean Header */}
        <div className={`transform transition-all duration-1000 ${animationTrigger ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="text-center space-y-4">
            <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full px-6 py-2 shadow-sm">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <span className="text-gray-700 text-sm font-medium tracking-wide">FINANCIAL COMMAND CENTER</span>
              <Sparkles className="w-5 h-5 text-blue-500" />
            </div>
            <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
              智能財務中心
            </h1>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
              即時監控 • 智能分析 • 數據洞察
            </p>
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>系統運行中</span>
              </div>
              <div className="w-1 h-4 bg-gray-300"></div>
              <span>{currentTime.toLocaleTimeString()}</span>
              <div className="w-1 h-4 bg-gray-300"></div>
              <span>{analytics.activeProjects} 個活躍專案</span>
            </div>
          </div>
        </div>

        {/* Clean Stats Dashboard */}
        <div className={`transform transition-all duration-1500 delay-300 ${animationTrigger ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Planned */}
            <div className="group relative">
              <div className="absolute inset-0 bg-white rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 hover:border-blue-300 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-50 to-transparent rounded-full"></div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-0">
                  <CardTitle className="text-sm font-medium text-gray-600 tracking-wider uppercase">總計劃</CardTitle>
                  <div className="relative">
                    <Wallet className="h-6 w-6 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                    NT$ {formatCurrency(analytics.totalPlanned)}
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    <span>系統總額</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Total Paid */}
            <div className="group relative">
              <div className="absolute inset-0 bg-white rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 hover:border-green-300 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-50 to-transparent rounded-full"></div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-0">
                  <CardTitle className="text-sm font-medium text-gray-600 tracking-wider uppercase">已完成</CardTitle>
                  <div className="relative">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                    NT$ {formatCurrency(analytics.totalPaid)}
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <Shield className="w-3 h-3 mr-1" />
                    <span>{formatPercentage(analytics.completionRate)}% 完成</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* This Month Progress */}
            <div className="group relative">
              <div className="absolute inset-0 bg-white rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 hover:border-purple-300 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-50 to-transparent rounded-full"></div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-0">
                  <CardTitle className="text-sm font-medium text-gray-600 tracking-wider uppercase">本月進度</CardTitle>
                  <div className="relative">
                    <Activity className="h-6 w-6 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                    NT$ {formatCurrency(analytics.thisMonthPaid)}
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <Target className="w-3 h-3 mr-1" />
                    <span>{formatPercentage(analytics.monthlyProgress)}% 月度完成</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Alert */}
            <div className="group relative">
              <div className="absolute inset-0 bg-white rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 hover:border-red-300 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-50 to-transparent rounded-full"></div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-0">
                  <CardTitle className="text-sm font-medium text-gray-600 tracking-wider uppercase">逾期警示</CardTitle>
                  <div className="relative">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                    NT$ {formatCurrency(analytics.overdueAmount)}
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <Timer className="w-3 h-3 mr-1" />
                    <span>{analytics.overdueCount} 項目逾期</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Interactive Project Matrix */}
        <div className={`transform transition-all duration-2000 delay-500 ${animationTrigger ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">專案狀況矩陣</h2>
              <p className="text-gray-600">即時監控所有專案執行狀況</p>
            </div>
            <Link 
              href="/payment-items" 
              className="group flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-6 py-3 rounded-xl text-white font-medium transition-all duration-300 hover:scale-105"
            >
              <span>查看全部</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {projectStats && projectStats.length > 0 ? (
              projectStats.map((project: any, index: number) => (
                <div 
                  key={project.id}
                  className="group relative"
                  style={{ animationDelay: `${index * 200}ms` }}
                >
                  <div className="absolute inset-0 bg-white rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300"></div>
                  <Card className="relative bg-white/95 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 hover:border-blue-300 transition-all duration-500 overflow-hidden group-hover:transform group-hover:scale-105">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-transparent rounded-full"></div>
                    
                    <CardHeader className="pb-4 px-0">
                      <div className="flex items-start justify-between mb-4">
                        <CardTitle className="text-lg font-bold flex items-center text-gray-900 leading-tight">
                          {project.projectType === 'business' ? (
                            <Building2 className="h-6 w-6 text-blue-600 mr-3" />
                          ) : (
                            <Home className="h-6 w-6 text-green-600 mr-3" />
                          )}
                          <span className="break-words">{project.projectName || '未命名專案'}</span>
                        </CardTitle>
                        <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-200">
                          {project.projectType === 'business' ? '商業' : '個人'}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="px-0 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 uppercase tracking-wider">計劃總額</p>
                          <p className="text-lg font-bold text-gray-900">NT$ {formatCurrency(project.totalPlanned)}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 uppercase tracking-wider">已付金額</p>
                          <p className="text-lg font-bold text-green-600">NT$ {formatCurrency(project.totalPaid)}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">完成進度</span>
                          <span className="text-sm font-bold text-blue-600">{project.completionRate || 0}%</span>
                        </div>
                        <div className="relative">
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${Math.min(project.completionRate || 0, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-600 text-lg mb-2">
                  {projectStatsLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
                      <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse delay-75"></div>
                      <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse delay-150"></div>
                      <span className="ml-2 text-gray-700">載入專案資料中...</span>
                    </div>
                  ) : (
                    "暫無專案資料"
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Smart Activity Feed */}
        <div className={`transform transition-all duration-2000 delay-700 ${animationTrigger ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">智能活動流</h2>
              <p className="text-gray-600">最新交易動態與系統事件</p>
            </div>
            <Link 
              href="/payment-records" 
              className="group flex items-center space-x-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 px-6 py-3 rounded-xl text-white font-medium transition-all duration-300 hover:scale-105"
            >
              <span>全部記錄</span>
              <BarChart3 className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          </div>
          
          <div className="relative">
            <Card className="relative bg-white/95 backdrop-blur-sm border border-gray-200 rounded-3xl p-8 overflow-hidden shadow-lg">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-blue-500 to-blue-600"></div>
              
              <div className="space-y-6">
                {recentRecords && recentRecords.length > 0 ? (
                  recentRecords.map((record: any, index: number) => (
                    <div 
                      key={record.id} 
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200 hover:border-green-300 transition-all duration-300 group hover:shadow-md"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="relative">
                          <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-white" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full"></div>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-lg">{record.itemName || '付款項目'}</p>
                          <p className="text-sm text-gray-600">
                            {record.projectName} • {new Date(record.paymentDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600 mb-1">
                          NT$ {formatCurrency(record.amount)}
                        </p>
                        <div className="flex items-center text-xs text-gray-400">
                          <Zap className="w-3 h-3 mr-1" />
                          <span>已處理</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-lg mb-4">
                      <div className="flex items-center justify-center space-x-2">
                        <Activity className="w-8 h-8 text-gray-500" />
                        <span>暫無近期活動</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className={`transform transition-all duration-2000 delay-900 ${animationTrigger ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">快速操作中心</h2>
              <p className="text-gray-400">常用功能一鍵直達</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Quick Access Cards */}
            <Link href="/payment-items">
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
                <Card className="relative bg-gray-900/80 backdrop-blur-xl border border-blue-400/30 rounded-2xl p-6 hover:border-blue-400/60 transition-all duration-300 cursor-pointer group-hover:scale-105">
                  <div className="text-center space-y-4">
                    <div className="relative mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
                      <Wallet className="w-8 h-8 text-white" />
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/50 to-cyan-500/50 rounded-2xl animate-pulse"></div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">付款管理</h3>
                      <p className="text-xs text-blue-300">管理所有付款項目</p>
                    </div>
                  </div>
                </Card>
              </div>
            </Link>

            <Link href="/payment-records">
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/30 to-emerald-500/30 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
                <Card className="relative bg-gray-900/80 backdrop-blur-xl border border-green-400/30 rounded-2xl p-6 hover:border-green-400/60 transition-all duration-300 cursor-pointer group-hover:scale-105">
                  <div className="text-center space-y-4">
                    <div className="relative mx-auto w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                      <BarChart3 className="w-8 h-8 text-white" />
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/50 to-emerald-500/50 rounded-2xl animate-pulse"></div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">付款記錄</h3>
                      <p className="text-xs text-green-300">查看交易歷史</p>
                    </div>
                  </div>
                </Card>
              </div>
            </Link>

            <Link href="/payment-reports">
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
                <Card className="relative bg-gray-900/80 backdrop-blur-xl border border-purple-400/30 rounded-2xl p-6 hover:border-purple-400/60 transition-all duration-300 cursor-pointer group-hover:scale-105">
                  <div className="text-center space-y-4">
                    <div className="relative mx-auto w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                      <TrendingUp className="w-8 h-8 text-white" />
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/50 to-pink-500/50 rounded-2xl animate-pulse"></div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">統計報表</h3>
                      <p className="text-xs text-purple-300">深度數據分析</p>
                    </div>
                  </div>
                </Card>
              </div>
            </Link>

            <Link href="/settings">
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-red-500/30 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
                <Card className="relative bg-gray-900/80 backdrop-blur-xl border border-orange-400/30 rounded-2xl p-6 hover:border-orange-400/60 transition-all duration-300 cursor-pointer group-hover:scale-105">
                  <div className="text-center space-y-4">
                    <div className="relative mx-auto w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center">
                      <Shield className="w-8 h-8 text-white" />
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/50 to-red-500/50 rounded-2xl animate-pulse"></div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">系統設定</h3>
                      <p className="text-xs text-orange-300">個人化配置</p>
                    </div>
                  </div>
                </Card>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}