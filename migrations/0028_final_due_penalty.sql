-- 2026-06-22：最終必繳日 + 罰款註記（緩衝期/逾期罰款機制）— 只加不刪
-- payment_items：最終必繳日（超過開始有罰款）+ 罰款說明
ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS final_due_date DATE;
ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS penalty_note TEXT;

-- recurring_expense_templates：最終必繳日（每月幾號）+ 罰款說明
ALTER TABLE recurring_expense_templates ADD COLUMN IF NOT EXISTS final_due_day INTEGER;
ALTER TABLE recurring_expense_templates ADD COLUMN IF NOT EXISTS penalty_note TEXT;
