import { db } from "./db";
import { debts, debtCategories, vendors } from "@shared/schema";

async function addJuneDebts() {
  console.log("正在添加6月份應付款項...");

  try {
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

    // 6月份應付款項
    const juneDebts = [
      { 
        name: "2025-06-浯島文旅租金", 
        amount: "200000.00", 
        category: "租金", 
        vendor: "文旅", 
        dueDate: "2025-06-30", 
        status: "pending" 
      },
      { 
        name: "2025-06 浯島輕旅租金", 
        amount: "50000.00", 
        category: "租金", 
        vendor: "輕旅", 
        dueDate: "2025-06-30", 
        status: "pending" 
      },
      { 
        name: "2023玻璃廠商", 
        amount: "40000.00", 
        category: "其他費用", 
        vendor: "文旅", 
        dueDate: "2025-06-30", 
        status: "pending",
        note: "玻璃廠商當年建制費"
      },
      { 
        name: "小六路 許長榮阿伯", 
        amount: "8333.17", 
        category: "租金", 
        vendor: null, 
        dueDate: "2025-06-20", 
        status: "pending",
        note: "這是過去未付款給阿伯的"
      }
    ];

    let addedCount = 0;
    for (const debt of juneDebts) {
      try {
        await db.insert(debts).values({
          categoryId: getCategoryId(debt.category),
          debtName: debt.name,
          totalAmount: debt.amount,
          vendorId: getVendorId(debt.vendor || ""),
          note: debt.note || "",
          installments: 1,
          paymentType: debt.name.includes("分期") ? "installment" : "single",
          firstDueDate: debt.dueDate,
          paidAmount: "0.00",
          status: debt.status,
          isDeleted: false,
        });
        addedCount++;
        console.log(`✓ 已添加: ${debt.name} - NT$ ${debt.amount}`);
      } catch (error) {
        if (error.message && error.message.includes('duplicate')) {
          console.log(`- 跳過重複記錄: ${debt.name}`);
        } else {
          console.error(`添加 ${debt.name} 時發生錯誤:`, error);
        }
      }
    }

    console.log(`✓ 6月份應付款項添加完成，總計添加 ${addedCount} 筆記錄`);

  } catch (error) {
    console.error("添加6月份應付款項時發生錯誤:", error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  addJuneDebts()
    .then(() => {
      console.log("6月份應付款項腳本執行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("6月份應付款項腳本執行失敗:", error);
      process.exit(1);
    });
}

export { addJuneDebts };