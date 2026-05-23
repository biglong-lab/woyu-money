/**
 * AmountKeypad — 大鍵盤 + 計算機（家用記帳 Phase 2）
 *
 * 特點：
 *  - 3×4 grid 大按鈕、適合手機單手操作
 *  - 支援 + - × ÷ 運算（鏈式計算）
 *  - 表達式顯示在上方、按 = 才寫回 onChange
 *  - 直接打數字也即時更新 currentValue、可不用按 =
 *
 * 用法：
 *   <AmountKeypad value={amountStr} onChange={setAmountStr} onConfirm={handleSubmit} />
 */
import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Calculator, Delete } from "lucide-react"

type Op = "+" | "-" | "×" | "÷"

interface AmountKeypadProps {
  value: string
  onChange: (value: string) => void
  onConfirm?: () => void
  className?: string
}

function calc(left: number, op: Op, right: number): number {
  switch (op) {
    case "+":
      return left + right
    case "-":
      return left - right
    case "×":
      return left * right
    case "÷":
      return right === 0 ? left : left / right
  }
}

export function AmountKeypad({ value, onChange, onConfirm, className }: AmountKeypadProps) {
  const [display, setDisplay] = useState<string>(value || "0")
  const [pendingOp, setPendingOp] = useState<Op | null>(null)
  const [leftOperand, setLeftOperand] = useState<number | null>(null)
  const [justEvaluated, setJustEvaluated] = useState(false)
  const externalRef = useRef(value)

  // 外部 value 改變時同步 display（例如 AI 辨識自動填）
  useEffect(() => {
    if (value !== externalRef.current && value !== display) {
      setDisplay(value || "0")
      setPendingOp(null)
      setLeftOperand(null)
      externalRef.current = value
    }
  }, [value, display])

  const sync = useCallback(
    (next: string) => {
      setDisplay(next)
      externalRef.current = next
      onChange(next)
    },
    [onChange]
  )

  function pressDigit(d: string): void {
    if (justEvaluated) {
      sync(d === "." ? "0." : d)
      setJustEvaluated(false)
      return
    }
    if (display === "0" && d !== ".") {
      sync(d)
      return
    }
    if (d === "." && display.includes(".")) return
    if (display.length >= 12) return
    sync(display + d)
  }

  function pressBackspace(): void {
    if (justEvaluated) {
      sync("0")
      setJustEvaluated(false)
      return
    }
    if (display.length <= 1) {
      sync("0")
      return
    }
    sync(display.slice(0, -1))
  }

  function pressClear(): void {
    sync("0")
    setPendingOp(null)
    setLeftOperand(null)
    setJustEvaluated(false)
  }

  function pressOp(op: Op): void {
    const current = parseFloat(display) || 0
    if (leftOperand !== null && pendingOp !== null && !justEvaluated) {
      // 鏈式：先算前面的
      const next = calc(leftOperand, pendingOp, current)
      const rounded = Math.round(next * 100) / 100
      sync(String(rounded))
      setLeftOperand(rounded)
    } else {
      setLeftOperand(current)
    }
    setPendingOp(op)
    setJustEvaluated(false)
    // 標記下個 digit 要從新數字開始
    setDisplay(display) // 不變動、等下個輸入觸發 sync
  }

  function pressEqual(): void {
    if (leftOperand === null || pendingOp === null) {
      onConfirm?.()
      return
    }
    const current = parseFloat(display) || 0
    const result = calc(leftOperand, pendingOp, current)
    const rounded = Math.round(result * 100) / 100
    sync(String(rounded))
    setPendingOp(null)
    setLeftOperand(null)
    setJustEvaluated(true)
  }

  // 數字鍵被按時、如果剛按完 op，要從新開始
  const digitHandler = (d: string): void => {
    if (pendingOp !== null && leftOperand !== null && !justEvaluated) {
      // 等於說我們從新一個 operand 開始
      if (externalRef.current === display && !justEvaluated) {
        sync(d === "." ? "0." : d)
        return
      }
    }
    pressDigit(d)
  }

  // 表達式預覽
  const preview =
    leftOperand !== null && pendingOp !== null
      ? `${leftOperand} ${pendingOp} ${display === String(leftOperand) ? "" : display}`
      : ""

  const Btn = ({
    label,
    onClick,
    variant = "default",
    span = 1,
  }: {
    label: React.ReactNode
    onClick: () => void
    variant?: "default" | "op" | "primary" | "danger"
    span?: number
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl py-3 text-lg font-semibold select-none active:scale-95 transition-all border",
        span === 2 && "col-span-2",
        variant === "default" && "bg-white text-gray-900 border-gray-200 hover:bg-gray-50",
        variant === "op" && "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
        variant === "primary" &&
          "bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-600 shadow-sm",
        variant === "danger" && "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
      )}
      data-testid={`keypad-${typeof label === "string" ? label : ""}`}
    >
      {label}
    </button>
  )

  return (
    <div className={cn("rounded-xl bg-gray-50 p-2", className)}>
      {/* 表達式 + 結果 */}
      <div className="bg-white rounded-lg p-3 mb-2 border">
        {preview && <div className="text-xs text-gray-400 text-right truncate">{preview}</div>}
        <div className="text-3xl font-bold text-right truncate" data-testid="keypad-display">
          {display}
        </div>
      </div>

      {/* 3×5 grid */}
      <div className="grid grid-cols-4 gap-2">
        <Btn
          label={<Delete className="w-5 h-5 mx-auto" />}
          onClick={pressBackspace}
          variant="danger"
        />
        <Btn label="AC" onClick={pressClear} variant="danger" />
        <Btn label="÷" onClick={() => pressOp("÷")} variant="op" />
        <Btn label="×" onClick={() => pressOp("×")} variant="op" />

        <Btn label="7" onClick={() => digitHandler("7")} />
        <Btn label="8" onClick={() => digitHandler("8")} />
        <Btn label="9" onClick={() => digitHandler("9")} />
        <Btn label="-" onClick={() => pressOp("-")} variant="op" />

        <Btn label="4" onClick={() => digitHandler("4")} />
        <Btn label="5" onClick={() => digitHandler("5")} />
        <Btn label="6" onClick={() => digitHandler("6")} />
        <Btn label="+" onClick={() => pressOp("+")} variant="op" />

        <Btn label="1" onClick={() => digitHandler("1")} />
        <Btn label="2" onClick={() => digitHandler("2")} />
        <Btn label="3" onClick={() => digitHandler("3")} />
        <Btn
          label={
            <span className="flex items-center justify-center gap-1">
              <Calculator className="w-4 h-4" />=
            </span>
          }
          onClick={pressEqual}
          variant="primary"
        />

        <Btn label="0" onClick={() => digitHandler("0")} span={2} />
        <Btn label="." onClick={() => digitHandler(".")} />
        <Btn label="完成" onClick={() => onConfirm?.()} variant="primary" />
      </div>
    </div>
  )
}
