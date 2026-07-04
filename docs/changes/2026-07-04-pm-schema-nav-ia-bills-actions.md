# PM Schema 事故修復 + 選單資訊架構重整 + 帳單可操作化 — 2026-07-04

> 範圍：1.2.2 → 1.3.2 四個版本、同日四次部署（皆驗證 OK）
> Commit 範圍：`d45cc55` → `a43531f`

## 一、PM 同步 20 天中斷事故（1.2.2、`d45cc55` + `af01ce4`）

### 事故經過與根因

- 症狀：revenue-compare 數據明顯異常；pm-revenue-sync 連續 20 天「新增 0」
- **第一層誤判**：曾判定「PM 系統停止記帳」（public.revenues 全公司停在 6/11~6/14）
- **真根因（使用者指正）**：PM 於 **2026-06-14 做多租戶遷移**，正式資料從 `public`
  搬到 **`t_wodao`** schema；Money 的 PM 同步是**直連 PM DB SELECT**（非 API），
  4 個檔案的查詢都沒指定 schema → 一直讀凍結的 public
- 教訓已寫入專案記憶 [[pm-multitenant-schema]]：懷疑 PM 資料中斷時先查 t_wodao 再下結論

### 修復內容

1. **`af01ce4`**：4 檔 PM 直連 Pool 統一 `options: "-c search_path=t_wodao,public"`
   （storage/pm-bridge、storage/forecast-snapshots、routes/pm-bridge、routes/pms-bridge 的 pmPool）；
   `companies` 等平台表仍在 public、fallback 為刻意設計
2. **`d45cc55`**：compare 的 PM 端補排除大號文創/大哉文旅（company 6/7、佔 PM 收入 ~65%）
   + PMS 缺月標 `missing_pms`（琥珀「PMS 未填該月」、不再拉偏統計）

### 修復效果（生產實測）

| 指標 | 修復前 | 修復後 |
|------|--------|--------|
| 6 月 PM vs PMS 差距 | 虛差 +42 萬（組成錯誤）| **2,934（0.2%）** |
| pm-revenue-sync | 20 天新增 0 | 部署後首 tick **補回 328 筆**（30 天視窗自動回填）|

### 後續資料處理

- 進帳收件箱一鍵批次確認：**293 筆 / $1,001,259 歸帳**（來源=PM 日收入、預設專案浯島文旅）
- 5 筆舊整合測試殘留（test_no_auth 等）標記拒絕清除
- 刻意保留 42 筆 pending：39 筆 PMS 月度累計（**只用於比對、確認會重複計帳一千多萬**）
  + 2 筆帳單（金額空）+ 1 筆自研平台（無預設專案）

## 二、選單資訊架構重整（1.3.0、`6608f31`）

- **7 群（工具型）→ 5 群（做事型）**：解散 總覽中心/核心決策/工具箱/進階工具/
  付款方式管理/統一查看
- 新分群：主要功能（+財務駕駛艙常駐頂層）/ 💸 付款與排程（⏰該付→📦項目→📅排程→🧾對帳）/
  🏢 固定成本與合約 / 📊 報表與規劃（👁️總覽/📊經營/🧭規劃）/ 👨‍👩‍👧 家庭 / ⚙️ 系統管理
- 團聚散落項目：租金 2 處、勞健保 3 處、報表 3 群；週期模板從系統管理移回業務區
- 四端同步：桌面 categoryConfigs / 手機 PopupMenu / Cmd+K / 34 條麵包屑；入口零刪除

## 三、帳單到期看板可操作化（1.3.1 `9a0d8fa`+`c458b43`、1.3.2 `a43531f`）

- **立即處理**：每筆帳單原地開付款 dialog（金額預填未付餘額、日期預填今天）；
  payment_item 走 `/api/payment/items/:id/payments`（狀態更新+記錄+預算回沖）、
  強執分期走 `/api/enforcement/installments/:id/payments`
- **投影修正**：強執分期該月已繳足不再投影、部分繳只顯示剩餘（+4 單元測試）—
  沒這個修正，原地付款後帳單不會消失
- **批次處理**：checkbox+全選、sticky 合計操作列、批次 dialog（清單預覽/統一日期方式備註/
  逐筆進度）；部分失敗不中斷、回報明細；下月強執分期以其到期日入帳歸對月份

## 驗證

- 每版部署後四項檢查：網站 200+last-modified、API 閘門 401、cron tick 全綠、關鍵表筆數
- 全程 tsc + 全套測試 + build + pre-push 通過

## 已知限制 / 後續

- PMS 2026-02、03 月 performance_entries 未填（對方系統）→ 比對頁標「PMS 未填該月」，
  需要準確比對需請 PMS 端補登
- 39 筆 PMS 月度累計 pending 掛在收件箱：建議整批「拒絕」歸零（標記不處理、不刪資料），待使用者決定
- 批次處理為前端逐筆呼叫（数十筆規模夠用）；若未來單次上百筆可考慮後端批次端點

## 相關文件

- 前一日大改版：[2026-07-03 五階段優化](2026-07-03-system-optimization-phases.md)
- Migration 治理：`docs/runbooks/db-migration.md`
