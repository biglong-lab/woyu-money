import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import {
  listPolicies,
  updatePolicy,
  getRateMap,
  seedDefaultPolicies,
} from "../storage/late-fee-policies"
import { insertLateFeePolicySchema } from "@shared/schema"
import { ZodError } from "zod"

const router = Router()

router.get(
  "/api/late-fee-policies",
  asyncHandler(async (_req, res) => {
    // 首次取用時 seed 預設
    await seedDefaultPolicies()
    res.json(await listPolicies())
  })
)

router.get(
  "/api/late-fee-policies/rate-map",
  asyncHandler(async (_req, res) => {
    await seedDefaultPolicies()
    res.json(await getRateMap())
  })
)

router.put(
  "/api/late-fee-policies/:categoryKey",
  asyncHandler(async (req, res) => {
    const { categoryKey } = req.params
    try {
      const partial = insertLateFeePolicySchema
        .partial()
        .omit({ categoryKey: true })
        .parse(req.body)
      const row = await updatePolicy(categoryKey, partial)
      if (!row) throw new AppError(404, "policy 不存在")
      res.json(row)
    } catch (err) {
      if (err instanceof ZodError) {
        throw new AppError(400, "資料格式錯誤：" + err.errors.map((e) => e.message).join(", "))
      }
      throw err
    }
  })
)

export default router
