/**
 * PageContainer - 統一頁面容器
 * 包含麵包屑導航、頁面標題、操作按鈕區域
 */
import { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { BreadcrumbItem as BreadcrumbItemType } from "@/config/navigation";

interface PageContainerProps {
  // 頁面標題
  title: string;
  // 頁面描述（可選）
  description?: string;
  // 麵包屑路徑
  breadcrumbs?: BreadcrumbItemType[];
  // 操作按鈕區域
  actions?: ReactNode;
  // 頁面主要內容
  children: ReactNode;
  // 額外的 className
  className?: string;
  // 是否顯示麵包屑（預設顯示）
  showBreadcrumb?: boolean;
  // 是否顯示標題區塊（預設顯示）
  showHeader?: boolean;
  // 內容區域的最大寬度
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl" | "7xl" | "full";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

export function PageContainer({
  title,
  description,
  breadcrumbs = [],
  actions,
  children,
  className,
  showBreadcrumb = true,
  showHeader = true,
  maxWidth = "full",
}: PageContainerProps) {
  return (
    <div className={cn("w-full", maxWidthClasses[maxWidth], className)}>
      {/* 麵包屑導航 */}
      {showBreadcrumb && breadcrumbs.length > 0 && (
        <nav className="mb-4 sm:mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <BreadcrumbItem key={index}>
                    {isLast ? (
                      <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                    ) : (
                      <>
                        {crumb.href ? (
                          <BreadcrumbLink asChild>
                            <Link href={crumb.href}>{crumb.title}</Link>
                          </BreadcrumbLink>
                        ) : (
                          <span className="text-muted-foreground">
                            {crumb.title}
                          </span>
                        )}
                        <BreadcrumbSeparator />
                      </>
                    )}
                  </BreadcrumbItem>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </nav>
      )}

      {/* 頁面標題和操作按鈕 */}
      {showHeader && (
        <header className="mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl lg:text-3xl truncate">
                {title}
              </h1>
              {description && (
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  {description}
                </p>
              )}
            </div>

            {/* 操作按鈕區域 */}
            {actions && (
              <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-3">
                {actions}
              </div>
            )}
          </div>
        </header>
      )}

      {/* 主要內容區域 */}
      <main>{children}</main>
    </div>
  );
}

/**
 * ContentSection - 內容區塊
 * 用於將頁面內容分組
 */
interface ContentSectionProps {
  // 區塊標題（可選）
  title?: string;
  // 區塊描述（可選）
  description?: string;
  // 區塊操作按鈕（可選）
  actions?: ReactNode;
  // 區塊內容
  children: ReactNode;
  // 額外的 className
  className?: string;
  // 是否使用卡片樣式
  card?: boolean;
  // 內邊距
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-6",
  lg: "p-6 sm:p-8",
};

export function ContentSection({
  title,
  description,
  actions,
  children,
  className,
  card = true,
  padding = "md",
}: ContentSectionProps) {
  const content = (
    <>
      {(title || actions) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && (
              <h2 className="text-lg font-medium text-gray-900 sm:text-xl">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">{actions}</div>
          )}
        </div>
      )}
      {children}
    </>
  );

  if (card) {
    return (
      <section
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          paddingClasses[padding],
          className
        )}
      >
        {content}
      </section>
    );
  }

  return (
    <section className={cn(paddingClasses[padding], className)}>
      {content}
    </section>
  );
}

/**
 * PageGrid - 響應式網格佈局
 * 用於排列卡片或內容區塊
 */
interface PageGridProps {
  children: ReactNode;
  // 欄位數量配置
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  // 間距
  gap?: "sm" | "md" | "lg";
  className?: string;
}

const gapClasses = {
  sm: "gap-3 sm:gap-4",
  md: "gap-4 sm:gap-6",
  lg: "gap-6 sm:gap-8",
};

export function PageGrid({
  children,
  cols = { default: 1, sm: 2, lg: 3 },
  gap = "md",
  className,
}: PageGridProps) {
  const colClasses = [
    cols.default && `grid-cols-${cols.default}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("grid", colClasses, gapClasses[gap], className)}>
      {children}
    </div>
  );
}

/**
 * ActionGroup - 操作按鈕群組
 * 用於統一操作按鈕的排列方式
 */
interface ActionGroupProps {
  children: ReactNode;
  className?: string;
  // 對齊方式
  align?: "start" | "center" | "end";
}

const alignClasses = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
};

export function ActionGroup({
  children,
  className,
  align = "end",
}: ActionGroupProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:gap-3",
        alignClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
}
