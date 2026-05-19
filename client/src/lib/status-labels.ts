/**
 * 付款 / 文件 / 訂單狀態的中文顯示對照
 * 給整個前端統一用、避免英文 unpaid / pending 直接外露
 */
export const STATUS_LABEL_MAP: Record<string, string> = {
  // payment_items
  paid: "已付",
  unpaid: "未付",
  pending: "待處理",
  overdue: "逾期",
  partial: "部分付款",
  completed: "完成",
  canceled: "已取消",
  cancelled: "已取消",
  // document_inbox / scan
  uploaded: "已上傳",
  parsed: "已辨識",
  reviewing: "審核中",
  archived: "已歸檔",
  rejected: "已駁回",
  // generic
  active: "啟用",
  inactive: "停用",
  draft: "草稿",
}

export function formatStatus(s: string | null | undefined): string {
  if (!s) return "—"
  return STATUS_LABEL_MAP[String(s).toLowerCase()] ?? s
}

/** 給 badge / text color 用 — 是否「完成 / 已付」狀態 */
export function isCompletedStatus(s: string | null | undefined): boolean {
  if (!s) return false
  return ["paid", "completed", "archived"].includes(String(s).toLowerCase())
}

/** 是否「警告 / 待處理」狀態 */
export function isWarningStatus(s: string | null | undefined): boolean {
  if (!s) return false
  return ["overdue", "rejected"].includes(String(s).toLowerCase())
}
