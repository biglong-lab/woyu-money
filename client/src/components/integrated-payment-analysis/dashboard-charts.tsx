import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, PieChart as PieChartIcon } from "lucide-react";
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import type { KeyMetrics, ProjectBreakdownItem } from "./types";

// ========================================
// 儀表板圖表元件
// ========================================

interface DashboardChartsProps {
  /** 專案統計資料 */
  projectBreakdown: ProjectBreakdownItem[];
  /** 關鍵指標資料（用於圓餅圖） */
  keyMetrics: KeyMetrics;
}

/** 儀表板頁籤內容：左側專案進度長條圖 + 右側狀態分布圓餅圖 */
export function DashboardCharts({ projectBreakdown, keyMetrics }: DashboardChartsProps) {
  /** 圓餅圖資料 */
  const pieData = [
    { name: '已付款', value: keyMetrics.paidItems, fill: '#10b981' },
    { name: '待付款', value: keyMetrics.pendingItems, fill: '#f59e0b' },
    { name: '逾期', value: keyMetrics.overdueItems, fill: '#ef4444' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 專案進度長條圖 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            專案完成進度
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={projectBreakdown}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [
                  `NT$ ${Number(value).toLocaleString()}`,
                  name === 'paid' ? '已付' : '計劃',
                ]}
              />
              <Bar dataKey="planned" fill="#e5e7eb" name="planned" />
              <Bar dataKey="paid" fill="#10b981" name="paid" />
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
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
