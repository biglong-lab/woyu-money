/**
 * EmptyState — 統一的空狀態組件
 *
 * 設計原則：
 * - 友善文案（不只是「無資料」而是說明為什麼空 + 引導下一步）
 * - 大號圖標、適當留白
 * - 可選的行動按鈕（CTA）
 * - 手機與桌面通用排版（垂直置中）
 *
 * 使用範例：
 * <EmptyState
 *   icon={Inbox}
 *   title="尚無單據"
 *   description="點上方「+」拍照上傳第一張收據"
 *   action={{ label: "上傳單據", onClick: () => navigate("/document-inbox") }}
 * />
 */
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: "default" | "outline"
  }
  /** 是否為小型內嵌版本（卡片內用）*/
  compact?: boolean
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-12 px-4 sm:py-16",
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            "rounded-full bg-gray-100 flex items-center justify-center mb-4",
            compact ? "w-12 h-12" : "w-16 h-16 sm:w-20 sm:h-20"
          )}
        >
          <Icon className={cn("text-gray-400", compact ? "w-6 h-6" : "w-8 h-8 sm:w-10 sm:h-10")} />
        </div>
      )}
      <h3
        className={cn("font-semibold text-gray-800", compact ? "text-base" : "text-lg sm:text-xl")}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-gray-500 mt-1 max-w-md",
            compact ? "text-sm" : "text-sm sm:text-base"
          )}
        >
          {description}
        </p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          variant={action.variant ?? "default"}
          className="mt-4"
          size={compact ? "sm" : "default"}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

/**
 * LoadingState — 統一的載入中狀態
 */
export function LoadingState({
  message = "載入中...",
  compact = false,
}: {
  message?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "py-12 sm:py-16"
      )}
    >
      <div
        className={cn(
          "border-gray-200 border-t-blue-600 rounded-full animate-spin mb-3",
          compact ? "w-6 h-6 border-2" : "w-10 h-10 border-3"
        )}
      />
      <p className={cn("text-gray-500", compact ? "text-xs" : "text-sm")}>{message}</p>
    </div>
  )
}
