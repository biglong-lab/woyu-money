-- 2026-06-14：信用卡請款閉環 — 銀行手續費率 + 到帳紀錄
-- 安全：ADD COLUMN IF NOT EXISTS（只加不刪）

ALTER TABLE card_claim_banks ADD COLUMN IF NOT EXISTS fee_rate DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE card_claims ADD COLUMN IF NOT EXISTS settled_amount DECIMAL(12,2);
ALTER TABLE card_claims ADD COLUMN IF NOT EXISTS settled_date DATE;
