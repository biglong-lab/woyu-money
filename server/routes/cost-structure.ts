/**
 * 成本結構總覽 — 4 大成本來源聚合
 *
 * GET /api/dashboard/cost-structure?month=YYYY-MM
 *
 * 回傳：
 *  - rental: 該月應付租金（rental_contracts、有效期內）
 *  - hr: 該月人事成本（monthly_hr_costs）
 *  - template: 該月週期模板估算 + 已產出占位
 *  - manual: 該月一般單項（payment_items、排除 template_scheduled / hr / 租金重複）
 *  - alerts: 模板未產、HR 未發、租金逾期等警示
 *
 * 設計原則：
 *  - actual / planned 拆分（同 dashboard.ts 邏輯）
 *  - 各區塊 items[] 含 id 讓前端能點進原始頁
 *  - 避免雙算：manual 排除 source='template_scheduled' / 'hr' / 'auto_backfill'
 *    + 排除 item_name LIKE '%租金%' 等 rental 字樣（rental_contracts 才是 source of truth）
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { db } from "../db"
import { sql } from "drizzle-orm"
import { localMonthTPE, localDateTPE } from "@shared/date-utils"
import { generateItemsForMonth } from "../storage/recurring-expense-templates"

const router = Router()

function parseYearMonth(monthStr: string | undefined): {
  year: number
  month: number
  monthStr: string
} {
  const ym = monthStr && /^\d{4}-\d{2}$/.test(monthStr) ? monthStr : localMonthTPE()
  const [y, m] = ym.split("-").map(Number)
  return { year: y, month: m, monthStr: ym }
}

interface Alert {
  level: "info" | "warning" | "error"
  type: string
  message: string
}

interface RentalItem {
  contractId: number
  contractName: string
  tenantName: string | null
  projectName: string | null
  amount: number
  paymentDay: number
  paid: boolean
  paymentItemId: number | null
  paymentItemStatus: string | null
}

interface HrItem {
  employeeId: number
  employeeName: string | null
  position: string | null
  totalCost: number
  isPaid: boolean
}

interface TemplateGeneratedItem {
  itemId: number
  templateId: number | null
  templateName: string | null
  itemName: string
  estimatedAmount: number
  paidAmount: number
  status: string
  startDate: string
}

interface TemplateNotGenerated {
  templateId: number
  templateName: string
  estimatedAmount: number
  dayOfMonth: number
}

interface ManualItem {
  id: number
  itemName: string
  amount: number
  status: string
  startDate: string
  source: string
  categoryName: string | null
  projectName: string | null
}

interface AllowanceItem {
  id: number
  itemName: string
  amount: number
  status: string
  startDate: string
  notes: string | null
}

router.get(
  "/api/dashboard/cost-structure",
  asyncHandler(async (req, res) => {
    const { year, month, monthStr } = parseYearMonth(req.query.month as string | undefined)
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const nextMonth = `${endY}-${String(endM).padStart(2, "0")}-01`
    const today = localDateTPE()
    const currentMonth = today.slice(0, 7)
    const isPast = monthStr < currentMonth
    const isCurrent = monthStr === currentMonth
    const isFuture = monthStr > currentMonth

    const alerts: Alert[] = []

    // ============================================================
    // 1. 租金（rental_contracts、該月有效合約）
    // ============================================================
    const rentalRows = await db.execute(sql`
      SELECT
        rc.id AS "contractId",
        rc.contract_name AS "contractName",
        rc.tenant_name AS "tenantName",
        pp.project_name AS "projectName",
        rc.base_amount::numeric AS "amount",
        rc.contract_payment_day AS "paymentDay",
        rc.start_date AS "startDate",
        rc.end_date AS "endDate"
      FROM rental_contracts rc
      LEFT JOIN payment_projects pp ON pp.id = rc.project_id
      WHERE rc.is_active = true
        AND rc.start_date <= ${nextMonth}::date - INTERVAL '1 day'
        AND (rc.end_date IS NULL OR rc.end_date >= ${monthStart}::date)
    `)
    const rentalContracts = (rentalRows as unknown as { rows: Record<string, unknown>[] }).rows

    // 對應該月已產出的 payment_items（用 contract_name LIKE 對照、依現有設計）
    const rentalItemRows = await db.execute(sql`
      SELECT
        pi.id AS "paymentItemId",
        pi.item_name AS "itemName",
        pi.total_amount::numeric AS "amount",
        pi.paid_amount::numeric AS "paidAmount",
        pi.status,
        pi.start_date AS "startDate"
      FROM payment_items pi
      WHERE NOT pi.is_deleted
        AND pi.item_type IN ('project', 'home')
        AND pi.start_date >= ${monthStart}::date
        AND pi.start_date < ${nextMonth}::date
        AND (pi.item_name LIKE '%租約%' OR pi.item_name LIKE '%租金%')
    `)
    const rentalPaymentItems = (
      rentalItemRows as unknown as {
        rows: {
          paymentItemId: number
          itemName: string
          amount: string
          paidAmount: string
          status: string
          startDate: string
        }[]
      }
    ).rows

    // 組裝 rental items：合約 + 對應的 payment_item 狀態
    // 注意：空字串會被 .includes("") 永遠回 true、要先確認非空
    const matchedPaymentItemIds = new Set<number>()
    const rentalItems: RentalItem[] = rentalContracts.map((c) => {
      const contractName = String(c.contractName ?? "")
      const tenantName = String(c.tenantName ?? "")
      const matched = rentalPaymentItems.find((it) => {
        if (contractName.length >= 2 && it.itemName.includes(contractName)) return true
        if (tenantName.length >= 2 && it.itemName.includes(tenantName)) return true
        return false
      })
      if (matched) matchedPaymentItemIds.add(matched.paymentItemId)
      return {
        contractId: c.contractId as number,
        contractName: c.contractName as string,
        tenantName: (c.tenantName as string) ?? null,
        projectName: (c.projectName as string) ?? null,
        // 已產出 → 用實際 payment_item 金額；未產出 → 用合約 base_amount
        amount: matched ? parseFloat(matched.amount) : parseFloat(String(c.amount)),
        paymentDay: c.paymentDay as number,
        paid: matched?.status === "paid",
        paymentItemId: matched?.paymentItemId ?? null,
        paymentItemStatus: matched?.status ?? null,
      }
    })

    const rentalTotal = rentalItems.reduce((s, i) => s + i.amount, 0)
    const rentalActual = rentalItems.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0)
    const rentalPlanned = rentalTotal - rentalActual

    // 警示：本月或過去月有合約但 payment_item 未產出
    const rentalNotGenerated = rentalItems.filter((i) => !i.paymentItemId && !isFuture)
    if (rentalNotGenerated.length > 0) {
      alerts.push({
        level: "warning",
        type: "rental_not_generated",
        message: `${rentalNotGenerated.length} 個租約還沒在 ${monthStr} 產出付款項`,
      })
    }
    // 警示：過去月 + 未付
    if (isPast) {
      const overdue = rentalItems.filter(
        (i) => i.paymentItemStatus && i.paymentItemStatus !== "paid"
      )
      if (overdue.length > 0) {
        alerts.push({
          level: "error",
          type: "rental_overdue",
          message: `${overdue.length} 筆 ${monthStr} 租金逾期未付`,
        })
      }
    }

    // ============================================================
    // 2. HR 人事（monthly_hr_costs）
    // ============================================================
    const hrRows = await db.execute(sql`
      SELECT
        m.employee_id AS "employeeId",
        e.employee_name AS "employeeName",
        e.position,
        m.total_cost::numeric AS "totalCost",
        m.is_paid AS "isPaid"
      FROM monthly_hr_costs m
      LEFT JOIN employees e ON e.id = m.employee_id
      WHERE m.year = ${year} AND m.month = ${month}
      ORDER BY m.total_cost::numeric DESC
    `)
    const hrList = (
      hrRows as unknown as {
        rows: {
          employeeId: number
          employeeName: string | null
          position: string | null
          totalCost: string
          isPaid: boolean
        }[]
      }
    ).rows
    const hrItems: HrItem[] = hrList.map((r) => ({
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      position: r.position,
      totalCost: parseFloat(r.totalCost),
      isPaid: r.isPaid,
    }))
    const hrTotal = hrItems.reduce((s, i) => s + i.totalCost, 0)
    const hrPaid = hrItems.filter((i) => i.isPaid).reduce((s, i) => s + i.totalCost, 0)
    const hrUnpaid = hrTotal - hrPaid
    const hrUnpaidCount = hrItems.filter((i) => !i.isPaid).length

    if (hrItems.length === 0 && (isPast || isCurrent)) {
      alerts.push({
        level: "warning",
        type: "hr_no_record",
        message: `${monthStr} 還沒結算人事成本（monthly_hr_costs 無紀錄）`,
      })
    }
    if (hrUnpaidCount > 0) {
      alerts.push({
        level: "info",
        type: "hr_unpaid",
        message: `${hrUnpaidCount} 名員工 ${monthStr} 薪資未發放`,
      })
    }

    // ============================================================
    // 3. 週期模板（recurring_expense_templates + 已產出 payment_items）
    // ============================================================
    const tplRows = await db.execute(sql`
      SELECT
        t.id AS "templateId",
        t.template_name AS "templateName",
        t.estimated_amount::numeric AS "estimatedAmount",
        t.day_of_month AS "dayOfMonth",
        t.active_months AS "activeMonths",
        t.last_generated_month AS "lastGeneratedMonth"
      FROM recurring_expense_templates t
      WHERE t.is_active = true
    `)
    const allTemplates = (
      tplRows as unknown as {
        rows: {
          templateId: number
          templateName: string
          estimatedAmount: string
          dayOfMonth: number
          activeMonths: string
          lastGeneratedMonth: string | null
        }[]
      }
    ).rows

    // 過濾該月有效模板（activeMonths='*' 或 contains month）
    const activeForMonth = allTemplates.filter((t) => {
      if (t.activeMonths === "*") return true
      const months = t.activeMonths.split(",").map((s) => parseInt(s.trim(), 10))
      return months.includes(month)
    })

    // 該月已產出的 payment_items
    const tplItemRows = await db.execute(sql`
      SELECT
        pi.id AS "itemId",
        pi.recurring_template_id AS "templateId",
        t.template_name AS "templateName",
        pi.item_name AS "itemName",
        pi.total_amount::numeric AS "estimatedAmount",
        pi.paid_amount::numeric AS "paidAmount",
        pi.status,
        pi.start_date AS "startDate"
      FROM payment_items pi
      LEFT JOIN recurring_expense_templates t ON t.id = pi.recurring_template_id
      WHERE NOT pi.is_deleted
        AND pi.source = 'template_scheduled'
        AND pi.start_date >= ${monthStart}::date
        AND pi.start_date < ${nextMonth}::date
      ORDER BY pi.status, pi.start_date
    `)
    const generatedItems: TemplateGeneratedItem[] = (
      tplItemRows as unknown as {
        rows: {
          itemId: number
          templateId: number | null
          templateName: string | null
          itemName: string
          estimatedAmount: string
          paidAmount: string
          status: string
          startDate: string
        }[]
      }
    ).rows.map((r) => ({
      itemId: r.itemId,
      templateId: r.templateId,
      templateName: r.templateName,
      itemName: r.itemName,
      estimatedAmount: parseFloat(r.estimatedAmount),
      paidAmount: parseFloat(r.paidAmount),
      status: r.status,
      startDate: r.startDate,
    }))

    // 未產出的模板（active for this month 但沒有對應 payment_item）
    const generatedTemplateIds = new Set(
      generatedItems.map((g) => g.templateId).filter((id): id is number => id !== null)
    )
    const notGenerated: TemplateNotGenerated[] = activeForMonth
      .filter((t) => !generatedTemplateIds.has(t.templateId))
      .map((t) => ({
        templateId: t.templateId,
        templateName: t.templateName,
        estimatedAmount: parseFloat(t.estimatedAmount),
        dayOfMonth: t.dayOfMonth,
      }))

    const tplTotal = activeForMonth.reduce((s, t) => s + parseFloat(t.estimatedAmount), 0)
    const tplActual = generatedItems
      .filter((g) => g.status === "paid")
      .reduce((s, g) => s + g.estimatedAmount, 0)
    const tplPlanned = generatedItems
      .filter((g) => g.status !== "paid")
      .reduce((s, g) => s + g.estimatedAmount, 0)
    const tplNotGeneratedTotal = notGenerated.reduce((s, t) => s + t.estimatedAmount, 0)

    if (notGenerated.length > 0 && (isPast || isCurrent)) {
      alerts.push({
        level: "warning",
        type: "template_not_generated",
        message: `${notGenerated.length} 個模板 ${monthStr} 還沒產出占位（$${tplNotGeneratedTotal.toLocaleString()}）`,
      })
    }

    // ============================================================
    // 4.5 家庭零用金（kids,allowance tag）— 獨立為第 5 區
    // ============================================================
    const allowanceRows = await db.execute(sql`
      SELECT id, item_name AS "itemName", total_amount::numeric AS amount,
             status, start_date AS "startDate", notes
      FROM payment_items
      WHERE NOT is_deleted
        AND start_date >= ${monthStart}::date
        AND start_date < ${nextMonth}::date
        AND tags LIKE '%kids%'
      ORDER BY start_date DESC
    `)
    const allowanceItems: AllowanceItem[] = (
      allowanceRows as unknown as {
        rows: {
          id: number
          itemName: string
          amount: string
          status: string
          startDate: string
          notes: string | null
        }[]
      }
    ).rows.map((r) => ({
      id: r.id,
      itemName: r.itemName,
      amount: parseFloat(r.amount),
      status: r.status,
      startDate: r.startDate,
      notes: r.notes,
    }))
    const allowanceIdSet = new Set(allowanceItems.map((a) => a.id))
    const allowanceTotal = allowanceItems.reduce((s, a) => s + a.amount, 0)
    const allowanceActual = allowanceItems
      .filter((a) => a.status === "paid")
      .reduce((s, a) => s + a.amount, 0)
    const allowancePlanned = allowanceTotal - allowanceActual

    // ============================================================
    // 4. 一般單項（manual / webhook / pm-bridge / ai_scan）
    // ============================================================
    // 排除：source='template_scheduled' / 'hr' / 'auto_backfill'
    // 排除：category_id IN (2=租金, 28=租金物業)（rental_contracts 那邊算）
    // 排除：item_name LIKE '%租約%' / '%租金%'（兜底）
    // 排除：item_name LIKE '%薪資%' / '%勞保%' 等（HR 那邊算）
    // 排除：notes LIKE '%自動補建%'
    // 排除：rental matching 已用過的 payment_item id（避免雙算）
    // 排除：allowance（家庭零用金）已歸第 5 區（避免雙算）
    const RENTAL_CATEGORY_IDS = [2, 28]
    const excludeIds = [...Array.from(matchedPaymentItemIds), ...Array.from(allowanceIdSet)]
    // Drizzle sql template 對 array 用 sql.raw 拼接 ID 清單（無 user 輸入、安全）
    const usedRentalIdsSql =
      excludeIds.length > 0 ? sql.raw(`AND pi.id NOT IN (${excludeIds.join(",")})`) : sql.raw("")
    const manualRows = await db.execute(sql`
      SELECT
        pi.id,
        pi.item_name AS "itemName",
        pi.total_amount::numeric AS "amount",
        pi.status,
        pi.start_date AS "startDate",
        pi.source,
        COALESCE(dc.category_name, fc.category_name) AS "categoryName",
        pp.project_name AS "projectName"
      FROM payment_items pi
      LEFT JOIN debt_categories dc ON dc.id = pi.category_id
      LEFT JOIN fixed_categories fc ON fc.id = pi.fixed_category_id
      LEFT JOIN payment_projects pp ON pp.id = pi.project_id
      WHERE NOT pi.is_deleted
        AND pi.item_type IN ('project', 'home')
        AND pi.start_date >= ${monthStart}::date
        AND pi.start_date < ${nextMonth}::date
        AND pi.source NOT IN ('template_scheduled', 'hr', 'auto_backfill')
        -- 排除租金分類（rental_contracts 那邊算）
        AND (pi.category_id IS NULL OR pi.category_id NOT IN (${sql.raw(RENTAL_CATEGORY_IDS.join(","))}))
        -- 兜底：item_name 含租字也排除
        AND pi.item_name NOT LIKE '%租約%'
        AND pi.item_name NOT LIKE '%租金%'
        AND pi.item_name NOT LIKE '%薪資%'
        AND pi.item_name NOT LIKE '%薪水%'
        AND pi.item_name NOT LIKE '%勞保%'
        AND pi.item_name NOT LIKE '%勞退%'
        AND pi.item_name NOT LIKE '%健保%'
        AND pi.item_name NOT LIKE '%房務薪%'
        AND pi.item_name NOT LIKE '%客務薪%'
        AND (pp.project_name IS NULL OR pp.project_name != '人力成本')
        AND (pi.notes IS NULL OR pi.notes NOT LIKE '%自動補建%')
        ${usedRentalIdsSql}
      ORDER BY pi.total_amount::numeric DESC
    `)
    const manualItems: ManualItem[] = (
      manualRows as unknown as {
        rows: {
          id: number
          itemName: string
          amount: string
          status: string
          startDate: string
          source: string
          categoryName: string | null
          projectName: string | null
        }[]
      }
    ).rows.map((r) => ({
      id: r.id,
      itemName: r.itemName,
      amount: parseFloat(r.amount),
      status: r.status,
      startDate: r.startDate,
      source: r.source,
      categoryName: r.categoryName,
      projectName: r.projectName,
    }))

    const manualTotal = manualItems.reduce((s, i) => s + i.amount, 0)
    const manualActual = manualItems
      .filter((i) => i.status === "paid" && i.startDate <= today)
      .reduce((s, i) => s + i.amount, 0)
    const manualPlanned = manualTotal - manualActual

    // ============================================================
    // 5. 總計 + 回傳
    // ============================================================
    const grandTotal = rentalTotal + hrTotal + tplTotal + manualTotal + allowanceTotal
    const grandActual = rentalActual + hrPaid + tplActual + manualActual + allowanceActual
    const grandPlanned = grandTotal - grandActual

    res.json({
      month: monthStr,
      year,
      monthNum: month,
      rental: {
        total: rentalTotal,
        actual: rentalActual,
        planned: rentalPlanned,
        count: rentalItems.length,
        items: rentalItems,
      },
      hr: {
        total: hrTotal,
        actual: hrPaid,
        planned: hrUnpaid,
        count: hrItems.length,
        unpaidCount: hrUnpaidCount,
        items: hrItems,
      },
      template: {
        total: tplTotal,
        actual: tplActual,
        planned: tplPlanned + tplNotGeneratedTotal, // 未產出也算 planned
        count: generatedItems.length,
        notGeneratedCount: notGenerated.length,
        generatedItems,
        notGenerated,
      },
      manual: {
        total: manualTotal,
        actual: manualActual,
        planned: manualPlanned,
        count: manualItems.length,
        items: manualItems,
      },
      allowance: {
        total: allowanceTotal,
        actual: allowanceActual,
        planned: allowancePlanned,
        count: allowanceItems.length,
        items: allowanceItems,
      },
      grandTotal,
      grandActual,
      grandPlanned,
      alerts,
    })
  })
)

/**
 * POST /api/dashboard/cost-structure/generate-missing?month=YYYY-MM
 * 一鍵把該月所有 active 模板產出占位（不等 day_of_month）
 *
 * 用於「成本結構總覽」看完貌、不用每個模板各別產
 */
router.post(
  "/api/dashboard/cost-structure/generate-missing",
  asyncHandler(async (req, res) => {
    const monthQ = (req.body?.month as string) ?? (req.query.month as string)
    const { monthStr } = parseYearMonth(monthQ)
    const result = await generateItemsForMonth(monthStr)
    res.json({
      month: monthStr,
      generated: result.generated.length,
      skipped: result.skipped.length,
      skippedReasons: result.skipped,
    })
  })
)

export default router
