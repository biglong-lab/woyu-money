import { Switch, Route } from "wouter";
import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import TopNavigation from "@/components/top-navigation";
import MobileTabBar from "@/components/mobile-tab-bar";
import AppBreadcrumb from "@/components/app-breadcrumb";
import QuickActionFAB from "@/components/quick-action-fab";
import QuickPaymentDialog from "@/components/quick-payment-dialog";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";

// Core existing components
import PaymentHome from "@/pages/payment-home";
import PaymentRecords from "@/pages/payment-records";
import MonthlyPaymentManagement from "@/pages/monthly-payment-management";
import InstallmentPaymentManagement from "@/pages/installment-payment-management";
import GeneralPaymentManagement from "@/pages/general-payment-management";
import RentalManagementEnhanced from "@/pages/rental-management-enhanced";
import LoanInvestmentEnhanced from "@/pages/loan-investment-enhanced";
import LoanInvestmentManagement from "@/pages/loan-investment-management";
import RevenueReports from "@/pages/revenue-reports";
import Settings from "@/pages/settings";
import AccountSettings from "@/pages/account-settings";
import CategoryManagement from "@/pages/category-management";
import ContractDetail from "@/pages/contract-detail";
import IntegratedPaymentAnalysisOptimized from "@/pages/integrated-payment-analysis-optimized";
import PaymentProjectStatsOptimized from "@/pages/payment-project-stats-optimized";
import PaymentReports from "@/pages/payment-reports";
import SimpleCategoryManagement from "@/pages/simple-category-management";
import ProjectSpecificItemsManagement from "@/pages/project-specific-items-management";
import UnifiedProjectTemplateManagement from "@/pages/unified-project-template-management";
import ProjectTemplateManagement from "@/pages/project-template-management";
import UserManagement from "@/pages/user-management";
import FeatureShowcase from "@/pages/feature-showcase";

import UnifiedPaymentSimple from "@/pages/unified-payment-simple";
import PaymentProject from "@/pages/payment-project";
import PaymentSchedule from "@/pages/payment-schedule-optimized";
import FinancialOverview from "@/pages/financial-overview";
import RecycleBin from "@/pages/recycle-bin";
import ProjectBudgetManagement from "@/pages/project-budget-management";
import DocumentInbox from "@/pages/document-inbox";
import HRCostManagement from "@/pages/hr-cost-management";
import FinancialStatements from "@/pages/financial-statements";
import HRCostReports from "@/pages/hr-cost-reports";
import TaxReports from "@/pages/tax-reports";
import HouseholdBudget from "@/pages/household-budget";
import HouseholdCategoryManagement from "@/pages/household-category-management";
import IncomeSourcesManagement from "@/pages/income-sources-management";
import IncomeWebhooksInbox from "@/pages/income-webhooks-inbox";

function Router() {
  const [quickPaymentOpen, setQuickPaymentOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Switch>
          {/* Authentication route - publicly accessible */}
          <Route path="/auth" component={AuthPage} />

          {/* All other routes are protected */}
          <Route>
            <TopNavigation />
            {/* 主要內容區域 - 底部留空間給手機 Tab Bar */}
            <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-6">
              {/* 麵包屑導航 */}
              <AppBreadcrumb className="mb-4" />
              <Switch>
                {/* Payment Home - Main dashboard */}
                <ProtectedRoute path="/" component={PaymentHome} />
                
                {/* Payment Management by Type */}
                <ProtectedRoute path="/monthly-payment-management" component={MonthlyPaymentManagement} />
                <ProtectedRoute path="/installment-payment-management" component={InstallmentPaymentManagement} />
                <ProtectedRoute path="/general-payment-management" component={GeneralPaymentManagement} />
                <ProtectedRoute path="/rental-management-enhanced" component={RentalManagementEnhanced} />
                <ProtectedRoute path="/loan-investment-management" component={LoanInvestmentEnhanced} />
                <ProtectedRoute path="/loan-investment" component={LoanInvestmentEnhanced} />
                
                {/* Core Views */}
                <ProtectedRoute path="/payment-records" component={PaymentRecords} />
                
                {/* Analysis and Reports */}
                <ProtectedRoute path="/financial-overview" component={FinancialOverview} />
                <ProtectedRoute path="/payment-analysis" component={IntegratedPaymentAnalysisOptimized} />
                <ProtectedRoute path="/payment-project-stats" component={PaymentProjectStatsOptimized} />
                <ProtectedRoute path="/payment-reports" component={PaymentReports} />
                <ProtectedRoute path="/payment/reports" component={PaymentReports} />
                <ProtectedRoute path="/revenue/reports" component={RevenueReports} />
                <ProtectedRoute path="/payment-project" component={PaymentProject} />
                <ProtectedRoute path="/payment-schedule" component={PaymentSchedule} />
                <ProtectedRoute path="/project-budget" component={ProjectBudgetManagement} />
                <ProtectedRoute path="/financial-statements" component={FinancialStatements} />
                <ProtectedRoute path="/hr-cost-reports" component={HRCostReports} />
                <ProtectedRoute path="/tax-reports" component={TaxReports} />
                
                {/* Category Management */}
                <ProtectedRoute path="/categories" component={SimpleCategoryManagement} />
                <ProtectedRoute path="/category-management" component={CategoryManagement} />
                
                {/* Template Management */}
                <ProtectedRoute path="/project-specific-items" component={ProjectSpecificItemsManagement} />
                <ProtectedRoute path="/unified-project-template-management" component={UnifiedProjectTemplateManagement} />
                <ProtectedRoute path="/project-template-management" component={ProjectTemplateManagement} />
                
                {/* System Management */}
                <ProtectedRoute path="/user-management" component={UserManagement} />
                <ProtectedRoute path="/recycle-bin" component={RecycleBin} />
                <ProtectedRoute path="/document-inbox" component={DocumentInbox} />
                <ProtectedRoute path="/hr-cost-management" component={HRCostManagement} />

                {/* Household Management */}
                <ProtectedRoute path="/household-budget" component={HouseholdBudget} />
                <ProtectedRoute path="/household-category-management" component={HouseholdCategoryManagement} />

                {/* Income Webhook Gateway — 進帳多系統接入 */}
                <ProtectedRoute path="/income/sources" component={IncomeSourcesManagement} />
                <ProtectedRoute path="/income/inbox" component={IncomeWebhooksInbox} />
                
                {/* Feature Showcase */}
                <ProtectedRoute path="/features" component={FeatureShowcase} />
                
                {/* Other Features */}
                <ProtectedRoute path="/unified-payment" component={UnifiedPaymentSimple} />
                <ProtectedRoute path="/settings" component={Settings} />
                <ProtectedRoute path="/account" component={AccountSettings} />
                <ProtectedRoute path="/contract/:id" component={ContractDetail} />
                
                {/* 404 */}
                <Route component={NotFound} />
              </Switch>
            </main>
            {/* 浮動快速操作按鈕 */}
            <QuickActionFAB onQuickPayment={() => setQuickPaymentOpen(true)} />
            {/* 快速付款對話框 */}
            <QuickPaymentDialog
              open={quickPaymentOpen}
              onOpenChange={setQuickPaymentOpen}
            />
            {/* 手機版底部導航欄 */}
            <MobileTabBar />
          </Route>
        </Switch>
      </div>
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;