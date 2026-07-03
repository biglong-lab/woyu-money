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
  ClipboardList,
  Calendar,
  CalendarRange,
  CalendarClock,
  Shield,
  Gavel,
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
    title: "記帳窗口",
    href: "/document-inbox",
    icon: Inbox,
    badge: "記帳",
    description: "單據收件箱 + 開銷流水帳：先記錄、後分帳的統一窗口",
  },
  {
    title: "歷史欠款整理",
    href: "/debts",
    icon: ClipboardList,
    badge: "整理",
    description: "過去散落欠款先登打看全貌，再分期還款與歸帳；獨立於記帳窗口",
  },
]

// 財務助理分類（決策工具 — 解決記帳焦慮、拖延成本、現金缺口）
// 註：收入預測 /revenue-forecast、收入比對 /revenue/compare 已收攏進「收入分析」
// (/revenue/reports) 的 RevenueTabs tab 列（2026-07-03），不再獨立列導航

// 註：/scenario-simulator（下月精算）已從導航移除（2026-07-03 沙盤二合一），
// 由沙盤推演主頁（/scenario-planner）頁首的「下月精算模式」連結進入
export const scenarioPlannerNavItem: NavItem = {
  title: "沙盤推演 · 現金模擬",
  href: "/scenario-planner",
  icon: Sparkles,
  description: "收入↑/成本↓/還款三軸推未來 12 月現金走勢（內含下月精算模式）",
}

export const costOverviewNavItem: NavItem = {
  title: "成本結構中樞",
  href: "/cost-overview",
  icon: Layers,
  description: "租金/人事/固定開銷/流水雜支/其他 全年成本結構+占比，下鑽三大矩陣",
}

export const familyNavItem: NavItem = {
  title: "家庭記帳",
  href: "/family",
  icon: Wallet,
  description: "家長派任務、小孩 PIN 登入、三罐分配、養成記帳習慣",
}

// 註：/forecast-input 已下架，PMS 系統已自動同步「不定期填入」資料
// 路由保留可訪問供舊連結，但不顯示在導航

// 財務健康駕駛艙（全站唯一財務主入口 — 一頁看完現況/該付什麼/未來現金流）
export const cockpitNavItem: NavItem = {
  title: "財務健康駕駛艙",
  href: "/financial-cockpit",
  icon: Activity,
  description: "現況 + 應付款排序 + 現金缺口，一頁看完並導向深度工具",
}

// 財務總覽中心（單一主入口=財務健康駕駛艙、其餘為下鑽頁）
// 2026-07-03 導航收斂：綜合儀表板 / 財務總覽 v2 / 現金流決策中心 從選單移除，
// 改由各總覽頁內的 OverviewTabs tab 列互達（頁面保留、路由保留、不刪功能）
export const overviewCenterNavItems: NavItem[] = [
  { ...cockpitNavItem, badge: "主入口" }, // 財務健康駕駛艙 — 唯一財務主入口
  {
    title: "應付總覽看板",
    href: "/payables-dashboard",
    icon: Wallet,
    description: "下鑽：給付、應付、還有多少未付（分類/專案 × 12 月矩陣，可點格看明細）",
  },
  costOverviewNavItem, // 下鑽：成本結構中樞
]

// 頁內分頁（tab 互達）頁面 — 不列主導航、但保留給 Cmd+K 搜尋與 findNavItem
// （2026-07-03 導航收斂後，這些頁只能從各自的 tab 列進入；沒有這組 palette 會搜不到）
export const tabPagesNavItems: NavItem[] = [
  {
    title: "綜合儀表板",
    href: "/financial-dashboard",
    icon: BarChart3,
    description: "YTD + 未來 3 月預估（總覽中心 tab）",
  },
  {
    title: "現金流決策中心",
    href: "/cashflow-decision-center",
    icon: TrendingUp,
    description: "未來 3-6 月收支預估 + 缺口警示（總覽中心 tab）",
  },
  {
    title: "沙盤推演 · 下月精算",
    href: "/scenario-simulator",
    icon: Sparkles,
    description: "調行銷/訂價/固定支出看下月收支（沙盤推演內）",
  },
  {
    title: "收入預測",
    href: "/revenue-forecast",
    icon: TrendingUp,
    description: "每日累積走勢 + 月底推估（收入分析 tab）",
  },
  {
    title: "收入比對",
    href: "/revenue/compare",
    icon: Scale,
    description: "PMS（發票）vs PM（逐筆）雙軌比對（收入分析 tab）",
  },
  {
    title: "分期管理",
    href: "/installment-payment-management",
    icon: CreditCard,
    description: "分期付款項目（付款項目管理 tab）",
  },
  {
    title: "一般付款管理",
    href: "/general-payment-management",
    icon: DollarSign,
    description: "一般付款項目（付款項目管理 tab）",
  },
  {
    title: "付款分析",
    href: "/payment-analysis",
    icon: PieChart,
    description: "整合付款明細分析（付款報表 tab）",
  },
]

