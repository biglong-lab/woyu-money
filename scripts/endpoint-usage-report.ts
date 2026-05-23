/**
 * Endpoint 使用率評估腳本（階段 5.3）
 *
 * 掃描 server/routes/family-kids.ts 提取所有 endpoints、
 * 然後 grep client/src/ 看每個 endpoint 是否被前端引用。
 *
 * 用法：
 *   npx tsx scripts/endpoint-usage-report.ts > docs/runbooks/family-kids-endpoint-usage.md
 *
 * 注意：純評估報告、不刪除任何 endpoint。
 *      「被引用」用 substring match、可能有誤判但偏向「保守保留」、不會漏掉真用到的。
 */
import { readFileSync, readdirSync, statSync } from "fs"
import { join } from "path"

interface Endpoint {
  method: string
  rawPath: string // 例：/api/family/kids/:id
  pattern: string // 例：/api/family/kids 用於 grep（去掉 :param 後綴）
  matchRegex: RegExp // 嚴格匹配用
  comment: string | null
  category: string
  references: number
  matchedFiles: string[]
}

const ROUTES_FILE = "server/routes/family-kids.ts"
const CLIENT_DIRS = ["client/src", "shared"]

function readAllFiles(dir: string, exts: string[]): string[] {
  const out: string[] = []
  function walk(d: string): void {
    let entries: string[]
    try {
      entries = readdirSync(d)
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(d, e)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (e === "node_modules" || e === "dist" || e === ".git") continue
        walk(full)
      } else if (exts.some((ext) => e.endsWith(ext))) {
        out.push(full)
      }
    }
  }
  walk(dir)
  return out
}

/** 把 /api/family/kids/:id/jars 轉成「最長靜態 prefix」用於 grep */
function staticPrefix(routePath: string): string {
  const colon = routePath.indexOf("/:")
  if (colon === -1) return routePath
  return routePath.slice(0, colon)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * 把 raw path 轉成 regex 用於精準匹配
 *  - 把 `:param` 換成 `[\w${}.\\-]+`（支援 template literals 變數展開）
 *  - 結尾加 boundary、避免 `/api/family/kids` 被 `/api/family/kids-extra` 命中
 *  - 不接 word/-/_/digit 字元（即「path segment 結束」）
 */
function buildMatchRegex(rawPath: string): RegExp {
  const parts = rawPath.split("/").map((seg) => {
    if (seg.startsWith(":")) return "[\\w$\\{\\}.\\-]+"
    return escapeRegex(seg)
  })
  const body = parts.join("/")
  // 後面不接 path char（避免 `/api/family/kids` 被 `/api/family/kids-stats` 吞）
  const re = body + "(?![A-Za-z0-9_/-])"
  return new RegExp(re)
}

/** 從註解 + 程式碼分類（用最近的 ============= 區塊註解） */
function detectSections(src: string): { line: number; label: string }[] {
  const sections: { line: number; label: string }[] = []
  const lines = src.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    if (ln.includes("============")) {
      // 下一非空、非分隔的註解列為 section title
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const next = lines[j].trim()
        if (next.startsWith("//") && !next.includes("====")) {
          sections.push({ line: i, label: next.replace(/^\/+\s*/, "").trim() })
          break
        }
      }
    }
  }
  return sections
}

function categoryFor(lineNum: number, sections: { line: number; label: string }[]): string {
  let cur = "(未分區)"
  for (const s of sections) {
    if (s.line <= lineNum) cur = s.label
    else break
  }
  return cur
}

function parseRoutes(src: string): Endpoint[] {
  const eps: Endpoint[] = []
  const sections = detectSections(src)
  const re = /router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g
  let match: RegExpExecArray | null
  while ((match = re.exec(src)) !== null) {
    const method = match[1].toUpperCase()
    const rawPath = match[2]
    if (!rawPath.startsWith("/api/")) continue
    const lineNum = src.slice(0, match.index).split("\n").length
    // 找上方 5 行內的 // 註解作為 comment
    const above = src.slice(0, match.index).split("\n").slice(-6).join("\n")
    const commentMatch = above.match(/\/\/\s*([^\n]+)$|\*\s*([^\n]+)$/)
    const comment = commentMatch?.[1]?.trim() || commentMatch?.[2]?.trim() || null
    eps.push({
      method,
      rawPath,
      pattern: staticPrefix(rawPath),
      matchRegex: buildMatchRegex(rawPath),
      comment,
      category: categoryFor(lineNum, sections),
      references: 0,
      matchedFiles: [],
    })
  }
  return eps
}

