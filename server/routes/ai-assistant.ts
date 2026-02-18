/**
 * AI 助手路由
 *
 * 提供 OpenRouter 串流對話、工具調用（Function Calling）功能
 * 工具包含：查詢員工、計算薪資、查詢收入、新增員工/收款等
 */

import { Router } from "express"
import OpenAI from "openai"
import { asyncHandler, AppError } from "../middleware/error-handler"
import {
  getAiSettings,
  getAiSettingsMasked,
  updateAiSettings,
} from "../storage/ai-settings"
import {
  getEmployees,
  createEmployee,
  getEmployee,
} from "../storage/hr-costs"
import { calculateInsurance } from "../../shared/insurance-utils"
import { db } from "../db"
import { dailyRevenues, paymentProjects, paymentRecords, incomeWebhooks, incomeSources } from "@shared/schema"
import { sql, and, gte, lte, desc } from "drizzle-orm"
import { z } from "zod"

const router = Router()

// 自訂工具調用型別（相容 openai v5+）
interface ToolCallItem {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

// ─────────────────────────────────────────────
// OpenRouter 可用模型清單
// ─────────────────────────────────────────────

export const AVAILABLE_MODELS = [
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash（免費）", free: true },
  { id: "google/gemini-2.5-pro-exp-03-25:free", name: "Gemini 2.5 Pro（免費）", free: true },
  { id: "meta-llama/llama-4-maverick:free", name: "Llama 4 Maverick（免費）", free: true },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", free: false },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku（快速）", free: false },
  { id: "openai/gpt-4o", name: "GPT-4o", free: false },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini（快速）", free: false },
  { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash", free: false },
]

// ─────────────────────────────────────────────
// AI 系統提示詞
// ─────────────────────────────────────────────

function buildSystemPrompt(extraPrompt?: string | null): string {
  const today = new Date().toLocaleDateString("zh-TW", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  })

  const base = `你是浯島財務管理系統的 AI 助手，專精於台灣民宿業財務管理。
今天是 ${today}。

## 你的能力
- 查詢員工資料清單
- 計算薪資與勞健保費用（含雇主/員工各自負擔）
- 查詢本月或指定時段的收入統計
- 查詢每月收入趨勢
- 查詢付款記錄
- 新增員工資料（需逐步確認必填欄位）
- 新增每日收款記錄（需確認日期/金額/專案）

## 重要規則
1. **寫入操作前必須確認**：呼叫 create_employee 或 create_daily_revenue 前，必須先確認用戶已提供所有必填欄位
2. **薪資計算格式**：以清楚的 Markdown 表格呈現，含月薪、勞保（員工/雇主）、健保（員工/雇主）、勞退（員工自提/雇主）、實領金額、雇主實際成本
3. **語言**：一律使用繁體中文回答
4. **金額格式**：台幣顯示，加千分位逗號（例：$32,000）

## 新增員工必填欄位
- 姓名（employeeName）
- 月薪（monthlySalary，例：35000）
- 到職日期（hireDate，格式：YYYY-MM-DD）
- 職稱（position，可選，預設省略）
- 眷屬人數（dependentsCount，可選，預設 0）

## 新增收款必填欄位
- 日期（date，格式：YYYY-MM-DD）
- 金額（amount，例：15000）
- 專案（projectId，需先告知用戶可用的專案清單）`

  return extraPrompt ? `${base}\n\n## 補充說明\n${extraPrompt}` : base
}

// ─────────────────────────────────────────────
// 工具定義（Function Calling）
// ─────────────────────────────────────────────

