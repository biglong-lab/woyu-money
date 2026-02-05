import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Settings, Building2, Zap, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Category = {
  id: number;
  categoryName: string;
  categoryType: string;
  description?: string;
  accountInfo?: string;
};

type Project = {
  id: number;
  projectName: string;
  projectType: string;
};

type FixedSubOption = {
  id: number;
  fixedCategoryId: number;
  projectId: number;
  optionName: string;
  accountInfo?: string;
  notes?: string;
  projectName?: string;
  fixedCategoryName?: string;
};

export default function SimpleCategoryManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateProjectCategoryOpen, setIsCreateProjectCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedCategoryType, setSelectedCategoryType] = useState<string>("fixed");

  // Queries
  const { data: fixedCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/fixed-categories"],
  });

  const { data: projectCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories/project"],
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/payment/projects"],
  });

  const { data: fixedSubOptions = [] } = useQuery<any[]>({
    queryKey: ["/api/fixed-category-sub-options"],
  });

  // Forms
  const createForm = useForm({
    defaultValues: {
      categoryName: "",
      description: "",
      accountInfo: ""
    }
  });

  const createProjectCategoryForm = useForm({
    defaultValues: {
      categoryName: "",
      description: ""
    }
  });

  const editForm = useForm({
    defaultValues: {
      categoryName: "",
      description: "",
      accountInfo: ""
    }
  });

  // Mutations
  const createFixedCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/fixed-categories", {
        categoryName: data.categoryName,
        categoryType: "fixed",
        description: data.description,
        accountInfo: data.accountInfo
      });
    },
    onSuccess: () => {
      toast({ title: "固定分類建立成功" });
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-categories"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "建立失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createProjectCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/categories", {
        categoryName: data.categoryName,
        categoryType: "project",
        description: data.description
      });
    },
    onSuccess: () => {
      toast({ title: "專案分類建立成功" });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/project"] });
      setIsCreateProjectCategoryOpen(false);
      createProjectCategoryForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "建立失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCategory?.categoryType === "fixed") {
        return await apiRequest("PATCH", `/api/fixed-categories/${editingCategory?.id}`, data);
      } else {
        return await apiRequest("PATCH", `/api/categories/${editingCategory?.id}`, data);
      }
    },
    onSuccess: () => {
      toast({ title: "分類更新成功" });
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/project"] });
      setIsEditDialogOpen(false);
      setEditingCategory(null);
      editForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "更新失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: string }) => {
      if (type === "fixed") {
        return await apiRequest("DELETE", `/api/fixed-categories/${id}`);
      } else {
        return await apiRequest("DELETE", `/api/categories/${id}`);
      }
    },
    onSuccess: () => {
      toast({ title: "分類刪除成功" });
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/project"] });
    },
    onError: (error: any) => {
      toast({
        title: "刪除失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateFixedCategory = (data: any) => {
    createFixedCategoryMutation.mutate(data);
  };

  const handleCreateProjectCategory = (data: any) => {
    createProjectCategoryMutation.mutate(data);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    editForm.reset({
      categoryName: category.categoryName,
      description: category.description || "",
      accountInfo: category.accountInfo || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = (data: any) => {
    updateMutation.mutate(data);
  };

  const handleDelete = (category: Category) => {
    if (confirm(`確定要刪除分類「${category.categoryName}」嗎？`)) {
      deleteMutation.mutate({ id: category.id, type: category.categoryType });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">分類管理</h1>
          <p className="text-gray-600 mt-2">管理付款項目的分類系統</p>
        </div>
      </div>

      <Tabs defaultValue="fixed" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="fixed" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            固定分類
          </TabsTrigger>
          <TabsTrigger value="project-specific" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            專案專屬項目
          </TabsTrigger>
          <TabsTrigger value="project" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            專案分類
          </TabsTrigger>
        </TabsList>

        {/* 固定分類 */}
        <TabsContent value="fixed" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">固定分類</h2>
              <p className="text-gray-600">基礎分類，如電話費、水電費等</p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  新增固定分類
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>新增固定分類</DialogTitle>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(handleCreateFixedCategory)} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="categoryName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>分類名稱</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="例如：電話費、水電費" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="accountInfo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>預設帳號資訊（選填）</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="例如：中華電信" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>備註（選填）</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="輸入備註..." rows={2} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                        取消
                      </Button>
                      <Button type="submit" disabled={createFixedCategoryMutation.isPending}>
                        {createFixedCategoryMutation.isPending ? "建立中..." : "建立分類"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="grid gap-3">
                {fixedCategories.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">尚無固定分類</p>
                ) : (
                  fixedCategories.map((category: Category) => (
                    <div key={category.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium text-lg">{category.categoryName}</div>
                        {category.accountInfo && (
                          <div className="text-sm text-gray-600 mt-1">{category.accountInfo}</div>
                        )}
                        {category.description && (
                          <div className="text-sm text-gray-500 mt-1">{category.description}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(category)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(category)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 專案專屬項目 */}
        <TabsContent value="project-specific" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">專案專屬項目</h2>
            <p className="text-gray-600">固定分類 + 專案 = 專案專屬的具體項目（如：浯島文旅的電話費 088-219194）</p>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="grid gap-4">
                {fixedSubOptions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">尚無專案專屬項目</p>
                    <p className="text-sm text-gray-400">
                      專案專屬項目會在您建立付款項目時自動生成<br/>
                      例如：選擇「浯島文旅」專案 + 「電話費」分類時，輸入具體的電話號碼
                    </p>
                  </div>
                ) : (
                  fixedSubOptions.map((option: FixedSubOption) => (
                    <div key={option.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="secondary">{option.fixedCategoryName}</Badge>
                          <span className="text-gray-400">+</span>
                          <Badge variant="outline">{option.projectName}</Badge>
                          <span className="text-gray-400">=</span>
                        </div>
                        <div className="font-medium text-lg">{option.optionName}</div>
                        {option.accountInfo && (
                          <div className="text-sm text-gray-600 mt-1">{option.accountInfo}</div>
                        )}
                        {option.notes && (
                          <div className="text-sm text-gray-500 mt-1">{option.notes}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 專案分類 */}
        <TabsContent value="project" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">專案分類</h2>
              <p className="text-gray-600">針對特定專案的自訂分類</p>
            </div>
            <Button onClick={() => setIsCreateProjectCategoryOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              新增專案分類
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="grid gap-3">
                {projectCategories.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">尚無專案分類</p>
                ) : (
                  projectCategories.map((category: Category) => (
                    <div key={category.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium text-lg">{category.categoryName}</div>
                        {category.description && (
                          <div className="text-sm text-gray-600 mt-1">{category.description}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(category)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(category)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>編輯分類</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="categoryName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分類名稱</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例如：電話費、房租" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="accountInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>帳號資訊（選填）</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例如：中華電信 0912-345-678" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註（選填）</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="輸入備註..." rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "更新中..." : "更新分類"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 專案分類創建對話框 */}
      <Dialog open={isCreateProjectCategoryOpen} onOpenChange={setIsCreateProjectCategoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增專案分類</DialogTitle>
          </DialogHeader>
          <Form {...createProjectCategoryForm}>
            <form onSubmit={createProjectCategoryForm.handleSubmit((data) => createProjectCategoryMutation.mutate(data))} className="space-y-4">
              <FormField
                control={createProjectCategoryForm.control}
                name="categoryName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分類名稱</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例如：行銷推廣" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createProjectCategoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註（選填）</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="輸入備註..." rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateProjectCategoryOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={createProjectCategoryMutation.isPending}>
                  {createProjectCategoryMutation.isPending ? "建立中..." : "建立分類"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}