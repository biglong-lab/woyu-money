/**
 * AI 財務顧問 — POST /api/ai/financial-advice
 *
 * 接收前端彙整的財務快照（健康分數、現況、應付款、現金缺口、欠款），
 * 組成 prompt 呼叫 OpenRouter（重用既有 ai_settings），
 * 產出結構化《財務優化方案》：成本控管 / 收入提升 / 應付款分配。
 *
 * 低耦合：資料由已認證前端帶入，後端只負責組 prompt + 呼叫 AI。
 */
import { Router } from "express"
import OpenAI from "openai"
import { z } from "zod"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { getAiSettings } from "../storage/ai-settings"
import { db } from "../db"
import { financialAdviceLog } from "@shared/schema"
import { desc } from "drizzle-orm"

const router = Router()

// 歷史：最近 10 筆建議
router.get(
  "/api/ai/financial-advice/history",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: financialAdviceLog.id,
        advice: financialAdviceLog.advice,
        model: financialAdviceLog.model,
        createdAt: financialAdviceLog.createdAt,
      })
      .from(financialAdviceLog)
      .orderBy(desc(financialAdviceLog.createdAt))
      .limit(10)
    res.json(rows)
  })
)

const payableSchema = z.object({
  itemName: z.string(),
  unpaidAmount: z.number(),
  categoryLabel: z.string(),
  urgency: z.string(),
  daysOverdue: z.number().optional(),
  daysUntilDue: z.number().optional(),
  dailyLateFee: z.number().optional(),
})

const gapSchema = z.object({
  year: z.number(),
  month: z.number(),
  estimatedIncome: z.number(),
  estimatedExpense: z.number(),
  net: z.number(),
  gap: z.number().optional(),
})

const snapshotSchema = z.object({
  healthScore: z.number().optional(),
  healthLabel: z.string().optional(),
  monthIncome: z.number().optional(),
  monthExpense: z.number().optional(),
  monthProfit: z.number().nullable().optional(),
  totalUnpaid: z.number().optional(),
  counts: z.record(z.number()).optional(),
  topPayables: z.array(payableSchema).max(40).optional(),
  gaps: z.array(gapSchema).max(12).optional(),
})

const nt = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `NT$${Math.round(n).toLocaleString()}`

function buildPrompt(s: z.infer<typeof snapshotSchema>): string {
  const lines: string[] = []
  lines.push("以下是某民宿/旅館事業的即時財務快照，請據此提供可行的財務優化方案。")
  lines.push("")
  lines.push(`【財務健康】分數 ${s.healthScore ?? "—"}（${s.healthLabel ?? "—"}）`)
  lines.push(
    `【本月現況】收入 ${nt(s.monthIncome)}、成本 ${nt(s.monthExpense)}、淨利 ${nt(s.monthProfit ?? null)}`
  )
  lines.push(`【應付款總額】${nt(s.totalUnpaid)}`)
  if (s.counts) {
    lines.push(
      `【急迫度分佈】立刻付 ${s.counts.critical ?? 0} 筆、本週付 ${s.counts.high ?? 0} 筆、可延後 ${s.counts.medium ?? 0} 筆`
    )
  }
  if (s.topPayables && s.topPayables.length > 0) {
    lines.push("")
    lines.push("【主要應付款（已依優先級排序）】")
    s.topPayables.slice(0, 20).forEach((p) => {
      const timing =
        (p.daysOverdue ?? 0) > 0 ? `已逾期${p.daysOverdue}天` : `${p.daysUntilDue ?? "?"}天後到期`
      const late = (p.dailyLateFee ?? 0) > 0 ? `、每日滯納金${nt(p.dailyLateFee)}` : ""
      lines.push(`- ${p.itemName}（${p.categoryLabel}）${nt(p.unpaidAmount)}，${timing}${late}`)
    })
  }
  if (s.gaps && s.gaps.length > 0) {
    lines.push("")
    lines.push("【未來現金流預估】")
    s.gaps.forEach((g) => {
      const gapTxt = (g.gap ?? 0) > 0 ? `，缺口 ${nt(g.gap)}` : ""
      lines.push(
        `- ${g.year}/${String(g.month).padStart(2, "0")}：估收 ${nt(g.estimatedIncome)}、估支 ${nt(g.estimatedExpense)}、淨 ${nt(g.net)}${gapTxt}`
      )
    })
  }
  return lines.join("\n")
}

const SYSTEM_PROMPT = `你是一位專業的中小企業財務顧問，服務對象是台灣的民宿/旅館經營者。
請用繁體中文，根據提供的財務快照，產出一份「可行、具體、可立即執行」的財務優化方案。

務必分成以下三段，每段 3-5 個具體行動（含建議金額/順序/時間點）：

## 一、成本控管（省下來就是獲利）
- 指出可砍/可談判的成本，越具體越好（哪一筆、怎麼談、預估省多少）

## 二、收入提升
- 根據現況提出可行的增收方向（不要空泛口號，給可執行做法）

## 三、應付款分配與還款規劃
- 依急迫度與滯納金，建議未來幾個月「先付哪些、可延後哪些、哪些該分期」
- 特別注意有每日滯納金或強制執行風險的項目（勞健保/稅）要優先

最後用一句話總結「本月最該做的一件事」。
規則：金額用台幣加千分位；不要重複貼出原始數據；直接給建議。`

router.post(
  "/api/ai/financial-advice",
  asyncHandler(async (req, res) => {
    const parsed = snapshotSchema.safeParse(req.body?.snapshot ?? req.body)
    if (!parsed.success) {
      throw new AppError(400, "財務快照格式錯誤")
    }

    const settings = await getAiSettings()
    if (!settings.apiKey) {
      throw new AppError(400, "尚未設定 AI API Key（請至設定 → AI 助手設定）")
    }
    if (settings.isEnabled === false) {
      throw new AppError(400, "AI 助手目前為停用狀態")
    }

    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:5001",
        "X-Title": "WuDao Finance System",
      },
    })

    const primaryModel = settings.selectedModel ?? "google/gemma-3-27b-it:free"
    const fallbackModels = [
      "google/gemma-3-27b-it:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-3-12b-it:free",
    ].filter((m) => m !== primaryModel)
    const modelsToTry = [primaryModel, ...fallbackModels]

    const userPrompt = buildPrompt(parsed.data)
    let lastError: Error | null = null

    for (const model of modelsToTry) {
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 1500,
          temperature: 0.4,
        })
        const advice = response.choices[0]?.message?.content ?? ""
        if (!advice.trim()) {
          lastError = new Error("AI 回傳空內容")
          continue
        }
        // 存歷史（失敗不影響回應）
        try {
          await db
            .insert(financialAdviceLog)
            .values({ advice, model, snapshot: parsed.data })
        } catch {
          /* ignore */
        }
        return res.json({ advice, model, generatedAt: new Date().toISOString() })
      } catch (err: unknown) {
        const apiErr = err as { status?: number; error?: { code?: number } }
        const status = apiErr?.status ?? apiErr?.error?.code
        if (status === 429 || status === 404) {
          lastError = err as Error
          continue
        }
        throw err
      }
    }

    const msg = lastError?.message?.includes("rate-limited")
      ? "所有免費模型目前都被速率限制，請稍後再試或改用付費模型"
      : `AI 產生建議失敗：${lastError?.message ?? "未知錯誤"}`
    throw new AppError(503, msg)
  })
)

export default router