function countRefs(endpoints: Endpoint[], files: string[]): void {
  // 依 pattern 長度由長至短排序、避免短的 pattern 吃掉所有引用
  // 但實際上每個 endpoint 都要單獨計、不互斥。
  // 因此對每個 file 內容掃所有 endpoint。
  for (const f of files) {
    let text: string
    try {
      text = readFileSync(f, "utf8")
    } catch {
      continue
    }
    for (const ep of endpoints) {
      if (ep.matchRegex.test(text)) {
        ep.references++
        if (ep.matchedFiles.length < 3) ep.matchedFiles.push(f)
      }
    }
  }
}

function md(endpoints: Endpoint[]): string {
  const total = endpoints.length
  const used = endpoints.filter((e) => e.references > 0).length
  const unused = total - used

  const byCategory = new Map<string, Endpoint[]>()
  for (const ep of endpoints) {
    if (!byCategory.has(ep.category)) byCategory.set(ep.category, [])
    byCategory.get(ep.category)!.push(ep)
  }

  const lines: string[] = []
  lines.push("# Family-Kids Endpoints 使用率報告")
  lines.push("")
  lines.push(`> 生成時間：${new Date().toISOString()}`)
  lines.push(`> 來源：\`${ROUTES_FILE}\``)
  lines.push(`> 引用掃描：\`${CLIENT_DIRS.join("`, `")}\``)
  lines.push("")
  lines.push("## 統計")
  lines.push("")
  lines.push(`- 總 endpoints：**${total}**`)
  lines.push(`- 🟢 有被前端引用：**${used}**（${Math.round((used / total) * 100)}%）`)
  lines.push(`- 🔴 完全沒被引用：**${unused}**（${Math.round((unused / total) * 100)}%）`)
  lines.push("")
  lines.push("## 判定方式")
  lines.push("")
  lines.push(
    "- 把 raw path 轉成 regex：`:param` → `[\\w${}.-]+`（容納 template literals 變數展開）"
  )
  lines.push(
    "- 結尾加 boundary `(?![A-Za-z0-9_/-])` 避免 `/api/family/kids` 被 `/api/family/kids-stats` 吞掉"
  )
  lines.push("- 在 `client/src/` 與 `shared/` 全文 regex 搜索")
  lines.push("- 命中 = `references >= 1`")
  lines.push("- ⚠️ 可能誤判：")
  lines.push("  - 動態完全拼湊 URL（如 `apiPath = '/api/' + 'family/' + xxx`）會漏掉")
  lines.push("  - 註解中提到的 endpoint 也算引用（自我提及）")
  lines.push("- 偏向「保守保留」、不會誤刪正在用的")
  lines.push("")
  lines.push("## 各區塊明細")
  lines.push("")
  const sortedCats = Array.from(byCategory.keys()).sort()
  for (const cat of sortedCats) {
    const list = byCategory.get(cat)!
    const catUnused = list.filter((e) => e.references === 0).length
    lines.push(`### ${cat}`)
    lines.push("")
    lines.push(`> ${list.length} 個 · ${catUnused} 沒被引用`)
    lines.push("")
    lines.push("| 狀態 | Method | Path | Refs | 說明 |")
    lines.push("|------|--------|------|------|------|")
    for (const ep of list) {
      const status = ep.references === 0 ? "🔴" : ep.references === 1 ? "🟡" : "🟢"
      lines.push(
        `| ${status} | ${ep.method} | \`${ep.rawPath}\` | ${ep.references} | ${ep.comment ?? "—"} |`
      )
    }
    lines.push("")
  }
  lines.push("---")
  lines.push("")
  lines.push("## 後續處理建議")
  lines.push("")
  lines.push("1. **🔴 0 refs**：")
  lines.push(
    "   - 第一步：手動 search routes file 看是否被同 router 內呼叫（getter 用於其他 endpoint）"
  )
  lines.push("   - 第二步：確認是否為 admin 端點 / cron 觸發 / webhook 接收")
  lines.push("   - 第三步：以上皆否、寫 ADR + 移到 `archive/` 區塊 or 直接刪")
  lines.push("2. **🟡 1 ref**：可能正在用、不動")
  lines.push("3. **🟢 2+ refs**：核心 endpoint、保留")
  lines.push("")
  lines.push("**重要：本報告僅供評估、不執行任何刪除動作。**")
  return lines.join("\n")
}

function main(): void {
  const src = readFileSync(ROUTES_FILE, "utf8")
  const endpoints = parseRoutes(src)
  process.stderr.write(`→ 解析 ${endpoints.length} 個 endpoints\n`)

  const files: string[] = []
  for (const dir of CLIENT_DIRS) {
    files.push(...readAllFiles(dir, [".ts", ".tsx"]))
  }
  process.stderr.write(`→ 掃描 ${files.length} 個檔案\n`)

  countRefs(endpoints, files)
  process.stdout.write(md(endpoints) + "\n")
}

main()
