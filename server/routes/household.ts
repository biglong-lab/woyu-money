import { Router } from "express"
import { storage } from "../storage"
import {
  insertHouseholdBudgetSchema,
  insertHouseholdExpenseSchema,
} from "@shared/schema"
import { receiptUpload } from "./upload-config"

const router = Router()

// 家用分類
router.get("/api/household-categories", async (req, res) => {
  try {
    const categories = await storage.getFixedCategories()
    res.json(categories)
  } catch (error: any) {
    console.error("Error fetching household categories:", error)
    res.status(500).json({ message: "Failed to fetch household categories" })
  }
})

// 家用預算
router.get("/api/household-budgets", async (req, res) => {
  try {
    const budgets = await storage.getHouseholdCategoryBudgets()
    res.json(budgets)
  } catch (error: any) {
    console.error("Error fetching category budgets:", error)
    res.status(500).json({ message: "Failed to fetch category budgets" })
  }
})

router.post("/api/household-budgets", async (req, res) => {
  try {
    const result = insertHouseholdBudgetSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid budget data", errors: result.error.errors })
    }
    const budget = await storage.createOrUpdateHouseholdBudget(result.data)
    res.status(201).json(budget)
  } catch (error: any) {
    console.error("Error creating budget:", error)
    res.status(500).json({ message: "Failed to create budget" })
  }
})

router.put("/api/household-budgets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const result = insertHouseholdBudgetSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid budget data", errors: result.error.errors })
    }
    const budget = await storage.updateHouseholdCategoryBudget(id, result.data)
    res.json(budget)
  } catch (error: any) {
    console.error("Error updating budget:", error)
    res.status(500).json({ message: "Failed to update budget" })
  }
})

// 家用支出
router.get("/api/household-expenses", async (req, res) => {
  try {
    const { page = "1", limit = "10", categoryId, startDate, endDate } = req.query
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)

    const filters: any = {}
    if (categoryId) filters.categoryId = parseInt(categoryId as string)
    if (startDate) filters.startDate = new Date(startDate as string)
    if (endDate) filters.endDate = new Date(endDate as string)

    const expenses = await storage.getHouseholdExpenses(filters, pageNum, limitNum)
    res.json(expenses)
  } catch (error: any) {
    console.error("Error fetching expenses:", error)
    res.status(500).json({ message: "Failed to fetch expenses" })
  }
})

router.post("/api/household-expenses", async (req, res) => {
  try {
    const result = insertHouseholdExpenseSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid expense data", errors: result.error.errors })
    }
    const expense = await storage.createHouseholdExpense(result.data)
    res.status(201).json(expense)
  } catch (error: any) {
    console.error("Error creating expense:", error)
    res.status(500).json({ message: "Failed to create expense" })
  }
})

router.put("/api/household-expenses/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const result = insertHouseholdExpenseSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid expense data", errors: result.error.errors })
    }
    const expense = await storage.updateHouseholdExpense(id, result.data)
    res.json(expense)
  } catch (error: any) {
    console.error("Error updating expense:", error)
    res.status(500).json({ message: "Failed to update expense" })
  }
})

router.delete("/api/household-expenses/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await storage.deleteHouseholdExpense(id)
    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting expense:", error)
    res.status(500).json({ message: "Failed to delete expense" })
  }
})

// 收據圖片上傳
router.post("/api/upload/images", receiptUpload.array("images", 5), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" })
    }

    const filePaths = files.map(file => `/uploads/receipts/${file.filename}`)
    res.json({ imagePaths: filePaths })
  } catch (error: any) {
    console.error("Error uploading images:", error)
    res.status(500).json({ message: "Failed to upload images" })
  }
})

export default router
