/**
 * 文件索引完整性檢查（階段 5.4）
 *
 * 掃 docs/ 所有 markdown、檢查 docs/README.md 是否有對應索引（substring 比對）、
 * 列出未索引文件 + 已索引但不存在文件、產 markdown 報告。
 *
 * 用法：
 *   npx tsx scripts/doc-index-check.ts > docs/runbooks/doc-index-status.md
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs"
import { join, relative } from "path"

const DOCS_DIR = "docs"
const INDEX_FILE = "docs/README.md"

interface DocFile {
  relPath: string // 例：runbooks/deploy.md
  bytes: number
  category: string // 例：runbooks
  indexed: boolean
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    const full = join(dir, e)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (e === "node_modules" || e.startsWith(".")) continue
      walk(full, out)
    } else if (e.endsWith(".md") || e.endsWith(".yaml") || e.endsWith(".yml")) {
      out.push(full)
    }
  }
  return out
}

function category(relPath: string): string {
  const seg = relPath.split("/")[0]
  if (seg.includes(".")) return "(root)"
  return seg
}

function main(): void {
  if (!existsSync(INDEX_FILE)) {
    process.stderr.write(`✗ 找不到 ${INDEX_FILE}\n`)
    process.exit(1)
  }

  const files = walk(DOCS_DIR)
  const indexSrc = readFileSync(INDEX_FILE, "utf8")

  const docs: DocFile[] = []
  for (const f of files) {
    const relPath = relative(DOCS_DIR, f).replace(/\\/g, "/")
    if (relPath === "README.md") continue
    let bytes = 0
    try {
      bytes = statSync(f).size
    } catch {
      /* ignore */
    }
    // indexed: README 內有提到 (檔名 or 完整 relative path)
    const fileName = relPath.split("/").pop() ?? relPath
    const indexed = indexSrc.includes(relPath) || indexSrc.includes(fileName)
    docs.push({ relPath, bytes, category: category(relPath), indexed })
  }

  // 找 broken links：README 提到但不存在
  const broken: string[] = []
  const linkRe = /\[[^\]]+\]\(([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(indexSrc)) !== null) {
    const link = m[1].trim()
    if (link.startsWith("http")) continue
    if (link.startsWith("#")) continue
    if (link.startsWith("~/")) continue
    if (link.startsWith("/")) continue
    // 相對連結 → 看 docs/<link> 是否存在
    const full = join(DOCS_DIR, link)
    if (!existsSync(full)) broken.push(link)
  }

  const byCategory = new Map<string, DocFile[]>()
  for (const d of docs) {
    if (!byCategory.has(d.category)) byCategory.set(d.category, [])
    byCategory.get(d.category)!.push(d)
  }

  const total = docs.length
  const indexed = docs.filter((d) => d.indexed).length
  const missing = total - indexed

  const lines: string[] = []
  lines.push("# 文件索引完整性報告")
  lines.push("")
  lines.push(`> 生成時間：${new Date().toISOString()}`)
  lines.push(`> 索引檔：\`${INDEX_FILE}\``)
  lines.push("")
  lines.push("## 統計")
  lines.push("")
  lines.push(`- 文件總數（不含索引本身）：**${total}**`)
  lines.push(`- 🟢 已索引：**${indexed}**（${Math.round((indexed / Math.max(total, 1)) * 100)}%）`)
  lines.push(`- 🔴 未索引：**${missing}**`)
  lines.push(`- ⚠️ Broken links（索引連結但檔案不存在）：**${broken.length}**`)
  lines.push("")
  lines.push("## 判定方式")
  lines.push("")
  lines.push("- 掃 `docs/` 所有 `*.md` / `*.yaml`")
  lines.push("- 對每個文件：檢查 `docs/README.md` 是否包含「完整相對路徑」或「檔名」字串")
  lines.push("- broken：解析 README 的 markdown link `(path)` 並驗證實體存在")
  lines.push("")
  if (broken.length > 0) {
    lines.push("## ⚠️ Broken links")
    lines.push("")
    for (const b of broken) {
      lines.push(`- \`${b}\``)
    }
    lines.push("")
  }
  lines.push("## 各分類明細")
  lines.push("")
  const sortedCats = Array.from(byCategory.keys()).sort()
  for (const cat of sortedCats) {
    const list = byCategory.get(cat)!
    const catMissing = list.filter((d) => !d.indexed).length
    lines.push(`### ${cat}/`)
    lines.push("")
    lines.push(`> ${list.length} 個 · ${catMissing} 未索引`)
    lines.push("")
    lines.push("| 狀態 | 路徑 | 大小 |")
    lines.push("|------|------|------|")
    for (const d of list.sort((a, b) => a.relPath.localeCompare(b.relPath))) {
      const icon = d.indexed ? "🟢" : "🔴"
      const sz = d.bytes < 1024 ? `${d.bytes}B` : `${(d.bytes / 1024).toFixed(1)}KB`
      lines.push(`| ${icon} | \`${d.relPath}\` | ${sz} |`)
    }
    lines.push("")
  }
  lines.push("---")
  lines.push("")
  lines.push("## 後續處理建議")
  lines.push("")
  lines.push("1. **🔴 未索引文件**：")
  lines.push("   - 若是要保留的文件 → 在 `docs/README.md` 加索引連結")
  lines.push("   - 若是過時文件 → 搬到 `docs/archive/`")
  lines.push("2. **⚠️ Broken links**：")
  lines.push("   - 連結到不存在的檔 → 修連結或移除")
  lines.push("3. 月底維護時跑此 script、保持 docs/README.md 完整性")

  process.stdout.write(lines.join("\n") + "\n")
}

main()
