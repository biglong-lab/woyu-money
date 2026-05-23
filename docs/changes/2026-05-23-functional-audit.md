# 功能盤點與優化路線 — 2026-05-23

> **範圍**：全站功能現況清點 + 後續優化分階段建議
> **狀態**：審視中（推進中、每 2 分鐘一輪實作迭代）
> **目的**：對「家庭記帳」核心定位與「小孩模式延伸功能」做平衡
> **觸發**：使用者反映「請清點使用狀況 + 後續優化建議」

---

## 一、規模統計

| 項目 | 數量 | 備註 |
|------|------|------|
| 後端 API endpoints（全部） | ~600 | 分 30+ 個 routes |
| `family-kids` endpoints | **207** | 一個檔、佔全站 35% |
| `household` endpoints | 15 | 大人記帳核心 |
| `budget` endpoints | 13 | 預算管理 |
| `categories` endpoints | 33 | |
| 前端頁面 | 63 | |
| Schema 資料表 | 60 | |
| `family-kids` 整合測試 | 411 | 單檔測試覆蓋 |
| `client/src/pages/family.tsx` | **10,488 行 / 105 卡片** | 單檔過大 |
| `client/src/pages/family-kid.tsx` | 4,927 行 | |

---

## 二、各功能區塊狀態

### 🟢 高度發展（過度開發傾向）

**「家庭小孩模式」(family-kids)**

- 207 個 endpoint + 105 個家長頁卡片
- 涵蓋：任務派發、三罐分配、徽章、願望、目標、簽到、reflection、photo proof
- 30+ 種統計 endpoint：時序 / 排行 / 分布 / 即時 / 趨勢

**痛點**：
- 家長頁卡片資訊過載、105 個卡 scroll 不完
- 單檔 10K 行 → 編輯卡頓、merge conflict 風險
- 維護成本高

### 🟡 基礎完整、體驗待優化

**「大人家庭記帳」(household + budget + cost-overview)**

- ✅ 快速記帳 / 月度預算設定 / AI 拍照入帳（document-inbox）
- ✅ 載具條碼：document-inbox 流程
- ✅ 報表：cost-overview / financial-dashboard / financial-statements
- ✅ 預算超支警示卡（5/22 部署）

**痛點**：
- 動線多步、首頁無 1 秒記帳入口（FAB）
- 預算分配缺月初 onboarding 引導
- 超支警示只在 budget 頁、未推播

**「PM / PMS 整合」**

- ✅ 每日 captureFromPM（accumulated 快照）
- ✅ 每日 syncFromPMS（performance_entries）
- ✅ 每 6h syncPmRevenues（剛加 cron、5/22 部署）→ 進 `income_webhooks pending`
- ✅ Dashboard PM 待確認警示卡（5/22 部署）

**痛點**：
- 半自動：仍需人工去 `/income/inbox` 確認 372 筆 $773K
- `/income/inbox` 批次操作 UX 弱
- PMS 靠對方手動填、無法控制

### 🟠 基礎建立、待深化

| 區塊 | 現況 |
|------|------|
| 收入 / 整合 webhooks | inbox 頁存在、批次 UX 弱 |
| 通用 integration framework | v2.0 已建（5/16） |
| HR / Project / Rental | CRUD 完整、缺整合視圖 |
| 載具 / 統一發票 | 流程存在、缺自動兌獎 |

### 🔴 殘留問題

| 問題 | 影響 | 優先 |
|------|------|------|
| `pre-push` hook 跑 411 測試 ~20s、`kids_accounts/spendings` race 殘留每次需清表 | 每次推送 3-5 次 retry | 🔴 高 |
| `family.tsx` 10,488 行單檔 | 編輯卡頓、merge conflict | 🔴 高 |
| `log()` 是 no-op、生產無法觀察 cron | 故障難排查 | 🟠 中 |
| `payment_items` vs PM 累積差 $251K | 使用者疑惑 | 🟡 警示卡已加 |
| `family_pots` / `recipients` schema 未活化 | 資料未用滿 | 🟢 低 |

---

## 三、分階段優化路線

### 🚀 階段 1 — 修復痛點（1-2 週）

| 編號 | 任務 | 影響 |
|------|------|------|
| **1.1** | Pre-push hook 不再 race | 每次推送 1 次過 |
| **1.2** | `family.tsx` 拆檔（105 卡 → 6-8 sub-page） | 維護成本降低 |
| **1.3** | `/income/inbox` 一鍵批次確認 | 372 筆 < 30 秒處理 |
| **1.4** | `log()` 改可觀察（pino / audit_logs） | cron 故障排查 |

### 🔧 階段 2 — 大人記帳體驗（2-4 週）

| 編號 | 任務 | 影響 |
|------|------|------|
| **2.1** | 全站 FAB 一秒記帳 | 動線最短 |
| **2.2** | 載具條碼 OCR 自動分類 | 載具必要性 |
| **2.3** | 拍照記帳 1 秒（AI 自動填） | 提升使用意願 |
| **2.4** | 預算分配月初引導精靈 | 預算習慣 |
| **2.5** | 預算超支推播（PWA notification） | 即時控管 |
| **2.6** | 即時報表 widget（本月/上月 compare） | 即時參考 |

### 📊 階段 3 — 報表深度 + AI 助手（4-6 週）

| 編號 | 任務 |
|------|------|
| **3.1** | 月底自動結算 PDF / Markdown 月報 |
| **3.2** | 跨月趨勢 / 年度回顧 |
| **3.3** | AI 消費模式建議（Claude API） |
| **3.4** | 異常偵測（單筆 > 2σ、重複輸入） |

