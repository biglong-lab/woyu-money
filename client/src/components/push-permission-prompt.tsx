/**
 * Push 通知授權引導
 *
 * 顯示時機：
 *   - 瀏覽器支援 Push API
 *   - VAPID 已設定（GET /api/push/public-key 不回 503）
 *   - 使用者未授權過（Notification.permission === "default"）
 *   - 不在 dismiss cool-down 期內（30 天）
 *   - 使用者已登入
 *   - 已 PWA 安裝後（display-mode: standalone）效果最好，但網頁也可用
 *
 * 觸發點：手動點按鈕，不主動跳（避免打擾）
 */
import { useEffect, useState } from "react"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"

const DISMISS_KEY = "push-permission-dismissed-at"
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000 // 30 天

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

export function PushPermissionPrompt() {
  const { toast } = useToast()
  const [show, setShow] = useState(false)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    if (Notification.permission !== "default") return

    try {
      const ts = localStorage.getItem(DISMISS_KEY)
      if (ts && Date.now() - parseInt(ts, 10) < DISMISS_COOLDOWN_MS) return
    } catch {
      /* 忽略 */
    }

    // 檢查後端 VAPID 是否已設定
    fetch("/api/push/public-key")
      .then((res) => {
        if (res.ok) {
          // 延遲 5 秒顯示（不打斷剛進站使用者）
          setTimeout(() => setShow(true), 5000)
        }
      })
      .catch(() => {})
  }, [])

  const handleEnable = async () => {
    setWorking(true)
    try {
      // 1. 取 VAPID public key
      const keyRes = await fetch("/api/push/public-key")
      if (!keyRes.ok) throw new Error("無法取得 VAPID 金鑰")
      const { publicKey } = await keyRes.json()

      // 2. 註冊 SW（如果還沒）並取 registration
      const registration = await navigator.serviceWorker.ready

      // 3. 訂閱
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      // 4. 把 subscription 送到後端
      await apiRequest("POST", "/api/push/subscribe", subscription.toJSON())

      toast({
        title: "✅ 已開啟通知",
        description: "重要事件（到期、辨識完成、滯納警示）會推送給你",
      })
      setShow(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知錯誤"
      if (Notification.permission === "denied") {
        toast({
          title: "通知已被拒絕",
          description: "請到瀏覽器設定中重新啟用",
          variant: "destructive",
        })
      } else {
        toast({
          title: "開啟通知失敗",
          description: msg,
          variant: "destructive",
        })
      }
      setShow(false)
    } finally {
      setWorking(false)
    }
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* 忽略 */
    }
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-x-0 bottom-20 md:bottom-4 z-[199] p-3 md:p-4 pointer-events-none">
      <div className="max-w-md mx-auto bg-white border border-amber-200 rounded-2xl shadow-2xl p-4 pointer-events-auto">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900">開啟通知，重要事件不漏掉</div>
            <div className="text-xs text-gray-600 mt-1">
              • 帳款到期前提醒
              <br />
              • AI 辨識完成通知
              <br />• 勞健保滯納警示
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleEnable} disabled={working}>
                {working ? "處理中..." : "開啟通知"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDismiss} disabled={working}>
                稍後
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 -m-1 text-gray-400 hover:text-gray-600"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
