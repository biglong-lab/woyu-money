# 多檔上傳修復 + Git 分叉處理 + DB Schema 同步 — 2026-05-14

> 範圍：document-inbox、budget API、本地 DB schema、部署 SOP
> 狀態：✅ 已部署
> 部署 commit 範圍：`4fbc4a5..5dce558`（含 `f817490` + `5dce558` 兩個正式 commit）
> 生產驗證：HTTP 200、容器重啟於 `2026-05-14T06:36:50Z`

---

## 背景

使用者從 iPhone 上傳多個收據到 `/document-inbox`，第 11 個檔案被 multer 攔截、回應：

```json
{ "success": false, "message": "未預期的檔案欄位" }
```

訊息誤導使用者以為是欄位名稱寫錯，實際是「超過 maxCount」。

進入修復流程後發現更大問題：
1. 本地分支跟 `origin/main` **分叉 210 commits**（本地落後）
2. 修完推送時 pre-push hook 跑測試，11 個 budget/late-fee 測試失敗
3. 失敗根因是本地 DB schema 沒同步（缺 `budget_items.attribution` 欄位）
4. 順帶發現 budget route 用 over-defensive regex 導致無效 ID 回 404 而非 400

---

## 影響範圍

| 檔案 | 改動 |
|------|------|
| `server/routes/document-inbox.ts` | maxCount 10→20、`LIMIT_UNEXPECTED_FILE` 友善訊息、`LIMIT_FILE_COUNT` 同步改 20 |
| `client/src/pages/document-inbox.tsx` | `handleUpload` 開頭加 `files.length > 20` 預檢 |
| `client/src/components/document-inbox-upload-section.tsx` | UI 提示文字「可一次選擇多張」→「一次最多 20 張」 |
| `server/routes/budget.ts` | 移除 `/api/budget/plans/:id(\\d+)` 的 regex 限制 |
| **本地** DB schema | drizzle-kit push 同步 origin/main 的新欄位（budget_items.attribution 等）|

---

## 根因分析

### 1. multer LIMIT_UNEXPECTED_FILE 誤導訊息

multer 的 `.array("file", 10)` 內部行為：
- 接受 fieldname 為「file」的檔案，最多 10 個
- 第 11 個檔案 → 觸發 `MulterError('LIMIT_UNEXPECTED_FILE')` 並帶 `field: "file"`

原本錯誤處理把所有 `LIMIT_UNEXPECTED_FILE` 都翻譯成「未預期的檔案欄位」— 這在「欄位名稱真的對不上」時正確，但在「超過 maxCount」時誤導。

### 2. Budget route over-defensive regex

`/api/budget/plans/:id(\\d+)` 用 regex 限制 id 只能純數字，註解寫是為了避免吃掉 `/api/budget/plans/by-month`。但：
- `by-month` 路由在這檔案根本不存在（過時防禦）
- 同 file 其他 sibling routes（PATCH/DELETE）都沒這 regex
- 結果：傳 `/api/budget/plans/abc` 完全不匹配此 route → Express 預設 404，使 `isNaN(id)` 檢查永遠 fire 不到 → 測試「無效 ID 應回傳 400」失敗

### 3. 本地 DB schema 漂移

origin/main 跑過 migration `0008_property_groups_and_budget_attribution.sql` 加了：
- `budget_items.attribution`
- `budget_items.target_project_id`
- `budget_items.shared_group_id`
- 新表 `budget_item_allocations`

但本地 DB 沒跑這個 migration。drizzle-kit 也沒記錄 `drizzle.__drizzle_migrations` 表 → 無法用 migrate 方式增量套用 → 改用 `drizzle-kit push` 直接 sync schema。

### 4. Git 分叉

本地有 5 個 auto-save commit（PostToolUse hook 每次 Edit 自動 commit）、origin/main 多 210 commits。雙邊修改點重疊到 `server/routes/document-inbox.ts`（origin 上有 LINE 顯示名稱重構：`getAuditUserInfo`）。

