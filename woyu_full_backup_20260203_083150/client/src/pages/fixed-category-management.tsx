import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FixedCategory {
  id: number;
  categoryName: string;
  categoryType: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface FixedCategorySubOption {
  id: number;
  fixedCategoryId: number;
  projectId: number;
  subOptionName: string;
  displayName: string | null;
  isActive: boolean;
  categoryName: string;
  categoryType: string;
}

interface PaymentProject {
  id: number;
  projectName: string;
  projectType: string;
}

export default function FixedCategoryManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSubOption, setEditingSubOption] = useState<FixedCategorySubOption | null>(null);

  const createForm = useForm({
    defaultValues: {
      fixedCategoryId: selectedCategory?.toString() || "",
      subOptionName: "",
      displayName: "",
    },
  });

  const editForm = useForm({
    defaultValues: {
      subOptionName: "",
      displayName: "",
    },
  });

  // 獲取所有固定分類
  const { data: fixedCategories = [], isLoading: categoriesLoading } = useQuery<FixedCategory[]>({
    queryKey: ["/api/fixed-categories"],
  });

  // 獲取所有專案
  const { data: projects = [], isLoading: projectsLoading } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  });

  // 獲取子選項
  const { data: subOptions = [], isLoading: subOptionsLoading } = useQuery<FixedCategorySubOption[]>({
    queryKey: ["/api/fixed-categories/sub-options", selectedProject],
    queryFn: () => selectedProject ? 
      fetch(`/api/fixed-categories/sub-options/${selectedProject}`).then(res => res.json()) :
      Promise.resolve([]),
    enabled: !!selectedProject,
  });

  // 創建子選項
  const createSubOptionMutation = useMutation({
    mutationFn: async (data: {
      fixedCategoryId: number;
      projectId: number;
      subOptionName: string;
      displayName?: string;
    }) => {
      return await apiRequest("POST", "/api/fixed-categories/sub-options", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-categories/sub-options"] });
      setIsAddDialogOpen(false);
      toast({
        title: "成功",
        description: "固定分類子選項已創建",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: `創建失敗: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // 更新子選項
  const updateSubOptionMutation = useMutation({
    mutationFn: async (data: {
      id: number;
      subOptionName: string;
      displayName?: string;
    }) => {
      return await apiRequest("PATCH", `/api/fixed-categories/sub-options/${data.id}`, {
        subOptionName: data.subOptionName,
        displayName: data.displayName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-categories/sub-options"] });
      setEditingSubOption(null);
      toast({
        title: "成功",
        description: "固定分類子選項已更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: `更新失敗: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // 刪除子選項
  const deleteSubOptionMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/fixed-categories/sub-options/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-categories/sub-options"] });
      toast({
        title: "成功",
        description: "固定分類子選項已刪除",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: `刪除失敗: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleCreateSubOption = (data: {
    fixedCategoryId: number;
    subOptionName: string;
    displayName?: string;
  }) => {
    if (!selectedProject || !data.fixedCategoryId || !data.subOptionName) {
      toast({
        title: "錯誤",
        description: "請填寫所有必填欄位",
        variant: "destructive",
      });
      return;
    }

    createSubOptionMutation.mutate({
      fixedCategoryId: data.fixedCategoryId,
      projectId: selectedProject,
      subOptionName: data.subOptionName,
      displayName: data.displayName || undefined,
    });
  };

  const handleUpdateSubOption = (formData: FormData) => {
    if (!editingSubOption) return;

    const subOptionName = formData.get("subOptionName") as string;
    const displayName = formData.get("displayName") as string;

    updateSubOptionMutation.mutate({
      id: editingSubOption.id,
      subOptionName,
      displayName: displayName || undefined,
    });
  };

  const filteredSubOptions = selectedCategory 
    ? subOptions.filter(option => option.fixedCategoryId === selectedCategory)
    : subOptions;

  if (categoriesLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">固定分類管理</h1>
        <p className="text-muted-foreground mt-2">
          管理標準化的帳務分類（電話費、電費、水費、網路費等）和各專案的具體子選項（電話號碼、電號、水號、設備編號等）
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左側：固定分類列表 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              固定分類
            </CardTitle>
            <CardDescription>
              系統預設的標準分類
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {fixedCategories.map((category) => (
                <div
                  key={category.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedCategory === category.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <div className="font-medium">{category.categoryName}</div>
                  {category.description && (
                    <div className="text-sm text-muted-foreground">{category.description}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {category.categoryType}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      順序: {category.sortOrder}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 右側：子選項管理 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>子選項管理</CardTitle>
                <CardDescription>
                  為各專案配置具體的帳務詳細信息
                </CardDescription>
              </div>
              {selectedProject && selectedCategory && (
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      新增子選項
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>新增固定分類子選項</DialogTitle>
                      <DialogDescription>
                        為選定的專案和分類添加具體的子選項信息
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      handleCreateSubOption(formData);
                    }}>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="fixedCategoryId">固定分類</Label>
                          <Select name="fixedCategoryId" defaultValue={selectedCategory?.toString()}>
                            <SelectTrigger>
                              <SelectValue placeholder="選擇固定分類" />
                            </SelectTrigger>
                            <SelectContent>
                              {fixedCategories.map((category) => (
                                <SelectItem key={category.id} value={category.id.toString()}>
                                  {category.categoryName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="subOptionName">子選項名稱 *</Label>
                          <Input
                            id="subOptionName"
                            name="subOptionName"
                            placeholder="例如：電話號碼、電號、水號等"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="displayName">顯示名稱</Label>
                          <Input
                            id="displayName"
                            name="displayName"
                            placeholder="例如：辦公室電話、一樓電錶等（可選）"
                          />
                        </div>
                      </div>
                      <DialogFooter className="mt-6">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsAddDialogOpen(false)}
                        >
                          取消
                        </Button>
                        <Button type="submit" disabled={createSubOptionMutation.isPending}>
                          {createSubOptionMutation.isPending ? "創建中..." : "創建"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* 專案選擇器 */}
            <div className="mb-6">
              <Label htmlFor="project-select">選擇專案</Label>
              <Select
                value={selectedProject?.toString() || ""}
                onValueChange={(value) => setSelectedProject(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="請選擇一個專案" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.projectName} ({project.projectType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!selectedProject ? (
              <div className="text-center py-8 text-muted-foreground">
                請先選擇一個專案以查看和管理子選項
              </div>
            ) : !selectedCategory ? (
              <div className="text-center py-8 text-muted-foreground">
                請從左側選擇一個固定分類以查看子選項
              </div>
            ) : subOptionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredSubOptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                此專案尚未配置該分類的子選項
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>子選項名稱</TableHead>
                    <TableHead>顯示名稱</TableHead>
                    <TableHead>固定分類</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubOptions.map((subOption) => (
                    <TableRow key={subOption.id}>
                      <TableCell className="font-medium">
                        {subOption.subOptionName}
                      </TableCell>
                      <TableCell>
                        {subOption.displayName || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {subOption.categoryName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={subOption.isActive ? "default" : "secondary"}>
                          {subOption.isActive ? "啟用" : "停用"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingSubOption(subOption)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteSubOptionMutation.mutate(subOption.id)}
                            disabled={deleteSubOptionMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 編輯對話框 */}
      <Dialog open={!!editingSubOption} onOpenChange={() => setEditingSubOption(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯子選項</DialogTitle>
            <DialogDescription>
              修改子選項的基本信息
            </DialogDescription>
          </DialogHeader>
          {editingSubOption && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleUpdateSubOption(formData);
            }}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-subOptionName">子選項名稱 *</Label>
                  <Input
                    id="edit-subOptionName"
                    name="subOptionName"
                    defaultValue={editingSubOption.subOptionName}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-displayName">顯示名稱</Label>
                  <Input
                    id="edit-displayName"
                    name="displayName"
                    defaultValue={editingSubOption.displayName || ""}
                  />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingSubOption(null)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={updateSubOptionMutation.isPending}>
                  {updateSubOptionMutation.isPending ? "更新中..." : "更新"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}