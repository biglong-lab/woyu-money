import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Settings, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const categorySchema = z.object({
  categoryName: z.string().min(1, "分類名稱為必填"),
  description: z.string().optional(),
});

interface ProjectCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectCategoryDialog({ open, onOpenChange }: ProjectCategoryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // 獲取專案分類
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["/api/categories/project"],
    enabled: open,
  });

  const form = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      categoryName: "",
      description: "",
    },
  });

  // 創建/更新分類
  const saveCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        return await apiRequest(`/api/categories/project/${selectedCategory.id}`, "PUT", data);
      } else {
        return await apiRequest("/api/categories/project", "POST", data);
      }
    },
    onSuccess: () => {
      toast({
        title: `專案分類${isEditing ? '更新' : '創建'}成功`,
        description: `專案分類已成功${isEditing ? '更新' : '創建'}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/project"] });
      form.reset();
      setSelectedCategory(null);
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "操作失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 刪除分類
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/categories/project/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "刪除成功",
        description: "專案分類已刪除",
      });
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

  // 初始化預設分類
  const initializeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/categories/project/initialize");
    },
    onSuccess: () => {
      toast({
        title: "初始化成功",
        description: "專案業務分類已初始化",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/project"] });
    },
    onError: (error: any) => {
      toast({
        title: "初始化失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    saveCategoryMutation.mutate(data);
  };

  const handleEdit = (category: any) => {
    setSelectedCategory(category);
    setIsEditing(true);
    form.reset({
      categoryName: category.categoryName,
      description: category.description || "",
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("確定要刪除這個分類嗎？")) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setSelectedCategory(null);
    setIsEditing(false);
    form.reset({
      categoryName: "",
      description: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            專案業務分類管理
          </DialogTitle>
          <DialogDescription>
            管理專案支出分類，包括人事費用、行銷推廣、營運成本等業務相關類別
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 分類表單 */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {isEditing ? "編輯分類" : "新增分類"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="categoryName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>分類名稱</FormLabel>
                          <FormControl>
                            <Input placeholder="例如：人事費用" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>描述（選填）</FormLabel>
                          <FormControl>
                            <Textarea placeholder="例如：員工薪資、福利、保險等費用" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button 
                        type="submit" 
                        disabled={saveCategoryMutation.isPending}
                      >
                        {isEditing ? "更新" : "新增"}
                      </Button>
                      {isEditing && (
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={handleAddNew}
                        >
                          取消編輯
                        </Button>
                      )}
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* 分類列表 */}
          <div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    現有分類
                  </CardTitle>
                  {categories.length === 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => initializeMutation.mutate()}
                      disabled={initializeMutation.isPending}
                    >
                      初始化預設分類
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-4">載入中...</div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>還沒有專案分類</p>
                    <p className="text-sm mt-2">點擊「初始化預設分類」快速開始</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {categories.map((category: any) => (
                      <div 
                        key={category.id} 
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <h4 className="font-medium">{category.categoryName}</h4>
                          {category.description && (
                            <p className="text-sm text-muted-foreground">{category.description}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(category)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(category.id)}
                            disabled={deleteCategoryMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectCategoryDialog;