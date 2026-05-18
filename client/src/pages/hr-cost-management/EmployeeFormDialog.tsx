/**
 * 人事費管理 - 員工新增/編輯對話框
 */
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEffect } from "react"
import { Loader2, Info } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import type { Employee, EmployeeFormData, EmploymentType } from "./types"
import { EMPLOYMENT_TYPE_LABELS } from "./types"

/** 員工類型 → 預設投保（依法規常識） */
const INSURANCE_DEFAULT_BY_TYPE: Record<EmploymentType, boolean> = {
  full_time: true, // 正職強制加保
  part_time: true, // 計時 5 人以上強制加保（中小企業常見不加，但預設依法）
  temporary: false, // 臨時 <5 天可不加，預設不加
  intern: true, // 工讀生受僱即強制加保
  contractor: false, // 承攬關係預設不加
}

/** 時薪型員工類型 */
const HOURLY_TYPES: EmploymentType[] = ["part_time", "temporary", "intern"]

interface EmployeeFormDialogProps {
  /** 是否顯示對話框 */
  open: boolean
  /** 關閉對話框回呼 */
  onOpenChange: (open: boolean) => void
  /** 正在編輯的員工（null 表示新增） */
  editingEmployee: Employee | null
  /** 表單資料 */
  formData: EmployeeFormData
  /** 表單欄位變更回呼 */
  onFormChange: (data: EmployeeFormData) => void
  /** 提交回呼 */
  onSubmit: () => void
  /** 是否正在提交 */
  isPending: boolean
}

/** 眷屬人數選項 */
const DEPENDENTS_OPTIONS = ["0", "1", "2", "3"]

