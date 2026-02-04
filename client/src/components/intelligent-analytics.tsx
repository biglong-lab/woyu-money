import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Target, 
  Brain, 
  Calendar,
  DollarSign,
  Clock,
  Users,
  BarChart3,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Activity
} from "lucide-react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

interface AnalyticsData {
  cashFlowPrediction: {
    nextMonth: number;
    nextQuarter: number;
    confidence: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  riskAssessment: {
    overdueProbability: number;
    criticalItems: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
  paymentPatterns: {
    averageDelay: number;
    onTimeRate: number;
    peakPaymentDays: number[];
  };
  recommendations: {
    id: string;
    type: 'urgent' | 'optimization' | 'planning';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    actionable: boolean;
  }[];
  seasonalTrends: {
    month: string;
    predicted: number;
    actual?: number;
  }[];
}

interface IntelligentAnalyticsProps {
  projectId?: number;
  timeRange?: 'week' | 'month' | 'quarter' | 'year';
}

export function IntelligentAnalytics({ projectId, timeRange = 'month' }: IntelligentAnalyticsProps) {
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['/api/payment/analytics/intelligent', projectId, timeRange],
    refetchInterval: autoRefresh ? 30000 : false, // 自動刷新30秒
  });

  const analyticsData = analytics as AnalyticsData;

  if (isLoading || !analyticsData) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-8 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* 智能控制面板 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold">智能分析儀表板</h2>
          <Badge variant="secondary" className="text-xs">
            AI 驅動
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="h-4 w-4 mr-1" />
            {autoRefresh ? "即時更新" : "手動更新"}
          </Button>
        </div>
      </div>

      {/* 核心預測指標 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 現金流預測 */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">現金流預測</CardTitle>
              {getTrendIcon(analyticsData.cashFlowPrediction.trend)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                NT$ {analyticsData.cashFlowPrediction.nextMonth.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                下個月預估支出
              </div>
              <div className="flex items-center gap-2">
                <Progress 
                  value={analyticsData.cashFlowPrediction.confidence} 
                  className="flex-1 h-2"
                />
                <span className="text-xs">
                  {analyticsData.cashFlowPrediction.confidence}% 準確度
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 風險評估 */}
        <Card className={`border-l-4 ${
          analyticsData.riskAssessment.riskLevel === 'high' ? 'border-l-red-500' :
          analyticsData.riskAssessment.riskLevel === 'medium' ? 'border-l-yellow-500' :
          'border-l-green-500'
        }`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">風險評估</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${
                analyticsData.riskAssessment.riskLevel === 'high' ? 'text-red-500' :
                analyticsData.riskAssessment.riskLevel === 'medium' ? 'text-yellow-500' :
                'text-green-500'
              }`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {analyticsData.riskAssessment.overdueProbability}%
              </div>
              <div className="text-xs text-muted-foreground">
                逾期風險機率
              </div>
              <Badge className={getRiskColor(analyticsData.riskAssessment.riskLevel)}>
                {analyticsData.riskAssessment.criticalItems} 個關鍵項目
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 付款模式分析 */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">付款模式</CardTitle>
              <Clock className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {analyticsData.paymentPatterns.onTimeRate}%
              </div>
              <div className="text-xs text-muted-foreground">
                準時付款率
              </div>
              <div className="text-xs">
                平均延遲: {analyticsData.paymentPatterns.averageDelay} 天
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 智能建議數量 */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">智能建議</CardTitle>
              <Lightbulb className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {analyticsData.recommendations.length}
              </div>
              <div className="text-xs text-muted-foreground">
                個優化建議
              </div>
              <div className="flex gap-1">
                {analyticsData.recommendations.slice(0, 3).map((rec, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${getImpactColor(rec.impact)}`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 季節性趨勢預測 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            季節性趨勢預測
          </CardTitle>
          <CardDescription>
            基於歷史數據的付款金額預測分析
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.seasonalTrends}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [`NT$ ${value.toLocaleString()}`, '']}
                labelFormatter={(label) => `${label}月`}
              />
              <Line 
                type="monotone" 
                dataKey="predicted" 
                stroke="#8884d8" 
                strokeWidth={2}
                name="預測金額"
                strokeDasharray="5 5"
              />
              <Line 
                type="monotone" 
                dataKey="actual" 
                stroke="#82ca9d" 
                strokeWidth={2}
                name="實際金額"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 智能建議列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI 智能建議
          </CardTitle>
          <CardDescription>
            基於數據分析的個性化優化建議
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analyticsData.recommendations.map((recommendation) => (
              <div
                key={recommendation.id}
                className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
                  selectedInsight === recommendation.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedInsight(
                  selectedInsight === recommendation.id ? null : recommendation.id
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant={
                          recommendation.type === 'urgent' ? 'destructive' :
                          recommendation.type === 'optimization' ? 'default' :
                          'secondary'
                        }
                        className="text-xs"
                      >
                        {recommendation.type === 'urgent' ? '緊急' :
                         recommendation.type === 'optimization' ? '優化' : '規劃'}
                      </Badge>
                      <div className={`w-2 h-2 rounded-full ${getImpactColor(recommendation.impact)}`} />
                      <span className="text-xs text-muted-foreground">
                        {recommendation.impact === 'high' ? '高影響' :
                         recommendation.impact === 'medium' ? '中影響' : '低影響'}
                      </span>
                    </div>
                    <h4 className="font-medium mb-1">{recommendation.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {recommendation.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {recommendation.actionable ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>
                
                {selectedInsight === recommendation.id && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="flex gap-2">
                      <Button size="sm" variant="default">
                        立即執行
                      </Button>
                      <Button size="sm" variant="outline">
                        稍後提醒
                      </Button>
                      <Button size="sm" variant="ghost">
                        忽略建議
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default IntelligentAnalytics;