/**
 * CommandPalette - 全域快速跳轉（Cmd+K / Ctrl+K）
 *
 * 設計：
 * - 全域 hotkey 開啟（Cmd+K / Ctrl+K）
 * - 模糊搜尋所有導航項目（按 navigationCategories 分組顯示）
 * - 包含「快速動作」：拍單據、快速記帳、跳首頁
 * - Esc 關閉、↑↓ 選擇、Enter 跳轉
 * - 在 input/textarea/contentEditable 中不攔截，避免干擾打字
 * - 手機端：保留 hotkey 給外接鍵盤使用者；TopNavigation 可加按鈕觸發
 */
import { useEffect, useState, useCallback } from "react"
import { useLocation } from "wouter"
import { Home, Inbox, Search } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { navigationCategories } from "@/config/navigation"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [, setLocation] = useLocation()

  // 全域 hotkey
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 在 input/textarea/contentEditable 中時不攔截
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isEditing = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable === true

      // Cmd+K (mac) / Ctrl+K (win/linux)
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        // 在編輯區域內也要能用（瀏覽器原生 Cmd+K 是地址列、會被攔截）
        e.preventDefault()
        setOpen((prev) => !prev)
        return
      }

      // 不在編輯時，「/」也能開啟搜尋（Vim-style）
      if (!isEditing && e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setOpen(true)
      }
    }

    // CustomEvent 入口：讓 TopNavigation 的搜尋按鈕也能開啟
    const customHandler = () => setOpen(true)

    window.addEventListener("keydown", handler)
    window.addEventListener("open-command-palette", customHandler)
    return () => {
      window.removeEventListener("keydown", handler)
      window.removeEventListener("open-command-palette", customHandler)
    }
  }, [])

  const runCommand = useCallback((command: () => void) => {
    setOpen(false)
    // 延遲執行讓 dialog 關閉動畫先跑完，避免 focus 衝突
    setTimeout(command, 0)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="搜尋頁面或動作...（試試「現金分配」「滯納金」「拍單據」）" />
      <CommandList>
        <CommandEmpty>找不到符合的項目</CommandEmpty>

        {/* 高頻入口放最上 */}
        <CommandGroup heading="⚡ 高頻入口">
          <CommandItem
            onSelect={() => runCommand(() => setLocation("/"))}
            keywords={["home", "首頁", "今天的事", "今日焦點", "dashboard"]}
          >
            <Home className="mr-2 h-4 w-4 text-green-600" />
            <span>回首頁（今日焦點）</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setLocation("/document-inbox"))}
            keywords={["inbox", "單據", "收件箱", "上傳", "AI"]}
          >
            <Inbox className="mr-2 h-4 w-4 text-purple-600" />
            <span>單據收件箱（拍 / 上傳單據）</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* 按 navigationCategories 分組顯示 */}
        {navigationCategories.map((category) => (
          <CommandGroup key={category.title} heading={category.title}>
            {category.items.map((item) => {
              const Icon = item.icon
              const keywords = [item.title, item.href, item.description].filter(Boolean) as string[]
              return (
                <CommandItem
                  key={item.href}
                  onSelect={() => runCommand(() => setLocation(item.href))}
                  keywords={keywords}
                >
                  <Icon className="mr-2 h-4 w-4 text-gray-500" />
                  <span>{item.title}</span>
                  {item.description && (
                    <span className="ml-auto text-xs text-gray-400 truncate max-w-[40%]">
                      {item.description}
                    </span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}

/** 暴露給外部觸發開啟的便利函式 */
export function openCommandPalette() {
  window.dispatchEvent(new Event("open-command-palette"))
}

// 同時 export 一個只有 hotkey 監聽的 trigger button，供 TopNavigation 使用
export function CommandPaletteTriggerButton() {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  const shortcut = isMac ? "⌘K" : "Ctrl+K"

  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-sm text-gray-500 hover:bg-gray-50 transition-colors"
      title="搜尋頁面或動作"
    >
      <Search className="h-4 w-4" />
      <span>搜尋...</span>
      <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 border border-gray-200 rounded">
        {shortcut}
      </kbd>
    </button>
  )
}
