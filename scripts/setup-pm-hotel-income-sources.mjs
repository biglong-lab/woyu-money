/**
 * 一次性設定 PM 系統 6 家館的 income_sources（收入端）+ 修補 pm-bridge 重疊
 *
 * 對稱於 setup-pm-hotel-sources.mjs（支出端）：
 *  - wdhotelin (id=4) 浯島文旅 已存在
 *  - 新建 pm-wdql-in / pm-xllc-in / pm-zbzds-in / pm-kxbbz-in / pm-dhwc-in
 *
 * 同時修補 pm-bridge (id=2) 重疊：
 *  - 浯島文旅 1547 筆 → status='rejected' (與 wdhotelin 完全重複)
 *  - 浯島輕旅 2344 筆 → 遷移 source_id 到 pm-wdql-in
 *  - 大號文創 1 筆 → 遷移 source_id 到 pm-dhwc-in
 *  - 標記 pm-bridge is_active=false
 *
 * 使用：docker exec woyu-money node /app/<scriptName>
 */
import crypto from "node:crypto"
import pg from "pg"

const PROD_URL = "https://money.homi.cc"

const HOTELS = [
  { pmCompanyId: 1, name: "浯島文旅", sourceKey: "wdhotelin", projectId: 3, isExisting: true },
  { pmCompanyId: 2, name: "浯島輕旅", sourceKey: "pm-wdql-in", projectId: 4 },
  { pmCompanyId: 3, name: "小六路厝", sourceKey: "pm-xllc-in", projectId: 9 },
  { pmCompanyId: 4, name: "總兵招待所", sourceKey: "pm-zbzds-in", projectId: 10 },
  { pmCompanyId: 5, name: "魁星背包棧", sourceKey: "pm-kxbbz-in", projectId: 20 },
  { pmCompanyId: 6, name: "大號文創", sourceKey: "pm-dhwc-in", projectId: 26 },
]

const FIELD_MAPPING = {
  amount: "$.amount",
  currency: "$.currency",
  transactionId: "$.transactionId",
  paidAt: "$.paidAt",
  description: "$.description",
  payerName: "$.payerName",
  channel: "$.channel",
  externalReference: "$.externalReference",
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // 1. 建 5 個新 income_sources（含 token）
    const report = []
    const hotelSourceIds = {}
    for (const hotel of HOTELS) {
      const exist = await client.query(
        "SELECT id, api_token FROM income_sources WHERE source_key = $1",
        [hotel.sourceKey]
      )
      if (exist.rows.length > 0) {
        hotelSourceIds[hotel.name] = exist.rows[0].id
        report.push({
          ...hotel,
          status: "已存在",
          sourceId: exist.rows[0].id,
          tokenFull: null,
        })
        if (hotel.isExisting) {
          await client.query(
            `UPDATE income_sources SET source_type = 'pm_income', updated_at = NOW() WHERE id = $1`,
            [exist.rows[0].id]
          )
        }
      } else {
        const token = crypto.randomBytes(32).toString("hex")
        const ins = await client.query(
          `INSERT INTO income_sources (
            source_key, source_name, source_type,
            description, api_token, auth_type,
            default_currency, field_mapping,
            is_active, auto_confirm, created_at, updated_at
          ) VALUES (
            $1, $2, 'pm_income',
            $3, $4, 'token',
            'TWD', $5::jsonb,
            true, false, NOW(), NOW()
          ) RETURNING id`,
          [
            hotel.sourceKey,
            `PM系統-日收入-${hotel.name}`,
            `PM 系統 company_id=${hotel.pmCompanyId}（${hotel.name}）的日收入推送`,
            token,
            JSON.stringify(FIELD_MAPPING),
          ]
        )
        hotelSourceIds[hotel.name] = ins.rows[0].id
        report.push({
          ...hotel,
          status: "新建",
          sourceId: ins.rows[0].id,
          tokenFull: token,
        })
        console.log(`✓ 新建收入 source ${hotel.name} (${hotel.sourceKey}) id=${ins.rows[0].id}`)
      }
    }

    // 2. 修補 pm-bridge (source_id=2) 的重疊
    // 2a. 浯島文旅 1547 筆 → rejected
    const rejectWdhotel = await client.query(
      `UPDATE income_webhooks
       SET status = 'rejected',
           review_note = '與 wdhotelin source 完全重複（PM 推兩遍）',
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE source_id = 2
         AND status = 'pending'
         AND parsed_description LIKE '浯島文旅%'
       RETURNING id`
    )
    console.log(`✓ pm-bridge 浯島文旅 ${rejectWdhotel.rows.length} 筆標 rejected（重複資料）`)

    // 2b. 浯島輕旅 2344 筆 → 遷移到 pm-wdql-in
    const migrateQinglv = await client.query(
      `UPDATE income_webhooks
       SET source_id = $1, updated_at = NOW()
       WHERE source_id = 2
         AND parsed_description LIKE '浯島輕旅%'
       RETURNING id`,
      [hotelSourceIds["浯島輕旅"]]
    )
    console.log(`✓ pm-bridge 浯島輕旅 ${migrateQinglv.rows.length} 筆遷移到 pm-wdql-in`)

    // 2c. 大號文創 1 筆 → 遷移到 pm-dhwc-in
    const migrateDahao = await client.query(
      `UPDATE income_webhooks
       SET source_id = $1, updated_at = NOW()
       WHERE source_id = 2
         AND parsed_description LIKE '大號文創%'
       RETURNING id`,
      [hotelSourceIds["大號文創"]]
    )
    console.log(`✓ pm-bridge 大號文創 ${migrateDahao.rows.length} 筆遷移到 pm-dhwc-in`)

    // 2d. 停用 pm-bridge
    await client.query(
      `UPDATE income_sources SET is_active = false, updated_at = NOW() WHERE source_key = 'pm-bridge'`
    )
    console.log(`✓ 停用 pm-bridge source`)

    // 2e. 重算 total_received（依現有 webhook 重算各 source 統計）
    await client.query(`
      UPDATE income_sources s
      SET total_received = sub.cnt
      FROM (SELECT source_id, COUNT(*) AS cnt FROM income_webhooks GROUP BY source_id) sub
      WHERE s.id = sub.source_id
    `)
    console.log(`✓ 重算各 source total_received`)

    await client.query("COMMIT")

    // 3. 印對接清單
    console.log("\n" + "═".repeat(80))
    console.log("🏨  PM 收入端 6 家館對接清單")
    console.log("═".repeat(80))
    for (const r of report) {
      console.log(`\n[${r.pmCompanyId}] ${r.name}`)
      console.log(`  狀態:        ${r.status}`)
      console.log(`  sourceKey:   ${r.sourceKey}`)
      console.log(`  Money 專案:  #${r.projectId}`)
      console.log(`  Webhook URL: ${PROD_URL}/api/income/webhook/${r.sourceKey}`)
      console.log(
        `  Token:       ${r.tokenFull ?? "（沿用既有，可在 /integrations 重置）"}`
      )
    }
    console.log("\n═".repeat(80))
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
