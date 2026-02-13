/**
 * 財務報表 Storage 模組
 * 提供損益表、資產負債表、現金流量表、人事費報表、稅務報表
 */
import { db } from "../db"
import { sql } from "drizzle-orm"

/** SQL 原始查詢結果列 */
type SqlRow = Record<string, string>

/** 取得月份日期範圍 */
function getDateRange(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  return { startDate, endDate }
}

/** 損益表項目 */
interface StatementItem {
  category: string
  amount: number
}

// ============================================================
// 簡易損益表
// ============================================================

export async function getIncomeStatement(year: number, month: number) {
  const { startDate, endDate } = getDateRange(year, month)

  const incomeResult = await db.execute(sql`
    SELECT
      COALESCE(dc.category_name, '其他收入') as category,
      SUM(CAST(pr.amount_paid AS DECIMAL(12,2))) as amount
    FROM payment_records pr
    LEFT JOIN payment_items pi ON pr.payment_item_id = pi.id
    LEFT JOIN debt_categories dc ON pi.category_id = dc.id
    WHERE pr.payment_date >= ${startDate}
      AND pr.payment_date < ${endDate}
      AND pi.item_type = 'income'
    GROUP BY dc.category_name
    ORDER BY amount DESC
  `)

  const rentalIncomeResult = await db.execute(sql`
    SELECT
      '租金收入' as category,
      COALESCE(SUM(CAST(base_amount AS DECIMAL(12,2))), 0) as amount
    FROM rental_contracts
    WHERE is_active = true
      AND start_date < ${endDate}
      AND (end_date IS NULL OR end_date >= ${startDate})
  `)

  const expenseResult = await db.execute(sql`
    SELECT
      COALESCE(dc.category_name, '其他支出') as category,
      SUM(CAST(pr.amount_paid AS DECIMAL(12,2))) as amount
    FROM payment_records pr
    LEFT JOIN payment_items pi ON pr.payment_item_id = pi.id
    LEFT JOIN debt_categories dc ON pi.category_id = dc.id
    WHERE pr.payment_date >= ${startDate}
      AND pr.payment_date < ${endDate}
      AND (pi.item_type IS NULL OR pi.item_type != 'income')
    GROUP BY dc.category_name
    ORDER BY amount DESC
  `)

  const hrCostResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(total_cost AS DECIMAL(12,2))), 0) as total_cost,
      COALESCE(SUM(CAST(base_salary AS DECIMAL(12,2))), 0) as salary,
      COALESCE(SUM(CAST(employer_total AS DECIMAL(12,2))), 0) as employer_burden
    FROM monthly_hr_costs
    WHERE year = ${year} AND month = ${month}
  `)

  const rentalRows = (rentalIncomeResult.rows || []) as SqlRow[]
  const incomeRows = (incomeResult.rows || []) as SqlRow[]
  const incomeItems: StatementItem[] = [
    ...rentalRows.filter((r) => parseFloat(r.amount) > 0),
    ...incomeRows,
  ].map((r) => ({ category: r.category, amount: parseFloat(r.amount || "0") }))
  const incomeTotal = incomeItems.reduce((sum, i) => sum + i.amount, 0)

  const hrRow = (hrCostResult.rows || [])[0] as SqlRow
  const hrTotalCost = parseFloat(hrRow?.total_cost || "0")

  const expenseRows = (expenseResult.rows || []) as SqlRow[]
  const expenseItems: StatementItem[] = [
    ...expenseRows.map((r) => ({
      category: r.category,
      amount: parseFloat(r.amount || "0"),
    })),
    ...(hrTotalCost > 0 ? [{ category: "人事費用", amount: hrTotalCost }] : []),
  ]
  const expenseTotal = expenseItems.reduce((sum, i) => sum + i.amount, 0)

  return {
    year,
    month,
    income: { items: incomeItems, total: incomeTotal },
    expense: { items: expenseItems, total: expenseTotal },
    netIncome: incomeTotal - expenseTotal,
  }
}

// ============================================================
// 簡易資產負債表
// ============================================================

export async function getBalanceSheet(year: number, month: number) {
  const { endDate } = getDateRange(year, month)

  const cashResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN pi.item_type = 'income' THEN CAST(pr.amount_paid AS DECIMAL(12,2)) ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN pi.item_type IS NULL OR pi.item_type != 'income' THEN CAST(pr.amount_paid AS DECIMAL(12,2)) ELSE 0 END), 0) as total_expense
    FROM payment_records pr
    LEFT JOIN payment_items pi ON pr.payment_item_id = pi.id
    WHERE pr.payment_date < ${endDate}
  `)

  const cashRow = (cashResult.rows || [])[0] as SqlRow
  const totalIncome = parseFloat(cashRow?.total_income || "0")
  const totalExpense = parseFloat(cashRow?.total_expense || "0")

  const receivableResult = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(base_amount AS DECIMAL(12,2))), 0) as receivable
    FROM rental_contracts
    WHERE is_active = true
  `)
  const receivable = parseFloat((receivableResult.rows?.[0] as SqlRow)?.receivable || "0")

  const payableResult = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(total_amount AS DECIMAL(12,2)) - CAST(COALESCE(paid_amount, '0') AS DECIMAL(12,2))), 0) as payable
    FROM payment_items
    WHERE is_deleted = false
      AND status != 'completed'
  `)
  const payable = parseFloat((payableResult.rows?.[0] as SqlRow)?.payable || "0")

  let loanBalance = 0
  try {
    const loanResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(remaining_amount AS DECIMAL(12,2))), 0) as loan_balance
      FROM loan_investments
      WHERE status = 'active' AND type = 'borrow'
    `)
    loanBalance = parseFloat((loanResult.rows?.[0] as SqlRow)?.loan_balance || "0")
  } catch {
    // 表可能不存在
  }

  const unpaidHrResult = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(total_cost AS DECIMAL(12,2))), 0) as unpaid
    FROM monthly_hr_costs
    WHERE is_paid = false
  `)
  const unpaidHr = parseFloat((unpaidHrResult.rows?.[0] as SqlRow)?.unpaid || "0")

  const assets = {
    items: [
      { category: "累計現金淨額", amount: totalIncome - totalExpense },
      { category: "應收帳款（租金）", amount: receivable },
    ],
    total: totalIncome - totalExpense + receivable,
  }

  const liabilities = {
    items: [
      { category: "應付帳款", amount: payable },
      { category: "借入款項", amount: loanBalance },
      { category: "未付人事費", amount: unpaidHr },
    ],
    total: payable + loanBalance + unpaidHr,
  }

  return { year, month, assets, liabilities, netWorth: assets.total - liabilities.total }
}

