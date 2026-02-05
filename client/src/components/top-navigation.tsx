/**
 * TopNavigation - 頂部導航組件
 * 重構版本：使用配置化導航項目，減少重複程式碼
 */
import { Link, useLocation } from "wouter";
import {
  Home,
  DollarSign,
  Menu,
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  mainNavItems,
  managementNavItems,
  viewNavItems,
  systemNavItems,
  NavItem,
} from "@/config/navigation";

// 分類配置：標題、樣式、項目
interface CategoryConfig {
  id: string;
  title: string;
  titleClass: string;
  hoverClass: string;
  items: NavItem[];
}

const categoryConfigs: CategoryConfig[] = [
  {
    id: "management",
    title: "付款方式管理",
    titleClass: "text-blue-900",
    hoverClass: "hover:bg-blue-50",
    items: managementNavItems,
  },
  {
    id: "view",
    title: "統一查看",
    titleClass: "text-green-900",
    hoverClass: "hover:bg-green-50",
    items: viewNavItems,
  },
  {
    id: "system",
    title: "系統管理",
    titleClass: "text-orange-900",
    hoverClass: "hover:bg-orange-50",
    items: systemNavItems,
  },
];

// 導航項目渲染組件
interface NavItemButtonProps {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
  showBadge?: boolean;
  badgeCount?: number;
  indent?: boolean;
  size?: "default" | "sm";
}

function NavItemButton({
  item,
  isActive,
  onClick,
  showBadge,
  badgeCount,
  indent = false,
  size = "default",
}: NavItemButtonProps) {
  const Icon = item.icon;

  return (
    <Link href={item.href}>
      <Button
        variant={isActive ? "default" : "ghost"}
        className={`w-full justify-start space-x-2 ${indent ? "ml-3" : ""} ${
          size === "sm" ? "text-sm" : ""
        } ${isActive ? "bg-blue-600 text-white" : ""}`}
        onClick={onClick}
      >
        <div className="relative">
          <Icon className="w-4 h-4" />
          {showBadge && badgeCount !== undefined && badgeCount > 0 && (
            <span className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </div>
        <span>{item.title}</span>
        {item.badge && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {item.badge}
          </Badge>
        )}
      </Button>
    </Link>
  );
}

// 可收納的分類組件
interface CollapsibleCategoryProps {
  config: CategoryConfig;
  isExpanded: boolean;
  onToggle: () => void;
  currentPath: string;
  onItemClick?: () => void;
}

function CollapsibleCategory({
  config,
  isExpanded,
  onToggle,
  currentPath,
  onItemClick,
}: CollapsibleCategoryProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={`w-full justify-between ${config.titleClass} font-medium ${config.hoverClass} text-sm`}
        >
          <span>{config.title}</span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 mt-1">
        {config.items.map((item) => (
          <div key={item.href}>
            <NavItemButton
              item={item}
              isActive={currentPath === item.href}
              onClick={onItemClick}
              indent
              size="sm"
            />
            {item.description && (
              <p className="text-xs text-gray-500 mt-1 ml-7">
                {item.description}
              </p>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function TopNavigation() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});
  const { user, logoutMutation } = useAuth();

  // 查詢待處理單據數量
  const { data: pendingDocuments = [] } = useQuery({
    queryKey: ["/api/document-inbox"],
    enabled: !!user,
    refetchInterval: 60000,
  });

  // 計算待處理數量
  const pendingCount = Array.isArray(pendingDocuments)
    ? pendingDocuments.filter(
        (doc: { status: string }) => doc.status !== "archived"
      ).length
    : 0;

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const closeSheet = () => setIsOpen(false);

  // 獲取當前頁面標題
  const currentPage =
    mainNavItems.find((item) => item.href === location) ||
    categoryConfigs
      .flatMap((c) => c.items)
      .find((item) => item.href === location);

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
              <span className="text-base sm:text-xl font-bold text-gray-900 truncate">
                付款管理系統
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {/* 核心功能按鈕 */}
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              const showPendingBadge =
                item.href === "/document-inbox" && pendingCount > 0;

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
                          {pendingCount > 9 ? "9+" : pendingCount}
                        </span>
                      )}
                    </div>
                    <span className="hidden lg:inline text-sm font-medium">
                      {item.title}
                    </span>
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
                        {user.username?.charAt(0).toUpperCase() || "U"}
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
                      <p className="text-sm font-medium leading-none">
                        {user.username}
                      </p>
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

            {/* 完整選單按鈕 */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg transition-all duration-200 text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                >
                  <Menu className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden lg:inline text-sm font-medium">
                    完整選單
                  </span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[340px] sm:w-[380px] overflow-y-auto"
              >
                <SheetTitle>完整選單</SheetTitle>
                <SheetDescription>系統功能導航選單</SheetDescription>
                <div className="py-4 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
                  {/* 核心功能 */}
                  <div className="space-y-2">
                    {mainNavItems.map((item) => (
                      <NavItemButton
                        key={item.href}
                        item={item}
                        isActive={location === item.href}
                        showBadge={item.href === "/document-inbox"}
                        badgeCount={pendingCount}
                      />
                    ))}
                  </div>

                  {/* 各分類 */}
                  {categoryConfigs.map((config) => (
                    <CollapsibleCategory
                      key={config.id}
                      config={config}
                      isExpanded={expandedCategories[config.id] || false}
                      onToggle={() => toggleCategory(config.id)}
                      currentPath={location}
                    />
                  ))}
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
              <SheetContent
                side="right"
                className="w-[320px] sm:w-[360px] overflow-y-auto"
              >
                <SheetTitle className="text-lg font-bold">
                  付款管理系統
                </SheetTitle>
                <SheetDescription className="text-sm text-gray-600 mb-4">
                  手機版導航選單
                </SheetDescription>
                <div className="py-2 space-y-3 max-h-[calc(100vh-8rem)] overflow-y-auto">
                  {/* 核心功能 */}
                  <div className="space-y-1">
                    {mainNavItems.map((item) => (
                      <NavItemButton
                        key={item.href}
                        item={item}
                        isActive={location === item.href}
                        onClick={closeSheet}
                        showBadge={item.href === "/document-inbox"}
                        badgeCount={pendingCount}
                      />
                    ))}
                  </div>

                  {/* 各分類 */}
                  {categoryConfigs.map((config) => (
                    <CollapsibleCategory
                      key={config.id}
                      config={config}
                      isExpanded={expandedCategories[config.id] || false}
                      onToggle={() => toggleCategory(config.id)}
                      currentPath={location}
                      onItemClick={closeSheet}
                    />
                  ))}
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
              <span className="text-blue-600 font-medium">
                {currentPage.title}
              </span>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
