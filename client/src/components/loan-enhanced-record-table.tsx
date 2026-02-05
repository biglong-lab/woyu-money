import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TableSkeleton } from "@/components/table-skeleton";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  CreditCard,
  Receipt,
} from "lucide-react";
import type { LoanInvestmentRecord } from "./loan-enhanced-types";
import { formatCurrency, getRiskLevel } from "./loan-enhanced-types";

// ==========================================
// 借貸投資管理 - 紀錄列表/表格
// ==========================================

export interface LoanEnhancedRecordTableProps {
  records: LoanInvestmentRecord[];
  isLoading: boolean;
  onAdd: () => void;
  onView: (record: LoanInvestmentRecord) => void;
  onEdit: (record: LoanInvestmentRecord) => void;
  onDelete: (record: LoanInvestmentRecord) => void;
  onQuickPayment: (record: LoanInvestmentRecord) => void;
}

export function LoanEnhancedRecordTable({
  records,
  isLoading,
  onAdd,
  onView,
  onEdit,
  onDelete,
  onQuickPayment,
}: LoanEnhancedRecordTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>借貸投資管理</CardTitle>
            <CardDescription>
              紀錄借貸金額，管理大筆的借貸、投資資金，進行完整的資金追蹤
            </CardDescription>
          </div>
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4 mr-2" />
            新增紀錄
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={5} columns={8} showHeader={false} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>項目名稱</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>對方</TableHead>
                <TableHead>本金</TableHead>
                <TableHead>年息</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>進度</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const riskLevel = getRiskLevel(parseFloat(record.annualInterestRate));
                const paidPercent = Math.min(
                  (parseFloat(record.totalPaidAmount) / parseFloat(record.principalAmount)) * 100,
                  100
                );

                return (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {record.itemName}
                        {record.isHighRisk && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            高風險
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.recordType === "loan" ? "destructive" : "default"}>
                        {record.recordType === "loan" ? "借貸" : "投資"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.partyName}</div>
                        <div className="text-sm text-muted-foreground">
                          {record.partyRelationship || "未設定"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(record.principalAmount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={riskLevel.textColor + " font-medium"}>
                          {record.annualInterestRate}%
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${riskLevel.color} text-white border-0`}
                        >
                          {riskLevel.level}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.status === "active" ? "default" : "secondary"}>
                        {record.status === "active" ? "進行中" : "已完成"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="w-20">
                        <Progress value={paidPercent} className="h-2" />
                        <div className="text-xs text-muted-foreground mt-1">
                          {paidPercent.toFixed(0)}%
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onView(record)}
                          title="查看詳細資訊"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onQuickPayment(record)}
                          title="快速還款"
                          className="text-green-600 hover:text-green-700"
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onView(record)}
                          title="還款紀錄"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Receipt className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEdit(record)}
                          title="編輯"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDelete(record)}
                          title="刪除"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
