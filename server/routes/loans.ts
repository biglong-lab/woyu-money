import { Router } from "express"
import { storage } from "../storage"
import {
  insertLoanInvestmentRecordSchema,
  insertLoanPaymentHistorySchema,
} from "@shared/schema"
import OpenAI from "openai"

const router = Router()

// 取得所有借貸投資記錄
router.get("/api/loan-investment/records", async (req, res) => {
  try {
    const records = await storage.getLoanInvestmentRecords()
    res.json(records)
  } catch (error: any) {
    console.error("Error fetching loan investment records:", error)
    res.status(500).json({ message: "Failed to fetch loan investment records" })
  }
})

// 取得單筆借貸投資記錄
router.get("/api/loan-investment/records/:id", async (req, res) => {
  try {
    const recordId = parseInt(req.params.id)
    const record = await storage.getLoanInvestmentRecord(recordId)

    if (!record) {
      return res.status(404).json({ message: "Record not found" })
    }

    res.json(record)
  } catch (error: any) {
    console.error("Error fetching loan investment record:", error)
    res.status(500).json({ message: "Failed to fetch loan investment record" })
  }
})

// 建立借貸投資記錄
router.post("/api/loan-investment/records", async (req, res) => {
  try {
    const validatedData = insertLoanInvestmentRecordSchema.parse(req.body)
    const record = await storage.createLoanInvestmentRecord(validatedData)
    res.status(201).json(record)
  } catch (error: any) {
    console.error("Error creating loan investment record:", error)
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid data", errors: error.errors })
    }
    res.status(500).json({ message: "Failed to create loan investment record" })
  }
})

// 更新借貸投資記錄
router.put("/api/loan-investment/records/:id", async (req, res) => {
  try {
    const recordId = parseInt(req.params.id)
    const validatedData = insertLoanInvestmentRecordSchema.partial().parse(req.body)
    const record = await storage.updateLoanInvestmentRecord(recordId, validatedData)
    res.json(record)
  } catch (error: any) {
    console.error("Error updating loan investment record:", error)
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid data", errors: error.errors })
    }
    res.status(500).json({ message: "Failed to update loan investment record" })
  }
})

// 刪除借貸投資記錄
router.delete("/api/loan-investment/records/:id", async (req, res) => {
  try {
    const recordId = parseInt(req.params.id)
    await storage.deleteLoanInvestmentRecord(recordId)
    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting loan investment record:", error)
    res.status(500).json({ message: "Failed to delete loan investment record" })
  }
})

// 新增還款記錄
router.post("/api/loan-investment/records/:id/payments", async (req, res) => {
  try {
    const recordId = parseInt(req.params.id)

    if (!req.body.amount || !req.body.paymentType || !req.body.paymentMethod) {
      return res.status(400).json({ message: "Missing required fields: amount, paymentType, paymentMethod" })
    }

    const paymentData = {
      recordId: recordId,
      amount: req.body.amount,
      paymentType: req.body.paymentType || "interest",
      paymentDate: req.body.paymentDate || new Date().toISOString().split("T")[0],
      paymentMethod: req.body.paymentMethod || "bank_transfer",
      paymentStatus: req.body.paymentStatus || "completed",
      notes: req.body.notes || null,
      communicationNotes: req.body.communicationNotes || null,
      riskNotes: req.body.riskNotes || null,
      receiptNotes: req.body.receiptNotes || null,
      recordedBy: req.body.recordedBy || "System",
      isEarlyPayment: req.body.isEarlyPayment || false,
      isLatePayment: req.body.isLatePayment || false,
      hasReceipt: req.body.hasReceipt || false,
      isVerified: req.body.isVerified || false,
    }

    const payment = await storage.addLoanPayment(recordId, paymentData)
    res.status(201).json(payment)
  } catch (error: any) {
    console.error("Error adding loan payment:", error)
    res.status(500).json({ message: "Failed to add loan payment", error: error.message })
  }
})

// 取得還款歷史
router.get("/api/loan-investment/records/:id/payments", async (req, res) => {
  try {
    const recordId = parseInt(req.params.id)
    const payments = await storage.getLoanPaymentHistory(recordId)
    res.json(payments)
  } catch (error: any) {
    console.error("Error fetching loan payment history:", error)
    res.status(500).json({ message: "Failed to fetch loan payment history" })
  }
})

// 更新還款記錄
router.put("/api/loan-investment/payments/:id", async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id)
    const validatedData = insertLoanPaymentHistorySchema.partial().parse(req.body)
    const payment = await storage.updateLoanPaymentHistory(paymentId, validatedData)
    res.json(payment)
  } catch (error: any) {
    console.error("Error updating loan payment:", error)
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid data", errors: error.errors })
    }
    res.status(500).json({ message: "Failed to update loan payment" })
  }
})

// 刪除還款記錄
router.delete("/api/loan-investment/payments/:id", async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id)
    await storage.deleteLoanPaymentHistory(paymentId)
    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting loan payment:", error)
    res.status(500).json({ message: "Failed to delete loan payment" })
  }
})

// 驗證還款記錄
router.patch("/api/loan-investment/payments/:id/verify", async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id)
    const { verifiedBy, notes } = req.body

    if (!verifiedBy) {
      return res.status(400).json({ message: "verifiedBy is required" })
    }

    const payment = await storage.verifyLoanPayment(paymentId, verifiedBy, notes)
    res.json(payment)
  } catch (error: any) {
    console.error("Error verifying loan payment:", error)
    res.status(500).json({ message: "Failed to verify loan payment" })
  }
})

