/**
 * 人事費管理 - 員工新增/編輯對話框
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Employee, EmployeeFormData } from "./types";

interface EmployeeFormDialogProps {
  /** 是否顯示對話框 */
  open: boolean;
  /** 關閉對話框回呼 */
  onOpenChange: (open: boolean) => void;
  /** 正在編輯的員工（null 表示新增） */
  editingEmployee: Employee | null;
  /** 表單資料 */
  formData: EmployeeFormData;
  /** 表單欄位變更回呼 */
  onFormChange: (data: EmployeeFormData) => void;
  /** 提交回呼 */
  onSubmit: () => void;
  /** 是否正在提交 */
  isPending: boolean;
}

/** 眷屬人數選項 */
const DEPENDENTS_OPTIONS = ["0", "1", "2", "3"];

/** 自提勞退比例選項 */
const PENSION_RATE_OPTIONS = [
  { value: "0", label: "不自提" },
  { value: "1", label: "1%" },
  { value: "2", label: "2%" },
  { value: "3", label: "3%" },
  { value: "4", label: "4%" },
  { value: "5", label: "5%" },
  { value: "6", label: "6%" },
];

/** 員工新增/編輯對話框 */
export function EmployeeFormDialog({
  open,
  onOpenChange,
  editingEmployee,
  formData,
  onFormChange,
  onSubmit,
  isPending,
}: EmployeeFormDialogProps) {
  const updateField = (field: keyof EmployeeFormData, value: string) => {
    onFormChange({ ...formData, [field]: value });
  };

  const isValid = formData.employeeName && formData.monthlySalary;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingEmployee ? "編輯員工" : "新增員工"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 姓名與職稱 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="name">姓名 *</Label>
              <Input
                id="name"
                value={formData.employeeName}
                onChange={(e) => updateField("employeeName", e.target.value)}
                placeholder="員工姓名"
              />
            </div>
            <div>
              <Label htmlFor="position">職稱</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => updateField("position", e.target.value)}
                placeholder="例：房務人員"
              />
            </div>
          </div>

          {/* 月薪與投保薪資 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="salary">月薪 *</Label>
              <Input
                id="salary"
                type="number"
                value={formData.monthlySalary}
                onChange={(e) => updateField("monthlySalary", e.target.value)}
                placeholder="30000"
              />
            </div>
            <div>
              <Label htmlFor="insured">投保薪資（選填）</Label>
              <Input
                id="insured"
                type="number"
                value={formData.insuredSalary}
                onChange={(e) => updateField("insuredSalary", e.target.value)}
                placeholder="依級距自動計算"
              />
            </div>
          </div>

          {/* 到職日與眷屬人數 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="hireDate">到職日 *</Label>
              <Input
                id="hireDate"
                type="date"
                value={formData.hireDate}
                onChange={(e) => updateField("hireDate", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dependents">眷屬人數</Label>
              <Select
                value={formData.dependentsCount}
                onValueChange={(v) => updateField("dependentsCount", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPENDENTS_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n} 人
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 自提勞退 */}
          <div>
            <Label htmlFor="pension">自提勞退 (%)</Label>
            <Select
              value={formData.voluntaryPensionRate}
              onValueChange={(v) => updateField("voluntaryPensionRate", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PENSION_RATE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!isValid || isPending}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {editingEmployee ? "儲存" : "新增"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
