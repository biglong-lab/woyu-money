# 網站工具聚焦優化（5 Phase 重排） — 2026-05-14

> 範圍：navigation.ts、mobile-tab-bar、首頁卡片順序、新增 CommandPalette
> 狀態：✅ 已部署
> 部署 commit 範圍：`f34e0ed..b7dd915`（2 個正式 commit）
> 生產驗證：HTTP 200、容器重啟於 `2026-05-14T15:30:01Z`

---

## 背景

使用者反映：「網站工具的聚焦優化，方便有效率使用，請針對系統核心來做規劃對焦與設計」

盤點後發現：
- 69 個頁面、約 32 個無導航入口（孤兒或舊頁）
- 「統一查看」分類塞了 13 項，使用者必定有找不到東西的問題
- 最近 3 個月開發投入 90% 在「財務助理」9 個工具 — **這就是系統核心**
- 但網站結構沒反映：手機底 tab 沒有助理入口、首頁的 `TodayFocusCard` 還排在第 3 位被擋住
- 5 個舊分類管理頁的 30 天觀察期早已過、雙路徑別名（`/payment-reports`、`/loan-investment`）增加噪音

---

## 解決方案 — 5 Phase

### Phase 1：清理（commit `6b7e097`）
純導航層整理，**路由全部保留**供深度連結：
- 「財務總覽 v2」標題改回「財務總覽」（舊版下架，不需 v2 字樣）
- `/financial-overview`（舊版）從 viewNavItems + breadcrumb 移除
- 5 個舊分類管理頁 breadcrumb 拿掉（已合併到 `/categories`）
- 2 個雙路徑別名 breadcrumb 拿掉
- `/features`、`/unified-payment` breadcrumb 拿掉

### Phase 4：手機底 tab 對齊核心（commit `6b7e097`）
**關鍵發現**：手機「更多」popup 原本把 `[...decisionNavItems, ...viewNavItems]` 22 項全塞進去，這才是滑來滑去找不到的元兇。

- `PopupMenu` 新增 `sections` 屬性，支援分組顯示（含 section header + 線分隔）
- 「更多」popup 重組為 3 個分區：
  - 💡 **財務助理**（amber，9 項，**放最上**）
  - 📊 **查看 & 報表**（green，12 項）
  - ⚙️ **系統管理**（orange，7 項）
- 移除 dead code（`openMenu === "more"` 從未被觸發）

### Phase 2：「統一查看」12 項瘦身（commit `6b7e097`）
**務實版**：不建新 hub 頁面（成本高、子組件互嵌風險），改用「重排序 + emoji 視覺分群」。

新順序：
1. **每日高頻直達 (3)**：付款記錄、專案付款管理、付款時間計劃
2. **📊 報表類 (5)**：財務三表、稅務、人事費、付款報表、收入分析
3. **🔍 分析類 (1)**：付款分析
4. **💰 預算類 (2)**：專案預算、家庭預算

移除所有 NEW badge 雜訊。

> **Follow-up**：之後若使用者想要更激進的整合，可建 `/reports` hub 頁用 Tab 切換 5 個子報表。先看排序改善後是否還有「找不到」回饋。

### Phase 3：首頁聚焦「今天的事」（commit `6b7e097`）
**關鍵發現**：`TodayFocusCard`（846 行完整「破解逃避」卡）早就實作，但**排在第 3 位**被擋住。

首頁卡片順序重排：

| 原順序 | 新順序 |
|--------|--------|
| 1. 財務健康摘要 | 1. 🎯 **今日焦點** ⭐ |
| 2. 財務助理 quick card | 2. 💡 財務助理 quick card |
| 3. 🎯 今日焦點 ⭐ | 3. 📊 財務健康摘要 |
| 4. 當前租金 | 4. 當前租金 |
| 5. 最近付款 | 5. 最近付款 |
| 6. 下月預估 | 6. 下月預估 |

**邏輯**：使用者打開系統 → 第一眼看到「今天該做的 1 件事」（含拖延成本）→ 完成後看「助理工具」決定下一步 → 才看「健康摘要」全貌。

### Phase 5：Cmd+K 全域快速跳轉（commit `b7dd915`）
新增 `client/src/components/command-palette.tsx`，補救「找不到頁面」的最後一道防線。

- 全域 hotkey：**Cmd+K**（mac）/ **Ctrl+K**（win）/ **「/」鍵**（非編輯狀態）
- 模糊搜尋所有 navigationCategories 項目
- 高頻入口放最上：回首頁、單據收件箱
- 按既有 navigationCategories 分組顯示（標題 + 圖示 + description）
- 桌面 TopNavigation 加搜尋按鈕、含快捷鍵提示
- 在 input/textarea/contentEditable 中不攔截「/」鍵，但保留 Cmd+K

---

## 影響範圍

| 檔案 | 改動 |
|------|------|
| `client/src/config/navigation.ts` | viewNavItems 重排序、breadcrumbConfig 清理 |
| `client/src/components/mobile-tab-bar.tsx` | PopupMenu 加 sections 支援、「更多」改 3 區 |
| `client/src/pages/payment-home.tsx` | 卡片順序重排（TodayFocusCard 推上第一） |
| `client/src/components/command-palette.tsx` | **新檔**，CommandPalette + TriggerButton |
| `client/src/components/top-navigation.tsx` | 加搜尋觸發按鈕 |
| `client/src/App.tsx` | 掛載 `<CommandPalette />` |

---

## 驗證

| 項目 | 結果 |
|------|------|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 1836/1836 全綠 |
| `git push origin main` | pre-push hook 通過 |
| SSH 部署 | container recreate 成功 |
| `curl -sI https://money.homi.cc/` | HTTP 200, last-modified `2026-05-14T15:28:25Z` |
| 容器啟動時間 | `2026-05-14T15:30:01Z` |

---

## 已知限制 / Follow-up

- **Phase 2 務實版**未建 hub 頁面 — 若使用者使用後仍反映「找不到」，下次可建 `/reports` 等 hub 頁
- **CommandPalette 手機端**目前只能透過外接鍵盤 Cmd+K 觸發、桌面 TopNavigation 沒在手機顯示 — 之後可加手機端搜尋圖示
- **CommandPalette 不做動作觸發**（拍單據、快速記帳）— 需要全域 state 管理才能做，此次純做頁面跳轉
- **viewNavItems 的 emoji**（📊/🔍/💰）跟手機 PopupMenu section 的 emoji（💡/📊/⚙️）有部分重疊 — 視覺上 OK，但若未來想統一可調

---

## 部署紀錄

| 日期 | 版本 | Commit | 摘要 |
|------|------|--------|------|
| 2026-05-14 上午 | 1.0.2 | `5dce558` | 多檔上傳上限 20、Budget regex 修復、docs/ 骨架 |
| 2026-05-14 下午 | 1.0.3 | `b7dd915` | 網站工具聚焦優化（5 phase） |

---

## 相關文件

- [部署 SOP](../runbooks/deploy.md)
- [Git 分叉處理](../runbooks/git-divergence.md)
- 前一次部署紀錄：`docs/changes/2026-05-14-document-inbox-upload-fix.md`
