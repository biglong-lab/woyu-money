/**
 * 館別共用組 CRUD API（PR-1）
 *
 * 路由：
 * - GET    /api/property-groups               列出所有共用組（含成員）
 * - POST   /api/property-groups               新增共用組
 * - PUT    /api/property-groups/:id           更新共用組（name / description / isActive）
 * - DELETE /api/property-groups/:id           刪除共用組（CASCADE 刪 members）
 * - POST   /api/property-groups/:id/members   新增成員
 * - PUT    /api/property-group-members/:id    更新成員（weight / notes）
 * - DELETE /api/property-group-members/:id    刪除成員
 *
 * 認證：全部需登入；新增/編輯/刪除需 admin 角色
 */

import { Router } from "express"
import { eq } from "drizzle-orm"
import { db } from "../db"
import { propertyGroups, propertyGroupMembers, paymentProjects } from "@shared/schema"
import { requireAuth } from "../auth"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { z } from "zod"

const router = Router()

// ─────────────────────────────────────────────
// 驗證 schemas
// ─────────────────────────────────────────────

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
})

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

const addMemberSchema = z.object({
  projectId: z.number().int().positive(),
  weight: z.number().nonnegative().default(1),
  notes: z.string().nullable().optional(),
})

const updateMemberSchema = z.object({
  weight: z.number().nonnegative().optional(),
  notes: z.string().nullable().optional(),
})

// 確保 admin 權限的小幫手
function requireAdmin(req: import("express").Request) {
  if (req.user?.role !== "admin") {
    throw new AppError(403, "需要管理員權限")
  }
}

// ─────────────────────────────────────────────
// GET 列表（所有人可看）
// ─────────────────────────────────────────────

router.get(
  "/api/property-groups",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const groups = await db.select().from(propertyGroups).orderBy(propertyGroups.name)

    // 一次撈所有成員，避免 N+1
    const members = await db
      .select({
        id: propertyGroupMembers.id,
        groupId: propertyGroupMembers.groupId,
        projectId: propertyGroupMembers.projectId,
        weight: propertyGroupMembers.weight,
        notes: propertyGroupMembers.notes,
        projectName: paymentProjects.projectName,
      })
      .from(propertyGroupMembers)
      .leftJoin(paymentProjects, eq(paymentProjects.id, propertyGroupMembers.projectId))

    const result = groups.map((g) => ({
      ...g,
      members: members.filter((m) => m.groupId === g.id),
    }))

    res.json(result)
  })
)

// ─────────────────────────────────────────────
// POST 新增共用組
// ─────────────────────────────────────────────

router.post(
  "/api/property-groups",
  requireAuth,
  asyncHandler(async (req, res) => {
    requireAdmin(req)
    const parsed = createGroupSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, "輸入格式錯誤", false)
    }
    const [created] = await db.insert(propertyGroups).values(parsed.data).returning()
    res.status(201).json(created)
  })
)

// ─────────────────────────────────────────────
// PUT 更新共用組
// ─────────────────────────────────────────────

router.put(
  "/api/property-groups/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    requireAdmin(req)
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 id")

    const parsed = updateGroupSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(400, "輸入格式錯誤", false)

    const [updated] = await db
      .update(propertyGroups)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(propertyGroups.id, id))
      .returning()

    if (!updated) throw new AppError(404, "共用組不存在")
    res.json(updated)
  })
)

// ─────────────────────────────────────────────
// DELETE 刪除共用組（CASCADE 刪成員）
// ─────────────────────────────────────────────

router.delete(
  "/api/property-groups/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    requireAdmin(req)
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 id")

    const result = await db.delete(propertyGroups).where(eq(propertyGroups.id, id)).returning()
    if (result.length === 0) throw new AppError(404, "共用組不存在")
    res.json({ message: "已刪除", id })
  })
)

// ─────────────────────────────────────────────
// POST 新增成員
// ─────────────────────────────────────────────

router.post(
  "/api/property-groups/:id/members",
  requireAuth,
  asyncHandler(async (req, res) => {
    requireAdmin(req)
    const groupId = parseInt(req.params.id)
    if (isNaN(groupId)) throw new AppError(400, "無效的 group id")

    const parsed = addMemberSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(400, "輸入格式錯誤", false)

    // 檢查群組存在
    const group = await db
      .select()
      .from(propertyGroups)
      .where(eq(propertyGroups.id, groupId))
      .limit(1)
    if (group.length === 0) throw new AppError(404, "共用組不存在")

    // 檢查專案存在
    const project = await db
      .select()
      .from(paymentProjects)
      .where(eq(paymentProjects.id, parsed.data.projectId))
      .limit(1)
    if (project.length === 0) throw new AppError(404, "專案不存在")

    try {
      const [created] = await db
        .insert(propertyGroupMembers)
        .values({
          groupId,
          projectId: parsed.data.projectId,
          weight: parsed.data.weight.toString(),
          notes: parsed.data.notes ?? null,
        })
        .returning()
      res.status(201).json(created)
    } catch (err) {
      // unique constraint：同一群組同一專案重複加入
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("unique") || message.includes("duplicate")) {
        throw new AppError(409, "該專案已是此共用組成員")
      }
      throw err
    }
  })
)

// ─────────────────────────────────────────────
// PUT 更新成員
// ─────────────────────────────────────────────

router.put(
  "/api/property-group-members/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    requireAdmin(req)
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 id")

    const parsed = updateMemberSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(400, "輸入格式錯誤", false)

    const updates: Record<string, unknown> = {}
    if (parsed.data.weight !== undefined) updates.weight = parsed.data.weight.toString()
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

    const [updated] = await db
      .update(propertyGroupMembers)
      .set(updates)
      .where(eq(propertyGroupMembers.id, id))
      .returning()

    if (!updated) throw new AppError(404, "成員不存在")
    res.json(updated)
  })
)

// ─────────────────────────────────────────────
// DELETE 刪除成員
// ─────────────────────────────────────────────

router.delete(
  "/api/property-group-members/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    requireAdmin(req)
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的 id")

    const result = await db
      .delete(propertyGroupMembers)
      .where(eq(propertyGroupMembers.id, id))
      .returning()
    if (result.length === 0) throw new AppError(404, "成員不存在")
    res.json({ message: "已刪除", id })
  })
)

export default router
