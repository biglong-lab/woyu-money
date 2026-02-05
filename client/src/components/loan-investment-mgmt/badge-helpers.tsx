import { Badge } from "@/components/ui/badge";

/**
 * 借貸投資管理 -- Badge 輔助渲染函式
 * 提供狀態、風險等級、記錄類型的 Badge 顯示
 */

/** 狀態 Badge（進行中 / 已完成 / 逾期） */
export function getStatusBadge(status: string) {
  const variants = {
    active: "default",
    completed: "secondary",
    overdue: "destructive",
  } as const;

  const labels: Record<string, string> = {
    active: "進行中",
    completed: "已完成",
    overdue: "逾期",
  };

  return (
    <Badge variant={variants[status as keyof typeof variants] || "default"}>
      {labels[status] || status}
    </Badge>
  );
}

/** 風險等級 Badge（低 / 中 / 高） */
export function getRiskBadge(riskLevel: string) {
  const variants = {
    low: "secondary",
    medium: "default",
    high: "destructive",
  } as const;

  const labels: Record<string, string> = {
    low: "低風險",
    medium: "中風險",
    high: "高風險",
  };

  return (
    <Badge variant={variants[riskLevel as keyof typeof variants] || "default"}>
      {labels[riskLevel] || riskLevel}
    </Badge>
  );
}

/** 記錄類型 Badge（借出 / 投資） */
export function getRecordTypeBadge(recordType: string) {
  return (
    <Badge variant={recordType === "loan" ? "default" : "secondary"}>
      {recordType === "loan" ? "借出" : "投資"}
    </Badge>
  );
}
