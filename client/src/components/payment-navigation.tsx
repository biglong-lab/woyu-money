import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Building2, CreditCard, BarChart3, TrendingUp, DollarSign, Activity, Settings } from "lucide-react";

const navigationItems = [
  {
    title: "付款分析與專案",
    href: "/payment/analysis", 
    icon: TrendingUp,
    description: "月度分析、專案管理與趨勢報告"
  },
  {
    title: "付款記錄",
    href: "/payment/records",
    icon: CreditCard,
    description: "查看所有付款歷史記錄"
  },
  {
    title: "統計報表",
    href: "/payment/reports",
    icon: BarChart3,
    description: "查看付款統計與分析圖表"
  },
  {
    title: "收入分析",
    href: "/revenue/reports",
    icon: DollarSign,
    description: "查看專案收款記錄與趨勢分析"
  },
  {
    title: "PMS vs PM 比對",
    href: "/revenue/compare",
    icon: Activity,
    description: "PMS 與 PM 月度收入差距分析"
  },
  {
    title: "專案子分類管理",
    href: "/project/subcategory",
    icon: Building2,
    description: "子分類統一付款與狀態監控"
  },
  {
    title: "統一付款管理",
    href: "/unified-payment",
    icon: CreditCard,
    description: "專案+分類雙維度智能付款分配"
  },
  {
    title: "家用記帳",
    href: "/household",
    icon: Home,
    description: "簡化的家庭預算管理"
  },
  {
    title: "系統設定",
    href: "/settings",
    icon: Settings,
    description: "分類管理與專案設定"
  }
];

export function PaymentNavigation() {
  const [location] = useLocation();

  return (
    <div className="w-full bg-background border-b">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">付款規劃系統</h1>
            <p className="text-muted-foreground">浯島文旅營運管理工具</p>
          </div>
        </div>
        
        <nav className="flex space-x-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "flex items-center gap-2 h-auto p-3",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <div className="text-left">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs opacity-70">{item.description}</div>
                  </div>
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function PaymentLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PaymentNavigation />
      <main className="container mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}