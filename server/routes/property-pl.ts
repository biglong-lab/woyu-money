/**
 * 館別損益報表 API（PR-5）
 *
 * GET /api/reports/property-pl?year=YYYY&month=MM
 *
 * 邏輯：
 * 1. 取所有 active payment_projects（5 個館）+ 1 個「公司級」虛擬項目
 * 2. 對每個館：
 *    a) 收入：dailyRevenues 該月總額
 *    b) 直接開銷：payment_records 該月該 project 已付款總額
 *    c) 攤提開銷：budget_item_allocations 該月該 project 分到的金額
 *    d) 淨利 = 收入 - 直接 - 攤提
 *    e) 淨利率 = 淨利 / 收入
 * 3. 公司級：attribution='company' 的 budget_items 加總
 *
 * 回傳：
 *   {
 *     year, month,
 *     totals: { revenue, expense, netProfit, marginPercent },
 *     properties: [{ projectId, projectName, revenue, directExpense, allocatedExpense, netProfit, marginPercent }],
 *     companyLevel: { totalExpense, items: [...] }
 *   }
 */

import { Router } from "express"
import { sql } from "drizzle-orm"
import { db } from "../db"
import { paymentProjects } from "@shared/schema"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { requireAuth } from "../auth"

const router = Router()

interface PropertyRow {
  projectId: number
  projectName: string
  revenue: number
  directExpense: number
  allocatedExpense: number
  netProfit: number
  marginPercent: number
  // 細項展開（給點擊看詳情用）
  expenseBreakdown: { categoryName: string; amount: number }[]
}

interface CompanyItem {
  itemName: string
  amount: number
  categoryName: string | null
}

interface ReportResponse {
  year: number
  month: number
  totals: {
    revenue: number
    expense: number
    netProfit: number
    marginPercent: number
  }
  properties: PropertyRow[]
  companyLevel: {
    totalExpense: number
    items: CompanyItem[]
  }
}

