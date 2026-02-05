// 專案預算管理共用工具函式

/**
 * 格式化貨幣為新台幣格式
 */
export function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num || 0);
}

/**
 * 取得狀態對應的 CSS 顏色類別
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "over_budget":
      return "bg-red-100 text-red-800";
    case "cancelled":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * 取得狀態對應的中文標籤
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "進行中";
    case "completed":
      return "已完成";
    case "over_budget":
      return "超出預算";
    case "cancelled":
      return "已取消";
    default:
      return status;
  }
}

/**
 * 取得優先級對應的 CSS 顏色類別
 */
export function getPriorityColor(priority: number): string {
  switch (priority) {
    case 1:
      return "bg-red-100 text-red-800";
    case 2:
      return "bg-yellow-100 text-yellow-800";
    case 3:
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * 取得優先級對應的中文標籤
 */
export function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 1:
      return "高";
    case 2:
      return "中";
    case 3:
      return "低";
    default:
      return "中";
  }
}
