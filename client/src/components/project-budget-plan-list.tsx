// 預算計劃列表元件

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Edit, Trash2, Wallet } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { BudgetPlan, Project } from "./project-budget-types";
import { formatCurrency, getStatusColor, getStatusLabel } from "./project-budget-utils";

export interface ProjectBudgetPlanListProps {
  plans: BudgetPlan[];
  projects: Project[];
  isLoading: boolean;
  selectedPlanId: number | null;
  onSelectPlan: (planId: number) => void;
  onEditPlan: (plan: BudgetPlan) => void;
  onDeletePlan: (plan: BudgetPlan) => void;
  onCreatePlan: () => void;
}

export default function ProjectBudgetPlanList({
  plans,
  projects,
  isLoading,
  selectedPlanId,
  onSelectPlan,
  onEditPlan,
  onDeletePlan,
  onCreatePlan,
}: ProjectBudgetPlanListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>尚無預算計劃</p>
          <Button variant="link" onClick={onCreatePlan} className="mt-2">
            建立第一個預算計劃
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan: BudgetPlan) => {
        const budget = plan.calculatedTotal || 0;
        const spent = parseFloat(plan.actualSpent) || 0;
        const progress = budget > 0 ? (spent / budget) * 100 : 0;
        const projectName =
          projects.find((p) => p.id === plan.projectId)?.projectName || "未指定專案";

        return (
          <Card
            key={plan.id}
            className={`cursor-pointer transition-shadow hover:shadow-md ${
              selectedPlanId === plan.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => onSelectPlan(plan.id)}
            data-testid={`card-plan-${plan.id}`}
          >
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">{plan.planName}</CardTitle>
                  <CardDescription>{projectName}</CardDescription>
                </div>
                <Badge className={getStatusColor(plan.status || "active")}>
                  {getStatusLabel(plan.status || "active")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">預算總額</span>
                <span className="font-medium">{formatCurrency(budget)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">已使用</span>
                <span
                  className={`font-medium ${progress > 100 ? "text-red-600" : ""}`}
                >
                  {formatCurrency(spent)}
                </span>
              </div>
              <Progress value={Math.min(progress, 100)} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  {plan.startDate} ~ {plan.endDate}
                </span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <div
                className="flex justify-end gap-2 pt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditPlan(plan)}
                  data-testid={`button-edit-plan-${plan.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeletePlan(plan)}
                  data-testid={`button-delete-plan-${plan.id}`}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
