/**
 * SalaryCalculator - 薪資計算器組件
 * 輸入月薪和參數，即時計算勞健保費用明細
 */
import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calculator, DollarSign } from "lucide-react";
import { calculateInsurance, type InsuranceCalculationResult } from "@shared/insurance-utils";

const formatCurrency = (value: number) => Math.round(value).toLocaleString();

export default function SalaryCalculator() {
  const [salary, setSalary] = useState("30000");
  const [dependents, setDependents] = useState("0");
  const [voluntaryPension, setVoluntaryPension] = useState("0");

  const result: InsuranceCalculationResult | null = useMemo(() => {
    const salaryNum = parseFloat(salary);
    if (!salaryNum || salaryNum <= 0) return null;

    return calculateInsurance({
      monthlySalary: salaryNum,
      dependentsCount: parseInt(dependents),
      voluntaryPensionRate: parseFloat(voluntaryPension),
    });
  }, [salary, dependents, voluntaryPension]);

  return (
    <div className="space-y-4">
      {/* 輸入參數 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            薪資參數設定
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="calc-salary">月薪</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <Input
                  id="calc-salary"
                  type="number"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="pl-8"
                  placeholder="30000"
                />
              </div>
            </div>
            <div>
              <Label>眷屬人數</Label>
              <Select value={dependents} onValueChange={setDependents}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">本人（0 眷屬）</SelectItem>
                  <SelectItem value="1">1 位眷屬</SelectItem>
                  <SelectItem value="2">2 位眷屬</SelectItem>
                  <SelectItem value="3">3 位眷屬</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>員工自提勞退</Label>
              <Select value={voluntaryPension} onValueChange={setVoluntaryPension}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">不自提</SelectItem>
                  <SelectItem value="1">1%</SelectItem>
                  <SelectItem value="2">2%</SelectItem>
                  <SelectItem value="3">3%</SelectItem>
                  <SelectItem value="4">4%</SelectItem>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="6">6%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 計算結果 */}
      {result && (
        <>
          {/* 投保薪資 */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">勞保投保薪資</p>
                  <p className="text-lg font-bold text-blue-900">
                    ${formatCurrency(result.laborInsuredSalary)}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600">健保投保薪資</p>
                  <p className="text-lg font-bold text-green-900">
                    ${formatCurrency(result.healthInsuredSalary)}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600">勞退提繳薪資</p>
                  <p className="text-lg font-bold text-purple-900">
                    ${formatCurrency(result.pensionSalary)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 明細表 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                費用明細
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>項目</TableHead>
                    <TableHead className="text-right">雇主負擔</TableHead>
                    <TableHead className="text-right">員工負擔</TableHead>
                    <TableHead className="text-right">說明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>勞保費（普通事故）</TableCell>
                    <TableCell className="text-right text-orange-600">
                      ${formatCurrency(result.employerLaborInsurance)}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      ${formatCurrency(result.employeeLaborInsurance)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-gray-500">
                      雇主70% / 員工20%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>就業保險費</TableCell>
                    <TableCell className="text-right text-orange-600">
                      ${formatCurrency(result.employerEmploymentInsurance)}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      ${formatCurrency(
                        Math.round(result.employeeLaborInsurance * (1 / 11))
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-gray-500">
                      費率 1%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>職災保險費</TableCell>
                    <TableCell className="text-right text-orange-600">
                      ${formatCurrency(result.employerAccidentInsurance)}
                    </TableCell>
                    <TableCell className="text-right text-gray-400">-</TableCell>
                    <TableCell className="text-right text-xs text-gray-500">
                      雇主全額
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>健保費</TableCell>
                    <TableCell className="text-right text-orange-600">
                      ${formatCurrency(result.employerHealthInsurance)}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      ${formatCurrency(result.employeeHealthInsurance)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-gray-500">
                      {parseInt(dependents) > 0
                        ? `含 ${dependents} 位眷屬`
                        : "本人"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>勞退 6%</TableCell>
                    <TableCell className="text-right text-orange-600">
                      ${formatCurrency(result.employerPension)}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      {result.employeePension > 0
                        ? `$${formatCurrency(result.employeePension)}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-gray-500">
                      雇主強制 6%
                      {parseFloat(voluntaryPension) > 0
                        ? ` + 員工自提 ${voluntaryPension}%`
                        : ""}
                    </TableCell>
                  </TableRow>
                  {/* 小計 */}
                  <TableRow className="bg-gray-50 font-semibold">
                    <TableCell>小計</TableCell>
                    <TableCell className="text-right text-orange-700">
                      ${formatCurrency(result.employerTotal)}
                    </TableCell>
                    <TableCell className="text-right text-blue-700">
                      ${formatCurrency(result.employeeTotal)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 總結 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-4 bg-orange-50 border-orange-200">
              <p className="text-xs text-orange-600 font-medium">雇主總負擔</p>
              <p className="text-xl font-bold text-orange-900 mt-1">
                ${formatCurrency(result.employerTotal)}
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                佔薪資 {((result.employerTotal / parseFloat(salary)) * 100).toFixed(1)}%
              </p>
            </Card>
            <Card className="p-4 bg-green-50 border-green-200">
              <p className="text-xs text-green-600 font-medium">員工實領</p>
              <p className="text-xl font-bold text-green-900 mt-1">
                ${formatCurrency(result.netSalary)}
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                扣除員工負擔 ${formatCurrency(result.employeeTotal)}
              </p>
            </Card>
            <Card className="p-4 bg-purple-50 border-purple-200">
              <p className="text-xs text-purple-600 font-medium">公司總成本</p>
              <p className="text-xl font-bold text-purple-900 mt-1">
                ${formatCurrency(result.totalCost)}
              </p>
              <p className="text-xs text-purple-600 mt-0.5">
                月薪 + 雇主負擔
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
