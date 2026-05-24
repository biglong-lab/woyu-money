-- 2026-05-24 audit P4：取代 PM company_id ↔ project_id 兩處 hardcoded mapping
-- 安全：CREATE TABLE IF NOT EXISTS + INSERT ON CONFLICT DO NOTHING

BEGIN;

CREATE TABLE IF NOT EXISTS pm_company_mapping (
  project_id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL UNIQUE,
  hotel_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pm_company_mapping_company_idx
  ON pm_company_mapping(company_id);

INSERT INTO pm_company_mapping (project_id, company_id, hotel_name) VALUES
  (3,  1, '浯島文旅'),
  (4,  2, '浯島輕旅'),
  (9,  3, '小六路厝'),
  (10, 4, '總兵招待所'),
  (20, 5, '魁星背包棧'),
  (26, 6, '大號文創')
ON CONFLICT (project_id) DO NOTHING;

COMMIT;
