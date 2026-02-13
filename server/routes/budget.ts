/**
 * 預算管理 API 路由
 * 包含預算計劃 CRUD、預算項目管理、轉換為付款項目
 */
import { Router } from "express"
import { insertBudgetPlanSchema, insertBudgetItemSchema } from "@shared/schema"
import { asyncHandler, AppError } from "../middleware/error-handler"
import * as budgetStorage from "../storage/budget"

const router = Router()

// 輔助函數：根據付款類型計算項目總額（純計算，保留在路由層）
function calculateItemTotal(item: {
  paymentType?: string | null
  monthlyAmount?: string | null
  monthCount?: string | number | null
  plannedAmount?: string | null
}): number {
  const paymentType = item.paymentType || "single"

  if (paymentType === "monthly") {
    const monthlyAmount = parseFloat(item.monthlyAmount || "0")
    const monthCount =
      typeof item.monthCount === "number" ? item.monthCount : parseInt(item.monthCount || "1") || 1
    return monthlyAmount * monthCount
  }

  return parseFloat(item.plannedAmount || "0")
}

// 取得所有預算計劃
router.get(
  "/api/budget/plans",
  asyncHandler(async (req, res) => {
    const { projectId, status, includeItems } = req.query

    const filters: { projectId?: number; status?: string } = {}
    if (projectId) filters.projectId = parseInt(projectId as string)
    if (status) filters.status = status as string

    const plans = await budgetStorage.getBudgetPlans(filters)

    const plansWithCalculatedTotals = await Promise.all(
      plans.map(async (plan) => {
        const items = await budgetStorage.getBudgetItemsByPlan(plan.id)

        const calculatedTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0)

        if (includeItems === "true") {
          return { ...plan, items, calculatedTotal }
        }
        return { ...plan, calculatedTotal }
      })
    )

    res.json(plansWithCalculatedTotals)
  })
)

// 取得單一預算計劃詳情
router.get(
  "/api/budget/plans/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的預算計劃 ID")

    const plan = await budgetStorage.getBudgetPlan(id)
    if (!plan) throw new AppError(404, "預算計劃不存在")

    const items = await budgetStorage.getBudgetItemsByPlan(id)
    const calculatedTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0)

    res.json({ ...plan, items, calculatedTotal })
  })
)

// 新建預算計劃
router.post(
  "/api/budget/plans",
  asyncHandler(async (req, res) => {
    try {
      const validated = insertBudgetPlanSchema.parse(req.body)
      const newPlan = await budgetStorage.createBudgetPlan(validated)
      res.status(201).json(newPlan)
    } catch (error: unknown) {
      if (error instanceof AppError) throw error
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "ZodError" &&
        "errors" in error
      ) {
        return res.status(400).json({
          message: "資料驗證失敗",
          errors: (error as { errors: unknown }).errors,
        })
      }
      throw error
    }
  })
)

// 更新預算計劃
router.patch(
  "/api/budget/plans/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的預算計劃 ID")

    const updatedPlan = await budgetStorage.updateBudgetPlan(id, req.body)
    if (!updatedPlan) throw new AppError(404, "預算計劃不存在")

    res.json(updatedPlan)
  })
)

// 刪除預算計劃
router.delete(
  "/api/budget/plans/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的預算計劃 ID")

    await budgetStorage.deleteBudgetPlan(id)
    res.status(204).send()
  })
)

// 取得預算項目列表
router.get(
  "/api/budget/items",
  asyncHandler(async (req, res) => {
    const { budgetPlanId, convertedToPayment } = req.query

    const filters: {
      budgetPlanId?: number
      convertedToPayment?: boolean
    } = {}

    if (budgetPlanId) {
      filters.budgetPlanId = parseInt(budgetPlanId as string)
    }
    if (convertedToPayment !== undefined) {
      filters.convertedToPayment = convertedToPayment === "true"
    }

    const items = await budgetStorage.getBudgetItems(filters)
    res.json(items)
  })
)

// 取得單一預算項目
router.get(
  "/api/budget/items/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的預算項目 ID")

    const item = await budgetStorage.getBudgetItem(id)
    if (!item) throw new AppError(404, "預算項目不存在")

    res.json(item)
  })
)

