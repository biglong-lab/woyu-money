/**
 * 歷史欠款整理 — 共用型別與工具
 */
export interface Category {
  id: number
  name: string
  isActive: boolean
}

export interface Debt {
  id: number
  amount: string
  categoryId: number | null
  creditor: string | null
  incurDate: string | null
  dueDate: string | null
  status: string
  accountCode: string | null
  reconciledAt: string | null
  note: string | null
  receiptImageUrl: string | null
  createdAt: string | null
  updatedAt: string | null
  categoryName: string | null
  paidAmount: number
  remainingAmount: number
  paymentStatus: "unpaid" | "partial" | "paid"
  paymentCount: number
}

export interface DebtPayment {
  id: number
  debtId: number
  amount: string
  payDate: string
  method: string | null
  note: string | null
  receiptImageUrl: string | null
  createdAt: string | null
}

export interface DebtSummary {
  totalDebt: number
  totalPaid: number
  totalRemaining: number
  totalCount: number
  byCategory: Array<{
    categoryId: number | null
    categoryName: string | null
    total: number
    paid: number
    remaining: number
    count: number
  }>
  byStatus: Array<{ status: string; count: number; remaining: number }>
}

// 生命週期狀態
export const STATUS_OPTIONS = [
  { value: "open", label: "處理中", color: "bg-amber-100 text-amber-800" },
  { value: "reconciled", label: "已歸帳", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "作廢", color: "bg-gray-100 text-gray-500" },
] as const

export const statusMeta = (s: string) =>
  STATUS_OPTIONS.find((o) => o.value === s) ?? STATUS_OPTIONS[0]

// 還款進度
export const PAYMENT_STATUS_META: Record<Debt["paymentStatus"], { label: string; color: string }> =
  {
    unpaid: { label: "未還", color: "bg-red-100 text-red-700" },
    partial: { label: "部分還款", color: "bg-blue-100 text-blue-700" },
    paid: { label: "已還清", color: "bg-green-100 text-green-700" },
  }

export const PAY_METHODS = ["現金", "銀行轉帳", "信用卡", "支票", "其他"] as const

export const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
}

/** 是否逾期（有到期日且未還清且過期） */
export function isOverdue(debt: Debt): boolean {
  if (!debt.dueDate || debt.paymentStatus === "paid" || debt.status === "cancelled") return false
  return debt.dueDate < ymd(new Date())
}

/** 上傳單據圖片，回傳本地 URL */
export async function uploadReceipt(file: File): Promise<string> {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" })
  if (!res.ok) throw new Error((await res.text()) || "上傳失敗")
  const data = (await res.json()) as { url: string }
  return data.url
}
