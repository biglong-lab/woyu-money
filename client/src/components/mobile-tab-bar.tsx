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
  overviewCenterNavItems,
  coreDecisionNavItems,
  toolboxNavItems,
  advancedNavItems,
} from "@/config/navigation"
import { useQuery } from "@tanstack/react-query"
import { useState, useRef, useEffect } from "react"
import {
  Home,
  Inbox,
  Plus,
  CreditCard,
  X,
  BarChart3,
  Wallet,
  Camera,
  Users,
  Building,
  PiggyBank,
  FileText,
} from "lucide-react"
import { QuickAddDrawer, useQuickCameraUpload } from "@/components/quick-add-drawer"
import { QuickPaymentDialog } from "@/components/quick-payment-dialog"
import { usePageContext, type PageContext } from "@/hooks/use-page-context"

function contextLabel(c: PageContext): string {
  switch (c) {
    case "household":
      return "💰 家用記帳"
    case "family":
      return "👨‍👩‍👧 家庭"
    case "payment":
      return "🏨 民宿付款"
    case "property":
      return "🏢 物業管理"
    case "finance":
      return "📊 財務報表"
    case "inbox":
      return "📥 收件箱"
    default:
      return "💰 家用記帳"
  }
}

function centerButtonTitle(c: PageContext): string {
  switch (c) {
    case "household":
      return "記一筆"
    case "family":
      return "派任務"
    case "payment":
      return "快速付款"
    case "property":
      return "新增"
    case "finance":
      return "快速操作"
    default:
      return "記一筆"
  }
}

interface TabItemProps {
  title: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  badge?: number
  onClick?: () => void
}

