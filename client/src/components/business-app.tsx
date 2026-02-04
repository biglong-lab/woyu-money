import { Switch, Route } from "wouter";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Receipt, 
  PieChart, 
  FileText,
  ArrowLeft,
  Menu
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Business Pages
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Categories from "@/pages/categories";
import Reports from "@/pages/reports";
import Backup from "@/pages/backup";
import NotFound from "@/pages/not-found";

const businessNavigationItems = [
  { path: "/business/dashboard", icon: Building2, label: "營運總覽", color: "bg-blue-500" },
  { path: "/business/transactions", icon: Receipt, label: "交易記錄", color: "bg-green-500" },
  { path: "/business/categories", icon: PieChart, label: "分類管理", color: "bg-purple-500" },
  { path: "/business/reports", icon: FileText, label: "營運報告", color: "bg-orange-500" },
  { path: "/business/backup", icon: FileText, label: "資料備份", color: "bg-gray-500" },
];

function BusinessNavigation() {
  const [location] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => location === path;

  const MobileNavigation = () => (
    <div className="md:hidden">
      <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white shadow-lg z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-white hover:bg-blue-700">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <span className="font-semibold">浯島文旅營運管理</span>
            </div>
          </div>
          
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white hover:bg-blue-700">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>營運管理選單</SheetTitle>
                <SheetDescription>
                  選擇功能項目
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-2">
                {businessNavigationItems.map((item) => {
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
    <div className="hidden md:block fixed left-0 top-0 bottom-0 w-64 bg-blue-600 text-white overflow-y-auto">
      <div className="p-6">
        <Link href="/">
          <Button variant="ghost" className="text-white hover:bg-blue-700 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回主選單
          </Button>
        </Link>
        
        <div className="flex items-center gap-3 mb-8">
          <Building2 className="h-6 w-6" />
          <div>
            <h1 className="text-lg font-bold">浯島文旅</h1>
            <p className="text-blue-200 text-sm">營運管理系統</p>
          </div>
        </div>

        <nav className="space-y-2">
          {businessNavigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={isActive(item.path) ? "secondary" : "ghost"}
                  className="w-full justify-start text-white hover:bg-blue-700"
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

export default function BusinessApp() {
  return (
    <div className="min-h-screen bg-slate-50">
      <BusinessNavigation />
      <div className="md:ml-64">
        <Switch>
          <Route path="/business/dashboard" component={Dashboard} />
          <Route path="/business/transactions" component={Transactions} />
          <Route path="/business/categories" component={Categories} />
          <Route path="/business/reports" component={Reports} />
          <Route path="/business/backup" component={Backup} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}