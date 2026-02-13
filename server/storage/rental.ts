import { db } from "../db"
import {
  rentalContracts,
  rentalPriceTiers,
  contractDocuments,
  installmentPlans,
  paymentItems,
  paymentRecords,
  paymentProjects,
  debtCategories,
  type RentalContract,
  type InsertRentalContract,
  type ContractDocument,
  type InsertContractDocument,
  type InstallmentPlan,
  type InsertInstallmentPlan,
} from "@shared/schema"
import { eq, and, sql, desc, asc, like, gte, lte, or, inArray } from "drizzle-orm"
import type { RentalPriceTier, InsertRentalPriceTier } from "@shared/schema"

/** 租約列表項目 */
interface RentalContractListItem {
  id: number
  projectId: number
  contractName: string
  startDate: string
  endDate: string
  totalYears: number
  baseAmount: string
  isActive: boolean | null
  notes: string | null
  projectName: string | null
  createdAt: Date | null
}

/** 租約詳情（含價格階段） */
interface RentalContractDetail extends RentalContractListItem {
  hasBufferPeriod: boolean | null
  bufferMonths: number | null
  bufferIncludedInTerm: boolean | null
  payeeName: string | null
  payeeUnit: string | null
  bankCode: string | null
  accountNumber: string | null
  contractPaymentDay: number | null
  updatedAt: Date | null
  priceTiers: RentalPriceTier[]
}

/** 租約統計 */
interface RentalStatsResult {
  totalContracts: number
  activeContracts: number
  totalMonthlyRent: string
}

/** 租約付款項目 */
interface RentalPaymentItem {
  id: number
  itemName: string
  totalAmount: string
  paidAmount: string | null
  status: string | null
  startDate: string
  endDate: string | null
  notes: string | null
  projectId: number | null
  projectName: string | null
  categoryName: string | null
  createdAt: Date | null
}

/** 價格階段輸入資料 */
interface PriceTierInput {
  yearStart: number
  yearEnd: number
  monthlyAmount: string | number
}

// === 租約管理 ===

export async function getRentalContracts(): Promise<RentalContractListItem[]> {
  try {
    const contracts = await db
      .select({
        id: rentalContracts.id,
        projectId: rentalContracts.projectId,
        contractName: rentalContracts.contractName,
        startDate: rentalContracts.startDate,
        endDate: rentalContracts.endDate,
        totalYears: rentalContracts.totalYears,
        baseAmount: rentalContracts.baseAmount,
        isActive: rentalContracts.isActive,
        notes: rentalContracts.notes,
        projectName: paymentProjects.projectName,
        createdAt: rentalContracts.createdAt,
      })
      .from(rentalContracts)
      .leftJoin(paymentProjects, eq(rentalContracts.projectId, paymentProjects.id))
      .orderBy(desc(rentalContracts.createdAt))

    return contracts
  } catch (error) {
    console.error("Error fetching rental contracts:", error)
    throw error
  }
}

export async function getRentalContract(contractId: number): Promise<RentalContractDetail | null> {
  try {
    const [contract] = await db
      .select({
        id: rentalContracts.id,
        projectId: rentalContracts.projectId,
        contractName: rentalContracts.contractName,
        startDate: rentalContracts.startDate,
        endDate: rentalContracts.endDate,
        totalYears: rentalContracts.totalYears,
        baseAmount: rentalContracts.baseAmount,
        hasBufferPeriod: rentalContracts.hasBufferPeriod,
        bufferMonths: rentalContracts.bufferMonths,
        bufferIncludedInTerm: rentalContracts.bufferIncludedInTerm,
        payeeName: rentalContracts.payeeName,
        payeeUnit: rentalContracts.payeeUnit,
        bankCode: rentalContracts.bankCode,
        accountNumber: rentalContracts.accountNumber,
        contractPaymentDay: rentalContracts.contractPaymentDay,
        isActive: rentalContracts.isActive,
        notes: rentalContracts.notes,
        projectName: paymentProjects.projectName,
        createdAt: rentalContracts.createdAt,
        updatedAt: rentalContracts.updatedAt,
      })
      .from(rentalContracts)
      .leftJoin(paymentProjects, eq(rentalContracts.projectId, paymentProjects.id))
      .where(eq(rentalContracts.id, contractId))

    if (!contract) return null

    const priceTiers = await db
      .select()
      .from(rentalPriceTiers)
      .where(eq(rentalPriceTiers.contractId, contractId))
      .orderBy(rentalPriceTiers.yearStart)

    return { ...contract, priceTiers }
  } catch (error) {
    console.error("Error fetching rental contract:", error)
    throw error
  }
}

