/**
 * 自動產生月度預估（PR-3 核心）
 *
 * 流程：給定年/月 → 自動建立 budget_plan + 多個 budget_items
 *
 * 4 種類型自動產生策略：
 * 1. 固定型（fixed）：抓 rental_contracts.base_amount
 *    - 例：5 個館的租金，全部從 rental_contracts 來
 * 2. 預估型（variable）：抓過去 6 個月該分類平均（去極值）
 *    - 例：水電、電話、人事、佣金（單館預估）
 * 3. 佔用驅動（occupancy）：需 admin 先設 occupancy_unit_cost
 *    - 跳過：未設定不產生
 * 4. 共用組（shared）：依 fixed_categories 是否標記為「共用」（暫先不自動）
 *    - 跳過：保留給 admin 手動加
 *
 * 輸入：POST /api/budget/estimates/auto-generate { year, month }
 * 輸出：建立的 budget_plan + 各館 budget_items 列表
 *
 * 冪等性：若該月 plan 已存在（status='active'），返回 409 並建議使用 force=true
 */

import { Router } from "express"
import { z } from "zod"
import { sql } from "drizzle-orm"
import { db } from "../db"
import { paymentItems, paymentProjects, paymentRecords } from "@shared/schema"
import { rentalContracts } from "@shared/schema"
import { fixedCategories, fixedCategorySubOptions } from "@shared/schema"
import { budgetPlans, budgetItems } from "@shared/schema"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { requireAuth } from "../auth"
import { estimateFromHistory } from "@shared/cost-allocation"

const router = Router()

const generateBodySchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  force: z.boolean().optional().default(false),
})

interface GeneratedItem {
  fixedCategoryId: number | null
  categoryName: string
  itemName: string
  attribution: "single" | "shared" | "occupancy" | "company"
  targetProjectId: number | null
  targetProjectName: string | null
  plannedAmount: number
  basis: string // 「依合約」/「過去 6 月平均 (NT$ X)」等
}

// ─────────────────────────────────────────────
// POST /api/budget/estimates/auto-generate
// ─────────────────────────────────────────────

