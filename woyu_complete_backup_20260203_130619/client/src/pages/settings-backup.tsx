import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Settings as SettingsIcon, Building2, Tag, Plus, Edit, Trash2, 
  Check, X, Save, AlertCircle, CheckCircle2, User, BarChart3, FileText, Upload, Loader2
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


// Schema 定義
const categorySchema = z.object({
  categoryName: z.string().min(1, "分類名稱為必填"),
  parentId: z.number().optional(),
  description: z.string().optional(),
});

const projectSchema = z.object({
  projectName: z.string().min(1, "專案名稱為必填"),
  projectType: z.string().min(1, "專案類型為必填"),
  description: z.string().optional(),
});

const lineConfigSchema = z.object({
  channelId: z.string().min(1, "Channel ID為必填"),
  channelSecret: z.string().min(1, "Channel Secret為必填"),
  callbackUrl: z.string().url("請輸入有效的URL").min(1, "Callback URL為必填"),
  isEnabled: z.boolean().default(true),
});

// 類型定義
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

export default function Settings() {
  const [activeTab, setActiveTab] = useState("categories");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isLineConfigDialogOpen, setIsLineConfigDialogOpen] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 表單設定
  const categoryForm = useForm<{
    categoryName: string;
    parentId?: number;
    description?: string;
  }>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      categoryName: "",
      description: "",
    },
  });

  const projectForm = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectName: "",
      projectType: "general" as const,
      description: "",
    },
  });

  // 資料查詢
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories/project"],
    queryFn: () => apiRequest("GET", "/api/categories/project"),
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/payment/projects"],
    queryFn: () => apiRequest("GET", "/api/payment/projects"),
  });

  const { data: lineConfig } = useQuery<LineConfig | null>({
    queryKey: ["/api/line-config"],
    queryFn: () => apiRequest("GET", "/api/line-config"),
  });

  // LINE Configuration Form
  const lineConfigForm = useForm<{
    channelId: string;
    channelSecret: string;
    callbackUrl: string;
    isEnabled: boolean;
  }>({
    resolver: zodResolver(lineConfigSchema),
    defaultValues: {
      channelId: "",
      channelSecret: "",
      callbackUrl: "",
      isEnabled: true,
    },
  });

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories/project"] });
      setIsCategoryDialogOpen(false);
      categoryForm.reset();
      toast({ title: "成功", description: "分類已建立" });
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "建立分類失敗", variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PUT", `/api/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories/project"] });
      setEditingCategory(null);
      toast({ title: "成功", description: "分類已更新" });
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "更新分類失敗", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories/project"] });
      toast({ title: "成功", description: "分類已刪除" });
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "刪除分類失敗", variant: "destructive" });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payment/projects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/projects"] });
      setIsProjectDialogOpen(false);
      projectForm.reset();
      toast({ title: "成功", description: "專案已建立" });
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "建立專案失敗", variant: "destructive" });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PUT", `/api/payment/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/projects"] });
      setEditingProject(null);
      toast({ title: "成功", description: "專案已更新" });
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "更新專案失敗", variant: "destructive" });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/payment/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/projects"] });
      toast({ title: "成功", description: "專案已刪除" });
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "刪除專案失敗", variant: "destructive" });
    },
  });

  // LINE Configuration Mutations
  const saveLineConfigMutation = useMutation({
    mutationFn: (data: any) => {
      if (lineConfig?.id) {
        return apiRequest("PUT", `/api/line-config/${lineConfig.id}`, data);
      } else {
        return apiRequest("POST", "/api/line-config", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/line-config"] });
      setIsLineConfigDialogOpen(false);
      toast({ title: "成功", description: "LINE配置已保存" });
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "保存LINE配置失敗", variant: "destructive" });
    },
  });

  const testLineConnectionMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/line-config/test", data),
    onSuccess: (result: any) => {
      toast({ 
        title: result.success ? "連線成功" : "連線失敗", 
        description: result.message,
        variant: result.success ? "default" : "destructive"
      });
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "測試連線失敗", variant: "destructive" });
    },
    onSettled: () => {
      setIsTestingConnection(false);
    },
  });

  // 分類相關函數
  const handleCreateCategory = (data: any) => {
    createCategoryMutation.mutate(data);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    categoryForm.reset({
      categoryName: category.categoryName,
      parentId: category.parentId || undefined,
      description: category.description || "",
    });
    setIsCategoryDialogOpen(true);
  };

  const handleUpdateCategory = (data: any) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data });
    }
  };

  const handleDeleteCategory = (id: number) => {
    deleteCategoryMutation.mutate(id);
  };

  // 專案相關函數
  const handleCreateProject = (data: any) => {
    createProjectMutation.mutate(data);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    projectForm.reset({
      projectName: project.projectName,
      projectType: project.projectType as any,
      description: project.description || "",
    });
    setIsProjectDialogOpen(true);
  };

  const handleUpdateProject = (data: any) => {
    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, data });
    }
  };

  const handleDeleteProject = (id: number) => {
    deleteProjectMutation.mutate(id);
  };

  // LINE Configuration Functions
  const handleSaveLineConfig = (data: any) => {
    saveLineConfigMutation.mutate(data);
  };

  const handleTestLineConnection = (data: any) => {
    setIsTestingConnection(true);
    testLineConnectionMutation.mutate(data);
  };

  const handleEditLineConfig = () => {
    if (lineConfig) {
      lineConfigForm.reset({
        channelId: lineConfig.channelId,
        channelSecret: lineConfig.channelSecret,
        callbackUrl: lineConfig.callbackUrl,
        isEnabled: lineConfig.isEnabled,
      });
    } else {
      lineConfigForm.reset({
        channelId: "",
        channelSecret: "",
        callbackUrl: `${window.location.origin}/api/line/callback`,
        isEnabled: true,
      });
    }
    setIsLineConfigDialogOpen(true);
  };

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
                      付款分類管理
                    </CardTitle>
                    <CardDescription>
                      建立和管理付款項目的分類標籤
                    </CardDescription>
                  </div>
                  <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingCategory(null);
                        categoryForm.reset();
                      }}>
                        <Plus className="w-4 h-4 mr-2" />
                        新增分類
                      </Button>
                    </DialogTrigger>
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
                        <form onSubmit={categoryForm.handleSubmit(editingCategory ? handleUpdateCategory : handleCreateCategory)} className="space-y-4">
                          <FormField
                            control={categoryForm.control}
                            name="categoryName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>分類名稱 *</FormLabel>
                                <FormControl>
                                  <Input placeholder="輸入分類名稱" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={categoryForm.control}
                            name="parentId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>上層分類（選填）</FormLabel>
                                <Select 
                                  value={field.value ? String(field.value) : "null"} 
                                  onValueChange={(value) => field.onChange(value === "null" ? undefined : parseInt(value))}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="選擇上層分類" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="null">無上層分類</SelectItem>
                                    {categories.filter(cat => cat.id !== editingCategory?.id && !cat.parentId).map((category) => (
                                      <SelectItem key={category.id} value={category.id.toString()}>
                                        {category.categoryName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={categoryForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>分類描述</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="分類用途說明（選填）" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <DialogFooter>
                            <Button type="submit" disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}>
                              {(createCategoryMutation.isPending || updateCategoryMutation.isPending) ? "處理中..." : 
                               editingCategory ? "更新分類" : "建立分類"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categories.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>暫無分類，請建立第一個分類</p>
                    </div>
                  ) : (
                    <>
                      {/* 主分類 - 沒有父分類的分類 */}
                      {categories.filter(cat => !cat.parentId).map((parentCategory) => (
                        <div key={parentCategory.id} className="space-y-2">
                          {/* 父分類顯示 */}
                          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 bg-blue-50 dark:bg-blue-950">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-semibold text-blue-800 dark:text-blue-200">{parentCategory.categoryName}</span>
                                <Badge variant="default" className="bg-blue-600">
                                  主分類
                                </Badge>
                                {parentCategory.usageCount !== undefined && (
                                  <Badge variant="secondary">
                                    {parentCategory.usageCount} 項目使用中
                                  </Badge>
                                )}
                              </div>
                              {parentCategory.description && (
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                  {parentCategory.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditCategory(parentCategory)}
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
                                    <AlertDialogTitle>確認刪除分類</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      確定要刪除「{parentCategory.categoryName}」分類嗎？此操作無法復原。
                                      {parentCategory.usageCount && parentCategory.usageCount > 0 && (
                                        <span className="text-red-600 block mt-2">
                                          注意：此分類目前有 {parentCategory.usageCount} 個項目正在使用
                                        </span>
                                      )}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteCategory(parentCategory.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      確認刪除
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          
                          {/* 子分類顯示 */}
                          {categories.filter(cat => cat.parentId === parentCategory.id).map((childCategory) => (
                            <div key={childCategory.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 ml-8 bg-gray-50 dark:bg-gray-900">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="text-gray-600 dark:text-gray-400">└─</span>
                                  <span className="font-medium">{childCategory.categoryName}</span>
                                  <Badge variant="outline">
                                    子分類
                                  </Badge>
                                  {childCategory.usageCount !== undefined && (
                                    <Badge variant="secondary">
                                      {childCategory.usageCount} 項目使用中
                                    </Badge>
                                  )}
                                </div>
                                {childCategory.description && (
                                  <p className="text-sm text-muted-foreground ml-6">
                                    {childCategory.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditCategory(childCategory)}
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
                                      <AlertDialogTitle>確認刪除分類</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        確定要刪除「{childCategory.categoryName}」分類嗎？此操作無法復原。
                                        {childCategory.usageCount && childCategory.usageCount > 0 && (
                                          <span className="text-red-600 block mt-2">
                                            注意：此分類目前有 {childCategory.usageCount} 個項目正在使用
                                          </span>
                                        )}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>取消</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteCategory(childCategory.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        確認刪除
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
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
                      付款專案管理
                    </CardTitle>
                    <CardDescription>
                      建立和管理付款項目的專案分組
                    </CardDescription>
                  </div>
                  <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingProject(null);
                        projectForm.reset();
                      }}>
                        <Plus className="w-4 h-4 mr-2" />
                        新增專案
                      </Button>
                    </DialogTrigger>
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
                        <form onSubmit={projectForm.handleSubmit(editingProject ? handleUpdateProject : handleCreateProject)} className="space-y-4">
                          <FormField
                            control={projectForm.control}
                            name="projectName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>專案名稱 *</FormLabel>
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
                                <FormLabel>專案類型 *</FormLabel>
                                <FormControl>
                                  <Input placeholder="例如：general、business、personal、investment" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={projectForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>專案描述</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="專案用途說明（選填）" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <DialogFooter>
                            <Button type="submit" disabled={createProjectMutation.isPending || updateProjectMutation.isPending}>
                              {(createProjectMutation.isPending || updateProjectMutation.isPending) ? "處理中..." : 
                               editingProject ? "更新專案" : "建立專案"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projects.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>暫無專案，請建立第一個專案</p>
                    </div>
                  ) : (
                    projects.map((project) => (
                      <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-medium">{project.projectName}</span>
                            <Badge variant={project.isActive ? "default" : "secondary"}>
                              {project.isActive ? "啟用中" : "已停用"}
                            </Badge>
                            <Badge variant="outline">
                              {getProjectTypeText(project.projectType)}
                            </Badge>
                            {project.itemCount !== undefined && (
                              <Badge variant="secondary">
                                {project.itemCount} 個項目
                              </Badge>
                            )}
                          </div>
                          {project.description && (
                            <p className="text-sm text-muted-foreground">
                              {project.description}
                            </p>
                          )}
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
                                <AlertDialogTitle>確認刪除專案</AlertDialogTitle>
                                <AlertDialogDescription>
                                  確定要刪除「{project.projectName}」專案嗎？此操作無法復原。
                                  {project.itemCount && project.itemCount > 0 && (
                                    <span className="text-red-600 block mt-2">
                                      注意：此專案目前有 {project.itemCount} 個付款項目
                                    </span>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteProject(project.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  確認刪除
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

          {/* LINE設定標籤 */}
          <TabsContent value="line-config" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5" />
                  LINE登入設定
                </CardTitle>
                <CardDescription>
                  配置LINE登入服務的必要參數，包括Channel ID、Channel Secret和Callback URL
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Configuration Display */}
                {lineConfig && (
                  <div className="p-4 border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-green-800 dark:text-green-200">目前配置</h4>
                      <Badge variant={lineConfig.isEnabled ? "default" : "secondary"}>
                        {lineConfig.isEnabled ? "已啟用" : "已停用"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-green-700 dark:text-green-300">Channel ID:</p>
                        <p className="font-mono text-green-800 dark:text-green-200">
                          {lineConfig.channelId ? `${lineConfig.channelId.substring(0, 8)}...` : "未設定"}
                        </p>
                      </div>
                      <div>
                        <p className="text-green-700 dark:text-green-300">Callback URL:</p>
                        <p className="font-mono text-green-800 dark:text-green-200 break-all">
                          {lineConfig.callbackUrl || "未設定"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <h4 className="font-medium">LINE登入配置</h4>
                  <Dialog open={isLineConfigDialogOpen} onOpenChange={setIsLineConfigDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={handleEditLineConfig}>
                        <SettingsIcon className="w-4 h-4 mr-2" />
                        {lineConfig ? "編輯配置" : "新增配置"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>LINE登入配置</DialogTitle>
                        <DialogDescription>
                          設定LINE登入服務的必要參數
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...lineConfigForm}>
                        <form onSubmit={lineConfigForm.handleSubmit(handleSaveLineConfig)} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={lineConfigForm.control}
                              name="channelId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Channel ID</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field}
                                      placeholder="輸入LINE Channel ID" 
                                      className="font-mono"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    從LINE Developers Console取得
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
                                    <Input 
                                      {...field}
                                      type="password"
                                      placeholder="輸入LINE Channel Secret" 
                                      className="font-mono"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    保密資訊，請妥善保管
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
                                <FormControl>
                                  <Input 
                                    {...field}
                                    placeholder="https://your-domain.com/api/line/callback" 
                                    className="font-mono"
                                  />
                                </FormControl>
                                <FormDescription>
                                  LINE登入成功後的回調地址，需要在LINE Developers Console中設定
                                </FormDescription>
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
                                    啟用LINE登入功能
                                  </FormLabel>
                                  <FormDescription>
                                    允許用戶使用LINE帳號登入系統
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

                          <DialogFooter className="gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const formData = lineConfigForm.getValues();
                                handleTestLineConnection(formData);
                              }}
                              disabled={isTestingConnection || testLineConnectionMutation.isPending}
                            >
                              {isTestingConnection ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  測試中...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  測試連線
                                </>
                              )}
                            </Button>
                            <Button 
                              type="submit" 
                              disabled={saveLineConfigMutation.isPending}
                            >
                              {saveLineConfigMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  保存中...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  保存配置
                                </>
                              )}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>

                  {/* 設定說明 */}
                  <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-blue-900 dark:text-blue-100">
                        設定說明
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                      <div className="space-y-2">
                        <p className="font-medium">1. 取得LINE開發者帳號：</p>
                        <p className="ml-4">前往 LINE Developers Console (developers.line.biz) 註冊開發者帳號</p>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium">2. 建立LINE Login頻道：</p>
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
                        <Button variant="outline" size="sm" className="justify-start">
                          <User className="w-4 h-4 mr-2" />
                          查看所有用戶
                        </Button>
                        <Button variant="outline" size="sm" className="justify-start">
                          <Plus className="w-4 h-4 mr-2" />
                          新增用戶
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
                        監控系統性能、資料庫狀態和使用情況
                      </p>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" className="justify-start">
                          <BarChart3 className="w-4 h-4 mr-2" />
                          系統狀態
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

                {/* 系統設定 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SettingsIcon className="w-5 h-5" />
                      系統設定
                    </CardTitle>
                    <CardDescription>
                      配置系統參數和環境設定
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-medium">身份驗證設定</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">LINE 登入</p>
                              <p className="text-sm text-muted-foreground">允許用戶使用 LINE 帳號登入</p>
                            </div>
                            <Badge variant="default" className="bg-green-600">
                              已啟用
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">本地登入</p>
                              <p className="text-sm text-muted-foreground">傳統帳號密碼登入方式</p>
                            </div>
                            <Badge variant="default" className="bg-green-600">
                              已啟用
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="font-medium">安全設定</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">會話逾時</p>
                              <p className="text-sm text-muted-foreground">30 天後自動登出</p>
                            </div>
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">密碼政策</p>
                              <p className="text-sm text-muted-foreground">最少 8 位元，包含英數字</p>
                            </div>
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 維護工具 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      維護工具
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
                        <Button variant="outline" size="sm" className="justify-start">
                          <User className="w-4 h-4 mr-2" />
                          查看所有用戶
                        </Button>
                        <Button variant="outline" size="sm" className="justify-start">
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
      </div>
    </div>
  );
}