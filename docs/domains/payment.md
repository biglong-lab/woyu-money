# 付款領域

> 整個系統最核心、最大宗的領域 — 所有「要付的錢」都進這
> 主要負責人：付款管理 / 統一查看 / 財務助理 / 報表幾乎都讀這

## 領域定位

「規劃要付的錢 → 真的付了 → 對賬」三段流程。

## 主要表

| 表 | 用途 | 關鍵欄位 |
|----|------|---------|
| `payment_items` | 「要付的單筆／規劃項」 | project_id, item_type(monthly/installment/general/rental/loan/hr/income), total_amount, start_date, is_deleted |
| `payment_records` | 「實際付了 / 收了多少」 | payment_item_id, amount_paid, paid_at, payment_method |
| `payment_categories` / `debt_categories` | 分類樹（家用 + 商用合併、見 0010 migration） | category_name, parent_id, scope |
| `payment_projects` | 館別 / 公司級「專案」 | name, is_active |

## 主要 endpoint（部分）

- `GET /api/payment-items?type=...` — 列規劃項
- `POST /api/payment-records` — 寫一筆實付
- `GET /api/payment-analysis/monthly` — 月度分析
- `GET /api/reports/property-pl?year=Y&month=M` — 館別損益

## 跨領域 FK

- `payment_items.project_id → payment_projects.id`
- `payment_records.payment_item_id → payment_items.id`
- `payment_items.category_id → payment_categories.id` 或 `debt_categories.id`（依 scope）
- 收入：`item_type='income'` + `source='webhook'` 的 payment_items 從 income_webhooks 同步而來

## 重要設計決定

- `is_deleted` soft delete（不直接 DELETE、保 audit）
- payment_items 5 種 item_type 各對應不同 management 頁面
- income 跟 expense 共用一張表（item_type 區分）— 簡化 query

## 相關文件

- ADR：暫無
- changes：歷年新增的 item_type / category 整併
