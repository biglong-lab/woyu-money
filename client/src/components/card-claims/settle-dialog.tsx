/**
 * 到帳對話框：記錄實際到帳金額 + 到帳日（閉環）
 */
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
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
import { fmt, ymd, type Claim } from "./shared"

export function SettleDialog({
  claim,
  expected,
  onClose,
}: {
  claim: Claim
  expected: number
  onClose: () => void
}) {
  const { toast } = useToast()
  const [amount, setAmount] = useState(
    claim.settledAmount
      ? String(Math.round(Number(claim.settledAmount)))
      : String(Math.round(expected))
  )
  const [date, setDate] = useState(claim.settledDate ?? ymd(new Date()))

  const save = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/card-claims/${claim.id}`, {
        settledAmount: amount,
        settledDate: date,
        status: "settled",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/card-claims"),
      })
      toast({ title: "已記錄到帳" })
      onClose()
    },
    onError: (e: Error) =>
      toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  })

  const actual = parseFloat(amount) || 0
  const diff = actual - expected

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>記錄到帳</DialogTitle>
          <DialogDescription>
            結算金額 {fmt(Number(claim.amount))}，預估到帳 {fmt(expected)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>實際到帳金額</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>到帳日期</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="text-sm rounded-lg bg-muted/40 px-3 py-2">
            與預估差異：
            <span className={diff < 0 ? "text-red-600 font-medium" : "text-green-700 font-medium"}>
              {" "}
              {diff >= 0 ? "+" : ""}
              {fmt(diff)}
            </span>
            {diff < 0 && <span className="text-muted-foreground">（手續費比預估高）</span>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || actual <= 0}>
            {save.isPending ? "儲存中…" : "確認到帳"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
