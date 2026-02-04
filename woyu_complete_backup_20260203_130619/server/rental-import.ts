import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { paymentItems, debtCategories, paymentProjects, rentalContracts, rentalPriceTiers } from "@shared/schema";

export async function importExistingRentalData() {
  try {
    console.log("開始導入現有租金資料...");
    
    // 查找租金分類
    const [rentCategory] = await db
      .select()
      .from(debtCategories)
      .where(and(
        eq(debtCategories.categoryName, "租金"),
        eq(debtCategories.categoryType, "project")
      ));

    if (!rentCategory) {
      console.log("未找到租金分類");
      return { success: false, message: "未找到租金分類" };
    }

    // 查找租金相關的付款項目
    const rentalItems = await db
      .select({
        id: paymentItems.id,
        itemName: paymentItems.itemName,
        totalAmount: paymentItems.totalAmount,
        projectId: paymentItems.projectId,
        startDate: paymentItems.startDate,
        notes: paymentItems.notes,
        projectName: paymentProjects.projectName
      })
      .from(paymentItems)
      .leftJoin(paymentProjects, eq(paymentItems.projectId, paymentProjects.id))
      .where(and(
        eq(paymentItems.categoryId, rentCategory.id),
        eq(paymentItems.isDeleted, false)
      ))
      .orderBy(paymentItems.startDate);

    console.log(`找到 ${rentalItems.length} 個租金付款項目`);
    
    if (rentalItems.length === 0) {
      return { success: true, message: "沒有找到需要導入的租金項目", migratedItems: 0, createdContracts: 0 };
    }

    // 按專案分組租金項目
    const projectGroups = new Map();
    rentalItems.forEach(item => {
      const key = item.projectId;
      if (!projectGroups.has(key)) {
        projectGroups.set(key, {
          projectId: item.projectId,
          projectName: item.projectName || "未知專案",
          items: [],
          totalAmount: 0
        });
      }
      const group = projectGroups.get(key);
      group.items.push(item);
      group.totalAmount += parseFloat(item.totalAmount || "0");
    });

    let createdContracts = 0;
    
    // 為每個專案創建租約
    for (const [projectId, group] of projectGroups) {
      try {
        // 計算平均租金金額
        const avgAmount = group.totalAmount / group.items.length;
        
        // 找到最早和最晚的日期
        const dates = group.items
          .map(item => new Date(item.startDate))
          .sort((a, b) => a.getTime() - b.getTime());
        
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];
        
        // 計算租約年數
        const totalYears = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));

        // 創建租約記錄
        const [newContract] = await db
          .insert(rentalContracts)
          .values({
            projectId: projectId,
            contractName: `${group.projectName}租約`,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            totalYears: totalYears,
            baseAmount: Math.round(avgAmount).toString(),
            isActive: true,
            notes: `從現有 ${group.items.length} 筆租金項目導入`
          })
          .returning();

        console.log(`創建租約: ${group.projectName} (${group.items.length} 筆項目)`);
        createdContracts++;

      } catch (error) {
        console.error(`創建租約失敗 (專案 ${projectId}):`, error);
      }
    }

    return {
      success: true,
      message: "租金資料導入完成",
      migratedItems: rentalItems.length,
      createdContracts: createdContracts
    };

  } catch (error) {
    console.error("導入租金資料時發生錯誤:", error);
    return {
      success: false,
      message: "導入失敗",
      error: String(error)
    };
  }
}