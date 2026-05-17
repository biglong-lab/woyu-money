/**
 * 一次性設定 PM 系統 6 家館的 expense_sources
 *
 * 使用方式（在生產跑、不寫入 git）：
 *   docker exec woyu-money node scripts/setup-pm-hotel-sources.mjs
 *
 * 行為：
 *  1. 為「大號文創」建立 payment_project（type=business）— 若不存在
 *  2. 更新「浯島文旅」expense_source default_project_id = 3、sourceType = pm_expense
 *  3. 為其他 5 家館建立 expense_source（含 32-byte 隨機 token）— 若不存在
 *  4. 印出 6 家館的對接清單（URL + Token + Project）給管理員保存
 *
 * 可重複執行（INSERT 用 ON CONFLICT DO NOTHING、UPDATE 條件式）
 */
import crypto from "node:crypto"
import pg from "pg"

const PROD_URL = "https://money.homi.cc"

// 6 家館定義（含使用者選定的 sourceKey 與對應 Money project）
const HOTELS = [
  {
    pmCompanyId: 1,
    name: "浯島文旅",
    sourceKey: "wdhotelpay",
    projectId: 3,
    isExisting: true, // 已存在、只補 default_project_id
  },
  { pmCompanyId: 2, name: "浯島輕旅", sourceKey: "pm-wdql", projectId: 4 },
  { pmCompanyId: 3, name: "小六路厝", sourceKey: "pm-xllc", projectId: 9 },
  { pmCompanyId: 4, name: "總兵招待所", sourceKey: "pm-zbzds", projectId: 10 },
  { pmCompanyId: 5, name: "魁星背包棧", sourceKey: "pm-kxbbz", projectId: 20 },
  {
    pmCompanyId: 6,
    name: "大號文創",
    sourceKey: "pm-dhwc",
    projectId: null, // 需建 project
  },
]

