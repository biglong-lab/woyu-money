import { Router } from "express"
import { storage } from "../storage"
import {
  insertRentalContractSchema,
  insertRentalPriceTierSchema,
} from "@shared/schema"
import * as XLSX from "xlsx"

const router = Router()

// 取得所有租約
router.get("/api/rental/contracts", async (req, res) => {
  try {
    const contracts = await storage.getRentalContracts()
    res.json(contracts)
  } catch (error: any) {
    console.error("Error fetching rental contracts:", error)
    res.status(500).json({ message: "Failed to fetch rental contracts" })
  }
})

// 取得單一租約
router.get("/api/rental/contracts/:id", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id)
    const contract = await storage.getRentalContract(contractId)
    if (!contract) {
      return res.status(404).json({ message: "Contract not found" })
    }
    res.json(contract)
  } catch (error: any) {
    console.error("Error fetching rental contract:", error)
    res.status(500).json({ message: "Failed to fetch rental contract" })
  }
})

// 建立租約
router.post("/api/rental/contracts", async (req, res) => {
  try {
    const { priceTiers, ...contractData } = req.body
    const validatedContract = insertRentalContractSchema.parse(contractData)

    let validatedPriceTiers: any[] = []
    if (priceTiers && priceTiers.length > 0) {
      validatedPriceTiers = priceTiers.map((tier: any) =>
        insertRentalPriceTierSchema.omit({ contractId: true }).parse(tier)
      )
    }

    const contract = await storage.createRentalContract(validatedContract, validatedPriceTiers)
    res.status(201).json(contract)
  } catch (error: any) {
    console.error("Error creating rental contract:", error)
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid data", errors: error.errors })
    }
    res.status(500).json({ message: "Failed to create rental contract" })
  }
})

// 更新租約
router.put("/api/rental/contracts/:id", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id)
    const { priceTiers, ...contractData } = req.body
    const validatedData = insertRentalContractSchema.partial().parse(contractData)

    const contract = await storage.updateRentalContract(contractId, validatedData)

    if (priceTiers) {
      await storage.deleteRentalPriceTiersByContract(contractId)
      for (const tier of priceTiers) {
        const validatedTier = insertRentalPriceTierSchema.parse({
          ...tier,
          contractId: contractId,
        })
        await storage.createRentalPriceTier(validatedTier)
      }
    }

    res.json(contract)
  } catch (error: any) {
    console.error("Error updating rental contract:", error)
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid data", errors: error.errors })
    }
    res.status(500).json({ message: "Failed to update rental contract" })
  }
})

// 刪除租約
router.delete("/api/rental/contracts/:id", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id)
    await storage.deleteRentalContract(contractId)
    res.json({ message: "Contract deleted successfully" })
  } catch (error: any) {
    console.error("Error deleting rental contract:", error)
    res.status(500).json({ message: "Failed to delete rental contract" })
  }
})

// 取得租約價格層級
router.get("/api/rental/contracts/:id/price-tiers", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id)
    const tiers = await storage.getRentalPriceTiers(contractId)
    res.json(tiers)
  } catch (error: any) {
    console.error("Error fetching rental price tiers:", error)
    res.status(500).json({ message: "Failed to fetch rental price tiers" })
  }
})

// 取得租約付款
router.get("/api/rental/contracts/:id/payments", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id)
    const payments = await storage.getRentalContractPayments(contractId)
    res.json(payments)
  } catch (error: any) {
    console.error("Error fetching rental contract payments:", error)
    res.status(500).json({ message: "Failed to fetch rental contract payments" })
  }
})

// 生成租約付款
router.post("/api/rental/contracts/:id/generate-payments", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id)
    const result = await storage.generateRentalPayments(contractId)
    res.json(result)
  } catch (error: any) {
    console.error("Error generating rental payments:", error)
    res.status(500).json({ message: "Failed to generate rental payments" })
  }
})

// 取得租約統計
router.get("/api/rental/stats", async (req, res) => {
  try {
    const stats = await storage.getRentalStats()
    res.json(stats)
  } catch (error: any) {
    console.error("Error fetching rental stats:", error)
    res.status(500).json({ message: "Failed to fetch rental stats" })
  }
})

