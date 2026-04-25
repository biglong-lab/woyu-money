/**
 * 共用費用分攤計算（純函式，前後端共用）
 *
 * 4 種分攤規則：
 * - equal     平均分攤（每館相同）
 * - by_rooms  依房數比例（用 PropertyGroupMember.weight）
 * - by_revenue 依當月營收比例（需傳入各館營收）
 * - manual    手動權重（用 PropertyGroupMember.weight，與 by_rooms 共用欄位）
 *
 * 重要：
 * - 所有金額用整數元（NT$），不用浮點
 * - 分攤後總和必須等於原金額（最後一筆吸收餘數，避免四捨五入造成 1 元誤差）
 * - 全部純函式，無副作用，易測試
 */

export type AllocationRule = "equal" | "by_rooms" | "by_revenue" | "manual"

export interface PropertyGroupMemberInput {
  /** payment_projects.id */
  projectId: number
  /** 房數權重（房數比例 / 手動權重共用） */
  weight: number
  /** 該館當月營收（僅 by_revenue 需要） */
  revenue?: number
}

export interface AllocationResult {
  projectId: number
  amount: number
  /** 計算依據說明（給使用者看 / 給審計追溯） */
  basis: string
}

/**
 * 把總金額依規則分攤到 N 個成員
 *
 * @param totalAmount 總金額（NT$ 整數元）
 * @param members 共用組成員（含 weight，by_revenue 時需 revenue）
 * @param rule 分攤規則
 * @returns 每個成員應分攤的金額（總和 = totalAmount）
 *
 * @throws 當 members 為空、總權重為 0、規則無效時拋錯
 */
export function allocateCost(
  totalAmount: number,
  members: PropertyGroupMemberInput[],
  rule: AllocationRule
): AllocationResult[] {
  if (!Number.isFinite(totalAmount)) {
    throw new Error("totalAmount 必須是有限數字")
  }
  if (members.length === 0) {
    throw new Error("分攤成員不可為空")
  }
  if (totalAmount === 0) {
    return members.map((m) => ({
      projectId: m.projectId,
      amount: 0,
      basis: "金額為 0",
    }))
  }

  // 取得每個成員的「分攤分母」與基數標籤
  const ratios = computeRatios(members, rule)

  const totalRatio = ratios.reduce((sum, r) => sum + r.ratio, 0)
  if (totalRatio <= 0) {
    throw new Error(`分攤規則 ${rule} 計算後總權重為 0，無法分攤`)
  }

  // 計算每筆金額（先用四捨五入到整數）
  const raw = ratios.map((r) => ({
    projectId: r.projectId,
    rawAmount: (totalAmount * r.ratio) / totalRatio,
    basis: r.basis,
  }))

  // 取整 + 餘數修正：前 N-1 筆四捨五入，最後一筆用 totalAmount 減去前面，避免 1 元誤差
  const rounded: AllocationResult[] = []
  let runningSum = 0
  for (let i = 0; i < raw.length; i++) {
    if (i < raw.length - 1) {
      const amount = Math.round(raw[i].rawAmount)
      rounded.push({
        projectId: raw[i].projectId,
        amount,
        basis: raw[i].basis,
      })
      runningSum += amount
    } else {
      // 最後一筆吸收餘數
      rounded.push({
        projectId: raw[i].projectId,
        amount: totalAmount - runningSum,
        basis: raw[i].basis,
      })
    }
  }

  return rounded
}

interface RatioRow {
  projectId: number
  ratio: number
  basis: string
}

function computeRatios(members: PropertyGroupMemberInput[], rule: AllocationRule): RatioRow[] {
  switch (rule) {
    case "equal":
      return members.map((m) => ({
        projectId: m.projectId,
        ratio: 1,
        basis: `平均分攤 (1/${members.length})`,
      }))

    case "by_rooms":
    case "manual": {
      // 兩種共用 weight 欄位，差別只是名稱（manual 是「使用者自定」，by_rooms 是「房數」）
      const label = rule === "by_rooms" ? "房數比例" : "手動權重"
      return members.map((m) => ({
        projectId: m.projectId,
        ratio: m.weight,
        basis: `${label} (權重 ${m.weight})`,
      }))
    }

    case "by_revenue":
      return members.map((m) => ({
        projectId: m.projectId,
        ratio: m.revenue ?? 0,
        basis: `營收比例 (${m.revenue ?? 0})`,
      }))

    default: {
      // exhaustive check
      const _exhaustive: never = rule
      throw new Error(`未知的分攤規則: ${_exhaustive}`)
    }
  }
}

/**
 * 預估佔用驅動型費用（PT、洗滌等）
 *
 * @param unitCost 單日成本（NT$/天）
 * @param estimatedDays 預估天數
 * @returns 預估總額
 */
export function estimateOccupancyCost(unitCost: number, estimatedDays: number): number {
  if (unitCost < 0 || estimatedDays < 0) {
    throw new Error("單日成本與天數不可為負數")
  }
  return Math.round(unitCost * estimatedDays)
}

/**
 * 計算過去 N 個月的平均月度金額（用於「預估型」自動建立預估）
 *
 * @param historicalAmounts 過去每月實際金額陣列（最舊→最新）
 * @param trimOutliers 是否去掉最高最低值（true → 預設）
 * @returns 平均金額（整數元）
 */
export function estimateFromHistory(historicalAmounts: number[], trimOutliers = true): number {
  if (historicalAmounts.length === 0) return 0
  if (historicalAmounts.length <= 2) {
    // 樣本太少，不去極值
    const sum = historicalAmounts.reduce((a, b) => a + b, 0)
    return Math.round(sum / historicalAmounts.length)
  }

  let sample = [...historicalAmounts]
  if (trimOutliers && sample.length >= 3) {
    sample.sort((a, b) => a - b)
    sample = sample.slice(1, -1) // 去掉最高最低
  }
  const sum = sample.reduce((a, b) => a + b, 0)
  return Math.round(sum / sample.length)
}
