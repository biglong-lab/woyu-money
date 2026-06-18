/**
 * 沙盤推演情境 API（存後端、跨裝置）
 * - GET    /api/scenario-presets      列出
 * - POST   /api/scenario-presets      儲存（同名覆寫）
 * - DELETE /api/scenario-presets/:id  刪除
 */
import { Router } from "express"
import { eq } from "drizzle-orm"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { db } from "../db"
import { scenarioPresets, insertScenarioPresetSchema } from "@shared/schema"

const router = Router()

router.get(
  "/api/scenario-presets",
  asyncHandler(async (_req, res) => {
    res.json(await db.select().from(scenarioPresets).orderBy(scenarioPresets.name))
  })
)

router.post(
  "/api/scenario-presets",
  asyncHandler(async (req, res) => {
    const parsed = insertScenarioPresetSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(
        400,
        "資料驗證失敗：" + parsed.error.errors.map((e) => e.message).join("、")
      )
    }
    // 同名覆寫
    const existing = await db
      .select({ id: scenarioPresets.id })
      .from(scenarioPresets)
      .where(eq(scenarioPresets.name, parsed.data.name))
      .limit(1)
    if (existing.length > 0) {
      const [row] = await db
        .update(scenarioPresets)
        .set({ levers: parsed.data.levers, updatedAt: new Date() })
        .where(eq(scenarioPresets.id, existing[0].id))
        .returning()
      return res.json(row)
    }
    const [row] = await db.insert(scenarioPresets).values(parsed.data).returning()
    res.json(row)
  })
)

router.delete(
  "/api/scenario-presets/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) throw new AppError(400, "無效的 ID")
    await db.delete(scenarioPresets).where(eq(scenarioPresets.id, id))
    res.json({ success: true })
  })
)

export default router
