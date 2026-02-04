import { db } from "./db";
import { 
  vendors, 
  debts, 
  debtPayments,
  paymentProjects, 
  paymentItems,
  paymentRecords,
  paymentTags,
  paymentItemTags,
  debtCategories
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export class PaymentMigration {
  /**
   * 將現有廠商轉為專案，債務轉為付款項目
   */
  async migrateVendorsToProjects() {
    console.log("開始遷移廠商資料為專案...");
    
    // 1. 獲取所有現有廠商
    const existingVendors = await db.select().from(vendors).where(eq(vendors.isDeleted, false));
    
    // 2. 為沒有廠商的債務創建"其他"專案
    let otherProject = await db.select().from(paymentProjects).where(eq(paymentProjects.projectName, "其他")).limit(1);
    
    if (otherProject.length === 0) {
      const [newOtherProject] = await db.insert(paymentProjects).values({
        projectName: "其他",
        projectType: "general",
        description: "未分類項目",
      }).returning();
      otherProject = [newOtherProject];
    }

    // 3. 遷移廠商為專案
    const projectMapping: Record<number, number> = {};
    
    for (const vendor of existingVendors) {
      const [project] = await db.insert(paymentProjects).values({
        projectName: vendor.vendorName,
        projectType: "general",
        description: `從廠商遷移: ${vendor.vendorName}`,
        createdAt: vendor.createdAt,
        updatedAt: vendor.updatedAt,
      }).returning();
      
      projectMapping[vendor.id] = project.id;
      console.log(`遷移廠商 "${vendor.vendorName}" 為專案 ID: ${project.id}`);
    }

    // 4. 遷移債務為付款項目
    const existingDebts = await db.select().from(debts).where(eq(debts.isDeleted, false));
    
    for (const debt of existingDebts) {
      const projectId = debt.vendorId ? projectMapping[debt.vendorId] : otherProject[0].id;
      
      // 判斷項目類型（家用或專案）
      const itemType = debt.vendorId ? "project" : "home";
      
      // 轉換付款類型
      let paymentType = "single";
      let installmentCount = null;
      
      if (debt.paymentType === "installment" && debt.installments != null && debt.installments > 1) {
        paymentType = "installment";
        installmentCount = debt.installments;
      }

      const [paymentItem] = await db.insert(paymentItems).values({
        categoryId: debt.categoryId,
        projectId: projectId,
        itemName: debt.debtName,
        totalAmount: debt.totalAmount,
        itemType: itemType,
        paymentType: paymentType,
        installmentCount: installmentCount,
        startDate: debt.firstDueDate,
        endDate: debt.expectedPaymentDate,
        paidAmount: debt.paidAmount,
        status: debt.status,
        notes: debt.note,
        createdAt: debt.createdAt,
        updatedAt: debt.updatedAt,
      }).returning();

      console.log(`遷移債務 "${debt.debtName}" 為付款項目 ID: ${paymentItem.id}`);

      // 5. 遷移債務付款記錄
      const debtPaymentRecords = await db.select().from(debtPayments).where(eq(debtPayments.debtId, debt.id));
      
      for (const payment of debtPaymentRecords) {
        await db.insert(paymentRecords).values({
          paymentItemId: paymentItem.id,
          amountPaid: payment.amountPaid,
          paymentDate: payment.paymentDate,
          receiptImageUrl: payment.receiptFile,
          receiptText: payment.note,
          isPartialPayment: parseFloat(payment.amountPaid.toString()) < parseFloat(debt.totalAmount.toString()),
          notes: payment.note,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        });
      }
    }

    console.log("遷移完成！");
    return {
      vendorsMigrated: existingVendors.length,
      debtsMigrated: existingDebts.length,
      projectMapping
    };
  }

  /**
   * 創建預設標籤
   */
  async createDefaultTags() {
    console.log("創建預設標籤...");
    
    const defaultTags = [
      // 家用標籤
      { name: "餐費", color: "#FF6B6B", description: "日常餐飲支出" },
      { name: "交通", color: "#4ECDC4", description: "交通運輸費用" },
      { name: "教育", color: "#45B7D1", description: "教育相關費用" },
      { name: "娛樂", color: "#96CEB4", description: "娛樂休閒支出" },
      { name: "醫療", color: "#FFEAA7", description: "醫療保健費用" },
      { name: "水電", color: "#DDA0DD", description: "水電瓦斯費用" },
      { name: "房租", color: "#98D8C8", description: "租金相關費用" },
      
      // 專案標籤
      { name: "浯島文旅", color: "#F7DC6F", description: "浯島文旅營運相關" },
      { name: "營運費用", color: "#BB8FCE", description: "日常營運支出" },
      { name: "設備維護", color: "#85C1E9", description: "設備保養維修" },
      { name: "行銷推廣", color: "#F8C471", description: "行銷宣傳費用" },
      { name: "人事費用", color: "#82E0AA", description: "員工薪資福利" },
      { name: "急需", color: "#FF5757", description: "緊急需要處理" },
      { name: "可延期", color: "#78E08F", description: "可延後付款" },
    ];

    for (const tag of defaultTags) {
      await db.insert(paymentTags).values(tag).onConflictDoNothing();
    }

    console.log(`創建了 ${defaultTags.length} 個預設標籤`);
  }

  /**
   * 執行完整遷移
   */
  async executeFullMigration() {
    try {
      console.log("開始執行付款規劃系統遷移...");
      
      // 1. 創建預設標籤
      await this.createDefaultTags();
      
      // 2. 遷移廠商和債務數據
      const result = await this.migrateVendorsToProjects();
      
      console.log("遷移完成!", result);
      return result;
      
    } catch (error) {
      console.error("遷移過程中發生錯誤:", error);
      throw error;
    }
  }

  /**
   * 驗證遷移結果
   */
  async validateMigration() {
    const [projectCount] = await db.select().from(paymentProjects);
    const [paymentItemCount] = await db.select().from(paymentItems);
    const [tagCount] = await db.select().from(paymentTags);
    
    console.log("遷移驗證結果:");
    console.log(`- 專案數量: ${projectCount || 0}`);
    console.log(`- 付款項目數量: ${paymentItemCount || 0}`);
    console.log(`- 標籤數量: ${tagCount || 0}`);
    
    return {
      projects: projectCount || 0,
      paymentItems: paymentItemCount || 0,
      tags: tagCount || 0
    };
  }
}

// 執行遷移的主函數
async function runMigration() {
  const migration = new PaymentMigration();
  
  try {
    await migration.executeFullMigration();
    await migration.validateMigration();
  } catch (error) {
    console.error("遷移失敗:", error);
    process.exit(1);
  }
}

// 如果直接執行此檔案，則運行遷移
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().then(() => {
    console.log("遷移完成，程序退出");
    process.exit(0);
  });
}