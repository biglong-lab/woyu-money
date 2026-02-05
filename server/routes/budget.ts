import { Router } from "express"
import { db } from "../db"
import {
  budgetPlans,
  budgetItems,
  paymentItems,
  insertBudgetPlanSchema,
  insertBudgetItemSchema,
} from "@shared/schema"
import { eq, desc, and } from "drizzle-orm"

const router = Router()

// 輔助函數：根據付款類型計算項目總額
function calculateItemTotal(item: any): number {
  const paymentType = item.paymentType || "single"

  if (paymentType === "monthly") {
    const monthlyAmount = parseFloat(item.monthlyAmount || "0")
    const monthCount = parseInt(item.monthCount || "1") || 1
    return monthlyAmount * monthCount
  } else if (paymentType === "installment") {
    return parseFloat(item.plannedAmount || "0")
  } else {
    return parseFloat(item.plannedAmount || "0")
  }
}

// 輔助函數：更新預算計劃的實際支出
async function updateBudgetPlanActualSpent(budgetPlanId: number) {
  const items = await db
    .select()
    .from(budgetItems)
    .where(and(eq(budgetItems.budgetPlanId, budgetPlanId), eq(budgetItems.isDeleted, false)))

  const totalActual = items.reduce(
    (sum, item) => sum + parseFloat(item.actualAmount || "0"),
    0
  )

  await db
    .update(budgetPlans)
    .set({ actualSpent: totalActual.toFixed(2), updatedAt: new Date() })
    .where(eq(budgetPlans.id, budgetPlanId))
}

// 取得所有預算計劃
router.get("/api/budget/plans", async (req, res) => {
  try {
    const { projectId, status, includeItems } = req.query

    let query = db.select().from(budgetPlans)
    const conditions: any[] = []

    if (projectId) {
      conditions.push(eq(budgetPlans.projectId, parseInt(projectId as string)))
    }
    if (status) {
      conditions.push(eq(budgetPlans.status, status as string))
    }

    const plans =
      conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(desc(budgetPlans.createdAt))
        : await query.orderBy(desc(budgetPlans.createdAt))

    const plansWithCalculatedTotals = await Promise.all(
      plans.map(async (plan) => {
        const items = await db
          .select()
          .from(budgetItems)
          .where(and(eq(budgetItems.budgetPlanId, plan.id), eq(budgetItems.isDeleted, false)))
          .orderBy(budgetItems.priority, budgetItems.createdAt)

        const calculatedTotal = items.reduce(
          (sum, item) => sum + calculateItemTotal(item),
          0
        )

        if (includeItems === "true") {
          return { ...plan, items, calculatedTotal }
        }
        return { ...plan, calculatedTotal }
      })
    )

    res.json(plansWithCalculatedTotals)
  } catch (error: any) {
    console.error("Error fetching budget plans:", error)
    res.status(500).json({ message: "獲取預算計劃失敗" })
  }
})

// 取得單一預算計劃詳情
router.get("/api/budget/plans/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const [plan] = await db.select().from(budgetPlans).where(eq(budgetPlans.id, id))

    if (!plan) {
      return res.status(404).json({ message: "預算計劃不存在" })
    }

    const items = await db
      .select()
      .from(budgetItems)
      .where(and(eq(budgetItems.budgetPlanId, id), eq(budgetItems.isDeleted, false)))
      .orderBy(budgetItems.priority, budgetItems.createdAt)

    const calculatedTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0)

    res.json({ ...plan, items, calculatedTotal })
  } catch (error: any) {
    console.error("Error fetching budget plan:", error)
    res.status(500).json({ message: "獲取預算計劃詳情失敗" })
  }
})

// 新建預算計劃
router.post("/api/budget/plans", async (req, res) => {
  try {
    const validated = insertBudgetPlanSchema.parse(req.body)

    const [newPlan] = await db.insert(budgetPlans).values(validated).returning()

    res.status(201).json(newPlan)
  } catch (error: any) {
    console.error("Error creating budget plan:", error)
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "資料驗證失敗", errors: error.errors })
    }
    res.status(500).json({ message: "建立預算計劃失敗" })
  }
})

// 更新預算計劃
router.patch("/api/budget/plans/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const [updatedPlan] = await db
      .update(budgetPlans)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(budgetPlans.id, id))
      .returning()

    if (!updatedPlan) {
      return res.status(404).json({ message: "預算計劃不存在" })
    }

    res.json(updatedPlan)
  } catch (error: any) {
    console.error("Error updating budget plan:", error)
    res.status(500).json({ message: "更新預算計劃失敗" })
  }
})

// 刪除預算計劃
router.delete("/api/budget/plans/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    await db.delete(budgetItems).where(eq(budgetItems.budgetPlanId, id))
    await db.delete(budgetPlans).where(eq(budgetPlans.id, id))

    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting budget plan:", error)
    res.status(500).json({ message: "刪除預算計劃失敗" })
  }
})

// 取得預算項目列表
router.get("/api/budget/items", async (req, res) => {
  try {
    const { budgetPlanId, convertedToPayment } = req.query

    let query = db.select().from(budgetItems)
    const conditions: any[] = [eq(budgetItems.isDeleted, false)]

    if (budgetPlanId) {
      conditions.push(eq(budgetItems.budgetPlanId, parseInt(budgetPlanId as string)))
    }
    if (convertedToPayment !== undefined) {
      conditions.push(eq(budgetItems.convertedToPayment, convertedToPayment === "true"))
    }

    const items = await query
      .where(and(...conditions))
      .orderBy(budgetItems.priority, budgetItems.createdAt)

    res.json(items)
  } catch (error: any) {
    console.error("Error fetching budget items:", error)
    res.status(500).json({ message: "獲取預算項目失敗" })
  }
})

