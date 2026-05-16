/**
 * PWA 安裝引導 banner
 *
 * 兩個分支：
 *   Android Chrome：beforeinstallprompt 事件 → 自訂安裝按鈕
 *   iOS Safari：不支援 beforeinstallprompt → 顯示「加入主畫面」步驟引導
 *
 * 顯示時機：
 *   - 使用者未安裝（display !== "standalone"）
 *   - 不在 7 天的 dismiss cool-down 期內（localStorage）
 *
 * Dismiss 行為：localStorage 記時間、7 天內不再顯示
 */
import { useEffect, useState } from "react"
import { Download, X, Plus, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const DISMISS_KEY = "pwa-install-dismissed-at"
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 天

// BeforeInstallPromptEvent 不在標準 TS lib 中、自己宣告
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

type Platform = "android-chrome" | "ios-safari" | "other"

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other"
  const ua = navigator.userAgent.toLowerCase()
  const isIos =
    /ipad|iphone|ipod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const isSafari = /safari/.test(ua) && !/chrome|crios|fxios/.test(ua)
  if (isIos && isSafari) return "ios-safari"
  if (/android/.test(ua) && /chrome|crios/.test(ua)) return "android-chrome"
  return "other"
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  // Android / desktop
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true
  // iOS
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true
  return false
}

function isDismissedRecently(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return false
    return Date.now() - parseInt(ts, 10) < DISMISS_COOLDOWN_MS
  } catch {
    return false
  }
}

function setDismissedNow() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* 忽略 */
  }
}

export function PwaInstallPrompt() {
  const [show, setShow] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform] = useState<Platform>(() => detectPlatform())
  const [showIosGuide, setShowIosGuide] = useState(false)

  useEffect(() => {
    // 已安裝或最近關閉過 → 不顯示
    if (isStandalone() || isDismissedRecently()) return

    // Android Chrome：監聽 beforeinstallprompt
    if (platform === "android-chrome") {
      const handler = (e: Event) => {
        e.preventDefault()
        setInstallEvent(e as BeforeInstallPromptEvent)
        setShow(true)
      }
      window.addEventListener("beforeinstallprompt", handler)
      return () => window.removeEventListener("beforeinstallprompt", handler)
    }

    // iOS Safari：延遲 3 秒顯示（避免一進站就跳）
    if (platform === "ios-safari") {
      const timer = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [platform])

  const handleAndroidInstall = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === "accepted") {
      setShow(false)
    } else {
      setDismissedNow()
      setShow(false)
    }
  }

  const handleDismiss = () => {
    setDismissedNow()
    setShow(false)
    setShowIosGuide(false)
  }

  if (!show) return null

  // iOS：顯示步驟引導
  if (platform === "ios-safari") {
    if (showIosGuide) {
      return (
        <div className="fixed inset-x-0 bottom-0 z-[200] p-3 md:p-4 pb-safe pointer-events-none">
          <div className="max-w-md mx-auto bg-white border border-blue-200 rounded-2xl shadow-2xl p-4 pointer-events-auto">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-gray-900">加入主畫面 — 3 步驟</h3>
              <button onClick={handleDismiss} className="p-1 -m-1">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex items-center gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <span>
                  點下方工具列的
                  <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-gray-100 rounded text-blue-600 font-medium">
                    <Share2 className="w-3.5 h-3.5 mr-0.5" />
                    分享
                  </span>
                  按鈕
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <span>選「加入主畫面」</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <span>右上角點「加入」完成</span>
              </li>
            </ol>
            <div className="mt-4 p-2 bg-blue-50 rounded-lg text-xs text-blue-800">
              💡 安裝後可全螢幕使用、桌面 icon 一鍵開啟、體驗如 native app
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="fixed inset-x-0 bottom-0 z-[200] p-3 md:p-4 pb-safe pointer-events-none">
        <div className="max-w-md mx-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl shadow-2xl p-4 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">加到主畫面、開啟更快</div>
              <div className="text-xs text-blue-100">桌面 icon 一鍵開、全螢幕無瀏覽器</div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-9 bg-white text-blue-700 hover:bg-blue-50"
              onClick={() => setShowIosGuide(true)}
            >
              看怎麼裝
            </Button>
            <button
              onClick={handleDismiss}
              className="p-1 -m-1 text-blue-100 hover:text-white"
              aria-label="關閉"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Android：自訂安裝 banner
  return (
    <div className="fixed inset-x-0 bottom-0 z-[200] p-3 md:p-4 pb-safe pointer-events-none">
      <div className="max-w-md mx-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl shadow-2xl p-4 pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">安裝浯島財務 App</div>
            <div className="text-xs text-blue-100">桌面 icon、全螢幕、更快開啟</div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-9 bg-white text-blue-700 hover:bg-blue-50"
            onClick={handleAndroidInstall}
          >
            安裝
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1 -m-1 text-blue-100 hover:text-white"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
