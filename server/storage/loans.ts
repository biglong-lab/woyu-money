import { db } from "../db"
import {
  loanInvestmentRecords,
  loanPaymentSchedule,
  loanPaymentHistory,
  type LoanInvestmentRecord,
  type InsertLoanInvestmentRecord,
  type LoanPaymentHistory,
  type InsertLoanPaymentHistory,
} from "@shared/schema"
import { eq, and, sql, desc, ne, gte, lt, lte } from "drizzle-orm"
import { createAuditLog } from "./payment-items"

// === 借貸投資記錄 CRUD ===

export async function getLoanInvestmentRecords(): Promise<any[]> {
  try {
    const records = await db
      .select()
      .from(loanInvestmentRecords)
      .where(ne(loanInvestmentRecords.status, "cancelled"))
      .orderBy(desc(loanInvestmentRecords.createdAt))

    return records.map((record) => ({
      ...record,
      partyContact: record.partyContact || "",
      interestRate: record.interestRate || "0",
      partyNotes: record.partyNotes || "",
      annualInterestRate:
        record.annualInterestRate ||
        parseFloat(record.interestRate || "0"),
      interestPaymentMethod: record.interestPaymentMethod || "annual",
      hasAgreedReturn: record.hasAgreedReturn || false,
      isHighRisk:
        record.isHighRisk ||
        parseFloat(
          record.annualInterestRate || record.interestRate || "0"
        ) >= 15,
      documentNotes: record.documentNotes || "",
    }))
  } catch (error) {
    console.error("Error fetching loan investment records:", error)
    throw error
  }
}

export async function getLoanInvestmentRecord(id: number): Promise<any> {
  try {
    const [record] = await db
      .select()
      .from(loanInvestmentRecords)
      .where(eq(loanInvestmentRecords.id, id))

    if (!record) {
      return null
    }

    const schedule = await db
      .select()
      .from(loanPaymentSchedule)
      .where(eq(loanPaymentSchedule.recordId, id))
      .orderBy(loanPaymentSchedule.dueDate)

    const history = await db
      .select()
      .from(loanPaymentHistory)
      .where(eq(loanPaymentHistory.recordId, id))
      .orderBy(desc(loanPaymentHistory.paymentDate))

    return {
      ...record,
      paymentSchedule: schedule,
      paymentHistory: history,
    }
  } catch (error) {
    console.error("Error fetching loan investment record:", error)
    throw error
  }
}

export async function createLoanInvestmentRecord(
  recordData: InsertLoanInvestmentRecord
): Promise<LoanInvestmentRecord> {
  try {
    const [record] = await db
      .insert(loanInvestmentRecords)
      .values(recordData)
      .returning()

    if (
      record.recordType === "loan" &&
      record.paymentFrequency === "monthly" &&
      record.monthlyPaymentAmount
    ) {
      await generateLoanPaymentSchedule(record.id)
    }

    return record
  } catch (error) {
    console.error("Error creating loan investment record:", error)
    throw error
  }
}

export async function updateLoanInvestmentRecord(
  id: number,
  recordData: Partial<InsertLoanInvestmentRecord>
): Promise<LoanInvestmentRecord> {
  try {
    const [record] = await db
      .update(loanInvestmentRecords)
      .set({ ...recordData, updatedAt: new Date() })
      .where(eq(loanInvestmentRecords.id, id))
      .returning()

    return record
  } catch (error) {
    console.error("Error updating loan investment record:", error)
    throw error
  }
}

export async function deleteLoanInvestmentRecord(id: number): Promise<void> {
  try {
    await db
      .update(loanInvestmentRecords)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(loanInvestmentRecords.id, id))
  } catch (error) {
    console.error("Error deleting loan investment record:", error)
    throw error
  }
}

// === 還款計劃 ===

