import { UseFormReturn } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { LoanInvestmentFormData } from "./loan-enhanced-types";
import {
  SmartCalculatorWidget,
  LoanTermsSection,
  InvestmentTermsSection,
} from "./loan-enhanced-form-sections";

// ==========================================
// 借貸投資管理 - 新增 Dialog
// ==========================================

export interface LoanEnhancedAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<LoanInvestmentFormData>;
  onSubmit: (data: LoanInvestmentFormData) => void;
  isPending: boolean;
}

export function LoanEnhancedAddDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  isPending,
}: LoanEnhancedAddDialogProps) {
  const { toast } = useToast();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        aria-describedby="add-record-description"
      >
        <DialogHeader>
          <DialogTitle>新增借貸/投資紀錄</DialogTitle>
          <DialogDescription id="add-record-description">
            建立新的借貸或投資資金管理紀錄
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">基本資訊</TabsTrigger>
                <TabsTrigger value="party">對方資料</TabsTrigger>
                <TabsTrigger value="terms">條件設定</TabsTrigger>
                <TabsTrigger value="documents">文件備註</TabsTrigger>
              </TabsList>

              {/* 基本資訊頁籤 */}
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="itemName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>項目名稱 *</FormLabel>
                        <FormControl>
                          <Input placeholder="例：房屋貸款、股票投資..." {...field} />
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
                        <FormLabel>類型 *</FormLabel>
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
                        <FormLabel>年息 (%) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              const rate = parseFloat(e.target.value);
                              if (rate >= 15) {
                                toast({
                                  title: "高風險提醒",
                                  description: "年息15%以上，建議優先處理",
                                  variant: "destructive",
                                });
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                </div>

                {/* 智能計算工具 */}
                <SmartCalculatorWidget form={form} />
              </TabsContent>

              {/* 對方資料頁籤 */}
              <TabsContent value="party" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="partyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>對方姓名 *</FormLabel>
                        <FormControl>
                          <Input placeholder="輸入姓名" {...field} />
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
                        <FormLabel>電話</FormLabel>
                        <FormControl>
                          <Input placeholder="輸入電話號碼" {...field} />
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
                          <Input placeholder="例：朋友、親戚、同事..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="partyNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>對方備註</FormLabel>
                      <FormControl>
                        <Textarea placeholder="關於對方的其他資訊..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* 條件設定頁籤 */}
              <TabsContent value="terms" className="space-y-4">
                <LoanTermsSection form={form} />
                <InvestmentTermsSection form={form} />
              </TabsContent>

              {/* 文件備註頁籤 */}
              <TabsContent value="documents" className="space-y-4">
                <FormField
                  control={form.control}
                  name="contractFileUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>合約文件URL</FormLabel>
                      <FormControl>
                        <Input placeholder="合約文件連結..." {...field} />
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
                      <FormLabel>文件相關備註</FormLabel>
                      <FormControl>
                        <Textarea placeholder="關於合約或文件的備註..." {...field} />
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
                      <FormLabel>資金狀況備註</FormLabel>
                      <FormControl>
                        <Textarea placeholder="此資金狀況紀錄..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "處理中..." : "新增紀錄"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 借貸投資管理 - 編輯 Dialog
// ==========================================

export interface LoanEnhancedEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<LoanInvestmentFormData>;
  onSubmit: (data: LoanInvestmentFormData) => void;
  isPending: boolean;
}

export function LoanEnhancedEditDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  isPending,
}: LoanEnhancedEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        aria-describedby="edit-record-description"
      >
        <DialogHeader>
          <DialogTitle>編輯借貸/投資紀錄</DialogTitle>
          <DialogDescription id="edit-record-description">
            修改現有的借貸或投資資金管理紀錄
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="itemName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>項目名稱 *</FormLabel>
                      <FormControl>
                        <Input placeholder="例：房屋貸款、股票投資..." {...field} />
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
                      <FormLabel>紀錄類型 *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇類型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="loan">借貸 (我方借入)</SelectItem>
                          <SelectItem value="investment">投資 (我方投出)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="principalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>本金 *</FormLabel>
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
                      <FormLabel>年利率 (%) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="partyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>對方姓名</FormLabel>
                      <FormControl>
                        <Input placeholder="輸入姓名..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="monthlyPaymentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>每月付款金額</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
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

                <FormField
                  control={form.control}
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
              </div>

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
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "更新中..." : "更新紀錄"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
