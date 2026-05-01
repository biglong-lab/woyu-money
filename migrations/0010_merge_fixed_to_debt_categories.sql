-- ============================================================
-- 0010: 合併 fixed_categories 至 debt_categories
--
-- 目的：消除「固定 vs 專案」雙軌制混亂，統一為單一分類體系。
--
-- 影響範圍（已驗證）：
--   - fixed_categories: 10 筆，2 個被使用（借貸 3 筆 / 管理費 1 筆）
--   - payment_items.fixed_category_id: 4 筆需遷移
--   - budget_items.fixed_category_id: 0 筆
--   - fixed_category_sub_options: 0 筆（廢表）
--   - project_category_templates: 0 筆（廢表）
--
-- 安全性：
--   - 全程 transaction
--   - 不刪 fixed_categories 表（保留 30 天觀察期）
--   - 不刪 fixed_category_id 欄位（同上）
--   - 廢表只 RENAME 不 DROP（rollback 用）
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────
-- 步驟 1：把 fixed.管理費 INSERT 到 debt_categories
--   （fixed.借貸 在 debt 已有 id=36，不重複建）
-- ─────────────────────────────────────────────

INSERT INTO debt_categories (category_name, category_type, description, is_deleted, created_at)
SELECT fc.category_name, 'project', fc.description, false, NOW()
FROM fixed_categories fc
WHERE fc.category_name = '管理費'
  AND fc.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM debt_categories dc
    WHERE dc.category_name = '管理費'
      AND COALESCE(dc.is_deleted, false) = false
  );

-- ─────────────────────────────────────────────
-- 步驟 2：把 payment_items.fixed_category_id 對應到 category_id
--   邏輯：找名字相同的 debt_categories
-- ─────────────────────────────────────────────

UPDATE payment_items pi
SET category_id = (
  SELECT dc.id
  FROM debt_categories dc
  JOIN fixed_categories fc ON fc.category_name = dc.category_name
  WHERE fc.id = pi.fixed_category_id
    AND COALESCE(dc.is_deleted, false) = false
  LIMIT 1
),
updated_at = NOW()
WHERE pi.fixed_category_id IS NOT NULL
  AND pi.category_id IS NULL
  AND COALESCE(pi.is_deleted, false) = false;

-- ─────────────────────────────────────────────
-- 步驟 3：budget_items.fixed_category_id 同上（預期 0 筆，但保留邏輯防未來）
-- ─────────────────────────────────────────────

UPDATE budget_items bi
SET category_id = (
  SELECT dc.id
  FROM debt_categories dc
  JOIN fixed_categories fc ON fc.category_name = dc.category_name
  WHERE fc.id = bi.fixed_category_id
    AND COALESCE(dc.is_deleted, false) = false
  LIMIT 1
),
updated_at = NOW()
WHERE bi.fixed_category_id IS NOT NULL
  AND bi.category_id IS NULL
  AND COALESCE(bi.is_deleted, false) = false;

-- ─────────────────────────────────────────────
-- 步驟 4：標記廢棄欄位（不 DROP，保留 30 天）
-- ─────────────────────────────────────────────

COMMENT ON COLUMN payment_items.fixed_category_id IS
  '@deprecated 2026-05 已合併到 category_id（migration 0010），保留 30 天供 rollback';
COMMENT ON COLUMN budget_items.fixed_category_id IS
  '@deprecated 2026-05 已合併到 category_id（migration 0010），保留 30 天供 rollback';

-- ─────────────────────────────────────────────
-- 步驟 5：把 fixed_categories 標記為廢棄（不 DROP）
-- ─────────────────────────────────────────────

COMMENT ON TABLE fixed_categories IS
  '@deprecated 2026-05 已合併到 debt_categories（migration 0010），保留 30 天供 rollback';

-- ─────────────────────────────────────────────
-- 步驟 6：統計報告
-- ─────────────────────────────────────────────

DO $$
DECLARE
  v_pi_migrated INT;
  v_bi_migrated INT;
  v_pi_orphan INT;
  v_dc_total INT;
BEGIN
  SELECT COUNT(*) INTO v_pi_migrated
  FROM payment_items
  WHERE fixed_category_id IS NOT NULL AND category_id IS NOT NULL;

  SELECT COUNT(*) INTO v_bi_migrated
  FROM budget_items
  WHERE fixed_category_id IS NOT NULL AND category_id IS NOT NULL;

  SELECT COUNT(*) INTO v_pi_orphan
  FROM payment_items
  WHERE fixed_category_id IS NOT NULL AND category_id IS NULL;

  SELECT COUNT(*) INTO v_dc_total
  FROM debt_categories WHERE COALESCE(is_deleted, false) = false;

  RAISE NOTICE '════════════════════════════';
  RAISE NOTICE 'Migration 0010 完成統計：';
  RAISE NOTICE '  payment_items 已遷移：% 筆', v_pi_migrated;
  RAISE NOTICE '  budget_items 已遷移：% 筆', v_bi_migrated;
  RAISE NOTICE '  payment_items 未遷移（孤兒）：% 筆', v_pi_orphan;
  RAISE NOTICE '  debt_categories 總筆數：%', v_dc_total;
  RAISE NOTICE '════════════════════════════';

  IF v_pi_orphan > 0 THEN
    RAISE WARNING '有 % 筆 payment_items 仍有 fixed_category_id 但無對應 category_id', v_pi_orphan;
  END IF;
END $$;

COMMIT;
