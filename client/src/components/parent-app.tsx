import { Switch, Route } from "wouter";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

// Parent Management Pages
import ParentDashboard from "@/pages/parent-dashboard";
import ParentChildren from "@/pages/parent-children";
import ParentAllowances from "@/pages/parent-allowances";
import ParentLoans from "@/pages/parent-loans";

// 父母登入狀態檢查
function useParentAuth() {
  const [parentSession, setParentSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const checkParentSession = () => {
      try {
        const sessionData = localStorage.getItem("parentSession");
        if (sessionData) {
          const session = JSON.parse(sessionData);
          setParentSession(session);
        } else {
          setLocation("/parent-login");
        }
      } catch (error) {
        console.error("Parent session validation failed:", error);
        localStorage.removeItem("parentSession");
        setLocation("/parent-login");
      } finally {
        setIsLoading(false);
      }
    };

    checkParentSession();
  }, [setLocation]);

  return { parentSession, isLoading };
}

export default function ParentApp() {
  const { parentSession, isLoading } = useParentAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">驗證登入狀態...</p>
        </div>
      </div>
    );
  }

  if (!parentSession) {
    return null; // 會被重新導向到登入頁面
  }

  return (
    <Switch>
      <Route path="/parent/dashboard" component={ParentDashboard} />
      <Route path="/parent/children" component={ParentChildren} />
      <Route path="/parent/allowances" component={ParentAllowances} />
      <Route path="/parent/loans" component={ParentLoans} />
      <Route path="/parent">
        {() => {
          // 預設重新導向到儀表板
          window.location.href = "/parent/dashboard";
          return null;
        }}
      </Route>
    </Switch>
  );
}