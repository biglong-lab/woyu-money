/**
 * AppLayout - 主應用佈局
 * 統一管理頁面結構：Header + Navigation + Content + Mobile Tab Bar
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  // 頂部導航組件
  header?: ReactNode;
  // 側邊導航組件（桌面版）
  sidebar?: ReactNode;
  // 底部導航組件（手機版）
  bottomNav?: ReactNode;
  // 主要內容
  children: ReactNode;
  // 是否顯示側邊欄
  showSidebar?: boolean;
  // 額外的 className
  className?: string;
}

export function AppLayout({
  header,
  sidebar,
  bottomNav,
  children,
  showSidebar = false,
  className,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 頂部導航 */}
      {header}

      {/* 主要內容區域 */}
      <div className="flex">
        {/* 側邊欄（桌面版，可選） */}
        {showSidebar && sidebar && (
          <aside className="hidden lg:block lg:w-64 lg:flex-shrink-0">
            {sidebar}
          </aside>
        )}

        {/* 主要內容 */}
        <main
          className={cn(
            "flex-1 w-full",
            // 底部留出空間給手機版 Tab Bar
            "pb-20 md:pb-6",
            className
          )}
        >
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
            {children}
          </div>
        </main>
      </div>

      {/* 底部導航（手機版） */}
      {bottomNav}
    </div>
  );
}

/**
 * MainContent - 主要內容容器
 * 用於包裹頁面主要內容，提供統一的內邊距和最大寬度
 */
interface MainContentProps {
  children: ReactNode;
  className?: string;
  // 是否使用較窄的最大寬度（適用於表單頁面）
  narrow?: boolean;
  // 是否移除內邊距
  noPadding?: boolean;
}

export function MainContent({
  children,
  className,
  narrow = false,
  noPadding = false,
}: MainContentProps) {
  return (
    <div
      className={cn(
        "w-full",
        narrow ? "max-w-4xl" : "max-w-7xl",
        !noPadding && "px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export default AppLayout;
