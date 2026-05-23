## 家用記帳超級好用化 — 2026-05-23

> 範圍：把 `/household-budget` 從「能用」打造成「市面記帳工具等級的好用」
> 觸發：使用者反映「請繼續強化家用記帳、參考市面工具、讓紀錄/畫面/分類/紀錄都很便利」
> 完成標準：每個強化獨立 commit、SSH 部署上線、UX 流程順暢

---

## 一、背景

5/23 早上完成全 5 階段 functional audit 路線收尾後，使用者進一步反映幾個 UX 痛點：

1. 手機底部選單固定「+記帳」按鈕不靈活、應依當前頁面切換場景
2. quick-add dialog 跳出後動線會卡、找不到關閉按鈕、不知道分類在哪設定
3. 記帳體驗距離市面記帳工具（Money Manager / AndMoney / 記帳城市）還有距離

於是進行 13 個強化迭代、全部上線。

---

## 二、強化功能列表（按提交順序）

| # | 主題 | Commit | 重點 |
|---|------|--------|------|
| 0 | Tab Bar context-aware | `1ee8034` | 依 URL 自動切換 5 入口、移除手動 mode chip |
| 1 | Dialog 動線修復 + 分類入口 | `c3a17f4` | sticky footer + 3 明確按鈕 + ⚙️ 分類管理 |
| 2 | 智能備註→分類學習 | `65339f0` | 過去 90 天 description→categoryId 加權建議 |
| 3 | 語音輸入記帳 | `f6e8fcb` | Web Speech API、「150 元 早餐」自動解析 |
| 4 | 固定支出範本 | `dc1fc66` | household_expense_templates 表、一鍵套用 |
| 5 | 進階搜尋 / 篩選 / 排序 | `32c0000` | search/categoryIds/min-max/date/sort |
| 6 | 手勢操作（左右滑） | `950d9bb` | PointerEvent 包裝、左滑刪 / 右滑複製 |
| 7 | 首頁家用快照卡 | `dd380c2` | 進首頁就看花費 + 7 天 bar |
| 8 | 收入記錄 + 收/支切換 | `8258ed4` | household_incomes + 6 收入分類 chips |
| 9 | 收支結餘卡 + 首頁 KPI | `5e9a66a` | 收/支/結餘 3 KPI + 收入分類橫條 |
| 10 | CSV 匯出（UTF-8 BOM）| `bf553c6` | 支出/收入/全部 3 選項、Excel 直開 |
| 11 | 連續記帳 streak 🔥 | `7fdac88` | UNION expense+income、5 種狀態 chip |
| 12 | 每日 21:00 未記帳提醒 | `a6379b6` | Notification API + localStorage 去重 |

**先前已完成（5/23 上午 Phase 1-5）**：
| Phase | 主題 | Commit |
|-------|------|--------|
| 1 | Tab Bar 模式切換（已被 #0 取代）| `0375696` |
| 2 | 大鍵盤 + 計算機 | `7276ae3` |
| 3 | 常用分類 + +1 同上 | `e54a4e6` |
| 4 | 今日/週/月 即時清單 | `6c5106f` |
| 5 | 分類視覺化（emoji + 色）| `ccc28e8` |

---

## 三、新增的 schema 表

| 表 | 用途 | commit |
|------|------|--------|
| `household_expense_templates` | 固定支出範本（房租 / 水電 / 訂閱）| `dc1fc66` |
| `household_incomes` | 家用收入紀錄（薪資 / 獎金 / 投資）| `8258ed4` |

兩個都遵守 schema ADD only、有對應生產 schema SQL 透過 SSH 套用、不影響既有資料。

---

## 四、新增 / 修改的 API endpoints

### 新增
- `GET /api/household/snapshot` — 首頁一次取所有 KPI（今日/本月/收入/結餘/7 天 bar）
- `GET /api/household/period-summary?period=today|week|month` — 即時清單
- `GET /api/household/expenses/search` — 進階搜尋 / 篩選
- `GET /api/household/suggest-category?description=` — 智能分類建議
- `GET /api/household/top-categories?limit=6&days=30` — 常用分類
- `GET /api/household/streak` — 連續記帳天數
- `GET /api/household/export?type=expenses|incomes|all&month=` — CSV 匯出
- `GET /api/household/incomes?month=` + POST + DELETE + `/summary` — 收入 CRUD
- `GET /api/household/templates` + POST + PUT + DELETE — 範本 CRUD
- `POST /api/household/recognize-receipt` — AI 收據辨識
- `GET /api/household/monthly-report?month=` — markdown 月報
- `GET /api/household/yearly-overview?endMonth=` — 過去 12 月
- `GET /api/household/ai-insights?month=` — 純規則洞察
- `GET /api/household/anomalies?month=` — 異常偵測
- `DELETE /api/household/expenses/:id` — alias、給 inline 刪除

### 強化
- `POST /api/household/budget` — 加 change log（household_budget_changes）+ reason 欄位

---

## 五、新增 / 修改的前端元件

### 元件（`client/src/components/household/*`）
- `period-feed-card.tsx` — 今天/週/月 切換清單（含 swipe）
- `expense-templates-card.tsx` — 固定支出範本格狀
- `expense-search-card.tsx` — 進階搜尋面板（摺疊）
- `swipeable-expense-row.tsx` — 左右滑手勢 wrapper
- `household-quick-snapshot-card.tsx` — 首頁快照
- `income-expense-balance-card.tsx` — 收支結餘
- `export-csv-dropdown.tsx` — CSV 匯出 dropdown
- `streak-chip.tsx` — 連續記帳 chip
- `daily-reminder-notifier.tsx` — 21:00 提醒（無 UI、Notification API）

