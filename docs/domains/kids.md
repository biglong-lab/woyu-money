# 親子（family-kids）領域

> 全系統最大的單一模組 — server/routes/family-kids.ts 約 9500 行 / 207 endpoints
> 涵蓋：家長派任務、小孩打卡、零用金、三罐分配、徽章、家庭看板

## 主要表（部分）

| 表 | 用途 |
|----|------|
| `kids_accounts` | 小孩帳號（PIN 登入） |
| `kids_tasks` | 任務 / 重複任務 / 一次性任務 |
| `kids_task_completions` | 任務完成紀錄（含家長批准狀態） |
| `kids_task_comments` | 任務留言 |
| `kids_allowance_records` | 零用金發放 / 三罐分配 |
| `family_pot_contributions` | 共同存錢罐 |
| `family_members` | 家庭成員資料 |
| `family_savings_goals` | 家庭存錢目標 |

## 關鍵設計

- **PIN 登入**：小孩用 4-6 位 PIN、家長用一般帳號
- **三罐分配**：存錢 / 消費 / 公益 比例可家庭設定
- **批准流程**：小孩完成 → 家長批准 → 發零用金 → 自動分三罐
- **每月零用金**：dashboard 查時補發 + 同月不重發

## 重要紀錄

- streak 排行榜（連續打卡）
- 家長批准回應速度分析
- 6 個月家庭派任務量趨勢
- 今日花費即時動態 feed
- 預算超支即時警示卡（家用記帳頁置頂）

## 測試覆蓋

- `tests/integration/family-kids.test.ts` 411 tests、pre-push 必過
- TRUNCATE kids_accounts 在 pre-push 跑、避免測試污染

## 拆檔建議（audit）

family-kids.ts 9500 行已過警戒。未來拆檔方向：
- routes/family-kids/tasks.ts
- routes/family-kids/allowance.ts
- routes/family-kids/dashboard.ts
- routes/family-kids/streak.ts
- 拆檔不是 P0、但長遠維護需要
