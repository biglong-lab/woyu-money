import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  HomeIcon, 
  MenuIcon, 
  XIcon,
  DollarSignIcon,
  BarChart3Icon,
  FolderIcon,
  SettingsIcon,
  UsersIcon,
  TargetIcon,
  BookOpenIcon,
  MessageSquareIcon,
  CalendarIcon,
  MapPinIcon,
  BabyIcon,
  GraduationCapIcon,
  BuildingIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationItem {
  path: string;
  label: string;
  icon: any;
  badge?: string;
}

interface ModuleConfig {
  name: string;
  basePath: string;
  color: string;
  icon: any;
  items: NavigationItem[];
}

const modules: ModuleConfig[] = [
  {
    name: "業務管理系統",
    basePath: "/business",
    color: "bg-blue-500",
    icon: BuildingIcon,
    items: [
      { path: "/business/dashboard", label: "儀表板", icon: HomeIcon },
      { path: "/business/categories", label: "分類管理", icon: FolderIcon },
      { path: "/business/transactions", label: "交易記錄", icon: DollarSignIcon },
      { path: "/business/reports", label: "報告分析", icon: BarChart3Icon },
      { path: "/business/backup", label: "資料備份", icon: BookOpenIcon },
      { path: "/business/settings", label: "系統設定", icon: SettingsIcon },
    ]
  },
  {
    name: "家庭財務管理",
    basePath: "/family",
    color: "bg-green-500",
    icon: UsersIcon,
    items: [
      { path: "/family/dashboard", label: "家庭總覽", icon: HomeIcon },
      { path: "/family/budget", label: "預算規劃", icon: DollarSignIcon },
      { path: "/family/expenses", label: "支出管理", icon: BarChart3Icon },
      { path: "/family/categories", label: "分類設定", icon: FolderIcon },
      { path: "/family/goals", label: "理財目標", icon: TargetIcon },
      { path: "/family/reports", label: "財務報告", icon: BarChart3Icon },
    ]
  },
  {
    name: "專案管理系統",
    basePath: "/projects",
    color: "bg-purple-500",
    icon: MapPinIcon,
    items: [
      { path: "/projects/dashboard", label: "專案總覽", icon: HomeIcon },
      { path: "/projects/planning", label: "任務規劃", icon: CalendarIcon },
      { path: "/projects/budget", label: "預算管理", icon: DollarSignIcon },
      { path: "/projects/notes", label: "筆記研究", icon: BookOpenIcon },
      { path: "/projects/collaboration", label: "家人協作", icon: MessageSquareIcon },
    ]
  },
  {
    name: "兒童教育平台",
    basePath: "/kids",
    color: "bg-yellow-500",
    icon: BabyIcon,
    items: [
      { path: "/kids/dashboard", label: "兒童首頁", icon: HomeIcon },
      { path: "/kids/savings", label: "儲蓄罐", icon: DollarSignIcon },
      { path: "/kids/wishlist", label: "願望清單", icon: TargetIcon },
      { path: "/kids/education", label: "理財教育", icon: GraduationCapIcon },
      { path: "/kids/schedule", label: "任務計劃", icon: CalendarIcon },
      { path: "/kids/loans", label: "借款申請", icon: BookOpenIcon },
    ]
  },
  {
    name: "家長管理中心",
    basePath: "/parent",
    color: "bg-indigo-500",
    icon: UsersIcon,
    items: [
      { path: "/parent/dashboard", label: "管理總覽", icon: HomeIcon },
      { path: "/parent/children", label: "子女管理", icon: BabyIcon },
      { path: "/parent/allowances", label: "零用錢", icon: DollarSignIcon },
      { path: "/parent/loans", label: "借款審核", icon: BookOpenIcon },
    ]
  }
];

interface NavigationMenuProps {
  currentModule?: string;
  className?: string;
}

export default function NavigationMenu({ currentModule, className }: NavigationMenuProps) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // 確定當前模組
  const activeModule = modules.find(module => 
    location.startsWith(module.basePath)
  ) || (currentModule ? modules.find(m => m.basePath === currentModule) : null);

  const isActivePath = (path: string) => {
    return location === path;
  };

  return (
    <div className={cn("relative", className)}>
      {/* 手機版選單按鈕 */}
      <div className="lg:hidden mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full justify-between"
        >
          <div className="flex items-center space-x-2">
            <MenuIcon className="h-4 w-4" />
            <span>{activeModule ? activeModule.name : "選擇功能"}</span>
          </div>
          {isOpen ? <XIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
        </Button>
      </div>

      {/* 桌面版側邊欄或手機版展開選單 */}
      <div className={cn(
        "lg:block",
        isOpen ? "block" : "hidden"
      )}>
        <Card className="w-full lg:w-64">
          <CardContent className="p-0">
            {/* 模組選擇 */}
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm text-gray-600 mb-3">應用程式</h3>
              <div className="space-y-2">
                {modules.map((module) => {
                  const Icon = module.icon;
                  const isActive = location.startsWith(module.basePath);
                  
                  return (
                    <Link key={module.basePath} href={`${module.basePath}/dashboard`}>
                      <Button
                        variant={isActive ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left",
                          isActive && module.color
                        )}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        <span className="text-xs">{module.name}</span>
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* 當前模組的功能選單 */}
            {activeModule && (
              <div className="p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <div className={cn("w-3 h-3 rounded-full", activeModule.color)} />
                  <h3 className="font-semibold text-sm">{activeModule.name}</h3>
                </div>
                
                <div className="space-y-1">
                  {activeModule.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActivePath(item.path);
                    
                    return (
                      <Link key={item.path} href={item.path}>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          size="sm"
                          className="w-full justify-start text-left"
                          onClick={() => setIsOpen(false)}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          <span className="text-sm">{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {item.badge}
                            </Badge>
                          )}
                        </Button>
                      </Link>
                    );
                  })}
                </div>

                {/* 返回主選單 */}
                <div className="mt-4 pt-4 border-t">
                  <Link href="/">
                    <Button variant="outline" size="sm" className="w-full">
                      <HomeIcon className="h-4 w-4 mr-2" />
                      返回主選單
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}