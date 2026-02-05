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
  FolderOpen,
  User,
  Users,
  Trash2,
  Settings,
  Link as LinkIcon,
  TrendingUp,
  PieChart,
  type LucideIcon,
} from "lucide-react";

// 導航項目類型
export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  description?: string;
}

// 導航分類
export interface NavCategory {
  title: string;
  items: NavItem[];
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
];

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
];

// 統一查看分類（合併原來的「檢視功能」和「分析報表」）
export const viewNavItems: NavItem[] = [
  {
    title: "財務總覽",
    href: "/financial-overview",
    icon: BarChart3,
  },
  {
    title: "專案付款管理",
    href: "/payment-project",
    icon: Clipboard,
  },
  {
    title: "付款記錄",
    href: "/payment-records",
    icon: Receipt,
  },
  {
    title: "付款時間計劃",
    href: "/payment-schedule",
    icon: Calendar,
  },
  {
    title: "專案預算管理",
    href: "/project-budget",
    icon: Target,
  },
  {
    title: "付款分析",
    href: "/payment-analysis",
    icon: PieChart,
  },
  {
    title: "付款報表",
    href: "/payment/reports",
    icon: FileText,
  },
  {
    title: "收入分析",
    href: "/revenue/reports",
    icon: TrendingUp,
  },
  {
    title: "財務三表",
    href: "/financial-statements",
    icon: FileText,
    badge: "NEW",
    description: "損益表、資產負債表、現金流量表",
  },
  {
    title: "人事費報表",
    href: "/hr-cost-reports",
    icon: Users,
    badge: "NEW",
    description: "年度總覽、月度明細、趨勢分析",
  },
];

// 系統管理分類（含模板管理，收合顯示）
export const systemNavItems: NavItem[] = [
  {
    title: "分類管理",
    href: "/categories",
    icon: Layers,
  },
  {
    title: "固定分類管理",
    href: "/category-management",
    icon: FolderOpen,
  },
  {
    title: "專案專屬項目管理",
    href: "/project-specific-items",
    icon: Building2,
    description: "管理「固定分類+專案」的專屬項目",
  },
  {
    title: "統一專案模板管理",
    href: "/unified-project-template-management",
    icon: Clipboard,
  },
  {
    title: "專案分類模板管理",
    href: "/project-template-management",
    icon: LinkIcon,
  },
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
    title: "設定",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "帳戶設定",
    href: "/account",
    icon: User,
  },
];

// 導航分類配置（新架構：兩大核心區塊 + 系統管理）
export const navigationCategories: NavCategory[] = [
  { title: "主要功能", items: mainNavItems },
  { title: "付款方式管理", items: managementNavItems },
  { title: "統一查看", items: viewNavItems },
  { title: "系統管理", items: systemNavItems },
];

// 手機版底部 Tab Bar 項目（5 個主要入口）
export const mobileTabItems: NavItem[] = [
  { title: "首頁", href: "/", icon: Home },
  { title: "單據", href: "/document-inbox", icon: Inbox },
  { title: "付款", href: "/payment-management-menu", icon: CreditCard },
  { title: "查看", href: "/view-menu", icon: BarChart3 },
  { title: "更多", href: "/more-menu", icon: Settings },
];

// 麵包屑路徑配置
export interface BreadcrumbItem {
  title: string;
  href?: string;
}

// 麵包屑配置：路徑 → 麵包屑陣列
export const breadcrumbConfig: Record<string, BreadcrumbItem[]> = {
  "/": [{ title: "首頁" }],

  // 單據
  "/document-inbox": [
    { title: "首頁", href: "/" },
    { title: "單據收件箱" },
  ],

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
  "/loan-investment": [
    { title: "首頁", href: "/" },
    { title: "付款方式管理" },
    { title: "借貸投資" },
  ],
  "/hr-cost-management": [
    { title: "首頁", href: "/" },
    { title: "付款方式管理" },
    { title: "人事費管理" },
  ],

  // 統一查看
  "/financial-overview": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "財務總覽" },
  ],
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
  "/payment-records": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "付款記錄" },
  ],
  "/payment-analysis": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "付款分析" },
  ],
  "/payment/reports": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "付款報表" },
  ],
  "/payment-reports": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "付款報表" },
  ],
  "/revenue/reports": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "收入分析" },
  ],
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
  "/tax-reports": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "稅務報表" },
  ],
  "/hr-cost-reports": [
    { title: "首頁", href: "/" },
    { title: "統一查看" },
    { title: "人事費報表" },
  ],

  // 系統管理
  "/categories": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "分類管理" },
  ],
  "/category-management": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "固定分類管理" },
  ],
  "/project-specific-items": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "專案專屬項目管理" },
  ],
  "/unified-project-template-management": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "統一專案模板管理" },
  ],
  "/project-template-management": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "專案分類模板管理" },
  ],
  "/user-management": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "用戶管理" },
  ],
  "/recycle-bin": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "回收站" },
  ],
  "/settings": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "設定" },
  ],
  "/account": [
    { title: "首頁", href: "/" },
    { title: "系統管理" },
    { title: "帳戶設定" },
  ],

  // 其他
  "/unified-payment": [
    { title: "首頁", href: "/" },
    { title: "統一付款" },
  ],
  "/features": [
    { title: "首頁", href: "/" },
    { title: "功能展示" },
  ],
};

// 根據路徑獲取麵包屑
export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // 直接匹配
  if (breadcrumbConfig[pathname]) {
    return breadcrumbConfig[pathname];
  }

  // 處理動態路由（如 /contract/:id）
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "contract" && segments[1]) {
    return [
      { title: "首頁", href: "/" },
      { title: "合約詳情" },
    ];
  }

  // 預設回傳首頁
  return [{ title: "首頁" }];
}

// 根據路徑獲取頁面標題
export function getPageTitle(pathname: string): string {
  const breadcrumbs = getBreadcrumbs(pathname);
  return breadcrumbs[breadcrumbs.length - 1]?.title || "首頁";
}

// 扁平化所有導航項目，用於快速查找
export const allNavItems: NavItem[] = navigationCategories.flatMap(
  (category) => category.items
);

// 根據路徑查找導航項目
export function findNavItem(href: string): NavItem | undefined {
  return allNavItems.find((item) => item.href === href);
}
