/**
 * useMoneyMode — 應用模式切換（家用記帳 / 民宿管理）
 *
 * 持久化到 localStorage、跨 tab 同步
 *
 * 用途：
 *  - mobile-tab-bar 根據模式顯示不同 5 入口
 *  - 可能延伸到首頁卡片優先順序、AI 建議口吻等
 */
import { useEffect, useState, useCallback } from "react"

export type MoneyMode = "household" | "hostel"

const STORAGE_KEY = "money-mode-v1"
const DEFAULT_MODE: MoneyMode = "household"

function readMode(): MoneyMode {
  if (typeof window === "undefined") return DEFAULT_MODE
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === "household" || v === "hostel") return v
  } catch {
    /* quota / disabled */
  }
  return DEFAULT_MODE
}

export function useMoneyMode(): {
  mode: MoneyMode
  setMode: (m: MoneyMode) => void
  toggle: () => void
} {
  const [mode, setModeState] = useState<MoneyMode>(readMode)

  const setMode = useCallback((next: MoneyMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    // 跨 tab 同步事件
    try {
      window.dispatchEvent(new CustomEvent("money-mode-changed", { detail: next }))
    } catch {
      /* ignore */
    }
  }, [])

  const toggle = useCallback(() => {
    setMode(mode === "household" ? "hostel" : "household")
  }, [mode, setMode])

  // 跨 tab / 同 tab 同步
  useEffect(() => {
    function onStorage(e: StorageEvent): void {
      if (e.key !== STORAGE_KEY) return
      if (e.newValue === "household" || e.newValue === "hostel") {
        setModeState(e.newValue)
      }
    }
    function onCustom(e: Event): void {
      const detail = (e as CustomEvent<MoneyMode>).detail
      if (detail === "household" || detail === "hostel") {
        setModeState(detail)
      }
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("money-mode-changed", onCustom)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("money-mode-changed", onCustom)
    }
  }, [])

  return { mode, setMode, toggle }
}
