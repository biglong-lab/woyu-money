-- 2026-05-31 audit P0：payment_records 軟刪除
-- 保財務 audit trail、避免 DELETE 後完全無法追蹤

BEGIN;

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id INTEGER;

CREATE INDEX IF NOT EXISTS payment_records_is_deleted_idx
  ON payment_records(is_deleted) WHERE is_deleted = FALSE;

COMMIT;
