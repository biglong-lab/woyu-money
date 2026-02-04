import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false);
  const [editingSubOption, setEditingSubOption] = useState<FixedCategorySubOption | null>(null);
  const [editingCategory, setEditingCategory] = useState<FixedCategory | null>(null);

  // Form state for new sub-option
  const [newSubOption, setNewSubOption] = useState({
    subOptionName: "",
    displayName: "",
  });

  // Form state for editing sub-option
  const [editSubOption, setEditSubOption] = useState({
    subOptionName: "",
    displayName: "",
  });

  // Form state for new category
  const [newCategory, setNewCategory] = useState({
    categoryName: "",
    categoryType: "utility",
    description: "",
  });

  // Form state for editing category
  const [editCategory, setEditCategory] = useState({
    categoryName: "",
    categoryType: "utility",
    description: "",
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

  // 創建新固定分類
  const createCategoryMutation = useMutation({
    mutationFn: async (data: {
      categoryName: string;
      categoryType: string;
      description?: string;
    }) => {
      return await apiRequest("/api/fixed-categories", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-categories"] });
      setIsAddCategoryDialogOpen(false);
      setNewCategory({ categoryName: "", categoryType: "utility", description: "" });
      toast({
        title: "成功",
        description: "固定分類已創建",
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

  // 更新固定分類
  const updateCategoryMutation = useMutation({
    mutationFn: async (data: {
      id: number;
      categoryName: string;
      categoryType: string;
      description?: string;
    }) => {
      const { id, ...updateData } = data;
      return await apiRequest(`/api/fixed-categories/${id}`, "PATCH", updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-categories"] });
      setIsEditCategoryDialogOpen(false);
      setEditingCategory(null);
      setEditCategory({ categoryName: "", categoryType: "utility", description: "" });
      toast({
        title: "成功",
        description: "固定分類已更新",
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

  // 創建子選項
  const createSubOptionMutation = useMutation({
    mutationFn: async (data: {
      fixedCategoryId: number;
      projectId: number;
      subOptionName: string;
      displayName?: string;
    }) => {
      return await apiRequest("/api/fixed-categories/sub-options", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-categories/sub-options", selectedProject] });
      setIsAddDialogOpen(false);
      setNewSubOption({ subOptionName: "", displayName: "" });
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
      return await apiRequest(`/api/fixed-categories/sub-options/${data.id}`, "PATCH", {
        subOptionName: data.subOptionName,
        displayName: data.displayName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-categories/sub-options", selectedProject] });
      setEditingSubOption(null);
      setEditSubOption({ subOptionName: "", displayName: "" });
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
      return await apiRequest(`/api/fixed-categories/sub-options/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-categories/sub-options", selectedProject] });
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

  const handleCreateSubOption = () => {
    if (!selectedProject || !selectedCategory || !newSubOption.subOptionName) {
      toast({
        title: "錯誤",
        description: "請選擇專案和分類，並填寫子選項名稱",
        variant: "destructive",
      });
      return;
    }

    createSubOptionMutation.mutate({
      fixedCategoryId: selectedCategory,
      projectId: selectedProject,
      subOptionName: newSubOption.subOptionName,
      displayName: newSubOption.displayName || undefined,
    });
  };

  const handleUpdateSubOption = () => {
    if (!editingSubOption) return;

    updateSubOptionMutation.mutate({
      id: editingSubOption.id,
      subOptionName: editSubOption.subOptionName,
      displayName: editSubOption.displayName || undefined,
    });
  };

  const handleEditClick = (subOption: FixedCategorySubOption) => {
    setEditingSubOption(subOption);
    setEditSubOption({
      subOptionName: subOption.subOptionName,
      displayName: subOption.displayName || "",
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  固定分類
                </CardTitle>
                <CardDescription>
                  系統預設的標準分類
                </CardDescription>
              </div>
              <Dialog open={isAddCategoryDialogOpen} onOpenChange={setIsAddCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    新增分類
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新增固定分類</DialogTitle>
                    <DialogDescription>
                      創建新的標準化分類（如電話費、電費、水費等）
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="categoryName">分類名稱 *</Label>
                      <Input
                        id="categoryName"
                        value={newCategory.categoryName}
                        onChange={(e) => setNewCategory({...newCategory, categoryName: e.target.value})}
                        placeholder="例如：電話費、電費、水費"
                      />
                    </div>
                    <div>
                      <Label htmlFor="categoryType">分類類型</Label>
                      <Select
                        value={newCategory.categoryType}
                        onValueChange={(value) => setNewCategory({...newCategory, categoryType: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選擇分類類型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="utility">公用事業</SelectItem>
                          <SelectItem value="communication">通訊費用</SelectItem>
                          <SelectItem value="service">服務費用</SelectItem>
                          <SelectItem value="other">其他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="description">描述</Label>
                      <Input
                        id="description"
                        value={newCategory.description}
                        onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                        placeholder="分類說明（可選）"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddCategoryDialogOpen(false)}
                    >
                      取消
                    </Button>
                    <Button 
                      onClick={() => createCategoryMutation.mutate(newCategory)} 
                      disabled={createCategoryMutation.isPending || !newCategory.categoryName}
                    >
                      {createCategoryMutation.isPending ? "創建中..." : "創建"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
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
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{category.categoryName}</div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCategory(category);
                        setEditCategory({
                          categoryName: category.categoryName,
                          categoryType: category.categoryType,
                          description: category.description || "",
                        });
                        setIsEditCategoryDialogOpen(true);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
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
                    <div className="space-y-4">
                      <div>
                        <Label>分類</Label>
                        <div className="p-2 bg-muted rounded-md">
                          <Badge variant="secondary">
                            {fixedCategories.find(c => c.id === selectedCategory)?.categoryName || '未選擇'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          正在為此分類新增子選項
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="subOptionName">子選項名稱 *</Label>
                        <Input
                          id="subOptionName"
                          value={newSubOption.subOptionName}
                          onChange={(e) => setNewSubOption({...newSubOption, subOptionName: e.target.value})}
                          placeholder="例如：電話號碼、電號、水號等"
                        />
                      </div>
                      <div>
                        <Label htmlFor="displayName">顯示名稱</Label>
                        <Input
                          id="displayName"
                          value={newSubOption.displayName}
                          onChange={(e) => setNewSubOption({...newSubOption, displayName: e.target.value})}
                          placeholder="例如：辦公室電話、一樓電錶等（可選）"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddDialogOpen(false)}
                      >
                        取消
                      </Button>
                      <Button onClick={handleCreateSubOption} disabled={createSubOptionMutation.isPending}>
                        {createSubOptionMutation.isPending ? "創建中..." : "創建"}
                      </Button>
                    </DialogFooter>
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
                            onClick={() => handleEditClick(subOption)}
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
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-subOptionName">子選項名稱 *</Label>
                <Input
                  id="edit-subOptionName"
                  value={editSubOption.subOptionName}
                  onChange={(e) => setEditSubOption({...editSubOption, subOptionName: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit-displayName">顯示名稱</Label>
                <Input
                  id="edit-displayName"
                  value={editSubOption.displayName}
                  onChange={(e) => setEditSubOption({...editSubOption, displayName: e.target.value})}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingSubOption(null)}
            >
              取消
            </Button>
            <Button onClick={handleUpdateSubOption} disabled={updateSubOptionMutation.isPending}>
              {updateSubOptionMutation.isPending ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯固定分類對話框 */}
      <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯固定分類</DialogTitle>
            <DialogDescription>
              修改固定分類的基本信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editCategoryName">分類名稱 *</Label>
              <Input
                id="editCategoryName"
                value={editCategory.categoryName}
                onChange={(e) => setEditCategory({...editCategory, categoryName: e.target.value})}
                placeholder="例如：電話費、電費、水費"
              />
            </div>
            <div>
              <Label htmlFor="editCategoryType">分類類型</Label>
              <Select
                value={editCategory.categoryType}
                onValueChange={(value) => setEditCategory({...editCategory, categoryType: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇分類類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utility">公用事業</SelectItem>
                  <SelectItem value="communication">通訊費用</SelectItem>
                  <SelectItem value="service">服務費用</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editDescription">描述</Label>
              <Input
                id="editDescription"
                value={editCategory.description}
                onChange={(e) => setEditCategory({...editCategory, description: e.target.value})}
                placeholder="分類說明（可選）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditCategoryDialogOpen(false)}
            >
              取消
            </Button>
            <Button 
              onClick={() => {
                if (editingCategory) {
                  updateCategoryMutation.mutate({
                    id: editingCategory.id,
                    ...editCategory
                  });
                }
              }} 
              disabled={updateCategoryMutation.isPending || !editCategory.categoryName}
            >
              {updateCategoryMutation.isPending ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}