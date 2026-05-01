/**
 * 分類去重工具（PR-5：UI 優化）
 *
 * 背景：PR-1 已將 fixed_categories 合併到 debt_categories，
 *      但前端許多下拉同時顯示「（固定）」「（專案）」造成同名重複。
 *      此工具統一去重邏輯，UI 顯示乾淨單一清單。
 *
 * 規則：
 *   1. 以名稱（不分大小寫、去頭尾空白）為 key
 *   2. 同名重複時，優先保留 source='project' 的（debt_categories 為新單一資料源）
 *   3. 結果按名稱字母順序排序
 */

export interface CategoryLike {
  id: number
  categoryName: string | null
}

export interface DedupedCategory {
  value: string // 過濾值（保留 fixed:N / project:N 格式給後端）
  label: string // UI 顯示名稱（不含 suffix）
  source: "fixed" | "project"
  id: number
}

/**
 * 合併兩個分類清單並去重。同名以 project 優先。
 *
 * @param fixedList   來自 /api/fixed-categories
 * @param projectList 來自 /api/categories/project
 * @returns 去重後的單一清單（label 不含「（固定）」「（專案）」suffix）
 */
export function dedupeCategories(
  fixedList: readonly CategoryLike[] | undefined,
  projectList: readonly CategoryLike[] | undefined
): DedupedCategory[] {
  const map = new Map<string, DedupedCategory>()

  // 先處理 project（優先級高）
  for (const c of projectList ?? []) {
    if (!c.categoryName) continue
    const key = c.categoryName.trim().toLowerCase()
    if (!key) continue
    map.set(key, {
      value: `project:${c.id}`,
      label: c.categoryName.trim(),
      source: "project",
      id: c.id,
    })
  }

  // 後處理 fixed（同名跳過，因為 project 已佔位）
  for (const c of fixedList ?? []) {
    if (!c.categoryName) continue
    const key = c.categoryName.trim().toLowerCase()
    if (!key) continue
    if (!map.has(key)) {
      map.set(key, {
        value: `fixed:${c.id}`,
        label: c.categoryName.trim(),
        source: "fixed",
        id: c.id,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"))
}

/**
 * 給已合併過的單一陣列（含 source）使用的去重版。
 */
export function dedupeMergedCategories<T extends CategoryLike & { source?: string }>(
  list: readonly T[]
): T[] {
  const map = new Map<string, T>()
  for (const c of list) {
    if (!c.categoryName) continue
    const key = c.categoryName.trim().toLowerCase()
    if (!key) continue
    const existing = map.get(key)
    if (!existing) {
      map.set(key, c)
      continue
    }
    // 同名：偏好 project 來源
    const existingIsProject =
      (existing.source ?? "").includes("專案") || (existing.source ?? "") === "project"
    const incomingIsProject = (c.source ?? "").includes("專案") || (c.source ?? "") === "project"
    if (incomingIsProject && !existingIsProject) {
      map.set(key, c)
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.categoryName ?? "").localeCompare(b.categoryName ?? "", "zh-Hant")
  )
}
