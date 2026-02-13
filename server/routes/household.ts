import { Router } from "express"
import { storage } from "../storage"
import { insertHouseholdBudgetSchema, insertHouseholdExpenseSchema } from "@shared/schema"
import { receiptUpload } from "./upload-config"
import { asyncHandler, AppError } from "../middleware/error-handler"

const router = Router()

// 家用分類
router.get(
  "/api/household-categories",
  asyncHandler(async (req, res) => {
    const categories = await storage.getFixedCategories()
    res.json(categories)
  })
)

// 家用預算
router.get(
  "/api/household-budgets",
  asyncHandler(async (req, res) => {
    const budgets = await storage.getHouseholdCategoryBudgets()
    res.json(budgets)
  })
)

router.post(
  "/api/household-budgets",
  asyncHandler(async (req, res) => {
    const result = insertHouseholdBudgetSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid budget data", errors: result.error.errors })
    }
    const budget = await storage.createOrUpdateHouseholdBudget(result.data)
    res.status(201).json(budget)
  })
)

router.put(
  "/api/household-budgets/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const result = insertHouseholdBudgetSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid budget data", errors: result.error.errors })
    }
    const budget = await storage.updateHouseholdCategoryBudget(id, result.data)
    res.json(budget)
  })
)

// 家用支出
router.get(
  "/api/household-expenses",
  asyncHandler(async (req, res) => {
    const { page = "1", limit = "10", categoryId, startDate, endDate } = req.query
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)

    const filters: { categoryId?: number; startDate?: Date; endDate?: Date } = {}
    if (categoryId) filters.categoryId = parseInt(categoryId as string)
    if (startDate) filters.startDate = new Date(startDate as string)
    if (endDate) filters.endDate = new Date(endDate as string)

    const expenses = await storage.getHouseholdExpenses(filters, pageNum, limitNum)
    res.json(expenses)
  })
)

router.post(
  "/api/household-expenses",
  asyncHandler(async (req, res) => {
    const result = insertHouseholdExpenseSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid expense data", errors: result.error.errors })
    }
    const expense = await storage.createHouseholdExpense(result.data)
    res.status(201).json(expense)
  })
)

router.put(
  "/api/household-expenses/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const result = insertHouseholdExpenseSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid expense data", errors: result.error.errors })
    }
    const expense = await storage.updateHouseholdExpense(id, result.data)
    res.json(expense)
  })
)

router.delete(
  "/api/household-expenses/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    await storage.deleteHouseholdExpense(id)
    res.status(204).send()
  })
)

// 收據圖片上傳
router.post(
  "/api/upload/images",
  receiptUpload.array("images", 5),
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      throw new AppError(400, "No files uploaded")
    }

    const filePaths = files.map((file) => `/uploads/receipts/${file.filename}`)
    res.json({ imagePaths: filePaths })
  })
)

export default router