// ============================================================
// 現金流量表
// ============================================================

export async function getCashFlowStatement(year: number, month: number) {
  const { startDate, endDate } = getDateRange(year, month)

  const operatingResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN pi.item_type = 'income' THEN CAST(pr.amount_paid AS DECIMAL(12,2)) ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN pi.item_type IS NULL OR pi.item_type != 'income' THEN CAST(pr.amount_paid AS DECIMAL(12,2)) ELSE 0 END), 0) as expense
    FROM payment_records pr
    LEFT JOIN payment_items pi ON pr.payment_item_id = pi.id
    WHERE pr.payment_date >= ${startDate}
      AND pr.payment_date < ${endDate}
  `)

  const opRow = (operatingResult.rows || [])[0] as SqlRow
  const opIncome = parseFloat(opRow?.income || "0")
  const opExpense = parseFloat(opRow?.expense || "0")

  let investReturn = 0, newInvest = 0, borrowed = 0, repaid = 0
  try {
    const investResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'invest' AND status = 'completed' THEN CAST(total_amount AS DECIMAL(12,2)) ELSE 0 END), 0) as invest_return,
        COALESCE(SUM(CASE WHEN type = 'invest' AND status = 'active' THEN CAST(total_amount AS DECIMAL(12,2)) ELSE 0 END), 0) as new_invest,
        COALESCE(SUM(CASE WHEN type = 'borrow' AND status = 'active' THEN CAST(total_amount AS DECIMAL(12,2)) ELSE 0 END), 0) as borrowed,
        COALESCE(SUM(CASE WHEN type = 'borrow' AND status = 'completed' THEN CAST(total_amount AS DECIMAL(12,2)) ELSE 0 END), 0) as repaid
      FROM loan_investments
      WHERE created_at >= ${startDate}
        AND created_at < ${endDate}
    `)
    const row = (investResult.rows || [])[0] as SqlRow
    investReturn = parseFloat(row?.invest_return || "0")
    newInvest = parseFloat(row?.new_invest || "0")
    borrowed = parseFloat(row?.borrowed || "0")
    repaid = parseFloat(row?.repaid || "0")
  } catch {
    // 表可能不存在
  }

  return {
    year,
    month,
    operating: {
      items: [
        { category: "營業收入", amount: opIncome },
        { category: "營業支出", amount: -opExpense },
      ],
      total: opIncome - opExpense,
    },
    investing: {
      items: [
        { category: "投資收回", amount: investReturn },
        { category: "新增投資", amount: -newInvest },
      ],
      total: investReturn - newInvest,
    },
    financing: {
      items: [
        { category: "借入款項", amount: borrowed },
        { category: "償還借款", amount: -repaid },
      ],
      total: borrowed - repaid,
    },
    netCashFlow: (opIncome - opExpense) + (investReturn - newInvest) + (borrowed - repaid),
  }
}