// 取得單一預算項目
router.get("/api/budget/items/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const [item] = await db.select().from(budgetItems).where(eq(budgetItems.id, id))

    if (!item) {
      return res.status(404).json({ message: "預算項目不存在" })
    }

    res.json(item)
  } catch (error: any) {
    console.error("Error fetching budget item:", error)
    res.status(500).json({ message: "獲取預算項目詳情失敗" })
  }
})

// 新建預算項目
router.post("/api/budget/items", async (req, res) => {
  try {
    const validated = insertBudgetItemSchema.parse(req.body)

    const [newItem] = await db.insert(budgetItems).values(validated).returning()

    if (validated.actualAmount) {
      await updateBudgetPlanActualSpent(validated.budgetPlanId)
    }

    res.status(201).json(newItem)
  } catch (error: any) {
    console.error("Error creating budget item:", error)
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "資料驗證失敗", errors: error.errors })
    }
    res.status(500).json({ message: "建立預算項目失敗" })
  }
})

// 更新預算項目
router.patch("/api/budget/items/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const updateData = { ...req.body, updatedAt: new Date() }

    if (req.body.actualAmount !== undefined && req.body.plannedAmount !== undefined) {
      const planned = parseFloat(req.body.plannedAmount)
      const actual = parseFloat(req.body.actualAmount)
      updateData.variance = (planned - actual).toFixed(2)
      updateData.variancePercentage =
        planned > 0 ? (((planned - actual) / planned) * 100).toFixed(2) : "0.00"
    }

    const [updatedItem] = await db
      .update(budgetItems)
      .set(updateData)
      .where(eq(budgetItems.id, id))
      .returning()

    if (!updatedItem) {
      return res.status(404).json({ message: "預算項目不存在" })
    }

    await updateBudgetPlanActualSpent(updatedItem.budgetPlanId)

    res.json(updatedItem)
  } catch (error: any) {
    console.error("Error updating budget item:", error)
    res.status(500).json({ message: "更新預算項目失敗" })
  }
})

// 刪除預算項目（軟刪除）
router.delete("/api/budget/items/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const [item] = await db
      .update(budgetItems)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(budgetItems.id, id))
      .returning()

    if (item) {
      await updateBudgetPlanActualSpent(item.budgetPlanId)
    }

    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting budget item:", error)
    res.status(500).json({ message: "刪除預算項目失敗" })
  }
})

// 將預算項目轉換為付款項目
router.post("/api/budget/items/:id/convert", async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const [budgetItem] = await db.select().from(budgetItems).where(eq(budgetItems.id, id))

    if (!budgetItem) {
      return res.status(404).json({ message: "預算項目不存在" })
    }

    if (budgetItem.convertedToPayment) {
      return res.status(400).json({ message: "該預算項目已轉換為付款項目" })
    }

    const [budgetPlan] = await db
      .select()
      .from(budgetPlans)
      .where(eq(budgetPlans.id, budgetItem.budgetPlanId))

    const paymentItemData: any = {
      itemName: budgetItem.itemName,
      projectId: budgetPlan?.projectId,
      categoryId: budgetItem.categoryId,
      fixedCategoryId: budgetItem.fixedCategoryId,
      totalAmount: budgetItem.plannedAmount,
      amountPaid: "0.00",
      dueDate: budgetItem.startDate || budgetItem.endDate,
      paymentStatus: "pending",
      priority: budgetItem.priority,
      notes: budgetItem.notes ? `[預算轉換] ${budgetItem.notes}` : "[預算轉換項目]",
    }

    if (budgetItem.paymentType === "installment" && budgetItem.installmentCount) {
      paymentItemData.paymentType = "installment"
      paymentItemData.installmentCount = budgetItem.installmentCount
      paymentItemData.installmentAmount = budgetItem.installmentAmount
    }

    const [newPaymentItem] = await db
      .insert(paymentItems)
      .values(paymentItemData)
      .returning()

    await db
      .update(budgetItems)
      .set({
        convertedToPayment: true,
        linkedPaymentItemId: newPaymentItem.id,
        conversionDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(budgetItems.id, id))

    res.status(201).json({
      message: "預算項目已成功轉換為付款項目",
      paymentItem: newPaymentItem,
      budgetItemId: id,
    })
  } catch (error: any) {
    console.error("Error converting budget item:", error)
    res.status(500).json({ message: "轉換預算項目失敗" })
  }
})

// 取得預算計劃統計摘要
router.get("/api/budget/plans/:id/summary", async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const [plan] = await db.select().from(budgetPlans).where(eq(budgetPlans.id, id))

    if (!plan) {
      return res.status(404).json({ message: "預算計劃不存在" })
    }

    const items = await db
      .select()
      .from(budgetItems)
      .where(and(eq(budgetItems.budgetPlanId, id), eq(budgetItems.isDeleted, false)))

    const calculatedTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0)
    const totalActual = items.reduce(
      (sum, item) => sum + parseFloat(item.actualAmount || "0"),
      0
    )
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
        conversionRate:
          items.length > 0 ? ((convertedCount / items.length) * 100).toFixed(1) : 0,
        itemCount: items.length,
        convertedCount,
        pendingCount,
        byPaymentType: {
          single: { count: byPaymentType.single.length, total: byPaymentTypeTotal.single },
          installment: {
            count: byPaymentType.installment.length,
            total: byPaymentTypeTotal.installment,
          },
          monthly: { count: byPaymentType.monthly.length, total: byPaymentTypeTotal.monthly },
        },
      },
    })
  } catch (error: any) {
    console.error("Error fetching budget summary:", error)
    res.status(500).json({ message: "獲取預算摘要失敗" })
  }
})

export default router
