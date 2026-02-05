/**
 * HRCostManagement - 人事費管理主頁
 * 包含：員工清單管理、薪資計算器、月度人事費生成
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users,
  Plus,
  Calculator,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pencil,
  UserMinus,
} from "lucide-react";
import SalaryCalculator from "@/components/salary-calculator";

interface Employee {
  id: number;
  employeeName: string;
  position?: string;
  monthlySalary: string;
  insuredSalary?: string;
  hireDate: string;
  terminationDate?: string;
  dependentsCount: number;
  voluntaryPensionRate: string;
  isActive: boolean;
  notes?: string;
}

interface MonthlyHrCost {
  id: number;
  year: number;
  month: number;
  employeeId: number;
  baseSalary: string;
  employerTotal: string;
  employeeTotal: string;
  netSalary: string;
  totalCost: string;
  isPaid: boolean;
  insurancePaid: boolean;
  employee?: Employee;
}

const formatCurrency = (value: any) => {
  const num = parseFloat(value || "0");
  return isNaN(num) ? "0" : Math.round(num).toLocaleString();
};

export default function HRCostManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("employees");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // 表單狀態
  const [formData, setFormData] = useState({
    employeeName: "",
    position: "",
    monthlySalary: "",
    insuredSalary: "",
    hireDate: new Date().toISOString().split("T")[0],
    dependentsCount: "0",
    voluntaryPensionRate: "0",
    notes: "",
  });

  // 查詢員工清單
  const { data: employeeList = [], isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ["/api/hr/employees"],
  });

  // 查詢月度人事費
  const { data: monthlyCosts = [], isLoading: costsLoading } = useQuery<MonthlyHrCost[]>({
    queryKey: ["/api/hr/monthly-costs", selectedYear, selectedMonth],
    queryFn: async () => {
      return apiRequest("GET", `/api/hr/monthly-costs?year=${selectedYear}&month=${selectedMonth}`);
    },
  });

  // 查詢年度彙總
  const { data: yearSummary } = useQuery<any>({
    queryKey: ["/api/hr/summary", selectedYear],
    queryFn: async () => {
      return apiRequest("GET", `/api/hr/summary?year=${selectedYear}`);
    },
  });

  // 新增員工
  const addEmployeeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hr/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: "新增成功", description: "員工已新增" });
    },
    onError: (error: Error) => {
      toast({ title: "新增失敗", description: error.message, variant: "destructive" });
    },
  });

  // 更新員工
  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/hr/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      setEditingEmployee(null);
      resetForm();
      toast({ title: "更新成功" });
    },
    onError: (error: Error) => {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    },
  });

  // 離職員工
  const terminateEmployeeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/hr/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      toast({ title: "已設為離職" });
    },
  });

  // 生成月度人事費
  const generateMonthlyCostMutation = useMutation({
    mutationFn: (data: { year: number; month: number }) =>
      apiRequest("POST", "/api/hr/monthly-costs/generate", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/monthly-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/summary"] });
      toast({
        title: "生成成功",
        description: data.message || "月度人事費已計算完成",
      });
    },
    onError: (error: Error) => {
      toast({ title: "生成失敗", description: error.message, variant: "destructive" });
    },
  });

  // 更新付款狀態
  const updatePayStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/hr/monthly-costs/${id}/pay`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/monthly-costs"] });
    },
  });

  const resetForm = () => {
    setFormData({
      employeeName: "",
      position: "",
      monthlySalary: "",
      insuredSalary: "",
      hireDate: new Date().toISOString().split("T")[0],
      dependentsCount: "0",
      voluntaryPensionRate: "0",
      notes: "",
    });
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      monthlySalary: formData.monthlySalary,
      insuredSalary: formData.insuredSalary || undefined,
      dependentsCount: parseInt(formData.dependentsCount),
      voluntaryPensionRate: formData.voluntaryPensionRate,
    };

    if (editingEmployee) {
      updateEmployeeMutation.mutate({ id: editingEmployee.id, data });
    } else {
      addEmployeeMutation.mutate(data);
    }
  };

  const startEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      employeeName: emp.employeeName,
      position: emp.position || "",
      monthlySalary: emp.monthlySalary,
      insuredSalary: emp.insuredSalary || "",
      hireDate: emp.hireDate,
      dependentsCount: String(emp.dependentsCount || 0),
      voluntaryPensionRate: emp.voluntaryPensionRate || "0",
      notes: emp.notes || "",
    });
    setShowAddDialog(true);
  };

  const activeEmployees = employeeList.filter((e) => e.isActive);
  const inactiveEmployees = employeeList.filter((e) => !e.isActive);

  // 本月彙總
  const monthTotal = monthlyCosts.reduce(
    (acc, c) => ({
      salary: acc.salary + parseFloat(c.baseSalary || "0"),
      employerCost: acc.employerCost + parseFloat(c.employerTotal || "0"),
      totalCost: acc.totalCost + parseFloat(c.totalCost || "0"),
    }),
    { salary: 0, employerCost: 0, totalCost: 0 }
  );

  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            人事費管理
          </h1>
          <p className="text-gray-500 mt-1">
            管理員工資料、計算勞健保費用、產生月度人事費
          </p>
        </div>
        <Button onClick={() => { resetForm(); setEditingEmployee(null); setShowAddDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          新增員工
        </Button>
      </div>

      {/* 概覽卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">在職人數</p>
              <p className="text-lg font-bold">{activeEmployees.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">本月薪資</p>
              <p className="text-lg font-bold">${formatCurrency(monthTotal.salary)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">雇主負擔</p>
              <p className="text-lg font-bold">${formatCurrency(monthTotal.employerCost)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">公司總成本</p>
              <p className="text-lg font-bold">${formatCurrency(monthTotal.totalCost)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tab 頁籤 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="employees">員工清單</TabsTrigger>
          <TabsTrigger value="monthly">月度人事費</TabsTrigger>
          <TabsTrigger value="calculator">薪資計算器</TabsTrigger>
        </TabsList>

        {/* 員工清單 */}
        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                在職員工 ({activeEmployees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employeesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </div>
              ) : activeEmployees.length > 0 ? (
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
                      {activeEmployees.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">
                            {emp.employeeName}
                          </TableCell>
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
                              onClick={() => startEdit(emp)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => terminateEmployeeMutation.mutate(emp.id)}
                            >
                              <UserMinus className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2" />
                  <p>尚未新增員工</p>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => { resetForm(); setShowAddDialog(true); }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    新增第一位員工
                  </Button>
                </div>
              )}
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
        </TabsContent>

        {/* 月度人事費 */}
        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {selectedYear}年{selectedMonth}月 人事費
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(selectedYear)}
                    onValueChange={(v) => setSelectedYear(parseInt(v))}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}年
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(selectedMonth)}
                    onValueChange={(v) => setSelectedMonth(parseInt(v))}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m}月
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() =>
                      generateMonthlyCostMutation.mutate({
                        year: selectedYear,
                        month: selectedMonth,
                      })
                    }
                    disabled={generateMonthlyCostMutation.isPending}
                  >
                    {generateMonthlyCostMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Calculator className="w-4 h-4 mr-1" />
                    )}
                    產生
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {costsLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </div>
              ) : monthlyCosts.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>員工</TableHead>
                        <TableHead className="text-right">底薪</TableHead>
                        <TableHead className="text-right">雇主負擔</TableHead>
                        <TableHead className="text-right">員工負擔</TableHead>
                        <TableHead className="text-right">實領</TableHead>
                        <TableHead className="text-right">公司成本</TableHead>
                        <TableHead className="text-center">薪資</TableHead>
                        <TableHead className="text-center">保費</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyCosts.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell className="font-medium">
                            {cost.employee?.employeeName || `ID:${cost.employeeId}`}
                          </TableCell>
                          <TableCell className="text-right">
                            ${formatCurrency(cost.baseSalary)}
                          </TableCell>
                          <TableCell className="text-right text-orange-600">
                            ${formatCurrency(cost.employerTotal)}
                          </TableCell>
                          <TableCell className="text-right text-blue-600">
                            ${formatCurrency(cost.employeeTotal)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            ${formatCurrency(cost.netSalary)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ${formatCurrency(cost.totalCost)}
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() =>
                                updatePayStatusMutation.mutate({
                                  id: cost.id,
                                  data: { isPaid: !cost.isPaid },
                                })
                              }
                            >
                              {cost.isPaid ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-gray-300 mx-auto" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() =>
                                updatePayStatusMutation.mutate({
                                  id: cost.id,
                                  data: { insurancePaid: !cost.insurancePaid },
                                })
                              }
                            >
                              {cost.insurancePaid ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-gray-300 mx-auto" />
                              )}
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* 彙總列 */}
                      <TableRow className="bg-gray-50 font-semibold">
                        <TableCell>合計</TableCell>
                        <TableCell className="text-right">
                          ${formatCurrency(monthTotal.salary)}
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          ${formatCurrency(monthTotal.employerCost)}
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">
                          ${formatCurrency(monthTotal.totalCost)}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Calendar className="w-8 h-8 mx-auto mb-2" />
                  <p>尚未產生本月人事費</p>
                  <p className="text-xs mt-1">
                    請先新增員工，再按「產生」按鈕計算
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 薪資計算器 */}
        <TabsContent value="calculator">
          <SalaryCalculator />
        </TabsContent>
      </Tabs>

      {/* 新增/編輯員工對話框 */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) {
            setEditingEmployee(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "編輯員工" : "新增員工"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="name">姓名 *</Label>
                <Input
                  id="name"
                  value={formData.employeeName}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeName: e.target.value })
                  }
                  placeholder="員工姓名"
                />
              </div>
              <div>
                <Label htmlFor="position">職稱</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) =>
                    setFormData({ ...formData, position: e.target.value })
                  }
                  placeholder="例：房務人員"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="salary">月薪 *</Label>
                <Input
                  id="salary"
                  type="number"
                  value={formData.monthlySalary}
                  onChange={(e) =>
                    setFormData({ ...formData, monthlySalary: e.target.value })
                  }
                  placeholder="30000"
                />
              </div>
              <div>
                <Label htmlFor="insured">投保薪資（選填）</Label>
                <Input
                  id="insured"
                  type="number"
                  value={formData.insuredSalary}
                  onChange={(e) =>
                    setFormData({ ...formData, insuredSalary: e.target.value })
                  }
                  placeholder="依級距自動計算"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="hireDate">到職日 *</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) =>
                    setFormData({ ...formData, hireDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="dependents">眷屬人數</Label>
                <Select
                  value={formData.dependentsCount}
                  onValueChange={(v) =>
                    setFormData({ ...formData, dependentsCount: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 人</SelectItem>
                    <SelectItem value="1">1 人</SelectItem>
                    <SelectItem value="2">2 人</SelectItem>
                    <SelectItem value="3">3 人</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="pension">自提勞退 (%)</Label>
              <Select
                value={formData.voluntaryPensionRate}
                onValueChange={(v) =>
                  setFormData({ ...formData, voluntaryPensionRate: v })
                }
              >
                <SelectTrigger>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.employeeName ||
                !formData.monthlySalary ||
                addEmployeeMutation.isPending ||
                updateEmployeeMutation.isPending
              }
            >
              {(addEmployeeMutation.isPending || updateEmployeeMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {editingEmployee ? "儲存" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
