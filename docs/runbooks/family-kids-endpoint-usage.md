→ 解析 207 個 endpoints
→ 掃描 399 個檔案
# Family-Kids Endpoints 使用率報告

> 生成時間：2026-05-23T10:46:47.379Z
> 來源：`server/routes/family-kids.ts`
> 引用掃描：`client/src`, `shared`

## 統計

- 總 endpoints：**207**
- 🟢 有被前端引用：**205**（99%）
- 🔴 完全沒被引用：**2**（1%）

## 判定方式

- 把 raw path 轉成 regex：`:param` → `[\w${}.-]+`（容納 template literals 變數展開）
- 結尾加 boundary `(?![A-Za-z0-9_/-])` 避免 `/api/family/kids` 被 `/api/family/kids-stats` 吞掉
- 在 `client/src/` 與 `shared/` 全文 regex 搜索
- 命中 = `references >= 1`
- ⚠️ 可能誤判：
  - 動態完全拼湊 URL（如 `apiPath = '/api/' + 'family/' + xxx`）會漏掉
  - 註解中提到的 endpoint 也算引用（自我提及）
- 偏向「保守保留」、不會誤刪正在用的

## 各區塊明細

### 1. 小孩帳戶

> 7 個 · 0 沒被引用

| 狀態 | Method | Path | Refs | 說明 |
|------|--------|------|------|------|
| 🟢 | GET | `/api/family/kids` | 2 | — |
| 🟢 | POST | `/api/family/kids` | 2 | — |
| 🟢 | PUT | `/api/family/kids/:id` | 2 | — |
| 🟢 | DELETE | `/api/family/kids/:id` | 2 | — |
| 🟡 | POST | `/api/family/kids/pin-login` | 1 | — |
| 🟡 | GET | `/api/family/parent-pin/status` | 1 | — |
| 🟡 | POST | `/api/family/parent-pin/verify` | 1 | — |

### 2. 任務

> 10 個 · 0 沒被引用

| 狀態 | Method | Path | Refs | 說明 |
|------|--------|------|------|------|
| 🟢 | GET | `/api/family/tasks` | 2 | — |
| 🟢 | POST | `/api/family/tasks` | 2 | — |
| 🟡 | POST | `/api/family/tasks/propose` | 1 | — |
| 🟢 | PUT | `/api/family/tasks/:id` | 2 | — |
| 🟡 | POST | `/api/family/tasks/broadcast` | 1 | — |
| 🟡 | POST | `/api/family/tasks/:id/claim` | 1 | — |
| 🟡 | POST | `/api/family/tasks/:id/submit` | 1 | — |
| 🟡 | POST | `/api/family/tasks/:id/reject` | 1 | — |
| 🟡 | POST | `/api/family/tasks/:id/approve` | 1 | — |
| 🟢 | DELETE | `/api/family/tasks/:id` | 2 | — |

### 3. 存錢目標

> 4 個 · 0 沒被引用

| 狀態 | Method | Path | Refs | 說明 |
|------|--------|------|------|------|
| 🟡 | GET | `/api/family/goals` | 1 | — |
| 🟡 | POST | `/api/family/goals` | 1 | — |
| 🟡 | POST | `/api/family/goals/:id/save` | 1 | — |
| 🟡 | PUT | `/api/family/goals/:id` | 1 | — |

### 4. Dashboard 聚合

> 1 個 · 0 沒被引用

| 狀態 | Method | Path | Refs | 說明 |
|------|--------|------|------|------|
| 🟢 | GET | `/api/family/dashboard` | 3 | — |

### 5. 花錢紀錄（小孩自己記）

> 182 個 · 2 沒被引用

