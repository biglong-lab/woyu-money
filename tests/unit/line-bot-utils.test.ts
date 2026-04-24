/**
 * LINE Bot utils 單元測試
 *
 * 測試範圍：
 * - buildDailyDigestMessage：建立每日推播訊息
 * - parseReplyCommand：解析使用者回覆（1 / 1 延 3 / help）
 */

import { describe, it, expect } from "vitest"
import {
  buildDailyDigestMessage,
  parseReplyCommand,
  type DailyItem,
  type ParsedCommand,
} from "@shared/line-bot-utils"

const ITEMS: DailyItem[] = [
  {
    id: 101,
    itemName: "勞健保 3 月",
    unpaidAmount: 120000,
    daysOverdue: 10,
    urgency: "critical",
  },
  {
    id: 102,
    itemName: "電費 4 月",
    unpaidAmount: 12300,
    daysOverdue: 0,
    urgency: "high",
  },
]

describe("buildDailyDigestMessage", () => {
  it("空清單應回傳 single text message", () => {
    const msg = buildDailyDigestMessage([], new Date("2026-04-25"))
    expect(msg.type).toBe("text")
    if (msg.type === "text") {
      expect(msg.text).toMatch(/沒有|暫無|✅/)
    }
  })

  it("有項目應產生 text 訊息並含項目名稱與金額", () => {
    const msg = buildDailyDigestMessage(ITEMS, new Date("2026-04-25"))
    expect(msg.type).toBe("text")
    if (msg.type === "text") {
      expect(msg.text).toContain("勞健保 3 月")
      expect(msg.text).toContain("120,000")
      expect(msg.text).toContain("電費 4 月")
    }
  })

  it("訊息應含日期", () => {
    const msg = buildDailyDigestMessage(ITEMS, new Date("2026-04-25"))
    if (msg.type === "text") {
      expect(msg.text).toContain("4/25")
    }
  })

  it("訊息應含總額", () => {
    const msg = buildDailyDigestMessage(ITEMS, new Date("2026-04-25"))
    if (msg.type === "text") {
      expect(msg.text).toContain("132,300")
    }
  })

  it("逾期項目應顯示天數", () => {
    const msg = buildDailyDigestMessage(ITEMS, new Date("2026-04-25"))
    if (msg.type === "text") {
      expect(msg.text).toMatch(/逾期.*10/)
    }
  })

  it("訊息應包含回覆說明（回覆「1」= 已付款）", () => {
    const msg = buildDailyDigestMessage(ITEMS, new Date("2026-04-25"))
    if (msg.type === "text") {
      expect(msg.text).toContain("回覆")
      expect(msg.text).toContain("已付款")
    }
  })
})

describe("parseReplyCommand", () => {
  it("純數字 「1」 → mark_paid index 1", () => {
    const cmd = parseReplyCommand("1")
    expect(cmd.type).toBe("mark_paid")
    if (cmd.type === "mark_paid") {
      expect(cmd.index).toBe(1)
      expect(cmd.deferDays).toBeUndefined()
    }
  })

  it("「2」 → mark_paid index 2", () => {
    const cmd = parseReplyCommand("2")
    expect(cmd.type).toBe("mark_paid")
    if (cmd.type === "mark_paid") expect(cmd.index).toBe(2)
  })

  it("「1 延 3」 → defer index 1 days 3", () => {
    const cmd = parseReplyCommand("1 延 3")
    expect(cmd.type).toBe("defer")
    if (cmd.type === "defer") {
      expect(cmd.index).toBe(1)
      expect(cmd.deferDays).toBe(3)
    }
  })

  it("「1 延3」無空格也應解析", () => {
    const cmd = parseReplyCommand("1 延3")
    expect(cmd.type).toBe("defer")
    if (cmd.type === "defer") {
      expect(cmd.index).toBe(1)
      expect(cmd.deferDays).toBe(3)
    }
  })

  it("「help」 → help command", () => {
    const cmd = parseReplyCommand("help")
    expect(cmd.type).toBe("help")
  })

  it("「？」 → help command", () => {
    const cmd = parseReplyCommand("？")
    expect(cmd.type).toBe("help")
  })

  it("「?」 → help command", () => {
    const cmd = parseReplyCommand("?")
    expect(cmd.type).toBe("help")
  })

  it("空字串 → unknown", () => {
    const cmd = parseReplyCommand("")
    expect(cmd.type).toBe("unknown")
  })

  it("亂打文字 → unknown", () => {
    const cmd = parseReplyCommand("asdfgh")
    expect(cmd.type).toBe("unknown")
  })

  it("前後空白應被移除", () => {
    const cmd = parseReplyCommand("  1  ")
    expect(cmd.type).toBe("mark_paid")
    if (cmd.type === "mark_paid") expect(cmd.index).toBe(1)
  })

  it("index 0 或負數應為 unknown", () => {
    expect(parseReplyCommand("0").type).toBe("unknown")
    expect(parseReplyCommand("-1").type).toBe("unknown")
  })

  it("index 超過 99 應為 unknown（防呆）", () => {
    expect(parseReplyCommand("100").type).toBe("unknown")
  })

  it("延後天數為 0 應為 unknown", () => {
    const cmd = parseReplyCommand("1 延 0")
    expect(cmd.type).toBe("unknown")
  })

  it("延後天數超過 30 應為 unknown（防呆）", () => {
    const cmd = parseReplyCommand("1 延 60")
    expect(cmd.type).toBe("unknown")
  })

  it("回傳型別對於 ParsedCommand", () => {
    const cmd: ParsedCommand = parseReplyCommand("1")
    expect(["mark_paid", "defer", "help", "unknown"]).toContain(cmd.type)
  })
})
