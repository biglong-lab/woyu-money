/**
 * KeyboardShortcutsDialog - 鍵盤快捷鍵說明面板
 *
 * 全域監聽 `?` 鍵（不在 input/textarea 中時）開啟說明
 * 為 power user 提供快速查看快捷鍵的方式
 */
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Keyboard } from "lucide-react"

interface ShortcutItem {
  keys: string[]
  description: string
  context?: string
}

const SHORTCUTS: ShortcutItem[] = [
  // 全域導航
  { keys: ["?"], description: "顯示鍵盤快捷鍵", context: "全域" },
  { keys: ["/"], description: "聚焦首頁搜尋", context: "首頁" },
  { keys: ["⌘", "K"], description: "聚焦財務總覽搜尋（Mac）", context: "財務總覽" },
  { keys: ["Ctrl", "K"], description: "聚焦財務總覽搜尋（Windows）", context: "財務總覽" },

  // 表單操作
  { keys: ["Enter"], description: "提交表單（必填都填妥時）", context: "表單" },
  { keys: ["Esc"], description: "清除搜尋 / 關閉 dialog", context: "表單/搜尋" },

  // 列表操作
  { keys: ["Enter"], description: "選第一個搜尋結果", context: "搜尋下拉" },
]

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 在 input/textarea 中時不攔截
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return

      // ? 鍵（Shift + /）
      if (e.key === "?") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-blue-600" />
            鍵盤快捷鍵
          </DialogTitle>
          <DialogDescription className="text-xs">
            按 <kbd className="px-1 py-0.5 bg-gray-100 border rounded text-[11px]">?</kbd>{" "}
            隨時開關此面板
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          {SHORTCUTS.map((shortcut, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 py-1.5 border-b last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900">{shortcut.description}</div>
                {shortcut.context && (
                  <div className="text-xs text-gray-400 mt-0.5">{shortcut.context}</div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                {shortcut.keys.map((key, j) => (
                  <kbd
                    key={j}
                    className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
