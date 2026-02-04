import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, Clock, TrendingUp, DollarSign, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface SmartAlert {
  id: string;
  type: "risk" | "due_soon" | "overdue" | "high_interest" | "payment_due";
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  entityId?: number;
  entityType?: string;
  amount?: string;
  dueDate?: string;
  interestRate?: number;
  isRead: boolean;
  createdAt: string;
}

interface AlertStats {
  totalAlerts: number;
  criticalAlerts: number;
  highRiskLoans: number;
  dueSoonAmount: string;
  overdueAmount: string;
}

export function SmartAlertsPanel() {
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string>("all");

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["/api/smart-alerts"],
  });

  const { data: alertStats = {} as AlertStats } = useQuery({
    queryKey: ["/api/smart-alerts/stats"],
  });

  const safeAlerts = alerts as SmartAlert[];
  const safeStats = alertStats as AlertStats;

  // 過濾未被忽略的警示
  const activeAlerts = safeAlerts.filter(alert => 
    !dismissedAlerts.includes(alert.id) && 
    (filterType === "all" || alert.type === filterType)
  );

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => [...prev, alertId]);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const getSeverityIcon = (type: string) => {
    switch (type) {
      case "risk": return <AlertTriangle className="h-4 w-4" />;
      case "due_soon": return <Clock className="h-4 w-4" />;
      case "overdue": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "high_interest": return <TrendingUp className="h-4 w-4" />;
      case "payment_due": return <DollarSign className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  if (alertsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            智能提醒載入中...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 警示統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總警示數</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeStats.totalAlerts || 0}</div>
            <p className="text-xs text-muted-foreground">
              緊急: {safeStats.criticalAlerts || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">高風險借貸</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{safeStats.highRiskLoans || 0}</div>
            <p className="text-xs text-muted-foreground">
              利息15%以上
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">即將到期</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(safeStats.dueSoonAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              30天內到期
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">逾期金額</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(safeStats.overdueAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              需立即處理
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 警示列表 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              智能提醒系統
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={filterType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("all")}
              >
                全部
              </Button>
              <Button
                variant={filterType === "risk" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("risk")}
              >
                風險
              </Button>
              <Button
                variant={filterType === "due_soon" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("due_soon")}
              >
                到期
              </Button>
              <Button
                variant={filterType === "overdue" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("overdue")}
              >
                逾期
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeAlerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {filterType === "all" ? "目前沒有警示" : `沒有 ${filterType} 類型的警示`}
              </div>
            ) : (
              activeAlerts.map((alert) => (
                <Alert key={alert.id} className="relative">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(alert.type)}
                    <div className="flex-1 space-y-1">
                      <AlertTitle className="flex items-center justify-between">
                        <span>{alert.title}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          {alert.amount && (
                            <Badge variant="outline">
                              {formatCurrency(alert.amount)}
                            </Badge>
                          )}
                          {alert.interestRate && (
                            <Badge variant="outline">
                              {alert.interestRate}%
                            </Badge>
                          )}
                        </div>
                      </AlertTitle>
                      <AlertDescription>
                        {alert.message}
                        {alert.dueDate && (
                          <div className="mt-1 text-sm text-muted-foreground">
                            到期日期: {alert.dueDate}
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissAlert(alert.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Alert>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AlertBadge() {
  const { data: alertStats = {} as AlertStats } = useQuery({
    queryKey: ["/api/smart-alerts/stats"],
  });

  const safeStats = alertStats as AlertStats;
  const criticalCount = safeStats.criticalAlerts || 0;

  if (criticalCount === 0) return null;

  return (
    <div className="relative">
      <Bell className="h-5 w-5" />
      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
        {criticalCount > 9 ? "9+" : criticalCount}
      </span>
    </div>
  );
}