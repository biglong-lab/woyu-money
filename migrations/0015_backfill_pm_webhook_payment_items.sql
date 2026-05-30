-- 2026-05-30 backfill PM webhook 缺漏的 payment_items + payment_records
-- bug：PM bridge 直接 INSERT income_webhooks、跳過 _createPaymentFromWebhook
-- 結果 payment_items income 漏 ~$1M/月（5/17 起斷）

BEGIN;

-- Step 1：每筆缺漏的 webhook 建 1 個 payment_item、notes 寫 webhook_id 作 unique tag
INSERT INTO payment_items (
  item_name, total_amount, item_type, payment_type, project_id, start_date,
  status, paid_amount, source, notes, created_at, updated_at
)
SELECT
  COALESCE(NULLIF(iw.parsed_description, ''), '進帳 ' || iw.parsed_paid_at::date::text),
  iw.parsed_amount_twd,
  'income',
  'single',
  m.project_id,
  iw.parsed_paid_at::date,
  'paid',
  iw.parsed_amount_twd,
  'webhook',
  '__pm_backfill__:webhook_id=' || iw.id,
  NOW(), NOW()
FROM income_webhooks iw
JOIN income_sources s ON s.id = iw.source_id
JOIN pm_company_mapping m ON m.company_id = (iw.raw_payload->>'company_id')::int
JOIN payment_projects pp ON pp.id = m.project_id  -- 確保 FK 對得上
WHERE s.source_key = 'pm-bridge'
  AND iw.status = 'confirmed'
  AND iw.parsed_amount_twd IS NOT NULL
  AND iw.parsed_paid_at IS NOT NULL
  -- 還沒對應的 payment_records（注意 external_transaction_id 是唯一）
  AND NOT EXISTS (
    SELECT 1 FROM payment_records pr
    WHERE pr.notes LIKE '%交易ID：' || iw.external_transaction_id || '%'
  );

-- Step 2：為剛建的 payment_items 補 payment_records
INSERT INTO payment_records (
  payment_item_id, amount_paid, payment_date, payment_method, notes,
  is_partial_payment, created_at, updated_at
)
SELECT
  pi.id,
  iw.parsed_amount_twd,
  iw.parsed_paid_at::date,
  'webhook',
  COALESCE(
    NULLIF(
      concat_ws(' | ',
        CASE WHEN iw.parsed_payer_name IS NOT NULL THEN '付款方：' || iw.parsed_payer_name END,
        CASE WHEN iw.parsed_order_id IS NOT NULL THEN '訂單號：' || iw.parsed_order_id END,
        '交易ID：' || iw.external_transaction_id
      ),
      ''
    ),
    NULL
  ),
  false, NOW(), NOW()
FROM payment_items pi
JOIN income_webhooks iw
  ON pi.notes = '__pm_backfill__:webhook_id=' || iw.id
WHERE pi.source = 'webhook' AND pi.item_type = 'income';

-- Step 3：清除 tag、避免 notes 殘留 backfill 標記
UPDATE payment_items
SET notes = NULL, updated_at = NOW()
WHERE notes LIKE '__pm_backfill__:webhook_id=%';

COMMIT;