const AI_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_employees",
      description: "取得員工清單，可篩選在職/離職",
      parameters: {
        type: "object",
        properties: {
          activeOnly: {
            type: "boolean",
            description: "true=只顯示在職員工，false=全部，預設 true",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_salary",
      description: "計算薪資的勞健保費用，回傳員工負擔、雇主負擔、實領金額等明細",
      parameters: {
        type: "object",
        required: ["monthlySalary"],
        properties: {
          monthlySalary: {
            type: "number",
            description: "月薪（台幣，例：32000）",
          },
          dependentsCount: {
            type: "number",
            description: "眷屬人數，影響健保費，預設 0",
          },
          voluntaryPensionRate: {
            type: "number",
            description: "員工自願提繳比例 0~6，預設 0",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_revenue_stats",
      description: "取得指定時間範圍的收入統計（含手動收款和系統同步的收款）",
      parameters: {
        type: "object",
        properties: {
          startDate: {
            type: "string",
            description: "開始日期，格式 YYYY-MM-DD，不填則當月 1 號",
          },
          endDate: {
            type: "string",
            description: "結束日期，格式 YYYY-MM-DD，不填則今天",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_monthly_trend",
      description: "取得近幾個月的月度收入趨勢",
      parameters: {
        type: "object",
        properties: {
          months: {
            type: "number",
            description: "要查詢的月數，預設 6 個月",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payment_records",
      description: "查詢付款記錄（支出）",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "筆數上限，預設 10",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_employee",
      description: "新增員工資料（必須先確認用戶已提供姓名、月薪、到職日期）",
      parameters: {
        type: "object",
        required: ["employeeName", "monthlySalary", "hireDate"],
        properties: {
          employeeName: { type: "string", description: "員工姓名" },
          monthlySalary: { type: "number", description: "月薪（台幣）" },
          hireDate: { type: "string", description: "到職日期 YYYY-MM-DD" },
          position: { type: "string", description: "職稱（可選）" },
          dependentsCount: { type: "number", description: "眷屬人數，預設 0" },
          voluntaryPensionRate: { type: "number", description: "自願提繳率 0~6，預設 0" },
          notes: { type: "string", description: "備註（可選）" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_daily_revenue",
      description: "新增每日收款記錄（必須先確認日期、金額，並告知用戶可用專案）",
      parameters: {
        type: "object",
        required: ["date", "amount", "projectId"],
        properties: {
          date: { type: "string", description: "收款日期 YYYY-MM-DD" },
          amount: { type: "number", description: "收款金額（台幣）" },
          projectId: { type: "number", description: "專案 ID（需先查詢可用專案）" },
          description: { type: "string", description: "說明（可選）" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_projects",
      description: "取得可用的收款專案清單（新增收款前需先查詢）",
      parameters: { type: "object", properties: {} },
    },
  },
]

// ─────────────────────────────────────────────
// 工具執行函式
// ─────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_employees": {
      const activeOnly = args.activeOnly !== false
      const list = await getEmployees()
      const filtered = activeOnly ? list.filter((e) => e.isActive) : list
      return filtered.map((e) => ({
        id: e.id,
        name: e.employeeName,
        position: e.position,
        monthlySalary: Number(e.monthlySalary),
        hireDate: e.hireDate,
        isActive: e.isActive,
        dependentsCount: e.dependentsCount,
      }))
    }

    case "calculate_salary": {
      const salary = Number(args.monthlySalary)
      const deps = Number(args.dependentsCount ?? 0)
      const pension = Number(args.voluntaryPensionRate ?? 0)
      const result = calculateInsurance({
        monthlySalary: salary,
        dependentsCount: deps,
        voluntaryPensionRate: pension,
      })
      return {
        monthlySalary: salary,
        employeeLaborInsurance: result.employeeLaborInsurance,
        employeeHealthInsurance: result.employeeHealthInsurance,
        employeePension: result.employeePension,
        employeeTotal: result.employeeTotal,
        netSalary: result.netSalary,
        employerLaborInsurance: result.employerLaborInsurance,
        employerHealthInsurance: result.employerHealthInsurance,
        employerPension: result.employerPension,
        employerTotal: result.employerTotal,
        totalCost: result.totalCost,
      }
    }

    case "get_revenue_stats": {
      const now = new Date()
      const startDate = (args.startDate as string | undefined) ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
      const endDate = (args.endDate as string | undefined) ||
        now.toISOString().slice(0, 10)

      const result = await db.execute(sql`
        SELECT
          SUM(amount::numeric) AS total,
          COUNT(*) AS records,
          MIN(date::text) AS min_date,
          MAX(date::text) AS max_date
        FROM daily_revenues
        WHERE date >= ${startDate}::date
          AND date <= ${endDate}::date
      `)
      const webhookResult = await db.execute(sql`
        SELECT
          SUM(iw.parsed_amount_twd::numeric) AS total,
          COUNT(*) AS records
        FROM income_webhooks iw
        WHERE iw.status IN ('pending', 'confirmed')
          AND (iw.raw_payload->>'date')::date >= ${startDate}::date
          AND (iw.raw_payload->>'date')::date <= ${endDate}::date
      `)

      const manualTotal = Number(result.rows[0]?.total ?? 0)
      const webhookTotal = Number(webhookResult.rows[0]?.total ?? 0)
      return {
        period: { startDate, endDate },
        manual: { total: manualTotal, records: Number(result.rows[0]?.records ?? 0) },
        webhook: { total: webhookTotal, records: Number(webhookResult.rows[0]?.records ?? 0) },
        combined: { total: manualTotal + webhookTotal },
      }
    }

    case "get_monthly_trend": {
      const months = Number(args.months ?? 6)
      const result = await db.execute(sql`
        SELECT
          TO_CHAR(date, 'YYYY-MM') AS month,
          SUM(amount::numeric) AS manual_total,
          COUNT(*) AS records
        FROM daily_revenues
        WHERE date >= CURRENT_DATE - INTERVAL '1 month' * ${months}
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT ${months}
      `)
      return result.rows.map((r) => ({
        month: r.month,
        total: Number(r.manual_total),
        records: Number(r.records),
      }))
    }

    case "get_payment_records": {
      const limit = Number(args.limit ?? 10)
      const result = await db.execute(sql`
        SELECT
          pr.id,
          pr.amount_paid,
          pr.payment_date,
          pr.payment_method,
          pi.item_name
        FROM payment_records pr
        LEFT JOIN payment_items pi ON pi.id = pr.item_id
        ORDER BY pr.payment_date DESC
        LIMIT ${limit}
      `)
      return result.rows.map((r) => ({
        id: r.id,
        amount: Number(r.amount_paid),
        date: r.payment_date,
        method: r.payment_method,
        itemName: r.item_name,
      }))
    }

    case "get_projects": {
      const result = await db.execute(sql`
        SELECT id, project_name, project_code, description
        FROM payment_projects
        WHERE is_active = true OR is_active IS NULL
        ORDER BY project_name
        LIMIT 20
      `)
      return result.rows
    }

    case "create_employee": {
      const schema = z.object({
        employeeName: z.string().min(1),
        monthlySalary: z.number().positive(),
        hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
        position: z.string().optional(),
        dependentsCount: z.number().int().min(0).optional(),
        voluntaryPensionRate: z.number().min(0).max(6).optional(),
        notes: z.string().optional(),
      })
      const data = schema.parse(args)
      const employee = await createEmployee({
        employeeName: data.employeeName,
        monthlySalary: String(data.monthlySalary),
        hireDate: data.hireDate,
        position: data.position ?? null,
        dependentsCount: data.dependentsCount ?? 0,
        voluntaryPensionRate: String(data.voluntaryPensionRate ?? 0),
        notes: data.notes ?? null,
        isActive: true,
      })
      return { success: true, employee }
    }

    case "create_daily_revenue": {
      const schema = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
        amount: z.number().positive(),
        projectId: z.number().int().positive(),
        description: z.string().optional(),
      })
      const data = schema.parse(args)
      const result = await db.execute(sql`
        INSERT INTO daily_revenues (date, amount, project_id, description, created_at)
        VALUES (
          ${data.date}::date,
          ${data.amount},
          ${data.projectId},
          ${data.description ?? null},
          NOW()
        )
        RETURNING id, date, amount::text, project_id, description
      `)
      return { success: true, record: result.rows[0] }
    }

    default:
      throw new Error(`未知工具：${name}`)
  }
}

// ─────────────────────────────────────────────
// GET /api/ai/settings
// ─────────────────────────────────────────────

router.get(
  "/api/ai/settings",
  asyncHandler(async (_req, res) => {
    const settings = await getAiSettingsMasked()
    res.json(settings)
  })
)

// ─────────────────────────────────────────────
// PUT /api/ai/settings
// ─────────────────────────────────────────────

router.put(
  "/api/ai/settings",
  asyncHandler(async (req, res) => {
    const body = req.body as {
      apiKey?: string
      selectedModel?: string
      isEnabled?: boolean
      systemPromptExtra?: string
    }

    // 如果 apiKey 包含遮蔽符號，不更新 key
    const updateData: Parameters<typeof updateAiSettings>[0] = {}
    if (body.apiKey !== undefined && !body.apiKey.includes("••••")) {
      updateData.apiKey = body.apiKey || null
    }
    if (body.selectedModel !== undefined) updateData.selectedModel = body.selectedModel
    if (body.isEnabled !== undefined) updateData.isEnabled = body.isEnabled
    if (body.systemPromptExtra !== undefined) {
      updateData.systemPromptExtra = body.systemPromptExtra || null
    }

    const updated = await updateAiSettings(updateData)
    const { apiKey: _k, ...rest } = updated
    res.json({ ...rest, apiKeyMasked: _k ? _k.substring(0, 8) + "••••" + _k.slice(-4) : null })
  })
)

// ─────────────────────────────────────────────
// GET /api/ai/models
// ─────────────────────────────────────────────

router.get(
  "/api/ai/models",
  asyncHandler(async (_req, res) => {
    res.json(AVAILABLE_MODELS)
  })
)

// ─────────────────────────────────────────────
// POST /api/ai/test-connection
// ─────────────────────────────────────────────

router.post(
  "/api/ai/test-connection",
  asyncHandler(async (_req, res) => {
    const settings = await getAiSettings()
    if (!settings.apiKey) {
      throw new AppError(400, "尚未設定 API Key")
    }

    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:5001",
        "X-Title": "浯島財務管理系統",
      },
    })

    const response = await client.chat.completions.create({
      model: settings.selectedModel ?? "google/gemini-2.0-flash-exp:free",
      messages: [{ role: "user", content: "請回答「連線成功」這四個字" }],
      max_tokens: 20,
    })

    const content = response.choices[0]?.message?.content ?? ""
    res.json({ success: true, message: content, model: settings.selectedModel })
  })
)

// ─────────────────────────────────────────────
// POST /api/ai/chat/stream
// SSE 串流對話（含工具調用循環）
// ─────────────────────────────────────────────

router.post(
  "/api/ai/chat/stream",
  asyncHandler(async (req, res) => {
    const { messages, imageBase64, imageMimeType } = req.body as {
      messages: OpenAI.Chat.ChatCompletionMessageParam[]
      imageBase64?: string
      imageMimeType?: string
    }

    const settings = await getAiSettings()
    if (!settings.apiKey) {
      throw new AppError(400, "尚未設定 AI API Key，請至設定頁面配置")
    }
    if (!settings.isEnabled) {
      throw new AppError(400, "AI 助手已停用")
    }

    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:5001",
        "X-Title": "浯島財務管理系統",
      },
    })

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")

    const sendEvent = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    // 建立訊息陣列
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt(settings.systemPromptExtra) },
      ...messages,
    ]

    // 如果有圖片，附加到最後一則用戶訊息
    if (imageBase64 && messages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1]
      if (lastMsg.role === "user") {
        const mimeType = (imageMimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp") ?? "image/jpeg"
        chatMessages[chatMessages.length - 1] = {
          role: "user",
          content: [
            { type: "text", text: typeof lastMsg.content === "string" ? lastMsg.content : "" },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        }
      }
    }

    // 工具調用循環（最多 5 輪）
    for (let round = 0; round < 5; round++) {
      let assistantContent = ""
      const toolCalls: ToolCallItem[] = []
      let currentToolCall: {
        id: string; name: string; argsRaw: string
      } | null = null

      try {
        const stream = await client.chat.completions.create({
          model: settings.selectedModel ?? "google/gemini-2.0-flash-exp:free",
          messages: chatMessages,
          tools: AI_TOOLS,
          tool_choice: "auto",
          stream: true,
        })

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta
          if (!delta) continue

          // 文字 delta
          if (delta.content) {
            assistantContent += delta.content
            sendEvent({ type: "delta", content: delta.content })
          }

          // 工具調用 delta
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined && tc.function?.name) {
                // 開始新的工具調用
                currentToolCall = {
                  id: tc.id ?? `tc_${Date.now()}`,
                  name: tc.function.name,
                  argsRaw: tc.function.arguments ?? "",
                }
              } else if (currentToolCall && tc.function?.arguments) {
                currentToolCall.argsRaw += tc.function.arguments
              }
            }
          }

          // 完成原因
          const finishReason = chunk.choices[0]?.finish_reason
          if (finishReason === "tool_calls" && currentToolCall) {
            toolCalls.push({
              id: currentToolCall.id,
              type: "function",
              function: {
                name: currentToolCall.name,
                arguments: currentToolCall.argsRaw,
              },
            })
            currentToolCall = null
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI 請求失敗"
        sendEvent({ type: "error", message: msg })
        res.end()
        return
      }

      // 沒有工具調用 → 對話結束
      if (toolCalls.length === 0) {
        sendEvent({ type: "done" })
        res.end()
        return
      }

      // 有工具調用 → 執行工具，繼續對話
      chatMessages.push({
        role: "assistant",
        content: assistantContent || null,
        tool_calls: toolCalls as OpenAI.Chat.ChatCompletionMessageToolCall[],
      })

      const toolResults: { role: "tool"; tool_call_id: string; content: string }[] = []
      for (const tc of toolCalls) {
        sendEvent({ type: "tool_start", toolName: tc.function.name, args: JSON.parse(tc.function.arguments) })
        try {
          const result = await executeTool(tc.function.name, JSON.parse(tc.function.arguments))
          sendEvent({ type: "tool_result", toolName: tc.function.name, result })
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          })
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "工具執行失敗"
          sendEvent({ type: "tool_error", toolName: tc.function.name, error: errMsg })
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: errMsg }),
          })
        }
      }
      chatMessages.push(...toolResults)
    }

    // 超過最大輪數
    sendEvent({ type: "error", message: "工具調用輪數超限" })
    res.end()
  })
)

export default router