// 取得還款統計
router.get("/api/loan-investment/records/:id/payment-stats", async (req, res) => {
  try {
    const recordId = parseInt(req.params.id)
    const stats = await storage.getLoanPaymentStatistics(recordId)
    res.json(stats)
  } catch (error: any) {
    console.error("Error fetching loan payment statistics:", error)
    res.status(500).json({ message: "Failed to fetch loan payment statistics" })
  }
})

// 取得總體統計
router.get("/api/loan-investment/stats", async (req, res) => {
  try {
    const stats = await storage.getLoanInvestmentStats()
    res.json(stats)
  } catch (error: any) {
    console.error("Error fetching loan investment stats:", error)
    res.status(500).json({ message: "Failed to fetch loan investment stats" })
  }
})

// 智能利息計算
router.post("/api/loan-investment/calculate", async (req, res) => {
  try {
    const {
      principalAmount,
      interestRate,
      repaymentMode,
      repaymentYears,
      graceMonths,
    } = req.body

    const principal = parseFloat(principalAmount)
    const rate = parseFloat(interestRate) / 100
    const monthlyRate = rate / 12

    let calculations: any = {
      principal: principal,
      annualRate: rate * 100,
      monthlyRate: monthlyRate * 100,
    }

    if (repaymentMode === "principal_and_interest") {
      const totalMonths = repaymentYears * 12
      const graceInterestOnly = graceMonths || 0
      const amortizationMonths = totalMonths - graceInterestOnly

      const monthlyInterestOnly = principal * monthlyRate
      const monthlyPayment =
        (principal * (monthlyRate * Math.pow(1 + monthlyRate, amortizationMonths))) /
        (Math.pow(1 + monthlyRate, amortizationMonths) - 1)
      const monthlyPrincipalPayment = monthlyPayment - monthlyInterestOnly

      calculations = {
        ...calculations,
        repaymentMode: "principal_and_interest",
        totalMonths,
        graceMonths: graceInterestOnly,
        amortizationMonths,
        monthlyInterestOnly: Math.round(monthlyInterestOnly),
        monthlyPayment: Math.round(monthlyPayment),
        monthlyPrincipal: Math.round(monthlyPrincipalPayment),
        totalGraceInterest: Math.round(monthlyInterestOnly * graceInterestOnly),
        totalAmortizationPayment: Math.round(monthlyPayment * amortizationMonths),
        totalPayment: Math.round(
          monthlyInterestOnly * graceInterestOnly + monthlyPayment * amortizationMonths
        ),
        totalInterest: Math.round(
          monthlyInterestOnly * graceInterestOnly +
            monthlyPayment * amortizationMonths -
            principal
        ),
        interestSavings: 0,
      }
    } else if (repaymentMode === "interest_only") {
      const monthlyInterest = principal * monthlyRate
      const totalMonths = repaymentYears ? repaymentYears * 12 : 0

      calculations = {
        ...calculations,
        repaymentMode: "interest_only",
        monthlyInterest: Math.round(monthlyInterest),
        totalMonths: totalMonths || "無限期",
        totalInterest: totalMonths
          ? Math.round(monthlyInterest * totalMonths)
          : "依實際付息期間",
        totalPayment: totalMonths
          ? Math.round(principal + monthlyInterest * totalMonths)
          : principal + "+ 利息",
        finalPrincipalPayment: principal,
      }
    } else if (repaymentMode === "lump_sum") {
      const totalMonths = repaymentYears * 12
      const totalAmount = principal * Math.pow(1 + monthlyRate, totalMonths)

      calculations = {
        ...calculations,
        repaymentMode: "lump_sum",
        totalMonths,
        finalPayment: Math.round(totalAmount),
        totalInterest: Math.round(totalAmount - principal),
        monthlyAccrual: Math.round((totalAmount - principal) / totalMonths),
      }
    }

    res.json(calculations)
  } catch (error) {
    console.error("Error calculating loan:", error)
    res.status(500).json({ message: "Failed to calculate loan terms" })
  }
})

// AI 借貸建議
router.post("/api/loan-investment/advice", async (req, res) => {
  try {
    const { calculations } = req.body

    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ message: "OpenAI API key not configured" })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const prompt = `作為專業理財顧問，請分析以下借貸情況並提供建議：

借貸詳情：
- 本金：${calculations.principal.toLocaleString()} 元
- 年息率：${calculations.annualRate}%
- 攤還模式：${calculations.repaymentMode === "principal_and_interest" ? "本息攤還" : calculations.repaymentMode === "interest_only" ? "只付利息" : "到期一次還"}
- 總利息：${typeof calculations.totalInterest === "number" ? calculations.totalInterest.toLocaleString() : calculations.totalInterest} 元
- 總還款：${typeof calculations.totalPayment === "number" ? calculations.totalPayment.toLocaleString() : calculations.totalPayment} 元

請提供以下建議：
1. 風險評估（特別是年息${calculations.annualRate}%的合理性）
2. 還款策略建議
3. 替代方案建議
4. 注意事項

請用繁體中文回答，內容要實用且易懂。`

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "你是一位專業的理財顧問，擅長分析借貸風險和提供實用的理財建議。請用繁體中文提供專業、客觀、實用的建議。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const advice = response.choices[0].message.content
    res.json({ advice })
  } catch (error) {
    console.error("Error generating loan advice:", error)
    res.status(500).json({ message: "Failed to generate loan advice" })
  }
})

export default router
