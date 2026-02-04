import { Switch, Route } from "wouter";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Receipt, 
  PieChart, 
  Target,
  FileText,
  ArrowLeft,
  Menu,
  Tag
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Family Pages
import FamilyDashboard from "@/pages/family-dashboard";
import FamilyExpenses from "@/pages/family-expenses";
import FamilyBudget from "@/pages/family-budget";
import FamilyGoals from "@/pages/family-goals";
import FamilyReports from "@/pages/family-reports";
import FamilyCategories from "@/pages/family-categories";
import NotFound from "@/pages/not-found";

const familyNavigationItems = [
  { path: "/family/dashboard", icon: Home, label: "財務總覽", color: "bg-blue-600" },
  { path: "/family/expenses", icon: Receipt, label: "支出記錄", color: "bg-red-500" },
  { path: "/family/budget", icon: PieChart, label: "預算規劃", color: "bg-green-600" },
  { path: "/family/goals", icon: Target, label: "理財目標", color: "bg-purple-600" },
  { path: "/family/categories", icon: Tag, label: "分類設定", color: "bg-indigo-500" },
  { path: "/family/reports", icon: FileText, label: "財務報告", color: "bg-orange-600" },
];

function FamilyNavigation() {
  const [location] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => location === path;

  const MobileNavigation = () => (
    <div className="md:hidden">
      <div className="fixed top-0 left-0 right-0 bg-green-600 text-white shadow-lg z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-white hover:bg-green-700">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              <span className="font-semibold">家庭理財管理</span>
            </div>
          </div>
          
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white hover:bg-green-700">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>理財管理選單</SheetTitle>
                <SheetDescription>
                  選擇功能項目
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-2">
                {familyNavigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.path} href={item.path}>
                      <Button
                        variant={isActive(item.path) ? "default" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <div className="h-16"></div>
    </div>
  );

  const DesktopNavigation = () => (
    <div className="hidden md:block fixed left-0 top-0 bottom-0 w-64 bg-green-600 text-white overflow-y-auto">
      <div className="p-6">
        <Link href="/">
          <Button variant="ghost" className="text-white hover:bg-green-700 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回主選單
          </Button>
        </Link>
        
        <div className="flex items-center gap-3 mb-8">
          <Home className="h-6 w-6" />
          <div>
            <h1 className="text-lg font-bold">家庭理財</h1>
            <p className="text-green-200 text-sm">財務管理系統</p>
          </div>
        </div>

        <nav className="space-y-2">
          {familyNavigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={isActive(item.path) ? "secondary" : "ghost"}
                  className="w-full justify-start text-white hover:bg-green-700"
                >
                  <Icon className="h-4 w-4 mr-3" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );

  return (
    <>
      <MobileNavigation />
      <DesktopNavigation />
    </>
  );
}

export default function FamilyApp() {
  return (
    <div className="min-h-screen bg-slate-50">
      <FamilyNavigation />
      <div className="md:ml-64">
        <Switch>
          <Route path="/family/dashboard" component={FamilyDashboard} />
          <Route path="/family/expenses" component={FamilyExpenses} />
          <Route path="/family/budget" component={FamilyBudget} />
          <Route path="/family/goals" component={FamilyGoals} />
          <Route path="/family/categories" component={FamilyCategories} />
          <Route path="/family/reports" component={FamilyReports} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}