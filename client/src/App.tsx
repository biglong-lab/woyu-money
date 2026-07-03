import { Switch, Route, Redirect } from "wouter"
import { useState, lazy, Suspense } from "react"
import { queryClient } from "./lib/queryClient"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/hooks/use-auth"
import { ProtectedRoute } from "@/lib/protected-route"
import TopNavigation from "@/components/top-navigation"
import { OfflineBanner } from "@/components/offline-banner"
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog"
import { CommandPalette } from "@/components/command-palette"
import { PwaInstallPrompt } from "@/components/pwa-install-prompt"
import { PwaUpdatePrompt } from "@/components/pwa-update-prompt"
import { PushPermissionPrompt } from "@/components/push-permission-prompt"
import MobileTabBar from "@/components/mobile-tab-bar"
import { PullToRefresh } from "@/components/pull-to-refresh"
import AppBreadcrumb from "@/components/app-breadcrumb"
import QuickActionFAB from "@/components/quick-action-fab"
import { BudgetOverrunNotifier } from "@/components/budget-overrun-notifier"
import { DailyReminderNotifier } from "@/components/household/daily-reminder-notifier"
import QuickPaymentDialog from "@/components/quick-payment-dialog"
import { AiAssistantSheet } from "@/components/ai-assistant-sheet"
import { ScrollToTopButton } from "@/components/scroll-to-top-button"
import NotFound from "@/pages/not-found"
import AuthPage from "@/pages/auth-page"

// 頁面全部 lazy load（Phase 4.2 code splitting）：首屏只載入殼與當前路由的 chunk
const PaymentHome = lazy(() => import("@/pages/payment-home"))
const PaymentRecords = lazy(() => import("@/pages/payment-records"))
const MonthlyPaymentManagement = lazy(() => import("@/pages/monthly-payment-management"))
const InstallmentPaymentManagement = lazy(() => import("@/pages/installment-payment-management"))
const GeneralPaymentManagement = lazy(() => import("@/pages/general-payment-management"))
const RentalManagementEnhanced = lazy(() => import("@/pages/rental-management-enhanced"))
const LoanInvestmentEnhanced = lazy(() => import("@/pages/loan-investment-enhanced"))
const RevenueReports = lazy(() => import("@/pages/revenue-reports"))
const RevenueCompare = lazy(() => import("@/pages/revenue-compare"))
const Settings = lazy(() => import("@/pages/settings"))
const AccountSettings = lazy(() => import("@/pages/account-settings"))
const ContractDetail = lazy(() => import("@/pages/contract-detail"))
const IntegratedPaymentAnalysisOptimized = lazy(
  () => import("@/pages/integrated-payment-analysis-optimized")
)
const PaymentProjectStatsOptimized = lazy(() => import("@/pages/payment-project-stats-optimized"))
const PaymentReports = lazy(() => import("@/pages/payment-reports"))
const CategoriesUnifiedPage = lazy(() => import("@/pages/categories-unified"))
const DataQualityPage = lazy(() => import("@/pages/data-quality"))
const PropertyGroupsManagement = lazy(() => import("@/pages/property-groups-management"))
const BudgetEstimates = lazy(() => import("@/pages/budget-estimates"))
const CostOverview = lazy(() => import("@/pages/cost-overview"))
const FamilyPage = lazy(() => import("@/pages/family"))
const FamilyKidPage = lazy(() => import("@/pages/family-kid"))
const PropertyPLReport = lazy(() => import("@/pages/property-pl-report"))
const VarianceReport = lazy(() => import("@/pages/variance-report"))
const UserManagement = lazy(() => import("@/pages/user-management"))
const PaymentProject = lazy(() => import("@/pages/payment-project"))
const PaymentSchedule = lazy(() => import("@/pages/payment-schedule-optimized"))
const RecycleBin = lazy(() => import("@/pages/recycle-bin"))
const ProjectBudgetManagement = lazy(() => import("@/pages/project-budget-management"))
const DocumentInbox = lazy(() => import("@/pages/document-inbox"))
const HRCostManagement = lazy(() => import("@/pages/hr-cost-management"))
const FinancialStatements = lazy(() => import("@/pages/financial-statements"))
const HRCostReports = lazy(() => import("@/pages/hr-cost-reports"))
const TaxReports = lazy(() => import("@/pages/tax-reports"))
const HouseholdBudget = lazy(() => import("@/pages/household-budget"))
const IncomeSourcesManagement = lazy(() => import("@/pages/income-sources-management"))
const IncomeWebhooksInbox = lazy(() => import("@/pages/income-webhooks-inbox"))
const ExpenseWebhooksInbox = lazy(() => import("@/pages/expense-webhooks-inbox"))
const CashAllocation = lazy(() => import("@/pages/cash-allocation"))
const LaborInsuranceWatch = lazy(() => import("@/pages/labor-insurance-watch"))
const RentalMatrix = lazy(() => import("@/pages/rental-matrix"))
const FixedExpenseMatrix = lazy(() => import("@/pages/fixed-expense-matrix"))
const LaborInsuranceMatrix = lazy(() => import("@/pages/labor-insurance-matrix"))
const Enforcement = lazy(() => import("@/pages/enforcement"))
const Bills = lazy(() => import("@/pages/bills"))
const CashflowDecisionCenter = lazy(() => import("@/pages/cashflow-decision-center"))
const ReceiptMatchHelper = lazy(() => import("@/pages/receipt-match-helper"))
const IntegrationsCenter = lazy(() => import("@/pages/integrations-center"))
const AdminCronHealthPage = lazy(() => import("@/pages/admin-cron-health"))
const RecurringExpensesPage = lazy(() => import("@/pages/recurring-expenses"))
const RevenueForecastPage = lazy(() => import("@/pages/revenue-forecast"))
const CardClaimsPage = lazy(() => import("@/pages/card-claims"))
const DebtsPage = lazy(() => import("@/pages/debts"))
const FinancialCockpitPage = lazy(() => import("@/pages/financial-cockpit"))
const PaymentPlannerPage = lazy(() => import("@/pages/payment-planner"))
const ScenarioPlannerPage = lazy(() => import("@/pages/scenario-planner"))
const ScenarioSimulatorPage = lazy(() => import("@/pages/scenario-simulator"))
const LateFeeSettingsPage = lazy(() => import("@/pages/late-fee-settings"))
const FinancialDashboardPage = lazy(() => import("@/pages/financial-dashboard"))
const PayablesDashboard = lazy(() => import("@/pages/payables-dashboard"))

