import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Building, Phone, Zap, Droplets, Wifi, Settings } from "lucide-react";
import type { PaymentProject, FixedCategory, FixedCategorySubOption } from "@shared/schema";

const projectSpecificItemSchema = z.object({
  projectId: z.number(),
  fixedCategoryId: z.number(),
  itemName: z.string().min(1, "項目名稱不能為空"),
  accountInfo: z.string().optional(),
});

type ProjectSpecificItemFormData = z.infer<typeof projectSpecificItemSchema>;

const getCategoryIcon = (categoryName: string) => {
  const name = categoryName.toLowerCase();
  if (name.includes('電話') || name.includes('phone')) return Phone;
  if (name.includes('電') || name.includes('electricity')) return Zap;
  if (name.includes('水') || name.includes('water')) return Droplets;
  if (name.includes('網') || name.includes('internet')) return Wifi;
  return Settings;
};

export default function ProjectSpecificItemsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FixedCategorySubOption | null>(null);

  const form = useForm<ProjectSpecificItemFormData>({
    resolver: zodResolver(projectSpecificItemSchema),
    defaultValues: {
      itemName: "",
      accountInfo: "",
    },
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  });

  // Fetch fixed categories
  const { data: fixedCategories = [] } = useQuery<FixedCategory[]>({
    queryKey: ["/api/fixed-categories"],
  });

  // Fetch project specific items
  const { data: projectSpecificItems = [] } = useQuery<FixedCategorySubOption[]>({
    queryKey: ["/api/fixed-category-sub-options", selectedProject],
    queryFn: async () => {
      const response = await fetch(`/api/fixed-category-sub-options?projectId=${selectedProject}`);
      if (!response.ok) throw new Error('Failed to fetch project specific items');
      return response.json();
    },
    enabled: !!selectedProject,
  });

  // Create or update mutation
  const createMutation = useMutation({
    mutationFn: async (data: ProjectSpecificItemFormData) => {
      if (editingItem) {
        return apiRequest(`/api/fixed-category-sub-options/${editingItem.id}`, "PUT", data);
      } else {
        return apiRequest("/api/fixed-category-sub-options", "POST", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-category-sub-options"] });
      toast({
        title: editingItem ? "更新成功" : "新增成功",
        description: `專案專屬項目已${editingItem ? "更新" : "新增"}`,
      });
      setDialogOpen(false);
      setEditingItem(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "操作失敗",
        description: error.message || "請稍後再試",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/fixed-category-sub-options/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-category-sub-options"] });
      toast({
        title: "刪除成功",
        description: "專案專屬項目已刪除",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "刪除失敗",
        description: error.message || "請稍後再試",
        variant: "destructive",
      });
    },
  });

  const selectedProjectData = projects.find(p => p.id === selectedProject);

  const handleSubmit = (data: ProjectSpecificItemFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (item: FixedCategorySubOption) => {
    setEditingItem(item);
    form.reset({
      projectId: item.projectId!,
      fixedCategoryId: item.fixedCategoryId!,
      itemName: item.subOptionName, // Map subOptionName to itemName
      accountInfo: item.displayName || "", // Map displayName to accountInfo
    });
    setDialogOpen(true);
  };

  const handleDelete = (item: FixedCategorySubOption) => {
    if (confirm(`確定要刪除「${item.subOptionName}」嗎？`)) {
      deleteMutation.mutate(item.id);
    }
  };

  const handleNewItem = () => {
    setEditingItem(null);
    form.reset({
      projectId: selectedProject!,
      itemName: "",
      accountInfo: "",
    });
    setDialogOpen(true);
  };

  // Group items by fixed category
  const itemsByCategory = projectSpecificItems.reduce((acc, item) => {
    const categoryId = item.fixedCategoryId!;
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(item);
    return acc;
  }, {} as Record<number, FixedCategorySubOption[]>);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">專案專屬項目管理</h1>
          <p className="text-gray-600 mt-2">
            管理「固定分類＋專案」的專項項目，例如：浯島文旅的電話費、水電費等
          </p>
        </div>
      </div>

      {/* Project Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            選擇專案
          </CardTitle>
          <CardDescription>
            選擇要管理專案專屬項目的專案
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="project">專案</Label>
            <Select
              value={selectedProject?.toString() || ""}
              onValueChange={(value) => setSelectedProject(parseInt(value))}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="請選擇專案" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleNewItem}
              disabled={!selectedProject}
              className="ml-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              新增專案專屬項目
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Project Specific Items Display */}
      {selectedProject && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              {selectedProjectData?.projectName} 的專案專屬項目
            </CardTitle>
            <CardDescription>
              這些項目結合了固定分類（如電話費、水費）與專案資訊，可自定義項目名稱和帳號資訊
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(itemsByCategory).length > 0 ? (
              <div className="space-y-6">
                {Object.keys(itemsByCategory).map((categoryId) => {
                  const category = fixedCategories.find(c => c.id === parseInt(categoryId));
                  const items = itemsByCategory[parseInt(categoryId)];
                  const IconComponent = getCategoryIcon(category?.categoryName || "");

                  return (
                    <div key={categoryId} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-2 mb-4">
                        <IconComponent className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold">{category?.categoryName}</h3>
                        <span className="text-sm text-gray-500">
                          ({items.length} 個項目)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((item) => (
                          <div key={item.id} className="bg-white border rounded-lg p-3">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-gray-900">{item.subOptionName}</h4>
                              <div className="flex gap-1">
                                <Badge variant="outline" className="text-xs">
                                  已鎖定
                                </Badge>
                              </div>
                            </div>
                            {item.displayName && (
                              <p className="text-sm text-gray-600 mb-1">
                                帳號：{item.displayName}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                此專案尚無專案專屬項目，點擊「新增專案專屬項目」開始建立
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "編輯專案專屬項目" : "新增專案專屬項目"}
            </DialogTitle>
            <DialogDescription>
              建立或編輯專案的專屬項目，結合固定分類與自定義資訊
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fixedCategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>固定分類</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇固定分類" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fixedCategories.map((category) => {
                          const IconComponent = getCategoryIcon(category.categoryName);
                          return (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                {category.categoryName}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>項目名稱</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="例如：088219194電話費" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accountInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>帳號資訊</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="例如：帳號 088219194" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />



              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "處理中..." : editingItem ? "更新" : "新增"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}