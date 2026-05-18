/**
 * 浮動「返回頂端」按鈕
 *
 * 滾動超過閾值（預設 400px）才出現、固定右下、平滑滾回頂端
 * 用於長頁面（dashboard、forecast、scenario）
 */
import { useEffect, useState } from "react"
import { ChevronUp } from "lucide-react"

interface BackToTopProps {
  threshold?: number
}

export function BackToTop({ threshold = 400 }: BackToTopProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > threshold)
    }
    onScroll() // 初次掛載時檢查（refresh 後仍在中段時也要顯示）
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [threshold])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="回到頂端"
      className="fixed bottom-20 right-4 z-40 h-11 w-11 rounded-full bg-white border border-gray-300 shadow-lg
                 hover:shadow-xl hover:border-blue-400 hover:bg-blue-50 transition-all
                 flex items-center justify-center text-gray-700 hover:text-blue-600
                 sm:bottom-6 sm:right-6"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  )
}
