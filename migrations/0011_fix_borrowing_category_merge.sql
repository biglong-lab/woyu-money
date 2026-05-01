-- ============================================================
-- 0011: 修補 0010 — 處理「借貸」分類軟刪除問題
--
-- 問題：debt_categories.id=36 (借貸) 是 is_deleted=true
--       0010 migration 的 sub-query 過濾掉軟刪除的 → 4 筆借貸 payment_items
--       category_id 仍是 NULL
--
-- 修法：新建一個未軟刪除的「借貸」分類，把 4 筆 payment_items 連過去
--
-- 同時：清掉 payment_item.id=971「自來水費」的 fixed_category_id（歷史資料錯誤
--       — fixed.管理費 但 category=水費，矛盾，移除 fixed link 保留 category）
-- ============================================================

BEGIN;

-- 1. 確保有可用的「借貸」分類（is_deleted=false）
INSERT INTO debt_categories (category_name, category_type, description, is_deleted, created_at)
SELECT '借貸', 'project', '借貸往來款項（從 fixed_categories 遷移）', false, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM debt_categories
  WHERE category_name = '借貸'
    AND COALESCE(is_deleted, false) = false
);

-- 2. 重跑 payment_items 遷移（這次 sub-query 會找到新的 active「借貸」）
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

-- 3. 清掉 fixed_category_id（既已遷移到 category_id 就不再需要連結）
UPDATE payment_items
SET fixed_category_id = NULL,
    updated_at = NOW()
WHERE fixed_category_id IS NOT NULL
  AND category_id IS NOT NULL
  AND COALESCE(is_deleted, false) = false;

-- 4. 統計
DO $$
DECLARE
  v_pi_remaining INT;
  v_pi_fixed_cleared INT;
  v_borrowing_total INT;
BEGIN
  SELECT COUNT(*) INTO v_pi_remaining
  FROM payment_items
  WHERE fixed_category_id IS NOT NULL AND category_id IS NULL;

  SELECT COUNT(*) INTO v_pi_fixed_cleared
  FROM payment_items
  WHERE fixed_category_id IS NULL
    AND category_id IS NOT NULL
    AND COALESCE(is_deleted, false) = false;

  SELECT COUNT(*) INTO v_borrowing_total
  FROM payment_items pi
  JOIN debt_categories dc ON dc.id = pi.category_id
  WHERE dc.category_name = '借貸'
    AND COALESCE(pi.is_deleted, false) = false;

  RAISE NOTICE '════════════════════════════';
  RAISE NOTICE 'Migration 0011 完成統計：';
  RAISE NOTICE '  尚未遷移（孤兒 fixed→null category）：% 筆', v_pi_remaining;
  RAISE NOTICE '  借貸分類總筆數：% 筆', v_borrowing_total;
  RAISE NOTICE '════════════════════════════';

  IF v_pi_remaining > 0 THEN
    RAISE WARNING '仍有 % 筆 payment_items 未完成遷移（需手動處理）', v_pi_remaining;
  END IF;
END $$;

COMMIT;
