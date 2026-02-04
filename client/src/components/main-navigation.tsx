import { Link, useLocation } from "wouter";
import { 
  Home, 
  Building2, 
  CreditCard, 
  FileText, 
  BarChart3, 
  DollarSign, 
  Target,
  Settings,
  Calculator,
  TrendingUp,
  Layers
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navigationItems = [
  {
    category: "付款管理",
    items: [
      {
        title: "付款首頁",
        href: "/",
        icon: Home,
        description: "總覽和快速操作"
      },
      {
        title: "付款項目",
        href: "/payment-project",
        icon: Building2,
        description: "管理所有付款項目"
      },
      {
        title: "付款記錄",
        href: "/payment/records",
        icon: FileText,
        description: "查看詳細付款歷史"
      },
      {
        title: "統一付款管理",
        href: "/unified-payment",
        icon: CreditCard,
        description: "專案+分類智能付款分配",
        badge: "新功能"
      }
    ]
  },
  {
    category: "分析報表",
    items: [
      {
        title: "付款分析",
        href: "/payment-analysis",
        icon: BarChart3,
        description: "付款趨勢和統計分析"
      },
      {
        title: "月度分析",
        href: "/monthly-analysis",
        icon: TrendingUp,
        description: "月度付款分析報告"
      },
      {
        title: "付款報表",
        href: "/payment/reports",
        icon: FileText,
        description: "詳細付款統計報表"
      },
      {
        title: "收入分析",
        href: "/revenue/reports",
        icon: DollarSign,
        description: "專案收款記錄與分析"
      }
    ]
  },
  {
    category: "系統管理",
    items: [
      {
        title: "分類管理",
        href: "/category-management",
        icon: Layers,
        description: "管理付款分類"
      },
      {
        title: "專案子分類管理",
        href: "/project/subcategory",
        icon: Target,
        description: "子分類統一付款監控"
      },
      {
        title: "家用記帳",
        href: "/household",
        icon: Calculator,
        description: "家庭開支記錄管理"
      },
      {
        title: "系統設定",
        href: "/settings",
        icon: Settings,
        description: "系統參數設定"
      }
    ]
  }
];

export default function MainNavigation() {
  const [location] = useLocation();

  return (
    <div className="space-y-6">
      {navigationItems.map((category, categoryIndex) => (
        <div key={categoryIndex}>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            {category.category}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {category.items.map((item, itemIndex) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              
              return (
                <Link key={itemIndex} href={item.href}>
                  <Card className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 ${
                    isActive ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isActive ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <Icon className={`w-5 h-5 ${
                            isActive ? 'text-blue-600' : 'text-gray-600'
                          }`} />
                        </div>
                        {item.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      
                      <h3 className={`font-medium mb-2 ${
                        isActive ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {item.title}
                      </h3>
                      
                      <p className={`text-sm ${
                        isActive ? 'text-blue-700' : 'text-gray-600'
                      }`}>
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}