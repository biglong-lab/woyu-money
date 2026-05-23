/**
 * 分類名稱 → emoji + 顏色映射（Phase 5 視覺化）
 *
 * 純前端 mapping、不動 schema。
 * fixed_categories 表沒 emoji/color 欄位、用此 dict 補齊視覺。
 *
 * 用法：
 *   const { emoji, color } = getCategoryDecor("飲食")
 */

const EMOJI_MAP: Record<string, string> = {
  // 飲食
  飲食: "🍱",
  食物: "🍱",
  早餐: "🍞",
  午餐: "🍱",
  晚餐: "🍲",
  外食: "🍔",
  零食: "🍪",
  飲料: "🥤",
  咖啡: "☕",
  // 生活
  生活: "🛒",
  日用品: "🧻",
  雜貨: "🛒",
  購物: "🛍️",
  服飾: "👕",
  衣服: "👕",
  美妝: "💄",
  // 交通
  交通: "🚗",
  油錢: "⛽",
  停車: "🅿️",
  停車費: "🅿️",
  捷運: "🚇",
  公車: "🚌",
  計程車: "🚕",
  高鐵: "🚄",
  // 住居
  房租: "🏠",
  水費: "💧",
  電費: "⚡",
  瓦斯: "🔥",
  瓦斯費: "🔥",
  網路: "📡",
  電話: "📞",
  電信: "📱",
  管理費: "🏢",
  // 醫療
  醫療: "🏥",
  藥品: "💊",
  保健: "💊",
  保險: "🛡️",
  // 教育
  教育: "📚",
  學費: "🎓",
  書籍: "📖",
  補習: "✏️",
  課程: "🎓",
  // 娛樂
  娛樂: "🎮",
  電影: "🎬",
  遊戲: "🎮",
  旅遊: "✈️",
  旅行: "🧳",
  健身: "💪",
  運動: "⚽",
  // 寵物 / 孩子
  寵物: "🐾",
  小孩: "🧒",
  育兒: "🍼",
  // 工作 / 投資
  工作: "💼",
  投資: "📈",
  稅: "📋",
  稅金: "📋",
  // 禮物 / 人情
  禮物: "🎁",
  紅包: "🧧",
  人情: "🤝",
  // 其他
  其他: "📦",
  未分類: "📦",
}

const COLOR_MAP: Record<string, string> = {
  飲食: "#F97316",
  食物: "#F97316",
  外食: "#FB923C",
  飲料: "#FBBF24",
  咖啡: "#92400E",
  生活: "#10B981",
  日用品: "#34D399",
  購物: "#EC4899",
  服飾: "#F472B6",
  交通: "#3B82F6",
  油錢: "#1E40AF",
  停車費: "#60A5FA",
  捷運: "#0EA5E9",
  房租: "#7C3AED",
  水費: "#06B6D4",
  電費: "#EAB308",
  瓦斯費: "#F59E0B",
  網路: "#8B5CF6",
  電話: "#A78BFA",
  電信: "#8B5CF6",
  醫療: "#EF4444",
  保險: "#DC2626",
  教育: "#6366F1",
  娛樂: "#A855F7",
  電影: "#9333EA",
  旅遊: "#0891B2",
  健身: "#84CC16",
  寵物: "#A16207",
  小孩: "#F87171",
  工作: "#1E293B",
  投資: "#15803D",
  禮物: "#E11D48",
  其他: "#6B7280",
  未分類: "#9CA3AF",
}

const FALLBACK_EMOJI = "💸"
const FALLBACK_COLOR = "#9CA3AF"

/**
 * 取得分類視覺裝飾
 * 1. 完全相符
 * 2. substring 匹配（例如「外送飲食」匹配「飲食」）
 * 3. fallback 💸 + 灰色
 */
export function getCategoryDecor(name: string | null | undefined): {
  emoji: string
  color: string
} {
  if (!name) return { emoji: FALLBACK_EMOJI, color: FALLBACK_COLOR }
  const trimmed = name.trim()
  if (EMOJI_MAP[trimmed]) {
    return { emoji: EMOJI_MAP[trimmed], color: COLOR_MAP[trimmed] ?? FALLBACK_COLOR }
  }
  // substring 匹配
  for (const key of Object.keys(EMOJI_MAP)) {
    if (trimmed.includes(key)) {
      return { emoji: EMOJI_MAP[key], color: COLOR_MAP[key] ?? FALLBACK_COLOR }
    }
  }
  return { emoji: FALLBACK_EMOJI, color: FALLBACK_COLOR }
}
