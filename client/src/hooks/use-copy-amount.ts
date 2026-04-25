/**
 * 一鍵複製金額 hook
 *
 * 用途：使用者開啟網銀準備轉帳時，點擊頁面金額即可複製純數字
 * 設計：
 * - 複製數字不含 NT$ 前綴（網銀只接受純數字）
 * - 整數化（網銀不接受小數點）
 * - 顯示 toast 確認 1.5 秒
 */

import { useToast } from "@/hooks/use-toast"

function formatNT(n: number): string {
  return `NT$ ${Math.round(n).toLocaleString()}`
}

export function useCopyAmount() {
  const { toast } = useToast()

  return async (amount: number, label?: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(String(Math.round(amount)))
      toast({
        title: "已複製金額",
        description: label ? `${label}：${formatNT(amount)}` : formatNT(amount),
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
