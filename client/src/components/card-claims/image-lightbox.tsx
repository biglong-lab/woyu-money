/**
 * ImageLightbox — 圖片浮出顯示（點背景或 X 關閉、ESC 關閉）
 * 取代開新分頁，方便看完直接關回原頁。
 */
import { useEffect } from "react"
import { X } from "lucide-react"

export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    // 鎖背景捲動
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="關閉"
        onClick={onClose}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30"
      >
        <X className="h-6 w-6" />
      </button>
      {/* 圖片本身點擊不關閉、避免誤觸 */}
      <img
        src={src}
        alt="收據"
        className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-xs">
        點背景或右上角 ✕ 關閉
      </div>
    </div>
  )
}
