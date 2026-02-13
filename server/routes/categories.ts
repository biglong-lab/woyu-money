import { Router } from "express"
import { storage } from "../storage"
import { requireAuth } from "../auth"
import { insertDebtCategorySchema, insertPaymentProjectSchema } from "@shared/schema"
import { asyncHandler, AppError } from "../middleware/error-handler"

const router = Router()

// 取得所有分類
router.get(
  "/api/categories",
  requireAuth,
  asyncHandler(async (req, res) => {
    const categories = await storage.getCategories()
    res.json(categories)
  })
)

// 建立分類
router.post(
  "/api/categories",
  asyncHandler(async (req, res) => {
    const result = insertDebtCategorySchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid category data", errors: result.error.errors })
    }
    const category = await storage.createCategory(result.data)
    res.status(201).json(category)
  })
)

// 更新分類
router.put(
  "/api/categories/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const result = insertDebtCategorySchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid category data", errors: result.error.errors })
    }
    const category = await storage.updateCategory(id, result.data)
    res.json(category)
  })
)

// 刪除分類
router.delete(
  "/api/categories/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    await storage.deleteCategory(id)
    res.status(204).send()
  })
)

// 付款專案 - 多重端點相容
router.get(
  "/api/projects",
  asyncHandler(async (req, res) => {
    const projects = await storage.getPaymentProjects()
    res.json(projects)
  })
)

router.get(
  "/api/payment/projects",
  asyncHandler(async (req, res) => {
    const projects = await storage.getPaymentProjects()
    res.json(projects)
  })
)

router.post(
  "/api/projects",
  asyncHandler(async (req, res) => {
    const result = insertPaymentProjectSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid project data", errors: result.error.errors })
    }
    const project = await storage.createPaymentProject(result.data)
    res.status(201).json(project)
  })
)

router.put(
  "/api/projects/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const result = insertPaymentProjectSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid project data", errors: result.error.errors })
    }
    const project = await storage.updatePaymentProject(id, result.data)
    res.json(project)
  })
)

router.delete(
  "/api/projects/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    await storage.deletePaymentProject(id)
    res.status(204).send()
  })
)

// 固定分類
router.get(
  "/api/fixed-categories",
  asyncHandler(async (req, res) => {
    const categories = await storage.getFixedCategories()
    res.json(categories)
  })
)

// Debt Categories
router.get(
  "/api/categories/debt",
  asyncHandler(async (req, res) => {
    const categories = await storage.getDebtCategories()
    res.json(categories)
  })
)

// Project Categories
router.get(
  "/api/categories/project",
  asyncHandler(async (req, res) => {
    const categories = await storage.getProjectCategories()
    res.json(categories)
  })
)

router.post(
  "/api/categories/project",
  asyncHandler(async (req, res) => {
    const categoryData = { ...req.body, categoryType: "project" }
    const category = await storage.createCategory(categoryData)
    res.status(201).json(category)
  })
)

router.put(
  "/api/categories/project/:id",
  asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id)
    const categoryData = { ...req.body, categoryType: "project" }
    const category = await storage.updateCategory(categoryId, categoryData)
    res.json(category)
  })
)

router.delete(
  "/api/categories/project/:id",
  asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id)
    await storage.deleteCategory(categoryId)
    res.status(204).send()
  })
)

// Household Categories
router.get(
  "/api/categories/household",
  asyncHandler(async (req, res) => {
    const categories = await storage.getHouseholdCategories()
    res.json(categories)
  })
)

router.post(
  "/api/categories/household",
  asyncHandler(async (req, res) => {
    const categoryData = { ...req.body, categoryType: "household" }
    const category = await storage.createCategory(categoryData)
    res.status(201).json(category)
  })
)

router.put(
  "/api/categories/household/:id",
  asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id)
    const categoryData = { ...req.body, categoryType: "household" }
    const category = await storage.updateCategory(categoryId, categoryData)
    res.json(category)
  })
)

