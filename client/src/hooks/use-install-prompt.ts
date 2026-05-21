/**
 * PWA Install Prompt Hook
 *
 * 偵測 beforeinstallprompt event、暴露「安裝中」狀態與 prompt 函式。
 * 用法：
 *   const { canInstall, isInstalled, install } = useInstallPrompt()
 *   {canInstall && <button onClick={install}>📱 安裝</button>}
 *
 * iOS Safari 不支援 beforeinstallprompt、但仍可手動分享 → 加到主畫面。
 * canInstall=false 不等於不能裝、僅代表瀏覽器沒給我們事件。
 */
import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // 偵測是否已安裝（standalone display mode）
    const mq = window.matchMedia("(display-mode: standalone)")
    setIsInstalled(mq.matches || (navigator as { standalone?: boolean }).standalone === true)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)

    const installedHandler = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener("appinstalled", installedHandler)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      window.removeEventListener("appinstalled", installedHandler)
    }
  }, [])

  const install = async () => {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === "accepted") {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
    return choice.outcome === "accepted"
  }

  return {
    canInstall: !isInstalled && deferredPrompt !== null,
    isInstalled,
    install,
  }
}
