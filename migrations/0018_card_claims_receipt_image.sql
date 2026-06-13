-- 2026-06-13：信用卡請款紀錄新增收據圖片欄位
-- 安全：ADD COLUMN IF NOT EXISTS（只加不刪）

ALTER TABLE card_claims ADD COLUMN IF NOT EXISTS receipt_image_url VARCHAR(500);
