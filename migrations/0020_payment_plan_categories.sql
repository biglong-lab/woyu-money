-- 2026-06-13：分類式規劃（分類覆寫 + 分類月度預算）
-- 安全：CREATE TABLE IF NOT EXISTS（只加不刪）

-- 分類覆寫：某筆應付款重新歸到自訂類別
CREATE TABLE IF NOT EXISTS payment_plan_item_categories (
  payment_item_id INTEGER PRIMARY KEY REFERENCES payment_items(id) ON DELETE CASCADE,
  category VARCHAR(60) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 分類月度預算：類別 × 月份 → 金額（含 "營運成本"/"生活所需" 兩塊）
CREATE TABLE IF NOT EXISTS payment_plan_category_budgets (
  id SERIAL PRIMARY KEY,
  category VARCHAR(60) NOT NULL,
  planned_month VARCHAR(7) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_plan_cat_budget_idx
  ON payment_plan_category_budgets(category, planned_month);