### Hooks
- `use-voice-input.ts` — Web Speech API 包裝
- `use-page-context.ts` — 依 URL 推斷 context（6 種）

### Lib
- `category-emoji.ts` — 分類名稱 → emoji + 顏色（50+ 常見分類）

### 共用 UI
- `amount-keypad.tsx` — 計算機鍵盤元件

---

## 六、典型使用流程 demo

### 手機快速記帳（3 秒一筆）
1. 進 `/household-budget` 或從首頁點「+ 記一筆」chip → tab bar 自動切「💰 家用記帳」場景
2. quick-add dialog 跳出（含大鍵盤、預設手機開）
3. 點數字輸入金額（或按 🎤 說「150 元 早餐」）
4. 從 6 個常用分類 emoji chips 一鍵選
5. 按底部「記錄」或「記、繼續」
6. 完成 → toast 提示 + 首頁 streak 🔥+1

### 月底結算與匯出
1. 進 `/household-budget` → 看收支結餘卡（收入/支出/結餘 KPI + 收入分類橫條）
2. 看年度回顧（過去 12 月 bar + 累計）+ AI 觀察 + 異常偵測
3. 點「📄 匯出月報」→ markdown 檔
4. 點「📤 匯出 CSV」→ 選支出/收入/全部 → Excel 直開（UTF-8 BOM）

### 跨域協作（家庭多人）
1. 進 `/family` → tab bar 切「👨‍👩‍👧 家庭」場景
2. 跨領域整合視圖：家用支出 / 小孩任務 / PM 收入 / PMS 收入 / 待批准
3. 共同存錢目標 / 預算變更歷程 / 邀請成員（5/23 上午完成）

---

## 七、設計決策關鍵點

### 1. Tab Bar 從手動 mode chip 改 context-aware

**原本**：tab bar 上方放「💰 家用 ⇄ 🏨 民宿」chip 手動切換
**問題**：使用者進不同頁、tab bar 不會自動跟著變
**改動**：移除手動切換、改 `usePageContext()` 依 URL 自動推斷 6 種 context
**好處**：零學習成本、URL 主導 UI

### 2. 連續模式 toggle → 3 明確按鈕

**原本**：dialog 內有「🔁 連續模式」checkbox、勾選後 submit 不關 dialog
**問題**：使用者勾錯後不知道如何關閉、動線卡住
**改動**：移除 checkbox、改 sticky footer 3 個明確按鈕：「取消」「記、繼續」「記錄」
**好處**：操作意圖明確、不靠記憶狀態

### 3. Voice + AI 分類連動

**原本**：語音輸入後只填金額
**改動**：語音解析後寫入 description → 觸發智能分類建議 query → 跳分類 chips 一鍵套
**好處**：說話即記帳、不用手動選

### 4. 收入分類用 varchar 而非 FK

**考量**：收入分類就 6 種（薪資 / 獎金 / 投資 / 副業 / 退款 / 其他）、固定常數
**選擇**：用 varchar(50)、不建獨立 categories 表
**好處**：少一張表、UI 也容易（純前端 emoji 映射）

### 5. Streak UNION expense + income

**問題**：streak 應該算「有記帳」、不分支出收入
**做法**：SQL UNION 兩表 distinct date、再算連續天數
**容忍**：今天還沒記、用昨天作起點 → current 還是顯示（鼓勵使用者今天補記）

---

## 八、技術債 / 後續優化

- 大鍵盤 keypad 還可加「最近金額」memory（如 100 / 150 / 200 快速按鈕）
- 智能分類學習目前用 LOWER LIKE、可升級為 fuzzy matching（pg_trgm）
- 範本沒有「依 day_of_month 自動提醒」cron、僅是欄位
- streak 演算法跑全表 distinct date、大量資料時可改物化視圖
- 每日提醒目前只在 21:00 後 + 開頁時觸發；改 SW push 可背景觸發

---

## 九、commit 全列表

```
1ee8034 refactor(mobile): tab bar 改 context-aware 依當前頁面動態切換
c3a17f4 fix(household): quick-add dialog 動線卡住修復 + 分類管理入口
65339f0 feat(household): 智能備註→分類學習建議
f6e8fcb feat(household): 語音輸入記帳
dc1fc66 feat(household): 固定支出範本（一鍵記錄）
32c0000 feat(household): 進階搜尋 / 篩選 / 排序
950d9bb feat(household): 手勢操作（左滑刪除、右滑複製）
dd380c2 feat(home): 首頁加家用記帳快照卡（HouseholdQuickSnapshotCard）
8258ed4 feat(household): 家用收入記錄（支出 / 收入切換 tab）
5e9a66a feat(household): 收支結餘卡 + 首頁快照結餘 KPI
bf553c6 feat(household): CSV 匯出（支出 / 收入 / 全部）
7fdac88 feat(household): 連續記帳天數 streak 🔥
a6379b6 feat(household): 每日 21:00 未記帳提醒
```

---

## 十、影響統計

- 13 個強化 commit + 1 個 dialog 修復 + 5 個 phase（先前）= 19 次迭代
- 新增 schema 表：2 張（templates / incomes）
- 新增 endpoints：15+ 個
- 新增 frontend 元件：9 個
- 新增 hooks：2 個
- 新增 lib：1 個
- 全程 SSH 手動部署、生產零事故
- 本 doc 是收尾紀錄、不需 deploy
