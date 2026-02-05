import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  User, 
  Shield, 
  Smartphone, 
  Link as LinkIcon, 
  Unlink, 
  Eye, 
  EyeOff,
  Save,
  AlertTriangle
} from "lucide-react";

// Form schemas
const profileUpdateSchema = z.object({
  fullName: z.string().min(1, "姓名不能為空"),
  email: z.string().email("請輸入有效的電子郵件").optional().or(z.literal("")),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "請輸入當前密碼"),
  newPassword: z.string().min(6, "新密碼至少需要6個字符"),
  confirmPassword: z.string().min(1, "請確認新密碼"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "密碼確認不匹配",
  path: ["confirmPassword"],
});

type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
type PasswordChangeData = z.infer<typeof passwordChangeSchema>;

export default function AccountSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile update form
  const profileForm = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
    },
  });

  // Password change form
  const passwordForm = useForm<PasswordChangeData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Profile update mutation
  const profileUpdateMutation = useMutation({
    mutationFn: async (data: ProfileUpdateData) => {
      const response = await apiRequest("PUT", "/api/user/profile", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "個人資料更新成功",
        description: "您的個人資料已成功更新",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "更新失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Password change mutation
  const passwordChangeMutation = useMutation({
    mutationFn: async (data: PasswordChangeData) => {
      const response = await apiRequest("PUT", "/api/user/password", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "密碼更新成功",
        description: "您的密碼已成功更新",
      });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "密碼更新失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // LINE unlink mutation
  const lineUnlinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/line/unlink");
      return response;
    },
    onSuccess: () => {
      toast({
        title: "LINE帳號解綁成功",
        description: "您的LINE帳號已成功解綁",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "解綁失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleProfileUpdate = (data: ProfileUpdateData) => {
    profileUpdateMutation.mutate(data);
  };

  const handlePasswordChange = (data: PasswordChangeData) => {
    passwordChangeMutation.mutate(data);
  };

  const handleLineLogin = () => {
    window.location.href = "/api/auth/line";
  };

  const handleLineUnlink = () => {
    if (confirm("確定要解綁LINE帳號嗎？解綁後您將無法使用LINE登入。")) {
      lineUnlinkMutation.mutate();
    }
  };

  if (!user) {
    return <div>載入中...</div>;
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <User className="h-6 w-6" />
        <h1 className="text-2xl font-bold">帳號設定</h1>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">個人資料</TabsTrigger>
          <TabsTrigger value="security">安全設定</TabsTrigger>
          <TabsTrigger value="connections">帳號連結</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>基本資料</span>
              </CardTitle>
              <CardDescription>
                管理您的個人資料信息
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4">
                  <FormField
                    control={profileForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>姓名</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="請輸入您的姓名" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>電子郵件</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="請輸入您的電子郵件" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>用戶名</Label>
                      <Input value={user.username ?? ""} disabled className="bg-muted" />
                    </div>
                    <div>
                      <Label>角色</Label>
                      <div className="pt-2">
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? '管理員' : '用戶'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={profileUpdateMutation.isPending}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {profileUpdateMutation.isPending ? "更新中..." : "保存更改"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>密碼設定</span>
              </CardTitle>
              <CardDescription>
                更改您的登入密碼
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user.authProvider === 'line' && !user.password ? (
                <div className="flex items-center space-x-2 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <span className="text-amber-800 dark:text-amber-200">
                    您使用LINE登入，無需設定密碼
                  </span>
                </div>
              ) : (
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>當前密碼</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field} 
                                type={showCurrentPassword ? "text" : "password"}
                                placeholder="請輸入當前密碼" 
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              >
                                {showCurrentPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>新密碼</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field} 
                                type={showNewPassword ? "text" : "password"}
                                placeholder="請輸入新密碼" 
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                              >
                                {showNewPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>確認新密碼</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field} 
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="請再次輸入新密碼" 
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              >
                                {showConfirmPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      disabled={passwordChangeMutation.isPending}
                      className="w-full"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      {passwordChangeMutation.isPending ? "更新中..." : "更新密碼"}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Smartphone className="h-5 w-5" />
                <span>LINE登入</span>
              </CardTitle>
              <CardDescription>
                連結您的LINE帳號以便快速登入
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user.lineUserId ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <Smartphone className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">{user.lineDisplayName || "LINE用戶"}</p>
                        <p className="text-sm text-muted-foreground">已連結</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLineUnlink}
                      disabled={lineUnlinkMutation.isPending}
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      解綁
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    連結LINE帳號後，您可以使用LINE快速登入系統
                  </p>
                  <Button onClick={handleLineLogin} className="w-full bg-green-500 hover:bg-green-600">
                    <LinkIcon className="h-4 w-4 mr-2" />
                    連結LINE帳號
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}