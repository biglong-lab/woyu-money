/**
 * 浮動「返回頂端」按鈕（含滾動進度環）
 *
 * 滾動超過閾值（預設 400px）才出現、固定右下、平滑滾回頂端
 * 外圈 SVG 環顯示目前頁面滾動進度（0~100%）
 * 用於長頁面（dashboard、forecast、scenario 等 35 頁）
 */
import { useEffect, useState } from "react"
import { ChevronUp } from "lucide-react"

interface BackToTopProps {
  threshold?: number
}

const RADIUS = 18
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function BackToTop({ threshold = 400 }: BackToTopProps) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const pct = docHeight > 0 ? Math.min(1, Math.max(0, scrollY / docHeight)) : 0
      setVisible(scrollY > threshold)
      setProgress(pct)
    }
    onScroll() // 初次掛載時檢查（refresh 後仍在中段時也要顯示）
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [threshold])

  if (!visible) return null

  const dashOffset = CIRCUMFERENCE * (1 - progress)
  const pctLabel = Math.round(progress * 100)

  const handleClick = () => {
    // 觸覺回饋（Android Chrome 支援、iOS Safari silently no-op）
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(10)
      } catch {
        // 部分瀏覽器 throw、忽略即可
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`回到頂端（已捲動 ${pctLabel}%）`}
      title={`回到頂端（${pctLabel}%）`}
      className="fixed bottom-20 right-4 z-40 h-11 w-11 rounded-full bg-white border border-gray-300 shadow-lg
                 hover:shadow-xl hover:border-blue-400 hover:bg-blue-50 transition-all
                 flex items-center justify-center text-gray-700 hover:text-blue-600
                 sm:bottom-6 sm:right-6 relative"
    >
      {/* 滾動進度環 */}
      <svg
        className="absolute inset-0 -rotate-90 pointer-events-none"
        viewBox="0 0 44 44"
        aria-hidden="true"
      >
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="text-blue-500 transition-[stroke-dashoffset] duration-150"
        />
      </svg>
      <ChevronUp className="h-5 w-5 relative" />
    </button>
  )
}