// Core existing components

function Router() {
  const [quickPaymentOpen, setQuickPaymentOpen] = useState(false)
  const [aiSheetOpen, setAiSheetOpen] = useState(false)

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Switch>
          {/* Authentication route - publicly accessible */}
          <Route path="/auth" component={AuthPage} />

          {/* All other routes are protected */}
          <Route>
            <OfflineBanner />
            <KeyboardShortcutsDialog />
            <CommandPalette />
            <PwaInstallPrompt />
            <PwaUpdatePrompt />
            <PushPermissionPrompt />
            <PullToRefresh />
            <TopNavigation />
            {/* 主要內容區域 - 底部留空間給手機 Tab Bar */}
            <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-6">
              {/* 麵包屑導航 */}
              <AppBreadcrumb className="mb-4" />
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-24 text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
                    載入頁面中…
                  </div>
                }
              >
                <Switch>
                  {/* Payment Home - Main dashboard */}
                  <ProtectedRoute path="/" component={PaymentHome} />

                  {/* Payment Management by Type */}
                  <ProtectedRoute
                    path="/monthly-payment-management"
                    component={MonthlyPaymentManagement}
                  />
                  <ProtectedRoute
                    path="/installment-payment-management"
                    component={InstallmentPaymentManagement}
                  />
                  <ProtectedRoute
                    path="/general-payment-management"
                    component={GeneralPaymentManagement}
                  />
                  <ProtectedRoute
                    path="/rental-management-enhanced"
                    component={RentalManagementEnhanced}
                  />
                  <ProtectedRoute
                    path="/loan-investment-management"
                    component={LoanInvestmentEnhanced}
                  />
                  <ProtectedRoute path="/loan-investment" component={LoanInvestmentEnhanced} />

                  {/* Core Views */}
                  <ProtectedRoute path="/payment-records" component={PaymentRecords} />

                  {/* Analysis and Reports */}
                  <ProtectedRoute
                    path="/payment-analysis"
                    component={IntegratedPaymentAnalysisOptimized}
                  />
                  <ProtectedRoute
                    path="/payment-project-stats"
                    component={PaymentProjectStatsOptimized}
                  />
                  <ProtectedRoute path="/payment-reports" component={PaymentReports} />
                  <ProtectedRoute path="/payment/reports" component={PaymentReports} />
                  <ProtectedRoute path="/revenue/reports" component={RevenueReports} />
                  <ProtectedRoute path="/revenue/compare" component={RevenueCompare} />
                  <ProtectedRoute path="/payment-project" component={PaymentProject} />
                  <ProtectedRoute path="/payment-schedule" component={PaymentSchedule} />
                  <ProtectedRoute path="/project-budget" component={ProjectBudgetManagement} />
                  <ProtectedRoute path="/financial-statements" component={FinancialStatements} />
                  <ProtectedRoute path="/hr-cost-reports" component={HRCostReports} />
                  <ProtectedRoute path="/tax-reports" component={TaxReports} />

                  {/* Category Management — PR-3 統一頁，舊路徑保留供回滾 */}
                  <ProtectedRoute path="/categories" component={CategoriesUnifiedPage} />
                  <ProtectedRoute path="/settings/data-quality" component={DataQualityPage} />
                  <ProtectedRoute path="/property-groups" component={PropertyGroupsManagement} />
                  <ProtectedRoute path="/budget-estimates" component={BudgetEstimates} />
                  <ProtectedRoute path="/property-pl" component={PropertyPLReport} />
                  <ProtectedRoute path="/variance-report" component={VarianceReport} />
                  {/* 2026-07-03 導航收斂：財務總覽 v2 已拆散（館組視圖→館別損益、待處理→駕駛艙/首頁），舊路由導向駕駛艙 */}
                  <Route path="/financial-overview-v2">
                    <Redirect to="/financial-cockpit" replace />
                  </Route>
                  <ProtectedRoute path="/payables-dashboard" component={PayablesDashboard} />

                  {/* System Management */}
                  <ProtectedRoute path="/user-management" component={UserManagement} />
                  <ProtectedRoute path="/recycle-bin" component={RecycleBin} />
                  <ProtectedRoute path="/document-inbox" component={DocumentInbox} />
                  <ProtectedRoute path="/hr-cost-management" component={HRCostManagement} />

                  {/* Household Management */}
                  <ProtectedRoute path="/household-budget" component={HouseholdBudget} />

                  {/* Income Webhook Gateway — 進帳多系統接入 */}
                  <ProtectedRoute path="/income/sources" component={IncomeSourcesManagement} />
                  <ProtectedRoute path="/income/inbox" component={IncomeWebhooksInbox} />
                  <ProtectedRoute path="/expense/inbox" component={ExpenseWebhooksInbox} />

                  {/* Cash Allocation — 現金分配助理（核心決策功能）*/}
                  <ProtectedRoute path="/cash-allocation" component={CashAllocation} />

                  {/* Labor Insurance Watch — 勞健保滯納金監控 */}
                  <ProtectedRoute path="/labor-insurance-watch" component={LaborInsuranceWatch} />

                  {/* Rental Matrix — 租金月度矩陣 */}
                  <ProtectedRoute path="/rental-matrix" component={RentalMatrix} />
                  <ProtectedRoute path="/fixed-expense-matrix" component={FixedExpenseMatrix} />
                  <ProtectedRoute path="/labor-insurance-matrix" component={LaborInsuranceMatrix} />
                  <ProtectedRoute path="/enforcement" component={Enforcement} />
                  <ProtectedRoute path="/bills" component={Bills} />

                  {/* Cashflow Decision Center — 現金流決策中心 */}
                  <ProtectedRoute
                    path="/cashflow-decision-center"
                    component={CashflowDecisionCenter}
                  />

                  {/* Receipt Match Helper — 收據對應助手 */}
                  <ProtectedRoute path="/receipt-match-helper" component={ReceiptMatchHelper} />
                  <ProtectedRoute path="/integrations" component={IntegrationsCenter} />
                  <ProtectedRoute path="/admin/cron-health" component={AdminCronHealthPage} />
                  <ProtectedRoute path="/recurring-expenses" component={RecurringExpensesPage} />
                  <ProtectedRoute path="/revenue-forecast" component={RevenueForecastPage} />
                  <ProtectedRoute path="/card-claims" component={CardClaimsPage} />
                  <ProtectedRoute path="/debts" component={DebtsPage} />
                  <ProtectedRoute path="/financial-cockpit" component={FinancialCockpitPage} />
                  <ProtectedRoute path="/payment-planner" component={PaymentPlannerPage} />
                  <ProtectedRoute path="/scenario-planner" component={ScenarioPlannerPage} />
                  <ProtectedRoute path="/scenario-simulator" component={ScenarioSimulatorPage} />
                  <ProtectedRoute path="/late-fee-settings" component={LateFeeSettingsPage} />
                  <ProtectedRoute path="/financial-dashboard" component={FinancialDashboardPage} />
                  <ProtectedRoute path="/cost-overview" component={CostOverview} />
                  <ProtectedRoute path="/family" component={FamilyPage} />
                  <ProtectedRoute path="/family/kid/:id" component={FamilyKidPage} />

                  {/* Other Features */}
                  <ProtectedRoute path="/settings" component={Settings} />
                  <ProtectedRoute path="/account" component={AccountSettings} />
                  <ProtectedRoute path="/contract/:id" component={ContractDetail} />

                  {/* 404 */}
                  <Route component={NotFound} />
                </Switch>
              </Suspense>
            </main>
            {/* 浮動快速操作按鈕（桌面 + 手機都顯示，手機 bottom-20 避開 TabBar）*/}
            <QuickActionFAB
              onQuickPayment={() => setQuickPaymentOpen(true)}
              onOpenAi={() => setAiSheetOpen(true)}
            />
            <QuickPaymentDialog open={quickPaymentOpen} onOpenChange={setQuickPaymentOpen} />
            {/* 預算超支瀏覽器通知（背景輪詢、severity 升級才提醒）*/}
            <BudgetOverrunNotifier />
            {/* 每日 21:00 後沒記帳的提醒（保連續 streak） */}
            <DailyReminderNotifier />
            {/* AI 助手側邊抽屜 */}
            <AiAssistantSheet open={aiSheetOpen} onOpenChange={setAiSheetOpen} />
            {/* 滾動回頂部按鈕（行動版 + 桌面版皆顯示） */}
            <ScrollToTopButton />
            {/* 手機版底部導航欄 */}
            <MobileTabBar />
          </Route>
        </Switch>
      </div>
    </AuthProvider>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
