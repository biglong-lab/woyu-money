-- 浯島財務管理系統 資料庫備份
-- 匯出日期: 2026-02-03
-- 注意: 請先建立資料庫結構 (npm run db:push)，再匯入此資料

-- 清空並重設序列
TRUNCATE TABLE users, payment_projects, fixed_categories, debt_categories, payment_items, payment_records, document_inbox CASCADE;

