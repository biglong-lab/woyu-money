/**
 * PWA 更新提示
 *
 * 當 service worker 偵測到新版時，跳出 banner 讓使用者選「重新整理」。
 * 不自動 reload（避免使用者正在輸入資料時被打斷）。
 *
 * 也處理 offline ready 提示（第一次安裝完成、現在可離線使用）。
 */
import { useEffect, useState } from "react"
import { RefreshCw, X, Wifi } from "lucide-react"
import { Button } from "@/components/ui/button"

// 由 vite-plugin-pwa 注入的 virtual module
// 開發時不存在、build 後才有
export function PwaUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    // dynamic import 避免 dev 環境 build error（virtual module 只在 build 後存在）
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        const update = registerSW({
          immediate: false,
          onNeedRefresh() {
            setNeedRefresh(true)
          },
          onOfflineReady() {
            setOfflineReady(true)
            // 5 秒後自動關掉「離線就緒」訊息
            setTimeout(() => setOfflineReady(false), 5000)
          },
          onRegisterError(err: unknown) {
            console.warn("[PWA] SW register failed:", err)
          },
        })
        setUpdateSW(() => update)
      })
      .catch((err) => {
        // dev 環境會走到這（virtual:pwa-register 不存在），靜默
        if (import.meta.env.PROD) {
          console.warn("[PWA] register import failed:", err)
        }
      })
  }, [])

  const handleRefresh = async () => {
    if (updateSW) {
      await updateSW(true)
    } else {
      window.location.reload()
    }
  }

  if (needRefresh) {
    return (
      <div className="fixed top-4 right-4 z-[200] max-w-sm pointer-events-none">
        <div className="bg-blue-600 text-white rounded-lg shadow-2xl p-3 flex items-center gap-3 pointer-events-auto animate-in slide-in-from-top-4">
          <RefreshCw className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <div className="font-semibold">系統有新版可用</div>
            <div className="text-xs text-blue-100">點「重新整理」載入最新功能</div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 bg-white text-blue-700 hover:bg-blue-50"
            onClick={handleRefresh}
          >
            重新整理
          </Button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="p-1 -m-1 text-blue-100 hover:text-white"
            aria-label="稍後"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  if (offlineReady) {
    return (
      <div className="fixed top-4 right-4 z-[200] max-w-sm pointer-events-none">
        <div className="bg-green-600 text-white rounded-lg shadow-2xl p-3 flex items-center gap-3 pointer-events-auto animate-in slide-in-from-top-4">
          <Wifi className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <div className="font-semibold">離線可用</div>
            <div className="text-xs text-green-100">沒網路也可看資料</div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
