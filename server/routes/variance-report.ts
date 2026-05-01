/**
 * 月底差異對賬報表 API（PR-2）
 *
 * GET /api/reports/variance?year=YYYY&month=MM
 *
 * 邏輯：
 * 1. 找到該月 active budget_plans 內的所有 budget_items
 * 2. 計算每筆的差異（actualAmount - plannedAmount）
 * 3. 分類：
 *    - 大幅差異（abs(variancePercent) >= 20%）
 *    - 預估未發生（actualAmount = 0 但 plannedAmount > 0）— 疑似漏記
 *    - 完美對賬（其餘）
 * 4. 統計：總預估、總實際、超支金額、節省金額、整體 variance%
 * 5. 自動產生洞察文字（如「文旅電費連 N 月超出預估」）
 */

import { Router } from "express"
import { sql } from "drizzle-orm"
import { db } from "../db"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { requireAuth } from "../auth"

const router = Router()

interface VarianceItemRow extends Record<string, unknown> {
  id: number
  item_name: string
  attribution: string | null
  target_project_id: number | null
  project_name: string | null
  category_name: string | null
  planned_amount: string | null
  actual_amount: string | null
  variance: string | null
  variance_percentage: string | null
}

interface VarianceItem {
  id: number
  itemName: string
  attribution: string
  projectName: string | null
  categoryName: string | null
  plannedAmount: number
  actualAmount: number
  variance: number
  variancePercentage: number
  severity: "critical" | "warning" | "normal" | "missing"
}

interface VarianceTotals {
  plannedTotal: number
  actualTotal: number
  variance: number
  variancePercent: number
  overspent: number // sum of variance where variance > 0
  saved: number // abs(sum of variance where variance < 0)
}

interface VarianceResponse {
  year: number
  month: number
  totals: VarianceTotals
  bigVariance: VarianceItem[]
  suspectMissing: VarianceItem[]
  normalItems: VarianceItem[]
  insights: string[]
  itemCount: number
}

// ─────────────────────────────────────────────
// 主要 API
// ─────────────────────────────────────────────

router.get(
  "/api/reports/variance",
  requireAuth,
  asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year as string)
    const month = parseInt(req.query.month as string)
    if (!year || !month || month < 1 || month > 12) {
      throw new AppError(400, "請提供有效的 year 與 month")
    }

    // 取該月所有 budget_items（含 plan / project / category 名稱）
    const rows = await db.execute<VarianceItemRow>(sql`
      SELECT
        bi.id,
        bi.item_name,
        bi.attribution,
        bi.target_project_id,
        pp.project_name,
        COALESCE(fc.category_name, dc.category_name) AS category_name,
        bi.planned_amount,
        COALESCE(bi.actual_amount, '0') AS actual_amount,
        COALESCE(bi.variance, '0') AS variance,
        COALESCE(bi.variance_percentage, '0') AS variance_percentage
      FROM budget_items bi
      JOIN budget_plans bp ON bp.id = bi.budget_plan_id
      LEFT JOIN payment_projects pp ON pp.id = bi.target_project_id
      LEFT JOIN fixed_categories fc ON fc.id = bi.fixed_category_id
      LEFT JOIN debt_categories dc ON dc.id = bi.category_id
      WHERE COALESCE(bi.is_deleted, false) = false
        AND COALESCE(bp.status, 'active') = 'active'
        AND EXTRACT(YEAR FROM bp.start_date)::int = ${year}
        AND EXTRACT(MONTH FROM bp.start_date)::int = ${month}
      ORDER BY ABS(COALESCE(bi.variance::numeric, 0)) DESC, bi.item_name
    `)

    const items: VarianceItem[] = (rows.rows as VarianceItemRow[]).map((r) => {
      const planned = Number(r.planned_amount ?? "0")
      const actual = Number(r.actual_amount ?? "0")
      const variance = Number(r.variance ?? "0")
      const variancePct = Number(r.variance_percentage ?? "0")

      let severity: VarianceItem["severity"] = "normal"
      // 預估有金額但實際 0 → 疑似漏記
      if (planned > 0 && actual === 0) {
        severity = "missing"
      } else if (Math.abs(variancePct) >= 30) {
        severity = "critical"
      } else if (Math.abs(variancePct) >= 20) {
        severity = "warning"
      }

      return {
        id: r.id,
        itemName: r.item_name,
        attribution: r.attribution ?? "single",
        projectName: r.project_name,
        categoryName: r.category_name,
        plannedAmount: planned,
        actualAmount: actual,
        variance,
        variancePercentage: variancePct,
        severity,
      }
    })

    // 分類
    const bigVariance = items.filter((i) => i.severity === "critical" || i.severity === "warning")
    const suspectMissing = items.filter((i) => i.severity === "missing")
    const normalItems = items.filter((i) => i.severity === "normal")

    // 統計
    let plannedTotal = 0
    let actualTotal = 0
    let overspent = 0
    let saved = 0
    for (const it of items) {
      plannedTotal += it.plannedAmount
      actualTotal += it.actualAmount
      if (it.variance > 0) overspent += it.variance
      else saved += -it.variance
    }
    const totalVariance = actualTotal - plannedTotal
    const totalVariancePct =
      plannedTotal > 0 ? Math.round((totalVariance / plannedTotal) * 1000) / 10 : 0

    const totals: VarianceTotals = {
      plannedTotal,
      actualTotal,
      variance: totalVariance,
      variancePercent: totalVariancePct,
      overspent,
      saved,
    }

    // 自動產生洞察
    const insights = await generateInsights(year, month, items)

    const response: VarianceResponse = {
      year,
      month,
      totals,
      bigVariance,
      suspectMissing,
      normalItems,
      insights,
      itemCount: items.length,
    }

    res.json(response)
  })
)

