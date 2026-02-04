import { db } from "./db";
import { 
  familyMembers, 
  allowanceManagement, 
  allowancePayments,
  achievements,
  kidsAchievements,
  loanRequests,
  parentApprovals,
  kidsSavings,
  kidsWishlist,
  kidsLoans
} from "@shared/schema";

async function seedParentManagementData() {
  console.log("Starting parent management data seeding...");

  try {
    // 1. Create parent member first
    const [parent] = await db.insert(familyMembers).values({
      name: "爸爸媽媽",
      memberType: "adult",
      age: 35,
      avatar: "👨‍👩‍👧‍👦",
      preferences: "管理家庭財務和孩子教育"
    }).returning();

    console.log("✓ Created parent member:", parent.name);

    // 2. Create family members (children)
    const children = await db.insert(familyMembers).values([
      {
        name: "小明",
        memberType: "child",
        age: 9,
        avatar: "👦",
        voicePassword: "小明的聲音",
        preferences: "喜歡樂高和科學實驗"
      },
      {
        name: "小美",
        memberType: "child",
        age: 9,
        avatar: "👧",
        voicePassword: "小美的聲音",
        preferences: "喜歡畫畫和音樂"
      },
      {
        name: "小傑",
        memberType: "child",
        age: 6,
        avatar: "🧒",
        voicePassword: "小傑的聲音",
        preferences: "喜歡玩具車和遊戲"
      }
    ]).returning();

    console.log("✓ Created family members:", children.length);

    // 3. Create allowance management settings
    const allowanceSettings = await db.insert(allowanceManagement).values([
      {
        childId: children[0].id,
        parentId: parent.id,
        amount: 100.00,
        frequency: "weekly",
        nextPaymentDate: new Date("2024-06-08"),
        isActive: true,
        conditions: "完成家事和功課"
      },
      {
        childId: children[1].id,
        parentId: parent.id,
        amount: 100.00,
        frequency: "weekly", 
        nextPaymentDate: new Date("2024-06-08"),
        isActive: true,
        conditions: "保持房間整潔"
      },
      {
        childId: children[2].id,
        parentId: parent.id,
        amount: 50.00,
        frequency: "weekly",
        nextPaymentDate: new Date("2024-06-08"),
        isActive: true,
        conditions: "乖乖聽話"
      }
    ]).returning();

    console.log("✓ Created allowance settings:", allowanceSettings.length);

    // 4. Create some allowance payment history
    const paymentHistory = await db.insert(allowancePayments).values([
      {
        parentId: parent.id,
        childId: children[0].id,
        allowanceId: allowanceSettings[0].id,
        amount: 100.00,
        paymentDate: new Date("2024-06-01")
      },
      {
        parentId: parent.id,
        childId: children[1].id,
        allowanceId: allowanceSettings[1].id,
        amount: 100.00, 
        paymentDate: new Date("2024-06-01")
      },
      {
        parentId: parent.id,
        childId: children[2].id,
        allowanceId: allowanceSettings[2].id,
        amount: 50.00,
        paymentDate: new Date("2024-06-01")
      }
    ]).returning();

    console.log("✓ Created payment history:", paymentHistory.length);

    // 5. Create achievements system
    const achievementsList = await db.insert(achievements).values([
      {
        name: "儲蓄小達人",
        description: "連續儲錢一個月",
        type: "saving",
        points: 100,
        icon: "💰",
        criteria: { requirement: "連續30天有儲錢記錄", minAmount: 30, minDays: 30 },
        isActive: true
      },
      {
        name: "理財規劃師",
        description: "制定並執行儲錢計劃",
        type: "goal",
        points: 150,
        icon: "📊", 
        criteria: { requirement: "設定儲錢目標並達成50%", targetPercent: 50 },
        isActive: true
      },
      {
        name: "借貸小專家",
        description: "按時還清借款",
        type: "task",
        points: 200,
        icon: "🎯",
        criteria: { requirement: "準時還清至少一筆借款", minLoans: 1 },
        isActive: true
      },
      {
        name: "時間管理大師",
        description: "完成所有計劃任務",
        type: "task", 
        points: 120,
        icon: "⏰",
        criteria: { requirement: "一週內完成所有排程任務", completionRate: 100 },
        isActive: true
      }
    ]).returning();

    console.log("✓ Created achievements:", achievementsList.length);

    // 5. Award some achievements to kids
    const kidsAchievementRecords = await db.insert(kidsAchievements).values([
      {
        childId: children[0].id,
        achievementId: achievementsList[0].id,
        earnedDate: new Date("2024-06-01"),
        description: "連續儲錢30天"
      },
      {
        childId: children[1].id,
        achievementId: achievementsList[1].id,
        earnedDate: new Date("2024-06-02"),
        description: "成功制定儲錢計劃"
      }
    ]).returning();

    console.log("✓ Created kids achievements:", kidsAchievementRecords.length);

    // 7. Create some loan requests (pending and approved)
    const loanRequestsList = await db.insert(loanRequests).values([
      {
        childId: children[0].id,
        parentId: parent.id,
        amount: 200.00,
        purpose: "買新的樂高積木",
        requestDate: new Date("2024-06-03"),
        status: "pending",
        repaymentPlan: "每週還50元",
        interestRate: 0.00
      },
      {
        childId: children[1].id,
        parentId: parent.id,
        amount: 150.00,
        purpose: "買美術用品",
        requestDate: new Date("2024-06-02"),
        status: "approved",
        repaymentPlan: "每週還30元",
        interestRate: 0.00,
        approvalNotes: "同意購買學習用品"
      },
      {
        childId: children[2].id,
        parentId: parent.id,
        amount: 80.00,
        purpose: "買新玩具車",
        requestDate: new Date("2024-06-04"),
        status: "pending",
        repaymentPlan: "每週還20元",
        interestRate: 0.00
      }
    ]).returning();

    console.log("✓ Created loan requests:", loanRequestsList.length);

    // 8. Create parent approval records
    const parentApprovalRecords = await db.insert(parentApprovals).values([
      {
        parentId: parent.id,
        childId: children[1].id,
        requestType: "loan",
        requestId: loanRequestsList[1].id,
        action: "approved",
        notes: "學習用品值得投資"
      }
    ]).returning();

    console.log("✓ Created parent approvals:", parentApprovalRecords.length);

    // 9. Create kids savings records
    const savingsRecords = await db.insert(kidsSavings).values([
      {
        childId: children[0].id,
        amount: 100.00,
        source: "allowance",
        description: "每週零用錢存款",
        savingDate: "2024-06-01"
      },
      {
        childId: children[0].id,
        amount: 50.00, 
        source: "chore",
        description: "幫忙做家事獎勵",
        savingDate: "2024-06-02"
      },
      {
        childId: children[1].id,
        amount: 100.00,
        source: "allowance",
        description: "每週零用錢存款", 
        savingDate: "2024-06-01"
      },
      {
        childId: children[1].id,
        amount: 30.00,
        source: "bonus",
        description: "考試100分獎勵",
        savingDate: "2024-06-03"
      },
      {
        childId: children[2].id,
        amount: 50.00,
        source: "allowance",
        description: "每週零用錢存款",
        savingDate: "2024-06-01"
      }
    ]).returning();

    console.log("✓ Created savings records:", savingsRecords.length);

    // 9. Create wishlist items
    const wishlistItems = await db.insert(kidsWishlist).values([
      {
        childId: children[0].id,
        itemName: "樂高城堡系列",
        itemPrice: "800.00",
        status: "active",
        priority: 1,
        targetDate: "2024-07-01T00:00:00.000Z",
        savedAmount: "150.00",
        image: "🏰",
        notes: "生日禮物"
      },
      {
        childId: children[1].id,
        itemName: "水彩顏料組",
        itemPrice: "300.00",
        status: "active",
        priority: 1,
        targetDate: "2024-06-15T00:00:00.000Z", 
        savedAmount: "130.00",
        image: "🎨",
        notes: "美術課需要"
      },
      {
        childId: children[2].id,
        itemName: "遙控汽車",
        itemPrice: "200.00",
        status: "active",
        priority: 1,
        targetDate: "2024-06-20T00:00:00.000Z",
        savedAmount: "50.00", 
        image: "🚗",
        notes: "想要的玩具"
      }
    ]).returning();

    console.log("✓ Created wishlist items:", wishlistItems.length);

    // 10. Create kids loan records (for approved loans)
    const kidsLoanRecords = await db.insert(kidsLoans).values([
      {
        childId: children[1].id,
        amount: 150.00,
        purpose: "買美術用品",
        loanDate: "2024-06-02",
        status: "active",
        paidAmount: 30.00,
        repaymentPlan: "每週還30元",
        interestRate: 0.00
      }
    ]).returning();

    console.log("✓ Created kids loan records:", kidsLoanRecords.length);

    console.log("\n🎉 Parent management data seeding completed successfully!");
    console.log(`
📊 Data Summary:
   • Family Members: ${children.length}
   • Allowance Settings: ${allowanceSettings.length}
   • Payment History: ${paymentHistory.length}
   • Achievements: ${achievementsList.length}
   • Kids Achievements: ${kidsAchievementRecords.length}
   • Loan Requests: ${loanRequestsList.length}
   • Parent Approvals: ${parentApprovalRecords.length}
   • Savings Records: ${savingsRecords.length}
   • Wishlist Items: ${wishlistItems.length}
   • Kids Loans: ${kidsLoanRecords.length}
    `);

  } catch (error) {
    console.error("❌ Error seeding parent management data:", error);
    throw error;
  }
}

// Run the seeding function
seedParentManagementData()
  .then(() => {
    console.log("✅ Seeding completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });

export { seedParentManagementData };