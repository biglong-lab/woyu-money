// LINE 設定 Tab 面板
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, FileText, Upload, Loader2, TestTube } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const lineConfigSchema = z.object({
  channelId: z.string().min(1, "Channel ID不能為空"),
  channelSecret: z.string().min(1, "Channel Secret不能為空"),
  callbackUrl: z.string().url("請輸入有效的URL"),
  isEnabled: z.boolean(),
});

export default function SettingsLineConfigTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lineConfig } = useQuery<any>({
    queryKey: ["/api/line-config"],
  });

  const lineConfigForm = useForm({
    resolver: zodResolver(lineConfigSchema),
    defaultValues: {
      channelId: "",
      channelSecret: "",
      callbackUrl: "",
      isEnabled: false,
    },
  });

  // 載入 LINE 設定
  useEffect(() => {
    if (lineConfig) {
      lineConfigForm.reset({
        channelId: lineConfig.channelId || "",
        channelSecret: lineConfig.channelSecret || "",
        callbackUrl: lineConfig.callbackUrl || "",
        isEnabled: lineConfig.isEnabled || false,
      });
    }
  }, [lineConfig, lineConfigForm]);

  // 儲存 LINE 設定
  const saveLineConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      if (lineConfig && lineConfig.id) {
        return await apiRequest("PUT", `/api/line-config/${lineConfig.id}`, data);
      } else {
        return await apiRequest("POST", "/api/line-config", data);
      }
    },
    onSuccess: () => {
      toast({ title: "設定已儲存", description: "LINE配置已成功保存到資料庫" });
      queryClient.invalidateQueries({ queryKey: ["/api/line-config"] });
    },
    onError: (error: Error) => {
      toast({ title: "儲存失敗", description: error.message, variant: "destructive" });
    },
  });

  // 自動生成 Callback URL
  const generateCallbackUrlMutation = useMutation({
    mutationFn: async () => {
      const timestamp = Date.now();
      const response = await fetch(`/api/line-config/generate-callback?t=${timestamp}`, {
        method: "GET",
        credentials: "include",
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      return await response.json();
    },
    onSuccess: (data) => {
      if (data && data.callbackUrl) {
        lineConfigForm.setValue("callbackUrl", data.callbackUrl);
        toast({ title: "已生成Callback URL", description: `已自動填入: ${data.callbackUrl}` });
      } else {
        throw new Error("未收到有效的Callback URL");
      }
    },
    onError: (error: Error) => {
      toast({ title: "生成失敗", description: error.message || "無法生成Callback URL", variant: "destructive" });
    },
  });

  // 測試 LINE 連線
  const testLineConnectionMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/line-config/test", data);
    },
    onSuccess: (result: any) => {
      toast({
        title: result.success ? "連線成功" : "連線失敗",
        description: result.message || (result.success ? "LINE API連線正常" : "LINE API連線失敗"),
        variant: result.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "測試失敗",
        description: "無法連接到LINE API服務，請檢查網路連線或稍後再試",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          LINE登入設定
        </CardTitle>
        <CardDescription>
          配置LINE登入功能的相關參數
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...lineConfigForm}>
          <form onSubmit={lineConfigForm.handleSubmit((data) => saveLineConfigMutation.mutate(data))} className="space-y-6">

            {/* 基本設定 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={lineConfigForm.control}
                name="channelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel ID</FormLabel>
                    <FormControl>
                      <Input placeholder="輸入LINE Channel ID" {...field} />
                    </FormControl>
                    <FormDescription>
                      從LINE Developers Console取得的Channel ID
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={lineConfigForm.control}
                name="channelSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel Secret</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="輸入Channel Secret" {...field} />
                    </FormControl>
                    <FormDescription>
                      從LINE Developers Console取得的Channel Secret
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={lineConfigForm.control}
              name="callbackUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Callback URL</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input placeholder="https://yourdomain.com/api/line/callback" {...field} />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => generateCallbackUrlMutation.mutate()}
                      disabled={generateCallbackUrlMutation.isPending}
                    >
                      {generateCallbackUrlMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "自動生成"
                      )}
                    </Button>
                  </div>
                  <FormDescription>
                    LINE登入完成後的回調URL，必須與LINE Developers Console中設定的一致。點擊「自動生成」可根據當前域名自動產生URL。
                  </FormDescription>
                  {field.value && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(field.value);
                          toast({ title: "已複製", description: "Callback URL已複製到剪貼板" });
                        }}
                      >
                        複製URL
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={lineConfigForm.control}
              name="isEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      啟用LINE登入
                    </FormLabel>
                    <FormDescription>
                      開啟後用戶可以使用LINE帳號登入系統
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* 重要提示 */}
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2 flex items-center">
                <span className="mr-2">🚨</span>
                重要：請更新LINE Developer Console設定
              </h4>
              <div className="text-sm text-red-800 dark:text-red-200 space-y-2">
                <p>如果看到「access.line.me 拒絕連線」錯誤，請確認在LINE Console中使用以下最新的Callback URL：</p>
                <div className="mt-2 p-3 bg-red-100 dark:bg-red-900 rounded border font-mono text-xs break-all">
                  {lineConfigForm.watch('callbackUrl') || '請先生成 Callback URL'}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = lineConfigForm.watch('callbackUrl');
                      if (url) {
                        navigator.clipboard.writeText(url);
                        toast({ title: "已複製", description: "請將此URL貼到LINE Console的Callback URL設定中" });
                      }
                    }}
                  >
                    複製最新URL
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://developers.line.biz/console/', '_blank')}
                  >
                    開啟LINE Console
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <FileText className="w-4 h-4 mr-2" />
                  匯出設定檔
                </Button>
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  匯入設定檔
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    const formData = lineConfigForm.getValues();
                    testLineConnectionMutation.mutate(formData);
                  }}
                  disabled={testLineConnectionMutation.isPending}
                >
                  {testLineConnectionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4 mr-2" />
                  )}
                  測試連線
                </Button>
                <Button type="submit" disabled={saveLineConfigMutation.isPending}>
                  {saveLineConfigMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  儲存設定
                </Button>
              </div>
            </div>
          </form>
        </Form>

        {/* 設定說明 */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-lg text-blue-800 dark:text-blue-200">
              設定說明
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="font-medium">1. 建立LINE Login頻道：</p>
              <p className="ml-4">前往LINE Developers Console建立新的LINE Login頻道</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium">2. 取得憑證：</p>
              <p className="ml-4">在Console中建立新的LINE Login頻道，取得Channel ID和Channel Secret</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium">3. 設定Callback URL：</p>
              <p className="ml-4">在LINE Login設定中添加您的Callback URL</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium">4. 測試設定：</p>
              <p className="ml-4">儲存設定後可以測試LINE登入功能是否正常運作</p>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
