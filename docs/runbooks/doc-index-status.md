# 文件索引完整性報告

> 生成時間：2026-05-23T13:16:54.167Z
> 索引檔：`docs/README.md`

## 統計

- 文件總數（不含索引本身）：**19**
- 🟢 已索引：**19**（100%）
- 🔴 未索引：**0**
- ⚠️ Broken links（索引連結但檔案不存在）：**0**

## 判定方式

- 掃 `docs/` 所有 `*.md` / `*.yaml`
- 對每個文件：檢查 `docs/README.md` 是否包含「完整相對路徑」或「檔名」字串
- broken：解析 README 的 markdown link `(path)` 並驗證實體存在

## 各分類明細

### (root)/

> 4 個 · 0 未索引

| 狀態 | 路徑 | 大小 |
|------|------|------|
| 🟢 | `category-merge.md` | 7.4KB |
| 🟢 | `income-webhook-api.md` | 6.8KB |
| 🟢 | `integration-api.md` | 15.5KB |
| 🟢 | `openapi.yaml` | 14.2KB |

### architecture/

> 1 個 · 0 未索引

| 狀態 | 路徑 | 大小 |
|------|------|------|
| 🟢 | `architecture/forecasting-engine.md` | 5.4KB |

### changes/

> 8 個 · 0 未索引

| 狀態 | 路徑 | 大小 |
|------|------|------|
| 🟢 | `changes/2026-05-14-document-inbox-upload-fix.md` | 6.6KB |
| 🟢 | `changes/2026-05-14-navigation-focus-optimization.md` | 5.9KB |
| 🟢 | `changes/2026-05-16-integration-api-spec.md` | 8.4KB |
| 🟢 | `changes/2026-05-17-financial-coverage-overhaul.md` | 6.3KB |
| 🟢 | `changes/2026-05-18-forecasting-engine.md` | 4.7KB |
| 🟢 | `changes/2026-05-19-ux-detail-optimization-loop.md` | 10.7KB |
| 🟢 | `changes/2026-05-23-functional-audit.md` | 16.7KB |
| 🟢 | `changes/2026-05-23-household-budget-overhaul.md` | 9.1KB |

### runbooks/

> 6 個 · 0 未索引

| 狀態 | 路徑 | 大小 |
|------|------|------|
| 🟢 | `runbooks/db-migration.md` | 3.0KB |
| 🟢 | `runbooks/deploy.md` | 3.8KB |
| 🟢 | `runbooks/doc-index-status.md` | 0B |
| 🟢 | `runbooks/family-kids-endpoint-usage.md` | 13.9KB |
| 🟢 | `runbooks/git-divergence.md` | 4.3KB |
| 🟢 | `runbooks/schema-usage.md` | 4.6KB |

---

## 後續處理建議

1. **🔴 未索引文件**：
   - 若是要保留的文件 → 在 `docs/README.md` 加索引連結
   - 若是過時文件 → 搬到 `docs/archive/`
2. **⚠️ Broken links**：
   - 連結到不存在的檔 → 修連結或移除
3. 月底維護時跑此 script、保持 docs/README.md 完整性