// ─────────────────────────────────────────────
// 洞察產生器
// ─────────────────────────────────────────────

async function generateInsights(
  year: number,
  month: number,
  currentItems: VarianceItem[]
): Promise<string[]> {
  const insights: string[] = []

  // 洞察 1：整月差異總結
  const totals = currentItems.reduce(
    (acc, it) => {
      acc.planned += it.plannedAmount
      acc.actual += it.actualAmount
      return acc
    },
    { planned: 0, actual: 0 }
  )
  if (totals.planned > 0) {
    const diff = totals.actual - totals.planned
    const pct = (diff / totals.planned) * 100
    if (diff > 0 && pct >= 5) {
      insights.push(
        `本月總開銷比預估超出 ${pct.toFixed(1)}%（NT$ ${Math.round(diff).toLocaleString()}），建議下月預估上調`
      )
    } else if (diff < 0 && Math.abs(pct) >= 5) {
      insights.push(
        `本月總開銷比預估節省 ${Math.abs(pct).toFixed(1)}%（NT$ ${Math.abs(Math.round(diff)).toLocaleString()}），預估可下修`
      )
    } else {
      insights.push("本月預估與實際接近（差異 < 5%），預估準確度良好")
    }
  }

  // 洞察 2：連續 3 個月超出的項目
  // 取過去 3 個月的同分類資料，找連續超支項目
  try {
    const recentRows = await db.execute<{
      project_name: string | null
      category_name: string | null
      months_overspent: number
    }>(sql`
      WITH recent_3_months AS (
        SELECT
          pp.project_name,
          COALESCE(fc.category_name, dc.category_name) AS category_name,
          EXTRACT(YEAR FROM bp.start_date)::int AS y,
          EXTRACT(MONTH FROM bp.start_date)::int AS m,
          CASE
            WHEN COALESCE(bi.variance::numeric, 0) > 0 THEN 1
            ELSE 0
          END AS overspent_flag
        FROM budget_items bi
        JOIN budget_plans bp ON bp.id = bi.budget_plan_id
        LEFT JOIN payment_projects pp ON pp.id = bi.target_project_id
        LEFT JOIN fixed_categories fc ON fc.id = bi.fixed_category_id
        LEFT JOIN debt_categories dc ON dc.id = bi.category_id
        WHERE COALESCE(bi.is_deleted, false) = false
          AND bi.target_project_id IS NOT NULL
          AND bi.fixed_category_id IS NOT NULL
          AND COALESCE(bi.attribution, 'single') = 'single'
          AND make_date(EXTRACT(YEAR FROM bp.start_date)::int, EXTRACT(MONTH FROM bp.start_date)::int, 1)
              BETWEEN make_date(${year}, ${month}, 1) - INTERVAL '2 months'
                  AND make_date(${year}, ${month}, 1)
      )
      SELECT
        project_name,
        category_name,
        SUM(overspent_flag)::int AS months_overspent
      FROM recent_3_months
      GROUP BY project_name, category_name
      HAVING SUM(overspent_flag) >= 3
      ORDER BY SUM(overspent_flag) DESC
      LIMIT 3
    `)

    for (const r of recentRows.rows as {
      project_name: string | null
      category_name: string | null
      months_overspent: number
    }[]) {
      if (r.project_name && r.category_name) {
        insights.push(
          `${r.project_name} ${r.category_name}連續 ${r.months_overspent} 個月超出預估，建議調高預估金額`
        )
      }
    }
  } catch (err) {
    // 過去資料不足不影響主流程
    console.warn("[variance-report] 無法計算連月趨勢:", err)
  }

  // 洞察 3：預估未發生 → 漏記提醒
  const missing = currentItems.filter((i) => i.severity === "missing")
  if (missing.length > 0) {
    insights.push(
      `偵測到 ${missing.length} 筆預估未實際發生，請確認是否漏記（共 NT$ ${Math.round(missing.reduce((s, i) => s + i.plannedAmount, 0)).toLocaleString()}）`
    )
  }

  return insights
}

export default router
