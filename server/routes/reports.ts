/**
 * 報表 API 路由
 * 提供財務三表和人事費報表的查詢端點
 */
import { Router } from "express"
import { db } from "../db"
import { sql } from "drizzle-orm"

const router = Router()

// 簡易損益表
router.get("/api/reports/income-statement", async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`
    const endDate = `${year}-${String(month).padStart(2, "0")}-31`

    // 收入：從 rental_revenue 和收入類型的付款記錄
    const incomeResult = await db.execute(sql`
      SELECT
        COALESCE(dc.category_name, '其他收入') as category,
        SUM(CAST(pr.amount AS DECIMAL(12,2))) as amount
      FROM payment_records pr
      LEFT JOIN payment_items pi ON pr.payment_item_id = pi.id
      LEFT JOIN debt_categories dc ON pi.category_id = dc.id
      WHERE pr.payment_date >= ${startDate}
        AND pr.payment_date <= ${endDate}
        AND pi.item_type = 'income'
      GROUP BY dc.category_name
      ORDER BY amount DESC
    `)

    // 租金收入
    const rentalIncomeResult = await db.execute(sql`
      SELECT
        '租金收入' as category,
        COALESCE(SUM(CAST(monthly_rent AS DECIMAL(12,2))), 0) as amount
      FROM rental_contracts
      WHERE is_active = true
        AND start_date <= ${endDate}
        AND (end_date IS NULL OR end_date >= ${startDate})
    `)

    // 支出：從付款記錄按分類彙總
    const expenseResult = await db.execute(sql`
      SELECT
        COALESCE(dc.category_name, '其他支出') as category,
        SUM(CAST(pr.amount AS DECIMAL(12,2))) as amount
      FROM payment_records pr
      LEFT JOIN payment_items pi ON pr.payment_item_id = pi.id
      LEFT JOIN debt_categories dc ON pi.category_id = dc.id
      WHERE pr.payment_date >= ${startDate}
        AND pr.payment_date <= ${endDate}
        AND (pi.item_type IS NULL OR pi.item_type != 'income')
      GROUP BY dc.category_name
      ORDER BY amount DESC
    `)

    // 人事費支出
    const hrCostResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CAST(total_cost AS DECIMAL(12,2))), 0) as total_cost,
        COALESCE(SUM(CAST(base_salary AS DECIMAL(12,2))), 0) as salary,
        COALESCE(SUM(CAST(employer_total AS DECIMAL(12,2))), 0) as employer_burden
      FROM monthly_hr_costs
      WHERE year = ${year} AND month = ${month}
    `)

    const incomeItems = [
      ...(rentalIncomeResult.rows || []).filter((r: any) => parseFloat(r.amount) > 0),
      ...(incomeResult.rows || []),
    ].map((r: any) => ({ category: r.category, amount: parseFloat(r.amount || "0") }))

    const incomeTotal = incomeItems.reduce((sum, i) => sum + i.amount, 0)

    const hrRow = (hrCostResult.rows || [])[0] as any
    const hrTotalCost = parseFloat(hrRow?.total_cost || "0")

    const expenseItems = [
      ...(expenseResult.rows || []).map((r: any) => ({
        category: r.category,
        amount: parseFloat(r.amount || "0"),
      })),
      ...(hrTotalCost > 0
        ? [{ category: "人事費用", amount: hrTotalCost }]
        : []),
    ]

    const expenseTotal = expenseItems.reduce((sum, i) => sum + i.amount, 0)

    res.json({
      year,
      month,
      income: { items: incomeItems, total: incomeTotal },
      expense: { items: expenseItems, total: expenseTotal },
      netIncome: incomeTotal - expenseTotal,
    })
  } catch (error: any) {
    console.error("損益表查詢錯誤:", error)
    res.status(500).json({ message: "損益表查詢失敗" })
  }
})