export async function generateLoanPaymentSchedule(
  recordId: number
): Promise<void> {
  try {
    const [record] = await db
      .select()
      .from(loanInvestmentRecords)
      .where(eq(loanInvestmentRecords.id, recordId))

    if (!record || !record.monthlyPaymentAmount || !record.startDate) {
      return
    }

    const scheduleItems = []
    const startDate = new Date(record.startDate)
    const endDate = record.endDate
      ? new Date(record.endDate)
      : new Date(
          startDate.getFullYear() + 1,
          startDate.getMonth(),
          startDate.getDate()
        )

    const currentDate = new Date(startDate)
    let monthCount = 0

    while (currentDate <= endDate && monthCount < 120) {
      const dueDate = new Date(currentDate)
      if (record.agreedPaymentDay) {
        dueDate.setDate(record.agreedPaymentDay)
      }

      scheduleItems.push({
        recordId: recordId,
        scheduleType: monthCount === 0 ? "principal" : "interest",
        dueDate: dueDate.toISOString().split("T")[0],
        amount: record.monthlyPaymentAmount,
        isPaid: false,
        notes: `${record.recordType === "loan" ? "借貸" : "投資"} 第${monthCount + 1}期付款`,
      })

      currentDate.setMonth(currentDate.getMonth() + 1)
      monthCount++
    }

    if (scheduleItems.length > 0) {
      await db.insert(loanPaymentSchedule).values(scheduleItems)
    }
  } catch (error) {
    console.error("Error generating loan payment schedule:", error)
    throw error
  }
}

// === 還款紀錄 ===

export async function addLoanPayment(
  recordId: number,
  paymentData: any
): Promise<LoanPaymentHistory> {
  try {
    const [record] = await db
      .select()
      .from(loanInvestmentRecords)
      .where(eq(loanInvestmentRecords.id, recordId))

    if (!record) {
      throw new Error("Loan investment record not found")
    }

    const currentPaid = parseFloat(record.totalPaidAmount || "0")
    const principalAmount = parseFloat(record.principalAmount)
    const paymentAmount = parseFloat(paymentData.amount)

    const remainingPrincipal = Math.max(
      0,
      principalAmount - currentPaid - paymentAmount
    )
    const remainingInterest = 0

    const insertData = {
      recordId: recordId,
      amount: paymentData.amount.toString(),
      paymentType: paymentData.paymentType,
      paymentDate: paymentData.paymentDate,
      paymentMethod: paymentData.paymentMethod,
      paymentStatus: paymentData.paymentStatus || "completed",
      isEarlyPayment: paymentData.isEarlyPayment || false,
      isLatePayment: paymentData.isLatePayment || false,
      hasReceipt: paymentData.hasReceipt || false,
      notes: paymentData.notes || null,
      communicationNotes: paymentData.communicationNotes || null,
      riskNotes: paymentData.riskNotes || null,
      receiptNotes: paymentData.receiptNotes || null,
      recordedBy: paymentData.recordedBy || "System",
      isVerified: paymentData.isVerified || false,
      remainingPrincipal: remainingPrincipal.toString(),
      remainingInterest: remainingInterest.toString(),
      receiptFileUrl: paymentData.receiptFileUrl || null,
      verifiedBy: paymentData.verifiedBy || null,
      scheduleId: paymentData.scheduleId || null,
    }

    const [payment] = await db
      .insert(loanPaymentHistory)
      .values(insertData)
      .returning()

    const newPaid = currentPaid + paymentAmount

    await db
      .update(loanInvestmentRecords)
      .set({
        totalPaidAmount: newPaid.toString(),
        updatedAt: new Date(),
      })
      .where(eq(loanInvestmentRecords.id, recordId))

    if (payment.scheduleId) {
      await db
        .update(loanPaymentSchedule)
        .set({
          isPaid: true,
          paidDate: paymentData.paymentDate,
          paidAmount: paymentData.amount,
        })
        .where(eq(loanPaymentSchedule.id, payment.scheduleId))
    }

    if (newPaid >= principalAmount) {
      await db
        .update(loanInvestmentRecords)
        .set({ status: "completed" })
        .where(eq(loanInvestmentRecords.id, recordId))
    }

    return payment
  } catch (error) {
    console.error("Error adding loan payment:", error)
    throw error
  }
}

export async function getLoanPaymentHistory(
  recordId: number
): Promise<LoanPaymentHistory[]> {
  try {
    return await db
      .select()
      .from(loanPaymentHistory)
      .where(eq(loanPaymentHistory.recordId, recordId))
      .orderBy(
        desc(loanPaymentHistory.paymentDate),
        desc(loanPaymentHistory.createdAt)
      )
  } catch (error) {
    console.error("Error fetching loan payment history:", error)
    throw error
  }
}

