-- 批次確認 income_webhooks（5,476 筆歷史 backfill）
--
-- 步驟：
--  1. 補 5 個新 income_sources 的 default_project_id
--  2. 對所有 active source 的 pending webhook：
--     - 建 payment_item (itemType='income', status='paid', source='webhook')
--     - 建 payment_record
--     - 更新 webhook → status='confirmed' + linked_item_id + linked_record_id
--
-- 鏡像 server/storage/income.ts confirmWebhook + _createPaymentFromWebhook 邏輯

BEGIN;

-- 1. 補 default_project_id
UPDATE income_sources SET default_project_id = 4  WHERE source_key = 'pm-wdql-in'  AND default_project_id IS NULL;
UPDATE income_sources SET default_project_id = 9  WHERE source_key = 'pm-xllc-in'  AND default_project_id IS NULL;
UPDATE income_sources SET default_project_id = 10 WHERE source_key = 'pm-zbzds-in' AND default_project_id IS NULL;
UPDATE income_sources SET default_project_id = 20 WHERE source_key = 'pm-kxbbz-in' AND default_project_id IS NULL;
UPDATE income_sources SET default_project_id = 26 WHERE source_key = 'pm-dhwc-in'  AND default_project_id IS NULL;

-- 2. 批次確認
DO $$
DECLARE
  w RECORD;
  new_item_id INT;
  new_record_id INT;
  amount_val NUMERIC;
  paid_date DATE;
  item_name_val TEXT;
  notes_val TEXT;
  processed_count INT := 0;
  skipped_count INT := 0;
BEGIN
  FOR w IN
    SELECT iw.id, iw.parsed_amount, iw.parsed_amount_twd, iw.parsed_description,
           iw.parsed_paid_at, iw.parsed_payer_name, iw.parsed_order_id,
           iw.external_transaction_id, iw.source_id,
           s.default_project_id, s.source_key
    FROM income_webhooks iw
    JOIN income_sources s ON s.id = iw.source_id
    WHERE iw.status = 'pending'
      AND s.is_active = true
      AND s.default_project_id IS NOT NULL
      AND iw.parsed_amount IS NOT NULL
      AND iw.parsed_amount::numeric > 0
    ORDER BY iw.id
  LOOP
    amount_val := COALESCE(w.parsed_amount_twd::numeric, w.parsed_amount::numeric, 0);
    paid_date := COALESCE(w.parsed_paid_at::date, NOW()::date);
    item_name_val := COALESCE(NULLIF(w.parsed_description, ''), '進帳 ' || paid_date::text);
    notes_val := CONCAT_WS(' | ',
      CASE WHEN w.parsed_payer_name IS NOT NULL THEN '付款方：' || w.parsed_payer_name END,
      CASE WHEN w.parsed_order_id IS NOT NULL THEN '訂單號：' || w.parsed_order_id END,
      CASE WHEN w.external_transaction_id IS NOT NULL THEN '交易ID：' || w.external_transaction_id END
    );

    -- 建 payment_item
    INSERT INTO payment_items (
      item_name, total_amount, item_type, payment_type,
      project_id, start_date, status, paid_amount, source,
      tags, notes, created_at, updated_at
    ) VALUES (
      item_name_val,
      amount_val,
      'income', 'single',
      w.default_project_id,
      paid_date,
      'paid',
      amount_val,
      'webhook',
      'PM系統,' || w.source_key,
      '來源：' || w.source_key || ' (webhook id=' || w.id || ')',
      NOW(), NOW()
    ) RETURNING id INTO new_item_id;

    -- 建 payment_record
    INSERT INTO payment_records (
      payment_item_id, amount_paid, payment_date, payment_method,
      notes, is_partial_payment, created_at, updated_at
    ) VALUES (
      new_item_id, amount_val,
      paid_date,
      'webhook',
      NULLIF(notes_val, ''),
      false, NOW(), NOW()
    ) RETURNING id INTO new_record_id;

    -- 更新 webhook
    UPDATE income_webhooks SET
      status = 'confirmed',
      linked_item_id = new_item_id,
      linked_record_id = new_record_id,
      processed_at = NOW(),
      reviewed_at = NOW(),
      review_note = '系統批次自動確認（歷史 backfill）',
      updated_at = NOW()
    WHERE id = w.id;

    processed_count := processed_count + 1;
  END LOOP;

  -- 統計剩餘 pending（無 default_project_id 或無金額的）
  SELECT COUNT(*) INTO skipped_count
  FROM income_webhooks iw
  JOIN income_sources s ON s.id = iw.source_id
  WHERE iw.status = 'pending'
    AND (s.default_project_id IS NULL OR iw.parsed_amount IS NULL OR iw.parsed_amount::numeric <= 0);

  RAISE NOTICE '✓ 處理 % 筆 income_webhook → payment_item + payment_record', processed_count;
  RAISE NOTICE '✓ 跳過 % 筆（缺 default_project_id 或無金額）', skipped_count;
END $$;

-- 3. 重算 source totals（顯示用）
SELECT s.source_key, s.source_name,
       COUNT(w.id) FILTER (WHERE w.status = 'pending')  AS pending,
       COUNT(w.id) FILTER (WHERE w.status = 'confirmed') AS confirmed,
       COUNT(w.id) FILTER (WHERE w.status = 'rejected') AS rejected
FROM income_sources s
LEFT JOIN income_webhooks w ON w.source_id = s.id
GROUP BY s.id, s.source_key, s.source_name
ORDER BY s.id;

COMMIT;
