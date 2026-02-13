import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Star, Settings, Filter, Phone, Building2, Home } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import type { DebtCategory } from "@/../../shared/schema/category";

const categorySchema = z.object({
  categoryName: z.string().min(1, "分類名稱為必填"),
  categoryType: z.enum(["project", "household"]),
  description: z.string().optional(),
  isTemplate: z.boolean().default(false),
  accountInfo: z.string().optional(), // 帳號資訊（如電話號碼、電號等）
  templateNotes: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryWithId extends CategoryFormData {
  id: number;
}

export default function CategoryManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DebtCategory | null>(null);
  const [filterType, setFilterType] = useState<"all" | "project" | "household" | "template">("all");
  const [selectedTab, setSelectedTab] = useState<"list" | "templates">("list");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      categoryName: "",
      categoryType: "project" as const,
      description: "",
      isTemplate: false,
      accountInfo: "",
      templateNotes: "",
    },
  });

  // 獲取所有分類
  const { data: allCategories = [], isLoading } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories/all"],
    queryFn: async () => {
      const [projectCategories, householdCategories] = await Promise.all([
        apiRequest("/api/categories/project", "GET"),
        apiRequest("/api/categories/household", "GET")
      ]);
      return [...(projectCategories as DebtCategory[]), ...(householdCategories as DebtCategory[])];
    }
  });

  // 過濾分類
  const filteredCategories = allCategories.filter(category => {
    if (filterType === "all") return true;
    if (filterType === "template") return category.isTemplate;
    return category.categoryType === filterType;
  });

  // 分類統計
  const projectCategories = allCategories.filter(c => c.categoryType === "project");
  const householdCategories = allCategories.filter(c => c.categoryType === "household");
  const templateCategories = allCategories.filter(c => c.isTemplate);

  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const endpoint = `/api/categories/${data.categoryType}`;
      return apiRequest(endpoint, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories/all"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "分類創建成功",
        description: "新分類已成功添加到系統中",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "創建失敗",
        description: error.message || "無法創建分類，請稍後再試",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (data: CategoryWithId) => {
      const endpoint = `/api/categories/${data.categoryType}/${data.id}`;
      return apiRequest(endpoint, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories/all"] });
      setIsDialogOpen(false);
      setEditingCategory(null);
      form.reset();
      toast({
        title: "分類更新成功",
        description: "分類資訊已成功更新",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "更新失敗",
        description: error.message || "無法更新分類，請稍後再試",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (category: DebtCategory) => {
      const endpoint = `/api/categories/${category.categoryType}/${category.id}`;
      return apiRequest(endpoint, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories/all"] });
      toast({
        title: "分類已刪除",
        description: "分類已從系統中移除",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "刪除失敗",
        description: error.message || "無法刪除分類，請稍後再試",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CategoryFormData) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ ...data, id: editingCategory.id });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const handleEdit = (category: DebtCategory) => {
    setEditingCategory(category);
    form.reset({
      categoryName: category.categoryName,
      categoryType: category.categoryType as "project" | "household",
      description: category.description || "",
      isTemplate: category.isTemplate || false,
      accountInfo: category.accountInfo || "",
      templateNotes: category.templateNotes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (category: DebtCategory) => {
    if (confirm(`確定要刪除分類「${category.categoryName}」嗎？`)) {
      deleteCategoryMutation.mutate(category);
    }
  };

  const handleNewCategory = () => {
    setEditingCategory(null);
    form.reset({
      categoryName: "",
      categoryType: "project",
      description: "",
      isTemplate: false,
      accountInfo: "",
      templateNotes: "",
    });
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 頁面標題 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">分類管理</h1>
          <p className="text-muted-foreground">統一管理專案和家用分類，支援固定項目模板</p>
        </div>
        <Button onClick={handleNewCategory}>
          <Plus className="mr-2 h-4 w-4" />
          新增分類
        </Button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">專案分類</p>
                <p className="text-2xl font-bold">{projectCategories.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Home className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">家用分類</p>
                <p className="text-2xl font-bold">{householdCategories.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">固定項目模板</p>
                <p className="text-2xl font-bold">{templateCategories.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Settings className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">總分類數</p>
                <p className="text-2xl font-bold">{allCategories.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 分類管理界面 */}
      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as "list" | "templates")}>
        <TabsList>
          <TabsTrigger value="list">分類列表</TabsTrigger>
          <TabsTrigger value="templates">固定項目模板</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* 過濾器 */}
          <div className="flex items-center space-x-4">
            <Filter className="h-4 w-4" />
            <Select value={filterType} onValueChange={(value) => setFilterType(value as typeof filterType)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="選擇分類類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分類</SelectItem>
                <SelectItem value="project">專案分類</SelectItem>
                <SelectItem value="household">家用分類</SelectItem>
                <SelectItem value="template">固定項目</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 分類列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCategories.map((category) => (
              <Card key={category.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{category.categoryName}</CardTitle>
                    <div className="flex items-center space-x-2">
                      {category.isTemplate && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          <Star className="mr-1 h-3 w-3" />
                          固定項目
                        </Badge>
                      )}
                      <Badge variant={category.categoryType === "project" ? "default" : "secondary"}>
                        {category.categoryType === "project" ? "專案" : "家用"}
                      </Badge>
                    </div>
                  </div>
                  {category.description && (
                    <CardDescription>{category.description}</CardDescription>
                  )}
                </CardHeader>
                
                <CardContent className="pt-0">
                  {category.isTemplate && category.accountInfo && (
                    <div className="flex items-center text-sm text-muted-foreground mb-3">
                      <Phone className="mr-1 h-3 w-3" />
                      帳號資訊: {category.accountInfo}
                    </div>
                  )}
                  
                  {category.templateNotes && (
                    <p className="text-sm text-muted-foreground mb-3">{category.templateNotes}</p>
                  )}
                  
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(category)}
                    >
                      <Edit className="mr-1 h-3 w-3" />
                      編輯
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(category)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      刪除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">固定項目模板</h3>
            <p className="text-muted-foreground">這些項目可以在新增付款時快速帶入預設值，提高資料一致性</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templateCategories.map((category) => (
              <Card key={category.id} className="border-yellow-200 bg-yellow-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center">
                      <Star className="mr-2 h-4 w-4 text-yellow-600" />
                      {category.categoryName}
                    </CardTitle>
                    <Badge variant={category.categoryType === "project" ? "default" : "secondary"}>
                      {category.categoryType === "project" ? "專案" : "家用"}
                    </Badge>
                  </div>
                  {category.description && (
                    <CardDescription>{category.description}</CardDescription>
                  )}
                </CardHeader>
                
                <CardContent className="pt-0">
                  {category.accountInfo && (
                    <div className="flex items-center text-sm font-medium text-yellow-700 mb-2">
                      <Phone className="mr-1 h-3 w-3" />
                      帳號資訊: {category.accountInfo}
                    </div>
                  )}
                  
                  {category.templateNotes && (
                    <p className="text-sm text-yellow-600 mb-3">{category.templateNotes}</p>
                  )}
                  
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(category)}
                    >
                      <Edit className="mr-1 h-3 w-3" />
                      編輯
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* 新增/編輯分類對話框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "編輯分類" : "新增分類"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? "修改分類資訊和設定" : "創建新的分類，可設定為固定項目模板"}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="categoryName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>分類名稱 *</FormLabel>
                      <FormControl>
                        <Input placeholder="例：電話費、網路費" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="categoryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>分類類型 *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇分類類型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="project">專案分類</SelectItem>
                          <SelectItem value="household">家用分類</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="分類的詳細說明..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border rounded-lg p-4 space-y-4">
                <FormField
                  control={form.control}
                  name="isTemplate"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div>
                        <FormLabel className="text-base">設為固定項目模板</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          啟用後可在新增付款時快速帶入預設值
                        </div>
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

                {form.watch("isTemplate") && (
                  <>
                    <FormField
                      control={form.control}
                      name="accountInfo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>帳號資訊</FormLabel>
                          <FormControl>
                            <Input 
                              type="text"
                              placeholder="例：088219194、電號09894790"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="templateNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>模板說明</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="固定項目的使用說明..."
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                >
                  {editingCategory ? "更新" : "創建"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
