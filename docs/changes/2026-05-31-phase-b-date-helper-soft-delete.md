# Phase B：台北日期 helper + payment_records 軟刪 — 2026-05-31

> 範圍：server 21 處跨日 bug 修 + payment_records schema 加 is_deleted
> 狀態：已上線
> Audit：P0 正確性（B1 + B2）

## B1：台北日期 helper 全面替換

**問題**：21 處 `new Date().toISOString().slice(0, 10)` 在 TPE 00:00-07:59 會返回前一天日期（dashboard、forecast、家庭任務、薪資 etc 全受影響）。

**修法**：用既有的 `shared/date-utils.ts` 的 `localDateTPE()`。

**受影響檔案**（21 處 `new Date()` 直接呼叫已修）：
- `server/routes/dashboard.ts` — YTD 收支正確切日
- `server/routes/family-kids.ts` — 16 處（簽到、零用金、任務截止）
- `server/routes/household.ts`、`cost-structure.ts`
- `server/storage/expense-webhooks.ts`、`recurring-expense-templates.ts`

**未動部分**：其他 `someDate.toISOString().slice(0,10)`（拿傳入 Date、不一定是「今天」）保留、可後續單獨處理。

## B2：payment_records 軟刪除

**問題**：`deletePaymentRecord()` 直接 `db.delete()`、刪了無法追、財務 audit trail 斷。

**修法**：
- schema 加 `isDeleted` + `deletedAt` + `deletedByUserId`
- `deletePaymentRecord(id, userId?)` 改 UPDATE
- migration 0016：ADD COLUMN + partial index

**已知限制**（task #338）：
- 20 個 SELECT 點還沒補 `AND NOT is_deleted` filter
- 已刪 record 暫時仍會出現在報表
- 後續單獨處理、不擴散本次

## 相關文件

- [Phase A：個資外洩 + 密碼注入 + 備份](2026-05-31-secrets-and-backup-hardening.md)
- [migration 0016](../../migrations/0016_payment_records_soft_delete.sql)
