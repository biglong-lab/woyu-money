import { pool } from '../server/db';
import * as fs from 'fs';

// camelCase 轉 snake_case
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// JSON 欄位名 → 資料庫欄位名的特殊對應
const columnOverrides: Record<string, Record<string, string>> = {
  payment_records: { item_id: 'payment_item_id' },
};

async function importTable(tableName: string, rows: any[]) {
  if (!rows || rows.length === 0) {
    console.log(`⊘ ${tableName}: 無資料，跳過`);
    return;
  }

  const client = await pool.connect();
  let inserted = 0;
  let errors = 0;

  try {
    await client.query('BEGIN');

    const columns = Object.keys(rows[0]);
    const overrides = columnOverrides[tableName] || {};
    const columnNames = columns.map(c => {
      const snake = toSnakeCase(c);
      return `"${overrides[snake] || snake}"`;
    }).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    for (const row of rows) {
      const params = columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return null;
        // JSON 物件/陣列轉為字串
        if (typeof val === 'object' && !(val instanceof Date)) {
          return JSON.stringify(val);
        }
        return val;
      });

      try {
        await client.query(`SAVEPOINT sp`);
        await client.query(
          `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          params
        );
        await client.query(`RELEASE SAVEPOINT sp`);
        inserted++;
      } catch (err: any) {
        await client.query(`ROLLBACK TO SAVEPOINT sp`);
        errors++;
        if (errors <= 3) {
          console.error(`  ⚠ ${tableName} 錯誤 (id=${row.id}):`, err.message.slice(0, 120));
        }
      }
    }

    await client.query('COMMIT');

    // 重設 serial sequence
    try {
      const maxId = rows.reduce((max: number, r: any) => (r.id > max ? r.id : max), 0);
      if (maxId > 0) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), $1, true)`,
          [maxId]
        );
      }
    } catch {
      // 某些表可能沒有 serial id
    }

    const status = errors > 0 ? `⚠ ${tableName}: ${inserted}/${rows.length} 筆（${errors} 筆失敗）` : `✓ ${tableName}: ${inserted}/${rows.length} 筆已匯入`;
    console.log(status);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error(`✗ ${tableName}: 整體失敗 -`, error.message);
  } finally {
    client.release();
  }
}

async function importDatabase() {
  console.log('開始匯入資料庫...\n');

  const data = JSON.parse(
    fs.readFileSync('./database_backup/database_export.json', 'utf-8')
  );

  // 匯入順序：依賴關係由上而下
  const tableOrder = [
    'users',
    'payment_projects',
    'fixed_categories',
    'debt_categories',
    'payment_items',
    'payment_records',
    'document_inbox',
    'household_budgets',
    'household_expenses',
    'rental_contracts',
    'rental_price_tiers',
    'budget_plans',
    'budget_items',
    'invoice_records',
  ];

  for (const tableName of tableOrder) {
    await importTable(tableName, data[tableName]);
  }

  console.log('\n匯入完成！');
  await pool.end();
  process.exit(0);
}

importDatabase().catch((err) => {
  console.error('匯入失敗:', err);
  process.exit(1);
});