/** 自提勞退比例選項 */
const PENSION_RATE_OPTIONS = [
  { value: "0", label: "不自提" },
  { value: "1", label: "1%" },
  { value: "2", label: "2%" },
  { value: "3", label: "3%" },
  { value: "4", label: "4%" },
  { value: "5", label: "5%" },
  { value: "6", label: "6%" },
]

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
  const updateField = (field: keyof EmployeeFormData, value: string | boolean) => {
    onFormChange({ ...formData, [field]: value })
  }

  /** 切換員工類型時、自動帶投保預設（新增模式才覆蓋；編輯模式保留使用者既有設定） */
  const handleEmploymentTypeChange = (newType: EmploymentType) => {
    onFormChange({
      ...formData,
      employmentType: newType,
      // 新增模式 → 帶預設；編輯模式只在類型確實改變時帶
      hasInsurance: editingEmployee ? formData.hasInsurance : INSURANCE_DEFAULT_BY_TYPE[newType],
    })
  }

  /** 自動計算月薪：時薪 × 工時，僅限時薪型員工 */
  const isHourlyType = HOURLY_TYPES.includes(formData.employmentType)
  const autoMonthly =
    (parseFloat(formData.hourlyRate) || 0) * (parseFloat(formData.monthlyHours) || 0)
  const isAutoMonthly = isHourlyType && autoMonthly > 0

  // 自動同步月薪欄位（時薪型員工 + 有時薪+工時）
  useEffect(() => {
    if (!isAutoMonthly) return
    const expected = autoMonthly.toString()
    if (formData.monthlySalary !== expected) {
      onFormChange({ ...formData, monthlySalary: expected })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.hourlyRate, formData.monthlyHours, formData.employmentType])

  const isValid = formData.employeeName && formData.monthlySalary

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingEmployee ? "編輯員工" : "新增員工"}</DialogTitle>
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

          {/* 員工類型 */}
          <div>
            <Label htmlFor="employmentType">員工類型</Label>
            <Select
              value={formData.employmentType}
              onValueChange={(v) => handleEmploymentTypeChange(v as EmploymentType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.employmentType !== "full_time" && (
              <div className="mt-2 text-xs p-2 bg-blue-50 border border-blue-200 rounded flex items-start gap-1.5">
                <Info className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-blue-900">
                  {formData.employmentType === "part_time" && (
                    <>
                      <strong>計時／兼職人員勞健保規定：</strong>
                      <br />
                      • 5 人以上公司：強制加保（含部分工時）
                      <br />
                      • 月工資 &lt; 27,470 仍按基本工資投保（最低投保薪資 27,470）
                      <br />• 勞退提繳 6% 強制、無例外
                    </>
                  )}
                  {formData.employmentType === "temporary" && (
                    <>
                      <strong>臨時工勞健保規定：</strong>
                      <br />
                      • 連續受僱 ≥ 5 天強制加保
                      <br />• 短於 5 天可不加保（但仍可自願）
                    </>
                  )}
                  {formData.employmentType === "intern" && (
                    <>
                      <strong>工讀生勞健保規定：</strong>
                      <br />
                      • 在學生受僱即強制加保（勞保條例 §8）
                      <br />• 健保通常隨父母投保、若雇主加保則退眷屬身分
                    </>
                  )}
                  {formData.employmentType === "contractor" && (
                    <>
                      <strong>約聘／外包：</strong>
                      <br />
                      • 真正承攬關係非僱傭：無投保義務
                      <br />
                      • 若有指揮監督關係實質為僱傭：強制加保
                      <br />• 需個案判定，建議諮詢勞動法律顧問
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 時薪欄位（part_time/temporary/intern 顯示） */}
          {(formData.employmentType === "part_time" ||
            formData.employmentType === "temporary" ||
            formData.employmentType === "intern") && (
            <div className="grid grid-cols-2 gap-3 p-2 bg-amber-50 border border-amber-200 rounded">
              <div>
                <Label htmlFor="hourlyRate" className="text-xs">
                  時薪
                </Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  value={formData.hourlyRate}
                  onChange={(e) => updateField("hourlyRate", e.target.value)}
                  placeholder="例：190"
                  className="h-9"
                />
              </div>
              <div>
                <Label htmlFor="monthlyHours" className="text-xs">
                  每月平均工時
                </Label>
                <Input
                  id="monthlyHours"
                  type="number"
                  value={formData.monthlyHours}
                  onChange={(e) => updateField("monthlyHours", e.target.value)}
                  placeholder="例：80"
                  className="h-9"
                />
              </div>
              {isAutoMonthly && (
                <div className="col-span-2 text-xs text-amber-800">
                  ✓ 月薪自動計算：<strong>${autoMonthly.toLocaleString()}</strong>
                  <span className="ml-2 text-amber-700">
                    （已自動填入下方月薪欄位、不需手動填）
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 月薪與投保薪資 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="salary">
                月薪 *
                {isAutoMonthly && <span className="ml-1 text-xs text-amber-600">（自動）</span>}
              </Label>
              <Input
                id="salary"
                type="number"
                value={formData.monthlySalary}
                onChange={(e) => updateField("monthlySalary", e.target.value)}
                disabled={isAutoMonthly}
                placeholder={isAutoMonthly ? "由時薪 × 工時自動算" : "30000"}
                className={isAutoMonthly ? "bg-gray-100" : ""}
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
              disabled={!formData.hasInsurance}
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

        {/* 投保開關 */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded border mt-2">
          <Switch
            id="hasInsurance"
            checked={formData.hasInsurance}
            onCheckedChange={(v) => updateField("hasInsurance", v)}
          />
          <div className="flex-1">
            <Label htmlFor="hasInsurance" className="cursor-pointer font-medium">
              投保勞健保
            </Label>
            <p className="text-xs text-gray-500 mt-0.5">
              {formData.hasInsurance
                ? "✓ 計算雇主負擔與員工自付勞保 / 健保 / 勞退"
                : "⚠ 不投保：只計算薪資，無勞健保費用（兼職、約聘、外包等情境）"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={!isValid || isPending}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {editingEmployee ? "儲存" : "新增"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
