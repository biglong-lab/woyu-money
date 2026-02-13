import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from "lucide-react";

interface ChartData {
  name: string;
  value: number;
  amount?: number;
  category?: string;
  risk?: string;
  date?: string;
}

interface ResponsiveChartProps {
  data: ChartData[];
  type: "bar" | "pie" | "line" | "area";
  title: string;
  subtitle?: string;
  height?: number;
  showLegend?: boolean;
  colorScheme?: "default" | "risk" | "performance";
}

// 定義借貸記錄型別
interface LoanRecord {
  recordType: string;
  principalAmount: string | number;
  annualInterestRate: string | number;
  startDate: string | Date;
}

const COLORS = {
  default: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'],
  risk: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'],
  performance: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']
};

export function ResponsiveChart({ 
  data, 
  type, 
  title, 
  subtitle, 
  height = 250, 
  showLegend = true,
  colorScheme = "default" 
}: ResponsiveChartProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const colors = COLORS[colorScheme];

  const renderChart = () => {
    const chartHeight = isMobile ? height * 0.8 : height;
    
    switch (type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                fontSize={isMobile ? 10 : 12}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? "end" : "middle"}
                height={isMobile ? 60 : 30}
              />
              <YAxis fontSize={isMobile ? 10 : 12} />
              <Tooltip 
                formatter={(value: number | string, name: string) => [
                  typeof value === 'number' ? `$${value.toLocaleString()}` : value,
                  name
                ]}
              />
              <Bar dataKey="value" fill={colors[0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={isMobile ? false : ({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={isMobile ? 45 : 60}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number | string) => [
                  typeof value === 'number' ? `$${value.toLocaleString()}` : value
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                fontSize={isMobile ? 10 : 12}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? "end" : "middle"}
                height={isMobile ? 60 : 30}
              />
              <YAxis fontSize={isMobile ? 10 : 12} />
              <Tooltip 
                formatter={(value: number | string) => [
                  typeof value === 'number' ? `$${value.toLocaleString()}` : value
                ]}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={colors[0]} 
                strokeWidth={2}
                dot={{ r: isMobile ? 3 : 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                fontSize={isMobile ? 10 : 12}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? "end" : "middle"}
                height={isMobile ? 60 : 30}
              />
              <YAxis fontSize={isMobile ? 10 : 12} />
              <Tooltip 
                formatter={(value: number | string) => [
                  typeof value === 'number' ? `$${value.toLocaleString()}` : value
                ]}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={colors[0]} 
                fill={colors[0]}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex flex-col space-y-1.5">
          <CardTitle className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold`}>
            {title}
          </CardTitle>
          {subtitle && (
            <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
              {subtitle}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {renderChart()}
        {showLegend && type === "pie" && isMobile && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {data.map((entry, index) => (
              <div key={entry.name} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-xs text-muted-foreground truncate">
                  {entry.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LoanAnalyticsCharts({ records }: { records: LoanRecord[] }) {
  const [chartType, setChartType] = useState<"overview" | "risk" | "timeline">("overview");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Process data for different chart types
  const processOverviewData = () => {
    const loanData = records.filter(r => r.recordType === "loan");
    const investmentData = records.filter(r => r.recordType === "investment");
    
    return [
      { 
        name: "借貸", 
        value: loanData.reduce((sum, r) => sum + parseFloat(r.principalAmount.toString()), 0),
        count: loanData.length
      },
      { 
        name: "投資", 
        value: investmentData.reduce((sum, r) => sum + parseFloat(r.principalAmount.toString()), 0),
        count: investmentData.length
      }
    ];
  };

  const processRiskData = () => {
    const riskCategories = {
      "低風險 (<8%)": 0,
      "中風險 (8-15%)": 0,
      "高風險 (15-20%)": 0,
      "極高風險 (>20%)": 0
    };

    records.forEach(record => {
      const rate = parseFloat(record.annualInterestRate.toString());
      const amount = parseFloat(record.principalAmount.toString());
      
      if (rate < 8) {
        riskCategories["低風險 (<8%)"] += amount;
      } else if (rate < 15) {
        riskCategories["中風險 (8-15%)"] += amount;
      } else if (rate < 20) {
        riskCategories["高風險 (15-20%)"] += amount;
      } else {
        riskCategories["極高風險 (>20%)"] += amount;
      }
    });

    return Object.entries(riskCategories).map(([name, value]) => ({
      name,
      value
    }));
  };

  const processTimelineData = () => {
    const monthlyData: Record<string, number> = {};

    records.forEach(record => {
      const date = new Date(record.startDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += parseFloat(record.principalAmount.toString());
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // 最近12個月
      .map(([name, value]) => ({
        name,
        value: value as number
      }));
  };

  const getChartData = () => {
    switch (chartType) {
      case "overview":
        return processOverviewData();
      case "risk":
        return processRiskData();
      case "timeline":
        return processTimelineData();
      default:
        return [];
    }
  };

  const getChartConfig = () => {
    switch (chartType) {
      case "overview":
        return {
          type: "pie" as const,
          title: "借貸投資總覽",
          subtitle: "按類型分布",
          colorScheme: "default" as const
        };
      case "risk":
        return {
          type: "pie" as const,
          title: "風險分析",
          subtitle: "按風險等級分布",
          colorScheme: "risk" as const
        };
      case "timeline":
        return {
          type: "area" as const,
          title: "時間趨勢",
          subtitle: "最近12個月新增金額",
          colorScheme: "performance" as const
        };
      default:
        return {
          type: "bar" as const,
          title: "數據分析",
          subtitle: "",
          colorScheme: "default" as const
        };
    }
  };

  const chartData = getChartData();
  const chartConfig = getChartConfig();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-semibold">數據分析</h3>
        <Select value={chartType} onValueChange={(value: "overview" | "risk" | "timeline") => setChartType(value)}>
          <SelectTrigger className={`${isMobile ? 'w-full' : 'w-48'}`}>
            <SelectValue placeholder="選擇分析類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overview">總覽分析</SelectItem>
            <SelectItem value="risk">風險分析</SelectItem>
            <SelectItem value="timeline">時間趨勢</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ResponsiveChart
        data={chartData}
        type={chartConfig.type}
        title={chartConfig.title}
        subtitle={chartConfig.subtitle}
        height={isMobile ? 200 : 280}
        colorScheme={chartConfig.colorScheme}
      />
    </div>
  );
}
