/**
 * 信用卡請款 — 共用型別與工具
 */
export interface Option {
  id: number
  name: string
  isActive: boolean
}
export interface BankOption extends Option {
  feeRate?: string // 手續費率 %
}
export interface Claim {
  id: number
  amount: string
  swipeDate: string
  bank: string | null
  tagId: number | null
  propertyId: number | null
  status: string
  settledAmount: string | null
  settledDate: string | null
  receiptImageUrl: string | null
  notes: string | null
  tagName: string | null
  propertyName: string | null
  propertyIds: number[]
  propertyNames: string[]
}

export const STATUS_OPTIONS = [
  { value: "pending", label: "待請款", color: "bg-amber-100 text-amber-800" },
  { value: "claimed", label: "已請款", color: "bg-blue-100 text-blue-800" },
  { value: "settled", label: "已到帳", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "已取消", color: "bg-gray-100 text-gray-600" },
] as const

export const statusMeta = (s: string) =>
  STATUS_OPTIONS.find((o) => o.value === s) ?? STATUS_OPTIONS[0]

export const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** 由銀行名稱取手續費率（%） */
export function feeRateOf(bankName: string | null, banks: BankOption[]): number {
  if (!bankName) return 0
  const b = banks.find((x) => x.name === bankName)
  return b ? parseFloat(b.feeRate ?? "0") || 0 : 0
}

/** 預估到帳金額 = 金額 × (1 − 手續費率%) */
export function expectedSettlement(amount: number, feeRate: number): number {
  return Math.round(amount * (1 - feeRate / 100) * 100) / 100
}