export async function updateLoanPaymentHistory(
  id: number,
  paymentData: Partial<InsertLoanPaymentHistory>
): Promise<LoanPaymentHistory> {
  try {
    const [payment] = await db
      .update(loanPaymentHistory)
      .set({
        ...paymentData,
        updatedAt: new Date(),
      })
      .where(eq(loanPaymentHistory.id, id))
      .returning()

    if (payment) {
      await createAuditLog({
        tableName: "loan_payment_history",
        recordId: payment.id,
        action: "UPDATE",
        oldValues: {},
        newValues: paymentData,
        changedFields: Object.keys(paymentData),
        userInfo: paymentData.recordedBy || "系統",
        changeReason: "更新還款紀錄",
      })
    }

    return payment
  } catch (error) {
    console.error("Error updating loan payment history:", error)
    throw error
  }
}

export async function deleteLoanPaymentHistory(id: number): Promise<void> {
  try {
    const [payment] = await db
      .select()
      .from(loanPaymentHistory)
      .where(eq(loanPaymentHistory.id, id))

    if (payment) {
      const [record] = await db
        .select()
        .from(loanInvestmentRecords)
        .where(eq(loanInvestmentRecords.id, payment.recordId))

      if (record) {
        const currentPaid = parseFloat(record.totalPaidAmount || "0")
        const paymentAmount = parseFloat(payment.amount)
        const newPaid = Math.max(0, currentPaid - paymentAmount)

        await db
          .update(loanInvestmentRecords)
          .set({
            totalPaidAmount: newPaid.toString(),
            updatedAt: new Date(),
          })
          .where(eq(loanInvestmentRecords.id, payment.recordId))

        if (payment.scheduleId) {
          await db
            .update(loanPaymentSchedule)
            .set({
              isPaid: false,
              paidDate: null,
              paidAmount: null,
            })
            .where(eq(loanPaymentSchedule.id, payment.scheduleId))
        }
      }

      await db.delete(loanPaymentHistory).where(eq(loanPaymentHistory.id, id))

      await createAuditLog({
        tableName: "loan_payment_history",
        recordId: payment.id,
        action: "DELETE",
        oldValues: {
          amount: payment.amount,
          paymentType: payment.paymentType,
          paymentMethod: payment.paymentMethod,
        },
        newValues: {},
        changedFields: ["deleted"],
        userInfo: "系統",
        changeReason: "刪除還款紀錄",
      })
    }
  } catch (error) {
    console.error("Error deleting loan payment history:", error)
    throw error
  }
}

