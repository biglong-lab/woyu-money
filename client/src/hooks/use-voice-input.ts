/**
 * useVoiceInput — Web Speech API 語音輸入（家用記帳專用）
 *
 * 用法：
 *   const { isSupported, isListening, transcript, parsed, start, stop } = useVoiceInput()
 *   <button onMouseDown={start} onMouseUp={stop}>🎤 按住說話</button>
 *
 * 解析規則（zh-TW）：
 *  - 金額：找第一個阿拉伯數字 / 中文數字、後可接「元 / 塊」
 *  - 備註：把金額、單位字（元/塊/錢/個/份）、停頓詞清掉、剩下作備註
 *
 * 限制：
 *  - Chrome / Edge 桌面 + Chrome Android 支援
 *  - iOS Safari 不支援（會 isSupported=false）
 *  - 需 HTTPS（生產 OK）
 */
import { useState, useRef, useCallback, useEffect } from "react"

interface ParsedVoice {
  amount: string | null
  description: string
  raw: string
}

interface UseVoiceInputResult {
  isSupported: boolean
  isListening: boolean
  transcript: string
  parsed: ParsedVoice | null
  error: string | null
  start: () => void
  stop: () => void
  reset: () => void
}

// Web Speech API 在 TypeScript 內建 type 不完整、自定義型別
interface SpeechRecognitionEvent {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>
  resultIndex: number
}
interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getSpeechRecognition(): { new (): SpeechRecognitionInstance } | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: { new (): SpeechRecognitionInstance }
    webkitSpeechRecognition?: { new (): SpeechRecognitionInstance }
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

const ZH_NUMBERS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  百: 100,
  千: 1000,
  萬: 10000,
}

/**
 * 解析中文數字（限簡單版：十、二十、一百五、三百、五千、一萬）
 * 找不到回 null
 */
function parseChineseNumber(s: string): number | null {
  if (!s) return null
  // 嘗試先抓阿拉伯數字
  const arabic = s.match(/\d+(?:\.\d+)?/)
  if (arabic) return parseFloat(arabic[0])

  // 中文數字：簡單規則
  // 「兩百五」「三百五十」「一千兩百」
  let total = 0
  let current = 0
  let lastUnit = 1
  for (const ch of s) {
    const v = ZH_NUMBERS[ch]
    if (v === undefined) continue
    if (v >= 10) {
      // 單位
      if (current === 0) current = 1
      total += current * v
      current = 0
      lastUnit = v
    } else {
      current = v
    }
  }
  // 處理「三百五」這種末尾簡寫（五 → 50 if lastUnit=百）
  if (current > 0) {
    if (lastUnit >= 100) {
      total += current * (lastUnit / 10)
    } else {
      total += current
    }
  }
  return total > 0 ? total : null
}

/**
 * 解析語音轉錄為 amount + description
 */
function parseTranscript(raw: string): ParsedVoice {
  const text = raw.trim().replace(/\s+/g, " ")

  // 1. 找「N 元」「N 塊」金額
  let amount: number | null = null
  let amountMatchSrc = ""

  // 阿拉伯數字 + 元/塊/錢
  const arabicWithUnit = text.match(/(\d+(?:\.\d+)?)\s*[元塊錢]/)
  if (arabicWithUnit) {
    amount = parseFloat(arabicWithUnit[1])
    amountMatchSrc = arabicWithUnit[0]
  } else {
    // 中文數字 + 元/塊/錢
    const cnWithUnit = text.match(/([零一二兩三四五六七八九十百千萬]+)\s*[元塊錢]/)
    if (cnWithUnit) {
      const v = parseChineseNumber(cnWithUnit[1])
      if (v !== null) {
        amount = v
        amountMatchSrc = cnWithUnit[0]
      }
    } else {
      // 沒單位但有阿拉伯數字 → 第一個數字
      const justArabic = text.match(/\d+(?:\.\d+)?/)
      if (justArabic) {
        amount = parseFloat(justArabic[0])
        amountMatchSrc = justArabic[0]
      }
    }
  }

  // 2. 把金額部分從 raw 裡移除、再清掉雜音得備註
  let description = text
  if (amountMatchSrc) {
    description = description.replace(amountMatchSrc, " ")
  }
  // 清掉常見停頓詞 + 標點
  description = description
    .replace(/[，。、,.!?！？]/g, " ")
    .replace(/\b(花了|花費|買了|付了|花|買|付|是|的|啊|喔|嗯|啦)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return {
    amount: amount !== null ? String(amount) : null,
    description,
    raw,
  }
}

export function useVoiceInput(): UseVoiceInputResult {
  const SpeechRecognition = useRef(getSpeechRecognition())
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [parsed, setParsed] = useState<ParsedVoice | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isSupported = SpeechRecognition.current !== null

  const start = useCallback(() => {
    if (!isSupported || !SpeechRecognition.current) {
      setError("此裝置不支援語音輸入（請用 Chrome / Edge）")
      return
    }
    setError(null)
    setTranscript("")
    setParsed(null)
    try {
      const Cls = SpeechRecognition.current
      const rec = new Cls()
      rec.lang = "zh-TW"
      rec.continuous = false
      rec.interimResults = true
      rec.onresult = (e) => {
        let finalText = ""
        let interim = ""
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) finalText += r[0].transcript
          else interim += r[0].transcript
        }
        const live = finalText || interim
        setTranscript(live)
        if (finalText) {
          setParsed(parseTranscript(finalText))
        }
      }
      rec.onerror = (e) => {
        setError(`語音辨識錯誤：${e.error}`)
        setIsListening(false)
      }
      rec.onend = () => {
        setIsListening(false)
      }
      rec.start()
      recognitionRef.current = rec
      setIsListening(true)
    } catch (err) {
      setError(`啟動失敗：${(err as Error).message}`)
      setIsListening(false)
    }
  }, [isSupported])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const reset = useCallback(() => {
    setTranscript("")
    setParsed(null)
    setError(null)
  }, [])

  // unmount 時關掉
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          /* ignore */
        }
      }
    }
  }, [])

  return { isSupported, isListening, transcript, parsed, error, start, stop, reset }
}

// 給 unit test 用
export const _testHelpers = { parseTranscript, parseChineseNumber }
