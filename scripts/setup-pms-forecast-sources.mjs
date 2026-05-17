/**
 * 設定 PMS forecast 6 家館的 income_sources（source_type='pms_forecast'）
 *
 * 用途：PMS 系統（https://pms.homi.cc）每日推送「未來預訂快照」
 * 對接：POST /api/forecast/webhook/:sourceKey
 *       Authorization: Bearer <token>
 *       Payload: { snapshotDate, companyId, targetMonth, bookedRevenue }
 */
import crypto from "node:crypto"
import pg from "pg"

const PROD_URL = "https://money.homi.cc"

const HOTELS = [
  { pmCompanyId: 1, name: "浯島文旅", sourceKey: "pms-wdwl-forecast" },
  { pmCompanyId: 2, name: "浯島輕旅", sourceKey: "pms-wdql-forecast" },
  { pmCompanyId: 3, name: "小六路厝", sourceKey: "pms-xllc-forecast" },
  { pmCompanyId: 4, name: "總兵招待所", sourceKey: "pms-zbzds-forecast" },
  { pmCompanyId: 5, name: "魁星背包棧", sourceKey: "pms-kxbbz-forecast" },
  { pmCompanyId: 6, name: "大號文創", sourceKey: "pms-dhwc-forecast" },
]

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query("BEGIN")
    const report = []

    for (const h of HOTELS) {
      const exist = await client.query(
        "SELECT id, api_token FROM income_sources WHERE source_key = $1",
        [h.sourceKey]
      )

      if (exist.rows.length > 0) {
        report.push({ ...h, status: "已存在", tokenFull: null })
      } else {
        const token = crypto.randomBytes(32).toString("hex")
        const ins = await client.query(
          `INSERT INTO income_sources (
            source_key, source_name, source_type,
            description, api_token, auth_type,
            default_currency, field_mapping,
            is_active, auto_confirm, created_at, updated_at
          ) VALUES (
            $1, $2, 'pms_forecast',
            $3, $4, 'token',
            'TWD', '{}'::jsonb,
            true, false, NOW(), NOW()
          ) RETURNING id`,
          [
            h.sourceKey,
            `PMS未來預訂-${h.name}`,
            `PMS 系統推送 company_id=${h.pmCompanyId}（${h.name}）的未來預訂快照`,
            token,
          ]
        )
        report.push({ ...h, status: "新建", sourceId: ins.rows[0].id, tokenFull: token })
        console.log(`✓ 新建 ${h.name} (${h.sourceKey}) id=${ins.rows[0].id}`)
      }
    }

    await client.query("COMMIT")

    console.log("\n" + "═".repeat(80))
    console.log("🏨  PMS Forecast 6 家館對接清單（請保存 token，只顯示一次）")
    console.log("═".repeat(80))
    for (const r of report) {
      console.log(`\n[${r.pmCompanyId}] ${r.name}`)
      console.log(`  狀態:        ${r.status}`)
      console.log(`  sourceKey:   ${r.sourceKey}`)
      console.log(`  Webhook URL: ${PROD_URL}/api/forecast/webhook/${r.sourceKey}`)
      console.log(
        `  Token:       ${r.tokenFull ?? "（已存在、不重置；如需查看請從 /integrations 重置）"}`
      )
    }

    console.log("\n" + "═".repeat(80))
    console.log("📋 PMS 對接端 SDK 範例")
    console.log("═".repeat(80))
    console.log(`
// PMS 系統每天輸入新預訂時、push 給 Money
const WOYU_FORECAST_ROUTES = {
  1: { url: '${PROD_URL}/api/forecast/webhook/pms-wdwl-forecast',  token: '<token-1>' },
  2: { url: '${PROD_URL}/api/forecast/webhook/pms-wdql-forecast',  token: '<token-2>' },
  3: { url: '${PROD_URL}/api/forecast/webhook/pms-xllc-forecast',  token: '<token-3>' },
  4: { url: '${PROD_URL}/api/forecast/webhook/pms-zbzds-forecast', token: '<token-4>' },
  5: { url: '${PROD_URL}/api/forecast/webhook/pms-kxbbz-forecast', token: '<token-5>' },
  6: { url: '${PROD_URL}/api/forecast/webhook/pms-dhwc-forecast',  token: '<token-6>' },
}

async function pushForecastSnapshot({ companyId, targetMonth, bookedRevenue }) {
  const route = WOYU_FORECAST_ROUTES[companyId]
  if (!route) return
  await fetch(route.url, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${route.token}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snapshotDate: new Date().toISOString().slice(0, 10),  // YYYY-MM-DD
      companyId,
      targetMonth,                                          // YYYY-MM
      bookedRevenue,                                        // 未來預訂累積金額
    }),
  })
}

// 推送時機：使用者每次在 PMS 輸入本月/下月/下下月預定時
// 對每個受影響月份各推一筆
await pushForecastSnapshot({ companyId: 1, targetMonth: '2026-05', bookedRevenue: 280000 })
await pushForecastSnapshot({ companyId: 1, targetMonth: '2026-06', bookedRevenue: 450000 })
await pushForecastSnapshot({ companyId: 1, targetMonth: '2026-07', bookedRevenue: 120000 })
`)
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("❌ 失敗:", err)
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
