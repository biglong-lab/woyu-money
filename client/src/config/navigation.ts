/**
 * 導航配置
 * 統一管理所有導航項目和麵包屑路徑
 *
 * 架構：
 * - 付款方式管理（月付/分期/一般/租金/借貸/人事費）
 * - 統一查看（財務總覽/專案付款/付款記錄/時間計劃/專案預算/分析報表）
 * - 單據收件箱（獨立快速入口）
 * - 系統管理（收合區域）
 */
import {
  Home,
  Inbox,
  Repeat,
  CreditCard,
  DollarSign,
  Building2,
  Wallet,
  BarChart3,
  Target,
  Clipboard,
  Calendar,
  Receipt,
  FileText,
  Layers,
  User,
  Users,
  Trash2,
  Settings,
  TrendingUp,
  PieChart,
  Banknote,
  AlertTriangle,
  Sparkles,
  Scale,
  Activity,
  type LucideIcon,
} from "lucide-react"

// 導航項目類型
export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  badge?: string
  description?: string
}

// 導航分類
export interface NavCategory {
  title: string
  items: NavItem[]
}

// 主要入口（首頁、單據收件箱）
export const mainNavItems: NavItem[] = [
  {
    title: "付款首頁",
    href: "/",
    icon: Home,
  },
  {
    title: "單據收件箱",
    href: "/document-inbox",
    icon: Inbox,
    badge: "AI",
  },
]

// 財務助理分類（決策工具 — 解決記帳焦慮、拖延成本、現金缺口）
export const forecastNavItem: NavItem = {
  title: "收入預測",
  href: "/revenue-forecast",
  icon: TrendingUp,
  description: "每日累積走勢 + 月底推估 + 同期比較",
}

export const scenarioNavItem: NavItem = {
  title: "沙盤推演",
  href: "/scenario-simulator",
  icon: Sparkles,
  description: "調整行銷/訂價/固定支出，即時看下月收支影響",
}

export const decisionNavItems: NavItem[] = [
  forecastNavItem,
  scenarioNavItem,
  {
    title: "財務總覽",
    href: "/financial-overview-v2",
    icon: BarChart3,
    description: "預估 vs 實際 / 緊急事項 / 各館組損益一頁看完",
  },
  {
    title: "月度預估自動產生",
    href: "/budget-estimates",
    icon: Sparkles,
    badge: "新",
    description: "一鍵產生整月預估表（合約 + 過去 6 月平均）",
  },
  {
    title: "館別損益報表",
    href: "/property-pl",
    icon: PieChart,
    badge: "新",
    description: "各館收入、開銷、共用攤提、淨利率一覽",
  },
  {
    title: "月度差異對賬",
    href: "/variance-report",
    icon: Scale,
    badge: "新",
    description: "預估 vs 實際差異 + 漏記提醒 + 系統洞察",
  },
  {
    title: "現金分配助理",
    href: "/cash-allocation",
    icon: Wallet,
    badge: "新",
    description: "輸入可動用金額，系統建議先付哪幾筆",
  },
  {
    title: "勞健保滯納金監控",
    href: "/labor-insurance-watch",
    icon: AlertTriangle,
    badge: "新",
    description: "年度損失儀表 + 三層提醒（20/25/28）",
  },
  {
    title: "租金月度矩陣",
    href: "/rental-matrix",
    icon: Calendar,
    badge: "新",
    description: "合約×12月狀態圖 + 一鍵本月已付",
  },
  {
    title: "現金流決策中心",
    href: "/cashflow-decision-center",
    icon: TrendingUp,
    badge: "新",
    description: "未來 3-6 月收支預估 + 缺口警示",
  },
  {
    title: "收據對應助手",
    href: "/receipt-match-helper",
    icon: Receipt,
    badge: "新",
    description: "拍收據自動匹配既有項目，不重複建立",
  },
]