| 狀態 | Method | Path | Refs | 說明 |
|------|--------|------|------|------|
| 🟡 | GET | `/api/family/spendings` | 1 | — |
| 🟡 | POST | `/api/family/spendings` | 1 | — |
| 🟡 | POST | `/api/family/jars/internal-transfer` | 1 | — |
| 🟡 | POST | `/api/family/jars/transfer` | 1 | — |
| 🟡 | DELETE | `/api/family/spendings/:id` | 1 | — |
| 🔴 | GET | `/api/family/badges` | 0 | — |
| 🟡 | GET | `/api/family/jars-trend` | 1 | — |
| 🟡 | GET | `/api/family/jars-trend-multi` | 1 | — |
| 🟡 | GET | `/api/family/monthly-report` | 1 | — |
| 🟢 | GET | `/api/family/leaderboard` | 2 | — |
| 🟢 | POST | `/api/family/daily-message` | 2 | — |
| 🟢 | GET | `/api/family/daily-message` | 2 | — |
| 🟡 | GET | `/api/family/family-monthly-summary` | 1 | — |
| 🟡 | GET | `/api/family/year-summary` | 1 | — |
| 🟡 | GET | `/api/family/category-stats` | 1 | — |
| 🟡 | GET | `/api/family/difficulty-insights` | 1 | — |
| 🟡 | POST | `/api/family/ai-suggest-tasks` | 1 | — |
| 🟡 | GET | `/api/family/parent-reminders` | 1 | — |
| 🟡 | GET | `/api/family/kid-level` | 1 | — |
| 🟡 | GET | `/api/family/kid-strengths` | 1 | — |
| 🟡 | GET | `/api/family/lifetime-stats` | 1 | — |
| 🟡 | GET | `/api/family/peak-week` | 1 | — |
| 🟡 | GET | `/api/family/multi-rank` | 1 | — |
| 🟡 | GET | `/api/family/calendar-month` | 1 | — |
| 🟡 | GET | `/api/family/emoji-cloud` | 1 | — |
| 🟡 | GET | `/api/family/kid-strengths-list` | 1 | — |
| 🟡 | GET | `/api/family/health-dashboard` | 1 | — |
| 🟡 | GET | `/api/family/kid-mood-trend` | 1 | — |
| 🟡 | GET | `/api/family/kid-wishlist-summary` | 1 | — |
| 🟡 | GET | `/api/family/kids-attention` | 1 | — |
| 🟡 | GET | `/api/family/kid-net-worth` | 1 | — |
| 🟡 | GET | `/api/family/fairness` | 1 | — |
| 🟡 | GET | `/api/family/goal-achievers` | 1 | — |
| 🟡 | GET | `/api/family/completed-goals-history` | 1 | — |
| 🟡 | GET | `/api/family/pot-top-contributors` | 1 | — |
| 🟡 | GET | `/api/family/kid-emoji-cloud` | 1 | — |
| 🟡 | GET | `/api/family/family-mood-today` | 1 | — |
| 🟡 | GET | `/api/family/weekly-heatmap` | 1 | — |
| 🟡 | GET | `/api/family/kid-education-report` | 1 | — |
| 🟡 | GET | `/api/family/kid-timecapsule` | 1 | — |
| 🟡 | GET | `/api/family/kid-goals-deadlines` | 1 | — |
| 🟡 | GET | `/api/family/parent-todo` | 1 | — |
| 🟡 | GET | `/api/family/kid-weekly-report` | 1 | — |
| 🟢 | GET | `/api/family/today-summary` | 2 | — |
| 🟡 | GET | `/api/family/kid-donation-recipients` | 1 | — |
| 🟡 | GET | `/api/family/kid-spending-keywords` | 1 | — |
| 🟡 | GET | `/api/family/sibling-comparison` | 1 | — |
| 🟡 | GET | `/api/family/kid-suggestions` | 1 | — |
| 🟡 | GET | `/api/family/kid-wallet-health` | 1 | — |
| 🟡 | GET | `/api/family/milestones` | 1 | — |
| 🟡 | GET | `/api/family/wealth-trend` | 1 | — |
| 🟡 | GET | `/api/family/kid-time-of-day` | 1 | — |
| 🟡 | GET | `/api/family/popular-tasks` | 1 | — |
| 🟡 | GET | `/api/family/kid-praises` | 1 | — |
| 🟡 | GET | `/api/family/kid-activity-heatmap` | 1 | — |
| 🟡 | GET | `/api/family/all-goals-summary` | 1 | — |
| 🟡 | GET | `/api/family/kid-next-badge` | 1 | — |
| 🟡 | GET | `/api/family/kid-task-streak` | 1 | — |
| 🟡 | GET | `/api/family/monthly-stats` | 1 | — |
| 🟡 | GET | `/api/family/kid-difficulty-stats` | 1 | — |
| 🟡 | GET | `/api/family/goals/:id/eta` | 1 | — |
| 🟡 | GET | `/api/family/activity` | 1 | — |
| 🟡 | GET | `/api/family/kid-bests` | 1 | — |
| 🟡 | GET | `/api/family/kid-activity` | 1 | — |
| 🟡 | GET | `/api/family/search` | 1 | — |
| 🟡 | GET | `/api/family/badges-catalog` | 1 | — |
| 🟡 | POST | `/api/family/kids/:id/change-pin` | 1 | — |
| 🟡 | PUT | `/api/family/kids/:id/personalize` | 1 | — |
| 🟢 | GET | `/api/family/tasks/:id/comments` | 2 | — |
| 🟢 | POST | `/api/family/tasks/:id/comments` | 2 | — |
| 🟡 | GET | `/api/family/donations` | 1 | — |
| 🟡 | GET | `/api/family/wishes` | 1 | — |
| 🟡 | POST | `/api/family/wishes` | 1 | — |
| 🟡 | PUT | `/api/family/wishes/:id` | 1 | — |
| 🟡 | DELETE | `/api/family/wishes/:id` | 1 | — |
| 🟡 | POST | `/api/family/wishes/:id/promote` | 1 | — |
| 🟡 | GET | `/api/family/mood-trends` | 1 | — |
| 🟡 | POST | `/api/family/checkins` | 1 | — |
| 🟡 | GET | `/api/family/checkins` | 1 | — |
| 🟢 | GET | `/api/family/pots` | 2 | — |
| 🟢 | POST | `/api/family/pots` | 2 | — |
| 🟡 | POST | `/api/family/pots/:id/contribute` | 1 | — |
| 🔴 | POST | `/api/family/pots/:id/complete` | 0 | — |
| 🟢 | DELETE | `/api/family/pots/:id` | 2 | — |
| 🟢 | GET | `/api/family/recipients` | 2 | — |
| 🟢 | POST | `/api/family/recipients` | 2 | — |
| 🟡 | DELETE | `/api/family/recipients/:id` | 1 | — |
| 🟡 | GET | `/api/family/custom-templates` | 1 | — |
| 🟡 | POST | `/api/family/custom-templates` | 1 | — |
| 🟡 | DELETE | `/api/family/custom-templates/:id` | 1 | — |
| 🟡 | GET | `/api/family/activity-feed` | 1 | — |
| 🟡 | GET | `/api/family/tasks.ics` | 1 | — |
| 🟡 | POST | `/api/family/upload-proof` | 1 | — |
| 🟡 | GET | `/api/family/today-tasks-list` | 1 | — |
| 🟡 | GET | `/api/family/kids/:kidId/jar-balance-history` | 1 | — |
| 🟡 | GET | `/api/family/streak-ranking` | 1 | — |
| 🟡 | GET | `/api/family/approval-lead-time` | 1 | — |
| 🟡 | GET | `/api/family/monthly-task-creation-trend` | 1 | — |
| 🟡 | GET | `/api/family/today-spending-feed` | 1 | — |
| 🟡 | GET | `/api/family/avg-reward-by-category` | 1 | — |
| 🟡 | GET | `/api/family/biggest-spendings` | 1 | — |
| 🟡 | GET | `/api/family/monthly-spending-trend` | 1 | — |
| 🟡 | GET | `/api/family/wishes-aging` | 1 | — |
| 🟡 | GET | `/api/family/top-task-emojis` | 1 | — |
| 🟡 | GET | `/api/family/kids-needing-attention` | 1 | — |
| 🟡 | GET | `/api/family/family-weekend-vs-weekday` | 1 | — |
| 🟡 | GET | `/api/family/wish-promotion-rate` | 1 | — |
| 🟡 | GET | `/api/family/spending-summary` | 1 | — |
| 🟡 | GET | `/api/family/family-checkin-streak` | 1 | — |
| 🟡 | GET | `/api/family/wish-priority-breakdown` | 1 | — |
| 🟡 | GET | `/api/family/monthly-goals-trend` | 1 | — |
| 🟡 | GET | `/api/family/family-rejection-rate` | 1 | — |
| 🟡 | GET | `/api/family/comment-interaction` | 1 | — |
| 🟡 | GET | `/api/family/savings-summary` | 1 | — |
| 🟡 | GET | `/api/family/recent-badges` | 1 | — |
| 🟡 | GET | `/api/family/task-hour-distribution` | 1 | — |
| 🟡 | GET | `/api/family/biggest-wins` | 1 | — |
| 🟡 | GET | `/api/family/today-checkin-roster` | 1 | — |
| 🟡 | GET | `/api/family/task-category-breakdown` | 1 | — |
| 🟡 | GET | `/api/family/kindness-milestone` | 1 | — |
| 🟡 | GET | `/api/family/top-recipients` | 1 | — |
| 🟡 | GET | `/api/family/proof-image-wall` | 1 | — |
| 🟡 | GET | `/api/family/stale-pending-tasks` | 1 | — |
| 🟡 | GET | `/api/family/weekly-kindness-story` | 1 | — |
| 🟡 | GET | `/api/family/task-repeat-by-kid` | 1 | — |
| 🟡 | GET | `/api/family/first-task-timeline` | 1 | — |
| 🟡 | GET | `/api/family/kid-weekend-vs-weekday` | 1 | — |
| 🟡 | GET | `/api/family/all-goals-eta` | 1 | — |
| 🟡 | GET | `/api/family/today-leaderboard` | 1 | — |
| 🟡 | GET | `/api/family/today-vs-yesterday` | 1 | — |
| 🟡 | GET | `/api/family/kid-avg-reward` | 1 | — |
| 🟡 | GET | `/api/family/kid-learning-curve` | 1 | — |
| 🟡 | GET | `/api/family/kid-favorite-emoji` | 1 | — |
| 🟡 | GET | `/api/family/kid-peak-hour` | 1 | — |
| 🟡 | GET | `/api/family/difficulty-by-kid` | 1 | — |
| 🟡 | GET | `/api/family/task-speed-mvp` | 1 | — |
| 🟡 | GET | `/api/family/kid-daily-avg-tasks` | 1 | — |
| 🟡 | GET | `/api/family/task-category-by-kid` | 1 | — |
| 🟡 | GET | `/api/family/goal-urgency-rank` | 1 | — |
| 🟡 | GET | `/api/family/kid-earnings-trend` | 1 | — |
| 🟡 | GET | `/api/family/goals-monthly-completion` | 1 | — |
| 🟡 | GET | `/api/family/category-heat-trend` | 1 | — |
| 🟡 | GET | `/api/family/badge-leaderboard` | 1 | — |
| 🟡 | GET | `/api/family/kid-spending-habits` | 1 | — |
| 🟡 | GET | `/api/family/kid-active-days` | 1 | — |
| 🟡 | GET | `/api/family/task-mvp` | 1 | — |
| 🟡 | GET | `/api/family/kid-task-completion-rate` | 1 | — |
| 🟡 | GET | `/api/family/jar-allocation-by-kid` | 1 | — |
| 🟡 | GET | `/api/family/savings-velocity-rank` | 1 | — |
| 🟡 | GET | `/api/family/task-monthly-growth` | 1 | — |
| 🟡 | GET | `/api/family/goal-amount-histogram` | 1 | — |
| 🟡 | GET | `/api/family/task-duration` | 1 | — |
| 🟡 | GET | `/api/family/spending-top-items` | 1 | — |
| 🟡 | GET | `/api/family/captain` | 1 | — |
| 🟡 | GET | `/api/family/monthly-improvement-rank` | 1 | — |
| 🟡 | GET | `/api/family/deadline-hit-rate` | 1 | — |
| 🟡 | GET | `/api/family/today-tip` | 1 | — |
| 🟡 | GET | `/api/family/peak-moment` | 1 | — |
| 🟡 | GET | `/api/family/goals-progress-rank` | 1 | — |
| 🟡 | GET | `/api/family/goals-vs-wishes` | 1 | — |
| 🟡 | GET | `/api/family/approve-latency` | 1 | — |
| 🟡 | GET | `/api/family/feedback-rate` | 1 | — |
| 🟡 | GET | `/api/family/reward-stats` | 1 | — |
| 🟡 | GET | `/api/family/initiative-rate` | 1 | — |
| 🟡 | GET | `/api/family/weekend-vs-weekday` | 1 | — |
| 🟡 | GET | `/api/family/income-vs-spending` | 1 | — |
| 🟡 | GET | `/api/family/jars-current-balance` | 1 | — |
| 🟡 | GET | `/api/family/goals-completion-rate` | 1 | — |
| 🟡 | GET | `/api/family/spending-daily` | 1 | — |
| 🟡 | GET | `/api/family/time-of-day` | 1 | — |
| 🟡 | GET | `/api/family/kid-growth-stage` | 1 | — |
| 🟡 | GET | `/api/family/activity-streak` | 1 | — |
| 🟡 | GET | `/api/family/kid-task-variety` | 1 | — |
| 🟡 | GET | `/api/family/task-creation-cadence` | 1 | — |
| 🟡 | GET | `/api/family/kids-last-activity` | 1 | — |
| 🟡 | GET | `/api/family/savings-retention` | 1 | — |
| 🟡 | GET | `/api/family/multi-month-trend` | 1 | — |
| 🟡 | GET | `/api/family/daily-recap` | 1 | — |
| 🟡 | GET | `/api/family/family-story` | 1 | — |
| 🟡 | GET | `/api/family/difficulty-evolution` | 1 | — |
| 🟡 | GET | `/api/family/weekly-summary` | 1 | — |
| 🟡 | POST | `/api/family/tasks/bulk-approve` | 1 | — |

### 任務範本（內建、不存 DB）

> 1 個 · 0 沒被引用

| 狀態 | Method | Path | Refs | 說明 |
|------|--------|------|------|------|
| 🟡 | GET | `/api/family/task-templates` | 1 | — |

### 節慶任務範本（按月份顯示對應節慶）

> 2 個 · 0 沒被引用

| 狀態 | Method | Path | Refs | 說明 |
|------|--------|------|------|------|
| 🟡 | GET | `/api/family/task-templates/seasonal` | 1 | — |
| 🟡 | POST | `/api/family/tasks/batch` | 1 | — |

---

## 後續處理建議

1. **🔴 0 refs**：
   - 第一步：手動 search routes file 看是否被同 router 內呼叫（getter 用於其他 endpoint）
   - 第二步：確認是否為 admin 端點 / cron 觸發 / webhook 接收
   - 第三步：以上皆否、寫 ADR + 移到 `archive/` 區塊 or 直接刪
2. **🟡 1 ref**：可能正在用、不動
3. **🟢 2+ refs**：核心 endpoint、保留

**重要：本報告僅供評估、不執行任何刪除動作。**
