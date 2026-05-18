/**
 * 滯納金規則 storage
 *
 * 對應 shared/payment-priority.ts CATEGORY_RULES 的可設定版本
 *  - CATEGORY_RULES 仍存在（fallback 用、含關鍵字偵測）
 *  - 但實際 lateFeeRate 從 DB 讀取（若有對應 policy）
 */
import { db } from "../db"
import { eq } from "drizzle-orm"
import { lateFeePolicies, type LateFeePolicy, type InsertLateFeePolicy } from "@shared/schema"
import { CATEGORY_RULES } from "@shared/payment-priority"

// 預設 policies（首次建立時使用）— 立即關閉非勞健保/稅務
const DEFAULT_POLICIES: Array<{
  categoryKey: string
  label: string
  dailyRate: number
  gracePeriodDays: number
  isEnabled: boolean
  notes: string
}> = [
  {
    categoryKey: "labor_insurance",
    label: "勞保",
    dailyRate: 0.003,
    gracePeriodDays: 0,
    isEnabled: true,
    notes: "勞保局，每月寄繳款單，每日 0.3%（勞保條例第 17 條）",
  },
  {
    categoryKey: "health_insurance",
    label: "健保",
    dailyRate: 0.001,
    gracePeriodDays: 0,
    isEnabled: true,
    notes: "健保署，每月寄繳款單，每日 0.1%（最高 15%，全民健保法第 35 條）",
  },
  {
    categoryKey: "pension",
    label: "勞退（雇主提繳）",
    dailyRate: 0.001,
    gracePeriodDays: 0,
    isEnabled: true,
    notes: "勞保局，每月 25 日截止，每日 0.1%（最高 100%，勞工退休金條例第 53 條）",
  },
  {
    categoryKey: "tax",
    label: "稅務",
    dailyRate: 0.005,
    gracePeriodDays: 0,
    isEnabled: true,
    notes: "營業稅、所得稅等，逾期立即計息",
  },
  {
    categoryKey: "bank_loan",
    label: "銀行貸款",
    dailyRate: 0,
    gracePeriodDays: 0,
    isEnabled: false,
    notes: "各行各家規則不同，需查實際合約",
  },
  {
    categoryKey: "credit_card",
    label: "信用卡",
    dailyRate: 0,
    gracePeriodDays: 0,
    isEnabled: false,
    notes: "循環利息走另一機制",
  },
  {
    categoryKey: "utility",
    label: "水電瓦斯",
    dailyRate: 0,
    gracePeriodDays: 0,
    isEnabled: false,
    notes: "通常一個月寬限、不算滯納金",
  },
  {
    categoryKey: "insurance",
    label: "商業保險",
    dailyRate: 0,
    gracePeriodDays: 0,
    isEnabled: false,
    notes: "斷保需復效，但無滯納金",
  },
  {
    categoryKey: "rental_pay",
    label: "租金",
    dailyRate: 0,
    gracePeriodDays: 0,
    isEnabled: false,
    notes: "通常房東不收滯納金",
  },
  {
    categoryKey: "vendor",
    label: "廠商貨款",
    dailyRate: 0,
    gracePeriodDays: 0,
    isEnabled: false,
    notes: "合作關係，多可協商",
  },
  {
    categoryKey: "other",
    label: "其他",
    dailyRate: 0,
    gracePeriodDays: 0,
    isEnabled: false,
    notes: "未分類",
  },
]

export async function listPolicies(): Promise<LateFeePolicy[]> {
  return db.select().from(lateFeePolicies).orderBy(lateFeePolicies.id)
}

export async function getPolicyByKey(categoryKey: string): Promise<LateFeePolicy | undefined> {
  const [row] = await db
    .select()
    .from(lateFeePolicies)
    .where(eq(lateFeePolicies.categoryKey, categoryKey))
  return row
}

export async function updatePolicy(
  categoryKey: string,
  data: Partial<InsertLateFeePolicy>
): Promise<LateFeePolicy | undefined> {
  const [row] = await db
    .update(lateFeePolicies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(lateFeePolicies.categoryKey, categoryKey))
    .returning()
  return row
}

/** 確保所有 DEFAULT_POLICIES 在 DB 都存在；既存的不會被覆蓋（保留使用者設定）*/
export async function seedDefaultPolicies(): Promise<void> {
  const existing = await listPolicies()
  const existingKeys = new Set(existing.map((p) => p.categoryKey))

  for (const p of DEFAULT_POLICIES) {
    if (existingKeys.has(p.categoryKey)) continue
    await db.insert(lateFeePolicies).values({
      categoryKey: p.categoryKey,
      label: p.label,
      dailyRate: p.dailyRate.toString(),
      gracePeriodDays: p.gracePeriodDays,
      isEnabled: p.isEnabled,
      notes: p.notes,
    })
  }
}

/** 對外 API：取一張 categoryKey → effectiveRate 的 map（供前後端共用算滯納金） */
export async function getRateMap(): Promise<Record<string, number>> {
  const policies = await listPolicies()
  const map: Record<string, number> = {}
  for (const p of policies) {
    map[p.categoryKey] = p.isEnabled ? parseFloat(p.dailyRate) : 0
  }
  // 確保所有類別都有對應（fallback 為 0）
  for (const key of Object.keys(CATEGORY_RULES)) {
    if (!(key in map)) map[key] = 0
  }
  return map
}