// 簡易資產負債表
router.get("/api/reports/balance-sheet", async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1
    const endDate = `${year}-${String(month).padStart(2, "0")}-31`

    // 資產：累計現金收入 - 累計現金支出
    const cashResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN pi.item_type = 'income' THEN CAST(pr.amount AS DECIMAL(12,2)) ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN pi.item_type IS NULL OR pi.item_type != 'income' THEN CAST(pr.amount AS DECIMAL(12,2)) ELSE 0 END), 0) as total_expense
      FROM payment_records pr
      LEFT JOIN payment_items pi ON pr.payment_item_id = pi.id
      WHERE pr.payment_date <= ${endDate}
    `)

    const cashRow = (cashResult.rows || [])[0] as any
    const totalIncome = parseFloat(cashRow?.total_income || "0")
    const totalExpense = parseFloat(cashRow?.total_expense || "0")

    // 應收帳款：未收到的租金
    const receivableResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(monthly_rent AS DECIMAL(12,2))), 0) as receivable
      FROM rental_contracts
      WHERE is_active = true
    `)
    const receivable = parseFloat((receivableResult.rows?.[0] as any)?.receivable || "0")

    // 負債：未付款項目
    const payableResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(total_amount AS DECIMAL(12,2)) - CAST(COALESCE(paid_amount, '0') AS DECIMAL(12,2))), 0) as payable
      FROM payment_items
      WHERE is_deleted = false
        AND status != 'completed'
    `)
    const payable = parseFloat((payableResult.rows?.[0] as any)?.payable || "0")

    // 借入款項
    const loanResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(remaining_amount AS DECIMAL(12,2))), 0) as loan_balance
      FROM loans
      WHERE status = 'active' AND loan_type = 'borrow'
    `)
    const loanBalance = parseFloat((loanResult.rows?.[0] as any)?.loan_balance || "0")

    // 未付人事費
    const unpaidHrResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(total_cost AS DECIMAL(12,2))), 0) as unpaid
      FROM monthly_hr_costs
      WHERE is_paid = false
    `)
    const unpaidHr = parseFloat((unpaidHrResult.rows?.[0] as any)?.unpaid || "0")

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

    res.json({
      year,
      month,
      assets,
      liabilities,
      netWorth: assets.total - liabilities.total,
    })
  } catch (error: any) {
    console.error("資產負債表查詢錯誤:", error)
    res.status(500).json({ message: "資產負債表查詢失敗" })
  }
})

// 現金流量表
router.get("/api/reports/cash-flow", async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`
    const endDate = `${year}-${String(month).padStart(2, "0")}-31`

    // 營業現金流
    const operatingResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN pi.item_type = 'income' THEN CAST(pr.amount AS DECIMAL(12,2)) ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN pi.item_type IS NULL OR pi.item_type != 'income' THEN CAST(pr.amount AS DECIMAL(12,2)) ELSE 0 END), 0) as expense
      FROM payment_records pr
      LEFT JOIN payment_items pi ON pr.payment_item_id = pi.id
      WHERE pr.payment_date >= ${startDate}
        AND pr.payment_date <= ${endDate}
    `)

    const opRow = (operatingResult.rows || [])[0] as any
    const opIncome = parseFloat(opRow?.income || "0")
    const opExpense = parseFloat(opRow?.expense || "0")

    // 投資現金流：從 loans 表（invest 類型）
    const investResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'repayment' THEN CAST(lt.amount AS DECIMAL(12,2)) ELSE 0 END), 0) as invest_return,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'disbursement' THEN CAST(lt.amount AS DECIMAL(12,2)) ELSE 0 END), 0) as new_invest
      FROM loan_transactions lt
      JOIN loans l ON lt.loan_id = l.id
      WHERE lt.transaction_date >= ${startDate}
        AND lt.transaction_date <= ${endDate}
        AND l.loan_type = 'invest'
    `)

    const invRow = (investResult.rows || [])[0] as any
    const investReturn = parseFloat(invRow?.invest_return || "0")
    const newInvest = parseFloat(invRow?.new_invest || "0")

    // 融資現金流：借入和還款
    const financeResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'disbursement' THEN CAST(lt.amount AS DECIMAL(12,2)) ELSE 0 END), 0) as borrowed,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'repayment' THEN CAST(lt.amount AS DECIMAL(12,2)) ELSE 0 END), 0) as repaid
      FROM loan_transactions lt
      JOIN loans l ON lt.loan_id = l.id
      WHERE lt.transaction_date >= ${startDate}
        AND lt.transaction_date <= ${endDate}
        AND l.loan_type = 'borrow'
    `)

    const finRow = (financeResult.rows || [])[0] as any
    const borrowed = parseFloat(finRow?.borrowed || "0")
    const repaid = parseFloat(finRow?.repaid || "0")

    const operating = {
      items: [
        { category: "營業收入", amount: opIncome },
        { category: "營業支出", amount: -opExpense },
      ],
      total: opIncome - opExpense,
    }

    const investing = {
      items: [
        { category: "投資收回", amount: investReturn },
        { category: "新增投資", amount: -newInvest },
      ],
      total: investReturn - newInvest,
    }

    const financing = {
      items: [
        { category: "借入款項", amount: borrowed },
        { category: "償還借款", amount: -repaid },
      ],
      total: borrowed - repaid,
    }

    res.json({
      year,
      month,
      operating,
      investing,
      financing,
      netCashFlow: operating.total + investing.total + financing.total,
    })
  } catch (error: any) {
    console.error("現金流量表查詢錯誤:", error)
    res.status(500).json({ message: "現金流量表查詢失敗" })
  }
})

// 人事費年度報表
router.get("/api/reports/hr-cost-report", async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()

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

    const monthlyBreakdown = (result.rows || []).map((r: any) => ({
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

    res.json({ year, monthlyBreakdown, yearTotal })
  } catch (error: any) {
    console.error("人事費年度報表查詢錯誤:", error)
    res.status(500).json({ message: "人事費年度報表查詢失敗" })
  }
})

// 人事費月度明細
router.get("/api/reports/hr-cost-report/:year/:month", async (req, res) => {
  try {
    const year = parseInt(req.params.year)
    const month = parseInt(req.params.month)

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

    const details = (result.rows || []).map((r: any) => ({
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

    res.json(details)
  } catch (error: any) {
    console.error("人事費月度明細查詢錯誤:", error)
    res.status(500).json({ message: "人事費月度明細查詢失敗" })
  }
})

export default router
