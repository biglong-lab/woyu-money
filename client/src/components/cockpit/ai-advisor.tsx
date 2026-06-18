/**
 * AI 財務顧問（駕駛艙頁內面板，不跳頁）
 *
 * 一鍵讓 AI（OpenRouter）讀取目前財務快照，產出《財務優化方案》：
 * 成本控管 / 收入提升 / 應付款分配。結果就地顯示，可重新產生、複製。
 */
import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bot, Sparkles, Copy, RefreshCw } from "lucide-react"

export interface AdvisorSnapshot {
  healthScore?: number
  healthLabel?: string
  monthIncome?: number
  monthExpense?: number
  monthProfit?: number | null
  totalUnpaid?: number
  counts?: Record<string, number>
  topPayables?: Array<{
    itemName: string
    unpaidAmount: number
    categoryLabel: string
    urgency: string
    daysOverdue?: number
    daysUntilDue?: number
    dailyLateFee?: number
  }>
  gaps?: Array<{
    year: number
    month: number
    estimatedIncome: number
    estimatedExpense: number
    net: number
    gap?: number
  }>
}

interface AdviceResponse {
  advice: string
  model: string
  generatedAt: string
}

export function AiAdvisor({ snapshot }: { snapshot: AdvisorSnapshot }) {
  const { toast } = useToast()
  const [result, setResult] = useState<AdviceResponse | null>(null)

  const [showHistory, setShowHistory] = useState(false)
  const { data: history = [] } = useQuery<
    Array<{ id: number; advice: string; model: string | null; createdAt: string }>
  >({ queryKey: ["/api/ai/financial-advice/history"] })

  const gen = useMutation<AdviceResponse>({
    mutationFn: () => apiRequest("POST", "/api/ai/financial-advice", { snapshot }),
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ["/api/ai/financial-advice/history"] })
    },
    onError: (e: Error) =>
      toast({ title: "產生建議失敗", description: e.message, variant: "destructive" }),
  })

  function copyAdvice() {
    if (result?.advice) {
      navigator.clipboard.writeText(result.advice)
      toast({ title: "已複製建議" })
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-600" />
            AI 財務顧問
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            讀取目前的健康分數、現況、應付款與現金缺口，產出可執行的《財務優化方案》（成本控管 /
            收入提升 / 應付款分配）。使用你在「設定 → AI 助手」設定的 OpenRouter 模型。
          </p>
        </CardHeader>
        <CardContent>
          {!result && (
            <Button onClick={() => gen.mutate()} disabled={gen.isPending} className="w-full">
              {gen.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> AI 分析中…（約 10-30 秒）
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" /> 產生財務優化方案
                </>
              )}
            </Button>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">模型：{result.model}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={copyAdvice}>
                    <Copy className="h-4 w-4 mr-1" /> 複製
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => gen.mutate()}
                    disabled={gen.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${gen.isPending ? "animate-spin" : ""}`} />
                    重新產生
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                {result.advice}
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ AI 建議僅供參考，請依實際情況判斷後執行。
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