// 付款方式管理分類
export const managementNavItems: NavItem[] = [
  {
    title: "月付管理",
    href: "/monthly-payment-management",
    icon: Repeat,
    badge: "月付",
  },
  {
    title: "分期管理",
    href: "/installment-payment-management",
    icon: CreditCard,
    badge: "分期",
  },
  {
    title: "一般付款",
    href: "/general-payment-management",
    icon: DollarSign,
    badge: "一般",
  },
  {
    title: "租金管理",
    href: "/rental-management-enhanced",
    icon: Building2,
    badge: "租金",
  },
  {
    title: "借貸投資",
    href: "/loan-investment-management",
    icon: Wallet,
    badge: "借貸",
  },
  {
    title: "人事費管理",
    href: "/hr-cost-management",
    icon: Users,
    badge: "NEW",
    description: "員工薪資、勞健保費用管理",
  },
]

// 統一查看分類（重排序：常用直達 → 報表類 → 分析類 → 預算類）
// 註：舊版 /financial-overview 已下架（從導航移除），統一改用財務助理區的「財務總覽」(/financial-overview-v2)
// 路由保留可訪問供深度連結，但不再列入導航
export const viewNavItems: NavItem[] = [
  // ── 主視直達：每日操作高頻 ──
  {
    title: "付款記錄",
    href: "/payment-records",
    icon: Receipt,
  },
  {
    title: "專案付款管理",
    href: "/payment-project",
    icon: Clipboard,
  },
  {
    title: "付款時間計劃",
    href: "/payment-schedule",
    icon: Calendar,
  },
  // ── 📊 報表類 ──
  {
    title: "📊 財務三表",
    href: "/financial-statements",
    icon: FileText,
    description: "損益表、資產負債表、現金流量表",
  },
  {
    title: "📊 稅務報表",
    href: "/tax-reports",
    icon: Receipt,
    description: "營業稅、薪資扣繳、二代健保",
  },
  {
    title: "📊 人事費報表",
    href: "/hr-cost-reports",
    icon: Users,
    description: "年度總覽、月度明細、趨勢分析",
  },
  {
    title: "📊 付款報表",
    href: "/payment/reports",
    icon: FileText,
  },
  {
    title: "📊 收入分析",
    href: "/revenue/reports",
    icon: TrendingUp,
  },
  // ── 🔍 分析類 ──
  {
    title: "🔍 付款分析",
    href: "/payment-analysis",
    icon: PieChart,
  },
  // ── 💰 預算類 ──
  {
    title: "💰 專案預算",
    href: "/project-budget",
    icon: Target,
  },
  {
    title: "💰 家庭預算",
    href: "/household-budget",
    icon: Banknote,
    description: "家庭收支預算管理",
  },
  // 「家庭分類管理」已合併至「分類管理」(/categories) — PR-3 整合
]

// 系統管理分類（含模板管理，收合顯示）
export const systemNavItems: NavItem[] = [
  {
    title: "館別共用組",
    href: "/property-groups",
    icon: Building2,
    description: "管理共用人事/洗滌等費用的館別群組",
  },
  {
    title: "分類管理",
    href: "/categories",
    icon: Layers,
    description: "統一管理所有費用分類（含合併、清理、重複偵測）",
  },
  // 以下舊頁（PR-3）已合併至「分類管理」/categories：
  //   - 固定分類管理 (/category-management)
  //   - 專案專屬項目管理 (/project-specific-items)
  //   - 統一專案模板管理 (/unified-project-template-management)
  //   - 專案分類模板管理 (/project-template-management)
  //   - 家庭分類管理 (/household-category-management)
  // 路徑保留可訪問供回滾（30 天觀察期），但不顯示在導航
  {
    title: "用戶管理",
    href: "/user-management",
    icon: User,
  },
  {
    title: "回收站",
    href: "/recycle-bin",
    icon: Trash2,
    description: "查看和恢復已刪除的項目",
  },
  {
    title: "資料品質中心",
    href: "/settings/data-quality",
    icon: AlertTriangle,
    description: "偵測缺到期日 / 金額異常 / 殭屍項目 / 重複組",
  },
  {
    title: "外部帳單收件箱",
    href: "/expense/inbox",
    icon: Inbox,
    description: "PM 系統推進來的帳單、待確認後變應付款項",
  },
  {
    title: "整合中心",
    href: "/integrations",
    icon: Activity,
    description: "外部 API 嫁接（收入 / 支出 webhook、拋接紀錄、串接測試）",
  },
  {
    title: "週期性支出模板",
    href: "/recurring-expenses",
    icon: Repeat,
    description: "人事/洗滌/水電/保險等每月固定支出模板，自動產出待確認項目",
  },
  {
    title: "滯納金規則",
    href: "/late-fee-settings",
    icon: AlertTriangle,
    description: "設定各類別費率與寬限期（勞健保/稅務有滯納金、其他預設關閉）",
  },
  {
    title: "設定",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "帳戶設定",
    href: "/account",
    icon: User,
  },
]

