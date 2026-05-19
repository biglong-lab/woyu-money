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
import { useEffect, useState, useCallback, useMemo } from "react"
import { useLocation } from "wouter"
import {
  Home,
  Inbox,
  Search,
  PlusCircle,
  Receipt,
  Building2,
  Repeat,
  Sparkles,
  Wallet,
  History,
  Trash2,
} from "lucide-react"
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

const RECENT_STORAGE_KEY = "command-palette:recent"
const RECENT_MAX = 6

/** 把路徑寫進「最近訪問」清單（純前端、localStorage、去重、上限 6） */
function pushRecent(href: string) {
  try {
    if (!href || href === "/") return
    const raw = localStorage.getItem(RECENT_STORAGE_KEY)
    const list: string[] = raw ? JSON.parse(raw) : []
    const next = [href, ...list.filter((h) => h !== href)].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage 滿 / 隱私模式 — 靜默失敗
  }
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function clearRecent() {
  try {
    localStorage.removeItem(RECENT_STORAGE_KEY)
  } catch {
    // 靜默失敗
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [location, setLocation] = useLocation()
  // 用 state 強制 re-render（讓 open=true 時讀到最新清單）
  const [recentHrefs, setRecentHrefs] = useState<string[]>(() => loadRecent())

  // 每次 location 改了、若該路徑在 nav 內就記下來
  useEffect(() => {
    pushRecent(location)
    setRecentHrefs(loadRecent())
  }, [location])

  // 從 navigationCategories 對應 href → { title, icon, description }
  const navIndex = useMemo(() => {
    const m = new Map<string, { title: string; icon: typeof Home; description?: string }>()
    for (const c of navigationCategories) {
      for (const it of c.items) {
        m.set(it.href, { title: it.title, icon: it.icon, description: it.description })
      }
    }
    return m
  }, [])

  // 過濾掉不在 nav 內的（避免顯示 /auth、/not-found 等）+ 排除當前頁
  const recentItems = useMemo(
    () =>
      recentHrefs
        .filter((h) => navIndex.has(h) && h !== location)
        .map((h) => ({ href: h, ...navIndex.get(h)! }))
        .slice(0, 5),
    [recentHrefs, navIndex, location]
  )

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

        {/* 最近訪問 — 限有在 navigation 內的頁面 */}
        {recentItems.length > 0 && (
          <>
            <CommandGroup heading="🕘 最近訪問">
              {recentItems.map((it) => {
                const Icon = it.icon
                return (
                  <CommandItem
                    key={`recent-${it.href}`}
                    onSelect={() => runCommand(() => setLocation(it.href))}
                    keywords={[it.title, it.href, it.description ?? ""]}
                  >
                    <Icon className="mr-2 h-4 w-4 text-blue-500" />
                    <span>{it.title}</span>
                    <History className="ml-auto h-3 w-3 text-gray-300" />
                  </CommandItem>
                )
              })}
              <CommandItem
                key="recent-clear"
                onSelect={() => {
                  clearRecent()
                  setRecentHrefs([])
                }}
                keywords={["clear", "清除", "歷史", "history"]}
                className="text-xs text-gray-500"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5 text-gray-400" />
                <span>清除最近訪問紀錄</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* 快速動作：建立 / 跳轉到常見操作頁 */}
        <CommandGroup heading="➕ 快速動作">
          <CommandItem
            onSelect={() => runCommand(() => setLocation("/payment-projects"))}
            keywords={["new", "新增", "付款", "項目", "payment", "建立"]}
          >
            <PlusCircle className="mr-2 h-4 w-4 text-blue-600" />
            <span>新增付款項目</span>
            <span className="ml-auto text-xs text-gray-400">付款專案頁</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setLocation("/revenue-reports"))}
            keywords={["new", "新增", "收入", "revenue", "income", "記帳"]}
          >
            <Wallet className="mr-2 h-4 w-4 text-green-600" />
            <span>新增收入紀錄</span>
            <span className="ml-auto text-xs text-gray-400">收入報表頁</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setLocation("/recurring-expenses"))}
            keywords={["new", "新增", "週期", "模板", "recurring", "template"]}
          >
            <Repeat className="mr-2 h-4 w-4 text-cyan-600" />
            <span>新增週期性支出模板</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setLocation("/rental-management-enhanced"))}
            keywords={["new", "新增", "租約", "rental", "contract"]}
          >
            <Building2 className="mr-2 h-4 w-4 text-orange-600" />
            <span>新增租約 / 房東付款</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setLocation("/receipt-match-helper"))}
            keywords={["receipt", "收據", "對應", "match", "比對"]}
          >
            <Receipt className="mr-2 h-4 w-4 text-amber-600" />
            <span>收據對應助手</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setLocation("/scenario-simulator"))}
            keywords={["scenario", "沙盤", "simulator", "推演", "模擬"]}
          >
            <Sparkles className="mr-2 h-4 w-4 text-violet-600" />
            <span>沙盤推演（場景模擬）</span>
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