function TabItem({ title, href, icon: Icon, isActive, badge, onClick }: TabItemProps) {
  const ariaLabel = badge && badge > 0 ? `${title}（${badge} 項待處理）` : title
  const content = (
    <div
      role={href ? undefined : "button"}
      tabIndex={href ? undefined : 0}
      aria-label={ariaLabel}
      aria-current={isActive ? "page" : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
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

// 分組資料：可選的 section header
interface MenuSection {
  label: string
  color?: "blue" | "green" | "orange" | "amber"
  items: SubMenuItem[]
}

interface PopupMenuProps {
  items?: SubMenuItem[]
  sections?: MenuSection[]
  isOpen: boolean
  onClose: () => void
  title: string
  color?: "blue" | "green" | "orange"
}

function PopupMenu({ items, sections, isOpen, onClose, title, color = "blue" }: PopupMenuProps) {
  const colorClasses = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", header: "text-blue-900" },
    green: { bg: "bg-green-50", text: "text-green-600", header: "text-green-900" },
    orange: { bg: "bg-orange-50", text: "text-orange-600", header: "text-orange-900" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", header: "text-amber-900" },
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
            aria-label="關閉選單"
            title="關閉"
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {/* 分組模式：顯示每個 section 含 label */}
          {sections?.map((section) => {
            const sectionColor = section.color || color
            return (
              <div key={section.label} className="px-3 pt-3 pb-1">
                <div className="flex items-center gap-2 px-2 pb-2">
                  <span
                    className={cn(
                      "text-[11px] font-bold tracking-wider uppercase",
                      colorClasses[sectionColor].header
                    )}
                  >
                    {section.label}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {section.items.map((item) => {
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
                              colorClasses[sectionColor].bg
                            )}
                          >
                            <Icon className={cn("w-5 h-5", colorClasses[sectionColor].text)} />
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
            )
          })}

          {/* 平坦模式：給原本的 managementNavItems / systemNavItems 用 */}
          {items && (
            <div className="grid grid-cols-3 gap-1 p-3">
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
          )}
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
  onGallery: () => void
  onCashAllocation: () => void
  context: PageContext
}

function QuickMenu({
  isOpen,
  onClose,
  onQuickAdd,
  onQuickPay,
  onCamera,
  onGallery,
  onCashAllocation,
  context,
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

  const householdAction = {
    label: "記一筆",
    icon: "💸",
    color: "bg-amber-50 text-amber-700",
    onClick: () => {
      onClose()
      onQuickAdd()
    },
  }
  const cameraAction = {
    label: "拍收據",
    icon: "📸",
    color: "bg-purple-50 text-purple-700",
    onClick: () => {
      onClose()
      onCamera()
    },
  }
  const galleryAction = {
    label: "從相簿",
    icon: "🖼️",
    color: "bg-pink-50 text-pink-700",
    onClick: () => {
      onClose()
      onGallery()
    },
  }
  const manualHostelAction = {
    label: "手動記帳",
    icon: "📝",
    color: "bg-blue-50 text-blue-700",
    onClick: () => {
      onClose()
      onQuickAdd()
    },
  }
  const quickPayAction = {
    label: "記錄付款",
    icon: "💰",
    color: "bg-green-50 text-green-700",
    onClick: () => {
      onClose()
      onQuickPay()
    },
  }
  const cashAllocAction = {
    label: "現金分配",
    icon: "🎯",
    color: "bg-amber-50 text-amber-700",
    onClick: () => {
      onClose()
      onCashAllocation()
    },
  }
  // 家庭場景專屬
  const familyTaskAction = {
    label: "派任務",
    icon: "📋",
    color: "bg-pink-50 text-pink-700",
    onClick: () => {
      onClose()
      window.location.href = "/family"
    },
  }
  const familySavingsAction = {
    label: "存錢目標",
    icon: "🐷",
    color: "bg-rose-50 text-rose-700",
    onClick: () => {
      onClose()
      window.location.href = "/family"
    },
  }
  // 物業 / 財務
  const rentalMatrixAction = {
    label: "租金矩陣",
    icon: "📅",
    color: "bg-emerald-50 text-emerald-700",
    onClick: () => {
      onClose()
      window.location.href = "/rental-matrix"
    },
  }
  const forecastAction = {
    label: "現金流預測",
    icon: "📈",
    color: "bg-violet-50 text-violet-700",
    onClick: () => {
      onClose()
      window.location.href = "/revenue-forecast"
    },
  }

  // 依 context 排序 actions（前面的最常用）
  let quickActions: (typeof householdAction)[] = []
  switch (context) {
    case "household":
    case "default":
      quickActions = [householdAction, cameraAction, galleryAction, quickPayAction, cashAllocAction]
      break
    case "family":
      quickActions = [
        familyTaskAction,
        familySavingsAction,
        householdAction,
        cameraAction,
        galleryAction,
      ]
      break
    case "payment":
      quickActions = [
        quickPayAction,
        cameraAction,
        galleryAction,
        manualHostelAction,
        cashAllocAction,
      ]
      break
    case "property":
      quickActions = [
        rentalMatrixAction,
        quickPayAction,
        cameraAction,
        householdAction,
        cashAllocAction,
      ]
      break
    case "finance":
      quickActions = [
        forecastAction,
        householdAction,
        cashAllocAction,
        quickPayAction,
        cameraAction,
      ]
      break
    case "inbox":
      quickActions = [cameraAction, galleryAction, householdAction, quickPayAction, cashAllocAction]
      break
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm md:hidden">
      <div
        ref={menuRef}
        className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 animate-in slide-in-from-bottom-4 duration-200"
      >
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl",
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
  const [openMenu, setOpenMenu] = useState<"payment" | "view" | "quick" | null>(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showQuickPay, setShowQuickPay] = useState(false)
  const { openCamera, openGallery } = useQuickCameraUpload()
  const pageContext = usePageContext()
  // household 場景優先（包含 default fallback、家用記帳是預設）
  const isHousehold = pageContext === "household" || pageContext === "default"
  const isFamily = pageContext === "family"
  // inbox（單據收件箱）也走 payment 入口、共用「項目 / + / 單據」三件套
  const isPayment = pageContext === "payment" || pageContext === "inbox"
  const isProperty = pageContext === "property"
  const isFinance = pageContext === "finance"

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

  // App icon badge：在 PWA 安裝後桌面 icon 顯示總待辦數
  // 支援度：Chrome/Edge desktop + Android Chrome；iOS 暫不支援（會 silent fail）
  useEffect(() => {
    if (typeof navigator === "undefined") return
    const totalUnread = urgentCount + (inboxStats?.pending ?? 0)
    const setBadge = (
      navigator as Navigator & {
        setAppBadge?: (count?: number) => Promise<void>
        clearAppBadge?: () => Promise<void>
      }
    ).setAppBadge
    const clearBadge = (
      navigator as Navigator & {
        clearAppBadge?: () => Promise<void>
      }
    ).clearAppBadge
    if (totalUnread > 0 && setBadge) {
      setBadge(totalUnread).catch(() => {})
    } else if (clearBadge) {
      clearBadge().catch(() => {})
    }
  }, [urgentCount, inboxStats?.pending])

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

  const toggleMenu = (menu: "payment" | "view" | "quick") => {
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
        title="報表 & 設定"
        sections={[
          { label: "🎯 財務總覽中心", color: "amber", items: overviewCenterNavItems },
          { label: "💡 核心決策", color: "amber", items: coreDecisionNavItems },
          { label: "🧰 工具箱", color: "amber", items: toolboxNavItems },
          { label: "🔬 進階工具", color: "amber", items: advancedNavItems },
          { label: "📊 查看 & 報表", color: "green", items: viewNavItems },
          { label: "⚙️ 系統管理", color: "orange", items: systemNavItems },
        ]}
        isOpen={openMenu === "view"}
        onClose={() => setOpenMenu(null)}
        color="green"
      />

      {/* 快速動作選單（依場景） */}
      <QuickMenu
        isOpen={openMenu === "quick"}
        onClose={() => setOpenMenu(null)}
        onQuickAdd={() => {
          if (isHousehold) {
            // 家用場景直接跳家用快記
            window.location.href = "/household-budget?quickAdd=1"
          } else {
            setShowQuickAdd(true)
          }
        }}
        onQuickPay={() => setShowQuickPay(true)}
        onCamera={openCamera}
        onGallery={openGallery}
        onCashAllocation={() => {
          window.location.href = "/cash-allocation"
        }}
        context={pageContext}
      />

      {/* 底部 Tab Bar */}
      <nav
        aria-label="主要導航"
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          "bg-white/95 backdrop-blur-sm border-t border-gray-200",
          "shadow-lg",
          "md:hidden",
          "pb-safe"
        )}
      >
        {/* 場景標示 chip — 顯示目前場景、純資訊不可點 */}
        <div
          className={cn(
            "absolute -top-7 left-1/2 -translate-x-1/2",
            "px-2.5 py-0.5 rounded-full text-[10px] font-medium shadow-sm border",
            "pointer-events-none",
            isHousehold && "bg-amber-50 text-amber-700 border-amber-200",
            isFamily && "bg-pink-50 text-pink-700 border-pink-200",
            isPayment && "bg-blue-50 text-blue-700 border-blue-200",
            isProperty && "bg-emerald-50 text-emerald-700 border-emerald-200",
            isFinance && "bg-violet-50 text-violet-700 border-violet-200"
          )}
          aria-label={`目前場景：${contextLabel(pageContext)}`}
          data-testid="indicator-page-context"
        >
          {contextLabel(pageContext)}
        </div>

        <div className="flex items-center justify-around">
          {/* 通用：首頁 */}
          <TabItem
            title="首頁"
            href="/"
            icon={Home}
            isActive={location === "/"}
            badge={isPayment ? urgentCount : undefined}
          />

          {/* 第 2 入口：依場景 */}
          {isHousehold && (
            <TabItem
              title="預算"
              href="/household-budget"
              icon={Wallet}
              isActive={location.startsWith("/household-budget")}
            />
          )}
          {isFamily && (
            <TabItem
              title="家庭"
              href="/family"
              icon={Users}
              isActive={location === "/family" || location.startsWith("/family/")}
            />
          )}
          {isPayment && (
            <TabItem
              title="項目"
              icon={CreditCard}
              isActive={isInPaymentSection || openMenu === "payment"}
              onClick={() => toggleMenu("payment")}
            />
          )}
          {isProperty && (
            <TabItem
              title="物業"
              href="/property-groups"
              icon={Building}
              isActive={location.startsWith("/property") || location.startsWith("/rental")}
            />
          )}
          {isFinance && (
            <TabItem
              title="報表"
              href="/financial-dashboard"
              icon={BarChart3}
              isActive={
                location.startsWith("/financial-") ||
                location.startsWith("/budget") ||
                location.startsWith("/forecast")
              }
            />
          )}

          {/* 中間大按鈕 — 依場景變色 + 變動作 */}
          <div className="relative flex items-center justify-center -mt-4">
            {isPayment && urgentCount > 0 && openMenu !== "quick" && (
              <span
                className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-red-500 opacity-50 animate-ping pointer-events-none"
                aria-hidden="true"
              />
            )}
            <button
              onClick={() => toggleMenu("quick")}
              aria-label={openMenu === "quick" ? "關閉選單" : "開啟快速動作選單"}
              aria-expanded={openMenu === "quick"}
              title={centerButtonTitle(pageContext)}
              className={cn(
                "relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
                "active:scale-90",
                openMenu === "quick" && "bg-gray-700 rotate-45",
                openMenu !== "quick" &&
                  isHousehold &&
                  "bg-gradient-to-br from-amber-500 to-orange-600",
                openMenu !== "quick" && isFamily && "bg-gradient-to-br from-pink-500 to-rose-600",
                openMenu !== "quick" &&
                  isPayment &&
                  (urgentCount > 0
                    ? "bg-gradient-to-br from-red-500 to-red-700 ring-2 ring-red-300"
                    : "bg-gradient-to-br from-blue-500 to-blue-700"),
                openMenu !== "quick" &&
                  isProperty &&
                  "bg-gradient-to-br from-emerald-500 to-teal-600",
                openMenu !== "quick" &&
                  isFinance &&
                  "bg-gradient-to-br from-violet-500 to-purple-600"
              )}
            >
              {openMenu === "quick" ? (
                <X className="w-6 h-6 text-white" />
              ) : (
                <Plus className="w-7 h-7 text-white" />
              )}
            </button>
          </div>

          {/* 第 4 入口：依場景 */}
          {isHousehold && (
            <TabItem title="拍照" icon={Camera} isActive={false} onClick={openCamera} />
          )}
          {isFamily && (
            <TabItem
              title="存錢"
              icon={PiggyBank}
              isActive={false}
              onClick={() => (window.location.href = "/family")}
            />
          )}
          {isPayment && (
            <TabItem
              title="單據"
              href="/document-inbox"
              icon={Inbox}
              isActive={location === "/document-inbox"}
              badge={inboxStats?.pending}
            />
          )}
          {isProperty && (
            <TabItem
              title="租金"
              href="/rental-matrix"
              icon={FileText}
              isActive={location === "/rental-matrix"}
            />
          )}
          {isFinance && (
            <TabItem
              title="預測"
              href="/revenue-forecast"
              icon={BarChart3}
              isActive={
                location.startsWith("/revenue-forecast") || location.startsWith("/scenario")
              }
            />
          )}

          {/* 通用：更多 */}
          <TabItem
            title="更多"
            icon={BarChart3}
            isActive={isInViewSection || isInSystemSection || openMenu === "view"}
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
