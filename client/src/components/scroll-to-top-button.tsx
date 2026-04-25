/**
 * ScrollToTopButton - 滾動回頂部按鈕
 *
 * 當頁面捲動超過 400px 時，於右下角顯示回頂部按鈕。
 * 行動版位於 Tab Bar 上方，桌面版位於 FAB 上方。
 */
import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

const SHOW_THRESHOLD = 400

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > SHOW_THRESHOLD)
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="回到頂部"
      title="回到頂部"
      className={cn(
        "fixed bottom-20 md:bottom-24 right-4 z-40",
        "w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm",
        "border border-gray-200 shadow-lg",
        "flex items-center justify-center",
        "text-gray-700 hover:text-blue-600 hover:bg-white",
        "transition-all duration-200",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-2 pointer-events-none"
      )}
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  )
}

export default ScrollToTopButton