---

## 解決方案

### A. multer 上限與訊息

```ts
// server/routes/document-inbox.ts
function handleMulterError(err: Error, _req, res, next) {
  if (err instanceof multer.MulterError) {
    // 對「file」欄位的 LIMIT_UNEXPECTED_FILE 其實是超過 maxCount，給友善訊息
    if (err.code === "LIMIT_UNEXPECTED_FILE" && err.field === "file") {
      return res.status(400).json({
        success: false,
        message: "一次最多上傳 20 個檔案，請分批上傳",
      })
    }
    // ... 其他 codes 用 messages 表
  }
}

// 路由設定
documentUpload.array("file", 20)  // 從 10 → 20
```

前端預檢：

```tsx
// client/src/pages/document-inbox.tsx
const handleUpload = useCallback(async (files: FileList, notes: string) => {
  if (files.length > 20) {
    toast({
      title: "選擇檔案過多",
      description: `一次最多上傳 20 個檔案，您選擇了 ${files.length} 個，請分批上傳`,
      variant: "destructive",
    })
    return
  }
  // ... 送出 formData
}, [...])
```

### B. Budget regex 移除

```ts
// before
router.get("/api/budget/plans/:id(\\d+)", asyncHandler(...))

// after
router.get("/api/budget/plans/:id", asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) throw new AppError(400, "無效的預算計劃 ID")
  // ...
}))
```

### C. Schema 同步

```bash
DATABASE_URL=postgresql://woyu:woyu123@localhost:5439/woyu_money \
  npx drizzle-kit push --force
```

### D. Git 分叉處理

採「reset --hard + 重套」策略：

```bash
# 1. 確認本地 commits 都只是這次工作（git log main ^origin/main --stat）
git reset --hard origin/main

# 2. 在最新 origin/main 之上重新編輯三個檔案
#    auto-save hook 會自動切碎 commit

# 3. squash 成單一 commit
git reset --soft origin/main
git commit -m "fix(document-inbox): ..."
```

---

## 實作步驟（時序 commit）

| 順序 | Commit | 內容 |
|------|--------|------|
| 1 | `f817490` | `fix(document-inbox): 上傳上限提高到 20 個並修正誤導性錯誤訊息` |
| 2 | `5dce558` | `fix(budget): 無效 ID 回 400 而非 404` |

> 中間還有 5+1 個 `chore(auto)` 被 squash 進去、不在 origin/main 上。

---

## 驗證

| 項目 | 結果 |
|------|------|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run`（全部 74 檔案） | 1836/1836 全綠 |
| `git push origin main` | pre-push hook 通過 |
| SSH 部署 | container recreate 成功 |
| `curl -sI https://money.homi.cc/` | HTTP 200, last-modified `2026-05-14T06:35:11Z` |
| 容器啟動時間 | `2026-05-14T06:36:50.067Z` |

---

## 已知限制 / 後續優化

- **drizzle-kit migration tracking**：本地 DB 沒有 `drizzle.__drizzle_migrations` 表，每次 schema 漂移都得靠 `push --force`。下次新增專案時應該初始化 migration tracking。
- **auto-save hook 噪音**：PostToolUse hook 每次 Edit 都 commit 一筆，正式工作流要記得 `git reset --soft origin/main` squash。
- **iPhone 21 張以上批量**：使用者實際場景可能就是會超過 20 張，未來若回報「20 還不夠」可再評估上限。同步上傳超過 50 張要考慮 server 容量（每檔 20MB × 50 = 1GB request）。
- **iPhone HEIC 支援**：upload-config.ts 已接受 HEIC，但前端 UI 文字只列 JPEG/PNG/GIF/WebP — 文字可補上 HEIC。

---

## 相關文件

- [部署 SOP](../runbooks/deploy.md)
- [DB Schema 同步](../runbooks/db-migration.md)
- [Git 分叉處理](../runbooks/git-divergence.md)
