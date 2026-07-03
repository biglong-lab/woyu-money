/**
 * 家用記帳 API — 拆分後入口（2026-07-03 Phase 3.1）
 *
 * 原 1,968 行單檔依端點順序機械拆為 3 個子檔 + helpers.ts。
 * 掛載順序 = 原檔端點註冊順序（路徑 pattern 的比對順序不變）。
 */
import { Router } from "express"
import part01 from "./01-categories"
import part02 from "./02-expenses"
import part03 from "./03-templates"

const router = Router()
router.use(part01)
router.use(part02)
router.use(part03)

export default router
