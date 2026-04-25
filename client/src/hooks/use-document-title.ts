/**
 * useDocumentTitle - 動態更新瀏覽器 tab 標題
 *
 * 用法：
 *   useDocumentTitle("現金分配") // → tab 顯示「現金分配 · 浯島財務」
 *   useDocumentTitle()           // → 還原預設
 *
 * 解決：使用者開多個 tab 時無法分辨哪個是哪個頁面
 */
import { useEffect } from "react"

const APP_NAME = "浯島財務"
const DEFAULT_TITLE = "浯島財務管理系統"

export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · ${APP_NAME}` : DEFAULT_TITLE
    return () => {
      document.title = previous
    }
  }, [title])
}