export async function verifyLoanPayment(
  id: number,
  verifiedBy: string,
  notes?: string
): Promise<LoanPaymentHistory> {
  try {
    const [payment] = await db
      .update(loanPaymentHistory)
      .set({
        isVerified: true,
        verifiedBy: verifiedBy,
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(loanPaymentHistory.id, id))
      .returning()

    if (payment) {
      await createAuditLog({
        tableName: "loan_payment_history",
        recordId: payment.id,
        action: "VERIFY",
        oldValues: { isVerified: false },
        newValues: { isVerified: true, verifiedBy: verifiedBy },
        changedFields: ["isVerified", "verifiedBy"],
        userInfo: verifiedBy,
        changeReason: "驗證還款紀錄",
      })
    }

    return payment
  } catch (error) {
    console.error("Error verifying loan payment:", error)
    throw error
  }
}

// === 借貸統計 ===

export async function getLoanPaymentStatistics(recordId: number): Promise<{
  totalPayments: number
  totalAmount: string
  verifiedPayments: number
  pendingVerification: number
  latePayments: number
  earlyPayments: number
  paymentMethods: Array<{ method: string; count: number; amount: string }>
}> {
  try {
    const [basicStats] = await db
      .select({
        totalPayments: sql<number>`COUNT(*)`,
        totalAmount: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
        verifiedPayments: sql<number>`COUNT(CASE WHEN is_verified = true THEN 1 END)`,
        pendingVerification: sql<number>`COUNT(CASE WHEN is_verified = false THEN 1 END)`,
        latePayments: sql<number>`COUNT(CASE WHEN is_late_payment = true THEN 1 END)`,
        earlyPayments: sql<number>`COUNT(CASE WHEN is_early_payment = true THEN 1 END)`,
      })
      .from(loanPaymentHistory)
      .where(eq(loanPaymentHistory.recordId, recordId))

    const paymentMethods = await db
      .select({
        method: loanPaymentHistory.paymentMethod,
        count: sql<number>`COUNT(*)`,
        amount: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
      })
      .from(loanPaymentHistory)
      .where(eq(loanPaymentHistory.recordId, recordId))
      .groupBy(loanPaymentHistory.paymentMethod)
      .orderBy(sql`COUNT(*) DESC`)

    return {
      totalPayments: basicStats?.totalPayments || 0,
      totalAmount: basicStats?.totalAmount || "0",
      verifiedPayments: basicStats?.verifiedPayments || 0,
      pendingVerification: basicStats?.pendingVerification || 0,
      latePayments: basicStats?.latePayments || 0,
      earlyPayments: basicStats?.earlyPayments || 0,
      paymentMethods: paymentMethods || [],
    }
  } catch (error) {
    console.error("Error fetching loan payment statistics:", error)
    throw error
  }
}

export async function getLoanInvestmentStats(): Promise<any> {
  try {
    const [loanStats] = await db
      .select({
        totalLoanAmount: sql<string>`COALESCE(SUM(CASE WHEN record_type = 'loan' THEN principal_amount::numeric ELSE 0 END), 0)`,
        activeLoanAmount: sql<string>`COALESCE(SUM(CASE WHEN record_type = 'loan' AND status = 'active' THEN principal_amount::numeric ELSE 0 END), 0)`,
        totalInvestmentAmount: sql<string>`COALESCE(SUM(CASE WHEN record_type = 'investment' THEN principal_amount::numeric ELSE 0 END), 0)`,
        activeInvestmentAmount: sql<string>`COALESCE(SUM(CASE WHEN record_type = 'investment' AND status = 'active' THEN principal_amount::numeric ELSE 0 END), 0)`,
      })
      .from(loanInvestmentRecords)
      .where(ne(loanInvestmentRecords.status, "cancelled"))

    const currentDate = new Date()
    const thisMonthStart = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}-01`
    const nextMonthStart = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 2).toString().padStart(2, "0")}-01`

    const [thisMonthDue] = await db
      .select({
        amount: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
      })
      .from(loanPaymentSchedule)
      .where(
        and(
          gte(loanPaymentSchedule.dueDate, thisMonthStart),
          lt(loanPaymentSchedule.dueDate, nextMonthStart),
          eq(loanPaymentSchedule.isPaid, false)
        )
      )

    const nextMonthEnd = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 3).toString().padStart(2, "0")}-01`
    const [nextMonthDue] = await db
      .select({
        amount: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
      })
      .from(loanPaymentSchedule)
      .where(
        and(
          gte(loanPaymentSchedule.dueDate, nextMonthStart),
          lt(loanPaymentSchedule.dueDate, nextMonthEnd),
          eq(loanPaymentSchedule.isPaid, false)
        )
      )

    const [monthlyInterest] = await db
      .select({
        amount: sql<string>`COALESCE(SUM(principal_amount::numeric * COALESCE(annual_interest_rate, CAST(interest_rate AS DECIMAL(5,2)))::numeric / 100 / 12), 0)`,
      })
      .from(loanInvestmentRecords)
      .where(
        and(
          eq(loanInvestmentRecords.status, "active"),
          sql`COALESCE(annual_interest_rate, CAST(interest_rate AS DECIMAL(5,2))) > 0`
        )
      )

    const [highRiskCount] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(loanInvestmentRecords)
      .where(
        and(
          eq(loanInvestmentRecords.status, "active"),
          sql`COALESCE(annual_interest_rate, CAST(interest_rate AS DECIMAL(5,2))) >= 15`
        )
      )

    return {
      totalLoanAmount: loanStats?.totalLoanAmount || "0",
      activeLoanAmount: loanStats?.activeLoanAmount || "0",
      totalInvestmentAmount: loanStats?.totalInvestmentAmount || "0",
      activeInvestmentAmount: loanStats?.activeInvestmentAmount || "0",
      thisMonthDue: thisMonthDue?.amount || "0",
      nextMonthDue: nextMonthDue?.amount || "0",
      monthlyInterest: monthlyInterest?.amount || "0",
      yearlyInterest: (
        parseFloat(monthlyInterest?.amount || "0") * 12
      ).toString(),
      highRiskCount: highRiskCount?.count || 0,
      dueSoonAmount: (
        parseFloat(thisMonthDue?.amount || "0") +
        parseFloat(nextMonthDue?.amount || "0")
      ).toString(),
    }
  } catch (error) {
    console.error("Error fetching loan investment stats:", error)
    throw error
  }
}
