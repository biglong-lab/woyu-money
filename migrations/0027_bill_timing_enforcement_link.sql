-- 2026-06-22：帳單時間掌握 + 強執分流連結 — 只加不刪
-- payment_items：帳單來的時間 / 法定付款時間 / 強執分流連結
ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS bill_issued_date DATE;
ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS legal_due_date DATE;
ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS enforcement_case_id INTEGER;
CREATE INDEX IF NOT EXISTS payment_items_enforcement_case_idx ON payment_items(enforcement_case_id);

-- recurring_expense_templates：帳單來的日 / 法定繳費日
ALTER TABLE recurring_expense_templates ADD COLUMN IF NOT EXISTS bill_day INTEGER;
ALTER TABLE recurring_expense_templates ADD COLUMN IF NOT EXISTS legal_due_day INTEGER;
