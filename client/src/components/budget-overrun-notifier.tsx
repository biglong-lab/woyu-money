/**
 * BudgetOverrunNotifier — 客戶端輪詢 + 瀏覽器原生通知
 *
 * 策略：
 *  - 每 5 分鐘抓 /api/dashboard/pm-pending-summary + /api/budget/overrun-alerts
 *  - 比對 localStorage 已通知過的 item id、只通知新出現的
 *  - 使用 Web Notification API（純前端、無需 VAPID / server push）
 *  - 第一次掛載時請求授權、被拒絕則靜默
 *
 * 為什麼不用 Service Worker push：
 *  - SW push 需要 VAPID 私鑰 + web-push lib + DB 存 subscription，
 *    部署成本高、且使用者要主動許可才有效
 *  - 此實作只在使用者開著頁時通知、足夠 80% 場景且零部署風險
 */
import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"

const NOTIFIED_KEY = "budget-overrun-notified-v1"
const POLL_MS = 5 * 60 * 1000 // 5 分鐘

interface OverrunItem {
  itemId: number
  itemName: string
  planName: string
  usagePct: number
  severity: "warn" | "over" | "danger"
}

interface OverrunResponse {
  items: OverrunItem[]
  dangerCount: number
  overCount: number
  warnCount: number
}

function getNotified(): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "{}")
  } catch {
    return {}
  }
}

function setNotified(map: Record<number, string>): void {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map))
  } catch {
    /* quota / disabled */
  }
}

export function BudgetOverrunNotifier() {
  const askedRef = useRef(false)

  // 掛載時請求授權（一次）
  useEffect(() => {
    if (askedRef.current) return
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission === "default") {
      askedRef.current = true
      Notification.requestPermission().catch(() => {
        /* 被拒、無動作 */
      })
    }
  }, [])

  // 輪詢 overrun-alerts
  const { data } = useQuery<OverrunResponse>({
    queryKey: ["/api/budget/overrun-alerts"],
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
  })

  // 比較新出現的 item、觸發通知
  useEffect(() => {
    if (!data || !data.items || data.items.length === 0) return
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "granted") return

    const notified = getNotified()
    const next: Record<number, string> = { ...notified }
    let newAlertCount = 0

    for (const item of data.items) {
      const key = item.itemId
      const sigCurr = `${item.severity}-${item.usagePct}`
      const sigLast = notified[key]
      // 只在「沒通知過」或「severity 升級了」時通知
      if (sigLast !== sigCurr) {
        const upgrade =
          (sigLast?.startsWith("warn") && item.severity !== "warn") ||
          (sigLast?.startsWith("over") && item.severity === "danger") ||
          !sigLast
        if (upgrade) {
          const emoji = item.severity === "danger" ? "🚨" : item.severity === "over" ? "⚠️" : "⏳"
          const sevText =
            item.severity === "danger"
              ? "超支 20%+"
              : item.severity === "over"
                ? "已超支"
                : "接近超支"
          try {
            new Notification(`${emoji} 預算${sevText}`, {
              body: `${item.planName} · ${item.itemName} 已達 ${item.usagePct}%`,
              tag: `budget-overrun-${item.itemId}`,
              icon: "/icon.svg",
            })
            newAlertCount++
          } catch {
            /* 通知失敗（如 background） */
          }
        }
        next[key] = sigCurr
      }
    }

    if (newAlertCount > 0) {
      setNotified(next)
    }
  }, [data])

  return null
}
