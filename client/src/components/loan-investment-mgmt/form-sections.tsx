import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import type { LoanInvestmentFormData } from "./types";

/**
 * 借貸投資管理 -- 表單各區段子元件
 * 將表單依功能分為五個區段，由 RecordFormDialog 組合使用
 */

/** 表單區段共用 props */
interface SectionProps {
  form: UseFormReturn<LoanInvestmentFormData>;
}

/** 基本資訊區段：項目名稱、記錄類型、本金金額、年利率 */
export function BasicInfoSection({ form }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">基本資訊</h3>

      <FormField
        control={form.control}
        name="itemName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>項目名稱 *</FormLabel>
            <FormControl>
              <Input placeholder="請輸入項目名稱" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="recordType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>記錄類型 *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="選擇記錄類型" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="loan">借出</SelectItem>
                <SelectItem value="investment">投資</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="principalAmount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>本金金額 *</FormLabel>
            <FormControl>
              <Input type="number" placeholder="0" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="annualInterestRate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>年利率 (%)</FormLabel>
            <FormControl>
              <Input type="number" step="0.01" placeholder="0.00" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

/** 當事人資訊區段：姓名、電話、關係、備註 */
export function PartyInfoSection({ form }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">當事人資訊</h3>

      <FormField
        control={form.control}
        name="partyName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>當事人姓名 *</FormLabel>
            <FormControl>
              <Input placeholder="請輸入當事人姓名" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="partyPhone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>聯絡電話</FormLabel>
            <FormControl>
              <Input placeholder="請輸入聯絡電話" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="partyRelationship"
        render={({ field }) => (
          <FormItem>
            <FormLabel>關係</FormLabel>
            <FormControl>
              <Input placeholder="例：朋友、同事、親戚" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="partyNotes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>當事人備註</FormLabel>
            <FormControl>
              <Textarea placeholder="當事人相關備註資訊" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

/** 合約詳情區段：開始日期、結束日期、付款方式、分期期數 */
export function ContractDetailsSection({ form }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">合約詳情</h3>

      <FormField
        control={form.control}
        name="startDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>開始日期 *</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="endDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>結束日期</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="paymentMethod"
        render={({ field }) => (
          <FormItem>
            <FormLabel>付款方式</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="選擇付款方式" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="monthly">月付</SelectItem>
                <SelectItem value="quarterly">季付</SelectItem>
                <SelectItem value="annually">年付</SelectItem>
                <SelectItem value="maturity">到期一次付清</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="installmentCount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>分期期數</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="0"
                {...field}
                onChange={(e) =>
                  field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

/** 狀態與風險區段：狀態、風險等級、擔保品、保證人 */
export function RiskStatusSection({ form }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">狀態與風險</h3>

      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>狀態</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="選擇狀態" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="active">進行中</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="overdue">逾期</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="riskLevel"
        render={({ field }) => (
          <FormItem>
            <FormLabel>風險等級</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="選擇風險等級" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="low">低風險</SelectItem>
                <SelectItem value="medium">中風險</SelectItem>
                <SelectItem value="high">高風險</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="collateralInfo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>擔保品資訊</FormLabel>
            <FormControl>
              <Textarea placeholder="擔保品詳細資訊" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="guarantorInfo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>保證人資訊</FormLabel>
            <FormControl>
              <Textarea placeholder="保證人相關資訊" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

/** 其他資訊區段：合約簽署日期、到期日期、法律文件、備註 */
export function AdditionalInfoSection({ form }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">其他資訊</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="contractDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>合約簽署日期</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="maturityDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>到期日期</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="legalDocuments"
        render={({ field }) => (
          <FormItem>
            <FormLabel>法律文件</FormLabel>
            <FormControl>
              <Textarea placeholder="相關法律文件資訊" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="documentNotes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>文件備註</FormLabel>
            <FormControl>
              <Textarea placeholder="文件相關備註" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>備註</FormLabel>
            <FormControl>
              <Textarea placeholder="其他備註資訊" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
