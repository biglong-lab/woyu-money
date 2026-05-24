# ERD Overview — 跨領域 FK 關鍵關係

> 不畫全表、只標跨領域的關鍵連結
> 細節去各 domain 檔看

## 核心枝幹

```
payment_projects (5 館 + 1 公司級)
   ↑ project_id
   │
   ├── payment_items (規劃 5 種類型) ─────┬─── payment_records (實付)
   │      ↑ item_type ∈ (monthly,        │
   │        installment, general,        │
   │        rental, loan, hr, income)    │
   │                                     │
   ├── budget_items (預算規劃)            │
   │      ↓ budget_item_id               │
   │      budget_item_allocations (攤提) │
   │                                     │
   └── property_groups (館分組、用於攤提)  │
                                         │
   pm_company_mapping ─┘                 │
   (project ↔ PM company_id)             │
        ↑                                │
        │                                │
   income_webhooks (PM/PMS 推送) ────────┘
        ↑
   income_sources
```

## 家用 vs 商用：兩條獨立支線

```
household_budgets ─── household_expenses
   (is_total_budget=true 是「總預算」)
   ↑
household_categories (跟商用 debt_categories 合併、見 0010)

vs.

payment_items + payment_records  ← 商用主線
```

## 親子（family-kids）：獨立子系統

```
kids_accounts (PIN 登入小孩)
   ↓
kids_tasks ── kids_task_completions ── kids_allowance_records
                                         ↓
                                    family_pot_contributions (三罐)
```

## 整合 / Webhook：橫切多領域

```
integration_events (通用 log)
   ↓
income_sources / income_webhooks  → 進 payment_items (item_type=income)
expense_sources / expense_webhooks → 進 payment_items (item_type=general)
```

## 預測 / Snapshot

```
revenue_forecast_snapshots (PM + PMS 都進這)
   ↑ source ∈ ('pm-bridge', 'pms-bridge')
   ↑ company_id (PM) ↔ project_id 透過 pm_company_mapping
```

## 軟刪除分布

| 表 | is_deleted |
|----|-----------|
| `payment_items` | ✅ |
| `household_expenses` | ✅（2026-05-24 加） |
| 其他 | 大多硬刪 |

## audit 待解（不在本文範圍、留念）

- `payment_items` item_type 6 種 → 是否 over-loaded?
- `categories` 系列三表合併（0010）後仍存 legacy column
- family-kids 9500 行單檔
