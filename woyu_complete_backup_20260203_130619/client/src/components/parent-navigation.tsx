import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Users, 
  DollarSign, 
  CreditCard, 
  Award, 
  Settings,
  ArrowLeft
} from "lucide-react";

interface ParentNavigationProps {
  currentPath?: string;
  showBackButton?: boolean;
}

export function ParentNavigation({ currentPath, showBackButton = true }: ParentNavigationProps) {
  const navigationItems = [
    {
      path: "/parent/dashboard",
      icon: Home,
      label: "總覽",
      color: "bg-blue-500 hover:bg-blue-600"
    },
    {
      path: "/parent/children",
      icon: Users,
      label: "孩子管理",
      color: "bg-green-500 hover:bg-green-600"
    },
    {
      path: "/parent/allowances",
      icon: DollarSign,
      label: "零用錢",
      color: "bg-yellow-500 hover:bg-yellow-600"
    },
    {
      path: "/parent/loans",
      icon: CreditCard,
      label: "借貸申請",
      color: "bg-purple-500 hover:bg-purple-600"
    },
    {
      path: "/parent/achievements",
      icon: Award,
      label: "成就系統",
      color: "bg-pink-500 hover:bg-pink-600"
    },
    {
      path: "/parent/settings",
      icon: Settings,
      label: "設定",
      color: "bg-gray-500 hover:bg-gray-600"
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4">
        {showBackButton && currentPath !== "/parent/dashboard" && (
          <div className="py-2 border-b border-gray-100">
            <Link href="/parent/dashboard">
              <Button variant="ghost" size="sm" className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                <ArrowLeft className="h-4 w-4" />
                返回總覽
              </Button>
            </Link>
          </div>
        )}
        <div className="grid grid-cols-6 gap-2 py-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            
            return (
              <Link key={item.path} href={item.path}>
                <div className="flex flex-col items-center space-y-1">
                  <div className={`
                    w-12 h-12 rounded-lg flex items-center justify-center text-white transition-all duration-200
                    ${isActive ? item.color + ' scale-110 shadow-lg' : 'bg-gray-400 hover:bg-gray-500'}
                  `}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className={`text-xs font-medium ${isActive ? 'text-gray-800' : 'text-gray-500'}`}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}