import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResponsiveLayoutProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "7xl" | "full";
  padding?: "none" | "sm" | "md" | "lg";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md", 
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "7xl": "max-w-7xl",
  full: "max-w-full"
};

const paddingClasses = {
  none: "",
  sm: "px-2 sm:px-4",
  md: "px-4 sm:px-6 lg:px-8", 
  lg: "px-6 sm:px-8 lg:px-12"
};

export function ResponsiveLayout({ 
  children, 
  className, 
  maxWidth = "7xl", 
  padding = "md" 
}: ResponsiveLayoutProps) {
  return (
    <div className={cn(
      "mx-auto w-full",
      maxWidthClasses[maxWidth],
      paddingClasses[padding],
      className
    )}>
      {children}
    </div>
  );
}

interface ResponsiveGridProps {
  children: ReactNode;
  cols?: {
    default: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const gapClasses = {
  sm: "gap-2",
  md: "gap-4", 
  lg: "gap-6",
  xl: "gap-8"
};

export function ResponsiveGrid({ 
  children, 
  cols = { default: 1, sm: 2, md: 3, lg: 4 }, 
  gap = "md",
  className 
}: ResponsiveGridProps) {
  const gridClasses = [
    `grid-cols-${cols.default}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`
  ].filter(Boolean).join(" ");

  return (
    <div className={cn(
      "grid",
      gridClasses,
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  );
}

interface ResponsiveCardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  shadow?: "sm" | "md" | "lg" | "xl";
  hover?: boolean;
}

const cardPaddingClasses = {
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-6", 
  lg: "p-6 sm:p-8"
};

const cardShadowClasses = {
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg", 
  xl: "shadow-xl"
};

export function ResponsiveCard({ 
  children, 
  className, 
  padding = "md",
  shadow = "md",
  hover = false 
}: ResponsiveCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-lg border border-gray-200",
      cardPaddingClasses[padding],
      cardShadowClasses[shadow],
      hover && "transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
      className
    )}>
      {children}
    </div>
  );
}

interface ResponsiveStackProps {
  children: ReactNode;
  direction?: "horizontal" | "vertical" | "responsive";
  spacing?: "sm" | "md" | "lg" | "xl";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
  className?: string;
}

const spacingClasses = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6", 
  xl: "gap-8"
};

const alignClasses = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch"
};

const justifyClasses = {
  start: "justify-start",
  center: "justify-center", 
  end: "justify-end",
  between: "justify-between",
  around: "justify-around"
};

export function ResponsiveStack({ 
  children, 
  direction = "responsive",
  spacing = "md",
  align = "start",
  justify = "start",
  className 
}: ResponsiveStackProps) {
  const directionClasses = {
    horizontal: "flex-row",
    vertical: "flex-col",
    responsive: "flex-col sm:flex-row"
  };

  return (
    <div className={cn(
      "flex",
      directionClasses[direction],
      spacingClasses[spacing],
      alignClasses[align],
      justifyClasses[justify],
      className
    )}>
      {children}
    </div>
  );
}

// 響應式文字大小組件
interface ResponsiveTextProps {
  children: ReactNode;
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
  weight?: "normal" | "medium" | "semibold" | "bold";
  className?: string;
}

const textSizeClasses = {
  xs: "text-xs sm:text-sm",
  sm: "text-sm sm:text-base", 
  base: "text-base sm:text-lg",
  lg: "text-lg sm:text-xl",
  xl: "text-xl sm:text-2xl",
  "2xl": "text-2xl sm:text-3xl",
  "3xl": "text-3xl sm:text-4xl"
};

const textWeightClasses = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold", 
  bold: "font-bold"
};

export function ResponsiveText({ 
  children, 
  size = "base",
  weight = "normal",
  className 
}: ResponsiveTextProps) {
  return (
    <span className={cn(
      textSizeClasses[size],
      textWeightClasses[weight],
      className
    )}>
      {children}
    </span>
  );
}