-- 2026-06-19：沙盤推演情境存後端（跨裝置）
-- 安全：CREATE TABLE IF NOT EXISTS（只加不刪）

CREATE TABLE IF NOT EXISTS scenario_presets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  levers JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
