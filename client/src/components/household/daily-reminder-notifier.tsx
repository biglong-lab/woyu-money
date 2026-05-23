/**
 * DailyReminderNotifier — 每日記帳提醒
 *
 * 邏輯：
 *  - 每 10 分鐘輪詢 /api/household/streak
 *  - 若 isOnFireToday === false（今天還沒記）+ 過了 21:00 + 今日尚未提醒 → 發 Notification
 *  - 用 localStorage `household-reminder-sent-{YYYY-MM-DD}` 紀錄、避免重複提醒
 *  - 第一次掛載要求 Notification 權限（一次）
 *  - 不支援 Notification 的瀏覽器自動 silent fail
 *
 * 為什麼不用 Service Worker push：
 *  - SW push 需 VAPID + DB subscription、部署成本高
 *  - 此實作只在使用者開頁時提醒、夠用於 80% 場景且零部署成本
 *  - 已有 BudgetOverrunNotifier 採同樣策略
 */
import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"

interface StreakResponse {
  current: number
  longest: number
  lastRecordDate: string | null
  daysActive: number
  isOnFireToday: boolean
}

const REMIND_HOUR = 21 // 21:00 開始提醒
const POLL_MS = 10 * 60 * 1000

function todayKey(): string {
  const d = new Date()
  return `household-reminder-sent-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function DailyReminderNotifier() {
  const askedRef = useRef(false)

  // 首次掛載要求權限（一次、不打擾）
  useEffect(() => {
    if (askedRef.current) return
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission === "default") {
      askedRef.current = true
      // 延遲 5 秒詢問、避免使用者剛進站被嚇到
      const t = setTimeout(() => {
        Notification.requestPermission().catch(() => {
          /* 拒絕 → 不再問 */
        })
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [])

  const { data } = useQuery<StreakResponse>({
    queryKey: ["/api/household/streak"],
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
  })

  useEffect(() => {
    if (!data) return
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "granted") return
    if (data.isOnFireToday) return // 今天已記、不提醒

    const now = new Date()
    if (now.getHours() < REMIND_HOUR) return // 還沒到 21:00

    const key = todayKey()
    try {
      if (window.localStorage.getItem(key)) return // 今天提醒過了
    } catch {
      /* quota / disabled */
    }

    try {
      const streakHint =
        data.current > 0
          ? `🔥 別中斷你連續 ${data.current} 天的記錄！`
          : "養成記帳習慣、從今天開始 💪"
      new Notification("✏️ 今天還沒記帳哦", {
        body: streakHint,
        tag: "household-daily-reminder",
        icon: "/icon.svg",
      })
      window.localStorage.setItem(key, String(Date.now()))
    } catch {
      /* background tab notification 可能失敗 */
    }
  }, [data])

  return null
}
