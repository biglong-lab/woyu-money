-- 2026-05-24 audit P3：取代 household_budgets.category_id=0 sentinel
-- 加 is_total_budget 旗標欄位、backfill 舊資料
-- 安全：ADD COLUMN + UPDATE（無 DROP）

BEGIN;

ALTER TABLE household_budgets
  ADD COLUMN IF NOT EXISTS is_total_budget BOOLEAN NOT NULL DEFAULT FALSE;

-- 把舊 sentinel cat_id=0 row 設 is_total_budget=true（讀寫對齊新欄位）
UPDATE household_budgets
SET is_total_budget = TRUE
WHERE category_id = 0
  AND is_total_budget = FALSE;

COMMIT;
