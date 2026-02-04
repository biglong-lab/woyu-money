import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, 
  Search, 
  Package, 
  Bell, 
  Palette, 
  BarChart3, 
  Zap,
  Shield,
  Database,
  Smartphone,
  FileText,
  Settings
} from "lucide-react";

// Simple demo components for showcase
const DemoIntelligentReports = () => (
  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
    <h4 className="font-semibold text-blue-600">智能報表演示</h4>
    <div className="grid grid-cols-3 gap-4 text-sm">
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600">99%</div>
        <div>查詢效能提升</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">44</div>
        <div>資料庫索引</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600">15</div>
        <div>新增功能</div>
      </div>
    </div>
  </div>
);

const DemoAdvancedSearch = () => (
  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
    <h4 className="font-semibold text-green-600">進階搜尋演示</h4>
    <div className="space-y-2 text-sm">
      <div>✓ 多維度篩選條件</div>
      <div>✓ 智能搜尋建議</div>
      <div>✓ 即時搜尋結果</div>
      <div>✓ 搜尋歷史記錄</div>
    </div>
  </div>
);

const DemoBatchOperations = () => (
  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
    <h4 className="font-semibold text-purple-600">批量操作演示</h4>
    <div className="space-y-2 text-sm">
      <div>✓ 批量狀態更新</div>
      <div>✓ 批量分類設定</div>
      <div>✓ 批量資料匯入</div>
      <div>✓ 批量報表產出</div>
    </div>
  </div>
);

const DemoNotificationSystem = () => (
  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
    <h4 className="font-semibold text-orange-600">通知系統演示</h4>
    <div className="space-y-2 text-sm">
      <div>✓ 即時付款提醒</div>
      <div>✓ 個人化通知</div>
      <div>✓ 重要事件警示</div>
      <div>✓ 系統狀態更新</div>
    </div>
  </div>
);

export default function FeatureShowcase() {
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const features = [
    {
      id: "intelligent-reports",
      title: "智能報表系統",
      description: "AI驅動的數據分析與視覺化報表",
      icon: BarChart3,
      color: "bg-blue-500",
      component: <DemoIntelligentReports />
    },
    {
      id: "advanced-search",
      title: "進階搜尋功能",
      description: "多維度篩選與智能搜尋建議",
      icon: Search,
      color: "bg-green-500",
      component: <DemoAdvancedSearch />
    },
    {
      id: "batch-operations",
      title: "批量操作工具",
      description: "高效處理大量數據的批量操作",
      icon: Package,
      color: "bg-purple-500",
      component: <DemoBatchOperations />
    },
    {
      id: "notification-system",
      title: "智能通知系統",
      description: "個人化通知與即時提醒",
      icon: Bell,
      color: "bg-orange-500",
      component: <DemoNotificationSystem />
    }
  ];

  const systemImprovements = [
    {
      title: "效能優化",
      description: "查詢速度提升 99%，從秒級降至毫秒級",
      icon: Zap,
      progress: 99,
      color: "text-green-600"
    },
    {
      title: "安全強化",
      description: "新增多層安全防護與資料加密",
      icon: Shield,
      progress: 100,
      color: "text-blue-600"
    },
    {
      title: "資料庫優化",
      description: "44個資料庫索引，提升查詢效率",
      icon: Database,
      progress: 95,
      color: "text-purple-600"
    },
    {
      title: "響應式設計",
      description: "完美支援手機、平板與桌面裝置",
      icon: Smartphone,
      progress: 100,
      color: "text-orange-600"
    }
  ];

  const technicalFeatures = [
    "44個最佳化資料庫索引",
    "15項進階功能模組",
    "多層安全中間件保護",
    "智能快取系統",
    "即時通知推送",
    "進階搜尋演算法",
    "批量操作引擎",
    "響應式使用者介面",
    "主題個人化系統",
    "資料完整性驗證",
    "效能監控儀表板",
    "自動備份機制"
  ];

  return (
    <div className="container-responsive min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="pt-8 pb-12">
        {/* 標題區域 */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="h-12 w-12 text-blue-500 mr-4" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              第五階段功能擴展
            </h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            全面升級的付款管理系統，集成15項進階功能，效能提升99%，打造企業級管理平台
          </p>
          <div className="flex items-center justify-center mt-6 gap-4">
            <Badge variant="secondary" className="px-4 py-2">
              <Zap className="h-4 w-4 mr-2" />
              效能提升 99%
            </Badge>
            <Badge variant="secondary" className="px-4 py-2">
              <Settings className="h-4 w-4 mr-2" />
              15項新功能
            </Badge>
            <Badge variant="secondary" className="px-4 py-2">
              <Shield className="h-4 w-4 mr-2" />
              企業級安全
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="features" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="features">核心功能</TabsTrigger>
            <TabsTrigger value="improvements">系統升級</TabsTrigger>
            <TabsTrigger value="technical">技術規格</TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {features.map((feature) => (
                <Card key={feature.id} className="hover:shadow-xl transition-all duration-300 border-2 hover:border-blue-200 dark:hover:border-blue-800">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-3 rounded-xl ${feature.color}`}>
                          <feature.icon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">{feature.title}</CardTitle>
                          <CardDescription className="text-sm">
                            {feature.description}
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant={activeDemo === feature.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveDemo(activeDemo === feature.id ? null : feature.id)}
                      >
                        {activeDemo === feature.id ? "隱藏" : "展示"}
                      </Button>
                    </div>
                  </CardHeader>
                  {activeDemo === feature.id && (
                    <CardContent className="pt-0">
                      <div className="border-t pt-6">
                        {feature.component}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="improvements" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {systemImprovements.map((improvement, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-3">
                      <improvement.icon className={`h-8 w-8 ${improvement.color}`} />
                      <div className="flex-1">
                        <CardTitle className="text-lg">{improvement.title}</CardTitle>
                        <CardDescription className="text-sm mt-1">
                          {improvement.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>完成度</span>
                        <span className="font-semibold">{improvement.progress}%</span>
                      </div>
                      <Progress value={improvement.progress} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="technical" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-6 w-6" />
                  <span>技術實現清單</span>
                </CardTitle>
                <CardDescription>
                  第五階段功能擴展的完整技術規格與實現項目
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {technicalFeatures.map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                      <span className="text-sm font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>效能指標</CardTitle>
                <CardDescription>
                  系統優化前後的關鍵效能指標對比
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 mb-2">99%</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">查詢速度提升</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-2">44</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">資料庫索引</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-2">15</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">新增功能模組</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 呼叫行動 */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-8 pb-8">
              <h3 className="text-2xl font-bold mb-4">系統升級完成</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-2xl mx-auto">
                第五階段功能擴展已全面實施，所有15項進階功能現已可用。
                系統效能大幅提升，安全性增強，用戶體驗全面優化。
              </p>
              <div className="flex justify-center space-x-4">
                <Link href="/">
                  <Button size="lg" className="px-8">
                    <Sparkles className="h-5 w-5 mr-2" />
                    開始使用新功能
                  </Button>
                </Link>
                <Link href="/payment-analysis">
                  <Button variant="outline" size="lg" className="px-8">
                    <FileText className="h-5 w-5 mr-2" />
                    查看付款分析
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}