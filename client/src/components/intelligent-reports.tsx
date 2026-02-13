import { useState, useMemo, FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, 
  Download, FileText, AlertTriangle, Target, LucideIcon
} from 'lucide-react';

interface ReportData {
  monthlyTrends: Array<{
    month: string;
    planned: number;
    actual: number;
    variance: number;
  }>;
  categoryBreakdown: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  cashFlowForecast: Array<{
    date: string;
    projected: number;
    actual?: number;
    confidence: number;
  }>;
  kpis: {
    totalPlanned: number;
    totalPaid: number;
    completionRate: number;
    averageAmount: number;
    overdueItems: number;
    monthlyVariance: number;
  };
}

interface IntelligentReportsProps {
  data: ReportData;
  onExport: (format: string, reportType: string) => void;
}

interface KPICardProps {
  title: string;
  value: number;
  format?: 'number' | 'currency' | 'percentage';
  trend?: number;
  icon: LucideIcon;
  color?: string;
}

export function IntelligentReports({ data, onExport }: IntelligentReportsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [selectedReport, setSelectedReport] = useState('overview');

  // 計算趨勢指標
  const trendAnalysis = useMemo(() => {
    const recent = data.monthlyTrends.slice(-3);
    const variance = recent.reduce((sum, item) => sum + item.variance, 0) / recent.length;
    const trend = variance > 0 ? 'increasing' : variance < 0 ? 'decreasing' : 'stable';
    
    return {
      trend,
      variance: Math.abs(variance),
      direction: variance > 0 ? 'up' : 'down'
    };
  }, [data.monthlyTrends]);

  // KPI 卡片組件
  const KPICard: FC<KPICardProps> = ({ title, value, format = 'number', trend, icon: Icon, color = 'blue' }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">
              {format === 'currency' ? `NT$ ${value.toLocaleString()}` : 
               format === 'percentage' ? `${value}%` : 
               value.toLocaleString()}
            </p>
          </div>
          <div className={`p-3 rounded-full bg-${color}-100`}>
            <Icon className={`h-6 w-6 text-${color}-600`} />
          </div>
        </div>
        {trend !== undefined && (
          <div className="flex items-center mt-2">
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className={`text-sm ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {Math.abs(trend)}%
            </span>
            <span className="text-sm text-muted-foreground ml-1">較上月</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // 風險評估組件
  const RiskAssessment = () => {
    const riskLevel = data.kpis.overdueItems > 10 ? 'high' : 
                     data.kpis.overdueItems > 5 ? 'medium' : 'low';
    const riskColor = riskLevel === 'high' ? 'red' : 
                      riskLevel === 'medium' ? 'yellow' : 'green';
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            風險評估
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>逾期項目風險</span>
              <Badge variant={riskLevel === 'high' ? 'destructive' : 
                            riskLevel === 'medium' ? 'secondary' : 'default'}>
                {riskLevel === 'high' ? '高風險' : 
                 riskLevel === 'medium' ? '中風險' : '低風險'}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>完成率</span>
                <span>{data.kpis.completionRate}%</span>
              </div>
              <Progress value={data.kpis.completionRate} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">逾期項目</span>
                <p className="font-semibold text-red-600">{data.kpis.overdueItems}</p>
              </div>
              <div>
                <span className="text-muted-foreground">月度變異</span>
                <p className={`font-semibold ${data.kpis.monthlyVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {data.kpis.monthlyVariance > 0 ? '+' : ''}{data.kpis.monthlyVariance}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* 報表控制器 */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">週報表</SelectItem>
              <SelectItem value="monthly">月報表</SelectItem>
              <SelectItem value="quarterly">季報表</SelectItem>
              <SelectItem value="yearly">年報表</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedReport} onValueChange={setSelectedReport}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">總覽報表</SelectItem>
              <SelectItem value="financial">財務分析</SelectItem>
              <SelectItem value="forecast">預測報表</SelectItem>
              <SelectItem value="performance">績效分析</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onExport('pdf', selectedReport)}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={() => onExport('excel', selectedReport)}>
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* KPI 儀表板 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="總計劃金額"
          value={data.kpis.totalPlanned}
          format="currency"
          trend={0}
          icon={DollarSign}
          color="blue"
        />
        <KPICard
          title="已付金額"
          value={data.kpis.totalPaid}
          format="currency"
          trend={0}
          icon={TrendingUp}
          color="green"
        />
        <KPICard
          title="完成率"
          value={data.kpis.completionRate}
          format="percentage"
          trend={5.2}
          icon={Target}
          color="purple"
        />
        <KPICard
          title="平均金額"
          value={data.kpis.averageAmount}
          format="currency"
          trend={0}
          icon={Calendar}
          color="orange"
        />
      </div>

      {/* 主要報表內容 */}
      <Tabs value={selectedReport} onValueChange={setSelectedReport}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">總覽</TabsTrigger>
          <TabsTrigger value="financial">財務</TabsTrigger>
          <TabsTrigger value="forecast">預測</TabsTrigger>
          <TabsTrigger value="performance">績效</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 月度趨勢 */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>月度趨勢分析</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`NT$ ${Number(value).toLocaleString()}`, '']} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="planned" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="計劃金額"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="actual" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="實際金額"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 風險評估 */}
            <RiskAssessment />
          </div>

          {/* 分類分佈 */}
          <Card>
            <CardHeader>
              <CardTitle>支出分類分佈</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                    >
                      {data.categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`NT$ ${Number(value).toLocaleString()}`, '金額']} />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="space-y-3">
                  {data.categoryBreakdown.map((category, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-sm font-medium">{category.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          NT$ {category.value.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {category.percentage}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>現金流預測</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={data.cashFlowForecast}>
                  <defs>
                    <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="projected"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorProjected)"
                    name="預測金額"
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="實際金額"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
