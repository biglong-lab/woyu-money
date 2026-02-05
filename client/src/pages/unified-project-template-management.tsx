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
import { Plus, Edit2, Trash2, Phone, Zap, Droplets, Wifi, Building, Settings, Link } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectCategoryTemplate, DebtCategory, PaymentProject, FixedCategory, FixedCategorySubOption } from "@shared/schema";

const templateFormSchema = z.object({
  projectId: z.number(),
  categoryId: z.number().optional(),
  fixedCategoryId: z.number().optional(),
  templateName: z.string().min(1, "模板名稱不能為空"),
  accountInfo: z.string().optional(),
  notes: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

export default function UnifiedProjectTemplateManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateType, setTemplateType] = useState<"custom" | "fixed">("custom");
  const [editingTemplate, setEditingTemplate] = useState<ProjectCategoryTemplate | FixedCategorySubOption | null>(null);

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

  // Fetch custom categories
  const { data: customCategories = [] } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories/project"],
  });

  // Fetch fixed categories
  const { data: fixedCategories = [] } = useQuery<FixedCategory[]>({
    queryKey: ["/api/fixed-categories"],
  });

  // Fetch project templates (custom)
  const { data: customTemplates = [], refetch: refetchCustomTemplates } = useQuery<ProjectCategoryTemplate[]>({
    queryKey: ["/api/project-category-templates", selectedProject],
    enabled: !!selectedProject,
  });

  // Fetch fixed category sub options for project
  const { data: fixedTemplates = [], refetch: refetchFixedTemplates } = useQuery<FixedCategorySubOption[]>({
    queryKey: ["/api/fixed-category-sub-options", selectedProject],
    enabled: !!selectedProject,
  });

  const selectedProjectData = projects.find(p => p.id === selectedProject);

  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('電話') || name.includes('phone')) return <Phone className="h-4 w-4" />;
    if (name.includes('電') || name.includes('electric')) return <Zap className="h-4 w-4" />;
    if (name.includes('水') || name.includes('water')) return <Droplets className="h-4 w-4" />;
    if (name.includes('網') || name.includes('internet')) return <Wifi className="h-4 w-4" />;
    return <Building className="h-4 w-4" />;
  };

  const handleCreateTemplate = () => {
    if (!selectedProject) {
      toast({
        title: "請選擇專案",
        description: "需要先選擇專案才能創建模板",
        variant: "destructive",
      });
      return;
    }

    setEditingTemplate(null);
    form.reset({
      projectId: selectedProject,
      templateName: "",
      accountInfo: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  // Group custom templates by category
  const customTemplatesByCategory = customTemplates.reduce((acc, template) => {
    const categoryId = template.categoryId ?? 0;
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(template);
    return acc;
  }, {} as Record<number, ProjectCategoryTemplate[]>);

  // Group fixed templates by fixed category
  const fixedTemplatesByCategory = fixedTemplates.reduce((acc, template) => {
    const fixedCategoryId = template.fixedCategoryId;
    if (!acc[fixedCategoryId]) {
      acc[fixedCategoryId] = [];
    }
    acc[fixedCategoryId].push(template);
    return acc;
  }, {} as Record<number, FixedCategorySubOption[]>);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">統一專案模板管理</h1>
          <p className="text-gray-600 mt-2">
            專案綁定的統一模板管理：確保固定項目與自訂分類都歸屬於特定專案
          </p>
        </div>
      </div>

      {/* Project Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            專案選擇
          </CardTitle>
          <CardDescription>
            選擇要管理模板的專案，所有模板都會綁定到此專案
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
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
            <Button 
              onClick={handleCreateTemplate}
              disabled={!selectedProject}
            >
              <Plus className="h-4 w-4 mr-2" />
              新增模板
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Templates Display */}
      {selectedProject && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              {selectedProjectData?.projectName} 的專案模板
            </CardTitle>
            <CardDescription>
              此專案的所有模板（固定項目與自訂分類）統一管理
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="fixed" className="w-full">
              <TabsList>
                <TabsTrigger value="fixed">固定項目模板</TabsTrigger>
                <TabsTrigger value="custom">自訂分類模板</TabsTrigger>
              </TabsList>
              
              <TabsContent value="fixed" className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  固定項目模板：電話費、電費、水費等標準項目的帳號資訊
                </div>
                
                {Object.keys(fixedTemplatesByCategory).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(fixedTemplatesByCategory).map(([fixedCategoryId, templates]) => {
                      const fixedCategory = fixedCategories.find(c => c.id === parseInt(fixedCategoryId));
                      if (!fixedCategory) return null;

                      return (
                        <div key={fixedCategoryId} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(fixedCategory.categoryName)}
                              <h4 className="font-medium">{fixedCategory.categoryName}</h4>
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                固定項目 - {templates.length} 個帳號
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {templates.map((template) => (
                              <Card key={template.id} className="border-l-4 border-l-green-500">
                                <CardContent className="p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <h5 className="font-medium">{template.displayName || template.subOptionName}</h5>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="sm">
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="text-red-600">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    <strong>帳號：</strong> {template.subOptionName}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    此專案尚無固定項目模板
                  </div>
                )}
              </TabsContent>

              <TabsContent value="custom" className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  自訂分類模板：使用者自建分類的帳號資訊
                </div>
                
                {Object.keys(customTemplatesByCategory).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(customTemplatesByCategory).map(([categoryId, templates]) => {
                      const category = customCategories.find(c => c.id === parseInt(categoryId));
                      if (!category) return null;

                      return (
                        <div key={categoryId} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4" />
                              <h4 className="font-medium">{category.categoryName}</h4>
                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                自訂分類 - {templates.length} 個模板
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {templates.map((template) => (
                              <Card key={template.id} className="border-l-4 border-l-blue-500">
                                <CardContent className="p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <h5 className="font-medium">{template.templateName}</h5>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="sm">
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="text-red-600">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  {template.accountInfo && (
                                    <div className="text-sm text-gray-600 mb-1">
                                      <strong>帳號：</strong> {template.accountInfo}
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
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    此專案尚無自訂分類模板
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Architecture Overview */}
      {selectedProject && (
        <Card>
          <CardHeader>
            <CardTitle>專案綁定架構說明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  固定項目模板
                </h4>
                <div className="text-sm text-gray-600 space-y-2">
                  <p><strong>綁定關係：</strong> 專案 → 固定分類 → 帳號資訊</p>
                  <p><strong>使用情境：</strong> 電話費088219194、948883776</p>
                  <p><strong>資料表：</strong> fixed_category_sub_options</p>
                  <p><strong>特點：</strong> 專案特定，確保單一性</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  自訂分類模板
                </h4>
                <div className="text-sm text-gray-600 space-y-2">
                  <p><strong>綁定關係：</strong> 專案 → 自訂分類 → 帳號資訊</p>
                  <p><strong>使用情境：</strong> 特殊分類的多個帳號</p>
                  <p><strong>資料表：</strong> project_category_templates</p>
                  <p><strong>特點：</strong> 彈性更高，支援複雜場景</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h5 className="font-medium text-blue-900 mb-2">統一性保證</h5>
              <p className="text-sm text-blue-700">
                所有模板都必須綁定到特定專案，確保資料歸屬清楚，避免跨專案混淆。
                付款時系統會自動根據專案篩選對應的模板選項。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增專案模板</DialogTitle>
            <DialogDescription>
              為 {selectedProjectData?.projectName} 新增帳號資訊模板
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form className="space-y-4">
              <FormField
                control={form.control}
                name="templateName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>模板名稱 *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="例：主線電話、088219194"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Label>模板類型</Label>
                <Select value={templateType} onValueChange={(value: "custom" | "fixed") => setTemplateType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">固定項目</SelectItem>
                    <SelectItem value="custom">自訂分類</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {templateType === "fixed" && (
                <FormField
                  control={form.control}
                  name="fixedCategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>固定分類</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))}>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {templateType === "custom" && (
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>自訂分類</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇自訂分類" />
                        </SelectTrigger>
                        <SelectContent>
                          {customCategories.map((category) => (
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
              )}

              <FormField
                control={form.control}
                name="accountInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>帳號資訊</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="電話號碼、電號、水號等帳號資訊"
                        rows={3}
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
                  className="flex-1"
                >
                  創建
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}