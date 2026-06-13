/**
 * 分攤對話框：勾選月份，把某類別金額平均攤到勾選的月份
 */
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

export function DistributeDialog({
  category,
  defaultAmount,
  months,
  onClose,
  onConfirm,
  isPending,
}: {
  category: string
  defaultAmount: number
  months: string[]
  onClose: () => void
  onConfirm: (amount: number, selectedMonths: string[]) => void
  isPending?: boolean
}) {
  const [amount, setAmount] = useState(String(Math.round(defaultAmount)))
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    setAmount(String(Math.round(defaultAmount)))
  }, [defaultAmount])

  const amt = parseFloat(amount) || 0
  const per = selected.size > 0 ? amt / selected.size : 0

  function toggle(m: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>分攤「{category}」</DialogTitle>
          <DialogDescription>勾選要分攤的月份，金額將平均攤入</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>分攤總金額</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">勾選月份（{selected.size} 個月）</Label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {months.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggle(m)}
                  className={`text-xs px-2 py-1.5 rounded border ${
                    selected.has(m)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "hover:bg-muted"
                  }`}
                >
                  {m.replace("-", "/")}
                </button>
              ))}
            </div>
          </div>
          {selected.size > 0 && (
            <p className="text-sm text-muted-foreground">
              每月約 <span className="font-bold text-indigo-600">{fmt(per)}</span>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => onConfirm(amt, Array.from(selected).sort())}
            disabled={isPending || selected.size === 0 || amt <= 0}
          >
            {isPending ? "分攤中…" : "平均攤入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