router.post(
  "/api/budget/estimates/auto-generate",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = generateBodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, "參數錯誤：請提供 year 與 month")
    }
    const { year, month, force } = parsed.data

    // ── 1. 檢查既有 plan ───────────────────────────
    const planName = `${year}-${String(month).padStart(2, "0")} 月度預估`
    const existing = await db
      .select()
      .from(budgetPlans)
      .where(sql`plan_name = ${planName} AND COALESCE(status, 'active') = 'active'`)
      .limit(1)

    if (existing.length > 0 && !force) {
      throw new AppError(
        409,
        `${year}/${month} 預估已存在（plan id ${existing[0].id}）。如要重建請傳 force=true`
      )
    }

    // ── 2. 建立或取既有 plan ───────────────────────
    const startDate = new Date(year, month - 1, 1).toISOString().slice(0, 10)
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10)

    let plan
    if (existing.length > 0 && force) {
      // 刪舊 items 重來
      await db.delete(budgetItems).where(sql`budget_plan_id = ${existing[0].id}`)
      plan = existing[0]
    } else {
      const [created] = await db
        .insert(budgetPlans)
        .values({
          planName,
          planType: "monthly_auto",
          budgetPeriod: "monthly",
          startDate,
          endDate,
          totalBudget: "0",
          status: "active",
        })
        .returning()
      plan = created
    }

    // ── 3. 收集所有 active project ─────────────────
    const projects = await db
      .select()
      .from(paymentProjects)
      .where(sql`COALESCE(is_active, true) = true AND COALESCE(is_deleted, false) = false`)
      .orderBy(paymentProjects.projectName)

    // ── 4. 產生「固定型」：rental_contracts → 租金 ─
    const generated: GeneratedItem[] = []
    const contracts = await db
      .select()
      .from(rentalContracts)
      .where(
        sql`COALESCE(is_active, true) = true
          AND start_date <= make_date(${year}, ${month}, 28)
          AND end_date >= make_date(${year}, ${month}, 1)`
      )

    for (const c of contracts) {
      generated.push({
        fixedCategoryId: null,
        categoryName: "租金",
        itemName: `${year}/${month} ${c.contractName} 租金`,
        attribution: "single",
        targetProjectId: c.projectId,
        targetProjectName: projects.find((p) => p.id === c.projectId)?.projectName ?? null,
        plannedAmount: Math.round(Number(c.baseAmount)),
        basis: "依合約 base_amount（固定）",
      })
    }

    // ── 5. 產生「預估型」：每館 × 各 fixed_category ─
    // 取得所有 active fixed_categories（電話費、電費、水費、人事等）
    const categories = await db
      .select()
      .from(fixedCategories)
      .where(sql`COALESCE(is_active, true) = true`)
      .orderBy(fixedCategories.sortOrder)

    // 取得每個 (project, category) 過去 6 月的歷史平均
    // 依 payment_items.project_id + fixed_category_id 過濾，
    // 用 payment_records.amount_paid 加總（每月）
    const sixMonthsAgo = monthsBefore(year, month, 6)

    for (const project of projects) {
      for (const cat of categories) {
        // 跳過租金分類（已從 rental_contracts 處理）
        if (cat.categoryName.includes("租")) continue

        // 取過去 6 個月（或更少）此 (project, category) 的實際支出總額
        const history = await getHistoricalMonthlyTotals(
          project.id,
          cat.id,
          sixMonthsAgo.year,
          sixMonthsAgo.month,
          year,
          month - 1 // 不含當月
        )

        if (history.length === 0) {
          // 完全沒有歷史紀錄 → 不產生（避免空項目）
          continue
        }

        const avgAmount = estimateFromHistory(history.map((h) => h.total))
        if (avgAmount <= 0) continue

        generated.push({
          fixedCategoryId: cat.id,
          categoryName: cat.categoryName,
          itemName: `${year}/${month} ${project.projectName} ${cat.categoryName}`,
          attribution: "single",
          targetProjectId: project.id,
          targetProjectName: project.projectName,
          plannedAmount: avgAmount,
          basis: `過去 ${history.length} 個月平均（去極值）`,
        })
      }
    }

    // ── 6. 寫入 budget_items ───────────────────────
    const itemsToInsert = generated.map((g) => ({
      budgetPlanId: plan.id,
      itemName: g.itemName,
      paymentType: "single" as const,
      plannedAmount: g.plannedAmount.toString(),
      attribution: g.attribution,
      targetProjectId: g.targetProjectId,
      fixedCategoryId: g.fixedCategoryId,
      startDate,
      endDate,
      notes: g.basis,
    }))

    if (itemsToInsert.length > 0) {
      await db.insert(budgetItems).values(itemsToInsert)
    }

    // ── 7. 更新 plan total ─────────────────────────
    const totalBudget = generated.reduce((sum, g) => sum + g.plannedAmount, 0)
    await db
      .update(budgetPlans)
      .set({ totalBudget: totalBudget.toString(), updatedAt: new Date() })
      .where(sql`id = ${plan.id}`)

    // ── 8. 返回結果 ────────────────────────────────
    res.json({
      planId: plan.id,
      year,
      month,
      itemCount: generated.length,
      totalBudget,
      breakdown: {
        rental: generated.filter((g) => g.categoryName === "租金").length,
        variable: generated.filter((g) => g.categoryName !== "租金").length,
      },
      items: generated,
    })
  })
)

// ─────────────────────────────────────────────
// GET /api/budget/estimates/preview?year=YYYY&month=MM
// 預覽會產生哪些（不實際寫入）
// ─────────────────────────────────────────────

