/**
 * 統一 Categories API（PR-2）
 *
 * 目的：合併 5 頁分散管理 → 1 頁單一視窗。
 *
 * 新端點：
 *   GET  /api/categories/unified            列出全部分類 + 使用統計（usedCount, lastUsedAt）
 *   POST /api/categories/:id/merge          合併 from→to（重定向 payment_items, budget_items）
 *   POST /api/categories/archive-unused     軟刪除未使用且 90 天內無建立的分類
 *
 * 注意：
 * - merge 操作在 transaction 中執行，全有或全無
 * - merge 後 from 分類軟刪除（is_deleted=true），保留稽核痕跡
 * - 不影響既有 /api/categories CRUD 端點（向後相容）
 */

import { Router } from "express"
import { sql, inArray } from "drizzle-orm"
import { db } from "../db"
import { debtCategories } from "@shared/schema"
import { requireAuth } from "../auth"
import { asyncHandler, AppError } from "../middleware/error-handler"

const router = Router()

// ─────────────────────────────────────────────
// GET /api/categories/unified — 列出全部分類 + 使用統計
// ─────────────────────────────────────────────

interface UnifiedCategoryRow extends Record<string, unknown> {
  id: number
  category_name: string | null
  category_type: string | null
  description: string | null
  is_deleted: boolean | null
  created_at: Date | null
  used_count: number
  last_used_at: Date | null
  budget_count: number
}

router.get(
  "/api/categories/unified",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const result = await db.execute<UnifiedCategoryRow>(sql`
      SELECT
        dc.id,
        dc.category_name,
        dc.category_type,
        dc.description,
        dc.is_deleted,
        dc.created_at,
        COALESCE(pi_stats.used_count, 0)::int AS used_count,
        pi_stats.last_used_at,
        COALESCE(bi_stats.budget_count, 0)::int AS budget_count
      FROM debt_categories dc
      LEFT JOIN (
        SELECT
          category_id,
          COUNT(*) AS used_count,
          MAX(GREATEST(updated_at, created_at)) AS last_used_at
        FROM payment_items
        WHERE COALESCE(is_deleted, false) = false
          AND category_id IS NOT NULL
        GROUP BY category_id
      ) pi_stats ON pi_stats.category_id = dc.id
      LEFT JOIN (
        SELECT
          category_id,
          COUNT(*) AS budget_count
        FROM budget_items
        WHERE COALESCE(is_deleted, false) = false
          AND category_id IS NOT NULL
        GROUP BY category_id
      ) bi_stats ON bi_stats.category_id = dc.id
      ORDER BY
        COALESCE(dc.is_deleted, false) ASC,    -- 未刪除優先
        COALESCE(pi_stats.used_count, 0) DESC, -- 高使用度優先
        dc.category_name ASC
    `)

    const categories = result.rows.map((r) => ({
      id: r.id,
      categoryName: r.category_name,
      categoryType: r.category_type,
      description: r.description,
      isDeleted: r.is_deleted ?? false,
      createdAt: r.created_at,
      usedCount: r.used_count,
      lastUsedAt: r.last_used_at,
      budgetCount: r.budget_count,
      isInUse: r.used_count > 0 || r.budget_count > 0,
    }))

    res.json(categories)
  })
)

// ─────────────────────────────────────────────
// POST /api/categories/:id/merge — 合併分類
//   body: { targetId: number }
//   把 :id 的所有 payment_items / budget_items category_id 改為 targetId，
//   然後將 :id 軟刪除。
// ─────────────────────────────────────────────

interface MergeBody {
  targetId: number
}

