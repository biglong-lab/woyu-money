/**
 * 排程分配規劃台 API
 *
 * - GET    /api/payment-planner                取得應付款清單 + 規劃分配（矩陣資料）
 * - POST   /api/payment-planner/allocations    新增一筆分配（某筆排在某月付多少）
 * - PUT    /api/payment-planner/allocations/:id 更新分配
 * - DELETE /api/payment-planner/allocations/:id 刪除分配
 * - POST   /api/payment-planner/auto-distribute 自動分配（by_due / even）
 *
 * 收入預測沿用 /api/cashflow/forecast（前端另抓），本端點只負責應付款 + 規劃層。
 */
import { Router } from "express"
import { z } from "zod"
import { asyncHandler, AppError } from "../middleware/error-handler"
import {
  insertPaymentPlanAllocationSchema,
  insertItemCategorySchema,
  insertCategoryBudgetSchema,
} from "@shared/schema"
import * as planStore from "../storage/payment-plan"
import { getPriorityReport } from "../services/payment-priority.service"

const router = Router()

function parseId(raw: string): number {
  const id = parseInt(raw, 10)
  if (isNaN(id)) throw new AppError(400, "無效的 ID")
  return id
}

// 月份工具
function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
function currentMonth(): string {
  return ym(new Date())
}
function addMonthsYm(base: string, n: number): string {
  const [y, m] = base.split("-").map(Number)
  return ym(new Date(y, m - 1 + n, 1))
}
function clampMonth(target: string, min: string, max: string): string {
  if (target < min) return min
  if (target > max) return max
  return target
}

// ─────────────────────────────────────────────
// GET 矩陣資料：應付款清單 + 規劃分配
// ─────────────────────────────────────────────
router.get(
  "/api/payment-planner",
  asyncHandler(async (_req, res) => {
    const [report, overrides, budgets] = await Promise.all([
      getPriorityReport({ includeLow: true }),
      planStore.getItemCategories(),
      planStore.getCategoryBudgets(),
    ])
    const overrideMap = new Map(overrides.map((o) => [o.paymentItemId, o.category]))

    const items = report.all
      .filter((r) => r.unpaidAmount > 0)
      .map((r) => ({
        id: r.id,
        itemName: r.itemName,
        categoryLabel: r.categoryLabel,
        // 自訂分類優先、否則用引擎判定
        category: overrideMap.get(r.id) ?? r.categoryLabel,
        urgency: r.urgency,
        unpaidAmount: r.unpaidAmount,
        dueDate: r.dueDate,
        projectName: r.projectName,
      }))

    const categoryBudgets = budgets.map((b) => ({
      category: b.category,
      plannedMonth: b.plannedMonth,
      amount: Number(b.amount),
    }))

    res.json({ items, categoryBudgets, totalUnpaid: report.totalUnpaid })
  })
)

// ─────────────────────────────────────────────
// 分類覆寫
// ─────────────────────────────────────────────
router.put(
  "/api/payment-planner/item-category",
  asyncHandler(async (req, res) => {
    const parsed = insertItemCategorySchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(400, "資料驗證失敗")
    res.json(await planStore.setItemCategory(parsed.data.paymentItemId, parsed.data.category))
  })
)

// ─────────────────────────────────────────────
// 分類月度預算
// ─────────────────────────────────────────────
router.put(
  "/api/payment-planner/category-budget",
  asyncHandler(async (req, res) => {
    const parsed = insertCategoryBudgetSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(400, "資料驗證失敗")
    await planStore.setCategoryBudget(
      parsed.data.category,
      parsed.data.plannedMonth,
      parsed.data.amount
    )
    res.json({ success: true })
  })
)

const distributeSchema = z.object({
  category: z.string().trim().min(1),
  amount: z.number().nonnegative(),
  months: z.array(z.string().regex(/^\d{4}-\d{2}$/)).min(1),
})
router.post(
  "/api/payment-planner/distribute",
  asyncHandler(async (req, res) => {
    const parsed = distributeSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(400, "參數錯誤")
    await planStore.distributeCategory(parsed.data.category, parsed.data.amount, parsed.data.months)
    res.json({ success: true })
  })
)

// ─────────────────────────────────────────────
// 分配 CRUD
// ─────────────────────────────────────────────
router.post(
  "/api/payment-planner/allocations",
  asyncHandler(async (req, res) => {
    const parsed = insertPaymentPlanAllocationSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(
        400,
        "資料驗證失敗：" + parsed.error.errors.map((e) => e.message).join("、")
      )
    }
    res.json(await planStore.createAllocation(parsed.data))
  })
)

router.put(
  "/api/payment-planner/allocations/:id",
  asyncHandler(async (req, res) => {
    const parsed = insertPaymentPlanAllocationSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, "資料驗證失敗")
    }
    const row = await planStore.updateAllocation(parseId(req.params.id), parsed.data)
    if (!row) throw new AppError(404, "找不到該分配")
    res.json(row)
  })
)

router.delete(
  "/api/payment-planner/allocations/:id",
  asyncHandler(async (req, res) => {
    await planStore.deleteAllocation(parseId(req.params.id))
    res.json({ success: true })
  })
)

// ─────────────────────────────────────────────
// 自動分配
//   by_due：每筆未分配餘額 → 其到期月（逾期/過早則夾到本月、超出範圍夾到末月）
//   even  ：每筆未分配餘額 → 未來 N 個月平均攤開
// ─────────────────────────────────────────────
const autoSchema = z.object({
  monthsAhead: z.number().int().min(1).max(36).default(12),
  strategy: z.enum(["by_due", "even"]).default("by_due"),
})

router.post(
  "/api/payment-planner/auto-distribute",
  asyncHandler(async (req, res) => {
    const parsed = autoSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw new AppError(400, "參數錯誤")
    const { monthsAhead, strategy } = parsed.data

    const report = await getPriorityReport({ includeLow: true })
    const items = report.all.filter((r) => r.unpaidAmount > 0)
    const itemIds = items.map((i) => i.id)

    // 先清空這些項目的既有規劃，再重排
    await planStore.deleteAllocationsForItems(itemIds)

    const minMonth = currentMonth()
    const maxMonth = addMonthsYm(minMonth, monthsAhead - 1)
    const rows: Array<{ paymentItemId: number; plannedMonth: string; plannedAmount: string }> = []

    for (const item of items) {
      const total = item.unpaidAmount
      if (strategy === "by_due") {
        const dueYm = item.dueDate ? item.dueDate.slice(0, 7) : minMonth
        const month = clampMonth(dueYm, minMonth, maxMonth)
        rows.push({ paymentItemId: item.id, plannedMonth: month, plannedAmount: total.toFixed(2) })
      } else {
        // even：平均攤到 N 個月（最後一期吸收餘數）
        const per = Math.floor((total / monthsAhead) * 100) / 100
        let allocated = 0
        for (let i = 0; i < monthsAhead; i++) {
          const amount = i === monthsAhead - 1 ? Math.round((total - allocated) * 100) / 100 : per
          allocated += per
          if (amount <= 0) continue
          rows.push({
            paymentItemId: item.id,
            plannedMonth: addMonthsYm(minMonth, i),
            plannedAmount: amount.toFixed(2),
          })
        }
      }
    }

    const created = await planStore.bulkCreateAllocations(rows)
    res.json({ success: true, strategy, created: created.length, itemCount: items.length })
  })
)

export default router
