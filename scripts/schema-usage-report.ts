/**
 * Schema 使用率評估腳本（階段 5.2）
 *
 * 掃描所有 public schema tables、產出 markdown 報告：
 *  - 每張表的 row count
 *  - 過去 30 天 INSERT 數（推測：有 created_at 欄位則 count where created_at >= now() - 30 days）
 *  - 標記「dead schema」候選（0 筆 OR 30 天 0 insert）
 *
 * 用法：
 *   DATABASE_URL=postgresql://... npx tsx scripts/schema-usage-report.ts > docs/runbooks/schema-usage.md
 *
 * 注意：純評估報告、不刪除任何表
 */
import { Pool } from "pg"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  process.stderr.write("✗ 需要環境變數 DATABASE_URL\n")
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })

interface TableStat {
  name: string
  rowCount: number
  hasCreatedAt: boolean
  recentInserts: number | null
  status: "active" | "dormant" | "empty" | "cold"
}

async function listPublicTables(): Promise<string[]> {
  const r = await pool.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT IN ('drizzle__migrations', '__drizzle_migrations')
    ORDER BY tablename
  `)
  return r.rows.map((row) => row.tablename as string)
}

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1`,
    [table, column]
  )
  return r.rowCount! > 0
}

async function rowCount(table: string): Promise<number> {
  const r = await pool.query(`SELECT COUNT(*)::int AS n FROM "${table}"`)
  return r.rows[0]?.n ?? 0
}

async function recentInsertsCount(table: string, days: number): Promise<number> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM "${table}" WHERE created_at >= NOW() - INTERVAL '${days} days'`
  )
  return r.rows[0]?.n ?? 0
}

async function statOne(name: string): Promise<TableStat> {
  let count = 0
  try {
    count = await rowCount(name)
  } catch (e) {
    process.stderr.write(`✗ count(${name}): ${(e as Error).message}\n`)
  }
  const hasCreatedAt = await tableHasColumn(name, "created_at")
  let recent: number | null = null
  if (hasCreatedAt) {
    try {
      recent = await recentInsertsCount(name, 30)
    } catch (e) {
      process.stderr.write(`✗ recent(${name}): ${(e as Error).message}\n`)
    }
  }

  let status: TableStat["status"]
  if (count === 0) status = "empty"
  else if (hasCreatedAt && recent === 0) status = "cold"
  else if (hasCreatedAt && recent !== null && recent > 0) status = "active"
  else status = "dormant"

  return { name, rowCount: count, hasCreatedAt, recentInserts: recent, status }
}

function statusEmoji(s: TableStat["status"]): string {
  return s === "active" ? "🟢" : s === "dormant" ? "🟡" : s === "cold" ? "🟠" : "⚪"
}

function md(stats: TableStat[]): string {
  const sorted = [...stats].sort((a, b) => {
    const orderS = { active: 0, dormant: 1, cold: 2, empty: 3 }
    if (orderS[a.status] !== orderS[b.status]) return orderS[a.status] - orderS[b.status]
    return b.rowCount - a.rowCount
  })

  const counts = {
    active: stats.filter((s) => s.status === "active").length,
    dormant: stats.filter((s) => s.status === "dormant").length,
    cold: stats.filter((s) => s.status === "cold").length,
    empty: stats.filter((s) => s.status === "empty").length,
  }

  const lines: string[] = []
  lines.push("# Schema 使用率報告")
  lines.push("")
  lines.push(`> 生成時間：${new Date().toISOString()}`)
  lines.push(`> 總表數：${stats.length} 張 · 由 scripts/schema-usage-report.ts 產生`)
  lines.push("")
  lines.push("## 狀態分類")
  lines.push("")
  lines.push("| 狀態 | 圖示 | 定義 |")
  lines.push("|------|------|------|")
  lines.push("| active | 🟢 | 30 天內有 INSERT |")
  lines.push("| dormant | 🟡 | 有資料、無 created_at 欄位（無法判斷新鮮度）|")
  lines.push("| cold | 🟠 | 30 天內 0 INSERT、但有歷史資料 |")
  lines.push("| empty | ⚪ | 完全沒資料、dead schema 候選 |")
  lines.push("")
  lines.push("## 統計")
  lines.push("")
  lines.push(`- 🟢 active：**${counts.active}** 張`)
  lines.push(`- 🟡 dormant：**${counts.dormant}** 張`)
  lines.push(`- 🟠 cold：**${counts.cold}** 張（可考慮歸檔）`)
  lines.push(`- ⚪ empty：**${counts.empty}** 張（dead schema 候選、評估後可移除）`)
  lines.push("")
  lines.push("## 明細")
  lines.push("")
  lines.push("| 狀態 | 表名 | 總筆數 | 30 天 INSERT |")
  lines.push("|------|------|--------|-------------|")
  for (const s of sorted) {
    const recent = s.recentInserts !== null ? s.recentInserts.toLocaleString() : "—"
    lines.push(
      `| ${statusEmoji(s.status)} ${s.status} | \`${s.name}\` | ${s.rowCount.toLocaleString()} | ${recent} |`
    )
  }
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("## 處理建議")
  lines.push("")
  lines.push("### empty（⚪）— 完全沒資料")
  lines.push("**步驟**：")
  lines.push("1. grep `tableName` in `server/` `client/` `shared/` — 確認程式碼有沒有引用")
  lines.push("2. 若有引用 → 評估是否為 unused feature、考慮刪 feature + drop table")
  lines.push("3. 若無引用 → 直接 drop（但先寫進 ADR 紀錄、保留 schema snapshot）")
  lines.push("")
  lines.push("### cold（🟠）— 30 天無 INSERT")
  lines.push("**步驟**：")
  lines.push("1. 確認是不是一次性 seed 表（如 fixed_categories）→ 標 `seed-only` 不動")
  lines.push("2. 不是 seed → 看歷史最後 INSERT 時間（`SELECT MAX(created_at) FROM xxx`）")
  lines.push("3. 超過 90 天 → 考慮歸檔（rename to `archive_xxx_YYYY` 或 export to S3）")
  lines.push("")
  lines.push("### dormant（🟡）— 無 created_at")
  lines.push("**步驟**：")
  lines.push("1. 加 created_at 欄位（ADD COLUMN with DEFAULT NOW()、不破壞既有資料）")
  lines.push("2. 下次 report 即可分類為 active / cold")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("**重要：本報告僅供評估、不執行任何刪除動作。實際刪除需另外寫 migration + ADR。**")
  return lines.join("\n")
}

async function main(): Promise<void> {
  const tables = await listPublicTables()
  process.stderr.write(`→ 掃描 ${tables.length} 張表...\n`)
  const stats: TableStat[] = []
  for (const t of tables) {
    process.stderr.write(`  · ${t}\n`)
    stats.push(await statOne(t))
  }
  process.stdout.write(md(stats) + "\n")
  await pool.end()
}

main().catch((e) => {
  process.stderr.write(`✗ ${(e as Error).message}\n`)
  process.exit(1)
})
