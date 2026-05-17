# 營運預測引擎 — 2026-05-18

> 範圍：從「會計記錄工具」升級為「未來預測 + 沙盤推演」工具
> 狀態：✅ 5 階段全部完成
> 部署：commit `4f64f71` → `6a6977c` → `cc3a248` → `c0b168f` → `9915e77` → `0a259bf`

## 背景

使用者反饋會計工具只能看「過去事實」，希望系統能：
- 預測未來收入（提前 60 天知道資金狀況）
- 沙盤推演（行銷預算 +X% → 收入 +Y%）
- 把記錄變決策工具

5 個階段一次推完。

---

## Phase 0 — 週期性支出可設定

**問題**：原 scheduler 邏輯硬編寫於程式碼、使用者沒法改金額/暫停。

**解法**：
- 新表 `recurring_expense_templates`（金額、發生日、生效月份、可暫停）
- 新頁 `/recurring-expenses` UI 管理（commit `6a6977c`）
- Scheduler 改用 templates 表
- 「立即產出當月」+「全部批次」按鈕（不必等 1 號）

## Phase 1a-b — 預測快照表 + 每日累積

**新表** `revenue_forecast_snapshots`：每日對「本月/下月/下下月」拍 snapshot。

**Backfill**：從 PM `daily_revenue_snapshots` 算出歷史每日累積、3 月 + 4 月 + 5 月共 318 筆。

**API**：
- `GET /api/forecast/trend?targetMonth=` — 該月走勢
- `GET /api/forecast/simple?targetMonth=` — 線性推估
- `POST /api/forecast/capture` — 立即拍

**Scheduler**：每日台北 23:00 自動拍快照。

## Phase 2 — 季節性預測模型

**公式**：
```
predictedFinal = currentAccumulated / avgRatio(history)
  ratio = 同 day 累積 / 該月最終 ∈ [0, 1]
```

**信心區間**（基於歷史 ratio 標準差）：
- 95% CI: `currentAcc / [avgRatio ± 1.96σ]`
- 80% CI: `currentAcc / [avgRatio ± 1.28σ]`

**信心等級**：
- high (sample ≥ 6 且 std < 0.05)
- medium (sample ≥ 4 且 std < 0.10)
- low (sample ≥ 2)
- insufficient (退化為線性推估)

**API**：`GET /api/forecast/seasonal?targetMonth=`

## Phase 3 — 沙盤推演 UI

**新頁** `/scenario-simulator`：滑桿調參、即時看下月收支變化。

**模型參數**：
- 行銷預算 −50%~+100%（含可調 marketingElasticity，預設 0.3）
- 訂價 −20%~+30%
- OTA 渠道佔比變化（含 12% 抽成假設）
- 收入直接調整
- 每模板可暫停 / 改金額

**呈現**：
- 收入/支出/淨利 × 基準 vs 模擬 vs 差異%
- 利潤率變化 pp（> 5pp 跳「明顯改善/惡化」徽章）
- 虧損預警卡 + 改善建議

## Phase 4 — PMS 對接收端

**新 endpoint**：`POST /api/forecast/webhook/:sourceKey`
- 認證：複用 income_sources Bearer token
- 行為：UPSERT 進 `revenue_forecast_snapshots`（source='pms-booking'）
- 加入 webhook 豁免清單

**6 家館 PMS forecast sources 已建好**（pms-{拼音}-forecast）：
- 每家獨立 32-byte token
- Webhook URL 統一格式：`https://money.homi.cc/api/forecast/webhook/{sourceKey}`

**PMS 端對接 SDK 範例** 已寫入 `scripts/setup-pms-forecast-sources.mjs`。

---

## 系統現況

### 三個新頁面
| 路徑 | 用途 | 入口 |
|------|------|------|
| `/recurring-expenses` | 模板管理 | 系統管理 |
| `/revenue-forecast` | 走勢圖 + 預測 | 財務助理 |
| `/scenario-simulator` | 沙盤推演 | 財務助理 |

### API 端點
| 端點 | 功能 |
|------|------|
| `GET /api/recurring-expense-templates` | 列模板 |
| `POST/PUT/DELETE` | CRUD |
| `POST /:id/generate` | 立即產出 |
| `POST /generate-all` | 批次產出 |
| `GET /api/forecast/snapshots` | 列快照 |
| `GET /api/forecast/trend` | 走勢 |
| `GET /api/forecast/simple` | 線性推估 |
| `GET /api/forecast/seasonal` | 季節性預測 |
| `POST /api/forecast/capture` | 立即拍 |
| `POST /api/forecast/backfill` | 從 PM 歷史補建 |
| `POST /api/forecast/webhook/:sourceKey` | 接 PMS 推送 |

### 資料現況
- forecast_snapshots：318 筆（PM backfill）
- 跨 2026-02 ~ 2026-05、平均比率約 60%、樣本 ≤ 3 → 預測信心 low / insufficient
- 隨每日 cron 累積、3-6 個月後升 medium / high

---

## 使用者後續

1. **PMS 端對接**：拿 6 把 token 給 PMS 工程師、按 `setup-pms-forecast-sources.mjs` 範例對接
2. **每月 1-3 號自動產出**：scheduler 會自動跑、看 `/recurring-expenses` 「本月已產出」徽章確認
3. **每日 23:00 拍 PM 快照**：自動進行、不需介入
4. **資料累積 3+ 月後**：seasonal 預測會升級 medium、開始實用
5. **沙盤推演**：可隨時調參做行銷預算 / 訂價策略決策

---

## 相關文件

- 架構藍圖：[`docs/architecture/forecasting-engine.md`](../architecture/forecasting-engine.md)
- 既有 PM 對接：[`docs/integration-api.md`](../integration-api.md) §10.1
- 前次大型變動：[`2026-05-17-financial-coverage-overhaul.md`](2026-05-17-financial-coverage-overhaul.md)
