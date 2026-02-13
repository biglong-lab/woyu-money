// 預算計劃建立/編輯對話框元件

import { UseFormReturn, FieldValues } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RefreshCw } from "lucide-react";
import type { BudgetPlan, Project } from "./project-budget-types";

export interface ProjectBudgetPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<FieldValues>;
  onSubmit: (data: FieldValues) => void;
  isPending: boolean;
  editingPlan: BudgetPlan | null;
  projects: Project[];
}

export default function ProjectBudgetPlanDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  isPending,
  editingPlan,
  projects,
}: ProjectBudgetPlanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingPlan ? "編輯預算計劃" : "新增預算計劃"}
          </DialogTitle>
          <DialogDescription>
            {editingPlan
              ? "修改預算計劃的詳細資訊"
              : "建立一個新的預算計劃來規劃支出"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="planName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>計劃名稱</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="例：2025年Q1營運預算"
                      data-testid="input-plan-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="planType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>計劃類型</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-plan-type">
                          <SelectValue placeholder="選擇類型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="project">專案預算</SelectItem>
                        <SelectItem value="department">部門預算</SelectItem>
                        <SelectItem value="event">活動預算</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budgetPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>預算週期</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-budget-period">
                          <SelectValue placeholder="選擇週期" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">月度</SelectItem>
                        <SelectItem value="quarterly">季度</SelectItem>
                        <SelectItem value="yearly">年度</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>關聯專案</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-plan-project">
                        <SelectValue placeholder="選擇專案（選填）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">不指定專案</SelectItem>
                      {projects.map((project) => (
                        <SelectItem
                          key={project.id}
                          value={project.id.toString()}
                        >
                          {project.projectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>開始日期</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-plan-start-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>結束日期</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-plan-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="totalBudget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>預算總額</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      placeholder="請輸入預算總額"
                      data-testid="input-plan-budget"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-submit-plan"
              >
                {isPending && (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingPlan ? "更新" : "建立"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
