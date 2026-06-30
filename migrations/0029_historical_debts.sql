-- 2026-06-30：歷史欠款整理（獨立模組）
-- 用途：把過去散落、急迫才處理的欠款先「登打進來看全貌」，再做分期還款與歸帳
-- 安全：全部 CREATE TABLE IF NOT EXISTS + INSERT ON CONFLICT DO NOTHING（只加不刪）
-- 注意：表名用 legacy_debt_* 前綴，避免與既有核心表 debt_categories（科目主表）撞名

BEGIN;

-- 欠款分類（可自訂，如 借款 / 貨款 / 稅款 / 勞健保）
CREATE TABLE IF NOT EXISTS legacy_debt_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 歷史欠款主表
CREATE TABLE IF NOT EXISTS legacy_debts (
  id SERIAL PRIMARY KEY,
  -- 欠款總額
  amount DECIMAL(12,2) NOT NULL,
  -- 分類（選填，關聯 legacy_debt_categories）
  category_id INTEGER REFERENCES legacy_debt_categories(id),
  -- 債權人 / 對象（欠誰的）
  creditor VARCHAR(100),
  -- 發生日期（選填）
  incur_date DATE,
  -- 期限 / 到期日（選填）
  due_date DATE,
  -- 生命週期狀態：open 處理中 / reconciled 已歸帳 / cancelled 作廢
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  -- 歸帳科目（選填，獨立標記用）
  account_code VARCHAR(50),
  -- 歸帳時間
  reconciled_at TIMESTAMP,
  -- 備註
  note TEXT,
  -- 單據圖片（本地 /uploads/... 路徑）
  receipt_image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS legacy_debts_category_idx ON legacy_debts(category_id);
CREATE INDEX IF NOT EXISTS legacy_debts_status_idx ON legacy_debts(status);
CREATE INDEX IF NOT EXISTS legacy_debts_due_date_idx ON legacy_debts(due_date);

-- 分期 / 還款紀錄（一筆欠款可多次還款）
CREATE TABLE IF NOT EXISTS legacy_debt_payments (
  id SERIAL PRIMARY KEY,
  debt_id INTEGER NOT NULL REFERENCES legacy_debts(id) ON DELETE CASCADE,
  -- 本次還款金額
  amount DECIMAL(12,2) NOT NULL,
  -- 還款日期
  pay_date DATE NOT NULL,
  -- 付款方式（現金 / 轉帳 / 信用卡…）
  method VARCHAR(50),
  -- 備註
  note TEXT,
  -- 收據圖片
  receipt_image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS legacy_debt_payments_debt_idx ON legacy_debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS legacy_debt_payments_pay_date_idx ON legacy_debt_payments(pay_date);

-- 預設分類（民宿營運常見歷史欠款類型）
INSERT INTO legacy_debt_categories (name, sort_order) VALUES
  ('借款', 1),
  ('貨款', 2),
  ('稅款', 3),
  ('勞健保', 4),
  ('信用卡', 5),
  ('租金', 6),
  ('員工薪資', 7),
  ('其他', 8)
ON CONFLICT (name) DO NOTHING;

COMMIT;