// 從浯島文旅 source 1 沿用的 field_mapping（PM 統一 payload 格式）
const FIELD_MAPPING = {
  amount: "$.amount",
  currency: "$.currency",
  transactionId: "$.transactionId",
  paidAt: "$.paidAt",
  dueAt: "$.dueAt",
  description: "$.description",
  vendor: "$.vendor",
  invoiceNumber: "$.orderId",
  categoryHint: "$.categoryHint",
  tags: "$.tags",
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL 未設定")
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // 1. 大號文創 project（若不存在）
    const dahao = HOTELS.find((h) => h.name === "大號文創")
    if (dahao && !dahao.projectId) {
      const exist = await client.query(
        "SELECT id FROM payment_projects WHERE project_name = $1 AND is_active = true LIMIT 1",
        ["大號文創"]
      )
      if (exist.rows.length > 0) {
        dahao.projectId = exist.rows[0].id
        console.log(`✓ 大號文創 project 已存在 (id=${dahao.projectId})`)
      } else {
        const ins = await client.query(
          `INSERT INTO payment_projects (project_name, project_type, is_active, created_at, updated_at)
           VALUES ($1, 'business', true, NOW(), NOW())
           RETURNING id`,
          ["大號文創"]
        )
        dahao.projectId = ins.rows[0].id
        console.log(`✓ 新建大號文創 project (id=${dahao.projectId})`)
      }
    }

    // 2. 處理每家館
    const report = []
    for (const hotel of HOTELS) {
      const existing = await client.query(
        "SELECT id, api_token, default_project_id FROM expense_sources WHERE source_key = $1",
        [hotel.sourceKey]
      )

      if (existing.rows.length > 0) {
        // 已存在 → 補欄位（不重置 token）
        const row = existing.rows[0]
        const needsUpdate =
          row.default_project_id !== hotel.projectId || hotel.isExisting

        if (needsUpdate) {
          await client.query(
            `UPDATE expense_sources
             SET default_project_id = COALESCE(default_project_id, $1),
                 source_type = 'pm_expense',
                 updated_at = NOW()
             WHERE id = $2`,
            [hotel.projectId, row.id]
          )
          console.log(`✓ 更新 ${hotel.name} (${hotel.sourceKey}) default_project_id`)
        }

        report.push({
          ...hotel,
          status: "已存在",
          tokenMasked: row.api_token
            ? `****${row.api_token.slice(-8)}`
            : "(未設定)",
          tokenFull: null, // 不公開既有 token
        })
      } else {
        // 不存在 → 新增（含 token）
        const token = crypto.randomBytes(32).toString("hex")
        const ins = await client.query(
          `INSERT INTO expense_sources (
            source_key, source_name, source_type,
            description, api_token, auth_type, webhook_mode,
            default_project_id, default_tags, field_mapping,
            is_active, auto_confirm, created_at, updated_at
          ) VALUES (
            $1, $2, 'pm_expense',
            $3, $4, 'token', 'as_pending',
            $5, '[]'::jsonb, $6::jsonb,
            true, false, NOW(), NOW()
          ) RETURNING id`,
          [
            hotel.sourceKey,
            `PM系統-帳單-${hotel.name}`,
            `PM 系統 company_id=${hotel.pmCompanyId}（${hotel.name}）的帳單推送`,
            token,
            hotel.projectId,
            JSON.stringify(FIELD_MAPPING),
          ]
        )
        console.log(`✓ 新建 ${hotel.name} (${hotel.sourceKey}) source id=${ins.rows[0].id}`)
        report.push({
          ...hotel,
          status: "新建",
          tokenFull: token,
          tokenMasked: `****${token.slice(-8)}`,
        })
      }
    }

    await client.query("COMMIT")

    // 3. 印對接清單
    console.log("\n" + "═".repeat(80))
    console.log("🏨  PM 6 家館對接清單（請保存，token 之後在系統內可重置）")
    console.log("═".repeat(80))
    for (const r of report) {
      console.log(`\n[${r.pmCompanyId}] ${r.name}`)
      console.log(`  狀態:        ${r.status}`)
      console.log(`  sourceKey:   ${r.sourceKey}`)
      console.log(`  Money 專案:  #${r.projectId}`)
      console.log(`  Webhook URL: ${PROD_URL}/api/expense/webhook/${r.sourceKey}`)
      console.log(
        `  Token:       ${r.tokenFull ?? "（已存在、不重置；如需查看請從 /integrations 重置）"}`
      )
      console.log(`  認證 Header: Authorization: Bearer <token>`)
    }
    console.log("\n" + "═".repeat(80))
    console.log("📋 PM 開發者設定範例（PM SDK 端依 pmCompanyId 路由）：")
    console.log("═".repeat(80))
    console.log(`
const WOYU_MONEY_ROUTES = {
  1: { url: '${PROD_URL}/api/expense/webhook/wdhotelpay',  token: '<token-1>' }, // 浯島文旅
  2: { url: '${PROD_URL}/api/expense/webhook/pm-wdql',     token: '<token-2>' }, // 浯島輕旅
  3: { url: '${PROD_URL}/api/expense/webhook/pm-xllc',     token: '<token-3>' }, // 小六路厝
  4: { url: '${PROD_URL}/api/expense/webhook/pm-zbzds',    token: '<token-4>' }, // 總兵招待所
  5: { url: '${PROD_URL}/api/expense/webhook/pm-kxbbz',    token: '<token-5>' }, // 魁星背包棧
  6: { url: '${PROD_URL}/api/expense/webhook/pm-dhwc',     token: '<token-6>' }, // 大號文創
}
const route = WOYU_MONEY_ROUTES[bill.companyId]
await fetch(route.url, {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${route.token}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    transactionId: bill.id,
    amount: bill.amount,
    currency: 'TWD',
    description: bill.description,
    vendor: bill.vendor,
    dueAt: bill.dueAt,
    paidAt: bill.paidAt,
    categoryHint: bill.category,
    orderId: bill.orderId,
    pmCompanyId: bill.companyId,
    pmInvoicePhoto: bill.photoUrl, // 帳單照片 URL
  }),
})
`)
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("❌ 失敗、已 ROLLBACK:", err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
