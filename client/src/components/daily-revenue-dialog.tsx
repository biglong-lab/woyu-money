import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, Upload, Calendar, DollarSign } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const dailyRevenueSchema = z.object({
  projectId: z.number().min(1, "請選擇專案"),
  date: z.string().min(1, "請選擇日期"),
  amount: z.string().min(1, "請輸入金額"),
  description: z.string().optional(),
});

interface DailyRevenueDialogProps {
  trigger?: React.ReactNode;
  mode?: "create" | "edit";
  revenue?: any;
  onSuccess?: () => void;
}

export function DailyRevenueDialog({ 
  trigger, 
  mode = "create", 
  revenue,
  onSuccess 
}: DailyRevenueDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm({
    resolver: zodResolver(dailyRevenueSchema),
    defaultValues: {
      projectId: revenue?.projectId || 0,
      date: revenue?.date || new Date().toISOString().split('T')[0],
      amount: revenue?.amount || "",
      description: revenue?.description || "",
    },
  });

  // 獲取專案列表
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/payment/projects"],
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const formData = new FormData();
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== "") {
          formData.append(key, data[key]);
        }
      });
      
      if (selectedFile) {
        formData.append('receiptImage', selectedFile);
      }

      if (mode === "edit" && revenue) {
        return apiRequest("PATCH", `/api/daily-revenues/${revenue.id}`, formData);
      } else {
        return apiRequest("POST", "/api/daily-revenues", formData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-revenues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/revenue/reports"] });
      setIsOpen(false);
      form.reset();
      setSelectedFile(null);
      onSuccess?.();
      toast({
        title: mode === "edit" ? "收款記錄更新成功" : "收款記錄新增成功",
        description: mode === "edit" 
          ? "收款記錄已成功更新。" 
          : "新收款記錄已成功新增。",
      });
    },
    onError: (error: any) => {
      toast({
        title: mode === "edit" ? "更新失敗" : "新增失敗",
        description: error.message || "操作失敗，請稍後再試。",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    mutation.mutate(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            新增收款記錄
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            {mode === "edit" ? "編輯收款記錄" : "新增每日收款記錄"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit" 
              ? "修改收款記錄資訊" 
              : "記錄專案的每日收款金額"
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>專案</FormLabel>
                  <Select 
                    value={field.value?.toString()} 
                    onValueChange={(value) => field.onChange(parseInt(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇專案" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project: any) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.projectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    日期
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    收款金額
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="0.00" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="收款說明或備註" 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" />
                收據圖片
              </label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600">
                  已選擇：{selectedFile.name}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOpen(false)}
              >
                取消
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {mutation.isPending 
                  ? (mode === "edit" ? "更新中..." : "新增中...") 
                  : (mode === "edit" ? "更新" : "新增")
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}