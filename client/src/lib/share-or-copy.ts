/**
 * shareOrCopy - 分享或複製文字
 *
 * 手機（支援 Web Share API）：跳出原生分享選單（LINE/Messages/Mail 等）
 * 桌面（不支援）：fallback 到剪貼簿複製
 *
 * 使用者取消分享時不視為錯誤
 *
 * @returns "shared"（已分享）/ "copied"（已複製）/ "cancelled"（取消）/ "failed"（失敗）
 */
export type ShareResult = "shared" | "copied" | "cancelled" | "failed"

export interface ShareOrCopyOptions {
  /** 標題（給原生分享 UI 用） */
  title?: string
  /** 主要文字 */
  text: string
}

export async function shareOrCopy(opts: ShareOrCopyOptions): Promise<ShareResult> {
  const { title, text } = opts

  // 手機：使用 navigator.share
  if (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({ title, text })
      return "shared"
    } catch (err) {
      // AbortError = 使用者按取消
      if (err instanceof Error && err.name === "AbortError") {
        return "cancelled"
      }
      // 其他錯誤 → fallback 到 clipboard
    }
  }

  // 桌面：fallback 到剪貼簿
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return "copied"
    } catch {
      return "failed"
    }
  }

  return "failed"
}
