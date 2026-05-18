import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import {
  listPolicies,
  updatePolicy,
  getRateMap,
  seedDefaultPolicies,
} from "../storage/late-fee-policies"
import { insertLateFeePolicySchema } from "@shared/schema"
import { ZodError } from "zod"
import { db } from "../db"
import { sql } from "drizzle-orm"

const router = Router()

router.get(
  "/api/late-fee-policies",
  asyncHandler(async (_req, res) => {
    // 首次取用時 seed 預設
    await seedDefaultPolicies()
    res.json(await listPolicies())
  })
)

router.get(
  "/api/late-fee-policies/rate-map",
  asyncHandler(async (_req, res) => {
    await seedDefaultPolicies()
    res.json(await getRateMap())
  })
)

/**
 * 影響項目預覽：每類別有多少 unpaid + overdue payment_item
 * 用 itemName / category_name 關鍵字辨識
 */
router.get(
  "/api/late-fee-policies/impact",
  asyncHandler(async (_req, res) => {
    // 用 SQL CASE 簡化分類（鏡像 shared/payment-priority CATEGORY_RULES keywords）
    const result = await db.execute(sql`
      WITH categorized AS (
        SELECT pi.id, pi.item_name,
          CASE
            WHEN pi.item_name LIKE '%勞退%' OR pi.item_name LIKE '%勞工退休金%' THEN 'pension'
            WHEN pi.item_name LIKE '%勞保%' OR pi.item_name LIKE '%勞工保險%' OR pi.item_name LIKE '%勞健保%' THEN 'labor_insurance'
            WHEN pi.item_name LIKE '%健保%' OR pi.item_name LIKE '%全民健康保險%' OR pi.item_name LIKE '%二代健保%' THEN 'health_insurance'
            WHEN pi.item_name LIKE '%營業稅%' OR pi.item_name LIKE '%所得稅%' OR pi.item_name LIKE '%房屋稅%' OR pi.item_name LIKE '%扣繳%' THEN 'tax'
            WHEN pi.item_name LIKE '%房貸%' OR pi.item_name LIKE '%車貸%' OR pi.item_name LIKE '%信貸%' OR pi.item_name LIKE '%貸款%' THEN 'bank_loan'
            WHEN pi.item_name LIKE '%信用卡%' OR pi.item_name LIKE '%卡費%' THEN 'credit_card'
            WHEN pi.item_name LIKE '%電費%' OR pi.item_name LIKE '%水費%' OR pi.item_name LIKE '%瓦斯%' OR pi.item_name LIKE '%電話費%' OR pi.item_name LIKE '%網路費%' THEN 'utility'
            WHEN pi.item_name LIKE '%壽險%' OR pi.item_name LIKE '%產險%' OR pi.item_name LIKE '%汽車保險%' OR pi.item_name LIKE '%火險%' THEN 'insurance'
            WHEN pi.item_name LIKE '%房租%' OR pi.item_name LIKE '%租金%' THEN 'rental_pay'
            WHEN pi.item_name LIKE '%廠商%' OR pi.item_name LIKE '%貨款%' OR pi.item_name LIKE '%應付帳款%' THEN 'vendor'
            ELSE 'other'
          END AS category_key,
          (pi.total_amount::numeric - pi.paid_amount::numeric) AS unpaid_amount,
          (NOW()::date - pi.start_date) AS days_overdue
        FROM payment_items pi
        WHERE pi.status IN ('unpaid', 'pending', 'partial')
          AND NOT pi.is_deleted
          AND pi.start_date < NOW()::date
          AND (pi.total_amount::numeric - pi.paid_amount::numeric) > 0
      )
      SELECT
        category_key,
        COUNT(*)::int AS unpaid_count,
        SUM(unpaid_amount)::bigint AS total_unpaid,
        SUM(days_overdue * unpaid_amount)::bigint AS aggregate_overdue
      FROM categorized
      GROUP BY category_key
    `)
    res.json((result as unknown as { rows: unknown[] }).rows)
  })
)

router.put(
  "/api/late-fee-policies/:categoryKey",
  asyncHandler(async (req, res) => {
    const { categoryKey } = req.params
    try {
      const partial = insertLateFeePolicySchema
        .partial()
        .omit({ categoryKey: true })
        .parse(req.body)
      const row = await updatePolicy(categoryKey, partial)
      if (!row) throw new AppError(404, "policy 不存在")
      res.json(row)
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, "資料格式錯誤：" + err.errors.map((e) => e.message).join(", "))
      }
      throw err
    }
  })
)

export default router
