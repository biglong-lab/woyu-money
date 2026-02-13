// 系統管理 Tab 面板
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings as SettingsIcon, User, BarChart3, FileText,
  Save, CheckCircle2, X, Trash2, Loader2
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SystemUser } from "@/components/settings-types";

export default function SettingsAdminTab() {
  const [isUserListDialogOpen, setIsUserListDialogOpen] = useState(false);
  const [isUserPermissionDialogOpen, setIsUserPermissionDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: systemUsers = [], isLoading: usersLoading } = useQuery<SystemUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: isUserListDialogOpen || isUserPermissionDialogOpen,
  });

  // 更新用戶角色
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      return await apiRequest("PUT", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "權限更新成功", description: "用戶權限已成功更新" });
    },
    onError: (error: Error) => {
      toast({ title: "權限更新失敗", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            系統管理介面
          </CardTitle>
          <CardDescription>
            系統監控、用戶管理和維護工具
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* 用戶管理 / 系統監控 / 資料管理 卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 用戶管理 */}
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  用戶管理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  管理系統用戶帳號、權限和登入狀態
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => setIsUserListDialogOpen(true)}
                  >
                    <User className="w-4 h-4 mr-2" />
                    查看所有用戶
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => setIsUserPermissionDialogOpen(true)}
                  >
                    <User className="w-4 h-4 mr-2" />
                    管理權限
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 系統監控 */}
            <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                  系統監控
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-green-700 dark:text-green-300">
                  監控系統運行狀態和效能指標
                </p>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" className="justify-start">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    效能監控
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    健康檢查
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 資料管理 */}
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-600" />
                  資料管理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  資料備份、匯入匯出和清理工具
                </p>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" className="justify-start">
                    <Save className="w-4 h-4 mr-2" />
                    資料備份
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    匯入匯出
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 維護工具 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                系統維護
              </CardTitle>
              <CardDescription>
                系統維護和故障排除工具
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button variant="outline" className="h-auto p-4 flex-col gap-2">
                  <Trash2 className="w-6 h-6 text-red-500" />
                  <span className="font-medium">清理暫存</span>
                  <span className="text-xs text-muted-foreground">清除系統暫存檔案</span>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex-col gap-2">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  <span className="font-medium">資料驗證</span>
                  <span className="text-xs text-muted-foreground">檢查資料完整性</span>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex-col gap-2">
                  <Save className="w-6 h-6 text-blue-500" />
                  <span className="font-medium">手動備份</span>
                  <span className="text-xs text-muted-foreground">立即建立備份</span>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex-col gap-2">
                  <X className="w-6 h-6 text-orange-500" />
                  <span className="font-medium">重置快取</span>
                  <span className="text-xs text-muted-foreground">清除應用程式快取</span>
                </Button>
              </div>
            </CardContent>
          </Card>

        </CardContent>
      </Card>

      {/* 用戶列表 Dialog */}
      <Dialog open={isUserListDialogOpen} onOpenChange={setIsUserListDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              所有用戶列表
            </DialogTitle>
            <DialogDescription>
              查看系統中的所有用戶資訊和登入狀態
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">載入中...</span>
              </div>
            ) : (
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">用戶名稱</th>
                      <th className="px-4 py-3 text-left font-medium">全名</th>
                      <th className="px-4 py-3 text-left font-medium">信箱</th>
                      <th className="px-4 py-3 text-left font-medium">角色</th>
                      <th className="px-4 py-3 text-left font-medium">狀態</th>
                      <th className="px-4 py-3 text-left font-medium">最後登入</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemUsers.map((user: SystemUser) => (
                      <tr key={user.id} className="border-t">
                        <td className="px-4 py-3">{user.username}</td>
                        <td className="px-4 py-3">{user.fullName || '-'}</td>
                        <td className="px-4 py-3">{user.email || '-'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' ? '管理員' : '一般用戶'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={user.isActive ? 'default' : 'secondary'}>
                            {user.isActive ? '啟用' : '停用'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-TW') : '從未登入'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 權限管理 Dialog */}
      <Dialog open={isUserPermissionDialogOpen} onOpenChange={setIsUserPermissionDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              權限管理
            </DialogTitle>
            <DialogDescription>
              管理用戶角色和權限設定
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">載入中...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {systemUsers.map((user: SystemUser) => (
                  <div key={user.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{user.username}</h4>
                        <p className="text-sm text-muted-foreground">
                          {user.fullName} &bull; {user.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.role}
                          onValueChange={(newRole) => {
                            updateUserRoleMutation.mutate({ userId: user.id, role: newRole });
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">一般用戶</SelectItem>
                            <SelectItem value="admin">管理員</SelectItem>
                          </SelectContent>
                        </Select>
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? '啟用' : '停用'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
