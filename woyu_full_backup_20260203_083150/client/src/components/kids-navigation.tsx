import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Home, 
  Star, 
  Coins, 
  CreditCard,
  Calendar,
  BookOpen,
  ArrowLeft,
  Users,
  Gamepad2
} from "lucide-react";

const kidProfiles = {
  1: { name: "小哥哥", avatar: "🧒", color: "bg-blue-500" },
  2: { name: "小姐姐", avatar: "👧", color: "bg-pink-500" },
  3: { name: "小弟弟", avatar: "👦", color: "bg-green-500" }
};

interface KidsNavigationProps {
  showBackToMain?: boolean;
}

export function KidsNavigation({ showBackToMain = false }: KidsNavigationProps) {
  const [location] = useLocation();
  const selectedKidId = parseInt(localStorage.getItem('selectedKid') || '1');
  const kid = kidProfiles[selectedKidId as keyof typeof kidProfiles];

  return (
    <div className="bg-gradient-to-r from-yellow-100 to-orange-100 p-4 border-b-2 border-yellow-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          {/* 左側：返回按鈕或小朋友資訊 */}
          <div className="flex items-center gap-4">
            {showBackToMain && (
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  回到主選單
                </Button>
              </Link>
            )}
            
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${kid.color} flex items-center justify-center text-xl`}>
                {kid.avatar}
              </div>
              <div>
                <div className="font-bold text-gray-800">{kid.name}</div>
                <div className="text-sm text-gray-600">財務小專家</div>
              </div>
            </div>
          </div>

          {/* 右側：切換小朋友按鈕 */}
          <Link href="/kids/login">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              切換小朋友
            </Button>
          </Link>
        </div>

        {/* 導航選單 */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href="/kids/dashboard">
            <Button 
              variant={location === "/kids/dashboard" ? "default" : "outline"} 
              size="sm"
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              首頁
            </Button>
          </Link>

          <Link href="/kids/wishlist">
            <Button 
              variant={location === "/kids/wishlist" ? "default" : "outline"} 
              size="sm"
              className="flex items-center gap-2"
            >
              <Star className="h-4 w-4" />
              願望清單
            </Button>
          </Link>

          <Link href="/kids/savings">
            <Button 
              variant={location === "/kids/savings" ? "default" : "outline"} 
              size="sm"
              className="flex items-center gap-2"
            >
              <Coins className="h-4 w-4" />
              存錢罐
            </Button>
          </Link>

          <Link href="/kids/loans">
            <Button 
              variant={location === "/kids/loans" ? "default" : "outline"} 
              size="sm"
              className="flex items-center gap-2"
            >
              <CreditCard className="h-4 w-4" />
              借錢記錄
            </Button>
          </Link>

          <Link href="/kids/schedule">
            <Button 
              variant={location === "/kids/schedule" ? "default" : "outline"} 
              size="sm"
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              時間管理
            </Button>
          </Link>

          <Link href="/kids/education">
            <Button 
              variant={location === "/kids/education" ? "default" : "outline"} 
              size="sm"
              className="flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              理財小學堂
            </Button>
          </Link>

          <Link href="/kids/education/games">
            <Button 
              variant={location === "/kids/education/games" ? "default" : "outline"} 
              size="sm"
              className="flex items-center gap-2"
            >
              <Gamepad2 className="h-4 w-4" />
              教育遊戲
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}