// 取得所有租金付款
router.get("/api/rental/payments", async (req, res) => {
  try {
    const payments = await storage.getRentalPaymentItems()
    res.json(payments)
  } catch (error: any) {
    console.error("Error fetching rental payments:", error)
    res.status(500).json({ message: "Failed to fetch rental payments" })
  }
})

// 匯出租金付款記錄
router.get("/api/rental/payments/export", async (req, res) => {
  try {
    const { year, contractId, format = "excel", includeDetails = "true" } = req.query

    const allPayments = await storage.getRentalPaymentItems()

    let filteredPayments = allPayments
    if (year) {
      const yearNum = parseInt(year as string)
      filteredPayments = allPayments.filter((p: any) => {
        const dateToCheck = p.dueDate || p.startDate
        if (!dateToCheck) return false
        const paymentYear = new Date(dateToCheck).getFullYear()
        return paymentYear === yearNum
      })
    }

    if (contractId && contractId !== "all") {
      const contractIdNum = parseInt(contractId as string)
      filteredPayments = filteredPayments.filter((p: any) => p.contractId === contractIdNum)
    }

    filteredPayments.sort((a: any, b: any) => {
      const dateA = new Date(a.dueDate || a.startDate || 0)
      const dateB = new Date(b.dueDate || b.startDate || 0)
      return dateA.getTime() - dateB.getTime()
    })

    const exportData = filteredPayments.map((payment: any) => {
      const isPaid = payment.status === "paid"
      const baseRow: any = {
        期別: payment.itemName || "",
        合約名稱: payment.projectName || payment.rentalContract?.propertyName || "",
        租金金額: parseFloat(payment.totalAmount) || 0,
        到期日: payment.dueDate || payment.startDate || "",
        付款狀態: isPaid ? "已付款" : "未付款",
        付款日期: payment.paymentDate || "",
        付款方式: payment.paymentMethod || "",
        備註: payment.notes || "",
      }
      if (includeDetails === "true") {
        baseRow["項目ID"] = payment.id
        baseRow["合約ID"] = payment.contractId || ""
        baseRow["分類"] = payment.categoryName || "租金"
      }
      return baseRow
    })

    const totalAmount = filteredPayments.reduce(
      (sum: number, p: any) => sum + (parseFloat(p.totalAmount) || 0),
      0
    )
    const paidCount = filteredPayments.filter((p: any) => p.status === "paid").length
    const unpaidCount = filteredPayments.length - paidCount
    const paidAmount = filteredPayments
      .filter((p: any) => p.status === "paid")
      .reduce((sum: number, p: any) => sum + (parseFloat(p.totalAmount) || 0), 0)
    const unpaidAmount = totalAmount - paidAmount
    const completionRate = totalAmount > 0 ? ((paidAmount / totalAmount) * 100).toFixed(1) : "0"

    const quarterlyStats = year
      ? [1, 2, 3, 4].map((q) => {
          const qPayments = filteredPayments.filter((p: any) => {
            const dateToCheck = p.dueDate || p.startDate
            if (!dateToCheck) return false
            const month = new Date(dateToCheck).getMonth() + 1
            const quarter = Math.ceil(month / 3)
            return quarter === q
          })
          const qTotal = qPayments.reduce(
            (sum: number, p: any) => sum + (parseFloat(p.totalAmount) || 0),
            0
          )
          const qPaid = qPayments
            .filter((p: any) => p.status === "paid")
            .reduce((sum: number, p: any) => sum + (parseFloat(p.totalAmount) || 0), 0)
          return {
            quarter: `Q${q}`,
            count: qPayments.length,
            paidCount: qPayments.filter((p: any) => p.status === "paid").length,
            total: qTotal,
            paid: qPaid,
          }
        })
      : []

    if (format === "csv") {
      let csvContent = ""
      csvContent += "# ========================================\n"
      csvContent += "# 租金付款記錄匯出報表\n"
      csvContent += "# ========================================\n"
      csvContent += `# 匯出日期: ${new Date().toISOString().split("T")[0]}\n`
      csvContent += `# 篩選年度: ${year || "全部"}\n`
      csvContent += `# 總筆數: ${filteredPayments.length}\n`
      csvContent += `# 已付款: ${paidCount} 筆 (NT$${paidAmount.toLocaleString()})\n`
      csvContent += `# 未付款: ${unpaidCount} 筆 (NT$${unpaidAmount.toLocaleString()})\n`
      csvContent += `# 應付總額: NT$${totalAmount.toLocaleString()}\n`
      csvContent += `# 完成率: ${completionRate}%\n`
      csvContent += "# ========================================\n\n"

      const headers = Object.keys(exportData[0] || {})
      csvContent += headers.join(",") + "\n"

      exportData.forEach((row: any) => {
        const values = headers.map((h) => {
          const val = row[h]
          if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`
          }
          return val
        })
        csvContent += values.join(",") + "\n"
      })

      res.setHeader("Content-Type", "text/csv; charset=utf-8")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="rental-payments-${year || "all"}.csv"`
      )
      res.send("\ufeff" + csvContent)
    } else {
      const wb = XLSX.utils.book_new()

      const ws = XLSX.utils.json_to_sheet(exportData)
      XLSX.utils.book_append_sheet(wb, ws, "租金付款記錄")

      const summaryData = [
        { 統計項目: "匯出日期", 數值: new Date().toISOString().split("T")[0], 備註: "" },
        { 統計項目: "篩選年度", 數值: year || "全部", 備註: "" },
        { 統計項目: "", 數值: "", 備註: "" },
        { 統計項目: "=== 付款統計 ===", 數值: "", 備註: "" },
        { 統計項目: "總筆數", 數值: filteredPayments.length, 備註: "期" },
        { 統計項目: "已付款筆數", 數值: paidCount, 備註: "期" },
        { 統計項目: "未付款筆數", 數值: unpaidCount, 備註: "期" },
        { 統計項目: "", 數值: "", 備註: "" },
        { 統計項目: "=== 金額統計 ===", 數值: "", 備註: "" },
        { 統計項目: "應付總額", 數值: totalAmount, 備註: "NT$" },
        { 統計項目: "已付金額", 數值: paidAmount, 備註: "NT$" },
        { 統計項目: "未付金額", 數值: unpaidAmount, 備註: "NT$" },
        { 統計項目: "完成率", 數值: `${completionRate}%`, 備註: "" },
      ]
      const wsSummary = XLSX.utils.json_to_sheet(summaryData)
      wsSummary["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, wsSummary, "統計摘要")

      if (year && quarterlyStats.length > 0) {
        const quarterlyData = quarterlyStats.map((q) => ({
          季度: q.quarter,
          期數: q.count,
          已付期數: q.paidCount,
          未付期數: q.count - q.paidCount,
          應付金額: q.total,
          已付金額: q.paid,
          未付金額: q.total - q.paid,
          完成率: q.total > 0 ? `${((q.paid / q.total) * 100).toFixed(1)}%` : "0%",
        }))

        quarterlyData.push({
          季度: "年度合計",
          期數: filteredPayments.length,
          已付期數: paidCount,
          未付期數: unpaidCount,
          應付金額: totalAmount,
          已付金額: paidAmount,
          未付金額: unpaidAmount,
          完成率: `${completionRate}%`,
        })

        const wsQuarterly = XLSX.utils.json_to_sheet(quarterlyData)
        wsQuarterly["!cols"] = [
          { wch: 10 },
          { wch: 8 },
          { wch: 10 },
          { wch: 10 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
          { wch: 10 },
        ]
        XLSX.utils.book_append_sheet(wb, wsQuarterly, "季度統計")
      }

      ws["!cols"] = [
        { wch: 25 },
        { wch: 25 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 },
        { wch: 12 },
        { wch: 10 },
        { wch: 30 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
      ]

      const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="rental-payments-${year || "all"}.xlsx"`
      )
      res.send(excelBuffer)
    }
  } catch (error: any) {
    console.error("Error exporting rental payments:", error)
    res.status(500).json({ message: "Failed to export rental payments" })
  }
})

export default router
