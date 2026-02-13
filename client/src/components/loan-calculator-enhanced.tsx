import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, AlertTriangle, TrendingUp, Calendar } from "lucide-react";



interface LoanCalculatorProps {
  formData: Record<string, unknown>;
  setFormData: (data: Record<string, unknown>) => void;
}

interface CalculationResults {
  monthlyPayment: number;
  monthlyInterest: number;
  totalInterest: number;
  totalAmount: number;
  effectiveRate: number;
  yearsToPayoff: number;
  riskLevel: "low" | "medium" | "high";
}

export function LoanCalculatorEnhanced({ formData, setFormData }: LoanCalculatorProps) {
  const [calculationMode, setCalculationMode] = useState<"auto" | "rate" | "amount" | "payment">("auto");
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [knownValues, setKnownValues] = useState({
    principal: !!formData.principalAmount,
    rate: !!formData.annualInterestRate,
    term: !!(formData.startDate && formData.endDate),
    payment: !!formData.installmentAmount
  });

  // 計算期間（年）
  const calculateTermInYears = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate as string);
    const end = new Date(formData.endDate as string);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  };

  // 主要計算函數
  const calculateLoanMetrics = () => {
    const principal = parseFloat(formData.principalAmount as string) || 0;
    const rate = parseFloat(formData.annualInterestRate as string) || 0;
    const years = calculateTermInYears();
    const monthlyPayment = parseFloat(formData.installmentAmount as string) || 0;

    if (principal === 0) return null;

    const monthlyRate = rate / 100 / 12;
    const totalMonths = years * 12;

    const calculatedResults: Partial<CalculationResults> = {};

    // 根據不同的付款方式計算
    switch (formData.interestPaymentMethod) {
      case "monthly":
        // 每月付息
        calculatedResults.monthlyInterest = principal * (rate / 100) / 12;
        calculatedResults.monthlyPayment = calculatedResults.monthlyInterest;
        calculatedResults.totalInterest = calculatedResults.monthlyInterest * totalMonths;
        calculatedResults.totalAmount = principal + calculatedResults.totalInterest;
        break;

      case "annual": {
        // 年付息
        const annualInterest = principal * (rate / 100);
        calculatedResults.monthlyInterest = annualInterest / 12;
        calculatedResults.monthlyPayment = annualInterest;
        calculatedResults.totalInterest = annualInterest * years;
        calculatedResults.totalAmount = principal + calculatedResults.totalInterest;
        break;
      }

      default:
        // 本息攤還
        if (rate > 0 && years > 0) {
          const monthlyPaymentCalc = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
          calculatedResults.monthlyPayment = monthlyPaymentCalc;
          calculatedResults.totalAmount = monthlyPaymentCalc * totalMonths;
          calculatedResults.totalInterest = calculatedResults.totalAmount - principal;
          calculatedResults.monthlyInterest = calculatedResults.totalInterest / totalMonths;
        }
    }

    // 計算有效利率和風險等級
    calculatedResults.effectiveRate = rate;
    calculatedResults.yearsToPayoff = years;
    calculatedResults.riskLevel = rate >= 15 ? "high" : rate >= 8 ? "medium" : "low";

    return calculatedResults as CalculationResults;
  };

  // 反向計算：根據月付金額推算年利率
  const calculateRateFromPayment = () => {
    const principal = parseFloat(formData.principalAmount as string) || 0;
    const monthlyPayment = parseFloat(formData.installmentAmount as string) || 0;
    const years = calculateTermInYears();

    if (principal === 0 || monthlyPayment === 0 || years === 0) return 0;

    const totalMonths = years * 12;
    const totalAmount = monthlyPayment * totalMonths;
    const totalInterest = totalAmount - principal;
    const annualInterest = totalInterest / years;
    
    return (annualInterest / principal) * 100;
  };

  // 自動計算缺失值
  const autoCalculate = () => {
    const principal = parseFloat(formData.principalAmount as string) || 0;
    const rate = parseFloat(formData.annualInterestRate as string) || 0;
    const years = calculateTermInYears();
    const monthlyPayment = parseFloat(formData.installmentAmount as string) || 0;

    const hasValues = {
      principal: principal > 0,
      rate: rate > 0,
      term: years > 0,
      payment: monthlyPayment > 0
    };

    const valueCount = Object.values(hasValues).filter(Boolean).length;

    // 如果有至少2個已知值，嘗試計算缺失值
    if (valueCount >= 2) {
      const updatedFormData = { ...formData };

      // 如果缺少利率，從月付金額推算
      if (!hasValues.rate && hasValues.principal && hasValues.payment && hasValues.term) {
        const calculatedRate = calculateRateFromPayment();
        updatedFormData.annualInterestRate = calculatedRate.toFixed(2);
      }

      // 如果缺少月付金額，從利率計算
      if (!hasValues.payment && hasValues.principal && hasValues.rate && hasValues.term) {
        const tempResults = calculateLoanMetrics();
        if (tempResults) {
          updatedFormData.installmentAmount = tempResults.monthlyPayment.toFixed(0);
        }
      }

      setFormData(updatedFormData);
    }
  };

  // 實時計算結果
  useEffect(() => {
    const calculatedResults = calculateLoanMetrics();
    setResults(calculatedResults);

    // 更新已知值狀態
    setKnownValues({
      principal: !!formData.principalAmount,
      rate: !!formData.annualInterestRate,
      term: !!(formData.startDate && formData.endDate),
      payment: !!formData.installmentAmount
    });
  }, [formData.principalAmount, formData.annualInterestRate, formData.startDate, formData.endDate, formData.installmentAmount, formData.interestPaymentMethod]);

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "high":
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" />高風險</Badge>;
      case "medium":
        return <Badge variant="secondary" className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />中風險</Badge>;
      default:
        return <Badge variant="outline" className="flex items-center gap-1">低風險</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* 條件設定區 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            智能條件設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="principalAmount">本金金額 *</Label>
              <Input
                id="principalAmount"
                type="number"
                placeholder="請輸入本金"
                value={(formData.principalAmount as string) || ""}
                onChange={(e) => setFormData({ ...formData, principalAmount: e.target.value })}
                className={knownValues.principal ? "border-green-500" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="annualInterestRate">年息 (%) *</Label>
              <Input
                id="annualInterestRate"
                type="number"
                step="0.01"
                placeholder="請輸入年利率"
                value={(formData.annualInterestRate as string) || ""}
                onChange={(e) => setFormData({ ...formData, annualInterestRate: e.target.value })}
                className={knownValues.rate ? "border-green-500" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">開始日期 *</Label>
              <Input
                id="startDate"
                type="date"
                value={(formData.startDate as string) || ""}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className={knownValues.term ? "border-green-500" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">結束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={(formData.endDate as string) || ""}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className={knownValues.term ? "border-green-500" : ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interestPaymentMethod">利息給付方式</Label>
              <Select
                value={(formData.interestPaymentMethod as string) || undefined}
                onValueChange={(value) => setFormData({ ...formData, interestPaymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">年付息</SelectItem>
                  <SelectItem value="monthly">月付息</SelectItem>
                  <SelectItem value="agreed_date">約定日期</SelectItem>
                  <SelectItem value="principal_interest">本息攤還</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="installmentAmount">月付金額（可推算）</Label>
              <Input
                id="installmentAmount"
                type="number"
                placeholder="輸入或系統推算"
                value={(formData.installmentAmount as string) || ""}
                onChange={(e) => setFormData({ ...formData, installmentAmount: e.target.value })}
                className={knownValues.payment ? "border-green-500" : "border-blue-300"}
              />
            </div>
          </div>

          <Button 
            onClick={autoCalculate}
            variant="outline" 
            className="w-full"
            disabled={Object.values(knownValues).filter(Boolean).length < 2}
          >
            <Calculator className="w-4 h-4 mr-2" />
            自動推算缺失數據
          </Button>
        </CardContent>
      </Card>

      {/* 計算結果顯示 */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                計算結果與風險評估
              </span>
              {getRiskBadge(results.riskLevel)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">每月費用</div>
                <div className="text-lg font-semibold text-blue-600">
                  NT$ {(results.monthlyPayment || 0).toLocaleString()}
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">月利息</div>
                <div className="text-lg font-semibold text-green-600">
                  NT$ {(results.monthlyInterest || 0).toLocaleString()}
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">累積利息</div>
                <div className="text-lg font-semibold text-orange-600">
                  NT$ {(results.totalInterest || 0).toLocaleString()}
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">本息總額</div>
                <div className="text-lg font-semibold text-purple-600">
                  NT$ {(results.totalAmount || 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span>還款期間：{(results.yearsToPayoff || 0).toFixed(1)} 年</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-500" />
                <span>有效年利率：{(results.effectiveRate || 0).toFixed(2)}%</span>
              </div>
              <div className="flex items-center gap-2">
                {results.riskLevel === "high" && <AlertTriangle className="w-4 h-4 text-red-500" />}
                <span className={results.riskLevel === "high" ? "text-red-600 font-medium" : ""}>
                  {results.riskLevel === "high" ? "高風險警示：年息超過15%" : "風險評級正常"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 參考資訊提示 */}
      <Card className="bg-gray-50 dark:bg-gray-900">
        <CardContent className="pt-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <div className="font-medium">💡 智能推算提示：</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>輸入<strong>本金 + 月付金額 + 期間</strong>可推算年利率</li>
              <li>輸入<strong>本金 + 年利率 + 期間</strong>可推算月付金額</li>
              <li>不同利息給付方式會影響實際還款金額</li>
              <li>年利率15%以上會標示為高風險項目</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