// ============================================================
// 人事費年度報表
// ============================================================

export async function getHrCostReport(year: number) {
  const result = await db.execute(sql`
    SELECT
      month,
      COUNT(DISTINCT employee_id) as employee_count,
      COALESCE(SUM(CAST(base_salary AS DECIMAL(12,2))), 0) as salary_total,
      COALESCE(SUM(
        CAST(COALESCE(employer_labor_insurance, '0') AS DECIMAL(12,2)) +
        CAST(COALESCE(employer_health_insurance, '0') AS DECIMAL(12,2)) +
        CAST(COALESCE(employer_employment_insurance, '0') AS DECIMAL(12,2)) +
        CAST(COALESCE(employer_accident_insurance, '0') AS DECIMAL(12,2))
      ), 0) as insurance_total,
      COALESCE(SUM(CAST(COALESCE(employer_pension, '0') AS DECIMAL(12,2))), 0) as pension_total,
      COALESCE(SUM(CAST(total_cost AS DECIMAL(12,2))), 0) as total_cost
    FROM monthly_hr_costs
    WHERE year = ${year}
    GROUP BY month
    ORDER BY month
  `)

  const monthlyBreakdown = ((result.rows || []) as SqlRow[]).map((r) => ({
    month: parseInt(r.month),
    employeeCount: parseInt(r.employee_count || "0"),
    salaryTotal: parseFloat(r.salary_total || "0"),
    insuranceTotal: parseFloat(r.insurance_total || "0"),
    pensionTotal: parseFloat(r.pension_total || "0"),
    totalCost: parseFloat(r.total_cost || "0"),
  }))

  const yearTotal = monthlyBreakdown.reduce(
    (acc, m) => ({
      salaryTotal: acc.salaryTotal + m.salaryTotal,
      insuranceTotal: acc.insuranceTotal + m.insuranceTotal,
      pensionTotal: acc.pensionTotal + m.pensionTotal,
      totalCost: acc.totalCost + m.totalCost,
    }),
    { salaryTotal: 0, insuranceTotal: 0, pensionTotal: 0, totalCost: 0 }
  )

  return { year, monthlyBreakdown, yearTotal }
}

// ============================================================
// 人事費月度明細
// ============================================================

