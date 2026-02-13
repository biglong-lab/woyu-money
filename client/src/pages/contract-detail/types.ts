/** 合約詳情頁面相關型別定義 */

/** 合約資料結構 */
export interface ContractData {
  id: number;
  projectId: number;
  contractName: string;
  startDate: string;
  endDate: string;
  totalYears: number;
  baseAmount: string;
  payeeName?: string;
  payeeUnit?: string;
  bankCode?: string;
  accountNumber?: string;
  contractPaymentDay?: number;
  isActive: boolean;
  notes?: string;
  projectName: string;
  createdAt: string;
  updatedAt?: string;
}

/** 價格階段結構 */
export interface PriceTier {
  yearStart: number;
  yearEnd: number;
  monthlyAmount: string;
}

/** 合約文件結構 */
export interface ContractDocument {
  id: number;
  originalName: string;
  notes?: string;
  fileSize: number;
  uploadedAt: string;
}

/** 付款項目結構 */
export interface PaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  paidAmount: string;
  startDate?: string;
  status: "paid" | "partial" | "pending";
  projectId: number;
}

/** 合約統計數據 */
export interface ContractStatistics {
  totalPaymentItems: number;
  paidItems: number;
  pendingItems: number;
  totalAmount: number;
  paidAmount: number;
}

/** 計算合約統計數據 */
export function calculateContractStatistics(
  paymentItems: PaymentItem[] | undefined
): ContractStatistics {
  const items = Array.isArray(paymentItems) ? paymentItems : [];

  return items.reduce(
    (acc, item) => ({
      totalPaymentItems: acc.totalPaymentItems + 1,
      paidItems: acc.paidItems + (item.status === "paid" ? 1 : 0),
      pendingItems: acc.pendingItems + (item.status === "pending" ? 1 : 0),
      totalAmount: acc.totalAmount + parseFloat(item.totalAmount || "0"),
      paidAmount: acc.paidAmount + parseFloat(item.paidAmount || "0"),
    }),
    {
      totalPaymentItems: 0,
      paidItems: 0,
      pendingItems: 0,
      totalAmount: 0,
      paidAmount: 0,
    }
  );
}
