import { Router } from "express"
import { storage } from "../storage"
import { requireAuth } from "../auth"
import {
  insertDebtCategorySchema,
  insertPaymentProjectSchema,
} from "@shared/schema"

const router = Router()

// 取得所有分類
router.get("/api/categories", requireAuth, async (req, res) => {
  try {
    const categories = await storage.getCategories()
    res.json(categories)
  } catch (error: any) {
    console.error("Error fetching categories:", error)
    res.status(500).json({ message: "Failed to fetch categories" })
  }
})

// 建立分類
router.post("/api/categories", async (req, res) => {
  try {
    const result = insertDebtCategorySchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid category data", errors: result.error.errors })
    }
    const category = await storage.createCategory(result.data)
    res.status(201).json(category)
  } catch (error: any) {
    console.error("Error creating category:", error)
    res.status(500).json({ message: "Failed to create category" })
  }
})

// 更新分類
router.put("/api/categories/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const result = insertDebtCategorySchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid category data", errors: result.error.errors })
    }
    const category = await storage.updateCategory(id, result.data)
    res.json(category)
  } catch (error: any) {
    console.error("Error updating category:", error)
    res.status(500).json({ message: "Failed to update category" })
  }
})

// 刪除分類
router.delete("/api/categories/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await storage.deleteCategory(id)
    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting category:", error)
    res.status(500).json({ message: "Failed to delete category" })
  }
})

// 付款專案 - 多重端點相容
router.get("/api/projects", async (req, res) => {
  try {
    const projects = await storage.getPaymentProjects()
    res.json(projects)
  } catch (error: any) {
    console.error("Error fetching projects:", error)
    res.status(500).json({ message: "Failed to fetch projects" })
  }
})

router.get("/api/payment/projects", async (req, res) => {
  try {
    const projects = await storage.getPaymentProjects()
    res.json(projects)
  } catch (error: any) {
    console.error("Error fetching projects:", error)
    res.status(500).json({ message: "Failed to fetch projects" })
  }
})

router.post("/api/projects", async (req, res) => {
  try {
    const result = insertPaymentProjectSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid project data", errors: result.error.errors })
    }
    const project = await storage.createPaymentProject(result.data)
    res.status(201).json(project)
  } catch (error: any) {
    console.error("Error creating project:", error)
    res.status(500).json({ message: "Failed to create project" })
  }
})

router.put("/api/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const result = insertPaymentProjectSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid project data", errors: result.error.errors })
    }
    const project = await storage.updatePaymentProject(id, result.data)
    res.json(project)
  } catch (error: any) {
    console.error("Error updating project:", error)
    res.status(500).json({ message: "Failed to update project" })
  }
})

router.delete("/api/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await storage.deletePaymentProject(id)
    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting project:", error)
    res.status(500).json({ message: "Failed to delete project" })
  }
})

// 固定分類
router.get("/api/fixed-categories", async (req, res) => {
  try {
    const categories = await storage.getFixedCategories()
    res.json(categories)
  } catch (error: any) {
    console.error("Error fetching fixed categories:", error)
    res.status(500).json({ message: "Failed to fetch fixed categories" })
  }
})

// Debt Categories
router.get("/api/categories/debt", async (req, res) => {
  try {
    const categories = await storage.getDebtCategories()
    res.json(categories)
  } catch (error: any) {
    console.error("Error fetching debt categories:", error)
    res.status(500).json({ message: "Failed to fetch debt categories" })
  }
})

// Project Categories
router.get("/api/categories/project", async (req, res) => {
  try {
    const categories = await storage.getProjectCategories()
    res.json(categories)
  } catch (error: any) {
    console.error("Error fetching project categories:", error)
    res.status(500).json({ message: "Failed to fetch project categories" })
  }
})

router.post("/api/categories/project", async (req, res) => {
  try {
    const categoryData = { ...req.body, categoryType: "project" }
    const category = await storage.createCategory(categoryData)
    res.status(201).json(category)
  } catch (error: any) {
    console.error("Error creating project category:", error)
    res.status(500).json({ message: "Failed to create project category" })
  }
})

router.put("/api/categories/project/:id", async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id)
    const categoryData = { ...req.body, categoryType: "project" }
    const category = await storage.updateCategory(categoryId, categoryData)
    res.json(category)
  } catch (error: any) {
    console.error("Error updating project category:", error)
    res.status(500).json({ message: "Failed to update project category" })
  }
})

router.delete("/api/categories/project/:id", async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id)
    await storage.deleteCategory(categoryId)
    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting project category:", error)
    res.status(500).json({ message: "Failed to delete project category" })
  }
})

// Household Categories
router.get("/api/categories/household", async (req, res) => {
  try {
    const categories = await storage.getHouseholdCategories()
    res.json(categories)
  } catch (error: any) {
    console.error("Error fetching household categories:", error)
    res.status(500).json({ message: "Failed to fetch household categories" })
  }
})

router.post("/api/categories/household", async (req, res) => {
  try {
    const categoryData = { ...req.body, categoryType: "household" }
    const category = await storage.createCategory(categoryData)
    res.status(201).json(category)
  } catch (error: any) {
    console.error("Error creating household category:", error)
    res.status(500).json({ message: "Failed to create household category" })
  }
})

router.put("/api/categories/household/:id", async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id)
    const categoryData = { ...req.body, categoryType: "household" }
    const category = await storage.updateCategory(categoryId, categoryData)
    res.json(category)
  } catch (error: any) {
    console.error("Error updating household category:", error)
    res.status(500).json({ message: "Failed to update household category" })
  }
})

