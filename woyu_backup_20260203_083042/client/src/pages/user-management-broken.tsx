import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, UserPlus, Edit, Trash2, Shield, Key, ToggleLeft, ToggleRight } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  menuPermissions: any;
  authProvider: string;
  lastLogin: Date | null;
  createdAt: Date;
}

interface MenuPermissions {
  payment?: boolean;
  loanInvestment?: boolean;
  household?: boolean;
  reports?: boolean;
  system?: boolean;
  templates?: boolean;
  other?: boolean;
}

const ROLE_LABELS = {
  admin: "管理員",
  user1: "使用者1",
  user2: "使用者2"
};

const PERMISSION_LABELS = {
  payment: "付款管理",
  loanInvestment: "借貸投資",
  household: "家用記帳",
  reports: "分析報表",
  system: "系統管理",
  templates: "模板管理",
  other: "其他功能"
};

const DEFAULT_PERMISSIONS = {
  admin: {
    payment: true,
    loanInvestment: true,
    household: true,
    reports: true,
    system: true,
    templates: true,
    other: true,
  },
  user1: {
    payment: true,
    loanInvestment: true,
    household: true,
    reports: true,
    system: false,
    templates: false,
    other: true,
  },
  user2: {
    payment: false,
    loanInvestment: false,
    household: true,
    reports: false,
    system: false,
    templates: false,
    other: false,
  },
};

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    email: "",
    fullName: "",
    role: "user2"
  });
  const [newPassword, setNewPassword] = useState("");
  const [userPermissions, setUserPermissions] = useState<MenuPermissions>({});

  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    refetchInterval: 30000 // 每30秒自動更新
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await apiRequest("POST", "/api/admin/users", userData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCreateDialogOpen(false);
      setNewUserData({
        username: "",
        password: "",
        email: "",
        fullName: "",
        role: "user2"
      });
      toast({
        title: "成功",
        description: "用戶已創建",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "創建用戶失敗",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: "成功",
        description: "用戶已更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "更新用戶失敗",
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${id}/password`, { password });
      return response.json();
    },
    onSuccess: () => {
      setPasswordDialogOpen(false);
      setSelectedUser(null);
      setNewPassword("");
      toast({
        title: "成功",
        description: "密碼已更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "更新密碼失敗",
        variant: "destructive",
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ id, permissions }: { id: number; permissions: MenuPermissions }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${id}/permissions`, { menuPermissions: permissions });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setPermissionDialogOpen(false);
      setSelectedUser(null);
      setUserPermissions({});
      toast({
        title: "成功",
        description: "權限已更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "更新權限失敗",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "成功",
        description: "用戶已刪除",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "刪除用戶失敗",
        variant: "destructive",
      });
    },
  });

  // 如果正在載入，顯示載入狀態
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>用戶管理</CardTitle>
            <CardDescription>
              正在載入用戶數據...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 如果查詢出錯，顯示錯誤信息
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">加載錯誤</CardTitle>
            <CardDescription>
              無法加載用戶數據：{error instanceof Error ? error.message : '未知錯誤'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // 創建新用戶
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      const response = await apiRequest("POST", "/api/admin/users", userData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCreateDialogOpen(false);
      setNewUserData({ username: "", password: "", email: "", fullName: "", role: "user2" });
      toast({
        title: "成功",
        description: "用戶創建成功",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "創建用戶失敗",
        variant: "destructive",
      });
    }
  });

  // 更新用戶角色
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "成功",
        description: "用戶角色更新成功",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "更新角色失敗",
        variant: "destructive",
      });
    }
  });

  // 更新用戶權限
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: number; permissions: MenuPermissions }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/permissions`, { permissions });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setPermissionDialogOpen(false);
      toast({
        title: "成功",
        description: "用戶權限更新成功",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "更新權限失敗",
        variant: "destructive",
      });
    }
  });

  // 重置密碼
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/password`, { newPassword });
      return response.json();
    },
    onSuccess: () => {
      setPasswordDialogOpen(false);
      setNewPassword("");
      toast({
        title: "成功",
        description: "密碼重置成功",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "重置密碼失敗",
        variant: "destructive",
      });
    }
  });

  // 切換用戶狀態
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/status`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "成功",
        description: "用戶狀態更新成功",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "更新狀態失敗",
        variant: "destructive",
      });
    }
  });

  // 刪除用戶
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "成功",
        description: "用戶刪除成功",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "刪除用戶失敗",
        variant: "destructive",
      });
    }
  });

  const openPermissionDialog = (user: User) => {
    setSelectedUser(user);
    setUserPermissions(user.menuPermissions || {});
    setPermissionDialogOpen(true);
  };

  const openPasswordDialog = (user: User) => {
    setSelectedUser(user);
    setPasswordDialogOpen(true);
  };

  const handlePermissionChange = (key: keyof MenuPermissions, value: boolean) => {
    setUserPermissions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">用戶管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">管理系統用戶帳戶、角色和權限</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              新增用戶
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>創建新用戶</DialogTitle>
              <DialogDescription>
                填寫用戶資訊以創建新帳戶
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="username">用戶名 *</Label>
                <Input
                  id="username"
                  value={newUserData.username}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="輸入用戶名"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">密碼 *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="至少8個字符"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">電子郵件</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fullName">全名</Label>
                <Input
                  id="fullName"
                  value={newUserData.fullName}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="輸入全名"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">角色</Label>
                <Select value={newUserData.role} onValueChange={(value) => setNewUserData(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理員</SelectItem>
                    <SelectItem value="user1">使用者1</SelectItem>
                    <SelectItem value="user2">使用者2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                取消
              </Button>
              <Button 
                onClick={() => createUserMutation.mutate(newUserData)}
                disabled={!newUserData.username || !newUserData.password || createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "創建中..." : "創建用戶"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            用戶列表
          </CardTitle>
          <CardDescription>
            管理系統中所有用戶的基本資訊和權限設定
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">用戶</th>
                  <th className="text-left p-4 font-medium">角色</th>
                  <th className="text-left p-4 font-medium">狀態</th>
                  <th className="text-left p-4 font-medium">認證方式</th>
                  <th className="text-left p-4 font-medium">最後登入</th>
                  <th className="text-left p-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{user.fullName || user.username}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        <div className="text-xs text-gray-400">ID: {user.id}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={user.isActive ? 'default' : 'destructive'}>
                          {user.isActive ? '啟用' : '停用'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStatusMutation.mutate({ 
                            userId: user.id, 
                            isActive: !user.isActive 
                          })}
                        >
                          {user.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline">
                        {user.authProvider === 'line' ? 'LINE' : '本地'}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {user.lastLogin ? format(new Date(user.lastLogin), 'yyyy/MM/dd HH:mm', { locale: zhTW }) : '從未登入'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.role}
                          onValueChange={(value) => updateRoleMutation.mutate({ userId: user.id, role: value })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">管理員</SelectItem>
                            <SelectItem value="user1">使用者1</SelectItem>
                            <SelectItem value="user2">使用者2</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPermissionDialog(user)}
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPasswordDialog(user)}
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm('確定要刪除此用戶嗎？此操作無法撤銷。')) {
                              deleteUserMutation.mutate(user.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 權限設定對話框 */}
      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>用戶權限設定</DialogTitle>
            <DialogDescription>
              設定 {selectedUser?.fullName || selectedUser?.username} 的選單可見性
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key}>{label}</Label>
                <Switch
                  id={key}
                  checked={userPermissions[key as keyof MenuPermissions] || false}
                  onCheckedChange={(checked) => handlePermissionChange(key as keyof MenuPermissions, checked)}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={() => selectedUser && updatePermissionsMutation.mutate({ 
                userId: selectedUser.id, 
                permissions: userPermissions 
              })}
              disabled={updatePermissionsMutation.isPending}
            >
              {updatePermissionsMutation.isPending ? "更新中..." : "保存設定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 密碼重置對話框 */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重置密碼</DialogTitle>
            <DialogDescription>
              為 {selectedUser?.fullName || selectedUser?.username} 設定新密碼
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">新密碼</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少8個字符"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={() => selectedUser && resetPasswordMutation.mutate({ 
                userId: selectedUser.id, 
                newPassword 
              })}
              disabled={!newPassword || newPassword.length < 8 || resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? "重置中..." : "重置密碼"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}