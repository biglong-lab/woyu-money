/**
 * 欠款分類管理對話框（新增 / 移除）
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
import { Tag, Plus, Trash2 } from "lucide-react"
import type { Category } from "./shared"

const ENDPOINT = "/api/debts/categories"

export function CategoriesDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const { data: items = [] } = useQuery<Category[]>({ queryKey: [ENDPOINT] })

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("/api/debts"),
    })

  const addMut = useMutation({
    mutationFn: () => apiRequest("POST", ENDPOINT, { name }),
    onSuccess: () => {
      setName("")
      refresh()
      toast({ title: "已新增分類" })
    },
    onError: (e: Error) =>
      toast({ title: "新增失敗", description: e.message, variant: "destructive" }),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `${ENDPOINT}/${id}`),
    onSuccess: () => {
      refresh()
      toast({ title: "已移除分類" })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" /> 欠款分類管理
          </DialogTitle>
          <DialogDescription>新增或移除分類；移除不影響既有欠款的歷史紀錄</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1 mb-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="新增分類…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) addMut.mutate()
            }}
          />
          <Button onClick={() => name.trim() && addMut.mutate()} disabled={addMut.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between text-sm py-1 px-1">
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
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">尚無分類</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>關閉</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