router.delete("/api/categories/household/:id", async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id)
    await storage.deleteCategory(categoryId)
    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting household category:", error)
    res.status(500).json({ message: "Failed to delete household category" })
  }
})

// Fixed Categories (固定分類項目)
router.get("/api/categories/fixed", async (req, res) => {
  try {
    const categories = await storage.getFixedCategories()
    res.json(categories)
  } catch (error: any) {
    console.error("Error fetching fixed categories:", error)
    res.status(500).json({ message: "Failed to fetch fixed categories" })
  }
})

router.post("/api/categories/fixed", async (req, res) => {
  try {
    const category = await storage.createFixedCategory(req.body)
    res.status(201).json(category)
  } catch (error: any) {
    console.error("Error creating fixed category:", error)
    res.status(500).json({ message: "Failed to create fixed category" })
  }
})

router.put("/api/categories/fixed/:id", async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id)
    const category = await storage.updateFixedCategory(categoryId, req.body)
    res.json(category)
  } catch (error: any) {
    console.error("Error updating fixed category:", error)
    res.status(500).json({ message: "Failed to update fixed category" })
  }
})

router.delete("/api/categories/fixed/:id", async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id)
    await storage.deleteFixedCategory(categoryId)
    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting household category:", error)
    res.status(500).json({ message: "Failed to delete household category" })
  }
})

// Household Category Stats
router.get("/api/household/category-stats/:id", async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id)
    const { year, month } = req.query
    const stats = await storage.getHouseholdCategoryStats(categoryId, year as string, month as string)
    res.json(stats)
  } catch (error: any) {
    console.error("Error fetching household category stats:", error)
    res.status(500).json({ message: "Failed to fetch household category stats" })
  }
})

// Project Category Templates
router.get("/api/project-category-templates/:projectId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId)
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined
    const templates = await storage.getProjectCategoryTemplates(projectId, categoryId)
    res.json(templates)
  } catch (error: any) {
    console.error("Error fetching project category templates:", error)
    res.status(500).json({ message: "Failed to fetch project category templates" })
  }
})

router.post("/api/project-category-templates", async (req, res) => {
  try {
    const templateData = req.body
    const template = await storage.createProjectCategoryTemplate(templateData)
    res.json(template)
  } catch (error: any) {
    console.error("Error creating project category template:", error)
    res.status(500).json({ message: "Failed to create project category template" })
  }
})

router.put("/api/project-category-templates/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const templateData = req.body
    const template = await storage.updateProjectCategoryTemplate(id, templateData)
    res.json(template)
  } catch (error: any) {
    console.error("Error updating project category template:", error)
    res.status(500).json({ message: "Failed to update project category template" })
  }
})

router.delete("/api/project-category-templates/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await storage.deleteProjectCategoryTemplate(id)
    res.json({ message: "Template deleted successfully" })
  } catch (error: any) {
    console.error("Error deleting project category template:", error)
    res.status(500).json({ message: "Failed to delete project category template" })
  }
})

// Fixed Category Sub Options
router.get("/api/fixed-category-sub-options", async (req, res) => {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined
    const fixedCategoryId = req.query.fixedCategoryId ? parseInt(req.query.fixedCategoryId as string) : undefined
    const subOptions = await storage.getFixedCategorySubOptions(projectId, fixedCategoryId)
    res.json(subOptions)
  } catch (error: any) {
    console.error("Error fetching fixed category sub options:", error)
    res.status(500).json({ message: "Failed to fetch fixed category sub options" })
  }
})

router.get("/api/fixed-category-sub-options/:projectId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId)
    const fixedCategoryId = req.query.fixedCategoryId ? parseInt(req.query.fixedCategoryId as string) : undefined
    const subOptions = await storage.getFixedCategorySubOptions(projectId, fixedCategoryId)
    res.json(subOptions)
  } catch (error: any) {
    console.error("Error fetching fixed category sub options:", error)
    res.status(500).json({ message: "Failed to fetch fixed category sub options" })
  }
})

router.post("/api/fixed-category-sub-options", async (req, res) => {
  try {
    const { projectId, fixedCategoryId, itemName, accountInfo, notes } = req.body

    if (!projectId || !fixedCategoryId || !itemName) {
      return res.status(400).json({ message: "Missing required fields: projectId, fixedCategoryId, itemName" })
    }

    const newItem = await storage.createFixedCategorySubOption({
      projectId,
      fixedCategoryId,
      subOptionName: itemName,
      displayName: accountInfo || null,
    })

    res.json(newItem)
  } catch (error: any) {
    console.error("Error creating fixed category sub option:", error)
    res.status(500).json({ message: "Failed to create fixed category sub option", error: error.message })
  }
})

router.put("/api/fixed-category-sub-options/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { projectId, fixedCategoryId, itemName, accountInfo, notes } = req.body

    if (!projectId || !fixedCategoryId || !itemName) {
      return res.status(400).json({ message: "Missing required fields: projectId, fixedCategoryId, itemName" })
    }

    const updatedItem = await storage.updateFixedCategorySubOption(id, {
      projectId,
      fixedCategoryId,
      subOptionName: itemName,
      displayName: accountInfo || null,
    })

    res.json(updatedItem)
  } catch (error: any) {
    console.error("Error updating fixed category sub option:", error)
    res.status(500).json({ message: "Failed to update fixed category sub option", error: error.message })
  }
})

router.delete("/api/fixed-category-sub-options/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await storage.deleteFixedCategorySubOption(id)
    res.json({ message: "Fixed category sub option deleted successfully" })
  } catch (error: any) {
    console.error("Error deleting fixed category sub option:", error)
    res.status(500).json({ message: "Failed to delete fixed category sub option", error: error.message })
  }
})

export default router
