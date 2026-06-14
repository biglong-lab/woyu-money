/**
 * PullToRefresh — 下拉重新整理（PWA / 手機）
 *
 * standalone PWA 會停用瀏覽器原生下拉重整，這裡自製：
 * 在頁面頂端下拉超過門檻 → 重新抓取所有 react-query 資料（不整頁重載、不丟 SPA 狀態）。
 * 只在觸控裝置作用；非頂端或上滑不觸發。
 */
import { useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { queryClient } from "@/lib/queryClient"

const THRESHOLD = 70 // 觸發門檻 px
const MAX_PULL = 110 // 最大下拉視覺距離

export function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // 用 ref 鏡射狀態，避免重綁監聽
  const startY = useRef(0)
  const active = useRef(false)
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    pullRef.current = pull
  }, [pull])
  useEffect(() => {
    refreshingRef.current = refreshing
  }, [refreshing])

  useEffect(() => {
    // 僅觸控裝置啟用
    if (typeof window === "undefined" || !("ontouchstart" in window)) return

    function onStart(e: TouchEvent) {
      if (refreshingRef.current) return
      if (window.scrollY > 0) {
        active.current = false
        return
      }
      startY.current = e.touches[0].clientY
      active.current = true
    }

    function onMove(e: TouchEvent) {
      if (!active.current || refreshingRef.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current !== 0) setPull(0)
        active.current = window.scrollY === 0 && dy <= 0 ? active.current : false
        return
      }
      // 阻止原生 overscroll（只在頂端下拉時），避免瀏覽器自己的下拉重整
      if (e.cancelable) e.preventDefault()
      setPull(Math.min(MAX_PULL, dy * 0.5))
    }

    async function onEnd() {
      if (!active.current) return
      active.current = false
      if (pullRef.current >= THRESHOLD && !refreshingRef.current) {
        setRefreshing(true)
        setPull(THRESHOLD)
        try {
          await queryClient.invalidateQueries()
        } catch {
          /* ignore */
        } finally {
          window.setTimeout(() => {
            setRefreshing(false)
            setPull(0)
          }, 500)
        }
      } else {
        setPull(0)
      }
    }

    // touchmove 需 non-passive 才能 preventDefault
    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchmove", onMove, { passive: false })
    window.addEventListener("touchend", onEnd)
    window.addEventListener("touchcancel", onEnd)
    return () => {
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend", onEnd)
      window.removeEventListener("touchcancel", onEnd)
    }
  }, [])

  const visible = pull > 0 || refreshing
  const progress = Math.min(1, pull / THRESHOLD)
  const ready = pull >= THRESHOLD

  if (!visible) return null

  return (
    <div
      className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{
        top: 0,
        transform: `translateY(${pull}px)`,
        transition: refreshing ? "transform 0.2s" : "none",
      }}
    >
      <div className="mt-2 rounded-full bg-background shadow-md border h-9 w-9 flex items-center justify-center">
        <RefreshCw
          className={`h-5 w-5 text-indigo-600 ${refreshing ? "animate-spin" : ""}`}
          style={{
            transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
            opacity: ready || refreshing ? 1 : 0.5,
          }}
        />
      </div>
    </div>
  )
}
