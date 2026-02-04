import NavigationMenu from "@/components/navigation-menu";

interface PageLayoutProps {
  children: React.ReactNode;
  module: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export default function PageLayout({ children, module, title, description, actions }: PageLayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* 側邊導航選單 */}
      <NavigationMenu currentModule={module} className="hidden lg:block lg:w-64 lg:fixed lg:h-full lg:overflow-y-auto" />
      
      <div className="flex-1 lg:ml-64">
        {/* 手機版導航 */}
        <div className="lg:hidden p-4">
          <NavigationMenu currentModule={module} />
        </div>
        
        <div className="flex flex-col min-h-screen bg-slate-50">
          {/* Header */}
          <header className="bg-white border-b border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
                {description && <p className="text-slate-600 mt-1">{description}</p>}
              </div>
              {actions && (
                <div className="flex items-center space-x-3">
                  {actions}
                </div>
              )}
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}