export async function getHrCostMonthlyDetail(year: number, month: number) {
  const result = await db.execute(sql`
    SELECT
      e.employee_name,
      hc.base_salary,
      hc.insured_salary,
      hc.employer_labor_insurance,
      hc.employer_health_insurance,
      hc.employer_pension,
      hc.employer_employment_insurance,
      hc.employer_accident_insurance,
      hc.employer_total,
      hc.employee_labor_insurance,
      hc.employee_health_insurance,
      hc.employee_pension,
      hc.employee_total,
      hc.net_salary,
      hc.total_cost,
      hc.is_paid,
      hc.insurance_paid
    FROM monthly_hr_costs hc
    JOIN employees e ON hc.employee_id = e.id
    WHERE hc.year = ${year} AND hc.month = ${month}
    ORDER BY e.employee_name
  `)

  return ((result.rows || []) as SqlRow[]).map((r) => ({
    employeeName: r.employee_name,
    baseSalary: parseFloat(r.base_salary || "0"),
    insuredSalary: parseFloat(r.insured_salary || "0"),
    employerLaborInsurance: parseFloat(r.employer_labor_insurance || "0"),
    employerHealthInsurance: parseFloat(r.employer_health_insurance || "0"),
    employerPension: parseFloat(r.employer_pension || "0"),
    employerEmploymentInsurance: parseFloat(r.employer_employment_insurance || "0"),
    employerAccidentInsurance: parseFloat(r.employer_accident_insurance || "0"),
    employerTotal: parseFloat(r.employer_total || "0"),
    employeeTotal: parseFloat(r.employee_total || "0"),
    netSalary: parseFloat(r.net_salary || "0"),
    totalCost: parseFloat(r.total_cost || "0"),
    isPaid: r.is_paid,
    insurancePaid: r.insurance_paid,
  }))
}

// ============================================================
// 營業稅彙總（每兩個月一期）
// ============================================================

export async function getBusinessTaxReport(year: number, period: number) {
  const startMonth = (period - 1) * 2 + 1
  const endMonth = period * 2
  const startDate = `${year}-${String(startMonth).padStart(2, "0")}-01`
  const nextMonth = endMonth === 12 ? 1 : endMonth + 1
  const nextYear = endMonth === 12 ? year + 1 : year
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

  const salesResult = await db.execute(sql`
    SELECT
      COALESCE(dc.category_name, '其他') as category,
      COUNT(*) as invoice_count,
      COALESCE(SUM(CAST(pr.amount_paid AS DECIMAL(12,2))), 0) as amount
    FROM payment_records pr
    LEFT JOIN payment_items pi ON pr.payment_item_id = pi.id
    LEFT JOIN debt_categories dc ON pi.category_id = dc.id
    WHERE pr.payment_date >= ${startDate}
      AND pr.payment_date < ${endDate}
      AND pi.item_type = 'income'
    GROUP BY dc.category_name
    ORDER BY amount DESC
  `)

  const purchaseResult = await db.execute(sql`
    SELECT
      COALESCE(dc.category_name, '其他') as category,
      COUNT(*) as invoice_count,
      COALESCE(SUM(CAST(pr.amount_paid AS DECIMAL(12,2))), 0) as amount
    FROM payment_records pr
    LEFT JOIN payment_items pi ON pr.payment_item_id = pi.id
    LEFT JOIN debt_categories dc ON pi.category_id = dc.id
    WHERE pr.payment_date >= ${startDate}
      AND pr.payment_date < ${endDate}
      AND (pi.item_type IS NULL OR pi.item_type != 'income')
    GROUP BY dc.category_name
    ORDER BY amount DESC
  `)

  const salesItems = ((salesResult.rows || []) as SqlRow[]).map((r) => ({
    category: r.category,
    invoiceCount: parseInt(r.invoice_count || "0"),
    amount: parseFloat(r.amount || "0"),
  }))

  const purchaseItems = ((purchaseResult.rows || []) as SqlRow[]).map((r) => ({
    category: r.category,
    invoiceCount: parseInt(r.invoice_count || "0"),
    amount: parseFloat(r.amount || "0"),
  }))

  const salesTotal = salesItems.reduce((s, i) => s + i.amount, 0)
  const purchaseTotal = purchaseItems.reduce((s, i) => s + i.amount, 0)
  const taxRate = 0.05
  const salesTax = Math.round(salesTotal * taxRate)
  const purchaseTax = Math.round(purchaseTotal * taxRate)

  return {
    year,
    period,
    periodLabel: `${startMonth}-${endMonth}月`,
    sales: { items: salesItems, total: salesTotal, tax: salesTax },
    purchases: { items: purchaseItems, total: purchaseTotal, tax: purchaseTax },
    taxPayable: salesTax - purchaseTax,
    taxRate,
  }
}

