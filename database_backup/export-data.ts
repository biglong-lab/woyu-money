import { db } from '../server/db';
import { 
  users, paymentProjects, paymentItems, paymentRecords, 
  fixedCategories, debtCategories, documentInbox,
  householdBudgets, householdExpenses,
  rentalContracts, rentalPriceTiers,
  budgetPlans, budgetItems, invoiceRecords
} from '../shared/schema';
import * as fs from 'fs';

async function exportDatabase() {
  console.log('開始匯出資料庫...');
  
  const exportData: Record<string, any[]> = {};
  
  const tables = [
    { name: 'users', table: users },
    { name: 'payment_projects', table: paymentProjects },
    { name: 'payment_items', table: paymentItems },
    { name: 'payment_records', table: paymentRecords },
    { name: 'fixed_categories', table: fixedCategories },
    { name: 'debt_categories', table: debtCategories },
    { name: 'document_inbox', table: documentInbox },
    { name: 'household_budgets', table: householdBudgets },
    { name: 'household_expenses', table: householdExpenses },
    { name: 'rental_contracts', table: rentalContracts },
    { name: 'rental_price_tiers', table: rentalPriceTiers },
    { name: 'budget_plans', table: budgetPlans },
    { name: 'budget_items', table: budgetItems },
    { name: 'invoice_records', table: invoiceRecords },
  ];
  
  for (const { name, table } of tables) {
    try {
      const data = await db.select().from(table);
      exportData[name] = data;
      console.log(`✓ ${name}: ${data.length} 筆`);
    } catch (error) {
      console.error(`✗ ${name}: 匯出失敗`, error);
    }
  }
  
  const outputPath = './database_backup/database_export.json';
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  console.log(`\n匯出完成！檔案：${outputPath}`);
  
  process.exit(0);
}

exportDatabase().catch(console.error);
