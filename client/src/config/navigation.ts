/**
 * 導航配置
 * 統一管理所有導航項目和麵包屑路徑
 *
 * 架構（2026-07-04 資訊架構重整 — 按「要做什麼事」分群）：
 * - 主要功能（付款首頁/記帳窗口/歷史欠款/財務駕駛艙）
 * - 💸 付款與排程（該付什麼→排程→對帳）
 * - 🏢 固定成本與合約（租金/人事勞健保/週期開銷/借貸）
 * - 📊 報表與規劃（總覽下鑽/經營報表/前瞻規劃）
 * - 👨‍👩‍👧 家庭 / ⚙️ 系統管理
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

// 主要入口（最高頻 4 項、常駐頂層）
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
  {
    title: "財務駕駛艙",
    href: "/financial-cockpit",
    icon: Activity,
    badge: "總覽",
    description: "現況 + 應付款排序 + 現金缺口，一頁看完並導向深度工具",
  },
]

// ============================================================
// 選單分群（2026-07-04 資訊架構重整：按「要做什麼事」分群、非工具類型）
// 舊分群（總覽中心/核心決策/工具箱/進階工具/付款方式管理/統一查看）已解散，
// 所有入口保留、只重新歸類。項目 emoji 前綴 = 群內小節。
// ============================================================

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
  {
    title: "專案付款統計",
    href: "/payment-project-stats",
    icon: BarChart3,
    description: "專案付款統計報表（付款報表 tab）",
  },
]

// 💸 付款與排程 — 該付什麼 → 排程 → 對帳，一條動線
export const paymentActionNavItems: NavItem[] = [
  // ── ⏰ 該付什麼 ──
  {
    title: "⏰ 帳單到期看板",
    href: "/bills",
    icon: CalendarClock,
    description: "通盤近期應繳（法定付款日+強執分期），逾期/即將到期、避免遲繳",
  },
  {
    title: "⏰ 現金分配助理",
    href: "/cash-allocation",
    icon: Wallet,
    description: "輸入可動用金額、系統建議先付哪幾筆",
  },
  {
    title: "⏰ 強制執行管理",
    href: "/enforcement",
    icon: Gavel,
    description: "執行處公文/圈存/分期對帳（公文OCR帶入）、被強執款項分流",
  },
  // ── 📦 付款項目 ──
  {
    title: "📦 付款項目管理",
    href: "/monthly-payment-management",
    icon: Repeat,
    description: "月付 / 分期 / 一般付款（頁內 tab 切換）",
  },
  {
    title: "📦 專案付款管理",
    href: "/payment-project",
    icon: Clipboard,
    description: "以專案為單位協調付款項目",
  },
  // ── 📅 排程規劃 ──
  {
    title: "📅 付款時間計劃",
    href: "/payment-schedule",
    icon: Calendar,
    description: "逐筆安排付款日期、逾期追蹤",
  },
  {
    title: "📅 排程分配規劃台",
    href: "/payment-planner",
    icon: Calendar,
    description: "一頁安排所有應付款付款月份，推估每月/季/年所需金額",
  },
  // ── 🧾 記錄對帳 ──
  {
    title: "🧾 付款記錄",
    href: "/payment-records",
    icon: Receipt,
  },
  {
    title: "🧾 收據對應助手",
    href: "/receipt-match-helper",
    icon: Receipt,
    description: "拍收據自動匹配既有項目、不重複建立",
  },
  {
    title: "🧾 信用卡請款紀錄",
    href: "/card-claims",
    icon: CreditCard,
    description: "記錄刷卡請款金額、銀行、標籤、館別、狀態 + 月度統計",
  },
]

// 🏢 固定成本與合約 — 租金/人事勞健保/週期開銷/借貸，每月固定要面對的
export const fixedCostNavItems: NavItem[] = [
  {
    title: "租金管理",
    href: "/rental-management-enhanced",
    icon: Building2,
    description: "租約、房東付款、價格階梯",
  },
  {
    title: "租金月度矩陣",
    href: "/rental-matrix",
    icon: Calendar,
    description: "合約×12月狀態圖 + 一鍵本月已付",
  },
  {
    title: "人事費管理",
    href: "/hr-cost-management",
    icon: Users,
    description: "員工薪資、勞健保費用管理",
  },
  {
    title: "勞健保矩陣",
    href: "/labor-insurance-matrix",
    icon: Shield,
    description: "勞保/健保/勞退 雇主負擔×12月、整月一鍵標已繳",
  },
  {
    title: "勞健保滯納金監控",
    href: "/labor-insurance-watch",
    icon: AlertTriangle,
    description: "年度損失儀表 + 三層提醒",
  },
  {
    title: "固定開銷矩陣",
    href: "/fixed-expense-matrix",
    icon: CalendarRange,
    description: "週期性支出 預算 vs 實際×12月、超支結餘一眼看",
  },
  {
    title: "週期性支出模板",
    href: "/recurring-expenses",
    icon: Repeat,
    description: "人事/洗滌/水電/保險等每月固定支出模板，自動產出待確認項目",
  },
  {
    title: "借貸投資",
    href: "/loan-investment-management",
    icon: Wallet,
    description: "借貸與投資紀錄、還款排程（含高風險標記）",
  },
]

// 📊 報表與規劃 — 看數字（總覽下鑽 / 經營報表 / 前瞻規劃）
export const reportsNavItems: NavItem[] = [
  // ── 👁️ 總覽下鑽（與駕駛艙 OverviewTabs 互達）──
  {
    title: "👁️ 應付總覽看板",
    href: "/payables-dashboard",
    icon: Wallet,
    description: "給付、應付、還有多少未付（分類/專案 × 12 月矩陣）",
  },
  {
    title: "👁️ 成本結構中樞",
    href: "/cost-overview",
    icon: Layers,
    description: "租金/人事/固定開銷/流水雜支/其他 全年成本結構+占比",
  },
  {
    title: "👁️ 館別損益報表",
    href: "/property-pl",
    icon: PieChart,
    description: "各館收入、開銷、共用攤提、淨利率（單館/館組切換）",
  },
  // ── 📊 經營報表 ──
  {
    title: "📊 收入分析",
    href: "/revenue/reports",
    icon: TrendingUp,
    description: "收入分析 / PMS vs PM 比對 / 收入預測（頁內 tab 切換）",
  },
  {
    title: "📊 付款報表",
    href: "/payment/reports",
    icon: FileText,
    description: "付款報表（圖表）/ 付款分析（整合明細）— 頁內 tab 切換",
  },
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
    title: "📊 月度差異對賬",
    href: "/variance-report",
    icon: Scale,
    description: "預估 vs 實際差異 + 漏記提醒",
  },
  // ── 🧭 前瞻規劃 ──
  {
    title: "🧭 沙盤推演",
    href: "/scenario-planner",
    icon: Sparkles,
    description: "收入↑/成本↓/還款三軸推未來 12 月現金走勢（內含下月精算）",
  },
  {
    title: "🧭 專案預算",
    href: "/project-budget",
    icon: Target,
    description: "商業多專案預算與分攤",
  },
  {
    title: "🧭 月度預估自動產生",
    href: "/budget-estimates",
    icon: Sparkles,
    description: "一鍵產生整月預估表（合約 + 過去 6 月平均）",
  },
]

// 👨‍👩‍👧 家庭 — 家用記帳與小孩理財
export const familyAreaNavItems: NavItem[] = [
  {
    title: "家庭記帳",
    href: "/family",
    icon: Wallet,
    description: "家長派任務、小孩 PIN 登入、三罐分配、養成記帳習慣",
  },
  {
    title: "家庭預算",
    href: "/household-budget",
    icon: Banknote,
    description: "家庭收支預算管理",
  },
]

// ⚙️ 系統管理（依「收件/整合 → 資料管理 → 系統設定」三小節；
// 週期性支出模板已移至 🏢 固定成本與合約）
export const systemNavItems: NavItem[] = [
  // ── 🔌 收件 / 整合 ──
  {
    title: "🔌 外部帳單收件箱",
    href: "/expense/inbox",
    icon: Inbox,
    description: "PM 系統推進來的帳單、待確認後變應付款項",
  },
  {
    title: "🔌 進帳收件箱",
    href: "/income/inbox",
    icon: Inbox,
    description: "PM/外部支付推進來的收入、確認後入帳（含一鍵批次確認）",
  },
  {
    title: "🔌 收入來源管理",
    href: "/income/sources",
    icon: TrendingUp,
    description: "進帳來源與預設專案設定（一鍵確認的前置設定）",
  },
  {
    title: "🔌 整合中心",
    href: "/integrations",
    icon: Activity,
    description: "外部 API 嫁接（收入 / 支出 webhook、拋接紀錄、串接測試）",
  },
  // ── 🗂️ 資料管理 ──
  {
    title: "🗂️ 分類管理",
    href: "/categories",
    icon: Layers,
    description: "統一管理所有費用分類（含合併、清理、重複偵測）",
  },
  {
    title: "🗂️ 館別共用組",
    href: "/property-groups",
    icon: Building2,
    description: "管理共用人事/洗滌等費用的館別群組",
  },
  {
    title: "🗂️ 滯納金規則",
    href: "/late-fee-settings",
    icon: AlertTriangle,
    description: "設定各類別費率與寬限期（勞健保/稅務有滯納金、其他預設關閉）",
  },
  {
    title: "🗂️ 資料品質中心",
    href: "/settings/data-quality",
    icon: AlertTriangle,
    description: "偵測缺到期日 / 金額異常 / 殭屍項目 / 重複組",
  },
  {
    title: "🗂️ 回收站",
    href: "/recycle-bin",
    icon: Trash2,
    description: "查看和恢復已刪除的項目",
  },
  // ── ⚙️ 系統設定 ──
  {
    title: "⚙️ 用戶管理",
    href: "/user-management",
    icon: User,
  },
  {
    title: "⚙️ Cron 健康觀測",
    href: "/admin/cron-health",
    icon: Activity,
    description: "排程器 tick 紀錄與健康狀態（原孤兒頁、僅深連結可達）",
  },
  {
    title: "⚙️ 設定",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "⚙️ 帳戶設定",
    href: "/account",
    icon: User,
  },
]

// 導航分類配置（新架構：財務助理優先 + 兩大核心 + 系統管理）
export const navigationCategories: NavCategory[] = [
  { title: "主要功能", items: mainNavItems },
  { title: "💸 付款與排程", items: paymentActionNavItems },
  { title: "🏢 固定成本與合約", items: fixedCostNavItems },
  { title: "📊 報表與規劃", items: reportsNavItems },
  { title: "👨‍👩‍👧 家庭", items: familyAreaNavItems },
  { title: "系統管理", items: systemNavItems },
  // 頁內分頁：只給 Cmd+K 搜尋用（top-navigation 用自己的 categoryConfigs、不會顯示這組）
  { title: "頁內分頁（tab 互達）", items: tabPagesNavItems },
]

// （已移除 mobileTabItems 死碼：href 指向不存在路由且無人 import，
//  mobile-tab-bar.tsx 自行以 onClick 開 sheet — 2026-07-08 介面清理）

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
    { title: "💸 付款與排程" },
    { title: "月付管理" },
  ],
  "/installment-payment-management": [
    { title: "首頁", href: "/" },
    { title: "💸 付款與排程" },
    { title: "分期管理" },
  ],
  "/general-payment-management": [
    { title: "首頁", href: "/" },
    { title: "💸 付款與排程" },
    { title: "一般付款" },
  ],
  "/rental-management-enhanced": [
    { title: "首頁", href: "/" },
    { title: "🏢 固定成本與合約" },
    { title: "租金管理" },
  ],
  "/loan-investment-management": [
    { title: "首頁", href: "/" },
    { title: "🏢 固定成本與合約" },
    { title: "借貸投資" },
  ],
  // /loan-investment 是 /loan-investment-management 的別名，路由保留但不列入 breadcrumb
  "/hr-cost-management": [
    { title: "首頁", href: "/" },
    { title: "🏢 固定成本與合約" },
    { title: "人事費管理" },
  ],

  // 統一查看
  // /financial-overview 已下架，僅供深度連結保留路由（無 breadcrumb 入口）
  "/project-budget": [
    { title: "首頁", href: "/" },
    { title: "📊 報表與規劃" },
    { title: "專案預算管理" },
  ],
  "/payment-project": [
    { title: "首頁", href: "/" },
    { title: "💸 付款與排程" },
    { title: "專案付款管理" },
  ],
  "/payment-schedule": [
    { title: "首頁", href: "/" },
    { title: "💸 付款與排程" },
    { title: "付款時間計劃" },
  ],
  "/payment-records": [
    { title: "首頁", href: "/" },
    { title: "💸 付款與排程" },
    { title: "付款記錄" },
  ],
  "/payment-analysis": [
    { title: "首頁", href: "/" },
    { title: "💸 付款與排程" },
    { title: "付款分析" },
  ],
  "/payment/reports": [
    { title: "首頁", href: "/" },
    { title: "📊 報表與規劃" },
    { title: "付款報表" },
  ],
  // /payment-reports 是 /payment/reports 的別名，路由保留但不列入 breadcrumb
  "/revenue/reports": [
    { title: "首頁", href: "/" },
    { title: "📊 報表與規劃" },
    { title: "收入分析" },
  ],
  "/payment-project-stats": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "專案統計" },
  ],
  "/financial-statements": [
    { title: "首頁", href: "/" },
    { title: "📊 報表與規劃" },
    { title: "財務三表" },
  ],
  "/tax-reports": [{ title: "首頁", href: "/" }, { title: "📊 報表與規劃" }, { title: "稅務報表" }],
  "/hr-cost-reports": [
    { title: "首頁", href: "/" },
    { title: "📊 報表與規劃" },
    { title: "人事費報表" },
  ],

  // 財務助理
  "/budget-estimates": [
    { title: "首頁", href: "/" },
    { title: "📊 報表與規劃" },
    { title: "月度預估" },
  ],
  "/property-pl": [{ title: "首頁", href: "/" }, { title: "📊 報表與規劃" }, { title: "館別損益" }],
  "/variance-report": [
    { title: "首頁", href: "/" },
    { title: "📊 報表與規劃" },
    { title: "差異對賬" },
  ],
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
    { title: "🏢 固定成本與合約" },
    { title: "週期性支出模板" },
  ],
  "/revenue-forecast": [
    { title: "首頁", href: "/" },
    { title: "收入分析", href: "/revenue/reports" },
    { title: "收入預測" },
  ],
  "/card-claims": [
    { title: "首頁", href: "/" },
    { title: "💸 付款與排程" },
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
    { title: "📊 報表與規劃" },
    { title: "綜合儀表板" },
  ],
  "/cost-overview": [
    { title: "首頁", href: "/" },
    { title: "📊 報表與規劃" },
    { title: "成本結構總覽" },
  ],
  "/family": [{ title: "首頁", href: "/" }, { title: "👨‍👩‍👧 家庭" }, { title: "家庭記帳" }],
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
  "/household-budget": [{ title: "首頁", href: "/" }, { title: "👨‍👩‍👧 家庭" }, { title: "家庭預算" }],
  // /household-category-management 已合併至 /categories（含家庭分類）

  // 財務助理
  "/cash-allocation": [
    { title: "首頁", href: "/" },
    { title: "💸 付款與排程" },
    { title: "現金分配助理" },
  ],
  "/labor-insurance-watch": [
    { title: "首頁", href: "/" },
    { title: "🏢 固定成本與合約" },
    { title: "勞健保滯納金監控" },
  ],
  "/rental-matrix": [
    { title: "首頁", href: "/" },
    { title: "🏢 固定成本與合約" },
    { title: "租金月度矩陣" },
  ],
  "/fixed-expense-matrix": [
    { title: "首頁", href: "/" },
    { title: "🏢 固定成本與合約" },
    { title: "固定開銷矩陣" },
  ],
  "/labor-insurance-matrix": [
    { title: "首頁", href: "/" },
    { title: "🏢 固定成本與合約" },
    { title: "勞健保矩陣" },
  ],
  "/enforcement": [
    { title: "首頁", href: "/" },
    { title: "💸 付款與排程" },
    { title: "強制執行管理" },
  ],
  "/bills": [{ title: "首頁", href: "/" }, { title: "💸 付款與排程" }, { title: "帳單到期看板" }],
  "/cashflow-decision-center": [
    { title: "首頁", href: "/" },
    { title: "📊 報表與規劃" },
    { title: "現金流決策中心" },
  ],
  "/receipt-match-helper": [
    { title: "首頁", href: "/" },
    { title: "💸 付款與排程" },
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
