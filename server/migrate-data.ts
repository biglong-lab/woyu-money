#!/usr/bin/env tsx
import { db } from "./db";
import { debtCategories, vendors, debts, debtPayments, debtsSchedule, dailyRecords } from "@shared/schema";
import { sql } from "drizzle-orm";

// 直接插入您的資料
const migrationData = {
  debt_categories: [
    { id: 1, category_name: "測試", is_deleted: false, created_at: "2025-05-11 18:00:00", updated_at: "2025-05-11 18:00:00" },
    { id: 2, category_name: "租金", is_deleted: false, created_at: "2025-05-11 19:09:00", updated_at: "2025-05-11 19:09:00" },
    { id: 4, category_name: "人事費用", is_deleted: false, created_at: "2025-05-13 01:17:00", updated_at: "2025-05-13 01:17:00" },
    { id: 6, category_name: "水電費", is_deleted: false, created_at: "2025-05-11 23:36:00", updated_at: "2025-05-11 23:36:00" },
    { id: 8, category_name: "洗滌費", is_deleted: false, created_at: "2025-05-12 00:49:00", updated_at: "2025-05-12 00:49:00" },
    { id: 9, category_name: "系統平台費", is_deleted: false, created_at: "2025-05-13 01:10:00", updated_at: "2025-05-13 01:10:00" },
    { id: 10, category_name: "其他", is_deleted: false, created_at: "2025-05-11 22:05:00", updated_at: "2025-05-11 22:05:00" },
    { id: 11, category_name: "OTA平台費", is_deleted: false, created_at: "2025-05-11 23:51:00", updated_at: "2025-05-11 23:51:00" }
  ],
  
  vendors: [
    { id: 1, vendor_name: "測試", is_deleted: false, created_at: "2025-05-11 18:00:00", updated_at: "2025-05-11 18:00:00" },
    { id: 2, vendor_name: "浯島文旅", is_deleted: false, created_at: "2025-05-11 19:09:00", updated_at: "2025-05-11 19:09:00" },
    { id: 3, vendor_name: "浯島輕旅", is_deleted: false, created_at: "2025-05-11 22:28:00", updated_at: "2025-05-11 22:28:00" }
  ]
};

