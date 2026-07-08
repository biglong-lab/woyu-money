# 巨檔拆分 + 技術債清理（階段 3+4）— 2026-07-08

> 範圍：前端兩大巨檔模組化 + ManagementTab Dialog + search_path 常數化
> 狀態：已完成、待部署
> 前情：階段 1/2 見 [2026-07-08-unified-cashflow.md](2026-07-08-unified-cashflow.md)、
> [2026-07-08-ui-consolidation.md](2026-07-08-ui-consolidation.md)

## 巨檔拆分（行為不變、參考 hr-cost-management/ 拆法）

### family.tsx：1,335 行 → `family/` 目錄 12 檔（最大 284 行）
index 協調器 238 行 + hooks.ts（8 mutations 集中）+ 統計牆/洞察牆/待審任務/
排行榜/Timeline 等子元件。行為保真：146 種 JSX 元件使用集合與原檔逐一比對一致。

### household-budget.tsx：1,309 行 → `household-budget/` 目錄 12 檔（最大 386 行）
index 協調器 279 行 + 三個自訂 hooks（queries/mutations/quick-add-form）+
快速記帳 Dialog/預算卡/分類佔比/最近記錄等子元件。

兩者 `App.tsx` lazy import 路徑不變（目錄 index 自動解析）、URL 不變。

## 技術債清理

- **`shared/pm-schema-config.ts` 新常數檔**：`t_wodao` search_path 原硬編 4 檔
  （pm-bridge storage/routes、pms-bridge、forecast-snapshots）→ 單一真實來源，
  PM 再遷 schema 只改一處（仿 pm-excluded-companies 模式）
- **ManagementTab 付款資訊改 Dialog**：原 `alert()`（全站最後一個實質 TODO），
  改正式 Dialog 逐欄呈現、空狀態有指引
- **`installment_plans` 殘留表評估**：僅 `server/storage/rental.ts` 內部
  insert/select 使用（rental 產生付款時的內部週轉）、無專屬 route 無前端出口。
  結論：**保留不動** — 有活躍寫入路徑非死碼；若未來 rental 改版再併入 payment_schedules

## 驗證

- tsc 乾淨、eslint 0 error 0 warning（新目錄）
- 全套 2391/2391 通過
- 巨檔現況：>800 行前端頁面從 14 檔降到 12 檔（拆掉最大兩檔）；
  其餘（financial-dashboard 1251、income-webhooks-inbox 1092、integrations-center 1088、
  scenario-simulator 1081、revenue-forecast 1076、budget-estimates 1026、
  expense-webhooks-inbox 1025 等）留待後續批次

## 相關文件

- CHANGELOG 1.4.2
- 全域規範：檔案 ≤800 行（~/.claude/rules/performance.md）
