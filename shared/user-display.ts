/**
 * 用戶顯示名稱共用 helper
 *
 * LINE 登入用戶的 username 是 `line_U123abc...` 長代號，無法辨識，
 * 故所有 UI 顯示與 audit log 都應該優先用 lineDisplayName / fullName。
 *
 * 此 helper 同時被前端與後端使用，確保兩邊邏輯一致。
 */

interface DisplayableUser {
  lineDisplayName?: string | null
  fullName?: string | null
  username?: string | null
}

/**
 * 取得用戶顯示名稱
 * 優先順序：lineDisplayName → fullName → username → "用戶"
 */
export function getDisplayName(user: DisplayableUser | null | undefined): string {
  if (!user) return "用戶"
  return user.lineDisplayName || user.fullName || user.username || "用戶"
}

/**
 * 取得 audit log 用的用戶資訊字串
 * 比 getDisplayName 多一個 fallback：用戶ID:N（避免完全空字串）
 */
export function getAuditUserInfo(
  user: (DisplayableUser & { id?: number }) | null | undefined
): string {
  if (!user) return "匿名用戶"
  return (
    user.lineDisplayName ||
    user.fullName ||
    user.username ||
    (user.id ? `用戶ID:${user.id}` : "未知用戶")
  )
}
