// 專案管理 Tab 面板
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Plus, Edit, Trash2, Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@/components/settings-types";
import { getProjectTypeText } from "@/components/settings-types";

const projectSchema = z.object({
  projectName: z.string().min(1, "專案名稱不能為空"),
  projectType: z.string().min(1, "請選擇專案類型"),
  description: z.string().optional(),
});

export default function SettingsProjectsTab() {
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: ["/api/projects"],
  });

  const projectForm = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectName: editingProject?.projectName || "",
      projectType: editingProject?.projectType || "",
      description: editingProject?.description || "",
    },
  });

  // 新增專案
  const createProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/projects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsProjectDialogOpen(false);
      projectForm.reset();
      setEditingProject(null);
      toast({ title: "專案建立成功", description: "新專案已成功建立" });
    },
    onError: (error: Error) => {
      toast({ title: "建立失敗", description: error.message, variant: "destructive" });
    },
  });

  // 更新專案
  const updateProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", `/api/projects/${editingProject?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsProjectDialogOpen(false);
      projectForm.reset();
      setEditingProject(null);
      toast({ title: "專案更新成功", description: "專案已成功更新" });
    },
    onError: (error: Error) => {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    },
  });

  // 刪除專案
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "專案刪除成功", description: "專案已成功刪除" });
    },
    onError: (error: Error) => {
      toast({ title: "刪除失敗", description: error.message, variant: "destructive" });
    },
  });

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    projectForm.reset({
      projectName: project.projectName,
      projectType: project.projectType,
      description: project.description || "",
    });
    setIsProjectDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                專案管理
              </CardTitle>
              <CardDescription>
                管理付款項目所屬的專案
              </CardDescription>
            </div>
            <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingProject(null);
                  projectForm.reset({ projectName: "", projectType: "", description: "" });
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增專案
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projectsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              projects.map((project: Project) => (
                <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium">{project.projectName}</h3>
                    {project.description && (
                      <p className="text-sm text-muted-foreground">{project.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">
                        {getProjectTypeText(project.projectType)}
                      </Badge>
                      <Badge variant="secondary">
                        項目數: {project.itemCount || 0}
                      </Badge>
                      {project.isActive ? (
                        <Badge variant="default" className="bg-green-600">
                          啟用
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          停用
                        </Badge>
                      )}
                    </div>
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
                          <AlertDialogTitle>確認刪除</AlertDialogTitle>
                          <AlertDialogDescription>
                            確定要刪除專案「{project.projectName}」嗎？此操作無法復原。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteProjectMutation.mutate(project.id)}>
                            刪除
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

      {/* 專案編輯/新增 Dialog */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
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
            <form onSubmit={projectForm.handleSubmit((data) => {
              if (editingProject) {
                updateProjectMutation.mutate(data);
              } else {
                createProjectMutation.mutate(data);
              }
            })} className="space-y-4">
              <FormField
                control={projectForm.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>專案名稱</FormLabel>
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
                    <FormLabel>專案類型</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇專案類型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="general">一般專案</SelectItem>
                        <SelectItem value="business">商業專案</SelectItem>
                        <SelectItem value="personal">個人專案</SelectItem>
                        <SelectItem value="investment">投資專案</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={projectForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述（選填）</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="輸入專案描述"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsProjectDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={createProjectMutation.isPending || updateProjectMutation.isPending}>
                  {(createProjectMutation.isPending || updateProjectMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingProject ? "更新" : "建立"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
