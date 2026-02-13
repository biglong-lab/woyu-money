import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";

// 增強型響應式按鈕組
interface ResponsiveButtonGroupProps {
  buttons: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "ghost" | "destructive";
    icon?: ReactNode;
    badge?: string;
    disabled?: boolean;
  }[];
  orientation?: "horizontal" | "vertical" | "auto";
  className?: string;
}

export function ResponsiveButtonGroup({ 
  buttons, 
  orientation = "auto", 
  className 
}: ResponsiveButtonGroupProps) {
  const orientationClasses = {
    horizontal: "flex flex-row flex-wrap",
    vertical: "flex flex-col",
    auto: "flex flex-col sm:flex-row flex-wrap"
  };

  return (
    <div className={cn(
      orientationClasses[orientation],
      "gap-2 sm:gap-3",
      className
    )}>
      {buttons.map((button, index) => (
        <Button
          key={index}
          variant={button.variant || "outline"}
          onClick={button.onClick}
          disabled={button.disabled}
          className={cn(
            "relative min-h-[2.5rem] px-3 sm:px-4",
            "text-xs sm:text-sm",
            "transition-all duration-200",
            "hover:scale-[1.02] active:scale-[0.98]"
          )}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            {button.icon && (
              <span className="flex-shrink-0">
                {button.icon}
              </span>
            )}
            <span className="truncate">{button.label}</span>
            {button.badge && (
              <Badge 
                variant="secondary" 
                className="ml-1 text-xs px-1.5 py-0.5"
              >
                {button.badge}
              </Badge>
            )}
          </div>
        </Button>
      ))}
    </div>
  );
}

// 增強型摺疊卡片
interface CollapsibleCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  badge?: string;
  className?: string;
}

export function CollapsibleCard({
  title,
  description,
  children,
  defaultOpen = true,
  icon,
  badge,
  className
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={cn(
      "transition-all duration-300",
      "hover:shadow-md",
      className
    )}>
      <CardHeader 
        className="cursor-pointer select-none pb-3"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {icon && (
              <span className="flex-shrink-0 text-muted-foreground">
                {icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm sm:text-base font-medium truncate">
                {title}
              </CardTitle>
              {description && (
                <CardDescription className="text-xs sm:text-sm mt-1 line-clamp-2">
                  {description}
                </CardDescription>
              )}
            </div>
            {badge && (
              <Badge 
                variant="outline" 
                className="flex-shrink-0 text-xs px-2 py-1"
              >
                {badge}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0 h-8 w-8 p-0"
          >
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      <div className={cn(
        "overflow-hidden transition-all duration-300",
        isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <CardContent className="pt-0">
          {children}
        </CardContent>
      </div>
    </Card>
  );
}

// 響應式資料表格
interface ResponsiveDataTableProps {
  data: Array<Record<string, unknown>>;
  columns: {
    key: string;
    label: string;
    width?: string;
    render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
    hideOnMobile?: boolean;
  }[];
  onRowClick?: (row: Record<string, unknown>) => void;
  className?: string;
}

export function ResponsiveDataTable({
  data,
  columns,
  onRowClick,
  className
}: ResponsiveDataTableProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* 桌面版表格 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "text-left py-3 px-4 font-medium text-gray-900",
                    column.width
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={index}
                className={cn(
                  "border-b border-gray-100 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-gray-50"
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="py-3 px-4 text-sm text-gray-900"
                  >
                    {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 手機版卡片列表 */}
      <div className="md:hidden space-y-3">
        {data.map((row, index) => (
          <Card
            key={index}
            className={cn(
              "transition-all duration-200",
              onRowClick && "cursor-pointer hover:shadow-md hover:scale-[1.01]"
            )}
            onClick={() => onRowClick?.(row)}
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                {columns
                  .filter(column => !column.hideOnMobile)
                  .map((column) => (
                    <div key={column.key} className="flex justify-between items-start">
                      <span className="text-sm font-medium text-gray-600 flex-shrink-0 mr-3">
                        {column.label}:
                      </span>
                      <span className="text-sm text-gray-900 text-right flex-1 min-w-0">
                        {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '')}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// 增強型狀態指示器
interface StatusIndicatorProps {
  status: "success" | "warning" | "error" | "info" | "pending";
  label: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

export function StatusIndicator({
  status,
  label,
  description,
  size = "md",
  showIcon = true,
  className
}: StatusIndicatorProps) {
  const statusConfig = {
    success: {
      color: "bg-green-100 text-green-800 border-green-200",
      iconColor: "text-green-600"
    },
    warning: {
      color: "bg-yellow-100 text-yellow-800 border-yellow-200", 
      iconColor: "text-yellow-600"
    },
    error: {
      color: "bg-red-100 text-red-800 border-red-200",
      iconColor: "text-red-600"
    },
    info: {
      color: "bg-blue-100 text-blue-800 border-blue-200",
      iconColor: "text-blue-600"
    },
    pending: {
      color: "bg-gray-100 text-gray-800 border-gray-200",
      iconColor: "text-gray-600"
    }
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base"
  };

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 rounded-full border",
      statusConfig[status].color,
      sizeClasses[size],
      className
    )}>
      {showIcon && (
        <div className={cn(
          "w-2 h-2 rounded-full animate-pulse",
          statusConfig[status].iconColor.replace('text-', 'bg-')
        )} />
      )}
      <span className="font-medium">{label}</span>
      {description && (
        <span className="opacity-75">• {description}</span>
      )}
    </div>
  );
}

// 響應式篩選面板
interface ResponsiveFilterPanelProps {
  children: ReactNode;
  title?: string;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
}

export function ResponsiveFilterPanel({
  children,
  title = "篩選選項",
  isOpen = false,
  onToggle,
  className
}: ResponsiveFilterPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = onToggle ? isOpen : internalOpen;
  const setOpen = onToggle || setInternalOpen;

  return (
    <div className={cn("w-full", className)}>
      {/* 手機版摺疊觸發器 */}
      <div className="md:hidden mb-4">
        <Button
          variant="outline"
          onClick={() => setOpen(!open)}
          className="w-full justify-between"
        >
          <span>{title}</span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* 桌面版固定顯示，手機版摺疊 */}
      <div className={cn(
        "md:block",
        open ? "block" : "hidden"
      )}>
        <Card className="transition-all duration-300">
          <CardHeader className="hidden md:block pb-3">
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
          <CardContent className="md:pt-0">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 資料載入骨架
interface SkeletonLoaderProps {
  type: "card" | "table" | "list" | "stats";
  count?: number;
  className?: string;
}

export function SkeletonLoader({ 
  type, 
  count = 3, 
  className 
}: SkeletonLoaderProps) {
  const skeletonCard = (
    <Card className="animate-pulse">
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="h-8 bg-gray-200 rounded w-full"></div>
        </div>
      </CardContent>
    </Card>
  );

  const skeletonTable = (
    <div className="animate-pulse space-y-3">
      <div className="h-10 bg-gray-200 rounded"></div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 rounded"></div>
      ))}
    </div>
  );

  const skeletonList = (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
          <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );

  const skeletonStats = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const skeletons = {
    card: skeletonCard,
    table: skeletonTable,
    list: skeletonList,
    stats: skeletonStats
  };

  return (
    <div className={className}>
      {type === "card" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i}>{skeletons.card}</div>
          ))}
        </div>
      ) : (
        skeletons[type]
      )}
    </div>
  );
}