// 導航分類配置（新架構：財務助理優先 + 兩大核心 + 系統管理）
export const navigationCategories: NavCategory[] = [
  { title: "主要功能", items: mainNavItems },
  { title: "財務助理", items: decisionNavItems },
  { title: "付款方式管理", items: managementNavItems },
  { title: "統一查看", items: viewNavItems },
  { title: "系統管理", items: systemNavItems },
]

// 手機版底部 Tab Bar 項目（5 個主要入口）
export const mobileTabItems: NavItem[] = [
  { title: "首頁", href: "/", icon: Home },
  { title: "單據", href: "/document-inbox", icon: Inbox },
  { title: "付款", href: "/payment-management-menu", icon: CreditCard },
  { title: "查看", href: "/view-menu", icon: BarChart3 },
  { title: "更多", href: "/more-menu", icon: Settings },
]

// 麵包屑路徑配置
export interface BreadcrumbItem {
  title: string
  href?: string
}

// 麵包屑配置：路徑 → 麵包屑陣列
export const breadcrumbConfig: Record<string, BreadcrumbItem[]> = {
  "/": [{ title: "首頁" }],

  // 單據
  "/document-inbox": [{ title: "首頁", href: "/" }, { title: "單據收件箱" }],

  // 付款方式管理
  "/monthly-payment-management": [
    { title: "首頁", href: "/" },
    { title: "付款方式管理" },
    { title: "月付管理" },
  ],
  "/installment-payment-management": [
    { title: "首頁", href: "/" },
    { title: "付款方式管理" },
    { title: "分期管理" },
  ],
  "/general-payment-management": [
    { title: "首頁", href: "/" },
    { title: "付款方式管理" },
    { title: "一般付款" },
  ],
  "/rental-management-enhanced": [
    { title: "首頁", href: "/" },
    { title: "付款方式管理" },
    { title: "租金管理" },
  ],
  "/loan-investment-management": [
    { title: "首頁", href: "/" },
    { title: "付款方式管理" },
    { title: "借貸投資" },
  ],
  // /loan-investment 是 /loan-investment-management 的別名，路由保留但不列入 breadcrumb
  "/hr-cost-management": [
    { title: "首頁", href: "/" },
    { title: "付款方式管理" },
    { title: "人事費管理" },
  ],

  // 統一查看
  // /financial-overview 已下架，僅供深度連結保留路由（無 breadcrumb 入口）
  "/project-budget": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "專案預算管理" },
  ],
  "/payment-project": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "專案付款管理" },
  ],
  "/payment-schedule": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "付款時間計劃" },
  ],
  "/payment-records": [{ title: "首頁", href: "/" }, { title: "統一查看" }, { title: "付款記錄" }],
  "/payment-analysis": [{ title: "首頁", href: "/" }, { title: "統一查看" }, { title: "付款分析" }],
  "/payment/reports": [{ title: "首頁", href: "/" }, { title: "統一查看" }, { title: "付款報表" }],
  // /payment-reports 是 /payment/reports 的別名，路由保留但不列入 breadcrumb
  "/revenue/reports": [{ title: "首頁", href: "/" }, { title: "統一查看" }, { title: "收入分析" }],
  "/payment-project-stats": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "專案統計" },
  ],
  "/financial-statements": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "財務三表" },
  ],
  "/tax-reports": [{ title: "首頁", href: "/" }, { title: "統一查看" }, { title: "稅務報表" }],
  "/hr-cost-reports": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "人事費報表" },
  ],

  // 財務助理
  "/budget-estimates": [{ title: "首頁", href: "/" }, { title: "財務助理" }, { title: "月度預估" }],
  "/property-pl": [{ title: "首頁", href: "/" }, { title: "財務助理" }, { title: "館別損益" }],
  "/variance-report": [{ title: "首頁", href: "/" }, { title: "財務助理" }, { title: "差異對賬" }],
  "/financial-overview-v2": [
    { title: "首頁", href: "/" },
    { title: "財務助理" },
    { title: "財務總覽 v2" },
  ],

  // 系統管理
  "/property-groups": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "館別共用組" },
  ],
  "/categories": [{ title: "首頁", href: "/" }, { title: "系統管理" }, { title: "分類管理" }],
  // 以下 5 個舊分類管理頁已合併至 /categories，路由保留供深度連結，不列入 breadcrumb：
  //   /category-management、/project-specific-items、/unified-project-template-management、
  //   /project-template-management、/household-category-management
  "/user-management": [{ title: "首頁", href: "/" }, { title: "系統管理" }, { title: "用戶管理" }],
  "/recycle-bin": [{ title: "首頁", href: "/" }, { title: "系統管理" }, { title: "回收站" }],
  "/settings/data-quality": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "資料品質中心" },
  ],
  "/integrations": [{ title: "首頁", href: "/" }, { title: "系統管理" }, { title: "整合中心" }],
  "/recurring-expenses": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "週期性支出模板" },
  ],
  "/revenue-forecast": [{ title: "首頁", href: "/" }, { title: "財務助理" }, { title: "收入預測" }],
  "/scenario-simulator": [
    { title: "首頁", href: "/" },
    { title: "財務助理" },
    { title: "沙盤推演" },
  ],
  "/expense/inbox": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "外部帳單收件箱" },
  ],
  "/settings": [{ title: "首頁", href: "/" }, { title: "系統管理" }, { title: "設定" }],
  "/account": [{ title: "首頁", href: "/" }, { title: "系統管理" }, { title: "帳戶設定" }],

  // 家庭財務
  "/household-budget": [{ title: "首頁", href: "/" }, { title: "統一查看" }, { title: "家庭預算" }],
  // /household-category-management 已合併至 /categories（含家庭分類）

  // 財務助理
  "/cash-allocation": [
    { title: "首頁", href: "/" },
    { title: "財務助理" },
    { title: "現金分配助理" },
  ],
  "/labor-insurance-watch": [
    { title: "首頁", href: "/" },
    { title: "財務助理" },
    { title: "勞健保滯納金監控" },
  ],
  "/rental-matrix": [
    { title: "首頁", href: "/" },
    { title: "財務助理" },
    { title: "租金月度矩陣" },
  ],
  "/cashflow-decision-center": [
    { title: "首頁", href: "/" },
    { title: "財務助理" },
    { title: "現金流決策中心" },
  ],
  "/receipt-match-helper": [
    { title: "首頁", href: "/" },
    { title: "財務助理" },
    { title: "收據對應助手" },
  ],

  // /unified-payment 與 /features 為舊路由，已從導航移除（路由保留供深度連結）
}

// 根據路徑獲取麵包屑
export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // 直接匹配
  if (breadcrumbConfig[pathname]) {
    return breadcrumbConfig[pathname]
  }

  // 處理動態路由（如 /contract/:id）
  const segments = pathname.split("/").filter(Boolean)

  if (segments[0] === "contract" && segments[1]) {
    return [{ title: "首頁", href: "/" }, { title: "合約詳情" }]
  }

  // 預設回傳首頁
  return [{ title: "首頁" }]
}

// 根據路徑獲取頁面標題
export function getPageTitle(pathname: string): string {
  const breadcrumbs = getBreadcrumbs(pathname)
  return breadcrumbs[breadcrumbs.length - 1]?.title || "首頁"
}

// 扁平化所有導航項目，用於快速查找
export const allNavItems: NavItem[] = navigationCategories.flatMap((category) => category.items)

// 根據路徑查找導航項目
export function findNavItem(href: string): NavItem | undefined {
  return allNavItems.find((item) => item.href === href)
}
