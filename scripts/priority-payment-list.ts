#!/usr/bin/env tsx
/**
 * 優先付款清單 CLI
 *
 * 目的：今日止血工具。從資料庫讀取所有未付款項目，依「違約後果 + 滯納金」排序，
 *       輸出 Markdown 讓使用者一眼知道「該先付哪幾筆」。
 *
 * 使用：
 *   npx tsx scripts/priority-payment-list.ts [options]
 *
 * Options:
 *   --budget <amount>   設定可動用金額（會計算缺口/餘額）
 *   --output <file>     輸出到檔案（預設 stdout）
 *   --all               顯示所有未付款（預設只顯示 critical / high / medium）
 *   --help              顯示說明
 *
 * 範例：
 *   npx tsx scripts/priority-payment-list.ts
 *   npx tsx scripts/priority-payment-list.ts --budget 300000
 *   npx tsx scripts/priority-payment-list.ts --output reports/priority-$(date +%Y%m%d).md
 */

import "dotenv/config"
import { writeFileSync } from "fs"
import pg from "pg"
import {
  sortByPriority,
  formatPriorityMarkdown,
  type PriorityInput,
  type UrgencyLevel,
} from "../shared/payment-priority.js"

const { Pool } = pg

// ─────────────────────────────────────────────
// CLI 參數解析
// ─────────────────────────────────────────────

interface CliOptions {
  budget?: number
  output?: string
  all: boolean
  help: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { all: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") {
      options.help = true
    } else if (arg === "--all") {
      options.all = true
    } else if (arg === "--budget" && argv[i + 1]) {
      const n = Number(argv[++i])
      if (Number.isFinite(n) && n >= 0) options.budget = n
    } else if (arg === "--output" && argv[i + 1]) {
      options.output = argv[++i]
    }
  }
  return options
}

function showHelp(): void {
  const help = `
優先付款清單 CLI

使用：
  npx tsx scripts/priority-payment-list.ts [options]

Options:
  --budget <amount>   設定可動用金額（會計算缺口/餘額）
  --output <file>     輸出到檔案（預設 stdout）
  --all               顯示所有未付款（預設只顯示 critical / high / medium）
  --help, -h          顯示說明

範例：
  npx tsx scripts/priority-payment-list.ts
  npx tsx scripts/priority-payment-list.ts --budget 300000
  npx tsx scripts/priority-payment-list.ts --output reports/priority.md
`
  process.stdout.write(help)
}

// ─────────────────────────────────────────────
// DB 查詢
// ─────────────────────────────────────────────

interface DbRow {
  id: number
  itemName: string
  totalAmount: string | number
  paidAmount: string | number
  dueDate: string
  fixedCategoryName: string | null
  debtCategoryName: string | null
  projectName: string | null
  notes: string | null
}

async function fetchUnpaidItems(pool: pg.Pool): Promise<PriorityInput[]> {
  // 只抓未刪除、未付清的 payment_items
  // dueDate 取「最近未完成的 schedule」或 fallback 到 start_date
  const sql = `
    SELECT
      pi.id,
      pi.item_name AS "itemName",
      pi.total_amount AS "totalAmount",
      COALESCE(pi.paid_amount, 0) AS "paidAmount",
      COALESCE(
        (
          SELECT ps.scheduled_date::text
          FROM payment_schedules ps
          WHERE ps.payment_item_id = pi.id
            AND ps.status != 'completed'
          ORDER BY ps.scheduled_date ASC
          LIMIT 1
        ),
        pi.start_date::text
      ) AS "dueDate",
      fc.category_name AS "fixedCategoryName",
      dc.category_name AS "debtCategoryName",
      pp.project_name AS "projectName",
      pi.notes
    FROM payment_items pi
    LEFT JOIN fixed_categories fc ON pi.fixed_category_id = fc.id
    LEFT JOIN debt_categories dc ON pi.category_id = dc.id
    LEFT JOIN payment_projects pp ON pi.project_id = pp.id
    WHERE pi.is_deleted = false
      AND COALESCE(pi.status, 'pending') != 'paid'
      AND (pi.total_amount::numeric - COALESCE(pi.paid_amount, 0)::numeric) > 0
    ORDER BY pi.id
  `
  const result = await pool.query<DbRow>(sql)
  return result.rows.map((row) => ({
    id: row.id,
    itemName: row.itemName,
    totalAmount: Number(row.totalAmount),
    paidAmount: Number(row.paidAmount),
    dueDate: row.dueDate,
    fixedCategoryName: row.fixedCategoryName,
    debtCategoryName: row.debtCategoryName,
    projectName: row.projectName,
    notes: row.notes,
  }))
}

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────

const SHOW_URGENCY: UrgencyLevel[] = ["critical", "high", "medium"]

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    showHelp()
    return
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    process.stderr.write("❌ 請設定 DATABASE_URL 環境變數（.env）\n")
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 10000,
  })

  try {
    process.stderr.write("🔍 查詢未付款項目...\n")
    const items = await fetchUnpaidItems(pool)
    process.stderr.write(`📦 共 ${items.length} 筆未付款項目\n`)

    const today = new Date()
    const results = sortByPriority(items, today)

    const filtered = options.all ? results : results.filter((r) => SHOW_URGENCY.includes(r.urgency))

    const markdown = formatPriorityMarkdown(filtered, {
      now: today,
      totalBudget: options.budget,
      title: options.all ? "🎯 全部未付款清單" : "🎯 優先付款清單（本週焦點）",
    })

    if (options.output) {
      writeFileSync(options.output, markdown, "utf8")
      process.stderr.write(`✅ 已輸出至 ${options.output}\n`)
    } else {
      process.stdout.write(markdown + "\n")
    }
  } finally {
    await pool.end()
  }
}

run().catch((err: Error) => {
  process.stderr.write(`❌ 執行失敗：${err.message}\n`)
  if (err.stack) process.stderr.write(err.stack + "\n")
  process.exit(1)
})
