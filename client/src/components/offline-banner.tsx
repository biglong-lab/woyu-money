/**
 * OfflineBanner - 離線提示橫幅
 *
 * 顯示在頁面頂部 sticky bar，當網路斷線時提醒
 * 避免使用者操作後困惑「為什麼沒反應」
 */
import { WifiOff } from "lucide-react"
import { useOnlineStatus } from "@/hooks/use-online-status"

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      className="sticky top-0 z-50 bg-amber-100 border-b border-amber-300 text-amber-900 px-3 py-1.5 text-xs sm:text-sm flex items-center justify-center gap-2"
      data-testid="offline-banner"
    >
      <WifiOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
      <span>目前離線中，操作可能無法儲存。等網路恢復後再試。</span>
    </div>
  )
}
