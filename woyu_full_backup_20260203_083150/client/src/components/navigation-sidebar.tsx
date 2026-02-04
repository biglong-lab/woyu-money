import { Link, useLocation } from "wouter";
import { 
  WalletIcon, 
  ChartLineIcon, 
  PlusCircleIcon, 
  ListIcon, 
  TagsIcon, 
  ChartBarIcon, 
  DatabaseIcon,
  UserIcon,
  SettingsIcon,
  CheckCircleIcon
} from "lucide-react";

export default function NavigationSidebar() {
  const [location] = useLocation();

  const navigationItems = [
    { path: "/", label: "總覽", icon: ChartLineIcon },
    { path: "/transactions", label: "付款項目", icon: ListIcon },
    { path: "/categories", label: "分類管理", icon: TagsIcon },
    { path: "/reports", label: "館所帳務分析", icon: ChartBarIcon },
    { path: "/backup", label: "資料備份", icon: DatabaseIcon },
  ];

  return (
    <div className="w-64 bg-white shadow-lg border-r border-slate-200 flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <WalletIcon className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">付款規劃工具</h1>
            <p className="text-sm text-slate-500">館所帳務管理</p>
          </div>
        </div>
      </div>

      {/* Migration Status */}
      <div className="p-4 border-b border-slate-200">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="text-green-600 w-4 h-4" />
            <span className="text-sm font-medium text-green-800">遷移完成</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">所有資料已成功遷移至PostgreSQL</p>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <li key={item.path}>
                <Link href={item.path}>
                  <a className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? "bg-primary text-white" 
                      : "text-slate-700 hover:bg-slate-100"
                  }`}>
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{item.label}</span>
                  </a>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center">
            <UserIcon className="text-slate-600 w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">使用者</p>
            <p className="text-xs text-slate-500">管理員</p>
          </div>
          <button className="text-slate-400 hover:text-slate-600">
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
