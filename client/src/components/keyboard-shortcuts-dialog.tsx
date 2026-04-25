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
}

interface ShortcutGroup {
  title: string
  items: ShortcutItem[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "全域",
    items: [{ keys: ["?"], description: "顯示鍵盤快捷鍵（再按一次關閉）" }],
  },
  {
    title: "搜尋",
    items: [
      { keys: ["/"], description: "聚焦首頁搜尋" },
      { keys: ["⌘", "K"], description: "聚焦財務總覽搜尋（Mac）" },
      { keys: ["Ctrl", "K"], description: "聚焦財務總覽搜尋（Win）" },
      { keys: ["Esc"], description: "清除目前搜尋字串" },
      { keys: ["Enter"], description: "跳轉到第一個搜尋結果" },
    ],
  },
  {
    title: "表單",
    items: [
      { keys: ["Enter"], description: "送出表單（必填都填妥時）" },
      { keys: ["Esc"], description: "關閉 dialog" },
    ],
  },
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
        <div className="space-y-4 pt-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex-1 min-w-0 text-sm text-gray-900">
                      {shortcut.description}
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
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