async function migrateData() {
  console.log("開始資料遷移...");

  try {
    // 清空現有資料
    await db.execute(sql`TRUNCATE TABLE debt_payments CASCADE`);
    await db.execute(sql`TRUNCATE TABLE debts_schedule CASCADE`);
    await db.execute(sql`TRUNCATE TABLE debts CASCADE`);
    await db.execute(sql`TRUNCATE TABLE vendors CASCADE`);
    await db.execute(sql`TRUNCATE TABLE debt_categories CASCADE`);
    
    // 重置序列
    await db.execute(sql`ALTER SEQUENCE debt_categories_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE vendors_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE debts_id_seq RESTART WITH 1`);

    // 插入分類資料
    console.log("遷移分類資料...");
    for (const cat of migrationData.debt_categories) {
      await db.execute(sql`
        INSERT INTO debt_categories (id, category_name, is_deleted, created_at, updated_at) 
        VALUES (${cat.id}, ${cat.category_name}, ${cat.is_deleted}, ${cat.created_at}, ${cat.updated_at})
      `);
    }

    // 插入廠商資料
    console.log("遷移廠商資料...");
    for (const vendor of migrationData.vendors) {
      await db.execute(sql`
        INSERT INTO vendors (id, vendor_name, is_deleted, created_at, updated_at) 
        VALUES (${vendor.id}, ${vendor.vendor_name}, ${vendor.is_deleted}, ${vendor.created_at}, ${vendor.updated_at})
      `);
    }

    // 更新序列到正確的值
    await db.execute(sql`SELECT setval('debt_categories_id_seq', (SELECT MAX(id) FROM debt_categories))`);
    await db.execute(sql`SELECT setval('vendors_id_seq', (SELECT MAX(id) FROM vendors))`);

    // 插入債務資料（從您的 SQL 檔案中的資料）
    console.log("遷移債務資料...");
    const debtsData = [
      { id: 17, category_id: 2, debt_name: "2025-05-浯島文旅租金", total_amount: "200000.00", vendor_id: 2, note: "", installments: 1, payment_type: "single", first_due_date: "2025-05-31", paid_amount: "0.00", status: "pending", is_deleted: false, created_at: "2025-05-11 19:11:59", updated_at: "2025-05-11 22:04:17" },
      { id: 19, category_id: 2, debt_name: "2025-06-浯島文旅租金", total_amount: "200000.00", vendor_id: 2, note: "", installments: 1, payment_type: "single", first_due_date: "2025-06-30", paid_amount: "0.00", status: "pending", is_deleted: false, created_at: "2025-05-11 19:34:40", updated_at: "2025-05-11 22:02:35" },
      { id: 20, category_id: 2, debt_name: "2025-07-浯島文旅租金", total_amount: "200000.00", vendor_id: 2, note: "", installments: 1, payment_type: "single", first_due_date: "2025-07-31", paid_amount: "0.00", status: "pending", is_deleted: false, created_at: "2025-05-11 19:34:40", updated_at: "2025-05-11 22:03:06" },
      { id: 21, category_id: 2, debt_name: "2025-08-浯島文旅租金", total_amount: "200000.00", vendor_id: 2, note: "", installments: 1, payment_type: "single", first_due_date: "2025-08-31", paid_amount: "0.00", status: "pending", is_deleted: false, created_at: "2025-05-11 19:34:40", updated_at: "2025-05-11 22:03:28" },
      { id: 22, category_id: 2, debt_name: "2025-09-浯島文旅租金", total_amount: "200000.00", vendor_id: 2, note: "", installments: 1, payment_type: "single", first_due_date: "2025-09-30", paid_amount: "0.00", status: "pending", is_deleted: false, created_at: "2025-05-11 19:34:40", updated_at: "2025-05-11 22:03:54" },
      { id: 24, category_id: 10, debt_name: "廣告招牌", total_amount: "170000.00", vendor_id: 2, note: "", installments: 5, payment_type: "installment", first_due_date: "2025-05-31", paid_amount: "0.00", status: "pending", is_deleted: false, created_at: "2025-05-11 22:06:00", updated_at: "2025-05-11 22:06:00" },
      { id: 26, category_id: 2, debt_name: "2025-01 浯島輕旅租金", total_amount: "50000.00", vendor_id: 3, note: "", installments: 1, payment_type: "single", first_due_date: "2025-01-31", paid_amount: "0.00", status: "pending", is_deleted: false, created_at: "2025-05-11 22:29:04", updated_at: "2025-05-11 22:30:38" },
      { id: 41, category_id: 6, debt_name: "2025-05-浯島輕旅-電費-22520207100", total_amount: "8291.00", vendor_id: 3, note: "到期日：5/7", installments: 1, payment_type: "single", first_due_date: "2025-05-31", paid_amount: "0.00", status: "pending", is_deleted: false, created_at: "2025-05-11 23:37:01", updated_at: "2025-05-11 23:37:01" },
      { id: 43, category_id: 6, debt_name: "2025-04-浯島文旅電費-22760260115", total_amount: "39095.00", vendor_id: 2, note: "到期日：4/01已延期一次：5/13前一定要繳費", installments: 1, payment_type: "single", first_due_date: "2025-05-13", paid_amount: "0.00", status: "pending", is_deleted: false, created_at: "2025-05-11 23:41:25", updated_at: "2025-05-11 23:42:17" },
      { id: 44, category_id: 6, debt_name: "2025-05-浯島文旅電費-22760260115", total_amount: "35776.00", vendor_id: 2, note: "到期日：5/2", installments: 1, payment_type: "single", first_due_date: "2025-06-06", paid_amount: "0.00", status: "pending", is_deleted: false, created_at: "2025-05-11 23:43:33", updated_at: "2025-05-11 23:43:33" }
    ];

    for (const debt of debtsData) {
      await db.execute(sql`
        INSERT INTO debts (id, category_id, debt_name, total_amount, vendor_id, note, installments, payment_type, first_due_date, paid_amount, status, is_deleted, created_at, updated_at) 
        VALUES (${debt.id}, ${debt.category_id}, ${debt.debt_name}, ${debt.total_amount}, ${debt.vendor_id}, ${debt.note}, ${debt.installments}, ${debt.payment_type}, ${debt.first_due_date}, ${debt.paid_amount}, ${debt.status}, ${debt.is_deleted}, ${debt.created_at}, ${debt.updated_at})
      `);
    }

    // 更新序列
    await db.execute(sql`SELECT setval('debts_id_seq', (SELECT MAX(id) FROM debts))`);

    console.log("資料遷移完成！");
    
    // 驗證遷移結果
    const categoriesCount = await db.execute(sql`SELECT COUNT(*) FROM debt_categories`);
    const vendorsCount = await db.execute(sql`SELECT COUNT(*) FROM vendors`);
    const debtsCount = await db.execute(sql`SELECT COUNT(*) FROM debts`);
    
    console.log(`遷移結果:`);
    console.log(`- 分類: ${categoriesCount.rows[0].count} 筆`);
    console.log(`- 廠商: ${vendorsCount.rows[0].count} 筆`);
    console.log(`- 債務: ${debtsCount.rows[0].count} 筆`);

  } catch (error) {
    console.error("遷移失敗:", error);
    throw error;
  }
}

// 執行遷移
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateData()
    .then(() => {
      console.log("遷移腳本執行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("遷移腳本執行失敗:", error);
      process.exit(1);
    });
}

export { migrateData };