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
  Layers,
  Menu,
  X,
  Receipt,
  Calendar,
  Repeat,
  Clock,
  Wallet,
  Clipboard,
  Link as LinkIcon,
  FolderOpen,
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  Trash2,
  Camera,
  Inbox
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

const navigationItems = [
  // 核心功能
  {
    title: "付款首頁",
    href: "/",
    icon: Home,
    category: "main"
  },
  {
    title: "單據收件箱",
    href: "/document-inbox",
    icon: Inbox,
    category: "main",
    badge: "AI"
  },
  
  // 付款方式管理 - 分離的四種管理頁面
  {
    title: "月付管理",
    href: "/monthly-payment-management",
    icon: Repeat,
    category: "management",
    badge: "月付"
  },
  {
    title: "分期管理", 
    href: "/installment-payment-management",
    icon: CreditCard,
    category: "management",
    badge: "分期"
  },
  {
    title: "一般付款",
    href: "/general-payment-management", 
    icon: DollarSign,
    category: "management",
    badge: "一般"
  },
  {
    title: "租金管理",
    href: "/rental-management-enhanced",
    icon: Building2,
    category: "management",
    badge: "租金"
  },
  {
    title: "借貸投資",
    href: "/loan-investment-management",
    icon: Wallet,
    category: "management",
    badge: "借貸"
  },
  
  // 統一查看功能
  {
    title: "財務總覽",
    href: "/financial-overview",
    icon: BarChart3,
    category: "view",
    badge: "NEW"
  },
  {
    title: "專案預算管理",
    href: "/project-budget",
    icon: Target,
    category: "view",
    badge: "NEW"
  },
  {
    title: "專案付款管理",
    href: "/payment-project",
    icon: Clipboard,
    category: "view"
  },
  {
    title: "給付款項時間計劃",
    href: "/payment-schedule",
    icon: Calendar,
    category: "view"
  },
  {
    title: "付款記錄",
    href: "/payment-records",
    icon: Receipt,
    category: "view"
  },

  
  // 分析報表
  {
    title: "付款分析",
    href: "/payment-analysis",
    icon: BarChart3,
    category: "analysis"
  },
  {
    title: "付款報表",
    href: "/payment/reports",
    icon: FileText,
    category: "analysis"
  },
  {
    title: "收入分析",
    href: "/revenue/reports",
    icon: DollarSign,
    category: "analysis"
  },
  
  // 系統管理
  {
    title: "分類管理",
    href: "/categories",
    icon: Layers,
    category: "system"
  },
  
  // 模板管理
  {
    title: "專案專屬項目管理",
    href: "/project-specific-items",
    icon: Building2,
    category: "templates",
    description: "管理「固定分類+專案」的專屬項目"
  },
  {
    title: "統一專案模板管理",
    href: "/unified-project-template-management",
    icon: Clipboard,
    category: "templates"
  },
  {
    title: "專案分類模板管理",
    href: "/project-template-management",
    icon: LinkIcon,
    category: "templates"
  },
  {
    title: "固定分類管理",
    href: "/category-management",
    icon: FolderOpen,
    category: "templates"
  },
  
  // 系統管理
  {
    title: "用戶管理",
    href: "/user-management",
    icon: User,
    category: "system"
  },
  {
    title: "回收站",
    href: "/recycle-bin",
    icon: Trash2,
    category: "system",
    description: "查看和恢復已刪除的項目"
  },
  
  // 新功能展示
  {
    title: "功能展示",
    href: "/features",
    icon: TrendingUp,
    category: "showcase",
    badge: "NEW"
  },
  
  // 其他功能
  {
    title: "統一付款",
    href: "/unified-payment",
    icon: CreditCard,
    category: "other"
  },
  {
    title: "設定",
    href: "/settings",
    icon: Settings,
    category: "other"
  }
];

const mainItems = navigationItems.filter(item => item.category === "main");
const managementItems = navigationItems.filter(item => item.category === "management");
const viewItems = navigationItems.filter(item => item.category === "view");
const analysisItems = navigationItems.filter(item => item.category === "analysis");
const systemItems = navigationItems.filter(item => item.category === "system");
const templateItems = navigationItems.filter(item => item.category === "templates");
const showcaseItems = navigationItems.filter(item => item.category === "showcase");
const otherItems = navigationItems.filter(item => item.category === "other");

