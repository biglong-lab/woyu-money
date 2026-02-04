import { db } from "./db";
import { paymentItems, debtCategories, paymentProjects } from "@shared/schema";
import { eq } from "drizzle-orm";

async function classifyExistingData() {
  console.log('開始分析現有 65 個記錄的分類情況...');
  
  // 獲取所有現有的付款項目和分類
  const items = await db.select({
    id: paymentItems.id,
    itemName: paymentItems.itemName,
    categoryId: paymentItems.categoryId,
    projectId: paymentItems.projectId,
    totalAmount: paymentItems.totalAmount,
    paidAmount: paymentItems.paidAmount,
    categoryName: debtCategories.categoryName,
    projectName: paymentProjects.projectName
  })
  .from(paymentItems)
  .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
  .leftJoin(paymentProjects, eq(paymentItems.projectId, paymentProjects.id));
  
  console.log(`找到 ${items.length} 個付款項目`);
  
  // 分析分類情況
  const householdItems = [];
  const projectItems = [];
  
  for (const item of items) {
    const isHousehold = 
      item.categoryName?.includes('租金') ||
      item.categoryName?.includes('水電') ||
      item.categoryName?.includes('洗滌') ||
      item.categoryName?.includes('清潔') ||
      item.categoryName?.includes('管理') ||
      item.categoryName?.includes('瓦斯') ||
      item.categoryName?.includes('網路') ||
      item.categoryName?.includes('垃圾');
    
    if (isHousehold) {
      householdItems.push(item);
    } else {
      projectItems.push(item);
    }
  }
  
  console.log('\n=== 分類結果 ===');
  console.log(`應歸類為家用支出: ${householdItems.length} 項`);
  householdItems.forEach(item => {
    console.log(`  - ${item.categoryName}: ${item.itemName} (${item.totalAmount})`);
  });
  
  console.log(`\n應歸類為專案支出: ${projectItems.length} 項`);
  projectItems.forEach(item => {
    console.log(`  - ${item.categoryName}: ${item.itemName} (${item.totalAmount})`);
  });
  
  console.log('\n=== 分類統計 ===');
  const householdTotal = householdItems.reduce((sum, item) => sum + (parseFloat(item.totalAmount || '0')), 0);
  const projectTotal = projectItems.reduce((sum, item) => sum + (parseFloat(item.totalAmount || '0')), 0);
  
  console.log(`家用支出總額: NT$ ${householdTotal.toLocaleString()}`);
  console.log(`專案支出總額: NT$ ${projectTotal.toLocaleString()}`);
  console.log(`總計: NT$ ${(householdTotal + projectTotal).toLocaleString()}`);
  
  return {
    householdItems,
    projectItems,
    householdTotal,
    projectTotal
  };
}

// 執行分類分析
classifyExistingData()
  .then((result) => {
    console.log('\n分類分析完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('分析失敗:', error);
    process.exit(1);
  });