/**
 * 標籤 / 館別 / 銀行管理對話框
 * 銀行多一欄手續費率（%），用來推估可能到帳金額
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
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
import { Tag, Building2, CreditCard, Plus, Trash2 } from "lucide-react"
import type { Option, BankOption } from "./shared"

export function OptionsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>標籤 / 館別 / 銀行管理</DialogTitle>
          <DialogDescription>可新增請款標籤、館別；銀行可設手續費率（推估到帳）</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <OptionList
            title="請款標籤"
            icon={<Tag className="h-4 w-4" />}
            endpoint="/api/card-claims/tags"
          />
          <OptionList
            title="館別"
            icon={<Building2 className="h-4 w-4" />}
            endpoint="/api/card-claims/properties"
          />
          <BankManager />
        </div>
        <DialogFooter>
          <Button onClick={onClose}>關閉</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OptionList({
  title,
  icon,
  endpoint,
}: {
  title: string
  icon: React.ReactNode
  endpoint: string
}) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const { data: items = [] } = useQuery<Option[]>({ queryKey: [endpoint] })
  const refresh = () => queryClient.invalidateQueries({ queryKey: [endpoint] })

  const addMut = useMutation({
    mutationFn: () => apiRequest("POST", endpoint, { name }),
    onSuccess: () => {
      setName("")
      refresh()
      toast({ title: "已新增" })
    },
    onError: (e: Error) =>
      toast({ title: "新增失敗", description: e.message, variant: "destructive" }),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `${endpoint}/${id}`),
    onSuccess: () => {
      refresh()
      toast({ title: "已移除" })
    },
  })

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center gap-2 font-medium mb-2">
        {icon}
        {title}
      </div>
      <div className="flex gap-1 mb-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新增…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) addMut.mutate()
          }}
        />
        <Button
          size="sm"
          onClick={() => name.trim() && addMut.mutate()}
          disabled={addMut.isPending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between text-sm py-1">
            <span>{it.name}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => delMut.mutate(it.id)}
            >
              <Trash2 className="h-3 w-3 text-red-400" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function BankManager() {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [fee, setFee] = useState("")
  const { data: banks = [] } = useQuery<BankOption[]>({ queryKey: ["/api/card-claims/banks"] })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/card-claims/banks"] })

  const addMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/card-claims/banks", { name, feeRate: fee || "0" }),
    onSuccess: () => {
      setName("")
      setFee("")
      refresh()
      toast({ title: "已新增銀行" })
    },
    onError: (e: Error) =>
      toast({ title: "新增失敗", description: e.message, variant: "destructive" }),
  })
  const feeMut = useMutation({
    mutationFn: (p: { id: number; feeRate: string }) =>
      apiRequest("PATCH", `/api/card-claims/banks/${p.id}`, { feeRate: p.feeRate }),
    onSuccess: () => {
      refresh()
      toast({ title: "已更新費率" })
    },
  })
  const delMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/card-claims/banks/${id}`),
    onSuccess: () => refresh(),
  })

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center gap-2 font-medium mb-2">
        <CreditCard className="h-4 w-4" />
        刷卡銀行
      </div>
      <div className="flex gap-1 mb-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="銀行名"
          className="flex-1"
        />
        <Input
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          placeholder="費率%"
          type="number"
          className="w-16"
        />
        <Button
          size="sm"
          onClick={() => name.trim() && addMut.mutate()}
          disabled={addMut.isPending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {banks.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-1 text-sm py-1">
            <span className="flex-1 truncate">{b.name}</span>
            <Input
              type="number"
              defaultValue={b.feeRate ?? "0"}
              onBlur={(e) => {
                const v = e.target.value || "0"
                if (v !== (b.feeRate ?? "0")) feeMut.mutate({ id: b.id, feeRate: v })
              }}
              className="w-14 h-7 text-right px-1"
              title="手續費率 %"
            />
            <span className="text-xs text-muted-foreground">%</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => delMut.mutate(b.id)}
            >
              <Trash2 className="h-3 w-3 text-red-400" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
