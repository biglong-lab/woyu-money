import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Building2, Tag } from "lucide-react";

type CategorySelectorProps = {
  form: any;
  readOnly?: boolean;
  onCategoryChange?: (categoryData: {
    categoryType: string;
    categoryId?: string;
    fixedCategoryId?: string;
    projectId: string;
    itemName?: string;
  }) => void;
};

type DebtCategory = {
  id: number;
  categoryName: string;
  categoryType: string;
};

type PaymentProject = {
  id: number;
  projectName: string;
  projectType: string;
};

type FixedCategory = {
  id: number;
  categoryName: string;
  categoryType: string;
};

type ProjectCategoryTemplate = {
  id: number;
  projectId: number;
  categoryId: number;
  templateName: string;
  accountInfo: string;
  notes: string;
};

type FixedCategorySubOption = {
  id: number;
  fixedCategoryId: number;
  projectId: number;
  subOptionName: string;
  displayName: string;
  categoryType: string;
};

export default function CategorySelector({ form, readOnly = false, onCategoryChange }: CategorySelectorProps) {
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectCategoryTemplate | FixedCategorySubOption | null>(null);

  // Queries
  const { data: categories = [] } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories/project"],
  });

  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  });

  const { data: fixedCategories = [] } = useQuery<FixedCategory[]>({
    queryKey: ["/api/fixed-categories"],
  });

  // Fetch project templates when project is selected
  const { data: projectTemplates = [] } = useQuery<ProjectCategoryTemplate[]>({
    queryKey: ["/api/project-category-templates", selectedProjectId],
    enabled: !!selectedProjectId,
  });

  // Get selected fixed category ID
  const selectedFixedCategoryId = form.watch("fixedCategoryId");

  // Fetch fixed category sub-options when project and fixed category are selected
  const { data: fixedSubOptions = [] } = useQuery<FixedCategorySubOption[]>({
    queryKey: ["/api/fixed-category-sub-options", selectedProjectId, selectedFixedCategoryId],
    queryFn: () => {
      if (!selectedProjectId || !selectedFixedCategoryId) return Promise.resolve([]);
      return fetch(`/api/fixed-category-sub-options/${selectedProjectId}?fixedCategoryId=${selectedFixedCategoryId}`)
        .then(res => res.json());
    },
    enabled: !!selectedProjectId && !!selectedFixedCategoryId,
  });



  const handleCategoryTypeChange = (value: string) => {
    form.setValue("categoryType", value);
    form.setValue("categoryId", "");
    form.setValue("fixedCategoryId", "");
    form.setValue("itemName", "");
    setSelectedTemplate(null);
    
    if (onCategoryChange) {
      onCategoryChange({
        categoryType: value,
        projectId: selectedProjectId,
      });
    }
  };

  const handleProjectChange = (value: string) => {
    setSelectedProjectId(value);
    form.setValue("projectId", value);
    form.setValue("itemName", "");
    form.setValue("categoryId", "");
    form.setValue("fixedCategoryId", "");
    setSelectedTemplate(null);
    
    if (onCategoryChange) {
      onCategoryChange({
        categoryType: form.watch("categoryType"),
        projectId: value,
      });
    }
  };

  const handleTemplateSelect = (template: ProjectCategoryTemplate | FixedCategorySubOption) => {
    setSelectedTemplate(template);
    
    if ('templateName' in template) {
      // Project template
      form.setValue("itemName", template.templateName);
      form.setValue("categoryId", template.categoryId.toString());
      form.setValue("categoryType", "project");
      
      if (onCategoryChange) {
        onCategoryChange({
          categoryType: "project",
          categoryId: template.categoryId.toString(),
          projectId: selectedProjectId,
          itemName: template.templateName,
        });
      }
    } else {
      // Fixed category sub-option
      form.setValue("itemName", template.displayName);
      form.setValue("fixedCategoryId", template.fixedCategoryId.toString());
      form.setValue("categoryType", "fixed");
      
      if (onCategoryChange) {
        onCategoryChange({
          categoryType: "fixed",
          fixedCategoryId: template.fixedCategoryId.toString(),
          projectId: selectedProjectId,
          itemName: template.displayName,
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* 分類選擇區域 */}
      <Card className="border-blue-100 bg-blue-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            分類選擇
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="categoryType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    分類類型
                  </FormLabel>
                  <Select 
                    value={field.value || ""} 
                    onValueChange={handleCategoryTypeChange}
                    disabled={readOnly}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇分類類型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="project">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">專案</Badge>
                          專案分類
                        </div>
                      </SelectItem>
                      <SelectItem value="fixed">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">固定</Badge>
                          固定分類
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    專案
                  </FormLabel>
                  <Select value={field.value} onValueChange={handleProjectChange} disabled={readOnly}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇專案" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects?.map((project: PaymentProject) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {project.projectType}
                            </Badge>
                            {project.projectName}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* 專案模板選擇區域 - 只在選擇專案分類時顯示 */}
          {selectedProjectId && form.watch("categoryType") === "project" && projectTemplates.length > 0 && (
            <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200">
              <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                專案模板
              </h4>
              <div className="grid gap-2 max-h-40 overflow-y-auto">
                {projectTemplates?.map((template: ProjectCategoryTemplate) => (
                  <div 
                    key={`template-${template.id}`}
                    className={`p-3 border rounded-lg ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-sm'} transition-all ${
                      selectedTemplate?.id === template.id 
                        ? 'border-blue-500 bg-blue-50 shadow-sm' 
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => !readOnly && handleTemplateSelect(template)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{template.templateName}</div>
                        <div className="text-xs text-gray-500 mt-1">{template.accountInfo}</div>
                      </div>
                      <Badge variant="outline" className="text-xs ml-2">專案</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 專案專屬項目選擇區域 - 只在選擇固定分類時顯示 */}
          {selectedProjectId && form.watch("categoryType") === "fixed" && fixedSubOptions.length > 0 && (
            <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200">
              <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                專案專屬項目
              </h4>
              <div className="grid gap-2 max-h-40 overflow-y-auto">
                {fixedSubOptions.map((option: FixedCategorySubOption) => (
                  <div 
                    key={`fixed-${option.id}`}
                    className={`p-3 border rounded-lg ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-sm'} transition-all ${
                      selectedTemplate?.id === option.id 
                        ? 'border-blue-500 bg-blue-50 shadow-sm' 
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => !readOnly && handleTemplateSelect(option)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{option.displayName}</div>
                        <div className="text-xs text-gray-500 mt-1">{option.subOptionName}</div>
                      </div>
                      <Badge variant="secondary" className="text-xs ml-2">固定</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 手動分類選擇 */}
          {form.watch("categoryType") === "project" && (
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>專案分類</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇專案分類" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories?.map((category: DebtCategory) => (
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

          {form.watch("categoryType") === "fixed" && (
            <FormField
              control={form.control}
              name="fixedCategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>固定分類</FormLabel>
                  <Select 
                    value={field.value?.toString()} 
                    onValueChange={(value) => {
                      field.onChange(value);
                      // 對於固定分類，不自動填入項目名稱，讓用戶可以自定義專案專屬項目
                      if (onCategoryChange) {
                        onCategoryChange({
                          categoryType: "fixed",
                          fixedCategoryId: value,
                          projectId: selectedProjectId,
                        });
                      }
                    }}
                    disabled={readOnly}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇固定分類" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {fixedCategories?.map((category: FixedCategory) => (
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
        </CardContent>
      </Card>
    </div>
  );
}