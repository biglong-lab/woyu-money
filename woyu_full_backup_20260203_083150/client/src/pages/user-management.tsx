import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Trash2, Edit, Key, Settings, Plus } from "lucide-react";

interface User {
  id: number;
  username: string;
  email: string | null;
  fullName: string | null;
  role: string;
  isActive: boolean;
  menuPermissions: MenuPermissions;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
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

const defaultPermissions: Record<string, MenuPermissions> = {
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
  // All hooks must be at the top level
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
    refetchInterval: 30000
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

  // Early returns after all hooks
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>用戶管理</CardTitle>
            <CardDescription>正在載入用戶數據...</CardDescription>
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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>錯誤</CardTitle>
            <CardDescription>載入用戶數據時發生錯誤</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Event handlers
  const handleCreateUser = () => {
    createUserMutation.mutate({
      ...newUserData,
      menuPermissions: defaultPermissions[newUserData.role] || {}
    });
  };

  const handleUpdateUser = () => {
    if (!selectedUser) return;
    updateUserMutation.mutate({
      id: selectedUser.id,
      data: {
        username: selectedUser.username,
        email: selectedUser.email,
        fullName: selectedUser.fullName,
        role: selectedUser.role,
        isActive: selectedUser.isActive
      }
    });
  };

  const handleUpdatePassword = () => {
    if (!selectedUser || !newPassword) return;
    updatePasswordMutation.mutate({
      id: selectedUser.id,
      password: newPassword
    });
  };

  const handleUpdatePermissions = () => {
    if (!selectedUser) return;
    updatePermissionsMutation.mutate({
      id: selectedUser.id,
      permissions: userPermissions
    });
  };

  const handleDeleteUser = (userId: number) => {
    if (confirm("確定要刪除此用戶嗎？")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const openPasswordDialog = (user: User) => {
    setSelectedUser(user);
    setPasswordDialogOpen(true);
  };

  const openPermissionDialog = (user: User) => {
    setSelectedUser(user);
    setUserPermissions(user.menuPermissions || {});
    setPermissionDialogOpen(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800";
      case "user1": return "bg-blue-100 text-blue-800";
      case "user2": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "admin": return "管理員";
      case "user1": return "使用者1";
      case "user2": return "使用者2";
      default: return role;
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>用戶管理</CardTitle>
              <CardDescription>管理系統用戶和權限設定</CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  新增用戶
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增用戶</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">用戶名</Label>
                    <Input
                      id="username"
                      value={newUserData.username}
                      onChange={(e) => setNewUserData({...newUserData, username: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">密碼</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUserData.password}
                      onChange={(e) => setNewUserData({...newUserData, password: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">電子郵件</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">全名</Label>
                    <Input
                      id="fullName"
                      value={newUserData.fullName}
                      onChange={(e) => setNewUserData({...newUserData, fullName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">角色</Label>
                    <Select value={newUserData.role} onValueChange={(value) => setNewUserData({...newUserData, role: value})}>
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
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleCreateUser} disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? "創建中..." : "創建"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users?.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="font-medium">{user.username}</h3>
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {getRoleDisplayName(user.role)}
                    </Badge>
                    {!user.isActive && (
                      <Badge variant="secondary">已停用</Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    <p>{user.fullName || "未設定全名"}</p>
                    <p>{user.email || "未設定郵件"}</p>
                    {user.lastLogin && (
                      <p>最後登入: {new Date(user.lastLogin).toLocaleString()}</p>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openPasswordDialog(user)}>
                    <Key className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openPermissionDialog(user)}>
                    <Settings className="w-4 h-4" />
                  </Button>
                  {user.id !== 1 && (
                    <Button variant="outline" size="sm" onClick={() => handleDeleteUser(user.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯用戶</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-username">用戶名</Label>
                <Input
                  id="edit-username"
                  value={selectedUser.username}
                  onChange={(e) => setSelectedUser({...selectedUser, username: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">電子郵件</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={selectedUser.email || ""}
                  onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-fullName">全名</Label>
                <Input
                  id="edit-fullName"
                  value={selectedUser.fullName || ""}
                  onChange={(e) => setSelectedUser({...selectedUser, fullName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">角色</Label>
                <Select value={selectedUser.role} onValueChange={(value) => setSelectedUser({...selectedUser, role: value})}>
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
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-isActive"
                  checked={selectedUser.isActive}
                  onCheckedChange={(checked) => setSelectedUser({...selectedUser, isActive: checked as boolean})}
                />
                <Label htmlFor="edit-isActive">帳號啟用</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleUpdateUser} disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? "更新中..." : "更新"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密碼</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">新密碼</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdatePassword} disabled={updatePasswordMutation.isPending}>
                {updatePasswordMutation.isPending ? "更新中..." : "更新密碼"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>權限設定</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'payment', label: '付款管理' },
                { key: 'loanInvestment', label: '借貸投資' },
                { key: 'household', label: '家用管理' },
                { key: 'reports', label: '報表分析' },
                { key: 'system', label: '系統管理' },
                { key: 'templates', label: '範本管理' },
                { key: 'other', label: '其他功能' }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`perm-${key}`}
                    checked={userPermissions[key as keyof MenuPermissions] || false}
                    onCheckedChange={(checked) => 
                      setUserPermissions({
                        ...userPermissions, 
                        [key]: checked as boolean
                      })
                    }
                  />
                  <Label htmlFor={`perm-${key}`}>{label}</Label>
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setPermissionDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdatePermissions} disabled={updatePermissionsMutation.isPending}>
                {updatePermissionsMutation.isPending ? "更新中..." : "更新權限"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}