export async function createRentalContract(
  contractData: InsertRentalContract,
  priceTiers: PriceTierInput[]
): Promise<RentalContract> {
  try {
    const [contract] = await db.insert(rentalContracts).values(contractData).returning()

    if (priceTiers && priceTiers.length > 0) {
      const tierData = priceTiers.map((tier) => ({
        contractId: contract.id,
        yearStart: tier.yearStart,
        yearEnd: tier.yearEnd,
        monthlyAmount: tier.monthlyAmount.toString(),
      }))

      await db.insert(rentalPriceTiers).values(tierData)
    }

    return contract
  } catch (error) {
    console.error("Error creating rental contract:", error)
    throw error
  }
}

export async function updateRentalContract(
  contractId: number,
  contractData: Partial<InsertRentalContract>,
  priceTiers?: PriceTierInput[]
): Promise<RentalContract> {
  try {
    const [oldContract] = await db
      .select()
      .from(rentalContracts)
      .where(eq(rentalContracts.id, contractId))

    const [contract] = await db
      .update(rentalContracts)
      .set(contractData)
      .where(eq(rentalContracts.id, contractId))
      .returning()

    let needRegeneratePayments = false

    if (contractData.contractName && contractData.contractName !== oldContract.contractName) {
      needRegeneratePayments = true
    }
    if (contractData.startDate && contractData.startDate !== oldContract.startDate) {
      needRegeneratePayments = true
    }

    if (priceTiers && priceTiers.length > 0) {
      await db.delete(rentalPriceTiers).where(eq(rentalPriceTiers.contractId, contractId))

      const tierData = priceTiers.map((tier) => ({
        contractId: contractId,
        yearStart: tier.yearStart,
        yearEnd: tier.yearEnd,
        monthlyAmount: tier.monthlyAmount.toString(),
      }))

      await db.insert(rentalPriceTiers).values(tierData)
      needRegeneratePayments = true
    }

    if (needRegeneratePayments) {
      await db
        .delete(paymentItems)
        .where(
          and(
            eq(paymentItems.projectId, oldContract.projectId),
            like(paymentItems.itemName, `%${oldContract.contractName}%`),
            eq(paymentItems.paidAmount, "0.00")
          )
        )

      await generateRentalPayments(contractId)
    }

    return contract
  } catch (error) {
    console.error("Error updating rental contract:", error)
    throw error
  }
}

export async function deleteRentalContract(contractId: number): Promise<void> {
  try {
    const [contract] = await db
      .select()
      .from(rentalContracts)
      .where(eq(rentalContracts.id, contractId))

    if (contract) {
      const unpaidItems = await db
        .select({ id: paymentItems.id })
        .from(paymentItems)
        .where(
          and(
            eq(paymentItems.projectId, contract.projectId),
            like(paymentItems.itemName, `%${contract.contractName}%`),
            eq(paymentItems.paidAmount, "0.00")
          )
        )

      if (unpaidItems.length > 0) {
        const itemIds = unpaidItems.map((item) => item.id)
        await db.delete(paymentRecords).where(inArray(paymentRecords.itemId, itemIds))
      }

      await db
        .delete(paymentItems)
        .where(
          and(
            eq(paymentItems.projectId, contract.projectId),
            like(paymentItems.itemName, `%${contract.contractName}%`),
            eq(paymentItems.paidAmount, "0.00")
          )
        )
    }

    await db.delete(contractDocuments).where(eq(contractDocuments.contractId, contractId))
    await db.delete(rentalPriceTiers).where(eq(rentalPriceTiers.contractId, contractId))
    await db.delete(rentalContracts).where(eq(rentalContracts.id, contractId))
  } catch (error) {
    console.error("Error deleting rental contract:", error)
    throw error
  }
}

