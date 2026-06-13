-- 2026-06-13：排程分配規劃層（獨立規劃，不動 payment_items.dueDate）
-- 安全：CREATE TABLE IF NOT EXISTS（只加不刪）

CREATE TABLE IF NOT EXISTS payment_plan_allocations (
  id SERIAL PRIMARY KEY,
  payment_item_id INTEGER NOT NULL REFERENCES payment_items(id) ON DELETE CASCADE,
  planned_month VARCHAR(7) NOT NULL,        -- YYYY-MM
  planned_amount DECIMAL(12,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_plan_alloc_item_idx ON payment_plan_allocations(payment_item_id);
CREATE INDEX IF NOT EXISTS payment_plan_alloc_month_idx ON payment_plan_allocations(planned_month);
