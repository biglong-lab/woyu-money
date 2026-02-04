import { db } from "./db";
import { debtPayments } from "@shared/schema";

async function addRealPaymentData() {
  console.log("正在添加真實付款記錄...");

  try {
    // 添加本月已付款項：100,000 元
    const paymentData = [
      {
        debtId: 17, // 2025-05-浯島文旅租金
        amountPaid: "100000.00",
        paymentDate: "2025-06-01",
        note: "部分付款 - 租金",
      }
    ];

    for (const payment of paymentData) {
      await db.insert(debtPayments).values(payment);
      console.log(`✓ 已添加付款記錄: NT$ ${payment.amountPaid}`);
    }

    // 更新對應債務的已付金額
    const { debts } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    await db.update(debts)
      .set({ 
        paidAmount: "100000.00",
        status: "partial"
      })
      .where(eq(debts.id, 17));

    console.log("✓ 已更新債務狀態");
    console.log("✓ 付款數據添加完成");

  } catch (error) {
    console.error("添加付款數據時發生錯誤:", error);
  }
}

// 執行添加付款數據
if (import.meta.url === `file://${process.argv[1]}`) {
  addRealPaymentData()
    .then(() => {
      console.log("付款數據腳本執行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("付款數據腳本執行失敗:", error);
      process.exit(1);
    });
}

export { addRealPaymentData };