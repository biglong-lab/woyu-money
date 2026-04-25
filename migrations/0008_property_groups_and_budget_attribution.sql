-- ============================================================
-- PR-1: 館別群組 + budget_items 屬性維度
--
-- 目標：在不動既有資料的前提下，為「預估 + 實際雙軌」加上：
--   1. 館別共用組（property_groups + members）
--   2. budget_items 加 attribution 維度（single/shared/occupancy/company）
--   3. 共用費用分攤紀錄表（budget_item_allocations）
--
-- 安全性：全部 ADD，不 DROP，不 RENAME。可隨時 rollback。
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. 館別共用組
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS property_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES property_groups(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES payment_projects(id),
  -- 房數比例分攤用（同時也用於 manual 規則的相對權重）
  weight NUMERIC(5,2) DEFAULT 1.00,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (group_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_property_group_members_group_id
  ON property_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_property_group_members_project_id
  ON property_group_members(project_id);

-- ─────────────────────────────────────────────
-- 2. budget_items 加屬性欄位
-- ─────────────────────────────────────────────

-- attribution: single（單館） | shared（群組分攤） | occupancy（佔用驅動） | company（公司級）
ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS attribution VARCHAR(20) DEFAULT 'single';

-- single 時：指向哪個館
ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS target_project_id INTEGER REFERENCES payment_projects(id);

-- shared 時：指向哪個共用組
ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS shared_group_id INTEGER REFERENCES property_groups(id);

-- shared 時：分攤規則 equal | by_rooms | by_revenue | manual
ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS allocation_rule VARCHAR(20);

-- occupancy 時：單日成本（如 PT 700/天、洗滌 150/天）
ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS occupancy_unit_cost NUMERIC(10,2);

-- occupancy 時：預估天數
ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS occupancy_estimated_days INTEGER;

CREATE INDEX IF NOT EXISTS idx_budget_items_attribution
  ON budget_items(attribution);
CREATE INDEX IF NOT EXISTS idx_budget_items_target_project_id
  ON budget_items(target_project_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_shared_group_id
  ON budget_items(shared_group_id);

-- ─────────────────────────────────────────────
-- 3. 共用費用攤提紀錄
--    （shared 類型每筆 budget_item 拆成 N 筆 allocations）
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS budget_item_allocations (
  id SERIAL PRIMARY KEY,
  budget_item_id INTEGER NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES payment_projects(id),
  allocated_amount NUMERIC(10,2) NOT NULL,
  -- 紀錄當下用什麼規則算的（用於審計與重算追溯）
  allocation_basis VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_item_allocations_budget_item_id
  ON budget_item_allocations(budget_item_id);
CREATE INDEX IF NOT EXISTS idx_budget_item_allocations_project_id
  ON budget_item_allocations(project_id);

-- ─────────────────────────────────────────────
-- 4. 初始資料：建立既有的「輕旅櫃台組」
--    （冪等：用 NOT EXISTS 避免重複插入）
-- ─────────────────────────────────────────────

INSERT INTO property_groups (name, description)
SELECT '輕旅櫃台組', '輕旅 + 招待所 + 背包棧 共用櫃台人事與洗滌（電話與櫃台用品歸輕旅）'
WHERE NOT EXISTS (
  SELECT 1 FROM property_groups WHERE name = '輕旅櫃台組'
);

-- 取得剛建立或既有的 group id
DO $$
DECLARE
  v_group_id INTEGER;
  v_qinglv_id INTEGER;
  v_ziaodai_id INTEGER;
  v_kuixing_id INTEGER;
BEGIN
  SELECT id INTO v_group_id FROM property_groups WHERE name = '輕旅櫃台組';
  SELECT id INTO v_qinglv_id FROM payment_projects WHERE project_name = '浯島輕旅';
  SELECT id INTO v_ziaodai_id FROM payment_projects WHERE project_name = '招待所' OR project_name LIKE '%招待所%' LIMIT 1;
  SELECT id INTO v_kuixing_id FROM payment_projects WHERE project_name = '魁星背包棧' OR project_name LIKE '%背包棧%' LIMIT 1;

  -- 輕旅 (8 房)
  IF v_qinglv_id IS NOT NULL THEN
    INSERT INTO property_group_members (group_id, project_id, weight, notes)
    VALUES (v_group_id, v_qinglv_id, 8, '櫃台所在館')
    ON CONFLICT (group_id, project_id) DO NOTHING;
  END IF;

  -- 招待所 (4 房)
  IF v_ziaodai_id IS NOT NULL THEN
    INSERT INTO property_group_members (group_id, project_id, weight, notes)
    VALUES (v_group_id, v_ziaodai_id, 4, NULL)
    ON CONFLICT (group_id, project_id) DO NOTHING;
  END IF;

  -- 背包棧 (6 房)
  IF v_kuixing_id IS NOT NULL THEN
    INSERT INTO property_group_members (group_id, project_id, weight, notes)
    VALUES (v_group_id, v_kuixing_id, 6, NULL)
    ON CONFLICT (group_id, project_id) DO NOTHING;
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 5. 註解（記錄設計意圖）
-- ─────────────────────────────────────────────

COMMENT ON TABLE property_groups IS '館別共用組：定義哪些 project 共用某些費用（如人事、洗滌）';
COMMENT ON TABLE property_group_members IS '群組成員 + 分攤權重（房數）';
COMMENT ON TABLE budget_item_allocations IS '共用費用實際分攤到各館的紀錄（每筆 shared budget_item 對應 N 筆）';
COMMENT ON COLUMN budget_items.attribution IS 'single（單館）| shared（群組分攤）| occupancy（佔用驅動）| company（公司級）';
COMMENT ON COLUMN budget_items.allocation_rule IS 'equal（平均）| by_rooms（房數比例）| by_revenue（營收比例）| manual（手動權重）';
