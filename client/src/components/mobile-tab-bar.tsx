/**
 * MobileTabBar - 手機版底部導航欄
 * 重新設計為 5 個精簡入口：
 * 首頁 | 項目 | (+記帳) | 單據 | 我的
 * 中間的「記帳」按鈕最大最醒目
 */
import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import {
  managementNavItems,
  viewNavItems,
  systemNavItems,
  decisionNavItems,
} from "@/config/navigation"
import { useQuery } from "@tanstack/react-query"
import { useState, useRef, useEffect } from "react"
import { Home, Inbox, Plus, CreditCard, User, X, BarChart3, Settings } from "lucide-react"
import { QuickAddDrawer, useQuickCameraUpload } from "@/components/quick-add-drawer"
import { QuickPaymentDialog } from "@/components/quick-payment-dialog"

interface TabItemProps {
  title: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  badge?: number
  onClick?: () => void
}

function TabItem({ title, href, icon: Icon, isActive, badge, onClick }: TabItemProps) {
  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-[56px] touch-target",
        "transition-colors duration-200 cursor-pointer select-none",
        "active:scale-95 active:opacity-70",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
    >
      <div className="relative">
        <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-medium px-1">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span className={cn("text-[10px] font-medium leading-tight", isActive && "font-semibold")}>
        {title}
      </span>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

// 展開選單的子項目
interface SubMenuItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

interface PopupMenuProps {
  items: SubMenuItem[]
  isOpen: boolean
  onClose: () => void
  title: string
  color?: "blue" | "green" | "orange"
}

function PopupMenu({ items, isOpen, onClose, title, color = "blue" }: PopupMenuProps) {
  const colorClasses = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", header: "text-blue-900" },
    green: { bg: "bg-green-50", text: "text-green-600", header: "text-green-900" },
    orange: { bg: "bg-orange-50", text: "text-orange-600", header: "text-orange-900" },
  }
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener("touchstart", handleClickOutside as EventListener)
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("touchstart", handleClickOutside as EventListener)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm md:hidden">
      <div
        ref={menuRef}
        className="absolute bottom-20 left-2 right-2 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden pb-safe animate-in slide-in-from-bottom-4 duration-200"
      >
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 border-b border-gray-100",
            colorClasses[color].bg
          )}
        >
          <h3 className={cn("text-sm font-semibold", colorClasses[color].header)}>{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 p-3 max-h-[50vh] overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={onClose}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      colorClasses[color].bg
                    )}
                  >
                    <Icon className={cn("w-5 h-5", colorClasses[color].text)} />
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
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** 中間記帳按鈕的選單 */
interface QuickMenuProps {
  isOpen: boolean
  onClose: () => void
  onQuickAdd: () => void
  onQuickPay: () => void
  onCamera: () => void
  onCashAllocation: () => void
}

