import { db } from "./db";
import { 
  debts, debtCategories, paymentItems, paymentProjects,
  householdCategories, projectCategories, householdExpenses, projectExpenses 
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

// 家用支出相關的分類關鍵字
const HOUSEHOLD_KEYWORDS = [
  '租金', '水電費', '洗滌費', '清潔費', '維修費', '保險費',
  '電話費', '網路費', '瓦斯費', '垃圾費', '管理費',
  '食材', '日用品', '生活用品', '家具', '家電'
];

// 專案支出相關的分類關鍵字  
const PROJECT_KEYWORDS = [
  '人事費用', '設備費', '材料費', '工程費', '設計費',
  '廣告費', '行銷費', '顧問費', '軟體費', '授權費'
];

export class CategorySystemMigration {
  
  /**
   * 創建預設的家用分類
   */
  async createDefaultHouseholdCategories() {
    console.log('創建家用分類...');
    
    const householdCategoriesData = [
      // 主分類
      { categoryName: '房屋支出', level: 1, parentId: null, color: '#3B82F6', icon: 'Home' },
      { categoryName: '生活支出', level: 1, parentId: null, color: '#10B981', icon: 'ShoppingCart' },
      { categoryName: '交通支出', level: 1, parentId: null, color: '#F59E0B', icon: 'Car' },
      { categoryName: '其他支出', level: 1, parentId: null, color: '#6B7280', icon: 'Receipt' },
    ];
    
    const createdMainCategories = [];
    for (const category of householdCategoriesData) {
      const [created] = await db.insert(householdCategories)
        .values(category)
        .returning();
      createdMainCategories.push(created);
    }
    
    // 子分類
    const subCategories = [
      // 房屋支出子分類
      { categoryName: '租金', level: 2, parentId: createdMainCategories[0].id, color: '#3B82F6', icon: 'Home' },
      { categoryName: '水電費', level: 2, parentId: createdMainCategories[0].id, color: '#3B82F6', icon: 'Home' },
      { categoryName: '瓦斯費', level: 2, parentId: createdMainCategories[0].id, color: '#3B82F6', icon: 'Home' },
      { categoryName: '網路費', level: 2, parentId: createdMainCategories[0].id, color: '#3B82F6', icon: 'Home' },
      { categoryName: '管理費', level: 2, parentId: createdMainCategories[0].id, color: '#3B82F6', icon: 'Home' },
      
      // 生活支出子分類
      { categoryName: '洗滌費', level: 2, parentId: createdMainCategories[1].id, color: '#10B981', icon: 'ShoppingCart' },
      { categoryName: '清潔費', level: 2, parentId: createdMainCategories[1].id, color: '#10B981', icon: 'ShoppingCart' },
      { categoryName: '日用品', level: 2, parentId: createdMainCategories[1].id, color: '#10B981', icon: 'ShoppingCart' },
      { categoryName: '食材', level: 2, parentId: createdMainCategories[1].id, color: '#10B981', icon: 'ShoppingCart' },
      
      // 其他支出子分類
      { categoryName: '其他', level: 2, parentId: createdMainCategories[3].id, color: '#6B7280', icon: 'Receipt' },
    ];
    
    for (const category of subCategories) {
      await db.insert(householdCategories).values(category);
    }
    
    console.log('家用分類創建完成');
    return createdMainCategories;
  }
  
  /**
   * 創建預設的專案分類
   */
  async createDefaultProjectCategories() {
    console.log('創建專案分類...');
    
    const projectCategoriesData = [
      // 主分類
      { categoryName: '人力成本', level: 1, parentId: null, color: '#10B981', icon: 'FolderOpen' },
      { categoryName: '設備成本', level: 1, parentId: null, color: '#3B82F6', icon: 'FolderOpen' },
      { categoryName: '營運成本', level: 1, parentId: null, color: '#F59E0B', icon: 'FolderOpen' },
      { categoryName: '其他成本', level: 1, parentId: null, color: '#6B7280', icon: 'FolderOpen' },
    ];
    
    const createdMainCategories = [];
    for (const category of projectCategoriesData) {
      const [created] = await db.insert(projectCategories)
        .values(category)
        .returning();
      createdMainCategories.push(created);
    }
    
    // 子分類
    const subCategories = [
      // 人力成本子分類
      { categoryName: '人事費用', level: 2, parentId: createdMainCategories[0].id, color: '#10B981', icon: 'FolderOpen' },
      { categoryName: '顧問費', level: 2, parentId: createdMainCategories[0].id, color: '#10B981', icon: 'FolderOpen' },
      { categoryName: '培訓費', level: 2, parentId: createdMainCategories[0].id, color: '#10B981', icon: 'FolderOpen' },
      
      // 設備成本子分類
      { categoryName: '設備費', level: 2, parentId: createdMainCategories[1].id, color: '#3B82F6', icon: 'FolderOpen' },
      { categoryName: '軟體費', level: 2, parentId: createdMainCategories[1].id, color: '#3B82F6', icon: 'FolderOpen' },
      { categoryName: '授權費', level: 2, parentId: createdMainCategories[1].id, color: '#3B82F6', icon: 'FolderOpen' },
      
      // 營運成本子分類
      { categoryName: '廣告費', level: 2, parentId: createdMainCategories[2].id, color: '#F59E0B', icon: 'FolderOpen' },
      { categoryName: '行銷費', level: 2, parentId: createdMainCategories[2].id, color: '#F59E0B', icon: 'FolderOpen' },
      { categoryName: '材料費', level: 2, parentId: createdMainCategories[2].id, color: '#F59E0B', icon: 'FolderOpen' },
      
      // 其他成本子分類
      { categoryName: '其他', level: 2, parentId: createdMainCategories[3].id, color: '#6B7280', icon: 'FolderOpen' },
    ];
    
    for (const category of subCategories) {
      await db.insert(projectCategories).values(category);
    }
    
    console.log('專案分類創建完成');
    return createdMainCategories;
  }
  
  /**
   * 遷移現有付款項目到新的分類系統
   */
  async migratePaymentItems() {
    console.log('開始遷移付款項目到新分類系統...');
    
    // 獲取所有現有的付款項目和分類
    const paymentItemsWithCategories = await db.select({
      id: paymentItems.id,
      projectId: paymentItems.projectId,
      categoryId: paymentItems.categoryId,
      totalAmount: paymentItems.totalAmount,
      paidAmount: paymentItems.paidAmount,
      startDate: paymentItems.startDate,
      itemName: paymentItems.itemName,
      notes: paymentItems.notes,
      paymentType: paymentItems.paymentType,
      categoryName: debtCategories.categoryName,
      projectName: paymentProjects.projectName
    })
    .from(paymentItems)
    .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
    .leftJoin(paymentProjects, eq(paymentItems.projectId, paymentProjects.id));
    
    // 獲取新建的分類
    const householdCats = await db.select().from(householdCategories);
    const projectCats = await db.select().from(projectCategories);
    
    let householdCount = 0;
    let projectCount = 0;
    
    for (const item of paymentItemsWithCategories) {
      const isHouseholdExpense = HOUSEHOLD_KEYWORDS.some(keyword => 
        item.categoryName?.includes(keyword) || item.itemName?.includes(keyword)
      );
      
      if (isHouseholdExpense) {
        // 遷移到家用支出
        const matchingCategory = householdCats.find(cat => 
          cat.categoryName === item.categoryName || 
          (item.categoryName?.includes('租金') && cat.categoryName === '租金') ||
          (item.categoryName?.includes('水電') && cat.categoryName === '水電費') ||
          (item.categoryName?.includes('洗滌') && cat.categoryName === '洗滌費') ||
          (item.categoryName?.includes('其他') && cat.categoryName === '其他')
        );
        
        const categoryId = matchingCategory?.id || householdCats.find(cat => cat.categoryName === '其他')?.id;
        
        if (categoryId) {
          const dateStr = item.startDate instanceof Date ? 
            item.startDate.toISOString().split('T')[0] : 
            new Date().toISOString().split('T')[0];
          
          await db.insert(householdExpenses).values({
            categoryId: categoryId,
            amount: (item.paidAmount || 0).toString(),
            date: dateStr,
            description: item.itemName || '遷移數據',
            paymentMethod: 'transfer'
          });
          householdCount++;
        }
      } else {
        // 遷移到專案支出
        const matchingCategory = projectCats.find(cat => 
          cat.categoryName === item.categoryName || 
          (item.categoryName?.includes('人事') && cat.categoryName === '人事費用') ||
          (item.categoryName?.includes('設備') && cat.categoryName === '設備費') ||
          (item.categoryName?.includes('其他') && cat.categoryName === '其他')
        );
        
        const categoryId = matchingCategory?.id || projectCats.find(cat => cat.categoryName === '其他')?.id;
        
        if (categoryId && item.projectId) {
          await db.insert(projectExpenses).values({
            projectId: item.projectId,
            categoryId: categoryId,
            amount: item.paidAmount || 0,
            date: item.startDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
            description: item.itemName || '遷移數據',
            paymentMethod: 'transfer'
          });
          projectCount++;
        }
      }
    }
    
    console.log(`遷移完成: ${householdCount} 筆家用支出, ${projectCount} 筆專案支出`);
    return { householdCount, projectCount };
  }
  
  /**
   * 執行完整遷移
   */
  async executeFullMigration() {
    try {
      console.log('開始執行分類系統遷移...');
      
      // 1. 創建新的分類系統
      await this.createDefaultHouseholdCategories();
      await this.createDefaultProjectCategories();
      
      // 2. 遷移現有數據
      const result = await this.migratePaymentItems();
      
      console.log('分類系統遷移完成!');
      console.log(`遷移結果: ${result.householdCount} 筆家用支出, ${result.projectCount} 筆專案支出`);
      
      return result;
    } catch (error) {
      console.error('遷移過程中發生錯誤:', error);
      throw error;
    }
  }
}

// 執行遷移
async function runMigration() {
  const migration = new CategorySystemMigration();
  try {
    const result = await migration.executeFullMigration();
    console.log('遷移成功完成:', result);
    process.exit(0);
  } catch (error) {
    console.error('遷移失敗:', error);
    process.exit(1);
  }
}

runMigration();