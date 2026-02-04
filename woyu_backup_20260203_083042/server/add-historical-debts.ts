import { db } from "./db";
import { debts, debtCategories, vendors } from "@shared/schema";

async function addHistoricalDebts() {
  console.log("正在添加歷史債務記錄...");

  try {
    // 獲取現有分類和廠商ID對照
    const categories = await db.select().from(debtCategories);
    const vendorsList = await db.select().from(vendors);

    const getCategoryId = (name: string) => {
      const category = categories.find(c => c.categoryName.includes(name));
      return category?.id || 6; // 默認為水電費
    };

    const getVendorId = (name: string) => {
      if (name.includes("文旅")) return 2; // 浯島文旅
      if (name.includes("輕旅")) return 3; // 浯島輕旅
      return null;
    };

    // 歷史債務數據
    const historicalDebts = [
      // 租金類 - 本月之前
      { name: "2025-01 浯島輕旅租金", amount: "50000.00", category: "租金", vendor: "輕旅", dueDate: "2025-01-31", status: "pending" },
      { name: "2025-02 浯島輕旅租金", amount: "50000.00", category: "租金", vendor: "輕旅", dueDate: "2025-02-28", status: "pending" },
      { name: "2025-03 浯島輕旅租金", amount: "50000.00", category: "租金", vendor: "輕旅", dueDate: "2025-03-31", status: "pending" },
      { name: "2025-04 浯島輕旅租金", amount: "50000.00", category: "租金", vendor: "輕旅", dueDate: "2025-04-30", status: "pending" },
      { name: "2025-05 浯島輕旅租金", amount: "50000.00", category: "租金", vendor: "輕旅", dueDate: "2025-05-31", status: "pending" },
      { name: "2025-04-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2025-04-30", status: "pending" },
      { name: "2025-03-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2025-03-31", status: "pending" },
      { name: "2025-02-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2025-02-28", status: "pending" },
      { name: "2025-01-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2025-01-31", status: "pending" },
      { name: "2024-12-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2024-12-31", status: "paid" },
      { name: "2024-11-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2024-11-30", status: "paid" },
      { name: "2024-10-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2024-10-31", status: "paid" },
      { name: "2024-09-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2024-09-30", status: "paid" },
      { name: "2024-08-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2024-08-31", status: "paid" },
      { name: "2024-07-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2024-07-30", status: "paid" },
      { name: "2024-06-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2024-06-30", status: "paid" },
      { name: "2024-05-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2024-05-31", status: "paid" },
      { name: "2024-04-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2024-04-30", status: "pending" },
      { name: "2024-03-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2024-03-31", status: "pending" },
      { name: "2024-02-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2024-02-29", status: "pending" },
      { name: "2024-01-浯島文旅租金", amount: "200000.00", category: "租金", vendor: "文旅", dueDate: "2024-01-31", status: "pending" },

      // 電費類
      { name: "2025-05-浯島輕旅-電費-22520207202", amount: "7337.00", category: "電費", vendor: "輕旅", dueDate: "2025-05-31", status: "pending" },

      // 平台佣金類
      { name: "2025-03-浯島文旅-Booking", amount: "9254.00", category: "平台佣金", vendor: "文旅", dueDate: "2025-04-16", status: "pending" },
      { name: "2025-04-浯島文旅-Booking-1629881447", amount: "4998.00", category: "平台佣金", vendor: "文旅", dueDate: "2025-05-15", status: "pending" },
      { name: "2025-04-浯島文旅-Bookimg-1627885371", amount: "7018.00", category: "平台佣金", vendor: "文旅", dueDate: "2025-05-24", status: "paid" },

      // 洗滌費類  
      { name: "113/10 輕旅洗滌費", amount: "42943.00", category: "洗滌費", vendor: "輕旅", dueDate: "2024-10-20", status: "pending" },
      { name: "2024/11 輕旅洗滌費", amount: "31502.00", category: "洗滌費", vendor: "輕旅", dueDate: "2024-11-20", status: "pending" },
      { name: "2024/5 文旅洗滌費", amount: "69500.00", category: "洗滌費", vendor: "文旅", dueDate: "2024-07-31", status: "pending" },
      { name: "2024/6 文旅洗滌費", amount: "64940.00", category: "洗滌費", vendor: "文旅", dueDate: "2024-08-31", status: "pending" },
      { name: "113/7 文旅洗滌費", amount: "59955.00", category: "洗滌費", vendor: "文旅", dueDate: "2024-09-30", status: "pending" },
      { name: "114/1 浯島輕旅洗滌費", amount: "22985.00", category: "洗滌費", vendor: "輕旅", dueDate: "2025-05-13", status: "paid" },
      { name: "2024/10 浯島輕旅洗滌費", amount: "42943.00", category: "洗滌費", vendor: "輕旅", dueDate: "2024-12-05", status: "pending" },
      { name: "2024/11 浯島輕旅 洗滌費", amount: "31502.00", category: "洗滌費", vendor: "輕旅", dueDate: "2025-02-28", status: "pending" },
      { name: "2025/2 浯島輕旅 洗滌費", amount: "30060.00", category: "洗滌費", vendor: "輕旅", dueDate: "2025-04-05", status: "pending" },
      { name: "2025/3 浯島輕旅 洗滌費", amount: "25110.00", category: "洗滌費", vendor: "輕旅", dueDate: "2025-03-20", status: "pending" },
      { name: "2025/4 浯島輕旅 洗滌費", amount: "18058.00", category: "洗滌費", vendor: "輕旅", dueDate: "2025-04-20", status: "pending" },
      { name: "2024/9 文旅洗滌費", amount: "49043.00", category: "洗滌費", vendor: "文旅", dueDate: "2024-12-30", status: "pending" },
      { name: "2024/10 文旅洗滌費", amount: "44741.00", category: "洗滌費", vendor: "文旅", dueDate: "2025-01-30", status: "pending" },
      { name: "2024/11 文旅洗滌費", amount: "38646.00", category: "洗滌費", vendor: "文旅", dueDate: "2025-02-28", status: "pending" },
      { name: "2024/12 文旅洗滌費", amount: "40439.00", category: "洗滌費", vendor: "文旅", dueDate: "2025-03-31", status: "pending" },
      { name: "2024/8 文旅洗滌費", amount: "42275.00", category: "洗滌費", vendor: "文旅", dueDate: "2024-11-30", status: "pending" },
      { name: "2025/2 浯島文旅洗滌費", amount: "29494.00", category: "洗滌費", vendor: "文旅", dueDate: "2025-02-20", status: "pending" },
      { name: "2025/3 浯島文旅洗滌費", amount: "43112.00", category: "洗滌費", vendor: "文旅", dueDate: "2025-03-20", status: "pending" },
      { name: "2025/4 浯島文旅洗滌費", amount: "34778.00", category: "洗滌費", vendor: "文旅", dueDate: "2025-04-20", status: "pending" },

      // 雲端工具類
      { name: "旅安-浯島文旅-自動房價", amount: "30000.00", category: "雲端工具", vendor: "文旅", dueDate: "2025-05-16", status: "paid" },
      { name: "Super8-浯島文旅年費", amount: "21000.00", category: "雲端工具", vendor: "文旅", dueDate: "2025-05-15", status: "paid" },

      // 人事費用類
      { name: "4月櫃檯-李宸煬-浯島文旅", amount: "29000.00", category: "人事費用", vendor: "文旅", dueDate: "2025-05-10", status: "paid" },
      { name: "4月房務-邱雅婷-浯島輕旅", amount: "30000.00", category: "人事費用", vendor: "輕旅", dueDate: "2025-05-10", status: "paid" },
      { name: "4月房務-丁莉扉-浯島文旅", amount: "33000.00", category: "人事費用", vendor: "文旅", dueDate: "2025-05-10", status: "paid" },

      // 其他費用類
      { name: "雷射設備採購", amount: "220000.00", category: "其他費用", vendor: null, dueDate: "2025-05-31", status: "pending" },
      { name: "202504 -清美二胎", amount: "15000.00", category: "其他費用", vendor: "文旅", dueDate: "2025-04-30", status: "pending" },
      { name: "2025-05清美二胎", amount: "15000.00", category: "其他費用", vendor: "文旅", dueDate: "2025-05-31", status: "pending" },
      { name: "小六路 許長榮阿伯", amount: "8333.17", category: "租金", vendor: null, dueDate: "2025-05-20", status: "pending" },
    ];

    let addedCount = 0;
    for (const debt of historicalDebts) {
      try {
        await db.insert(debts).values({
          categoryId: getCategoryId(debt.category),
          debtName: debt.name,
          totalAmount: debt.amount,
          vendorId: getVendorId(debt.vendor || ""),
          note: "",
          installments: 1,
          paymentType: "single",
          firstDueDate: debt.dueDate,
          paidAmount: debt.status === "paid" ? debt.amount : "0.00",
          status: debt.status,
          isDeleted: false,
        });
        addedCount++;
        console.log(`✓ 已添加: ${debt.name} - NT$ ${debt.amount}`);
      } catch (error) {
        // 跳過重複的記錄
        if (error.message && error.message.includes('duplicate')) {
          console.log(`- 跳過重複記錄: ${debt.name}`);
        } else {
          console.error(`添加 ${debt.name} 時發生錯誤:`, error);
        }
      }
    }

    console.log(`✓ 歷史債務記錄添加完成，總計添加 ${addedCount} 筆記錄`);

  } catch (error) {
    console.error("添加歷史債務記錄時發生錯誤:", error);
  }
}

// 執行添加歷史債務記錄
if (import.meta.url === `file://${process.argv[1]}`) {
  addHistoricalDebts()
    .then(() => {
      console.log("歷史債務記錄腳本執行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("歷史債務記錄腳本執行失敗:", error);
      process.exit(1);
    });
}

export { addHistoricalDebts };