// ============================================================
// 薪資扣繳彙總
// ============================================================

export async function getSalaryWithholdingReport(year: number) {
  const result = await db.execute(sql`
    SELECT
      e.employee_name,
      COALESCE(SUM(CAST(hc.base_salary AS DECIMAL(12,2))), 0) as total_salary,
      COALESCE(SUM(CAST(hc.employee_labor_insurance AS DECIMAL(12,2))), 0) as total_labor_insurance,
      COALESCE(SUM(CAST(hc.employee_health_insurance AS DECIMAL(12,2))), 0) as total_health_insurance,
      COALESCE(SUM(CAST(hc.employee_pension AS DECIMAL(12,2))), 0) as total_pension,
      COALESCE(SUM(CAST(hc.employee_total AS DECIMAL(12,2))), 0) as total_deduction,
      COALESCE(SUM(CAST(hc.net_salary AS DECIMAL(12,2))), 0) as total_net_salary,
      COUNT(*) as months_worked
    FROM monthly_hr_costs hc
    JOIN employees e ON hc.employee_id = e.id
    WHERE hc.year = ${year}
    GROUP BY e.id, e.employee_name
    ORDER BY e.employee_name
  `)

  const employeeList = ((result.rows || []) as SqlRow[]).map((r) => ({
    employeeName: r.employee_name,
    totalSalary: parseFloat(r.total_salary || "0"),
    totalLaborInsurance: parseFloat(r.total_labor_insurance || "0"),
    totalHealthInsurance: parseFloat(r.total_health_insurance || "0"),
    totalPension: parseFloat(r.total_pension || "0"),
    totalDeduction: parseFloat(r.total_deduction || "0"),
    totalNetSalary: parseFloat(r.total_net_salary || "0"),
    monthsWorked: parseInt(r.months_worked || "0"),
  }))

  const totals = employeeList.reduce(
    (acc, e) => ({
      totalSalary: acc.totalSalary + e.totalSalary,
      totalDeduction: acc.totalDeduction + e.totalDeduction,
      totalNetSalary: acc.totalNetSalary + e.totalNetSalary,
    }),
    { totalSalary: 0, totalDeduction: 0, totalNetSalary: 0 }
  )

  return { year, employees: employeeList, totals }
}

// ============================================================
// 二代健保補充保費試算
// ============================================================

export async function getSupplementaryHealthReport(year: number) {
  const supplementaryRate = 0.0211
  const baseWageThreshold = 27470

  const bonusResult = await db.execute(sql`
    SELECT
      e.employee_name,
      hc.month,
      CAST(hc.base_salary AS DECIMAL(12,2)) as monthly_salary
    FROM monthly_hr_costs hc
    JOIN employees e ON hc.employee_id = e.id
    WHERE hc.year = ${year}
    ORDER BY e.employee_name, hc.month
  `)

  const employeeMap = new Map<string, { name: string; totalSalary: number; months: number }>()
  for (const r of ((bonusResult.rows || []) as SqlRow[])) {
    const name = r.employee_name
    const existing = employeeMap.get(name) || { name, totalSalary: 0, months: 0 }
    existing.totalSalary += parseFloat(r.monthly_salary || "0")
    existing.months += 1
    employeeMap.set(name, existing)
  }

  const employeeList = Array.from(employeeMap.values()).map((e) => {
    const avgMonthly = e.months > 0 ? e.totalSalary / e.months : 0
    const estimatedBonus = avgMonthly
    const taxableAmount = Math.max(0, estimatedBonus - baseWageThreshold)
    const supplementaryPremium = Math.round(taxableAmount * supplementaryRate)

    return {
      employeeName: e.name,
      avgMonthlySalary: Math.round(avgMonthly),
      estimatedBonus: Math.round(estimatedBonus),
      taxableAmount: Math.round(taxableAmount),
      supplementaryPremium,
    }
  })

  const totalPremium = employeeList.reduce((s, e) => s + e.supplementaryPremium, 0)

  return {
    year,
    supplementaryRate,
    baseWageThreshold,
    employees: employeeList,
    totalPremium,
    note: "試算結果僅供參考，實際以政府公告為準。年終獎金以月薪估算。",
  }
}