function QuickMenu({
  isOpen,
  onClose,
  onQuickAdd,
  onQuickPay,
  onCamera,
  onCashAllocation,
}: QuickMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener("touchstart", handleClickOutside as EventListener)
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("touchstart", handleClickOutside as EventListener)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const quickActions = [
    {
      label: "拍單據",
      icon: "📸",
      color: "bg-purple-50 text-purple-700",
      onClick: () => {
        onClose()
        onCamera()
      },
    },
    {
      label: "手動記帳",
      icon: "📝",
      color: "bg-blue-50 text-blue-700",
      onClick: () => {
        onClose()
        onQuickAdd()
      },
    },
    {
      label: "記錄付款",
      icon: "💰",
      color: "bg-green-50 text-green-700",
      onClick: () => {
        onClose()
        onQuickPay()
      },
    },
    {
      label: "現金分配",
      icon: "🎯",
      color: "bg-amber-50 text-amber-700",
      onClick: () => {
        onClose()
        onCashAllocation()
      },
    },
  ]

  return (
    <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm md:hidden">
      <div
        ref={menuRef}
        className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 animate-in slide-in-from-bottom-4 duration-200"
      >
        <div className="flex gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl min-w-[72px]",
                "active:scale-95 transition-transform",
                action.color
              )}
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="text-xs font-medium whitespace-nowrap">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MobileTabBar() {
  const [location] = useLocation()
  const [openMenu, setOpenMenu] = useState<"payment" | "view" | "more" | "quick" | null>(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showQuickPay, setShowQuickPay] = useState(false)
  const { openCamera } = useQuickCameraUpload()

  // 獲取單據收件箱未處理數量
  const { data: inboxStats } = useQuery<{ pending?: number }>({
    queryKey: ["/api/document-inbox/stats"],
    enabled: true,
    staleTime: 10000,
  })

  // 獲取緊急付款數量（critical 級別）— 顯示在首頁 tab
  const { data: priorityReport } = useQuery<{ counts: { critical: number; high: number } }>({
    queryKey: ["/api/payment/priority-report?includeLow=true"],
    staleTime: 30000,
  })
  const urgentCount = (priorityReport?.counts?.critical ?? 0) + (priorityReport?.counts?.high ?? 0)

  // 判斷當前路徑是否在某個分類下
  const isInPaymentSection = managementNavItems.some(
    (item) => location === item.href || location.startsWith(item.href)
  )
  const isInViewSection = viewNavItems.some(
    (item) => location === item.href || location.startsWith(item.href)
  )
  const isInSystemSection = systemNavItems.some(
    (item) => location === item.href || location.startsWith(item.href)
  )

  const toggleMenu = (menu: "payment" | "view" | "more" | "quick") => {
    // 觸覺回饋（Android Chrome 支援；iOS Safari 會 silently no-op）
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(10)
      } catch {
        // 部分瀏覽器在無使用者手勢時會 throw，忽略即可
      }
    }
    setOpenMenu((prev) => (prev === menu ? null : menu))
  }

  return (
    <>
      {/* 展開選單 */}
      <PopupMenu
        title="付款項目管理"
        items={managementNavItems}
        isOpen={openMenu === "payment"}
        onClose={() => setOpenMenu(null)}
        color="blue"
      />
      <PopupMenu
        title="報表與查看（含財務助理）"
        items={[...decisionNavItems, ...viewNavItems]}
        isOpen={openMenu === "view"}
        onClose={() => setOpenMenu(null)}
        color="green"
      />
      <PopupMenu
        title="系統管理"
        items={systemNavItems}
        isOpen={openMenu === "more"}
        onClose={() => setOpenMenu(null)}
        color="orange"
      />

      {/* 快速記帳選單 */}
      <QuickMenu
        isOpen={openMenu === "quick"}
        onClose={() => setOpenMenu(null)}
        onQuickAdd={() => setShowQuickAdd(true)}
        onQuickPay={() => setShowQuickPay(true)}
        onCamera={openCamera}
        onCashAllocation={() => {
          window.location.href = "/cash-allocation"
        }}
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
          {/* 首頁 */}
          <TabItem
            title="首頁"
            href="/"
            icon={Home}
            isActive={location === "/"}
            badge={urgentCount}
          />

          {/* 項目管理 */}
          <TabItem
            title="項目"
            icon={CreditCard}
            isActive={isInPaymentSection || openMenu === "payment"}
            onClick={() => toggleMenu("payment")}
          />

          {/* 中間大按鈕 — 記帳（有緊急時紅色脈搏）*/}
          <div className="relative flex items-center justify-center -mt-4">
            {urgentCount > 0 && openMenu !== "quick" && (
              <span
                className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-red-500 opacity-50 animate-ping pointer-events-none"
                aria-hidden="true"
              />
            )}
            <button
              onClick={() => toggleMenu("quick")}
              className={cn(
                "relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
                "active:scale-90",
                openMenu === "quick"
                  ? "bg-gray-700 rotate-45"
                  : urgentCount > 0
                    ? "bg-gradient-to-br from-red-500 to-red-700 ring-2 ring-red-300"
                    : "bg-gradient-to-br from-blue-500 to-blue-700"
              )}
            >
              {openMenu === "quick" ? (
                <X className="w-6 h-6 text-white" />
              ) : (
                <Plus className="w-7 h-7 text-white" />
              )}
            </button>
          </div>

          {/* 單據 */}
          <TabItem
            title="單據"
            href="/document-inbox"
            icon={Inbox}
            isActive={location === "/document-inbox"}
            badge={inboxStats?.pending}
          />

          {/* 更多（報表 + 設定） */}
          <TabItem
            title="更多"
            icon={BarChart3}
            isActive={
              isInViewSection || isInSystemSection || openMenu === "view" || openMenu === "more"
            }
            onClick={() => toggleMenu("view")}
          />
        </div>
      </nav>

      {/* 對話框 */}
      <QuickAddDrawer open={showQuickAdd} onOpenChange={setShowQuickAdd} />
      <QuickPaymentDialog open={showQuickPay} onOpenChange={setShowQuickPay} />
    </>
  )
}

export default MobileTabBar
