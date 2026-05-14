# Git 分叉處理 SOP

> 本專案使用 `PostToolUse` auto-save hook：每次 Edit / Write 都自動 commit 一筆 `chore(auto): 自動存檔 <file>`。
> 配合多裝置開發，**本地與 origin 分叉** 是常態場景。

---

## 開工前必查

每次開始任務前，**先檢查分叉狀態**：

```bash
git fetch origin
git status   # 看「領先 / 落後 / 分叉」訊息
git log --oneline -5
git log --oneline origin/main -5
```

四種狀態：

| 狀態 | 訊息 | 動作 |
|------|------|------|
| 同步 | 「分支與 origin/main 同步」 | 直接開工 |
| 領先 | 「領先 origin/main N 個提交」 | 開工，記得 push |
| 落後 | 「落後 origin/main N 個提交」 | `git pull` 再開工 |
| 分叉 | 「分別有 X 和 Y 處不同的提交」 | **停！按下面流程處理** |

---

## 分叉處理流程

### 第一步：盤點本地 commits

```bash
# 看本地有哪些 commits 是 origin 沒有的
git log main ^origin/main --stat
```

判斷這些 commits 的性質：

| 內容 | 含義 |
|------|------|
| 全是 `chore(auto):` | 都是 auto-save，**可以丟掉**（內容會由我重新套用）|
| 有正式 `feat:` / `fix:` | 有**真實工作**，要保留，必須 rebase |
| 兩者混合 | 先 rebase，過程中可選擇性丟掉 chore(auto) |

### 第二步：盤點重疊檔案

```bash
# 看本地和 origin 共同改了哪些檔案（重疊 = 潛在 conflict）
git diff --name-only main origin/main | head
git diff --name-only origin/main main | head
```

---

## 策略 A：reset --hard + 重套（最簡單）

**適用**：本地全是 auto-save commits、無真實工作損失。

```bash
# 1. 確認沒有未推送的真實工作
git log main ^origin/main --stat

# 2. 拉齊到最新
git reset --hard origin/main

# 3. 在最新程式碼上重新編輯
#    （auto-save hook 會自動切碎 commit）

# 4. squash 成單一正式 commit
git reset --soft origin/main
git commit -m "fix(scope): 一句完整訊息"

# 5. 推送
git push origin main
```

**風險**：`reset --hard` 會丟工作目錄與本地 commits（不可逆）。先 `git status -s` 確認沒有未追蹤檔案。

---

## 策略 B：rebase（保留歷史）

**適用**：本地有真實工作要保留。

```bash
git pull --rebase origin main
# 遇到 conflict → 編輯檔案、git add、git rebase --continue
# 想丟掉某個 chore(auto) → git rebase --skip
```

**踩坑**：每個 `chore(auto)` 都可能各自卡 conflict（同一檔被切碎成多個 commit）。如果本地有 N 個 chore(auto)，可能要解 N 次同一檔的 conflict。

---

## 策略 C：先 squash 本地再 rebase（折衷）

**適用**：本地有真實工作，但 auto-save 切得太碎。

```bash
# 1. 找出本地最後一個正式 commit（不是 chore(auto)）
git log --oneline | grep -v "chore(auto)" | head -2

# 2. soft reset 把所有 auto-saves 壓平
git reset --soft <last-real-commit>

# 3. commit 成單一變更
git commit -m "fix(scope): ..."

# 4. rebase 到 origin/main
git pull --rebase origin main
```

---

## auto-save hook 注意

每次 Edit / Write 都會自動 commit。處理時：

- ✅ **正式 push 前一定要 squash**：用 `git reset --soft origin/main && git commit` 重做訊息
- ✅ **commit message 用 conventional commits**：`feat: / fix: / refactor: / chore:`
- ❌ 不要直接推 `chore(auto):` 系列上 origin/main

---

## 實際案例

### 2026-05-14：分叉 210 commits（落後）+ 5 chore(auto)（領先）

**狀況**：本地有 5 個 auto-save commit、origin/main 多 210 個 commits（多裝置開發累積）。重疊到 `server/routes/document-inbox.ts`（origin 上加了 `getAuditUserInfo` 等 import）。

**選用策略**：A（reset --hard）

**理由**：
- 5 個 auto-save commit 都是同一次任務的切碎、內容容易重套
- 本地無真實工作損失
- rebase 5 次 conflict 很煩、reset 重套更乾淨

**步驟**：
```bash
git log main ^origin/main --stat   # 確認都是 chore(auto)
git reset --hard origin/main        # 拉齊
# 重新編輯 3 個檔案
git reset --soft origin/main        # 壓平 auto-saves
git commit -m "fix(document-inbox): 上傳上限提高到 20 個並修正誤導性錯誤訊息"
git push origin main
```

---

## 相關文件

- [部署 SOP](deploy.md)
- 實例紀錄：`docs/changes/2026-05-14-document-inbox-upload-fix.md`