// 核心決策（規劃工具）— 總覽類已移至「財務總覽中心」
export const coreDecisionNavItems: NavItem[] = [
  {
    title: "排程分配規劃台",
    href: "/payment-planner",
    icon: Calendar,
    description: "一頁安排所有應付款付款月份，推估每月/季/年所需金額",
  },
  scenarioPlannerNavItem, // 沙盤推演：未來現金模擬（內含下月精算模式）
]

// 工具箱（常用、可摺疊、依使用頻率排序）
export const toolboxNavItems: NavItem[] = [
  familyNavItem,
  {
    title: "館別損益報表",
    href: "/property-pl",
    icon: PieChart,
    description: "各館收入、開銷、共用攤提、淨利率一覽",
  },
  {
    title: "現金分配助理",
    href: "/cash-allocation",
    icon: Wallet,
    description: "輸入可動用金額、系統建議先付哪幾筆",
  },
  {
    title: "租金月度矩陣",
    href: "/rental-matrix",
    icon: Calendar,
    description: "合約×12月狀態圖 + 一鍵本月已付",
  },
  {
    title: "固定開銷矩陣",
    href: "/fixed-expense-matrix",
    icon: CalendarRange,
    description: "週期性支出 預算 vs 實際×12月、超支結餘一眼看",
  },
  {
    title: "勞健保矩陣",
    href: "/labor-insurance-matrix",
    icon: Shield,
    description: "勞保/健保/勞退 雇主負擔×12月、整月一鍵標已繳",
  },
  {
    title: "強制執行管理",
    href: "/enforcement",
    icon: Gavel,
    description: "執行處公文/圈存/分期對帳（公文OCR帶入）、被強執款項分流",
  },
  {
    title: "帳單到期看板",
    href: "/bills",
    icon: CalendarClock,
    description: "通盤近期應繳（法定付款日+強執分期），逾期/即將到期、避免遲繳",
  },
  {
    title: "收據對應助手",
    href: "/receipt-match-helper",
    icon: Receipt,
    description: "拍收據自動匹配既有項目、不重複建立",
  },
  {
    title: "信用卡請款紀錄",
    href: "/card-claims",
    icon: CreditCard,
    description: "記錄刷卡請款金額、銀行、標籤、館別、狀態 + 月度統計",
  },
]

// 進階工具（較少用的分析/模擬，預設收合，不刪頁只下放）
export const advancedNavItems: NavItem[] = [
  {
    title: "月度預估自動產生",
    href: "/budget-estimates",
    icon: Sparkles,
    description: "一鍵產生整月預估表（合約 + 過去 6 月平均）",
  },
  {
    title: "月度差異對賬",
    href: "/variance-report",
    icon: Scale,
    description: "預估 vs 實際差異 + 漏記提醒",
  },
  {
    title: "勞健保滯納金監控",
    href: "/labor-insurance-watch",
    icon: AlertTriangle,
    description: "年度損失儀表 + 三層提醒",
  },
]

