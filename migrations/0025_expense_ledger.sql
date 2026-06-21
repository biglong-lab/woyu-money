-- 2026-06-21：開銷流水帳（先記錄、後分帳）
-- 安全：CREATE TABLE IF NOT EXISTS（只加不刪）

CREATE TABLE IF NOT EXISTS expense_ledger (
  id SERIAL PRIMARY KEY,
  amount DECIMAL(12,2) NOT NULL,
  entry_date DATE NOT NULL,
  payment_method VARCHAR(50),
  note TEXT,
  receipt_image_url VARCHAR(500),
  category_id INTEGER,
  account_code VARCHAR(50),
  project_id INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'unclassified',
  linked_payment_item_id INTEGER,
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expense_ledger_entry_date_idx ON expense_ledger(entry_date);
CREATE INDEX IF NOT EXISTS expense_ledger_status_idx ON expense_ledger(status);