router.delete(
  "/api/categories/household/:id",
  asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id)
    await storage.deleteCategory(categoryId)
    res.status(204).send()
  })
)

// Fixed Categories (固定分類項目)
router.get(
  "/api/categories/fixed",
  asyncHandler(async (req, res) => {
    const categories = await storage.getFixedCategories()
    res.json(categories)
  })
)

router.post(
  "/api/categories/fixed",
  asyncHandler(async (req, res) => {
    const category = await storage.createFixedCategory(req.body)
    res.status(201).json(category)
  })
)

router.put(
  "/api/categories/fixed/:id",
  asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id)
    const category = await storage.updateFixedCategory(categoryId, req.body)
    res.json(category)
  })
)

router.delete(
  "/api/categories/fixed/:id",
  asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id)
    await storage.deleteFixedCategory(categoryId)
    res.status(204).send()
  })
)

// Household Category Stats
router.get(
  "/api/household/category-stats/:id",
  asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id)
    const { year, month } = req.query
    const stats = await storage.getHouseholdCategoryStats(
      categoryId,
      year as string,
      month as string
    )
    res.json(stats)
  })
)

// Project Category Templates
router.get(
  "/api/project-category-templates/:projectId",
  asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.projectId)
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined
    const templates = await storage.getProjectCategoryTemplates(projectId, categoryId)
    res.json(templates)
  })
)

router.post(
  "/api/project-category-templates",
  asyncHandler(async (req, res) => {
    const templateData = req.body
    const template = await storage.createProjectCategoryTemplate(templateData)
    res.json(template)
  })
)

router.put(
  "/api/project-category-templates/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const templateData = req.body
    const template = await storage.updateProjectCategoryTemplate(id, templateData)
    res.json(template)
  })
)

router.delete(
  "/api/project-category-templates/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    await storage.deleteProjectCategoryTemplate(id)
    res.json({ message: "Template deleted successfully" })
  })
)

// Fixed Category Sub Options
router.get(
  "/api/fixed-category-sub-options",
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined
    const fixedCategoryId = req.query.fixedCategoryId
      ? parseInt(req.query.fixedCategoryId as string)
      : undefined
    const subOptions = await storage.getFixedCategorySubOptions(projectId, fixedCategoryId)
    res.json(subOptions)
  })
)

router.get(
  "/api/fixed-category-sub-options/:projectId",
  asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.projectId)
    const fixedCategoryId = req.query.fixedCategoryId
      ? parseInt(req.query.fixedCategoryId as string)
      : undefined
    const subOptions = await storage.getFixedCategorySubOptions(projectId, fixedCategoryId)
    res.json(subOptions)
  })
)

router.post(
  "/api/fixed-category-sub-options",
  asyncHandler(async (req, res) => {
    const { projectId, fixedCategoryId, itemName, accountInfo, notes } = req.body

    if (!projectId || !fixedCategoryId || !itemName) {
      throw new AppError(400, "Missing required fields: projectId, fixedCategoryId, itemName")
    }

    const newItem = await storage.createFixedCategorySubOption({
      projectId,
      fixedCategoryId,
      subOptionName: itemName,
      displayName: accountInfo || null,
    })

    res.json(newItem)
  })
)

router.put(
  "/api/fixed-category-sub-options/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const { projectId, fixedCategoryId, itemName, accountInfo, notes } = req.body

    if (!projectId || !fixedCategoryId || !itemName) {
      throw new AppError(400, "Missing required fields: projectId, fixedCategoryId, itemName")
    }

    const updatedItem = await storage.updateFixedCategorySubOption(id, {
      projectId,
      fixedCategoryId,
      subOptionName: itemName,
      displayName: accountInfo || null,
    })

    res.json(updatedItem)
  })
)

router.delete(
  "/api/fixed-category-sub-options/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    await storage.deleteFixedCategorySubOption(id)
    res.json({ message: "Fixed category sub option deleted successfully" })
  })
)

export default router
