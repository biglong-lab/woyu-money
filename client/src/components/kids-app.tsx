import { Switch, Route } from "wouter";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

// Kids Pages
import KidsDashboard from "@/pages/kids-dashboard";
import KidsEducation from "@/pages/kids-education";
import KidsEducationGames from "@/pages/kids-education-games";
import KidsWishlist from "@/pages/kids-wishlist";
import KidsSavings from "@/pages/kids-savings";
import KidsLoans from "@/pages/kids-loans";
import KidsSchedule from "@/pages/kids-schedule";

// 兒童登入狀態檢查
function useChildAuth() {
  const [childSession, setChildSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const checkChildSession = () => {
      try {
        const sessionData = localStorage.getItem("childSession");
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const now = new Date();
          const expiresAt = new Date(session.expiresAt);
          
          if (now < expiresAt) {
            setChildSession(session);
          } else {
            localStorage.removeItem("childSession");
            setLocation("/child-login");
          }
        } else {
          setLocation("/child-login");
        }
      } catch (error) {
        console.error("Session validation failed:", error);
        localStorage.removeItem("childSession");
        setLocation("/child-login");
      } finally {
        setIsLoading(false);
      }
    };

    checkChildSession();
  }, [setLocation]);

  return { childSession, isLoading };
}

export default function KidsApp() {
  const { childSession, isLoading } = useChildAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在驗證登入狀態...</p>
        </div>
      </div>
    );
  }

  // 如果在兒童路由但沒有登入，重導向到登入頁面
  if (location.startsWith("/kids/") && !childSession) {
    return null; // useChildAuth hook 會處理重導向
  }

  return (
    <Switch>
      {/* 兒童專屬路由 - 需要登入驗證 */}
      <Route path="/kids/dashboard">
        <KidsDashboard childSession={childSession} />
      </Route>
      
      <Route path="/kids/education">
        <KidsEducation childSession={childSession} />
      </Route>
      
      <Route path="/kids/education/games">
        <KidsEducationGames childSession={childSession} />
      </Route>
      
      <Route path="/kids/wishlist">
        <KidsWishlist childSession={childSession} />
      </Route>
      
      <Route path="/kids/savings">
        <KidsSavings childSession={childSession} />
      </Route>
      
      <Route path="/kids/loans">
        <KidsLoans childSession={childSession} />
      </Route>
      
      <Route path="/kids/schedule">
        <KidsSchedule childSession={childSession} />
      </Route>


      
      {/* 預設重導向 */}
      <Route>
        {childSession ? (
          <KidsDashboard childSession={childSession} />
        ) : (
          <div>請先登入</div>
        )}
      </Route>
    </Switch>
  );
}