// 付款方式管理分類
export const managementNavItems: NavItem[] = [
  // 2026-07-03 UX2：月付/分期/一般 三頁由頁內 PaymentTypeTabs 互達、選單收成一項
  {
    title: "付款項目管理",
    href: "/monthly-payment-management",
    icon: Repeat,
    badge: "項目",
    description: "月付 / 分期 / 一般付款（頁內 tab 切換）",
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
// 註：舊版 /financial-overview 與 /financial-overview-v2 均已下架，主入口為財務健康駕駛艙 /financial-cockpit
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
    description: "付款報表（圖表）/ 付款分析（整合明細）— 頁內 tab 切換",
  },
  {
    title: "📊 收入分析",
    href: "/revenue/reports",
    icon: TrendingUp,
    description: "收入分析 / PMS vs PM 比對 / 收入預測（頁內 tab 切換）",
  },
  // 「付款分析」已收攏進「付款報表」頁內 tab（2026-07-03 UX2）
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
    title: "進帳收件箱",
    href: "/income/inbox",
    icon: Inbox,
    description: "PM/外部支付推進來的收入、確認後入帳（含一鍵批次確認）",
  },
  {
    title: "收入來源管理",
    href: "/income/sources",
    icon: TrendingUp,
    description: "進帳來源與預設專案設定（一鍵確認的前置設定）",
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
  { title: "🎯 財務總覽中心", items: overviewCenterNavItems },
  { title: "💡 核心決策", items: coreDecisionNavItems },
  { title: "🧰 工具箱", items: toolboxNavItems },
  { title: "🔬 進階工具", items: advancedNavItems },
  { title: "付款方式管理", items: managementNavItems },
  { title: "統一查看", items: viewNavItems },
  { title: "系統管理", items: systemNavItems },
  // 頁內分頁：只給 Cmd+K 搜尋用（top-navigation 用自己的 categoryConfigs、不會顯示這組）
  { title: "頁內分頁（tab 互達）", items: tabPagesNavItems },
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
  // /financial-overview-v2 已於 2026-07-03 拆散下架（館組視圖→/property-pl、待處理→駕駛艙），路由 redirect 至駕駛艙

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
  "/revenue-forecast": [
    { title: "首頁", href: "/" },
    { title: "收入分析", href: "/revenue/reports" },
    { title: "收入預測" },
  ],
  "/card-claims": [
    { title: "首頁", href: "/" },
    { title: "財務助理" },
    { title: "信用卡請款紀錄" },
  ],
  "/debts": [{ title: "首頁", href: "/" }, { title: "財務助理" }, { title: "歷史欠款整理" }],
  "/financial-cockpit": [{ title: "首頁", href: "/" }, { title: "財務健康駕駛艙" }],
  "/payment-planner": [
    { title: "首頁", href: "/" },
    { title: "財務健康駕駛艙", href: "/financial-cockpit" },
    { title: "排程分配規劃台" },
  ],
  "/scenario-planner": [
    { title: "首頁", href: "/" },
    { title: "財務健康駕駛艙", href: "/financial-cockpit" },
    { title: "沙盤推演" },
  ],
  "/scenario-simulator": [
    { title: "首頁", href: "/" },
    { title: "沙盤推演", href: "/scenario-planner" },
    { title: "下月精算" },
  ],
  "/financial-dashboard": [
    { title: "首頁", href: "/" },
    { title: "財務助理" },
    { title: "綜合儀表板" },
  ],
  "/cost-overview": [
    { title: "首頁", href: "/" },
    { title: "財務助理" },
    { title: "成本結構總覽" },
  ],
  "/family": [{ title: "首頁", href: "/" }, { title: "財務助理" }, { title: "家庭記帳" }],
  // /forecast-input 頁面已於 2026-07-03 刪除（PMS 已自動同步）
  "/expense/inbox": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "外部帳單收件箱" },
  ],
  "/income/inbox": [{ title: "首頁", href: "/" }, { title: "系統管理" }, { title: "進帳收件箱" }],
  "/income/sources": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "收入來源管理" },
  ],
  "/revenue/compare": [
    { title: "首頁", href: "/" },
    { title: "收入分析", href: "/revenue/reports" },
    { title: "收入比對" },
  ],
  "/admin/cron-health": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "Cron 健康觀測" },
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
  "/fixed-expense-matrix": [
    { title: "首頁", href: "/" },
    { title: "財務助理" },
    { title: "固定開銷矩陣" },
  ],
  "/labor-insurance-matrix": [
    { title: "首頁", href: "/" },
    { title: "財務助理" },
    { title: "勞健保矩陣" },
  ],
  "/enforcement": [{ title: "首頁", href: "/" }, { title: "財務助理" }, { title: "強制執行管理" }],
  "/bills": [{ title: "首頁", href: "/" }, { title: "財務助理" }, { title: "帳單到期看板" }],
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
