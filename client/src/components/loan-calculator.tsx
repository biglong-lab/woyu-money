import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Calculator, TrendingUp, AlertTriangle, DollarSign, Calendar, Target, Brain, Lightbulb, Plus, User, Phone } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CalculationResult {
  principal: number;
  annualRate: number;
  monthlyRate: number;
  repaymentMode: string;
  totalMonths?: number | string;
  graceMonths?: number;
  amortizationMonths?: number;
  monthlyInterestOnly?: number;
  monthlyPayment?: number;
  monthlyPrincipal?: number;
  monthlyInterest?: number;
  totalGraceInterest?: number;
  totalAmortizationPayment?: number;
  totalPayment?: number | string;
  totalInterest?: number | string;
  finalPayment?: number;
  finalPrincipalPayment?: number;
  monthlyAccrual?: number;
}

// Form schema for creating loan record
const loanRecordFormSchema = z.object({
  itemName: z.string().min(1, "項目名稱必填"),
  recordType: z.enum(["loan", "investment"]),
  partyName: z.string().min(1, "借方/資方姓名必填"),
  partyPhone: z.string().optional(),
  partyRelationship: z.string().optional(),
  startDate: z.string().min(1, "開始日期必填"),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

type LoanRecordFormData = z.infer<typeof loanRecordFormSchema>;

export default function LoanCalculator() {
  const [formData, setFormData] = useState({
    principalAmount: "",
    interestRate: "",
    repaymentMode: "principal_and_interest",
    repaymentYears: "",
    graceMonths: "0"
  });

  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [createRecordDialogOpen, setCreateRecordDialogOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form for creating loan record
  const recordForm = useForm<LoanRecordFormData>({
    resolver: zodResolver(loanRecordFormSchema),
    defaultValues: {
      itemName: "",
      recordType: "loan",
      partyName: "",
      partyPhone: "",
      partyRelationship: "",
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      notes: "",
    },
  });

  const calculateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/loan-investment/calculate", "POST", data);
      return response;
    },
    onSuccess: (result) => {
      setCalculation(result);
    }
  });

  const adviceMutation = useMutation({
    mutationFn: async (calculations: CalculationResult) => {
      const response = await apiRequest("POST", "/api/loan-investment/advice", { calculations });
      return response;
    },
    onSuccess: (result) => {
      setAiAdvice(result.advice);
    }
  });

  const createRecordMutation = useMutation({
    mutationFn: async (data: LoanRecordFormData) => {
      // Include calculation data in the loan record
      const recordData = {
        ...data,
        principalAmount: formData.principalAmount,
        interestRate: formData.interestRate,
        paymentFrequency: formData.repaymentMode === 'principal_and_interest' ? 'monthly' : 'custom',
        monthlyPaymentAmount: calculation?.monthlyPayment?.toString() || calculation?.monthlyInterest?.toString() || "",
        paymentDay: "1",
        // Add calculation metadata in notes
        notes: `${data.notes ? data.notes + '\n\n' : ''}計算詳情：
攤還模式：${formData.repaymentMode === 'principal_and_interest' ? '本息攤還' : 
           formData.repaymentMode === 'interest_only' ? '只付利息' : '自訂'}
${calculation?.repaymentYears ? `攤還年限：${calculation.repaymentYears}年` : ''}
${calculation?.graceMonths ? `緩衝期：${calculation.graceMonths}個月` : ''}
月利率：${calculation?.monthlyRate?.toFixed(3)}%
${calculation?.monthlyPayment ? `月付金額：NT$ ${calculation.monthlyPayment.toLocaleString()}` : ''}
${calculation?.totalInterest ? `總利息：NT$ ${calculation.totalInterest.toLocaleString()}` : ''}
${calculation?.totalPayment ? `總還款：NT$ ${calculation.totalPayment.toLocaleString()}` : ''}`
      };
      
      const response = await apiRequest("/api/loan-investment/records", "POST", recordData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setCreateRecordDialogOpen(false);
      recordForm.reset();
      toast({
        title: "成功",
        description: "借貸紀錄已建立，包含完整計算資訊"
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleCalculate = () => {
    if (!formData.principalAmount || !formData.interestRate || !formData.repaymentMode) {
      return;
    }

    const data = {
      ...formData,
      repaymentYears: formData.repaymentYears ? parseInt(formData.repaymentYears) : undefined,
      graceMonths: formData.graceMonths ? parseInt(formData.graceMonths) : undefined
    };

    calculateMutation.mutate(data);
  };

  const formatCurrency = (amount: number | string) => {
    if (typeof amount === 'string') return amount;
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const isHighRisk = parseFloat(formData.interestRate) >= 15;

  // 自動計算每月利息
  useEffect(() => {
    if (formData.principalAmount && formData.interestRate) {
      const principal = parseFloat(formData.principalAmount);
      const rate = parseFloat(formData.interestRate) / 100 / 12;
      const monthlyInterest = principal * rate;
      
      // 可以在這裡顯示即時的每月利息計算
    }
  }, [formData.principalAmount, formData.interestRate]);

  return (
    <div className="space-y-6">
      {/* 計算器表單 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            智能利息計算器
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="principal">本金金額</Label>
              <Input
                id="principal"
                type="number"
                placeholder="輸入本金金額"
                value={formData.principalAmount}
                onChange={(e) => setFormData({...formData, principalAmount: e.target.value})}
              />
            </div>
            
            <div>
              <Label htmlFor="rate">年息率 (%)</Label>
              <div className="flex gap-2">
                <Input
                  id="rate"
                  type="number"
                  step="0.1"
                  placeholder="輸入年息率"
                  value={formData.interestRate}
                  onChange={(e) => setFormData({...formData, interestRate: e.target.value})}
                />
                {isHighRisk && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    高風險
                  </Badge>
                )}
              </div>
              {formData.principalAmount && formData.interestRate && (
                <p className="text-sm text-gray-500 mt-1">
                  每月利息約: {formatCurrency(parseFloat(formData.principalAmount) * parseFloat(formData.interestRate) / 100 / 12)}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="mode">攤還模式</Label>
            <Select onValueChange={(value) => setFormData({...formData, repaymentMode: value})}>
              <SelectTrigger>
                <SelectValue placeholder="選擇攤還模式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="principal_and_interest">本息攤還</SelectItem>
                <SelectItem value="interest_only">只付利息</SelectItem>
                <SelectItem value="lump_sum">到期一次還</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.repaymentMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(formData.repaymentMode === 'principal_and_interest' || formData.repaymentMode === 'lump_sum') && (
                <div>
                  <Label htmlFor="years">攤還年限</Label>
                  <Input
                    id="years"
                    type="number"
                    placeholder="輸入年限"
                    value={formData.repaymentYears}
                    onChange={(e) => setFormData({...formData, repaymentYears: e.target.value})}
                  />
                </div>
              )}

              {formData.repaymentMode === 'principal_and_interest' && (
                <div>
                  <Label htmlFor="grace">緩衝期（月）</Label>
                  <Input
                    id="grace"
                    type="number"
                    placeholder="只付利息的月數"
                    value={formData.graceMonths}
                    onChange={(e) => setFormData({...formData, graceMonths: e.target.value})}
                  />
                </div>
              )}

              {formData.repaymentMode === 'interest_only' && (
                <div>
                  <Label htmlFor="years">還款期限（選填）</Label>
                  <Input
                    id="years"
                    type="number"
                    placeholder="不填則為無限期"
                    value={formData.repaymentYears}
                    onChange={(e) => setFormData({...formData, repaymentYears: e.target.value})}
                  />
                </div>
              )}
            </div>
          )}

          <Button 
            onClick={handleCalculate} 
            className="w-full"
            disabled={!formData.principalAmount || !formData.interestRate || !formData.repaymentMode || calculateMutation.isPending}
          >
            {calculateMutation.isPending ? "計算中..." : "開始計算"}
          </Button>
        </CardContent>
      </Card>

      {/* 計算結果 */}
      {calculation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              計算結果
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <p className="text-sm text-gray-600">本金</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(calculation.principal)}</p>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Target className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="text-sm text-gray-600">年息率</p>
                <p className="text-2xl font-bold text-green-600">{calculation.annualRate}%</p>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <p className="text-sm text-gray-600">月息率</p>
                <p className="text-2xl font-bold text-purple-600">{calculation.monthlyRate.toFixed(3)}%</p>
              </div>
            </div>

            <Separator className="my-4" />

            {calculation.repaymentMode === 'principal_and_interest' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">本息攤還詳情</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {calculation.graceMonths > 0 && (
                    <>
                      <div>
                        <p className="text-sm text-gray-600">緩衝期</p>
                        <p className="font-semibold">{calculation.graceMonths} 個月</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">緩衝期月付</p>
                        <p className="font-semibold">{formatCurrency(calculation.monthlyInterestOnly)}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">攤還月付</p>
                    <p className="font-semibold">{formatCurrency(calculation.monthlyPayment)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">月付本金</p>
                    <p className="font-semibold">{formatCurrency(calculation.monthlyPrincipal)}</p>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">總還款金額</p>
                      <p className="text-xl font-bold">{formatCurrency(calculation.totalPayment)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">總利息支出</p>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(calculation.totalInterest)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">利息佔比</p>
                      <p className="text-xl font-bold">
                        {((calculation.totalInterest as number / calculation.principal) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {calculation.repaymentMode === 'interest_only' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">只付利息詳情</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">每月利息</p>
                    <p className="font-semibold">{formatCurrency(calculation.monthlyInterest)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">付息期間</p>
                    <p className="font-semibold">{calculation.totalMonths}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">到期本金</p>
                    <p className="font-semibold">{formatCurrency(calculation.finalPrincipalPayment)}</p>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">總還款金額</p>
                      <p className="text-xl font-bold">{formatCurrency(calculation.totalPayment)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">總利息支出</p>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(calculation.totalInterest)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {calculation.repaymentMode === 'lump_sum' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">到期一次還詳情</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">借款期間</p>
                    <p className="font-semibold">{calculation.totalMonths} 個月</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">月利息累積</p>
                    <p className="font-semibold">{formatCurrency(calculation.monthlyAccrual)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">到期總額</p>
                    <p className="font-semibold text-red-600">{formatCurrency(calculation.finalPayment)}</p>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">本金</p>
                      <p className="text-xl font-bold">{formatCurrency(calculation.principal)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">複利利息</p>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(calculation.totalInterest)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Separator className="my-6" />

            {/* 操作按鈕 */}
            <div className="flex justify-center gap-3">
              <Button 
                onClick={() => adviceMutation.mutate(calculation)}
                disabled={adviceMutation.isPending}
                className="flex items-center gap-2"
                variant="outline"
              >
                <Brain className="w-4 h-4" />
                {adviceMutation.isPending ? "AI 分析中..." : "獲取 AI 理財建議"}
              </Button>
              
              <Dialog open={createRecordDialogOpen} onOpenChange={setCreateRecordDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    建立借貸紀錄
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>建立借貸紀錄</DialogTitle>
                  </DialogHeader>
                  <Form {...recordForm}>
                    <form onSubmit={recordForm.handleSubmit((data) => createRecordMutation.mutate(data))} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={recordForm.control}
                          name="itemName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>項目名稱</FormLabel>
                              <FormControl>
                                <Input placeholder="例：房屋貸款" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={recordForm.control}
                          name="recordType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>類型</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="選擇類型" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="loan">借貸</SelectItem>
                                  <SelectItem value="investment">投資</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={recordForm.control}
                          name="partyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>借方/資方姓名</FormLabel>
                              <FormControl>
                                <Input placeholder="輸入姓名" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={recordForm.control}
                          name="partyPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>聯絡電話</FormLabel>
                              <FormControl>
                                <Input placeholder="輸入電話" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={recordForm.control}
                          name="partyRelationship"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>關係</FormLabel>
                              <FormControl>
                                <Input placeholder="例：朋友、家人、銀行" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={recordForm.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>開始日期</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={recordForm.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>預計結束日期</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={recordForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>備註</FormLabel>
                            <FormControl>
                              <Textarea placeholder="輸入備註..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">將自動包含以下計算資訊：</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>• 本金金額：NT$ {formData.principalAmount ? parseInt(formData.principalAmount).toLocaleString() : '0'}</p>
                          <p>• 年利率：{formData.interestRate}%</p>
                          <p>• 攤還模式：{formData.repaymentMode === 'principal_and_interest' ? '本息攤還' : formData.repaymentMode === 'interest_only' ? '只付利息' : '自訂'}</p>
                          {calculation && (
                            <>
                              <p>• 月利率：{calculation.monthlyRate?.toFixed(3)}%</p>
                              {calculation.monthlyPayment && <p>• 月付金額：NT$ {calculation.monthlyPayment.toLocaleString()}</p>}
                              {calculation.totalInterest && <p>• 總利息：NT$ {calculation.totalInterest.toLocaleString()}</p>}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setCreateRecordDialogOpen(false)}
                        >
                          取消
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createRecordMutation.isPending}
                        >
                          {createRecordMutation.isPending ? "建立中..." : "建立紀錄"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI 建議結果 */}
      {aiAdvice && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              AI 理財建議
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                以下建議僅供參考，實際投資決策請諮詢專業理財顧問
              </AlertDescription>
            </Alert>
            <div className="mt-4 prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-gray-700">
                {aiAdvice}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}