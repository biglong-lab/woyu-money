import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Phone, Zap, Droplets, Wifi, Building } from "lucide-react";
import type { ProjectCategoryTemplate, DebtCategory, PaymentProject } from "@shared/schema";

const templateFormSchema = z.object({
  projectId: z.number(),
  categoryId: z.number(),
  templateName: z.string().min(1, "模板名稱不能為空"),
  accountInfo: z.string().optional(),
  notes: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

export default function ProjectTemplateManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProjectCategoryTemplate | null>(null);

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      templateName: "",
      accountInfo: "",
      notes: "",
    },
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  });

  // Fetch project categories
  const { data: categories = [] } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories/project"],
  });

  // Fetch templates for selected project
  const { data: templates = [], refetch: refetchTemplates } = useQuery<ProjectCategoryTemplate[]>({
    queryKey: ["/api/project-category-templates", selectedProject],
    enabled: !!selectedProject,
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      return await apiRequest("POST", "/api/project-category-templates", data);
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "模板已創建",
      });
      setDialogOpen(false);
      form.reset();
      setEditingTemplate(null);
      refetchTemplates();
    },
    onError: (error) => {
      toast({
        title: "錯誤",
        description: "創建模板失敗",
        variant: "destructive",
      });
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TemplateFormData> }) => {
      return await apiRequest("PUT", `/api/project-category-templates/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "模板已更新",
      });
      setDialogOpen(false);
      form.reset();
      setEditingTemplate(null);
      refetchTemplates();
    },
    onError: (error) => {
      toast({
        title: "錯誤",
        description: "更新模板失敗",
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/project-category-templates/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "模板已刪除",
      });
      refetchTemplates();
    },
    onError: (error) => {
      toast({
        title: "錯誤",
        description: "刪除模板失敗",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: TemplateFormData) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleEdit = (template: ProjectCategoryTemplate) => {
    setEditingTemplate(template);
    form.reset({
      projectId: template.projectId ?? undefined,
      categoryId: template.categoryId ?? undefined,
      templateName: template.templateName,
      accountInfo: template.accountInfo || "",
      notes: template.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("確定要刪除此模板嗎？")) {
      deleteTemplateMutation.mutate(id);
    }
  };

  const openCreateDialog = () => {
    if (!selectedProject || !selectedCategory) {
      toast({
        title: "請選擇專案和分類",
        description: "需要先選擇專案和分類才能創建模板",
        variant: "destructive",
      });
      return;
    }

    setEditingTemplate(null);
    form.reset({
      projectId: selectedProject,
      categoryId: selectedCategory,
      templateName: "",
      accountInfo: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    const categoryId = template.categoryId ?? 0;
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(template);
    return acc;
  }, {} as Record<number, ProjectCategoryTemplate[]>);

  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('電話') || name.includes('phone')) return <Phone className="h-4 w-4" />;
    if (name.includes('電') || name.includes('electric')) return <Zap className="h-4 w-4" />;
    if (name.includes('水') || name.includes('water')) return <Droplets className="h-4 w-4" />;
    if (name.includes('網') || name.includes('internet')) return <Wifi className="h-4 w-4" />;
    return <Building className="h-4 w-4" />;
  };

  const selectedProjectName = projects.find(p => p.id === selectedProject)?.projectName || "請選擇專案";
  const selectedCategoryName = categories.find(c => c.id === selectedCategory)?.categoryName || "請選擇分類";

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">專案分類模板管理</h1>
          <p className="text-gray-600 mt-2">
            管理專案特定的分類模板，同一專案的同一分類可以有多個帳號資訊
          </p>
        </div>
      </div>

      {/* Project and Category Selection */}
      <Card>
        <CardHeader>
          <CardTitle>選擇專案和分類</CardTitle>
          <CardDescription>
            選擇要管理模板的專案和分類。例如：浯島文旅 + 電話費 = 可以有多個電話號碼模板
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>專案</Label>
              <Select
                value={selectedProject?.toString() || ""}
                onValueChange={(value) => setSelectedProject(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇專案" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>分類</Label>
              <Select
                value={selectedCategory?.toString() || ""}
                onValueChange={(value) => setSelectedCategory(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇分類" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.categoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={openCreateDialog}
                disabled={!selectedProject || !selectedCategory}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                新增模板
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Selection Display */}
      {selectedProject && selectedCategory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getCategoryIcon(selectedCategoryName)}
              {selectedProjectName} - {selectedCategoryName} 的模板
            </CardTitle>
            <CardDescription>
              當前專案分類的所有帳號資訊模板
            </CardDescription>
          </CardHeader>
          <CardContent>
            {templatesByCategory[selectedCategory]?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templatesByCategory[selectedCategory].map((template) => (
                  <Card key={template.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-lg">{template.templateName}</h4>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(template.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {template.accountInfo && (
                        <div className="text-sm text-gray-600 mb-2">
                          <strong>帳號資訊：</strong> {template.accountInfo}
                        </div>
                      )}
                      
                      {template.notes && (
                        <div className="text-sm text-gray-500">
                          <strong>備註：</strong> {template.notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                尚無此分類的模板，點擊「新增模板」開始創建
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Templates Overview */}
      {selectedProject && Object.keys(templatesByCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedProjectName} 的所有模板總覽</CardTitle>
            <CardDescription>
              專案中所有分類的模板統計
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(templatesByCategory).map(([categoryId, categoryTemplates]) => {
                const category = categories.find(c => c.id === parseInt(categoryId));
                if (!category) return null;

                return (
                  <div key={categoryId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(category.categoryName)}
                        <h4 className="font-medium">{category.categoryName}</h4>
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          {categoryTemplates.length} 個模板
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {categoryTemplates.map((template) => (
                        <span
                          key={template.id}
                          className="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-md"
                        >
                          {template.templateName}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "編輯模板" : "新增模板"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate 
                ? "修改模板的帳號資訊和備註" 
                : `為 ${selectedProjectName} - ${selectedCategoryName} 新增帳號資訊模板`
              }
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="templateName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>模板名稱 *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="例：088219194、948883776、主線電話"
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
                      <Textarea 
                        placeholder="詳細的帳號資訊，如電話號碼、電號、水號等"
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="額外備註資訊"
                        rows={2}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                  className="flex-1"
                >
                  {editingTemplate ? "更新" : "創建"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}