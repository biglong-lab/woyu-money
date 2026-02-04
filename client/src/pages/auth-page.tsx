import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, CreditCard, BarChart3, FileText } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "請輸入用戶名"),
  password: z.string().min(1, "請輸入密碼"),
});

const registerSchema = z.object({
  username: z.string().min(3, "用戶名至少需要3個字符"),
  password: z.string().min(6, "密碼至少需要6個字符"),
  fullName: z.string().min(1, "請輸入姓名"),
  email: z.string().email("請輸入有效的電子郵件").optional().or(z.literal("")),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  const [, setLocation] = useLocation();
  const [lineError, setLineError] = useState<string | null>(null);
  const [lineSuccess, setLineSuccess] = useState(false);

  // Check for LINE login results in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const lineLoginSuccess = urlParams.get('line_login_success');
    
    if (error) {
      const errorMessages: Record<string, string> = {
        'line_auth_failed': 'LINE授權失敗，請重試',
        'line_not_enabled': 'LINE登入服務未啟用',
        'missing_code': '授權碼缺失，請重試',
        'token_exchange_failed': 'Token交換失敗，請檢查LINE配置',
        'profile_fetch_failed': '無法獲取LINE用戶資料',
        'callback_failed': 'LINE登入回調失敗'
      };
      setLineError(errorMessages[error] || '未知的LINE登入錯誤');
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (lineLoginSuccess) {
      setLineSuccess(true);
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    }
  }, [setLocation]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Don't render early return before all hooks are called
  const isAuthenticated = !!user;

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      email: "",
    },
  });

  const handleLogin = (data: LoginFormData) => {
    console.log('登入嘗試:', data);
    loginMutation.mutate(data, {
      onSuccess: (user) => {
        console.log('登入成功，用戶數據:', user);
        // 強制頁面重新載入以確保狀態同步
        window.location.href = '/';
      },
      onError: (error) => {
        console.error('登入錯誤:', error);
      }
    });
  };

  const handleRegister = (data: RegisterFormData) => {
    const registerData = {
      ...data,
      email: data.email || undefined,
    };
    registerMutation.mutate(registerData);
  };

  const handleLineLogin = () => {
    window.location.href = "/api/auth/line";
  };

  // If user is authenticated, redirect immediately
  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Authentication forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">付款管理系統</h1>
            <p className="text-muted-foreground">
              請登入以訪問您的付款管理平台
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">登入</TabsTrigger>
              <TabsTrigger value="register">註冊</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>登入帳戶</CardTitle>
                  <CardDescription>
                    輸入您的帳戶資訊以登入系統
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lineError && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertDescription className="text-red-800">
                        {lineError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {lineSuccess && (
                    <Alert className="border-green-200 bg-green-50">
                      <AlertDescription className="text-green-800">
                        LINE登入成功！正在跳轉...
                      </AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">用戶名</Label>
                      <Input
                        id="username"
                        {...loginForm.register("username")}
                        placeholder="請輸入用戶名"
                      />
                      {loginForm.formState.errors.username && (
                        <p className="text-sm text-destructive">
                          {loginForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">密碼</Label>
                      <Input
                        id="password"
                        type="password"
                        {...loginForm.register("password")}
                        placeholder="請輸入密碼"
                      />
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-destructive">
                          {loginForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      登入
                    </Button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        或者
                      </span>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleLineLogin}
                  >
                    使用 LINE 登入
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>創建新帳戶</CardTitle>
                  <CardDescription>
                    填寫以下資訊以創建您的帳戶
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-username">用戶名</Label>
                      <Input
                        id="reg-username"
                        {...registerForm.register("username")}
                        placeholder="請輸入用戶名"
                      />
                      {registerForm.formState.errors.username && (
                        <p className="text-sm text-destructive">
                          {registerForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-fullName">姓名</Label>
                      <Input
                        id="reg-fullName"
                        {...registerForm.register("fullName")}
                        placeholder="請輸入您的姓名"
                      />
                      {registerForm.formState.errors.fullName && (
                        <p className="text-sm text-destructive">
                          {registerForm.formState.errors.fullName.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-email">電子郵件 (選填)</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        {...registerForm.register("email")}
                        placeholder="請輸入電子郵件"
                      />
                      {registerForm.formState.errors.email && (
                        <p className="text-sm text-destructive">
                          {registerForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-password">密碼</Label>
                      <Input
                        id="reg-password"
                        type="password"
                        {...registerForm.register("password")}
                        placeholder="請輸入密碼"
                      />
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-destructive">
                          {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      註冊
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>


        </div>
      </div>

      {/* Right side - Feature overview */}
      <div className="flex-1 bg-gradient-to-br from-blue-600 to-purple-700 p-8 text-white flex items-center justify-center">
        <div className="max-w-md space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">專業付款管理平台</h2>
            <p className="text-blue-100">
              全方位的財務管理解決方案，讓您輕鬆掌控每一筆付款
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="bg-white/20 p-2 rounded-lg">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">付款追蹤管理</h3>
                <p className="text-sm text-blue-100">
                  完整記錄每筆付款，支援多項目分類管理
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-white/20 p-2 rounded-lg">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">借貸投資分析</h3>
                <p className="text-sm text-blue-100">
                  智能分析借貸投資收益，提供詳細報表
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-white/20 p-2 rounded-lg">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">檔案上傳管理</h3>
                <p className="text-sm text-blue-100">
                  支援匯款截圖、合約文件等檔案管理
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-white/20 p-2 rounded-lg">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">安全身份驗證</h3>
                <p className="text-sm text-blue-100">
                  支援帳密登入與LINE登入，保障資料安全
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}