router.post(
  "/api/categories/:id/merge",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sourceId = parseInt(req.params.id, 10)
    if (Number.isNaN(sourceId)) {
      throw new AppError(400, "Invalid source id")
    }

    const body = req.body as Partial<MergeBody>
    const targetId = Number(body.targetId)
    if (!Number.isFinite(targetId) || targetId <= 0) {
      throw new AppError(400, "Missing or invalid targetId")
    }
    if (targetId === sourceId) {
      throw new AppError(400, "targetId 不可與 sourceId 相同")
    }

    // 確認兩個分類存在
    const exists = await db.execute<{ id: number; is_deleted: boolean | null }>(sql`
      SELECT id, is_deleted FROM debt_categories WHERE id IN (${sourceId}, ${targetId})
    `)
    const sourceRow = exists.rows.find((r) => r.id === sourceId)
    const targetRow = exists.rows.find((r) => r.id === targetId)
    if (!sourceRow) throw new AppError(404, `來源分類 #${sourceId} 不存在`)
    if (!targetRow) throw new AppError(404, `目標分類 #${targetId} 不存在`)
    if (targetRow.is_deleted)
      throw new AppError(400, `目標分類 #${targetId} 已軟刪除，無法合併進去`)

    // Transaction：重定向 + 軟刪除
    const result = await db.transaction(async (tx) => {
      const piResult = await tx.execute<{ count: number }>(sql`
        WITH updated AS (
          UPDATE payment_items
          SET category_id = ${targetId}, updated_at = NOW()
          WHERE category_id = ${sourceId}
            AND COALESCE(is_deleted, false) = false
          RETURNING id
        )
        SELECT COUNT(*)::int AS count FROM updated
      `)
      const piMoved = piResult.rows[0]?.count ?? 0

      const biResult = await tx.execute<{ count: number }>(sql`
        WITH updated AS (
          UPDATE budget_items
          SET category_id = ${targetId}, updated_at = NOW()
          WHERE category_id = ${sourceId}
            AND COALESCE(is_deleted, false) = false
          RETURNING id
        )
        SELECT COUNT(*)::int AS count FROM updated
      `)
      const biMoved = biResult.rows[0]?.count ?? 0

      // 軟刪除來源分類
      await tx.execute(sql`
        UPDATE debt_categories
        SET is_deleted = true, updated_at = NOW()
        WHERE id = ${sourceId}
      `)

      return { piMoved, biMoved }
    })

    res.json({
      success: true,
      sourceId,
      targetId,
      paymentItemsMoved: result.piMoved,
      budgetItemsMoved: result.biMoved,
      message: `合併完成：${result.piMoved} 筆付款項目、${result.biMoved} 筆預估項目改至 #${targetId}，#${sourceId} 已軟刪除`,
    })
  })
)

// ─────────────────────────────────────────────
// POST /api/categories/archive-unused — 批次軟刪除未使用分類
//   body: { dryRun?: boolean }（預設 dryRun=true 只回報不刪）
//   條件：usedCount=0 AND budgetCount=0 AND createdAt < 90 天前 AND is_deleted=false
// ─────────────────────────────────────────────

interface ArchiveUnusedBody {
  dryRun?: boolean
}

interface UnusedRow extends Record<string, unknown> {
  id: number
  category_name: string | null
  created_at: Date | null
}

router.post(
  "/api/categories/archive-unused",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<ArchiveUnusedBody>
    const dryRun = body.dryRun !== false // 預設 true，必須明確 false 才執行

    // 找出符合條件的分類
    const candidatesResult = await db.execute<UnusedRow>(sql`
      SELECT dc.id, dc.category_name, dc.created_at
      FROM debt_categories dc
      LEFT JOIN payment_items pi ON pi.category_id = dc.id
        AND COALESCE(pi.is_deleted, false) = false
      LEFT JOIN budget_items bi ON bi.category_id = dc.id
        AND COALESCE(bi.is_deleted, false) = false
      WHERE COALESCE(dc.is_deleted, false) = false
        AND dc.created_at < NOW() - INTERVAL '90 days'
      GROUP BY dc.id, dc.category_name, dc.created_at
      HAVING COUNT(pi.id) = 0 AND COUNT(bi.id) = 0
      ORDER BY dc.id
    `)

    const candidates = candidatesResult.rows.map((r) => ({
      id: r.id,
      categoryName: r.category_name,
      createdAt: r.created_at,
    }))

    if (dryRun || candidates.length === 0) {
      return res.json({
        dryRun: true,
        candidatesCount: candidates.length,
        candidates,
        message: dryRun
          ? `dryRun=true：將軟刪除 ${candidates.length} 筆未使用分類（不執行）`
          : "無符合條件的分類",
      })
    }

    // 真的執行（用 drizzle inArray 避免 ANY 序列化問題）
    const ids = candidates.map((c) => c.id)
    await db
      .update(debtCategories)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(inArray(debtCategories.id, ids))

    res.json({
      dryRun: false,
      archivedCount: candidates.length,
      archived: candidates,
      message: `已軟刪除 ${candidates.length} 筆未使用分類`,
    })
  })
)

export default router
