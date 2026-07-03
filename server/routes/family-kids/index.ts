/**
 * 家庭記帳「小孩模式」API — 拆分後入口（2026-07-03 Phase 3.1）
 *
 * 原 16,363 行單檔依端點順序機械拆為 26 個子檔 + helpers.ts。
 * 掛載順序 = 原檔端點註冊順序（路徑 pattern 的比對順序不變）。
 */
import { Router } from "express"
import part01 from "./01-kids"
import part02 from "./02-tasks"
import part03 from "./03-spendings"
import part04 from "./04-year-summary"
import part05 from "./05-kid-level"
import part06 from "./06-health-dashboard"
import part07 from "./07-completed-goals-history"
import part08 from "./08-kid-goals-deadlines"
import part09 from "./09-kid-spending-keywords"
import part10 from "./10-popular-tasks"
import part11 from "./11-kid-difficulty-stats"
import part12 from "./12-badges-catalog"
import part13 from "./13-checkins"
import part14 from "./14-kids-2"
import part15 from "./15-monthly-spending-trend"
import part16 from "./16-wish-priority-breakdown"
import part17 from "./17-today-checkin-roster"
import part18 from "./18-first-task-timeline"
import part19 from "./19-kid-favorite-emoji"
import part20 from "./20-kid-earnings-trend"
import part21 from "./21-kid-task-completion-rate"
import part22 from "./22-monthly-improvement-rank"
import part23 from "./23-reward-stats"
import part24 from "./24-time-of-day"
import part25 from "./25-savings-retention"
import part26 from "./26-tasks-2"

const router = Router()
router.use(part01)
router.use(part02)
router.use(part03)
router.use(part04)
router.use(part05)
router.use(part06)
router.use(part07)
router.use(part08)
router.use(part09)
router.use(part10)
router.use(part11)
router.use(part12)
router.use(part13)
router.use(part14)
router.use(part15)
router.use(part16)
router.use(part17)
router.use(part18)
router.use(part19)
router.use(part20)
router.use(part21)
router.use(part22)
router.use(part23)
router.use(part24)
router.use(part25)
router.use(part26)

export default router
