/**
 * HRCostManagement - 人事費管理主頁
 * 包含：員工清單管理、薪資計算器、月度人事費生成
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, Plus } from "lucide-react";
import SalaryCalculator from "@/components/salary-calculator";
import { OverviewCards } from "./OverviewCards";
import { EmployeeTable } from "./EmployeeTable";
import { MonthlyCostTable } from "./MonthlyCostTable";
import { EmployeeFormDialog } from "./EmployeeFormDialog";
import { createEmptyFormData } from "./types";
import type {
  Employee,
  MonthlyHrCost,
  EmployeeFormData,
  MonthTotal,
} from "./types";

/** 提交用的員工資料型別 */
interface EmployeeSubmitData {
  employeeName: string;
  position: string;
  monthlySalary: string;
  insuredSalary: string | undefined;
  hireDate: string;
  dependentsCount: number;
  voluntaryPensionRate: string;
  notes: string;
}

/** 人事費管理頁面 */
export default function HRCostManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("employees");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().getMonth() + 1
  );
  const [formData, setFormData] = useState<EmployeeFormData>(
    createEmptyFormData()
  );

  // --- 資料查詢 ---
  const { data: employeeList = [], isLoading: employeesLoading } = useQuery<
    Employee[]
  >({
    queryKey: ["/api/hr/employees"],
  });

  const { data: monthlyCosts = [], isLoading: costsLoading } = useQuery<
    MonthlyHrCost[]
  >({
    queryKey: ["/api/hr/monthly-costs", selectedYear, selectedMonth],
    queryFn: () =>
      apiRequest<MonthlyHrCost[]>(
        "GET",
        `/api/hr/monthly-costs?year=${selectedYear}&month=${selectedMonth}`
      ),
  });

  // --- Mutations ---
  const addEmployeeMutation = useMutation({
    mutationFn: (data: EmployeeSubmitData) =>
      apiRequest("POST", "/api/hr/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      setShowAddDialog(false);
      setFormData(createEmptyFormData());
      toast({ title: "新增成功", description: "員工已新增" });
    },
    onError: (error: Error) => {
      toast({
        title: "新增失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EmployeeSubmitData }) =>
      apiRequest("PUT", `/api/hr/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      setEditingEmployee(null);
      setFormData(createEmptyFormData());
      toast({ title: "更新成功" });
    },
    onError: (error: Error) => {
      toast({
        title: "更新失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const terminateEmployeeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/hr/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      toast({ title: "已設為離職" });
    },
  });

  const generateMonthlyCostMutation = useMutation({
    mutationFn: (data: { year: number; month: number }) =>
      apiRequest<{ message?: string }>("POST", "/api/hr/monthly-costs/generate", data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/monthly-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/summary"] });
      toast({
        title: "生成成功",
        description: data.message || "月度人事費已計算完成",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "生成失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePayStatusMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { isPaid?: boolean; insurancePaid?: boolean };
    }) => apiRequest("PUT", `/api/hr/monthly-costs/${id}/pay`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/monthly-costs"] });
    },
  });

  // --- 事件處理 ---
  const buildSubmitData = (): EmployeeSubmitData => ({
    employeeName: formData.employeeName,
    position: formData.position,
    monthlySalary: formData.monthlySalary,
    insuredSalary: formData.insuredSalary || undefined,
    hireDate: formData.hireDate,
    dependentsCount: parseInt(formData.dependentsCount),
    voluntaryPensionRate: formData.voluntaryPensionRate,
    notes: formData.notes,
  });

  const handleSubmit = () => {
    const data = buildSubmitData();

    if (editingEmployee) {
      updateEmployeeMutation.mutate({ id: editingEmployee.id, data });
    } else {
      addEmployeeMutation.mutate(data);
    }
  };

  const handleEdit = (emp: Employee) => {
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

  const handleAddNew = () => {
    setFormData(createEmptyFormData());
    setEditingEmployee(null);
    setShowAddDialog(true);
  };

  const handleDialogClose = (open: boolean) => {
    setShowAddDialog(open);
    if (!open) {
      setEditingEmployee(null);
      setFormData(createEmptyFormData());
    }
  };

  // --- 衍生資料 ---
  const activeEmployees = employeeList.filter((e) => e.isActive);
  const inactiveEmployees = employeeList.filter((e) => !e.isActive);

  const monthTotal: MonthTotal = monthlyCosts.reduce(
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
        <Button onClick={handleAddNew}>
          <Plus className="w-4 h-4 mr-2" />
          新增員工
        </Button>
      </div>

      {/* 概覽卡片 */}
      <OverviewCards
        activeCount={activeEmployees.length}
        monthTotal={monthTotal}
      />

      {/* Tab 頁籤 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="employees">員工清單</TabsTrigger>
          <TabsTrigger value="monthly">月度人事費</TabsTrigger>
          <TabsTrigger value="calculator">薪資計算器</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <EmployeeTable
            activeEmployees={activeEmployees}
            inactiveEmployees={inactiveEmployees}
            isLoading={employeesLoading}
            onEdit={handleEdit}
            onTerminate={(id) => terminateEmployeeMutation.mutate(id)}
            onAdd={handleAddNew}
          />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <MonthlyCostTable
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            monthlyCosts={monthlyCosts}
            monthTotal={monthTotal}
            isLoading={costsLoading}
            isGenerating={generateMonthlyCostMutation.isPending}
            onGenerate={() =>
              generateMonthlyCostMutation.mutate({
                year: selectedYear,
                month: selectedMonth,
              })
            }
            onUpdatePayStatus={(id, data) =>
              updatePayStatusMutation.mutate({ id, data })
            }
          />
        </TabsContent>

        <TabsContent value="calculator">
          <SalaryCalculator />
        </TabsContent>
      </Tabs>

      {/* 新增/編輯員工對話框 */}
      <EmployeeFormDialog
        open={showAddDialog}
        onOpenChange={handleDialogClose}
        editingEmployee={editingEmployee}
        formData={formData}
        onFormChange={setFormData}
        onSubmit={handleSubmit}
        isPending={
          addEmployeeMutation.isPending || updateEmployeeMutation.isPending
        }
      />
    </div>
  );
}
