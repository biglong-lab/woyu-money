-- 補既有由 PM 推送並已 confirmed 的 payment_items + payment_records
--
-- 對應改動：confirmExpenseWebhook 開始寫入 source='pm' / tags='PM系統,sourceKey' / notes 含照片連結 / receipt_image_url
-- 此腳本回填先前用舊邏輯（source='webhook'、無 tags、無照片連結）建立的 89 筆

BEGIN;

-- 1) payment_items: 更新 source / tags / notes
UPDATE payment_items pi
SET
  source = 'pm',
  tags = CASE
    WHEN pi.tags IS NULL OR pi.tags = '' THEN 'PM系統,' || es.source_key
    ELSE pi.tags || ',PM系統,' || es.source_key
  END,
  notes = pi.notes
    || CASE
         WHEN w.raw_payload->>'pmInvoicePhoto' IS NOT NULL
              AND (pi.notes IS NULL OR pi.notes NOT LIKE '%pmInvoicePhoto%')
              AND (pi.notes IS NULL OR pi.notes NOT LIKE '%📷 PM 帳單照片%')
         THEN E'\n📷 PM 帳單照片：' || (w.raw_payload->>'pmInvoicePhoto')
         ELSE ''
       END
FROM expense_webhooks w
JOIN expense_sources es ON es.id = w.source_id
WHERE w.linked_item_id = pi.id
  AND pi.source = 'webhook';

-- 2) payment_records: 補 receipt_image_url（asPaid 已建 record 的）
UPDATE payment_records pr
SET receipt_image_url = w.raw_payload->>'pmInvoicePhoto'
FROM expense_webhooks w
WHERE w.linked_record_id = pr.id
  AND pr.receipt_image_url IS NULL
  AND w.raw_payload->>'pmInvoicePhoto' IS NOT NULL;

-- 列影響後狀態
SELECT 'payment_items source=pm 合計' AS metric, COUNT(*)::text AS value FROM payment_items WHERE source = 'pm';
SELECT 'payment_records 含照片合計' AS metric, COUNT(*)::text AS value FROM payment_records WHERE receipt_image_url LIKE 'https://photo.homi.cc%';

COMMIT;
