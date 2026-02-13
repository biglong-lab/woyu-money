/**
 * 人事費管理 - 員工清單表格（含在職與離職）
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Plus, Loader2, Pencil, UserMinus } from "lucide-react";
import { formatCurrency } from "./types";
import type { Employee } from "./types";

interface EmployeeTableProps {
  /** 在職員工列表 */
  activeEmployees: Employee[];
  /** 離職員工列表 */
  inactiveEmployees: Employee[];
  /** 是否載入中 */
  isLoading: boolean;
  /** 編輯員工回呼 */
  onEdit: (employee: Employee) => void;
  /** 設為離職回呼 */
  onTerminate: (id: number) => void;
  /** 新增員工回呼 */
  onAdd: () => void;
}

/** 在職員工表格 */
function ActiveEmployeeTable({
  employees,
  isLoading,
  onEdit,
  onTerminate,
  onAdd,
}: {
  employees: Employee[];
  isLoading: boolean;
  onEdit: (emp: Employee) => void;
  onTerminate: (id: number) => void;
  onAdd: () => void;
}) {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Users className="w-8 h-8 mx-auto mb-2" />
        <p>尚未新增員工</p>
        <Button variant="outline" className="mt-3" onClick={onAdd}>
          <Plus className="w-4 h-4 mr-2" />
          新增第一位員工
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>姓名</TableHead>
            <TableHead>職稱</TableHead>
            <TableHead className="text-right">月薪</TableHead>
            <TableHead>到職日</TableHead>
            <TableHead className="text-center">眷屬</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((emp) => (
            <TableRow key={emp.id}>
              <TableCell className="font-medium">{emp.employeeName}</TableCell>
              <TableCell className="text-gray-500">
                {emp.position || "-"}
              </TableCell>
              <TableCell className="text-right">
                ${formatCurrency(emp.monthlySalary)}
              </TableCell>
              <TableCell>{emp.hireDate}</TableCell>
              <TableCell className="text-center">
                {emp.dependentsCount || 0}
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(emp)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => onTerminate(emp.id)}
                >
                  <UserMinus className="w-3 h-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** 員工清單 Tab 內容 */
export function EmployeeTable({
  activeEmployees,
  inactiveEmployees,
  isLoading,
  onEdit,
  onTerminate,
  onAdd,
}: EmployeeTableProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            在職員工 ({activeEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActiveEmployeeTable
            employees={activeEmployees}
            isLoading={isLoading}
            onEdit={onEdit}
            onTerminate={onTerminate}
            onAdd={onAdd}
          />
        </CardContent>
      </Card>

      {inactiveEmployees.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-gray-500">
              已離職 ({inactiveEmployees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inactiveEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm text-gray-500"
                >
                  <span>{emp.employeeName}</span>
                  <span>離職日: {emp.terminationDate || "-"}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
