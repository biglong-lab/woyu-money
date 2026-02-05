import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProjectBreakdownItem } from "./types";

// ========================================
// 專案分析列表元件
// ========================================

interface ProjectAnalysisListProps {
  /** 專案統計資料 */
  projectBreakdown: ProjectBreakdownItem[];
}

/** 專案分析頁籤：逐一顯示每個專案的進度、金額和完成率 */
export function ProjectAnalysisList({ projectBreakdown }: ProjectAnalysisListProps) {
  return (
    <div className="grid gap-4">
      {projectBreakdown.map((project, index) => (
        <Card key={index}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">{project.name}</CardTitle>
              <Badge
                variant={
                  project.completionRate > 80
                    ? "default"
                    : project.completionRate > 50
                      ? "secondary"
                      : "destructive"
                }
              >
                {project.completionRate.toFixed(1)}% 完成
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* 金額統計 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">計劃金額</p>
                <p className="text-xl font-bold">
                  NT$ {project.planned.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">已付金額</p>
                <p className="text-xl font-bold text-green-600">
                  NT$ {project.paid.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">項目數量</p>
                <p className="text-xl font-bold">{project.count} 項</p>
              </div>
            </div>

            {/* 進度條 */}
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(project.completionRate, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
