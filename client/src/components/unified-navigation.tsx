import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Home, 
  Receipt, 
  PieChart, 
  Target,
  FileText,
  Users, 
  DollarSign, 
  CreditCard, 
  Award, 
  Settings,
  Menu,
  Building,
  Heart,
  Gamepad2,
  BookOpen,
  Clock,
  Wallet,
  Gift,
  ArrowLeft,
  User,
  Tag
} from "lucide-react";

interface NavigationItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
  color: string;
  section: 'business' | 'family' | 'parent' | 'kids';
}

const navigationItems: NavigationItem[] = [
  // 大人專區 - 浯島文旅營運管理
  { path: "/dashboard", icon: Building, label: "營運總覽", color: "bg-blue-500", section: "business" },
  { path: "/transactions", icon: Receipt, label: "交易記錄", color: "bg-green-500", section: "business" },
  { path: "/categories", icon: PieChart, label: "分類管理", color: "bg-purple-500", section: "business" },
  { path: "/reports", icon: FileText, label: "營運報告", color: "bg-orange-500", section: "business" },
  
  // 家庭專區 - 個人理財管理
  { path: "/family/dashboard", icon: Home, label: "財務總覽", color: "bg-blue-600", section: "family" },
  { path: "/family/expenses", icon: Receipt, label: "支出記錄", color: "bg-red-500", section: "family" },
  { path: "/family/budget", icon: PieChart, label: "預算規劃", color: "bg-green-600", section: "family" },
  { path: "/family/goals", icon: Target, label: "理財目標", color: "bg-purple-600", section: "family" },
  { path: "/family/categories", icon: Tag, label: "分類設定", color: "bg-indigo-500", section: "family" },
  { path: "/family/reports", icon: FileText, label: "財務報告", color: "bg-orange-600", section: "family" },
  
  // 家長管理專區
  { path: "/parent/dashboard", icon: User, label: "總覽", color: "bg-blue-500", section: "parent" },
  { path: "/parent/children", icon: Users, label: "孩子管理", color: "bg-green-500", section: "parent" },
  { path: "/parent/allowances", icon: DollarSign, label: "零用錢", color: "bg-yellow-500", section: "parent" },
  { path: "/parent/loans", icon: CreditCard, label: "借貸申請", color: "bg-purple-500", section: "parent" },
  { path: "/parent/achievements", icon: Award, label: "成就系統", color: "bg-pink-500", section: "parent" },
  { path: "/parent/settings", icon: Settings, label: "設定", color: "bg-gray-500", section: "parent" },
  
  // 小朋友專區
  { path: "/kids/dashboard", icon: Home, label: "我的首頁", color: "bg-blue-400", section: "kids" },
  { path: "/kids/savings", icon: Wallet, label: "我的存錢", color: "bg-green-400", section: "kids" },
  { path: "/kids/wishlist", icon: Gift, label: "心願清單", color: "bg-pink-400", section: "kids" },
  { path: "/kids/loans", icon: CreditCard, label: "借錢記錄", color: "bg-orange-400", section: "kids" },
  { path: "/kids/education", icon: BookOpen, label: "理財學習", color: "bg-purple-400", section: "kids" },
  { path: "/kids/education/games", icon: Gamepad2, label: "理財遊戲", color: "bg-indigo-400", section: "kids" },
  { path: "/kids/schedule", icon: Clock, label: "時間管理", color: "bg-yellow-400", section: "kids" },
  { path: "/kids/achievements", icon: Award, label: "我的成就", color: "bg-red-400", section: "kids" },
];

const sectionLabels = {
  business: "浯島文旅營運",
  family: "家庭理財",
  parent: "家長管理",
  kids: "小朋友專區"
};

const sectionColors = {
  business: "from-blue-500 to-blue-600",
  family: "from-green-500 to-green-600", 
  parent: "from-purple-500 to-purple-600",
  kids: "from-pink-500 to-pink-600"
};

