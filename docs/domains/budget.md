# 預算領域

> 月度預算規劃 + 變異分析 — 商用版（家用版在 [household.md](household.md)）
> 主要 UI：`/budget-estimates`（月度預估）、`/variance-report`（差異對賬）

## 主要表

| 表 | 用途 |
|----|------|
| `budget_items` | 預算項目（attribution: property/company/shared） |
| `budget_item_allocations` | 共用攤提：1 個 item 分攤到 N 個 project |
| `budget_attribution` | 歸屬規則（property_groups 對應） |
| `property_groups` | 館別分組（用於攤提） |

## 三種 attribution

- **property**：直接歸某館（如某館的房屋稅）
- **company**：公司級成本（如總公司辦公室租金、不分到各館）
- **shared**：跨館共用（如共用網路費、按比例攤）

## 主要 endpoint

- `GET /api/budget-estimates?year=Y&month=M` — 自動產生月度預估
  - 邏輯：合約 + 過去 6 月平均
- `GET /api/variance-report?year=Y&month=M` — 預估 vs 實際差異
  - 含「漏記提醒」（過去常發生、本月沒記）+ 「系統洞察」

## 攤提計算

- 共用 budget_item × N 個 project（依 property_groups）
- 攤提比例存 `budget_item_allocations.allocation_percent`
- 損益報表（property-pl）會把直接 + 攤提合計

## 相關文件

- ADR：0008 property groups + budget attribution
- changes：2026-04-24 財務助理整合
