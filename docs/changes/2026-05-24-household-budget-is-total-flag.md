# household_budgets 加 is_total_budget 旗標 — 2026-05-24

> 範圍：shared/schema + server/routes + DB migration
> 狀態：已上線
> 部署 commit：Phase 3 commit hash 由部署時補

## 背景

`household_budgets` 表用 `category_id = 0` 當「總預算」的 sentinel。問題：

- `category_id` 是 FK 對 `household_categories`、`0` 不是合法 id（隱性語意）
- 6 處 WHERE 用 magic number 比對、新人看不出意圖
- 後端 storage layer 跟 routes layer 對 sentinel 的處理不一致（storage 直接 UPDATE 整個 month）

## 影響範圍

- `shared/schema/household.ts` — 加 `isTotalBudget` 欄位
- `server/routes/household.ts` — 6 處 WHERE + 1 處 INSERT
- 新增 `migrations/0013_household_budget_is_total_flag.sql`
- DB schema：`household_budgets` 新增 `is_total_budget BOOLEAN NOT NULL DEFAULT FALSE`

## 解決方案

加 `is_total_budget` 旗標、讀寫對齊新欄位。`category_id = 0` 仍保留作 backward compat（避免一次性大改 audit log）。

- 寫入：INSERT 同時設 `category_id = 0` 與 `is_total_budget = true`
- 讀取：一律 `WHERE is_total_budget = true`、不再用 magic number

## 實作步驟

1. schema 加欄位
2. 6 處 WHERE 改寫
3. INSERT 補 column + value
4. drizzle-kit push 本地套用
5. backfill 現有 cat_id=0 row：`UPDATE ... WHERE category_id = 0`
6. tsc 驗證
7. 生產跑 `migrations/0013_household_budget_is_total_flag.sql`
8. 重啟 container

## 驗證

- tsc 0 error
- 本地 `SELECT COUNT(*) WHERE is_total_budget = true` 回 1（與舊 cat_id=0 row 數一致）
- 生產部署後 `/household-budget` 頁面總預算讀寫正常

## 已知限制

- `household_budget_changes` audit log 仍寫 `category_id = 0`（不動、避免破壞歷史紀錄）
- 未來若要徹底移除 sentinel，需先處理 audit log + storage 層 `setHouseholdBudget` 的整 month UPDATE 邏輯

## 相關文件

- `migrations/0013_household_budget_is_total_flag.sql`
- audit roadmap：`docs/changes/2026-05-24-system-architecture-audit.md`