export default function TopNavigation() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    management: false,
    view: false,
    analysis: false,
    system: false,
    templates: false,
    showcase: false,
    other: false
  });
  const { user, logoutMutation } = useAuth();
  
  // 查詢待處理單據數量
  const { data: pendingDocuments = [] } = useQuery({
    queryKey: ['/api/document-inbox'],
    enabled: !!user,
    refetchInterval: 60000, // 每分鐘自動更新
  });
  
  // 計算待處理數量（排除已歸檔的）
  const pendingCount = Array.isArray(pendingDocuments) 
    ? pendingDocuments.filter((doc: { status: string }) => doc.status !== 'archived').length 
    : 0;

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const currentPage = navigationItems.find(item => item.href === location);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16">
          {/* Logo and Title */}
          <div className="flex items-center min-w-0">
            <Link href="/" className="flex items-center space-x-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-base sm:text-xl font-bold text-gray-900 truncate">付款管理系統</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {/* 核心功能 */}
            {mainItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              const showPendingBadge = item.href === '/document-inbox' && pendingCount > 0;
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg transition-all duration-200 relative ${
                      isActive 
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm" 
                        : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <div className="relative">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {showPendingBadge && (
                        <span className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
                          {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                      )}
                    </div>
                    <span className="hidden lg:inline text-sm font-medium">{item.title}</span>
                  </Button>
                </Link>
              );
            })}
            
            {/* User Menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-medium">
                        {user.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:inline text-sm font-medium truncate max-w-24">
                      {user.username}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.username}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        付款管理系統
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <Link href="/account">
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      <span>帳號設定</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>登出</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* 完整選單下拉 */}
            <Sheet>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg transition-all duration-200 text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                >
                  <Menu className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden lg:inline text-sm font-medium">完整選單</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[340px] sm:w-[380px] overflow-x-hidden overflow-y-auto">
                <SheetTitle>完整選單</SheetTitle>
                <SheetDescription>
                  系統功能導航選單
                </SheetDescription>
                <div className="py-4 space-y-4 max-h-[calc(100vh-8rem)] overflow-x-hidden overflow-y-auto">
                  
                  {/* 核心功能 - 永遠顯示 */}
                  <div className="space-y-2">
                    {mainItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.href;
                      const showPendingBadge = item.href === '/document-inbox' && pendingCount > 0;
                      
                      return (
                        <Link key={item.href} href={item.href}>
                          <Button
                            variant={isActive ? "default" : "ghost"}
                            className={`w-full justify-start space-x-2 ${
                              isActive ? "bg-blue-600 text-white" : ""
                            }`}
                          >
                            <div className="relative">
                              <Icon className="w-4 h-4" />
                              {showPendingBadge && (
                                <span className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
                                  {pendingCount > 9 ? '9+' : pendingCount}
                                </span>
                              )}
                            </div>
                            <span>{item.title}</span>
                            {showPendingBadge && (
                              <Badge variant="destructive" className="ml-auto text-xs">
                                {pendingCount}筆待處理
                              </Badge>
                            )}
                          </Button>
                        </Link>
                      );
                    })}
                  </div>

                  {/* 付款方式管理 - 可收納 */}
                  <Collapsible open={expandedCategories.management} onOpenChange={() => toggleCategory('management')}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-blue-900 font-semibold nav-item-no-hover"
                      >
                        <span>付款方式管理</span>
                        {expandedCategories.management ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {managementItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;
                        
                        return (
                          <Link key={item.href} href={item.href}>
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              className={`w-full justify-start space-x-2 ml-4 ${
                                isActive ? "bg-blue-600 text-white" : ""
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.title}</span>
                              {item.badge && (
                                <Badge variant="secondary" className="ml-auto text-xs">
                                  {item.badge}
                                </Badge>
                              )}
                            </Button>
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* 統一查看功能 - 可收納 */}
                  <Collapsible open={expandedCategories.view} onOpenChange={() => toggleCategory('view')}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-green-900 font-semibold nav-item-no-hover"
                      >
                        <span>統一查看</span>
                        {expandedCategories.view ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {viewItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;
                        
                        return (
                          <Link key={item.href} href={item.href}>
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              className={`w-full justify-start space-x-2 ml-4 ${
                                isActive ? "bg-blue-600 text-white" : ""
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </Button>
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* 分析報表 - 可收納 */}
                  <Collapsible open={expandedCategories.analysis} onOpenChange={() => toggleCategory('analysis')}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-purple-900 font-semibold nav-item-no-hover"
                      >
                        <span>分析報表</span>
                        {expandedCategories.analysis ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {analysisItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;
                        
                        return (
                          <Link key={item.href} href={item.href}>
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              className={`w-full justify-start space-x-2 ml-4 ${
                                isActive ? "bg-blue-600 text-white" : ""
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </Button>
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* 系統管理 - 可收納 */}
                  <Collapsible open={expandedCategories.system} onOpenChange={() => toggleCategory('system')}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-orange-900 font-semibold nav-item-no-hover"
                      >
                        <span>系統管理</span>
                        {expandedCategories.system ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {systemItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;
                        
                        return (
                          <Link key={item.href} href={item.href}>
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              className={`w-full justify-start space-x-2 ml-4 ${
                                isActive ? "bg-blue-600 text-white" : ""
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </Button>
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* 模板管理 - 可收納 */}
                  <Collapsible open={expandedCategories.templates} onOpenChange={() => toggleCategory('templates')}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-indigo-900 font-semibold nav-item-no-hover"
                      >
                        <span>模板管理</span>
                        {expandedCategories.templates ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {templateItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;
                        
                        return (
                          <div key={item.href}>
                            <Link href={item.href}>
                              <Button
                                variant={isActive ? "default" : "ghost"}
                                className={`w-full justify-start space-x-2 ml-4 ${
                                  isActive ? "bg-blue-600 text-white" : ""
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                                <span>{item.title}</span>
                              </Button>
                            </Link>
                            {item.description && (
                              <p className="text-xs text-gray-500 mt-1 ml-6">
                                {item.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* 功能展示 - 特殊顯示 */}
                  <div className="space-y-2">
                    <div className="px-2 py-1">
                      <span className="text-orange-900 font-semibold text-sm">🚀 新功能展示</span>
                    </div>
                    {showcaseItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.href;
                      
                      return (
                        <Link key={item.href} href={item.href}>
                          <Button
                            variant={isActive ? "default" : "ghost"}
                            className={`w-full justify-start space-x-2 ${
                              isActive ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" : "bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 text-orange-700"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.title}</span>
                            {item.badge && (
                              <Badge variant="secondary" className="ml-auto text-xs bg-orange-500 text-white">
                                {item.badge}
                              </Badge>
                            )}
                          </Button>
                        </Link>
                      );
                    })}
                  </div>

                  {/* 其他功能 - 可收納 */}
                  <Collapsible open={expandedCategories.other} onOpenChange={() => toggleCategory('other')}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-gray-900 font-semibold nav-item-no-hover"
                      >
                        <span>其他功能</span>
                        {expandedCategories.other ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {otherItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;
                        
                        return (
                          <Link key={item.href} href={item.href}>
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              className={`w-full justify-start space-x-2 ml-4 ${
                                isActive ? "bg-blue-600 text-white" : ""
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </Button>
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                  
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="p-2 rounded-lg transition-all duration-200 hover:bg-gray-100"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] sm:w-[360px] overflow-x-hidden overflow-y-auto">
                <SheetTitle className="text-lg font-bold">付款管理系統</SheetTitle>
                <SheetDescription className="text-sm text-gray-600 mb-4">
                  手機版導航選單
                </SheetDescription>
                <div className="py-2 space-y-3 max-h-[calc(100vh-8rem)] overflow-x-hidden overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                  
                  {/* 核心功能 - 永遠顯示 */}
                  <div className="space-y-1">
                    {mainItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.href;
                      
                      return (
                        <Link key={item.href} href={item.href}>
                          <Button
                            variant={isActive ? "default" : "ghost"}
                            className={`w-full justify-start space-x-3 ${
                              isActive ? "bg-blue-600 text-white" : ""
                            }`}
                            onClick={() => setIsOpen(false)}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.title}</span>
                          </Button>
                        </Link>
                      );
                    })}
                  </div>

                  {/* 付款方式管理 - 可收納 */}
                  <Collapsible open={expandedCategories.management} onOpenChange={() => toggleCategory('management')}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-blue-900 font-medium hover:bg-blue-50 text-sm"
                      >
                        <span>付款方式管理</span>
                        {expandedCategories.management ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 mt-1">
                      {managementItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;
                        
                        return (
                          <Link key={item.href} href={item.href}>
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              className={`w-full justify-start space-x-3 ml-3 text-sm ${
                                isActive ? "bg-blue-600 text-white" : ""
                              }`}
                              onClick={() => setIsOpen(false)}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.title}</span>
                              {item.badge && (
                                <Badge variant="secondary" className="ml-auto text-xs">
                                  {item.badge}
                                </Badge>
                              )}
                            </Button>
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* 統一查看 - 可收納 */}
                  <Collapsible open={expandedCategories.view} onOpenChange={() => toggleCategory('view')}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-green-900 font-medium hover:bg-green-50 text-sm"
                      >
                        <span>統一查看</span>
                        {expandedCategories.view ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 mt-1">
                      {viewItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;
                        
                        return (
                          <Link key={item.href} href={item.href}>
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              className={`w-full justify-start space-x-3 ml-3 text-sm ${
                                isActive ? "bg-blue-600 text-white" : ""
                              }`}
                              onClick={() => setIsOpen(false)}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </Button>
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* 分析報表 - 可收納 */}
                  <Collapsible open={expandedCategories.analysis} onOpenChange={() => toggleCategory('analysis')}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-purple-900 font-medium hover:bg-purple-50 text-sm"
                      >
                        <span>分析報表</span>
                        {expandedCategories.analysis ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 mt-1">
                      {analysisItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;
                        
                        return (
                          <Link key={item.href} href={item.href}>
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              className={`w-full justify-start space-x-3 ml-3 text-sm ${
                                isActive ? "bg-blue-600 text-white" : ""
                              }`}
                              onClick={() => setIsOpen(false)}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </Button>
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* 系統管理 - 可收納 */}
                  <Collapsible open={expandedCategories.system} onOpenChange={() => toggleCategory('system')}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-orange-900 font-medium hover:bg-orange-50 text-sm"
                      >
                        <span>系統管理</span>
                        {expandedCategories.system ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 mt-1">
                      {systemItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;
                        
                        return (
                          <Link key={item.href} href={item.href}>
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              className={`w-full justify-start space-x-3 ml-3 text-sm ${
                                isActive ? "bg-blue-600 text-white" : ""
                              }`}
                              onClick={() => setIsOpen(false)}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </Button>
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* 模板管理 - 可收納 */}
                  <Collapsible open={expandedCategories.templates} onOpenChange={() => toggleCategory('templates')}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-indigo-900 font-medium hover:bg-indigo-50 text-sm"
                      >
                        <span>模板管理</span>
                        {expandedCategories.templates ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 mt-1">
                      {templateItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;
                        
                        return (
                          <div key={item.href}>
                            <Link href={item.href}>
                              <Button
                                variant={isActive ? "default" : "ghost"}
                                className={`w-full justify-start space-x-3 ml-3 text-sm ${
                                  isActive ? "bg-blue-600 text-white" : ""
                                }`}
                                onClick={() => setIsOpen(false)}
                              >
                                <Icon className="w-4 h-4" />
                                <span>{item.title}</span>
                              </Button>
                            </Link>
                            {item.description && (
                              <p className="text-xs text-gray-500 mt-1 ml-7">
                                {item.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* 功能展示 - 特殊顯示 */}
                  <div className="space-y-1">
                    <div className="px-2 py-1">
                      <span className="text-orange-900 font-semibold text-sm">🚀 新功能展示</span>
                    </div>
                    {showcaseItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.href;
                      
                      return (
                        <Link key={item.href} href={item.href}>
                          <Button
                            variant={isActive ? "default" : "ghost"}
                            className={`w-full justify-start space-x-3 text-sm ${
                              isActive ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" : "bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 text-orange-700"
                            }`}
                            onClick={() => setIsOpen(false)}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.title}</span>
                            {item.badge && (
                              <Badge variant="secondary" className="ml-auto text-xs bg-orange-500 text-white">
                                {item.badge}
                              </Badge>
                            )}
                          </Button>
                        </Link>
                      );
                    })}
                  </div>

                  {/* 其他功能 - 可收納 */}
                  <Collapsible open={expandedCategories.other} onOpenChange={() => toggleCategory('other')}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-gray-900 font-medium hover:bg-gray-50 text-sm"
                      >
                        <span>其他功能</span>
                        {expandedCategories.other ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 mt-1">
                      {otherItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;
                        
                        return (
                          <Link key={item.href} href={item.href}>
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              className={`w-full justify-start space-x-3 ml-3 text-sm ${
                                isActive ? "bg-blue-600 text-white" : ""
                              }`}
                              onClick={() => setIsOpen(false)}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </Button>
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                  
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Current Page Indicator */}
        {currentPage && (
          <div className="py-2 border-t border-gray-100">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Home className="w-3 h-3" />
              <span>/</span>
              <span className="text-blue-600 font-medium">{currentPage.title}</span>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}