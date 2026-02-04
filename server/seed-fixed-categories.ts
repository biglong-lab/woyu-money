import { db } from "./db";
import { fixedCategories, fixedCategorySubOptions } from "@shared/schema";

async function seedFixedCategories() {
  console.log("開始創建固定分類...");
  
  try {
    // 創建固定分類
    const categories = await db.insert(fixedCategories).values([
      {
        categoryName: "電話費",
        categoryType: "phone",
        description: "固定電話、手機等通訊費用",
        sortOrder: 1,
      },
      {
        categoryName: "電費",
        categoryType: "electricity", 
        description: "電力使用費用",
        sortOrder: 2,
      },
      {
        categoryName: "水費",
        categoryType: "water",
        description: "自來水使用費用",
        sortOrder: 3,
      },
      {
        categoryName: "網路費",
        categoryType: "internet",
        description: "網際網路連線費用",
        sortOrder: 4,
      },
      {
        categoryName: "瓦斯費",
        categoryType: "gas",
        description: "瓦斯使用費用",
        sortOrder: 5,
      },
      {
        categoryName: "管理費",
        categoryType: "management",
        description: "大樓管理費等固定費用",
        sortOrder: 6,
      },
      {
        categoryName: "保險費",
        categoryType: "insurance",
        description: "各種保險費用",
        sortOrder: 7,
      },
      {
        categoryName: "稅費",
        categoryType: "tax",
        description: "各種稅務費用",
        sortOrder: 8,
      },
      {
        categoryName: "其他固定項目",
        categoryType: "other",
        description: "其他定期固定支出項目",
        sortOrder: 9,
      }
    ]).returning();

    console.log(`已創建 ${categories.length} 個固定分類`);
    
    return categories;
  } catch (error) {
    console.error("創建固定分類時發生錯誤:", error);
    throw error;
  }
}

// 主函數
async function main() {
  try {
    await seedFixedCategories();
    console.log("固定分類種子數據創建完成！");
  } catch (error) {
    console.error("種子數據創建失敗:", error);
    process.exit(1);
  }
}

// 執行種子數據創建
main();

export { seedFixedCategories };