/**
 * SettingsAiTab - AI 助手設定 Tab
 * 提供：OpenRouter API Key 設定、模型選擇、連線測試
 */
import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Bot, Eye, EyeOff, ExternalLink, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────

interface AiSettingsData {
  id: number
  apiProvider: string
  apiKeyMasked: string | null
  selectedModel: string
  isEnabled: boolean
  systemPromptExtra: string | null
}

interface ModelOption {
  id: string
  name: string
  free: boolean
}

// ─────────────────────────────────────────────
// 元件
// ─────────────────────────────────────────────

export function SettingsAiTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.0-flash-exp:free")
  const [isEnabled, setIsEnabled] = useState(true)
  const [systemPromptExtra, setSystemPromptExtra] = useState("")
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  // 取得設定
  const { data: settings, isLoading } = useQuery<AiSettingsData>({
    queryKey: ["/api/ai/settings"],
  })

  // 取得模型清單
  const { data: models = [] } = useQuery<ModelOption[]>({
    queryKey: ["/api/ai/models"],
  })

  // 初始化表單
  useEffect(() => {
    if (settings) {
      setApiKey(settings.apiKeyMasked ?? "")
      setSelectedModel(settings.selectedModel ?? "google/gemini-2.0-flash-exp:free")
      setIsEnabled(settings.isEnabled ?? true)
      setSystemPromptExtra(settings.systemPromptExtra ?? "")
    }
  }, [settings])

  // 儲存設定
  const saveMutation = useMutation({
    mutationFn: (data: Partial<AiSettingsData & { apiKey: string }>) =>
      apiRequest("PUT", "/api/ai/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/settings"] })
      toast({ title: "儲存成功", description: "AI 設定已更新" })
    },
    onError: (err: Error) => {
      toast({ title: "儲存失敗", description: err.message, variant: "destructive" })
    },
  })

  const handleSave = () => {
    saveMutation.mutate({
      apiKey: apiKey.includes("••••") ? undefined as unknown as string : apiKey,
      selectedModel,
      isEnabled,
      systemPromptExtra: systemPromptExtra || undefined,
    })
  }

  // 測試連線
  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await apiRequest<{ success: boolean; message: string; model: string }>(
        "POST", "/api/ai/test-connection", {}
      )
      setTestResult({ success: true, message: `✅ ${result.message}（${result.model}）` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "連線失敗"
      setTestResult({ success: false, message: `❌ ${msg}` })
    } finally {
      setIsTesting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">AI 助手設定</h3>
          <p className="text-sm text-gray-500">透過 OpenRouter 統一調用各大 AI 模型</p>
        </div>
      </div>

      {/* API Key 設定 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">API 金鑰</CardTitle>
          <CardDescription>
            前往{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              openrouter.ai/keys
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>{" "}
            取得免費 API Key（免費模型不收費）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="api-key">OpenRouter API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-xxxxxxxxxxxx"
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {settings?.apiKeyMasked && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                已設定 API Key（顯示遮蔽版本）
              </p>
            )}
          </div>

          {/* 模型選擇 */}
          <div className="space-y-1.5">
            <Label>AI 模型</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-xs text-gray-500 font-medium">免費模型</div>
                {models.filter((m) => m.free).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <span>{m.name}</span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-green-100 text-green-700">免費</Badge>
                    </div>
                  </SelectItem>
                ))}
                <div className="px-2 py-1 text-xs text-gray-500 font-medium border-t mt-1 pt-2">付費模型</div>
                {models.filter((m) => !m.free).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              推薦：Gemini 2.0 Flash（免費、支援圖片辨識）
            </p>
          </div>

          {/* 測試連線 */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isTesting || !apiKey}
            >
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              )}
              {isTesting ? "測試中…" : "測試連線"}
            </Button>
            {testResult && (
              <span className={`text-sm flex items-center gap-1 ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                {testResult.success
                  ? <CheckCircle2 className="w-3.5 h-3.5" />
                  : <AlertCircle className="w-3.5 h-3.5" />
                }
                {testResult.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 功能開關 */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">啟用 AI 助手</p>
              <p className="text-xs text-gray-500">在所有頁面右下角顯示 AI 助手按鈕</p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          {/* 自訂系統提示詞 */}
          <div className="space-y-1.5">
            <Label htmlFor="extra-prompt">
              補充說明（進階）
              <span className="text-gray-400 font-normal ml-1">可選</span>
            </Label>
            <Textarea
              id="extra-prompt"
              value={systemPromptExtra}
              onChange={(e) => setSystemPromptExtra(e.target.value)}
              placeholder="例：我們的主要民宿專案是浯島文旅、浯島輕旅。..."
              className="text-sm resize-none"
              rows={3}
            />
            <p className="text-xs text-gray-500">
              補充業務相關資訊，讓 AI 更了解你的情況
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 儲存 */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          儲存設定
        </Button>
      </div>

      {/* 說明 */}
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="pt-4 text-sm text-gray-600 space-y-2">
          <p className="font-medium text-gray-700">📌 使用說明</p>
          <ul className="space-y-1 list-disc list-inside text-xs">
            <li>免費模型（Gemini 2.0 Flash）已足夠使用，不需付費</li>
            <li>AI 助手按鈕在右下角浮動選單中（點 + 展開）</li>
            <li>可詢問薪資計算、查詢收入、幫助登打資料等</li>
            <li>上傳圖片可辨識帳單/收據（需支援視覺的模型）</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
