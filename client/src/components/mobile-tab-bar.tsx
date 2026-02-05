/**
 * MobileTabBar - 手機版底部導航欄
 * 固定在底部的 5 個主要功能入口
 * 付款、查看、更多 三個 Tab 會展開子選單
 */
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  managementNavItems,
  viewNavItems,
  systemNavItems,
} from "@/config/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  Home,
  Inbox,
  CreditCard,
  BarChart3,
  Settings,
  X,
} from "lucide-react";

interface TabItemProps {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  badge?: number;
  onClick?: () => void;
}

function TabItem({ title, href, icon: Icon, isActive, badge, onClick }: TabItemProps) {
  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[64px] touch-target",
        "transition-colors duration-200",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
    >
      <div className="relative">
        <Icon
          className={cn(
            "h-5 w-5 transition-transform",
            isActive && "scale-110"
          )}
        />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-medium px-1">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span
        className={cn(
          "text-[10px] font-medium leading-tight",
          isActive && "font-semibold"
        )}
      >
        {title}
      </span>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// 展開選單的子項目
interface SubMenuItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface PopupMenuProps {
  items: SubMenuItem[];
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

function PopupMenu({ items, isOpen, onClose, title }: PopupMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm md:hidden">
      <div
        ref={menuRef}
        className="absolute bottom-16 left-2 right-2 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden pb-safe animate-in slide-in-from-bottom-4 duration-200"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 p-3 max-h-[50vh] overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={onClose}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-[11px] text-gray-700 font-medium text-center leading-tight">
                    {item.title}
                  </span>
                  {item.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function MobileTabBar() {
  const [location] = useLocation();
  const [openMenu, setOpenMenu] = useState<"payment" | "view" | "more" | null>(null);

  // 獲取單據收件箱未處理數量
  const { data: inboxStats } = useQuery<{ pending?: number }>({
    queryKey: ["/api/document-inbox/stats"],
    enabled: true,
    staleTime: 30000,
  });

  // 判斷當前路徑是否在某個分類下
  const isInPaymentSection = managementNavItems.some(
    (item) => location === item.href || location.startsWith(item.href)
  );
  const isInViewSection = viewNavItems.some(
    (item) => location === item.href || location.startsWith(item.href)
  );
  const isInSystemSection = systemNavItems.some(
    (item) => location === item.href || location.startsWith(item.href)
  );

  const getBadge = (section: string): number | undefined => {
    if (section === "document-inbox" && inboxStats?.pending) {
      return inboxStats.pending;
    }
    return undefined;
  };

  const toggleMenu = (menu: "payment" | "view" | "more") => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  return (
    <>
      {/* 展開選單 */}
      <PopupMenu
        title="付款方式管理"
        items={managementNavItems}
        isOpen={openMenu === "payment"}
        onClose={() => setOpenMenu(null)}
      />
      <PopupMenu
        title="統一查看"
        items={viewNavItems}
        isOpen={openMenu === "view"}
        onClose={() => setOpenMenu(null)}
      />
      <PopupMenu
        title="系統管理"
        items={systemNavItems}
        isOpen={openMenu === "more"}
        onClose={() => setOpenMenu(null)}
      />

      {/* 底部 Tab Bar */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          "bg-white/95 backdrop-blur-sm border-t border-gray-200",
          "shadow-lg",
          "md:hidden",
          "pb-safe"
        )}
      >
        <div className="flex items-center justify-around">
          <TabItem
            title="首頁"
            href="/"
            icon={Home}
            isActive={location === "/"}
          />
          <TabItem
            title="單據"
            href="/document-inbox"
            icon={Inbox}
            isActive={location === "/document-inbox"}
            badge={getBadge("document-inbox")}
          />
          <TabItem
            title="付款"
            icon={CreditCard}
            isActive={isInPaymentSection || openMenu === "payment"}
            onClick={() => toggleMenu("payment")}
          />
          <TabItem
            title="查看"
            icon={BarChart3}
            isActive={isInViewSection || openMenu === "view"}
            onClick={() => toggleMenu("view")}
          />
          <TabItem
            title="更多"
            icon={Settings}
            isActive={isInSystemSection || openMenu === "more"}
            onClick={() => toggleMenu("more")}
          />
        </div>
      </nav>
    </>
  );
}

export default MobileTabBar;
