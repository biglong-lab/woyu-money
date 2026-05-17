-- 補建 2025-12 ~ 2026-05 期間缺失的「固定週期支出」
--
-- 對「最近 6 個月內有過 ≥2 筆紀錄」的 (category, project) 組合：
--   1. 從「最後一筆紀錄的次月」開始補到當前月
--   2. 金額用該組合的歷史平均
--   3. status='unpaid'、source='auto_backfill'（與 manual/pm/hr/ai_scan 並列）
--   4. notes 標明「自動補建（依歷史 N 筆平均，請核實實際金額）」
--   5. 跳過該月已有相同 (cat,proj) manual 紀錄的（避免重複）
--
-- 安全：可重複執行；只動 INSERT、不改動既有資料

BEGIN;

DO $$
DECLARE
  rec RECORD;
  cur_month DATE;
  end_month DATE := DATE_TRUNC('month', NOW()::date)::date;
  start_day INT := 10;  -- 假設每月 10 日為估算到期日
  inserted_count INT := 0;
  skipped_count INT := 0;
  start_date_val DATE;
BEGIN
  FOR rec IN
    SELECT
      pi.category_id, pi.fixed_category_id, pi.project_id,
      MAX(pi.start_date) AS last_date,
      ROUND(AVG(pi.total_amount::numeric))::int AS avg_amt,
      COUNT(*) AS history_count,
      MIN(COALESCE(dc.category_name, fc.category_name)) AS cat_name,
      pp.project_name
    FROM payment_items pi
    LEFT JOIN debt_categories dc ON dc.id = pi.category_id
    LEFT JOIN fixed_categories fc ON fc.id = pi.fixed_category_id
    LEFT JOIN payment_projects pp ON pp.id = pi.project_id
    WHERE pi.source = 'manual' AND NOT pi.is_deleted
      AND pi.item_type IN ('project', 'home')
      AND pi.start_date >= '2025-06-01'  -- 限近 1 年
      AND COALESCE(dc.category_name, fc.category_name) IN
        ('洗滌費', '人事費用', '借貸', '水費', '電費', '軟體服務', '電話費', '保險稅務')
    GROUP BY pi.category_id, pi.fixed_category_id, pi.project_id, pp.project_name
    HAVING COUNT(*) >= 2  -- 至少 2 筆歷史才視為週期性
       AND MAX(pi.start_date) < DATE_TRUNC('month', NOW()::date)  -- 最後紀錄不在當月
  LOOP
    cur_month := (DATE_TRUNC('month', rec.last_date) + INTERVAL '1 month')::date;

    WHILE cur_month <= end_month LOOP
      -- 跳過該月該 (cat,project) 已有 manual 紀錄
      IF NOT EXISTS (
        SELECT 1 FROM payment_items
        WHERE source IN ('manual', 'auto_backfill')
          AND NOT is_deleted
          AND (category_id IS NOT DISTINCT FROM rec.category_id)
          AND (fixed_category_id IS NOT DISTINCT FROM rec.fixed_category_id)
          AND project_id = rec.project_id
          AND DATE_TRUNC('month', start_date)::date = cur_month
      ) THEN
        start_date_val := cur_month + (start_day - 1);

        INSERT INTO payment_items (
          item_name, total_amount, item_type, payment_type,
          project_id, category_id, fixed_category_id,
          start_date, status, paid_amount, source,
          tags, notes, priority, created_at, updated_at
        ) VALUES (
          rec.cat_name || ' ' || TO_CHAR(cur_month, 'YYYY-MM') ||
            CASE WHEN rec.project_name IS NOT NULL THEN ' - ' || rec.project_name ELSE '' END,
          rec.avg_amt,
          'project', 'single',
          rec.project_id, rec.category_id, rec.fixed_category_id,
          start_date_val, 'unpaid', 0, 'auto_backfill',
          '自動補建,週期性支出,' || rec.cat_name,
          CONCAT_WS(E'\n',
            '⚠️ 自動補建：依歷史 ' || rec.history_count || ' 筆平均金額 $' || rec.avg_amt,
            '請核實實際金額並改為 paid 狀態',
            '若該月實際未發生，請刪除此筆'
          ),
          3,
          NOW(), NOW()
        );

        inserted_count := inserted_count + 1;
      ELSE
        skipped_count := skipped_count + 1;
      END IF;

      cur_month := (cur_month + INTERVAL '1 month')::date;
    END LOOP;
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════';
  RAISE NOTICE '✓ 補建 % 筆 auto_backfill payment_item', inserted_count;
  RAISE NOTICE '✓ 跳過 % 筆（已有紀錄）', skipped_count;
END $$;

-- 列出新建的
SELECT
  TO_CHAR(start_date, 'YYYY-MM') AS month,
  item_name, total_amount::int AS amount, status
FROM payment_items
WHERE source = 'auto_backfill' AND NOT is_deleted
ORDER BY start_date DESC, item_name
LIMIT 50;

-- 統計新財務全貌
SELECT
  TO_CHAR(start_date, 'YYYY-MM') AS month,
  SUM(total_amount::numeric)::bigint AS total_expense,
  COUNT(*) AS items,
  COUNT(*) FILTER (WHERE source = 'auto_backfill') AS auto_filled
FROM payment_items
WHERE item_type IN ('project', 'home') AND NOT is_deleted
  AND start_date >= '2025-08-01' AND start_date <= NOW()::date
GROUP BY 1 ORDER BY 1 DESC;

COMMIT;
