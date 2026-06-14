-- 2026-06-14：信用卡請款 — 銀行可管理清單 + 館別多選
-- 安全：CREATE TABLE IF NOT EXISTS + INSERT ON CONFLICT DO NOTHING（只加不刪）

BEGIN;

-- 刷卡銀行（可自訂）
CREATE TABLE IF NOT EXISTS card_claim_banks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO card_claim_banks (name, sort_order) VALUES
  ('中國信託', 1),
  ('聯合信用卡', 2)
ON CONFLICT (name) DO NOTHING;

-- 館別多選關聯（一筆請款對多個館別）
CREATE TABLE IF NOT EXISTS card_claim_property_links (
  id SERIAL PRIMARY KEY,
  claim_id INTEGER NOT NULL REFERENCES card_claims(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES card_claim_properties(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS card_claim_prop_link_claim_idx
  ON card_claim_property_links(claim_id);

-- 既有單選 property_id 回填到多選關聯
INSERT INTO card_claim_property_links (claim_id, property_id)
SELECT id, property_id FROM card_claims
WHERE property_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