router.get(
  "/api/budget/estimates/preview",
  requireAuth,
  asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year as string)
    const month = parseInt(req.query.month as string)
    if (!year || !month || month < 1 || month > 12) {
      throw new AppError(400, "請提供有效的 year 與 month")
    }

    const projects = await db
      .select()
      .from(paymentProjects)
      .where(sql`COALESCE(is_active, true) = true AND COALESCE(is_deleted, false) = false`)

    const contracts = await db
      .select()
      .from(rentalContracts)
      .where(
        sql`COALESCE(is_active, true) = true
          AND start_date <= make_date(${year}, ${month}, 28)
          AND end_date >= make_date(${year}, ${month}, 1)`
      )

    const categories = await db
      .select()
      .from(fixedCategories)
      .where(sql`COALESCE(is_active, true) = true`)

    const sixMonthsAgo = monthsBefore(year, month, 6)
    const preview: GeneratedItem[] = []

    for (const c of contracts) {
      preview.push({
        fixedCategoryId: null,
        categoryName: "租金",
        itemName: `${year}/${month} ${c.contractName} 租金`,
        attribution: "single",
        targetProjectId: c.projectId,
        targetProjectName: projects.find((p) => p.id === c.projectId)?.projectName ?? null,
        plannedAmount: Math.round(Number(c.baseAmount)),
        basis: "依合約 base_amount",
      })
    }

    for (const project of projects) {
      for (const cat of categories) {
        if (cat.categoryName.includes("租")) continue
        const history = await getHistoricalMonthlyTotals(
          project.id,
          cat.id,
          sixMonthsAgo.year,
          sixMonthsAgo.month,
          year,
          month - 1
        )
        if (history.length === 0) continue
        const avgAmount = estimateFromHistory(history.map((h) => h.total))
        if (avgAmount <= 0) continue

        preview.push({
          fixedCategoryId: cat.id,
          categoryName: cat.categoryName,
          itemName: `${year}/${month} ${project.projectName} ${cat.categoryName}`,
          attribution: "single",
          targetProjectId: project.id,
          targetProjectName: project.projectName,
          plannedAmount: avgAmount,
          basis: `過去 ${history.length} 個月平均`,
        })
      }
    }

    res.json({
      year,
      month,
      itemCount: preview.length,
      totalBudget: preview.reduce((s, g) => s + g.plannedAmount, 0),
      items: preview,
    })
  })
)

// ─────────────────────────────────────────────
// 內部 helper
// ─────────────────────────────────────────────

interface HistoryRow {
  year: number
  month: number
  total: number
}

/**
 * 取得 (project, fixed_category) 在指定區間內每月實際支出總額。
 * 用 payment_records.amount_paid 加總（已付的金額才算實際支出）。
 */
async function getHistoricalMonthlyTotals(
  projectId: number,
  fixedCategoryId: number,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number
): Promise<HistoryRow[]> {
  const result = await db.execute<{
    year: number
    month: number
    total: string
  }>(sql`
    SELECT
      EXTRACT(YEAR FROM pr.payment_date)::int AS year,
      EXTRACT(MONTH FROM pr.payment_date)::int AS month,
      SUM(pr.amount_paid::numeric)::text AS total
    FROM ${paymentRecords} pr
    JOIN ${paymentItems} pi ON pi.id = pr.payment_item_id
    WHERE pi.project_id = ${projectId}
      AND pi.fixed_category_id = ${fixedCategoryId}
      AND COALESCE(pi.is_deleted, false) = false
      AND (
        (EXTRACT(YEAR FROM pr.payment_date)::int = ${fromYear}
         AND EXTRACT(MONTH FROM pr.payment_date)::int >= ${fromMonth})
        OR EXTRACT(YEAR FROM pr.payment_date)::int > ${fromYear}
      )
      AND (
        (EXTRACT(YEAR FROM pr.payment_date)::int = ${toYear}
         AND EXTRACT(MONTH FROM pr.payment_date)::int <= ${toMonth})
        OR EXTRACT(YEAR FROM pr.payment_date)::int < ${toYear}
      )
    GROUP BY 1, 2
    ORDER BY 1, 2
  `)

  return (result.rows as { year: number; month: number; total: string }[]).map((r) => ({
    year: Number(r.year),
    month: Number(r.month),
    total: Number(r.total),
  }))
}

function monthsBefore(year: number, month: number, n: number): { year: number; month: number } {
  let m = month - n
  let y = year
  while (m <= 0) {
    m += 12
    y -= 1
  }
  return { year: y, month: m }
}

export default router
