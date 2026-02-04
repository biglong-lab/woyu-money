import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Home, 
  Building2, 
  Users, 
  Baby, 
  Calculator,
  FileText,
  CreditCard,
  TrendingUp,
  Settings,
  List,
  Star,
  Coins,
  Calendar,
  BookOpen,
  Shield,
  UserCheck,
  DollarSign,
  CreditCard as CreditCardIcon
} from "lucide-react";

export function MainNavigation() {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">家庭財務管理系統</h1>
          <p className="text-gray-600">四個專區，完整管理您的財務生活</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 大人專區 - 浯島文旅營運管理 */}
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-100 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-blue-700 mb-2">大人專區</h2>
                <p className="text-blue-600">浯島文旅營運管理</p>
              </div>
              
              <div className="space-y-3">
                <Link href="/dashboard">
                  <Button 
                    variant={location === "/dashboard" ? "default" : "outline"} 
                    className="w-full justify-start bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    營運總覽
                  </Button>
                </Link>
                
                <Link href="/transactions">
                  <Button 
                    variant={location === "/transactions" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    付款規劃工具
                  </Button>
                </Link>
                
                <Link href="/categories">
                  <Button 
                    variant={location === "/categories" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <List className="h-4 w-4 mr-2" />
                    費用分類管理
                  </Button>
                </Link>
                
                <Link href="/reports">
                  <Button 
                    variant={location === "/reports" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    財務報表
                  </Button>
                </Link>
                
                <Link href="/backup">
                  <Button 
                    variant={location === "/backup" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    系統管理
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* 家庭專區 - 個人理財 */}
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-100 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-green-700 mb-2">家庭專區</h2>
                <p className="text-green-600">個人理財管理</p>
              </div>
              
              <div className="space-y-3">
                <Link href="/family/dashboard">
                  <Button 
                    variant={location === "/family/dashboard" ? "default" : "outline"} 
                    className="w-full justify-start bg-green-500 hover:bg-green-600 text-white"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    家庭財務總覽
                  </Button>
                </Link>
                
                <Link href="/family/expenses">
                  <Button 
                    variant={location === "/family/expenses" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    生活開銷記錄
                  </Button>
                </Link>
                
                <Link href="/family/budget">
                  <Button 
                    variant={location === "/family/budget" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    預算規劃
                  </Button>
                </Link>
                
                <Link href="/family/goals">
                  <Button 
                    variant={location === "/family/goals" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    理財目標
                  </Button>
                </Link>
                
                <Link href="/family/reports">
                  <Button 
                    variant={location === "/family/reports" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    家庭財務報告
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* 小朋友專區 - 財務教育 */}
          <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-100 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Baby className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-yellow-700 mb-2">小朋友專區</h2>
                <p className="text-yellow-600">財務教育遊樂園</p>
              </div>
              
              <div className="space-y-3">
                <Link href="/kids/login">
                  <Button 
                    variant={location === "/kids/login" ? "default" : "outline"} 
                    className="w-full justify-start bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    登入選擇
                  </Button>
                </Link>
                
                <Link href="/kids/dashboard">
                  <Button 
                    variant={location === "/kids/dashboard" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    我的首頁
                  </Button>
                </Link>
                
                <Link href="/kids/wishlist">
                  <Button 
                    variant={location === "/kids/wishlist" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    願望清單
                  </Button>
                </Link>
                
                <Link href="/kids/savings">
                  <Button 
                    variant={location === "/kids/savings" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <Coins className="h-4 w-4 mr-2" />
                    我的存錢罐
                  </Button>
                </Link>
                
                <Link href="/kids/schedule">
                  <Button 
                    variant={location === "/kids/schedule" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    時間管理
                  </Button>
                </Link>
                
                <Link href="/kids/education">
                  <Button 
                    variant={location === "/kids/education" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    理財小學堂
                  </Button>
                </Link>
                
                <Link href="/kids/education/games">
                  <Button 
                    variant={location === "/kids/education/games" ? "default" : "outline"} 
                    className="w-full justify-start bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white border-0"
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    互動遊戲學習
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* 家長管理專區 */}
          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-100 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-purple-700 mb-2">家長管理專區</h2>
                <p className="text-purple-600">小朋友財務監督與控制</p>
              </div>
              
              <div className="space-y-3">
                <Link href="/parent/dashboard">
                  <Button 
                    variant={location === "/parent/dashboard" ? "default" : "outline"} 
                    className="w-full justify-start bg-purple-500 hover:bg-purple-600 text-white"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    家長控制台
                  </Button>
                </Link>
                
                <Link href="/parent/children">
                  <Button 
                    variant={location === "/parent/children" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    小朋友帳戶管理
                  </Button>
                </Link>
                
                <Link href="/parent/allowances">
                  <Button 
                    variant={location === "/parent/allowances" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    零用錢管理
                  </Button>
                </Link>
                
                <Link href="/parent/loans">
                  <Button 
                    variant={location === "/parent/loans" ? "default" : "outline"} 
                    className="w-full justify-start"
                  >
                    <CreditCardIcon className="h-4 w-4 mr-2" />
                    借款審核
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 快速統計 */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">系統概覽</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">營運管理</div>
                  <div className="text-sm text-gray-600">浯島文旅資本支出與營運費用追蹤</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">家庭理財</div>
                  <div className="text-sm text-gray-600">生活開銷、教育、旅遊等個人會計</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">財務教育</div>
                  <div className="text-sm text-gray-600">三個小朋友的遊戲化理財學習</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">家長管理</div>
                  <div className="text-sm text-gray-600">小朋友財務監督與零用錢控制</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}