import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Settings as SettingsIcon, Building2, Tag, Plus, Edit, Trash2, 
  Check, X, Save, AlertCircle, CheckCircle2, User, BarChart3, FileText, Upload, Loader2, TestTube
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Category = {
  id: number;
  categoryName: string;
  parentId?: number;
  description?: string;
  isDeleted: boolean;
  usageCount?: number;
};

type Project = {
  id: number;
  projectName: string;
  projectType: string;
  description?: string;
  isActive: boolean;
  itemCount?: number;
};

type LineConfig = {
  id: number;
  channelId: string;
  channelSecret: string;
  callbackUrl: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type SystemUser = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState("categories");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/projects"],
  });

  const { data: lineConfig } = useQuery({
    queryKey: ["/api/line-config"],
  });

  // User management states
  const [isUserListDialogOpen, setIsUserListDialogOpen] = useState(false);
  const [isUserPermissionDialogOpen, setIsUserPermissionDialogOpen] = useState(false);

  // User management queries
  const { data: systemUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    enabled: isUserListDialogOpen || isUserPermissionDialogOpen,
  });

  // Forms
  const categoryForm = useForm({
    resolver: zodResolver(z.object({
      categoryName: z.string().min(1, "分類名稱不能為空"),
      description: z.string().optional(),
    })),
    defaultValues: {
      categoryName: editingCategory?.categoryName || "",
      description: editingCategory?.description || "",
    },
  });

  const projectForm = useForm({
    resolver: zodResolver(z.object({
      projectName: z.string().min(1, "專案名稱不能為空"),
      projectType: z.string().min(1, "請選擇專案類型"),
      description: z.string().optional(),
    })),
    defaultValues: {
      projectName: editingProject?.projectName || "",
      projectType: editingProject?.projectType || "",
      description: editingProject?.description || "",
    },
  });

  const lineConfigForm = useForm({
    resolver: zodResolver(z.object({
      channelId: z.string().min(1, "Channel ID不能為空"),
      channelSecret: z.string().min(1, "Channel Secret不能為空"),
      callbackUrl: z.string().url("請輸入有效的URL"),
      isEnabled: z.boolean(),
    })),
    defaultValues: {
      channelId: "",
      channelSecret: "",
      callbackUrl: "",
      isEnabled: false,
    },
  });

  // Update form when LINE config data is loaded
  useEffect(() => {
    if (lineConfig) {
      lineConfigForm.reset({
        channelId: lineConfig.channelId || "",
        channelSecret: lineConfig.channelSecret || "",
        callbackUrl: lineConfig.callbackUrl || "",
        isEnabled: lineConfig.isEnabled || false,
      });
    }
  }, [lineConfig, lineConfigForm]);

  // Mutations
  const saveLineConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Saving LINE config:", data);
      // 如果已有LINE配置，使用PUT更新；否則使用POST創建
      if (lineConfig && lineConfig.id) {
        const result = await apiRequest("PUT", `/api/line-config/${lineConfig.id}`, data);
        console.log("PUT response:", result);
        return result;
      } else {
        const result = await apiRequest("POST", "/api/line-config", data);
        console.log("POST response:", result);
        return result;
      }
    },
    onSuccess: (result) => {
      console.log("Save successful:", result);
      toast({
        title: "設定已儲存",
        description: "LINE配置已成功保存到資料庫",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/line-config"] });
    },
    onError: (error: Error) => {
      console.error("LINE config save error:", error);
      toast({
        title: "儲存失敗", 
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateCallbackUrlMutation = useMutation({
    mutationFn: async () => {
      // 直接使用fetch並加上cache-busting參數來避免304緩存問題
      const timestamp = Date.now();
      const response = await fetch(`/api/line-config/generate-callback?t=${timestamp}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      });
      
      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log("Response data:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("Success data:", data);
      if (data && data.callbackUrl) {
        lineConfigForm.setValue("callbackUrl", data.callbackUrl);
        toast({
          title: "已生成Callback URL",
          description: `已自動填入: ${data.callbackUrl}`,
        });
      } else {
        console.error("Invalid response data:", data);
        throw new Error("未收到有效的Callback URL");
      }
    },
    onError: (error: Error) => {
      console.error("Generate callback URL error:", error);
      toast({
        title: "生成失敗",
        description: error.message || "無法生成Callback URL",
        variant: "destructive",
      });
    },
  });

  const testLineConnectionMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Testing LINE connection with data:", data);
      const result = await apiRequest("POST", "/api/line-config/test", data);
      console.log("Test result:", result);
      return result;
    },
    onSuccess: (result: any) => {
      console.log("Connection test successful:", result);
      toast({
        title: result.success ? "連線成功" : "連線失敗",
        description: result.message || (result.success ? "LINE API連線正常" : "LINE API連線失敗"),
        variant: result.success ? "default" : "destructive"
      });
    },
    onError: (error: Error) => {
      console.error("LINE connection test error:", error);
      toast({
        title: "測試失敗",
        description: "無法連接到LINE API服務，請檢查網路連線或稍後再試",
        variant: "destructive",
      });
    },
  });

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    categoryForm.reset({
      categoryName: category.categoryName,
      description: category.description || "",
    });
    setIsCategoryDialogOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    projectForm.reset({
      projectName: project.projectName,
      projectType: project.projectType,
      description: project.description || "",
    });
    setIsProjectDialogOpen(true);
  };

  // User management handlers
  const handleViewAllUsers = () => {
    setIsUserListDialogOpen(true);
  };

  const handleManagePermissions = () => {
    setIsUserPermissionDialogOpen(true);
  };

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsCategoryDialogOpen(false);
      categoryForm.reset();
      setEditingCategory(null);
      toast({
        title: "分類建立成功",
        description: "新分類已成功建立",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "建立失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", `/api/categories/${editingCategory?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsCategoryDialogOpen(false);
      categoryForm.reset();
      setEditingCategory(null);
      toast({
        title: "分類更新成功",
        description: "分類已成功更新",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "更新失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "分類刪除成功",
        description: "分類已成功刪除",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "刪除失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Project mutations
  const createProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/projects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsProjectDialogOpen(false);
      projectForm.reset();
      setEditingProject(null);
      toast({
        title: "專案建立成功",
        description: "新專案已成功建立",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "建立失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", `/api/projects/${editingProject?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsProjectDialogOpen(false);
      projectForm.reset();
      setEditingProject(null);
      toast({
        title: "專案更新成功",
        description: "專案已成功更新",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "更新失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "專案刪除成功",
        description: "專案已成功刪除",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "刪除失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // User role update mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      return await apiRequest("PUT", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "權限更新成功",
        description: "用戶權限已成功更新",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "權限更新失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getProjectTypeText = (type: string) => {
    switch (type) {
      case "general": return "一般專案";
      case "business": return "商業專案";
      case "personal": return "個人專案";
      case "investment": return "投資專案";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-8 h-8" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">系統設定</h1>
          <p className="text-muted-foreground">
            管理分類、專案和系統配置
          </p>
        </div>
      </div>

      {/* 主要內容 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="categories">分類管理</TabsTrigger>
          <TabsTrigger value="projects">專案管理</TabsTrigger>
          <TabsTrigger value="line-config">LINE設定</TabsTrigger>
          <TabsTrigger value="admin">系統管理</TabsTrigger>
        </TabsList>

        {/* 分類管理標籤 */}
        <TabsContent value="categories" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    分類管理
                  </CardTitle>
                  <CardDescription>
                    管理付款項目的分類和子分類
                  </CardDescription>
                </div>
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingCategory(null);
                      categoryForm.reset({
                        categoryName: "",
                        description: "",
                      });
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      新增分類
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoriesLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  categories.map((category: Category) => (
                    <div key={category.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{category.categoryName}</h3>
                        {category.description && (
                          <p className="text-sm text-muted-foreground">{category.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary">
                            使用次數: {category.usageCount || 0}
                          </Badge>
                          {category.isDeleted && (
                            <Badge variant="destructive">已刪除</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCategory(category)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>確認刪除</AlertDialogTitle>
                              <AlertDialogDescription>
                                確定要刪除分類「{category.categoryName}」嗎？此操作無法復原。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteCategoryMutation.mutate(category.id)}>
                                刪除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 專案管理標籤 */}
        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    專案管理
                  </CardTitle>
                  <CardDescription>
                    管理付款項目所屬的專案
                  </CardDescription>
                </div>
                <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingProject(null);
                      projectForm.reset({
                        projectName: "",
                        projectType: "",
                        description: "",
                      });
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      新增專案
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projectsLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  projects.map((project: Project) => (
                    <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{project.projectName}</h3>
                        {project.description && (
                          <p className="text-sm text-muted-foreground">{project.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">
                            {getProjectTypeText(project.projectType)}
                          </Badge>
                          <Badge variant="secondary">
                            項目數: {project.itemCount || 0}
                          </Badge>
                          {project.isActive ? (
                            <Badge variant="default" className="bg-green-600">
                              啟用
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              停用
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProject(project)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>確認刪除</AlertDialogTitle>
                              <AlertDialogDescription>
                                確定要刪除專案「{project.projectName}」嗎？此操作無法復原。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProjectMutation.mutate(project.id)}>
                                刪除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LINE配置標籤 */}
        <TabsContent value="line-config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                LINE登入設定
              </CardTitle>
              <CardDescription>
                配置LINE登入功能的相關參數
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...lineConfigForm}>
                <form onSubmit={lineConfigForm.handleSubmit((data) => saveLineConfigMutation.mutate(data))} className="space-y-6">
                  
                  {/* 基本設定 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={lineConfigForm.control}
                      name="channelId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Channel ID</FormLabel>
                          <FormControl>
                            <Input placeholder="輸入LINE Channel ID" {...field} />
                          </FormControl>
                          <FormDescription>
                            從LINE Developers Console取得的Channel ID
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={lineConfigForm.control}
                      name="channelSecret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Channel Secret</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="輸入Channel Secret" {...field} />
                          </FormControl>
                          <FormDescription>
                            從LINE Developers Console取得的Channel Secret
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={lineConfigForm.control}
                    name="callbackUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Callback URL</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input placeholder="https://yourdomain.com/api/line/callback" {...field} />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => generateCallbackUrlMutation.mutate()}
                            disabled={generateCallbackUrlMutation.isPending}
                          >
                            {generateCallbackUrlMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "自動生成"
                            )}
                          </Button>
                        </div>
                        <FormDescription>
                          LINE登入完成後的回調URL，必須與LINE Developers Console中設定的一致。點擊「自動生成」可根據當前域名自動產生URL。
                        </FormDescription>
                        {field.value && (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(field.value);
                                toast({
                                  title: "已複製",
                                  description: "Callback URL已複製到剪貼板",
                                });
                              }}
                            >
                              複製URL
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={lineConfigForm.control}
                    name="isEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            啟用LINE登入
                          </FormLabel>
                          <FormDescription>
                            開啟後用戶可以使用LINE帳號登入系統
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Critical Setup Alert */}
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                    <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2 flex items-center">
                      <span className="mr-2">🚨</span>
                      重要：請更新LINE Developer Console設定
                    </h4>
                    <div className="text-sm text-red-800 dark:text-red-200 space-y-2">
                      <p>如果看到「access.line.me 拒絕連線」錯誤，請確認在LINE Console中使用以下最新的Callback URL：</p>
                      <div className="mt-2 p-3 bg-red-100 dark:bg-red-900 rounded border font-mono text-xs break-all">
                        {lineConfigForm.watch('callbackUrl') || '請先生成 Callback URL'}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = lineConfigForm.watch('callbackUrl');
                            if (url) {
                              navigator.clipboard.writeText(url);
                              toast({
                                title: "已複製",
                                description: "請將此URL貼到LINE Console的Callback URL設定中",
                              });
                            }
                          }}
                        >
                          複製最新URL
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open('https://developers.line.biz/console/', '_blank')}
                        >
                          開啟LINE Console
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <FileText className="w-4 h-4 mr-2" />
                        匯出設定檔
                      </Button>
                      <Button variant="outline" size="sm">
                        <Upload className="w-4 h-4 mr-2" />
                        匯入設定檔
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        type="button"
                        onClick={() => {
                          const formData = lineConfigForm.getValues();
                          testLineConnectionMutation.mutate(formData);
                        }}
                        disabled={testLineConnectionMutation.isPending}
                      >
                        {testLineConnectionMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4 mr-2" />
                        )}
                        測試連線
                      </Button>
                      <Button type="submit" disabled={saveLineConfigMutation.isPending}>
                        {saveLineConfigMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        儲存設定
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>

              {/* 設定說明 */}
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-800 dark:text-blue-200">
                    設定說明
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="font-medium">1. 建立LINE Login頻道：</p>
                    <p className="ml-4">前往LINE Developers Console建立新的LINE Login頻道</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium">2. 取得憑證：</p>
                    <p className="ml-4">在Console中建立新的LINE Login頻道，取得Channel ID和Channel Secret</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium">3. 設定Callback URL：</p>
                    <p className="ml-4">在LINE Login設定中添加您的Callback URL</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium">4. 測試設定：</p>
                    <p className="ml-4">儲存設定後可以測試LINE登入功能是否正常運作</p>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 系統管理標籤 */}
        <TabsContent value="admin" className="space-y-6">
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
              
              {/* 用戶管理 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        onClick={handleViewAllUsers}
                      >
                        <User className="w-4 h-4 mr-2" />
                        查看所有用戶
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="justify-start"
                        onClick={handleManagePermissions}
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
        </TabsContent>
      </Tabs>

      {/* User List Dialog */}
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

      {/* User Permission Management Dialog */}
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
                          {user.fullName} • {user.email}
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

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "編輯分類" : "新增分類"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? "修改分類資訊" : "建立新的付款分類"}
            </DialogDescription>
          </DialogHeader>
          <Form {...categoryForm}>
            <form onSubmit={categoryForm.handleSubmit((data) => {
              if (editingCategory) {
                updateCategoryMutation.mutate(data);
              } else {
                createCategoryMutation.mutate(data);
              }
            })} className="space-y-4">
              <FormField
                control={categoryForm.control}
                name="categoryName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分類名稱</FormLabel>
                    <FormControl>
                      <Input placeholder="輸入分類名稱" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={categoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述（選填）</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="輸入分類描述"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}>
                  {(createCategoryMutation.isPending || updateCategoryMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingCategory ? "更新" : "建立"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Project Dialog */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "編輯專案" : "新增專案"}
            </DialogTitle>
            <DialogDescription>
              {editingProject ? "修改專案資訊" : "建立新的付款專案"}
            </DialogDescription>
          </DialogHeader>
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit((data) => {
              if (editingProject) {
                updateProjectMutation.mutate(data);
              } else {
                createProjectMutation.mutate(data);
              }
            })} className="space-y-4">
              <FormField
                control={projectForm.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>專案名稱</FormLabel>
                    <FormControl>
                      <Input placeholder="輸入專案名稱" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={projectForm.control}
                name="projectType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>專案類型</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇專案類型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="general">一般專案</SelectItem>
                        <SelectItem value="business">商業專案</SelectItem>
                        <SelectItem value="personal">個人專案</SelectItem>
                        <SelectItem value="investment">投資專案</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={projectForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述（選填）</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="輸入專案描述"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsProjectDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={createProjectMutation.isPending || updateProjectMutation.isPending}>
                  {(createProjectMutation.isPending || updateProjectMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingProject ? "更新" : "建立"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}