// === 價格階段 ===

export async function getRentalPriceTiers(contractId: number): Promise<RentalPriceTier[]> {
  try {
    return await db
      .select()
      .from(rentalPriceTiers)
      .where(eq(rentalPriceTiers.contractId, contractId))
      .orderBy(rentalPriceTiers.yearStart)
  } catch (error) {
    console.error("Error fetching rental price tiers:", error)
    throw error
  }
}

// === 租金付款生成 ===

export async function generateRentalPayments(
  contractId: number
): Promise<{ generatedCount: number }> {
  try {
    const [contract] = await db
      .select()
      .from(rentalContracts)
      .where(eq(rentalContracts.id, contractId))

    if (!contract) throw new Error("租約不存在")

    const tiers = await db
      .select()
      .from(rentalPriceTiers)
      .where(eq(rentalPriceTiers.contractId, contractId))
      .orderBy(rentalPriceTiers.yearStart)

    const [rentCategory] = await db
      .select()
      .from(debtCategories)
      .where(
        and(eq(debtCategories.categoryName, "租金"), eq(debtCategories.categoryType, "project"))
      )

    if (!rentCategory) throw new Error("找不到租金分類")

    const existingItems = await db
      .select()
      .from(paymentItems)
      .where(
        and(
          eq(paymentItems.categoryId, rentCategory.id),
          eq(paymentItems.projectId, contract.projectId),
          sql`${paymentItems.itemName} LIKE ${`%${contract.contractName}%`}`,
          eq(paymentItems.isDeleted, false)
        )
      )

    const existingMonths = new Set(
      existingItems
        .map((item) => {
          const match = item.itemName.match(/(\d{4})-(\d{2})-/)
          return match ? `${match[1]}-${match[2]}` : null
        })
        .filter(Boolean)
    )

    const startDate = new Date(contract.startDate)
    const endDate = new Date(contract.endDate)
    const newPaymentItems = []
    let generatedCount = 0

    const hasBufferPeriod = contract.hasBufferPeriod || false
    const bufferMonths = contract.bufferMonths || 0
    const bufferIncludedInTerm = contract.bufferIncludedInTerm === true

    const paymentStartDate = new Date(startDate)
    if (hasBufferPeriod && !bufferIncludedInTerm) {
      paymentStartDate.setMonth(paymentStartDate.getMonth() + bufferMonths)
    }

    const currentDate = new Date(paymentStartDate)
    let billingMonthIndex = 0

    while (currentDate <= endDate) {
      if (hasBufferPeriod && bufferIncludedInTerm) {
        const monthsFromStart = Math.floor(
          (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        )
        if (monthsFromStart < bufferMonths) {
          currentDate.setMonth(currentDate.getMonth() + 1)
          continue
        }
      }

      const currentYear = Math.floor(billingMonthIndex / 12) + 1

      const currentTier = tiers.find(
        (tier) => currentYear >= tier.yearStart && currentYear <= tier.yearEnd
      )

      const monthlyAmount = currentTier
        ? parseFloat(currentTier.monthlyAmount)
        : parseFloat(contract.baseAmount)

      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`
      const itemName = `${monthKey}-${contract.contractName}`
      const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      if (!existingMonths.has(monthKey)) {
        newPaymentItems.push({
          categoryId: rentCategory.id,
          projectId: contract.projectId,
          itemName,
          totalAmount: monthlyAmount.toString(),
          itemType: "project" as const,
          paymentType: "single" as const,
          startDate: dueDate.toISOString().split("T")[0],
          paidAmount: "0.00",
          status: "pending" as const,
          priority: 1,
          notes: `${contract.contractName} 第${currentYear}年租金`,
        })
        generatedCount++
      } else {
        const existingItem = existingItems.find(
          (item) =>
            item.itemName.includes(monthKey) && item.itemName.includes(contract.contractName)
        )

        if (existingItem && parseFloat(existingItem.totalAmount) !== monthlyAmount) {
          await db
            .update(paymentItems)
            .set({
              totalAmount: monthlyAmount.toString(),
              notes: `${contract.contractName} 第${currentYear}年租金 (已更新)`,
              updatedAt: new Date(),
            })
            .where(eq(paymentItems.id, existingItem.id))
        }
      }

      currentDate.setMonth(currentDate.getMonth() + 1)
      billingMonthIndex++
    }

    if (newPaymentItems.length > 0) {
      await db.insert(paymentItems).values(newPaymentItems)
    }

    return { generatedCount }
  } catch (error) {
    console.error("Error generating rental payments:", error)
    throw error
  }
}

// === 租約統計 ===

export async function getRentalStats(): Promise<RentalStatsResult> {
  try {
    const stats = await db
      .select({
        totalContracts: sql<number>`COUNT(*)`,
        activeContracts: sql<number>`COUNT(CASE WHEN is_active = true THEN 1 END)`,
        totalMonthlyRent: sql<string>`COALESCE(SUM(base_amount::numeric), 0)`,
      })
      .from(rentalContracts)

    return stats[0] || { totalContracts: 0, activeContracts: 0, totalMonthlyRent: "0" }
  } catch (error) {
    console.error("Error fetching rental stats:", error)
    throw error
  }
}

export async function getRentalPaymentItems(): Promise<RentalPaymentItem[]> {
  try {
    const rentalItems = await db
      .select({
        id: paymentItems.id,
        itemName: paymentItems.itemName,
        totalAmount: paymentItems.totalAmount,
        paidAmount: paymentItems.paidAmount,
        status: paymentItems.status,
        startDate: paymentItems.startDate,
        endDate: paymentItems.endDate,
        notes: paymentItems.notes,
        projectId: paymentItems.projectId,
        projectName: paymentProjects.projectName,
        categoryName: debtCategories.categoryName,
        createdAt: paymentItems.createdAt,
      })
      .from(paymentItems)
      .leftJoin(paymentProjects, eq(paymentItems.projectId, paymentProjects.id))
      .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
      .where(
        and(
          eq(paymentItems.isDeleted, false),
          or(
            eq(paymentItems.categoryId, 2),
            sql`COALESCE(${debtCategories.categoryName}, '') LIKE '%租金%'`,
            sql`${paymentItems.itemName} LIKE '%租約%'`,
            sql`${paymentItems.itemName} LIKE '%租金%'`,
            sql`COALESCE(${paymentItems.notes}, '') LIKE '%租金%'`
          )
        )
      )
      .orderBy(desc(paymentItems.startDate))

    return rentalItems
  } catch (error) {
    console.error("Error fetching rental payment items:", error)
    throw error
  }
}

// === 合約付款查詢 ===

/** 租約付款明細 */
interface ContractPaymentRow {
  id: number
  itemName: string
  totalAmount: string
  paidAmount: string | null
  startDate: string
  endDate: string | null
  status: string | null
  notes: string | null
  projectId: number | null
  categoryId: number | null
  createdAt: Date | null
  updatedAt: Date | null
  projectName: string | null
  categoryName: string | null
}

export async function getRentalContractPayments(contractId: number): Promise<ContractPaymentRow[]> {
  try {
    const [contract] = await db
      .select()
      .from(rentalContracts)
      .where(eq(rentalContracts.id, contractId))

    if (!contract) throw new Error("租約不存在")

    const contractPayments = await db
      .select({
        id: paymentItems.id,
        itemName: paymentItems.itemName,
        totalAmount: paymentItems.totalAmount,
        paidAmount: paymentItems.paidAmount,
        startDate: paymentItems.startDate,
        endDate: paymentItems.endDate,
        status: paymentItems.status,
        notes: paymentItems.notes,
        projectId: paymentItems.projectId,
        categoryId: paymentItems.categoryId,
        createdAt: paymentItems.createdAt,
        updatedAt: paymentItems.updatedAt,
        projectName: paymentProjects.projectName,
        categoryName: debtCategories.categoryName,
      })
      .from(paymentItems)
      .leftJoin(paymentProjects, eq(paymentItems.projectId, paymentProjects.id))
      .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
      .where(
        and(
          eq(paymentItems.isDeleted, false),
          eq(paymentItems.projectId, contract.projectId),
          sql`${paymentItems.itemName} LIKE ${`%${contract.contractName}%`}`
        )
      )
      .orderBy(asc(paymentItems.startDate))

    return contractPayments
  } catch (error) {
    console.error("Error fetching rental contract payments:", error)
    throw error
  }
}

// === 分期計劃 ===

export async function createInstallmentPlan(
  planData: InsertInstallmentPlan
): Promise<InstallmentPlan> {
  try {
    const [plan] = await db.insert(installmentPlans).values(planData).returning()
    return plan
  } catch (error) {
    console.error("Error creating installment plan:", error)
    throw error
  }
}

export async function generateInstallmentPayments(
  planId: number
): Promise<{ generatedCount: number }> {
  try {
    const [plan] = await db.select().from(installmentPlans).where(eq(installmentPlans.id, planId))

    if (!plan) throw new Error("分期計劃不存在")

    const [originalItem] = await db
      .select()
      .from(paymentItems)
      .where(eq(paymentItems.id, plan.itemId))

    if (!originalItem) throw new Error("付款項目不存在")

    const startDate = new Date(plan.startDate)
    const installmentItems = []
    let generatedCount = 0

    for (let i = 0; i < plan.installmentCount; i++) {
      const installmentDate = new Date(startDate)

      if (plan.startType === "next_month") {
        installmentDate.setMonth(installmentDate.getMonth() + i + 1)
      } else {
        installmentDate.setMonth(installmentDate.getMonth() + i)
      }

      const itemName = `${originalItem.itemName} (分期 ${i + 1}/${plan.installmentCount})`

      installmentItems.push({
        categoryId: originalItem.categoryId,
        projectId: originalItem.projectId,
        itemName,
        totalAmount: plan.monthlyAmount,
        itemType: originalItem.itemType,
        paymentType: "installment" as const,
        startDate: installmentDate.toISOString().split("T")[0],
        paidAmount: "0.00",
        status: "pending" as const,
        priority: originalItem.priority,
        notes: `${originalItem.itemName} 的分期付款 ${i + 1}/${plan.installmentCount}`,
      })

      generatedCount++
    }

    if (installmentItems.length > 0) {
      await db.insert(paymentItems).values(installmentItems)
    }

    await db
      .update(paymentItems)
      .set({
        status: "replaced",
        notes: `已轉為${plan.installmentCount}期分期付款`,
      })
      .where(eq(paymentItems.id, plan.itemId))

    return { generatedCount }
  } catch (error) {
    console.error("Error generating installment payments:", error)
    throw error
  }
}

// === 合約文件 ===

export async function getContractDocuments(contractId: number): Promise<ContractDocument[]> {
  try {
    return await db
      .select()
      .from(contractDocuments)
      .where(eq(contractDocuments.contractId, contractId))
      .orderBy(desc(contractDocuments.uploadedAt))
  } catch (error) {
    console.error("Error fetching contract documents:", error)
    throw error
  }
}

export async function getContractDocument(
  documentId: number
): Promise<ContractDocument | undefined> {
  try {
    const [document] = await db
      .select()
      .from(contractDocuments)
      .where(eq(contractDocuments.id, documentId))
    return document
  } catch (error) {
    console.error("Error fetching contract document:", error)
    throw error
  }
}

export async function createContractDocument(
  document: InsertContractDocument
): Promise<ContractDocument> {
  try {
    const [newDocument] = await db.insert(contractDocuments).values(document).returning()
    return newDocument
  } catch (error) {
    console.error("Error creating contract document:", error)
    throw error
  }
}

export async function updateContractDocument(
  documentId: number,
  updates: Partial<InsertContractDocument>
): Promise<ContractDocument> {
  try {
    const [updatedDocument] = await db
      .update(contractDocuments)
      .set(updates)
      .where(eq(contractDocuments.id, documentId))
      .returning()

    if (!updatedDocument) {
      throw new Error(`Contract document with ID ${documentId} not found`)
    }

    return updatedDocument
  } catch (error) {
    console.error("Error updating contract document:", error)
    throw error
  }
}

export async function deleteContractDocument(documentId: number): Promise<void> {
  try {
    await db.delete(contractDocuments).where(eq(contractDocuments.id, documentId))
  } catch (error) {
    console.error("Error deleting contract document:", error)
    throw error
  }
}

// === 合約付款資訊更新 ===

export async function updateContractPaymentInfo(
  contractId: number,
  paymentInfo: {
    payeeName?: string
    payeeUnit?: string
    bankCode?: string
    accountNumber?: string
    contractPaymentDay?: number
  }
): Promise<RentalContract> {
  try {
    const [updatedContract] = await db
      .update(rentalContracts)
      .set({
        payeeName: paymentInfo.payeeName,
        payeeUnit: paymentInfo.payeeUnit,
        bankCode: paymentInfo.bankCode,
        accountNumber: paymentInfo.accountNumber,
        contractPaymentDay: paymentInfo.contractPaymentDay,
        updatedAt: new Date(),
      })
      .where(eq(rentalContracts.id, contractId))
      .returning()

    return updatedContract
  } catch (error) {
    console.error("Error updating contract payment info:", error)
    throw error
  }
}

// === 合約詳情與搜尋 ===

/** 合約完整詳情 */
interface ContractDetailsResult {
  contract: Record<string, unknown>
  priceTiers: RentalPriceTier[]
  paymentStats: Record<string, unknown>
  recentPayments: Record<string, unknown>[]
  documents: ContractDocument[]
  progress: {
    percentage: number
    remainingMonths: number
    isExpired: boolean
  }
}

export async function getContractDetails(
  contractId: number
): Promise<ContractDetailsResult | null> {
  try {
    const [contract] = await db
      .select({
        id: rentalContracts.id,
        projectId: rentalContracts.projectId,
        contractName: rentalContracts.contractName,
        tenantName: rentalContracts.tenantName,
        tenantPhone: rentalContracts.tenantPhone,
        tenantAddress: rentalContracts.tenantAddress,
        startDate: rentalContracts.startDate,
        endDate: rentalContracts.endDate,
        totalYears: rentalContracts.totalYears,
        totalMonths: rentalContracts.totalMonths,
        baseAmount: rentalContracts.baseAmount,
        payeeName: rentalContracts.payeeName,
        payeeUnit: rentalContracts.payeeUnit,
        bankCode: rentalContracts.bankCode,
        accountNumber: rentalContracts.accountNumber,
        contractPaymentDay: rentalContracts.contractPaymentDay,
        isActive: rentalContracts.isActive,
        notes: rentalContracts.notes,
        createdAt: rentalContracts.createdAt,
        projectName: paymentProjects.projectName,
      })
      .from(rentalContracts)
      .leftJoin(paymentProjects, eq(rentalContracts.projectId, paymentProjects.id))
      .where(eq(rentalContracts.id, contractId))

    if (!contract) return null

    const priceTiers = await getRentalPriceTiers(contractId)

    const paymentStats = await db
      .select({
        totalPayments: sql<number>`COUNT(*)`,
        totalAmount: sql<string>`COALESCE(SUM(${paymentItems.totalAmount}::numeric), 0)`,
        paidAmount: sql<string>`COALESCE(SUM(${paymentItems.paidAmount}::numeric), 0)`,
        unpaidAmount: sql<string>`COALESCE(SUM(${paymentItems.totalAmount}::numeric - ${paymentItems.paidAmount}::numeric), 0)`,
        paidCount: sql<number>`COUNT(CASE WHEN ${paymentItems.paidAmount}::numeric > 0 THEN 1 END)`,
        unpaidCount: sql<number>`COUNT(CASE WHEN ${paymentItems.paidAmount}::numeric = 0 THEN 1 END)`,
        overdueCount: sql<number>`COUNT(CASE WHEN ${paymentItems.startDate} < CURRENT_DATE AND ${paymentItems.paidAmount}::numeric = 0 THEN 1 END)`,
      })
      .from(paymentItems)
      .where(
        and(
          eq(paymentItems.projectId, contract.projectId),
          like(paymentItems.itemName, `%${contract.contractName}%`),
          eq(paymentItems.isDeleted, false)
        )
      )

    const recentPayments = await db
      .select({
        id: paymentRecords.id,
        amount: paymentRecords.amountPaid,
        paymentDate: paymentRecords.paymentDate,
        paymentMethod: paymentRecords.paymentMethod,
        notes: paymentRecords.notes,
        itemName: paymentItems.itemName,
      })
      .from(paymentRecords)
      .leftJoin(paymentItems, eq(paymentRecords.itemId, paymentItems.id))
      .where(
        and(
          eq(paymentItems.projectId, contract.projectId),
          like(paymentItems.itemName, `%${contract.contractName}%`),
          eq(paymentItems.isDeleted, false)
        )
      )
      .orderBy(desc(paymentRecords.paymentDate))
      .limit(10)

    const documents = await getContractDocuments(contractId)

    const startDate = new Date(contract.startDate)
    const endDate = new Date(contract.endDate)
    const currentDate = new Date()
    const totalDuration = endDate.getTime() - startDate.getTime()
    const elapsedDuration = currentDate.getTime() - startDate.getTime()
    const progressPercentage = Math.min(Math.max((elapsedDuration / totalDuration) * 100, 0), 100)
    const remainingMonths = Math.max(
      0,
      Math.ceil((endDate.getTime() - currentDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000))
    )

    return {
      contract,
      priceTiers,
      paymentStats: paymentStats[0] || {},
      recentPayments,
      documents,
      progress: {
        percentage: Math.round(progressPercentage * 100) / 100,
        remainingMonths,
        isExpired: currentDate > endDate,
      },
    }
  } catch (error) {
    console.error("Error fetching contract details:", error)
    throw error
  }
}

export async function searchContracts(searchParams: {
  keyword?: string
  projectId?: number
  isActive?: boolean
  startDateFrom?: string
  startDateTo?: string
}): Promise<Record<string, unknown>[]> {
  try {
    const query = db
      .select({
        id: rentalContracts.id,
        projectId: rentalContracts.projectId,
        contractName: rentalContracts.contractName,
        tenantName: rentalContracts.tenantName,
        tenantPhone: rentalContracts.tenantPhone,
        startDate: rentalContracts.startDate,
        endDate: rentalContracts.endDate,
        totalYears: rentalContracts.totalYears,
        totalMonths: rentalContracts.totalMonths,
        baseAmount: rentalContracts.baseAmount,
        isActive: rentalContracts.isActive,
        projectName: paymentProjects.projectName,
      })
      .from(rentalContracts)
      .leftJoin(paymentProjects, eq(rentalContracts.projectId, paymentProjects.id))

    const conditions = []

    if (searchParams.keyword) {
      conditions.push(
        or(
          like(rentalContracts.contractName, `%${searchParams.keyword}%`),
          like(rentalContracts.tenantName, `%${searchParams.keyword}%`),
          like(paymentProjects.projectName, `%${searchParams.keyword}%`)
        )
      )
    }

    if (searchParams.projectId) {
      conditions.push(eq(rentalContracts.projectId, searchParams.projectId))
    }

    if (searchParams.isActive !== undefined) {
      conditions.push(eq(rentalContracts.isActive, searchParams.isActive))
    }

    if (searchParams.startDateFrom) {
      conditions.push(gte(rentalContracts.startDate, searchParams.startDateFrom))
    }

    if (searchParams.startDateTo) {
      conditions.push(lte(rentalContracts.startDate, searchParams.startDateTo))
    }

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(rentalContracts.createdAt))
    } else {
      return await query.orderBy(desc(rentalContracts.createdAt))
    }
  } catch (error) {
    console.error("Error searching contracts:", error)
    throw error
  }
}
