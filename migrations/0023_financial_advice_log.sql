-- 2026-06-19：AI 財務顧問建議歷史
-- 安全：CREATE TABLE IF NOT EXISTS（只加不刪）

CREATE TABLE IF NOT EXISTS financial_advice_log (
  id SERIAL PRIMARY KEY,
  advice TEXT NOT NULL,
  model VARCHAR(100),
  snapshot JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_advice_log_created_idx ON financial_advice_log(created_at);
