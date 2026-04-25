/**
 * 一鍵複製金額 hook
 *
 * 用途：使用者開啟網銀準備轉帳時，點擊頁面金額即可複製純數字
 * 設計：
 * - 複製數字不含 NT$ 前綴（網銀只接受純數字）
 * - 整數化（網銀不接受小數點）
 * - 0 不複製（沒意義），跳出友善提示
 * - 負值（赤字/虧損）複製絕對值並標示為赤字
 * - 顯示 toast 確認 1.5 秒
 */

import { useToast } from "@/hooks/use-toast"

function formatNT(n: number): string {
  return `NT$ ${Math.round(n).toLocaleString()}`
}

export function useCopyAmount() {
  const { toast } = useToast()

  return async (amount: number, label?: string): Promise<void> => {
    const rounded = Math.round(amount)

    // 金額為 0 或非有效數字：不複製，給友善提示
    if (!Number.isFinite(rounded) || rounded === 0) {
      toast({
        title: "金額為 0",
        description: label ? `「${label}」沒有金額可複製` : "沒有金額可複製",
        duration: 1500,
      })
      return
    }

    // 負值（赤字/虧損）：複製絕對值，標示赤字以避免誤解
    const isNegative = rounded < 0
    const copyValue = Math.abs(rounded)

    try {
      await navigator.clipboard.writeText(String(copyValue))
      toast({
        title: isNegative ? "已複製赤字金額" : "已複製金額",
        description: label
          ? `${label}：${isNegative ? "赤字 " : ""}${formatNT(copyValue)}`
          : `${isNegative ? "赤字 " : ""}${formatNT(copyValue)}`,
        duration: 1500,
      })
    } catch {
      toast({
        title: "複製失敗",
        description: "瀏覽器不支援，請手動輸入",
        variant: "destructive",
      })
    }
  }
}