router.get(
  "/api/reports/property-pl",
  requireAuth,
  asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year as string)
    const month = parseInt(req.query.month as string)
    if (!year || !month || month < 1 || month > 12) {
      throw new AppError(400, "請提供有效的 year 與 month")
    }

    // ── 1. 取所有 active project ─────────────────────
    const projects = await db
      .select({ id: paymentProjects.id, projectName: paymentProjects.projectName })
      .from(paymentProjects)
      .where(sql`COALESCE(is_active, true) = true AND COALESCE(is_deleted, false) = false`)

    // ── 2. 收入：daily_revenues 月加總（依 project_id）
    const revenueRows = await db.execute<{
      project_id: number
      total: string
    }>(sql`
      SELECT project_id, SUM(amount::numeric)::text AS total
      FROM daily_revenues
      WHERE EXTRACT(YEAR FROM revenue_date)::int = ${year}
        AND EXTRACT(MONTH FROM revenue_date)::int = ${month}
        AND COALESCE(is_deleted, false) = false
      GROUP BY project_id
    `)

    const revenueMap = new Map<number, number>()
    for (const r of revenueRows.rows as { project_id: number; total: string }[]) {
      revenueMap.set(Number(r.project_id), Number(r.total))
    }

    // ── 3. 直接開銷：payment_records 該月加總（含分類） ──
    const directExpenseRows = await db.execute<{
      project_id: number
      category_name: string | null
      total: string
    }>(sql`
      SELECT
        pi.project_id,
        COALESCE(fc.category_name, dc.category_name) AS category_name,
        SUM(pr.amount_paid::numeric)::text AS total
      FROM payment_records pr
      JOIN payment_items pi ON pi.id = pr.payment_item_id
      LEFT JOIN fixed_categories fc ON fc.id = pi.fixed_category_id
      LEFT JOIN debt_categories dc ON dc.id = pi.category_id
      WHERE EXTRACT(YEAR FROM pr.payment_date)::int = ${year}
        AND EXTRACT(MONTH FROM pr.payment_date)::int = ${month}
        AND COALESCE(pi.is_deleted, false) = false
        AND pi.project_id IS NOT NULL
      GROUP BY pi.project_id, COALESCE(fc.category_name, dc.category_name)
    `)

    // 整合：依 project_id 分組
    const directExpenseByProject = new Map<
      number,
      { total: number; breakdown: Map<string, number> }
    >()
    for (const r of directExpenseRows.rows as {
      project_id: number
      category_name: string | null
      total: string
    }[]) {
      const pid = Number(r.project_id)
      const cat = r.category_name ?? "未分類"
      const amount = Number(r.total)
      if (!directExpenseByProject.has(pid)) {
        directExpenseByProject.set(pid, { total: 0, breakdown: new Map() })
      }
      const entry = directExpenseByProject.get(pid)!
      entry.total += amount
      entry.breakdown.set(cat, (entry.breakdown.get(cat) ?? 0) + amount)
    }

    // ── 4. 攤提開銷：budget_item_allocations × 對應 budget_items 是 plan 此月份 ──
    const allocationRows = await db.execute<{
      project_id: number
      total: string
    }>(sql`
      SELECT
        bia.project_id,
        SUM(bia.allocated_amount::numeric)::text AS total
      FROM budget_item_allocations bia
      JOIN budget_items bi ON bi.id = bia.budget_item_id
      JOIN budget_plans bp ON bp.id = bi.budget_plan_id
      WHERE bi.attribution = 'shared'
        AND COALESCE(bi.is_deleted, false) = false
        AND EXTRACT(YEAR FROM bp.start_date)::int = ${year}
        AND EXTRACT(MONTH FROM bp.start_date)::int = ${month}
      GROUP BY bia.project_id
    `)

    const allocatedExpenseMap = new Map<number, number>()
    for (const r of allocationRows.rows as { project_id: number; total: string }[]) {
      allocatedExpenseMap.set(Number(r.project_id), Number(r.total))
    }

    // ── 5. 公司級費用：budget_items where attribution='company' ──
    const companyRows = await db.execute<{
      item_name: string
      planned_amount: string
      category_name: string | null
    }>(sql`
      SELECT
        bi.item_name,
        bi.planned_amount,
        COALESCE(fc.category_name, dc.category_name) AS category_name
      FROM budget_items bi
      JOIN budget_plans bp ON bp.id = bi.budget_plan_id
      LEFT JOIN fixed_categories fc ON fc.id = bi.fixed_category_id
      LEFT JOIN debt_categories dc ON dc.id = bi.category_id
      WHERE bi.attribution = 'company'
        AND COALESCE(bi.is_deleted, false) = false
        AND EXTRACT(YEAR FROM bp.start_date)::int = ${year}
        AND EXTRACT(MONTH FROM bp.start_date)::int = ${month}
      ORDER BY bi.item_name
    `)

    const companyItems: CompanyItem[] = (
      companyRows.rows as {
        item_name: string
        planned_amount: string
        category_name: string | null
      }[]
    ).map((r) => ({
      itemName: r.item_name,
      amount: Number(r.planned_amount),
      categoryName: r.category_name,
    }))

    const companyTotal = companyItems.reduce((s, i) => s + i.amount, 0)

    // ── 6. 組裝每個 property 的損益 ────────────────────
    const properties: PropertyRow[] = projects.map((p) => {
      const revenue = revenueMap.get(p.id) ?? 0
      const direct = directExpenseByProject.get(p.id)
      const directExpense = direct?.total ?? 0
      const allocatedExpense = allocatedExpenseMap.get(p.id) ?? 0
      const totalExpense = directExpense + allocatedExpense
      const netProfit = revenue - totalExpense
      const marginPercent = revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0

      const breakdown: { categoryName: string; amount: number }[] = []
      if (direct) {
        direct.breakdown.forEach((amount, cat) => {
          breakdown.push({ categoryName: cat, amount })
        })
        breakdown.sort((a, b) => b.amount - a.amount)
      }
      if (allocatedExpense > 0) {
        breakdown.push({ categoryName: "[共用攤提]", amount: allocatedExpense })
      }

      return {
        projectId: p.id,
        projectName: p.projectName,
        revenue,
        directExpense,
        allocatedExpense,
        netProfit,
        marginPercent,
        expenseBreakdown: breakdown,
      }
    })

    // 過濾：只保留有任何收入或開銷的 property
    const activeProperties = properties.filter(
      (p) => p.revenue > 0 || p.directExpense > 0 || p.allocatedExpense > 0
    )

    // ── 7. 全公司彙總 ──────────────────────────────────
    const totalRevenue = properties.reduce((s, p) => s + p.revenue, 0)
    const totalPropertyExpense = properties.reduce(
      (s, p) => s + p.directExpense + p.allocatedExpense,
      0
    )
    const grandExpense = totalPropertyExpense + companyTotal
    const grandNetProfit = totalRevenue - grandExpense
    const grandMargin =
      totalRevenue > 0 ? Math.round((grandNetProfit / totalRevenue) * 1000) / 10 : 0

    const response: ReportResponse = {
      year,
      month,
      totals: {
        revenue: totalRevenue,
        expense: grandExpense,
        netProfit: grandNetProfit,
        marginPercent: grandMargin,
      },
      properties: activeProperties.sort((a, b) => b.revenue - a.revenue),
      companyLevel: {
        totalExpense: companyTotal,
        items: companyItems,
      },
    }

    res.json(response)
  })
)

export default router
