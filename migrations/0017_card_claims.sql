-- 2026-06-13：信用卡請款紀錄（獨立模組）
-- 安全：全部 CREATE TABLE IF NOT EXISTS + INSERT ON CONFLICT DO NOTHING（只加不刪）

BEGIN;

-- 請款標籤（可自訂）
CREATE TABLE IF NOT EXISTS card_claim_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 館別（可自訂）
CREATE TABLE IF NOT EXISTS card_claim_properties (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 信用卡請款紀錄主表
CREATE TABLE IF NOT EXISTS card_claims (
  id SERIAL PRIMARY KEY,
  amount DECIMAL(12,2) NOT NULL,
  swipe_date DATE NOT NULL,
  bank VARCHAR(100),
  tag_id INTEGER REFERENCES card_claim_tags(id),
  property_id INTEGER REFERENCES card_claim_properties(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS card_claims_swipe_date_idx ON card_claims(swipe_date);
CREATE INDEX IF NOT EXISTS card_claims_status_idx ON card_claims(status);
CREATE INDEX IF NOT EXISTS card_claims_tag_idx ON card_claims(tag_id);
CREATE INDEX IF NOT EXISTS card_claims_property_idx ON card_claims(property_id);

-- 預設請款標籤
INSERT INTO card_claim_tags (name, sort_order) VALUES
  ('Booking', 1),
  ('Agoda', 2),
  ('Trip', 3),
  ('Expedia', 4),
  ('官方直訂', 5)
ON CONFLICT (name) DO NOTHING;

-- 預設館別（既有館舍）
INSERT INTO card_claim_properties (name, sort_order) VALUES
  ('浯島文旅', 1),
  ('浯島輕旅', 2),
  ('小六路厝', 3),
  ('總兵招待所', 4),
  ('魁星背包棧', 5)
ON CONFLICT (name) DO NOTHING;

COMMIT;
