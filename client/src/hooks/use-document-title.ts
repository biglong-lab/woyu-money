/**
 * useDocumentTitle - 動態更新瀏覽器 tab 標題
 *
 * 用法：
 *   useDocumentTitle("現金分配") // → tab 顯示「現金分配 · 浯島財務」
 *   useDocumentTitle()           // → 還原預設
 *
 * 自動加 prefix：當有緊急未付項目（critical 級別）時，會加上 (N) 前綴
 *   例：「(3) 現金分配 · 浯島財務」→ 切到別的分頁也能看到緊急數量
 *
 * 解決：使用者開多個 tab 時無法分辨哪個是哪個頁面，且看不到緊急狀態
 */
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"

const APP_NAME = "浯島財務"
const DEFAULT_TITLE = "浯島財務管理系統"

interface PriorityReport {
  counts?: { critical?: number; high?: number; medium?: number; low?: number }
}

export function useDocumentTitle(title?: string): void {
  // 全域共享 priority cache（與 financial-health-summary-card 等共用）
  // react-query 會自動 dedupe，不會額外打 API
  const { data } = useQuery<PriorityReport>({
    queryKey: ["/api/payment/priority-report?includeLow=true"],
    staleTime: 30_000, // 30 秒內不重打
  })
  const urgentCount = data?.counts?.critical ?? 0

  useEffect(() => {
    const prefix = urgentCount > 0 ? `(${urgentCount}) ` : ""
    const base = title ? `${title} · ${APP_NAME}` : DEFAULT_TITLE
    const previous = document.title
    document.title = `${prefix}${base}`
    return () => {
      document.title = previous
    }
  }, [title, urgentCount])
}
