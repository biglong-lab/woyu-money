# PM company_id ↔ project_id mapping 表 — 2026-05-24

> 範圍：shared/schema + server/storage + 2 處查詢改寫
> 狀態：已上線
> 部署 commit：Phase 4 commit hash 由部署時補

## 背景

PM 系統的 `company_id`（1-6）與本系統 `project_id`（3, 4, 9, 10, 20, 26）對應關係寫死兩處：

1. `server/routes/property-pl.ts:106-113` — TS Record（館別損益報表）
2. `server/storage/pms-calibration.ts:99-105` — SQL CASE（PMS 校準曲線）

問題：
- 開新館要改 2 處程式碼 + 重新部署
- 兩處有可能 drift（其中一處改了忘了改另一處）
- 沒有單一 source of truth

## 影響範圍

- `shared/schema/pm-company-mapping.ts`（新建）
- `shared/schema/index.ts`
- `server/storage/pm-company-mapping.ts`（新建 helper + 5 分鐘 cache）
- `server/routes/property-pl.ts`
- `server/storage/pms-calibration.ts`
- `migrations/0014_pm_company_mapping.sql`

## 解決方案

新增 `pm_company_mapping` 表（project_id PK, company_id UNIQUE, hotel_name, is_active）+ seed 6 筆。

- 程式碼：用 `getCompanyToProjectMap()` / `getProjectToCompanyMap()` helper、內含 5 分鐘 cache
- pms-calibration 改用 `JOIN pm_company_mapping`（SQL 直接 JOIN、不用 cache）

## 實作步驟

1. 寫 schema + migration
2. 寫 helper + cache
3. property-pl.ts: hardcoded Record → `await getCompanyToProjectMap()`
4. pms-calibration.ts: CASE → JOIN + 移除 `IN (...)` redundant filter
5. 本地 drizzle push + seed
6. tsc 驗證
7. 生產跑 migration + 部署

## 驗證

- 本地 `SELECT * FROM pm_company_mapping` 6 筆都在
- tsc 0 error
- 生產部署後 `/property-pl` 報表收入欄正常

## 已知限制

- 開新館仍需 INSERT row（未來可做後台 UI）
- cache TTL 5 分鐘、新增 mapping 後最多 5 分鐘才生效（如需即時可 call `invalidatePmCompanyMappingCache()`）

## 相關文件

- `migrations/0014_pm_company_mapping.sql`
- audit roadmap：`docs/changes/2026-05-24-system-architecture-audit.md`
