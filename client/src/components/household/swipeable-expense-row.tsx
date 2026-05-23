/**
 * SwipeableExpenseRow — 左右滑動操作 wrapper（手勢）
 *
 * - 左滑（向左拖）→ 露出右側「🗑️ 刪除」紅按鈕
 * - 右滑（向右拖）→ 露出左側「📋 複製」綠按鈕
 * - touch + mouse 都支援（觸控 / 滑鼠拖曳）
 * - 點外部或 row 中央自動彈回
 * - 純 React + CSS transform、無外部依賴
 *
 * 用法：
 *   <SwipeableExpenseRow onDelete={handleDelete} onDuplicate={handleDup}>
 *     <div>支出 row 內容</div>
 *   </SwipeableExpenseRow>
 */
import { useState, useRef, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Trash2, Copy } from "lucide-react"

const ACTION_THRESHOLD = 64 // 拖超過 64px 顯示 action
const MAX_OFFSET = 96 // 拖最多到 96px、不再加長
const SNAP_THRESHOLD = 32 // 鬆手時 < 32px 直接彈回

interface Props {
  children: React.ReactNode
  onDelete?: () => void
  onDuplicate?: () => void
  className?: string
  disabled?: boolean
}

export function SwipeableExpenseRow({
  children,
  onDelete,
  onDuplicate,
  className,
  disabled = false,
}: Props) {
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef<number | null>(null)
  const startOffsetRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const reset = useCallback(() => {
    setOffset(0)
    startXRef.current = null
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return
      // 忽略按鈕內部的點擊（讓內部按鈕能正常工作）
      const target = e.target as HTMLElement
      if (target.closest("button, a, input, select, textarea")) return
      startXRef.current = e.clientX
      startOffsetRef.current = offset
      setIsDragging(true)
    },
    [disabled, offset]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || startXRef.current === null) return
      const dx = e.clientX - startXRef.current
      let next = startOffsetRef.current + dx
      if (next > MAX_OFFSET) next = MAX_OFFSET
      if (next < -MAX_OFFSET) next = -MAX_OFFSET
      // 若沒對應 callback、不允許該方向位移
      if (next > 0 && !onDuplicate) next = 0
      if (next < 0 && !onDelete) next = 0
      setOffset(next)
    },
    [isDragging, onDelete, onDuplicate]
  )

  const onPointerUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    if (Math.abs(offset) < SNAP_THRESHOLD) {
      reset()
    } else if (offset >= ACTION_THRESHOLD) {
      setOffset(MAX_OFFSET) // 露出右滑（複製）
    } else if (offset <= -ACTION_THRESHOLD) {
      setOffset(-MAX_OFFSET) // 露出左滑（刪除）
    } else {
      reset()
    }
  }, [isDragging, offset, reset])

  // 點擊外部彈回
  useEffect(() => {
    if (offset === 0) return
    function onClickOutside(e: MouseEvent | TouchEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        reset()
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("touchstart", onClickOutside)
    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("touchstart", onClickOutside)
    }
  }, [offset, reset])

  const showDelete = offset < 0
  const showDuplicate = offset > 0
  const actionWidth = Math.min(Math.abs(offset), MAX_OFFSET)

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden rounded-lg", className)}
      data-testid="swipeable-expense-row"
    >
      {/* 左側「複製」action（右滑顯示）*/}
      {onDuplicate && (
        <button
          type="button"
          onClick={() => {
            onDuplicate()
            reset()
          }}
          className={cn(
            "absolute left-0 top-0 bottom-0 flex items-center justify-center bg-emerald-500 text-white",
            "transition-opacity",
            showDuplicate ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          style={{ width: actionWidth }}
          aria-label="複製為新一筆"
          data-testid="swipe-duplicate"
        >
          <div className="flex flex-col items-center gap-0.5 text-[10px]">
            <Copy className="w-4 h-4" />
            <span>複製</span>
          </div>
        </button>
      )}

      {/* 右側「刪除」action（左滑顯示）*/}
      {onDelete && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm("確定刪除這筆？")) {
              onDelete()
            }
            reset()
          }}
          className={cn(
            "absolute right-0 top-0 bottom-0 flex items-center justify-center bg-rose-500 text-white",
            "transition-opacity",
            showDelete ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          style={{ width: actionWidth }}
          aria-label="刪除"
          data-testid="swipe-delete"
        >
          <div className="flex flex-col items-center gap-0.5 text-[10px]">
            <Trash2 className="w-4 h-4" />
            <span>刪除</span>
          </div>
        </button>
      )}

      {/* 主內容、依 offset 平移 */}
      <div
        className="touch-pan-y bg-white"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease-out",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>

      {/* hint：左右拖箭頭、首次出現提示（hover 才顯示）*/}
      <div
        className="absolute inset-y-0 right-1 flex items-center pointer-events-none text-gray-300 text-[9px] opacity-0 group-hover:opacity-100"
        aria-hidden="true"
      >
        ← 滑
      </div>
    </div>
  )
}