export function UnifiedNavigation() {
  const [location] = useLocation();
  const [currentSection, setCurrentSection] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (location.startsWith('/parent/')) {
      setCurrentSection('parent');
    } else if (location.startsWith('/kids/')) {
      setCurrentSection('kids');
    } else if (location.startsWith('/family/')) {
      setCurrentSection('family');
    } else {
      setCurrentSection('business');
    }
  }, [location]);

  const getCurrentSectionItems = () => {
    return navigationItems.filter(item => item.section === currentSection);
  };

  const isActive = (path: string) => {
    if (path === '/kids/education' && location === '/kids/education/games') {
      return false; // 避免衝突
    }
    return location === path;
  };

  const MobileNavigation = () => (
    <div className="md:hidden">
      {/* Top Header */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>導航選單</SheetTitle>
                  <SheetDescription>
                    選擇功能區域
                  </SheetDescription>
                </SheetHeader>
                
                <div className="mt-6 space-y-6">
                  {Object.entries(sectionLabels).map(([section, label]) => (
                    <div key={section}>
                      <h3 className="font-semibold text-sm text-gray-700 mb-3">{label}</h3>
                      <div className="space-y-2">
                        {navigationItems
                          .filter(item => item.section === section)
                          .map((item) => {
                            const Icon = item.icon;
                            return (
                              <Link key={item.path} href={item.path}>
                                <Button
                                  variant={isActive(item.path) ? "default" : "ghost"}
                                  className="w-full justify-start text-base"
                                  onClick={() => setIsMenuOpen(false)}
                                >
                                  <Icon className="h-5 w-5 mr-3" />
                                  {item.label}
                                  {item.badge && (
                                    <Badge className="ml-auto" variant="secondary">
                                      {item.badge}
                                    </Badge>
                                  )}
                                </Button>
                              </Link>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
            
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {sectionLabels[currentSection as keyof typeof sectionLabels]}
              </h1>
            </div>
          </div>
          
          <Link href="/">
            <Button variant="outline" size="sm">
              <Home className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="grid grid-cols-4 gap-1 p-2">
          {getCurrentSectionItems().slice(0, 4).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link key={item.path} href={item.path}>
                <div className="flex flex-col items-center p-2 rounded-lg transition-colors">
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center text-white mb-1 transition-all
                    ${active ? item.color + ' scale-110 shadow-md' : 'bg-gray-400'}
                  `}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={`text-base font-medium ${active ? 'text-gray-800' : 'text-gray-500'}`}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        
        {getCurrentSectionItems().length > 4 && (
          <div className="px-2 pb-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  更多功能
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-80">
                <div className="grid grid-cols-2 gap-3 p-4">
                  {getCurrentSectionItems().slice(4).map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    
                    return (
                      <Link key={item.path} href={item.path}>
                        <Card className={`transition-all ${active ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}>
                          <CardContent className="p-4 text-center">
                            <div className={`
                              w-12 h-12 rounded-lg flex items-center justify-center text-white mx-auto mb-2
                              ${active ? item.color + ' scale-110' : item.color}
                            `}>
                              <Icon className="h-6 w-6" />
                            </div>
                            <span className="text-lg font-medium">{item.label}</span>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>

      {/* Content Padding */}
      <div className="h-16"></div> {/* Top padding */}
      <div className="h-20"></div> {/* Bottom padding */}
    </div>
  );

  const DesktopNavigation = () => (
    <div className="hidden md:block fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 shadow-sm z-40">
      <div className="p-4">
        <Link href="/">
          <h1 className="text-xl font-bold text-gray-900 mb-6">
            家庭財務管理
          </h1>
        </Link>
        
        <div className="space-y-6">
          {Object.entries(sectionLabels).map(([section, label]) => (
            <div key={section}>
              <div className={`
                px-3 py-2 rounded-lg text-white text-lg font-medium mb-3
                bg-gradient-to-r ${sectionColors[section as keyof typeof sectionColors]}
              `}>
                {label}
              </div>
              
              <div className="space-y-1 ml-2">
                {navigationItems
                  .filter(item => item.section === section)
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    
                    return (
                      <Link key={item.path} href={item.path}>
                        <Button
                          variant={active ? "default" : "ghost"}
                          className="w-full justify-start text-lg py-3"
                        >
                          <Icon className="h-6 w-6 mr-3" />
                          {item.label}
                          {item.badge && (
                            <Badge className="ml-auto" variant="secondary">
                              {item.badge}
                            </Badge>
                          )}
                        </Button>
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <MobileNavigation />
      <DesktopNavigation />
      
      {/* Desktop content margin */}
      <div className="hidden md:block md:ml-64">
        {/* Desktop content goes here */}
      </div>
    </>
  );
}

export default UnifiedNavigation;