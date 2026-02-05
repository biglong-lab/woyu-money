// 預算計劃詳情元件（項目列表）

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, ArrowRight, Check, Target } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { BudgetPlan, BudgetItem } from "./project-budget-types";
import { formatCurrency, getPriorityColor, getPriorityLabel } from "./project-budget-utils";

export interface ProjectBudgetPlanDetailProps {
  planDetail: BudgetPlan | undefined;
  isLoading: boolean;
  onAddItem: () => void;
  onEditItem: (item: BudgetItem) => void;
  onDeleteItem: (item: BudgetItem) => void;
  onConvertItem: (item: BudgetItem) => void;
}

export default function ProjectBudgetPlanDetail({
  planDetail,
  isLoading,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onConvertItem,
}: ProjectBudgetPlanDetailProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!planDetail) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          請先選擇一個預算計劃
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{planDetail.planName}</CardTitle>
              <CardDescription>
                {planDetail.startDate} ~ {planDetail.endDate}
              </CardDescription>
            </div>
            <Button onClick={onAddItem} data-testid="button-add-item">
              <Plus className="w-4 h-4 mr-2" />
              新增預算項目
            </Button>
          </div>
        </CardHeader>
      </Card>

      {!planDetail.items || planDetail.items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>尚無預算項目</p>
            <Button variant="link" onClick={onAddItem} className="mt-2">
              新增第一個預算項目
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {planDetail.items.map((item) => {
            const planned = parseFloat(item.plannedAmount) || 0;
            const actual = parseFloat(item.actualAmount || "0") || 0;
            const variance = planned - actual;

            return (
              <Card key={item.id} data-testid={`card-item-${item.id}`}>
                <CardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{item.itemName}</h3>
                        <Badge className={getPriorityColor(item.priority)}>
                          {getPriorityLabel(item.priority)}
                        </Badge>
                        {item.convertedToPayment && (
                          <Badge className="bg-blue-100 text-blue-800">
                            <Check className="w-3 h-3 mr-1" />
                            已轉換
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {item.description || "無描述"}
                      </p>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm">
                        <span className="text-gray-500">
                          預估:{" "}
                          <span className="font-medium text-gray-900">
                            {formatCurrency(planned)}
                          </span>
                        </span>
                        {actual > 0 && (
                          <span className="text-gray-500">
                            實際:{" "}
                            <span className="font-medium text-gray-900">
                              {formatCurrency(actual)}
                            </span>
                          </span>
                        )}
                        {actual > 0 && (
                          <span
                            className={
                              variance >= 0 ? "text-green-600" : "text-red-600"
                            }
                          >
                            差異: {variance >= 0 ? "+" : ""}
                            {formatCurrency(variance)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!item.convertedToPayment && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onConvertItem(item)}
                          data-testid={`button-convert-item-${item.id}`}
                        >
                          <ArrowRight className="w-4 h-4 mr-1" />
                          轉為付款
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditItem(item)}
                        data-testid={`button-edit-item-${item.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteItem(item)}
                        data-testid={`button-delete-item-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
