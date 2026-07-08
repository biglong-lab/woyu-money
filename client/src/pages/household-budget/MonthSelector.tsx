// 月份切換下拉選單（近 6 個月 ~ 下個月、本月標記）
// 從原 household-budget.tsx 頁面標題列機械搬移
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface MonthSelectorProps {
  value: string
  onChange: (month: string) => void
}

/** 月份切換（-6 ~ +1 月、標示本月） */
export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(() => {
          const opts: string[] = []
          const now = new Date()
          for (let i = -6; i <= 1; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
            opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
          }
          const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
          return opts.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
              {m === cm ? "（本月）" : ""}
            </SelectItem>
          ))
        })()}
      </SelectContent>
    </Select>
  )
}