### 🏠 階段 4 — 家庭整合與多人協作（6-12 週）

| 編號 | 任務 |
|------|------|
| **4.1** | 多人帳號（父母 / 大小孩） |
| **4.2** | 家庭預算共決機制 |
| **4.3** | 跨領域整合視圖（PM/PMS + 家用 + 小孩） |
| **4.4** | 家庭共同存錢目標 |

### 🧹 階段 5 — 技術債清理（持續）

| 編號 | 任務 |
|------|------|
| **5.1** | family-kids 207 endpoint 精簡（合併 stats endpoint） |
| **5.2** | Schema 未使用表評估 / 歸檔 |
| **5.3** | cron 觀測（/api/admin/cron-health） |
| **5.4** | 文件補齊（API doc / ERD） |

---

## 四、優先順序

| 順位 | 項目 | 為什麼 |
|------|------|--------|
| **1** | 1.1 pre-push race fix | 每天 push 都被卡 |
| **2** | 2.1 一秒記帳 + 2.2 載具 + 2.3 拍照 | 「方便使用動線」核心訴求 |
| **3** | 1.3 inbox 一鍵批次 | 解決 372 筆積壓 |
| **4** | 2.4 預算分配月初引導 | 「事前分配預算」習慣建立 |
| **5** | 1.2 family.tsx 拆檔 | 維護瓶頸 |

---

## 五、推進方式

從 2026-05-23 起、透過 `/loop` 每 2 分鐘推進一個 step、完成即 commit + push + SSH deploy。

每完成一個小階段、更新本檔的「進度章節」、紀錄 commit hash。

---

## 六、推進進度

（下方依時序追加）

- `2026-05-23` 初版 audit 寫入、推進啟動（commit `c67c7aa`）
- `2026-05-23` **階段 1.1** ✅ pre-push hook 跑測試前 `TRUNCATE kids_accounts RESTART IDENTITY CASCADE`、411/411 一次過 5.14 秒、不再 retry（commit `5048ccc`）
- `2026-05-23` **階段 1.2a** family.tsx 起步拆檔：建 `components/family/social-cards.tsx`、抽出 `FamilyTopTaskEmojisCard`（commit `183eb6e`）
- `2026-05-23` **階段 1.2b** 批量抽 4 個 social cards（KindnessMilestone/KindnessStory/TopRecipients/CommentInteraction）；family.tsx 10,488 → 10,225 行（-263）（commit `f45e167`）
- `2026-05-23` **階段 1.2c** 抽 today 主題 3 cards（TodayCheckinRoster / TodaySpendingFeed / TodayTasksList）到 `today-cards.tsx`；family.tsx 10,225 → 10,059（-166）（commit `30e973f`）
- `2026-05-23` **階段 1.2d** 抽 stats 趨勢類 4 cards（ApprovalLeadTime / MonthlyTaskCreationTrend / MonthlySpendingTrend / MonthlyGoalsTrend）到 `stats-cards.tsx`；family.tsx 10,059 → 9,726（-333）（commit `2abcadd`）
- `2026-05-23` **階段 1.2e** 抽排行 / bucket 4 cards（StreakRanking / BiggestSpendings / BiggestWins / WishesAging）到 `ranking-cards.tsx`；family.tsx 9,726 → 9,515（-211）（commit `b4efbee`）
- `2026-05-23` **階段 1.3** /income/inbox 加「⚡ 一鍵確認 PM 全部」按鈕 + 後端 `POST /api/income/webhooks/auto-confirm-by-source` endpoint、用 source.defaultProjectId 自動 confirm 全部 pending（解決 372 筆 $773K 積壓的核心入口）（commit `a8116b5`）
- `2026-05-23` **階段 1.4** log 改可觀察：新增 `server/storage/tick-log.ts` in-memory ring buffer（max 100）+ scheduler 各 tick 結果記錄（forecast-snapshot / pms-sync / pm-revenue-sync）+ `GET /api/admin/cron-tick-logs` endpoint；用 `process.stdout.write` 進 docker logs 方便外部觀察（commit `bea048b`）
- `2026-05-23` **階段 2.1** FAB 加「🏠 家用記帳」action（deeplink `/household-budget?quickAdd=1`）+ 頁面響應 query 自動開 quick-add dialog；FAB 桌面 + 手機都顯示（移除 hidden md:block、手機 bottom-20 避開 TabBar）（commit `20d95cc`）
- `2026-05-23` **階段 2.2** quick-add dialog「拍照存證」placeholder 換真的 `ReceiptUploadButton`、提交時 receiptImages array 帶到 `/api/household/expenses`（後端已支援 `receipt_images` jsonb）（commit `802866c`）
- `2026-05-23` **階段 2.3** 拍照 → AI 自動填表：新增 `POST /api/household/recognize-receipt`（從 /uploads/ URL 讀檔 + recognizeDocument 跑 Gemini 辨識）+ quick-add UI「✨ AI 自動填金額/品項/日期」按鈕、自動 setValue 金額/日期/備註/分類（模糊匹配 householdCategories）（commit `868b0e4`）
- `2026-05-23` **階段 2.4** 月初預算建議 widget：`BudgetSuggestionCard` 顯示上月實際花費 vs 本月建議（×1.05 緩衝）+ 目前設定 3 column 對照、超支時橘色警示、一鍵套用建議到 setBudgetMutation（commit `d76bbae`）
- `2026-05-23` **階段 2.5** 超支瀏覽器通知：`BudgetOverrunNotifier` 注入 App layout、每 5 分鐘輪詢 `/api/budget/overrun-alerts`、用 localStorage 比對 severity 升級才觸發 Notification API（無需 VAPID / web-push、零部署風險）
