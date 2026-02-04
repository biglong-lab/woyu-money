import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

interface MySQLInsert {
  table: string;
  columns: string[];
  values: (string | number | null)[][];
}

export class SQLConverter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async parseAndExecuteSQL(sqlFilePath: string): Promise<void> {
    console.log('開始解析 SQL 檔案...');
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
    const statements = this.extractInsertStatements(sqlContent);
    
    console.log(`找到 ${statements.length} 個 INSERT 語句`);

    // 建立資料庫表格
    await this.createTables();

    // 執行插入語句
    for (const statement of statements) {
      await this.executeInsert(statement);
    }

    console.log('資料遷移完成！');
  }

  private extractInsertStatements(sqlContent: string): MySQLInsert[] {
    const statements: MySQLInsert[] = [];
    
    // 正則表達式匹配 INSERT INTO 語句
    const insertRegex = /INSERT INTO `([^`]+)` \(([^)]+)\) VALUES\s+(.*?);/gs;
    let match;

    while ((match = insertRegex.exec(sqlContent)) !== null) {
      const tableName = match[1];
      const columnsStr = match[2];
      const valuesStr = match[3];

      // 解析欄位名稱
      const columns = columnsStr.split(',').map(col => 
        col.trim().replace(/`/g, '').replace(/'/g, '')
      );

      // 解析數值
      const values = this.parseValues(valuesStr);

      statements.push({
        table: tableName,
        columns,
        values
      });
    }

    return statements;
  }

  private parseValues(valuesStr: string): (string | number | null)[][] {
    const results: (string | number | null)[][] = [];
    
    // 分割多個 VALUES
    const valueGroups = valuesStr.split(/\),\s*\(/);
    
    for (let i = 0; i < valueGroups.length; i++) {
      let group = valueGroups[i];
      
      // 清理括號
      group = group.replace(/^\(/, '').replace(/\)$/, '');
      
      // 解析單個值組
      const values = this.parseValueGroup(group);
      results.push(values);
    }

    return results;
  }

  private parseValueGroup(group: string): (string | number | null)[] {
    const values: (string | number | null)[] = [];
    const parts = group.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      
      if (trimmed === 'NULL') {
        values.push(null);
      } else if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        // 字串值
        values.push(trimmed.slice(1, -1).replace(/\\'/g, "'"));
      } else if (!isNaN(Number(trimmed))) {
        // 數字值
        values.push(Number(trimmed));
      } else {
        values.push(trimmed);
      }
    }

    return values;
  }

  private async createTables(): Promise<void> {
    const queries = [
      `CREATE TABLE IF NOT EXISTS debt_categories (
        id SERIAL PRIMARY KEY,
        category_name VARCHAR(255) NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        vendor_name VARCHAR(255) NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS debts (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES debt_categories(id),
        debt_name VARCHAR(255) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        vendor_id INTEGER REFERENCES vendors(id),
        note TEXT,
        expected_payment_date DATE,
        installments INTEGER DEFAULT 1,
        payment_type VARCHAR(20) NOT NULL DEFAULT 'single',
        first_due_date DATE NOT NULL,
        paid_amount DECIMAL(10,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'pending',
        is_deleted BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS debt_payments (
        id SERIAL PRIMARY KEY,
        debt_id INTEGER NOT NULL REFERENCES debts(id),
        amount_paid DECIMAL(10,2) NOT NULL,
        payment_date DATE NOT NULL,
        receipt_file VARCHAR(255),
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS debts_schedule (
        id SERIAL PRIMARY KEY,
        debt_id INTEGER NOT NULL REFERENCES debts(id),
        installment_number INTEGER NOT NULL,
        due_date DATE NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        is_paid BOOLEAN DEFAULT FALSE,
        paid_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS daily_records_clean (
        id SERIAL PRIMARY KEY,
        record_date DATE NOT NULL,
        branch_id INTEGER NOT NULL,
        room_number VARCHAR(50),
        platform VARCHAR(255),
        invoice_last4 VARCHAR(4),
        source_type VARCHAR(50),
        source_id VARCHAR(50),
        price DECIMAL(10,2),
        payment_method VARCHAR(50),
        record_type VARCHAR(20) DEFAULT 'income',
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const query of queries) {
      try {
        await this.pool.query(query);
        console.log('表格建立成功');
      } catch (error) {
        console.error('建立表格失敗:', error);
      }
    }
  }

  private async executeInsert(statement: MySQLInsert): Promise<void> {
    if (statement.values.length === 0) return;

    const tableName = this.mapTableName(statement.table);
    const columns = statement.columns.map(col => this.mapColumnName(col));
    
    console.log(`插入資料到表格: ${tableName}, 記錄數: ${statement.values.length}`);

    for (const valueRow of statement.values) {
      try {
        const placeholders = valueRow.map((_, index) => `$${index + 1}`).join(', ');
        const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        
        await this.pool.query(query, valueRow);
      } catch (error) {
        console.error(`插入資料失敗 (表格: ${tableName}):`, error);
        console.error('資料:', valueRow);
      }
    }
  }

  private mapTableName(mysqlTable: string): string {
    // 表格名稱對應
    const mapping: { [key: string]: string } = {
      'debt_categories': 'debt_categories',
      'vendors': 'vendors', 
      'debts': 'debts',
      'debt_payments': 'debt_payments',
      'debts_schedule': 'debts_schedule',
      'daily_records_clean': 'daily_records_clean'
    };
    
    return mapping[mysqlTable] || mysqlTable;
  }

  private mapColumnName(mysqlColumn: string): string {
    // 欄位名稱對應 (MySQL -> PostgreSQL)
    const mapping: { [key: string]: string } = {
      'category_name': 'category_name',
      'vendor_name': 'vendor_name',
      'debt_name': 'debt_name',
      'total_amount': 'total_amount',
      'vendor_id': 'vendor_id',
      'category_id': 'category_id',
      'note': 'note',
      'expected_payment_date': 'expected_payment_date',
      'installments': 'installments',
      'payment_type': 'payment_type',
      'first_due_date': 'first_due_date',
      'paid_amount': 'paid_amount',
      'status': 'status',
      'is_deleted': 'is_deleted',
      'deleted_at': 'deleted_at',
      'created_at': 'created_at',
      'updated_at': 'updated_at'
    };
    
    return mapping[mysqlColumn] || mysqlColumn;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}