import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { LoanInvestmentFormData } from "./loan-enhanced-types";
import {
  formatCurrency,
  getRiskLevel,
  calculateAnnualRateFromMonthlyPayment,
  calculateMonthlyInterestFromRate,
} from "./loan-enhanced-types";

// ==========================================
// 借貸投資表單 - 智能計算工具
// ==========================================

export function SmartCalculatorWidget({
  form,
}: {
  form: UseFormReturn<LoanInvestmentFormData>;
}) {
  const watchRate = form.watch("annualInterestRate");
  const watchPrincipal = form.watch("principalAmount");
  const rateValue = parseFloat(watchRate || "0");
  const principalValue = parseFloat(watchPrincipal || "0");

  return (
    <div className="mt-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
      <h4 className="text-sm font-semibold mb-3 text-blue-800 dark:text-blue-200">
        智能計算工具
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-blue-700 dark:text-blue-300">
            借款金額
          </label>
          <Input
            type="number"
            placeholder="輸入金額"
            value={form.watch("principalAmount") || ""}
            onChange={(e) => form.setValue("principalAmount", e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-blue-700 dark:text-blue-300">
            每月還款
          </label>
          <Input
            type="number"
            placeholder="輸入金額"
            value={form.watch("monthlyPaymentAmount") || ""}
            onChange={(e) => {
              form.setValue("monthlyPaymentAmount", e.target.value);
              // 自動計算年利率
              const principal = parseFloat(form.watch("principalAmount") || "0");
              const monthly = parseFloat(e.target.value || "0");
              if (principal > 0 && monthly > 0) {
                const calculatedRate = calculateAnnualRateFromMonthlyPayment(principal, monthly);
                form.setValue("annualInterestRate", calculatedRate.toString());
              }
            }}
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-blue-700 dark:text-blue-300">
            年利率 (%)
          </label>
          <Input
            type="number"
            step="0.01"
            placeholder="輸入利率"
            value={form.watch("annualInterestRate") || ""}
            onChange={(e) => {
              form.setValue("annualInterestRate", e.target.value);
              // 自動計算每月利息
              const principal = parseFloat(form.watch("principalAmount") || "0");
              const rate = parseFloat(e.target.value || "0");
              if (principal > 0 && rate > 0) {
                const monthlyInterest = calculateMonthlyInterestFromRate(principal, rate);
                form.setValue("monthlyPaymentAmount", monthlyInterest.toString());
              }
            }}
            className="text-sm"
          />
        </div>
      </div>

      {/* 風險提醒和計算結果顯示 */}
      <div className="mt-3 space-y-2">
        {rateValue > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-600 dark:text-blue-400">風險等級:</span>
            <Badge className={`text-xs ${getRiskLevel(rateValue).color} text-white`}>
              {getRiskLevel(rateValue).level}
            </Badge>
          </div>
        )}

        {principalValue > 0 && rateValue > 0 && (
          <div className="text-xs text-blue-600 dark:text-blue-400">
            月利息參考: {formatCurrency(calculateMonthlyInterestFromRate(principalValue, rateValue))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 借貸投資表單 - 借貸條件設定
// ==========================================

export function LoanTermsSection({
  form,
}: {
  form: UseFormReturn<LoanInvestmentFormData>;
}) {
  if (form.watch("recordType") !== "loan") return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">借貸條件設定</h3>

      <FormField
        control={form.control}
        name="interestPaymentMethod"
        render={({ field }) => (
          <FormItem>
            <FormLabel>利息給付方式</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="選擇給付方式" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="yearly">一年付款一次</SelectItem>
                <SelectItem value="monthly">每月給付</SelectItem>
                <SelectItem value="agreed_date">約定給付日期</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {form.watch("interestPaymentMethod") === "monthly" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="monthlyPaymentAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>每月給付金額</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="agreedPaymentDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>約定給付日期 (每月幾號)</FormLabel>
                <FormControl>
                  <Input type="number" min="1" max="31" placeholder="例：15" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {form.watch("interestPaymentMethod") === "yearly" && (
        <FormField
          control={form.control}
          name="annualPaymentDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>年度付款日期</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}

// ==========================================
// 借貸投資表單 - 投資條件設定
// ==========================================

export function InvestmentTermsSection({
  form,
}: {
  form: UseFormReturn<LoanInvestmentFormData>;
}) {
  if (form.watch("recordType") !== "investment") return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">投資條件設定</h3>

      <FormField
        control={form.control}
        name="fixedReturnRate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>固定回饋 (%)</FormLabel>
            <FormControl>
              <Input type="number" step="0.01" placeholder="0.00" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="otherReturnPlan"
        render={({ field }) => (
          <FormItem>
            <FormLabel>其他方案描述</FormLabel>
            <FormControl>
              <Textarea placeholder="描述其他回饋方案..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="hasAgreedReturn"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel>約定返還</FormLabel>
            </div>
          </FormItem>
        )}
      />

      {form.watch("hasAgreedReturn") && (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="returnMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>返還方式</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇返還方式" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="lump_sum">一次還款</SelectItem>
                    <SelectItem value="installment">分期給付</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch("returnMethod") === "installment" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="installmentCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分期數</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="例：12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="installmentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>每期金額</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