// 新建預算項目
router.post(
  "/api/budget/items",
  asyncHandler(async (req, res) => {
    try {
      const validated = insertBudgetItemSchema.parse(req.body)
      const newItem = await budgetStorage.createBudgetItem(validated)

      if (validated.actualAmount) {
        await budgetStorage.updateBudgetPlanActualSpent(validated.budgetPlanId)
      }

      res.status(201).json(newItem)
    } catch (error: unknown) {
      if (error instanceof AppError) throw error
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "ZodError" &&
        "errors" in error
      ) {
        return res.status(400).json({
          message: "資料驗證失敗",
          errors: (error as { errors: unknown }).errors,
        })
      }
      throw error
    }
  })
)

// 更新預算項目
router.patch(
  "/api/budget/items/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的預算項目 ID")

    const updateData: Record<string, unknown> = { ...req.body }

    // 計算差異值
    if (req.body.actualAmount !== undefined && req.body.plannedAmount !== undefined) {
      const planned = parseFloat(req.body.plannedAmount)
      const actual = parseFloat(req.body.actualAmount)
      updateData.variance = (planned - actual).toFixed(2)
      updateData.variancePercentage =
        planned > 0 ? (((planned - actual) / planned) * 100).toFixed(2) : "0.00"
    }

    const updatedItem = await budgetStorage.updateBudgetItem(id, updateData)
    if (!updatedItem) throw new AppError(404, "預算項目不存在")

    await budgetStorage.updateBudgetPlanActualSpent(updatedItem.budgetPlanId)

    res.json(updatedItem)
  })
)

// 刪除預算項目（軟刪除）
router.delete(
  "/api/budget/items/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的預算項目 ID")

    const item = await budgetStorage.softDeleteBudgetItem(id)

    if (item) {
      await budgetStorage.updateBudgetPlanActualSpent(item.budgetPlanId)
    }

    res.status(204).send()
  })
)

// 將預算項目轉換為付款項目
router.post(
  "/api/budget/items/:id/convert",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的預算項目 ID")

    try {
      const result = await budgetStorage.convertBudgetItemToPayment(id)

      res.status(201).json({
        message: "預算項目已成功轉換為付款項目",
        paymentItem: result.paymentItem,
        budgetItemId: id,
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "預算項目不存在") {
          throw new AppError(404, error.message)
        }
        if (error.message === "該預算項目已轉換為付款項目") {
          throw new AppError(400, error.message)
        }
      }
      throw error
    }
  })
)

// 取得預算計劃統計摘要
router.get(
  "/api/budget/plans/:id/summary",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的預算計劃 ID")

    const plan = await budgetStorage.getBudgetPlan(id)
    if (!plan) throw new AppError(404, "預算計劃不存在")

    const items = await budgetStorage.getBudgetItemsByPlan(id)

    const calculatedTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0)
    const totalActual = items.reduce((sum, item) => sum + parseFloat(item.actualAmount || "0"), 0)
    const convertedCount = items.filter((item) => item.convertedToPayment).length
    const pendingCount = items.filter((item) => !item.convertedToPayment).length

    const byPaymentType = {
      single: items.filter((item) => !item.paymentType || item.paymentType === "single"),
      installment: items.filter((item) => item.paymentType === "installment"),
      monthly: items.filter((item) => item.paymentType === "monthly"),
    }

    const byPaymentTypeTotal = {
      single: byPaymentType.single.reduce((sum, item) => sum + calculateItemTotal(item), 0),
      installment: byPaymentType.installment.reduce(
        (sum, item) => sum + calculateItemTotal(item),
        0
      ),
      monthly: byPaymentType.monthly.reduce((sum, item) => sum + calculateItemTotal(item), 0),
    }

    res.json({
      plan,
      summary: {
        totalBudget: parseFloat(plan.totalBudget || "0"),
        calculatedTotal,
        totalActual,
        variance: calculatedTotal - totalActual,
        utilizationRate:
          calculatedTotal > 0 ? ((totalActual / calculatedTotal) * 100).toFixed(1) : 0,
        conversionRate: items.length > 0 ? ((convertedCount / items.length) * 100).toFixed(1) : 0,
        itemCount: items.length,
        convertedCount,
        pendingCount,
        byPaymentType: {
          single: {
            count: byPaymentType.single.length,
            total: byPaymentTypeTotal.single,
          },
          installment: {
            count: byPaymentType.installment.length,
            total: byPaymentTypeTotal.installment,
          },
          monthly: {
            count: byPaymentType.monthly.length,
            total: byPaymentTypeTotal.monthly,
          },
        },
      },
    })
  })
)

export default router
