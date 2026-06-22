/**
 * 強執公文新增/編輯對話框
 * 支援多檔上傳 → OCR 逐張掃描 → 自動帶入欄位（可編輯）
 */
import { useState, useEffect } from "react"
import { useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Sparkles } from "lucide-react"

interface EnforcementCase {
  id: number
  caseNumber: string | null
  agency: string | null
  contactPhone: string | null
  subject: string | null
  totalAmount: string
  issuedDate: string | null
  notes: string | null
  attachments?: Array<{ url: string }>
}

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  editing?: EnforcementCase | null
}

const empty = {
  caseNumber: "",
  agency: "",
  contactPhone: "",
  subject: "",
  totalAmount: "",
  issuedDate: "",
  notes: "",
}

export default function EnforcementCaseDialog({ open, onOpenChange, editing }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState({ ...empty })
  const [attachments, setAttachments] = useState<Array<{ url: string }>>([])

  useEffect(() => {
    if (editing) {
      setForm({
        caseNumber: editing.caseNumber ?? "",
        agency: editing.agency ?? "",
        contactPhone: editing.contactPhone ?? "",
        subject: editing.subject ?? "",
        totalAmount: editing.totalAmount ?? "",
        issuedDate: editing.issuedDate ?? "",
        notes: editing.notes ?? "",
      })
      setAttachments(editing.attachments ?? [])
    } else {
      setForm({ ...empty })
      setAttachments([])
    }
  }, [editing, open])

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // OCR 掃描（多檔）
  const scanMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const fd = new FormData()
      Array.from(files).forEach((f) => fd.append("files", f))
      return apiRequest<{
        data: Partial<typeof empty> & { totalAmount?: number }
        attachments: Array<{ url: string }>
      }>("POST", "/api/enforcement/scan", fd)
    },
    onSuccess: (r) => {
      const d = r.data
      // 只填空欄位，不覆蓋使用者已輸入的
      setForm((f) => ({
        caseNumber: f.caseNumber || d.caseNumber || "",
        agency: f.agency || d.agency || "",
        contactPhone: f.contactPhone || d.contactPhone || "",
        subject: f.subject || d.subject || "",
        totalAmount: f.totalAmount || (d.totalAmount ? String(d.totalAmount) : ""),
        issuedDate: f.issuedDate || d.issuedDate || "",
        notes: f.notes,
      }))
      setAttachments((a) => [...a, ...r.attachments])
      toast({
        title: "✅ 已辨識帶入",
        description: `掃描 ${r.attachments.length} 張，請核對後儲存`,
      })
    },
    onError: (e: Error) =>
      toast({ title: "辨識失敗", description: e.message, variant: "destructive" }),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        issuedDate: form.issuedDate || null,
        attachments,
        attachmentUrl: attachments[0]?.url ?? null,
      }
      return editing
        ? apiRequest("PUT", `/api/enforcement/cases/${editing.id}`, payload)
        : apiRequest("POST", "/api/enforcement/cases", payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          (q.queryKey[0] as string).startsWith("/api/enforcement"),
      })
      toast({ title: editing ? "✅ 已更新公文" : "✅ 已新增公文" })
      onOpenChange(false)
    },
    onError: (e: Error) =>
      toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "編輯強執公文" : "新增強執公文"}</DialogTitle>
          <DialogDescription>上傳公文（可多張）自動辨識帶入，再核對修改</DialogDescription>
        </DialogHeader>

        {/* OCR 掃描 */}
        <label className="block rounded border-2 border-dashed border-amber-300 bg-amber-50 px-3 py-3 text-center cursor-pointer hover:bg-amber-100">
          <Sparkles className="h-5 w-5 mx-auto text-amber-600 mb-1" />
          <span className="text-sm text-amber-800">
            {scanMutation.isPending ? "辨識中…" : "上傳公文掃描自動帶入（可多張）"}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={scanMutation.isPending}
            onChange={(e) =>
              e.target.files && e.target.files.length > 0 && scanMutation.mutate(e.target.files)
            }
            data-testid="enf-scan"
          />
        </label>
        {attachments.length > 0 && (
          <div className="text-xs text-gray-500">已附 {attachments.length} 張公文截圖</div>
        )}

        <div className="space-y-3 py-1 text-sm">
          <Field label="強執總額 *">
            <Input
              type="number"
              value={form.totalAmount}
              onChange={(e) => set("totalAmount", e.target.value)}
              className="text-lg font-bold"
              data-testid="enf-amount"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="公文文號">
              <Input value={form.caseNumber} onChange={(e) => set("caseNumber", e.target.value)} />
            </Field>
            <Field label="公文日期">
              <Input
                type="date"
                value={form.issuedDate}
                onChange={(e) => set("issuedDate", e.target.value)}
              />
            </Field>
          </div>
          <Field label="執行機關">
            <Input
              value={form.agency}
              onChange={(e) => set("agency", e.target.value)}
              placeholder="例：行政執行署金門分署"
            />
          </Field>
          <Field label="窗口電話">
            <Input
              value={form.contactPhone}
              onChange={(e) => set("contactPhone", e.target.value)}
            />
          </Field>
          <Field label="案由/內容">
            <Input
              value={form.subject}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="例：滯納健保費"
            />
          </Field>
          <Field label="備註">
            <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!form.totalAmount || Number(form.totalAmount) <= 0 || saveMutation.isPending}
            className="bg-rose-600 hover:bg-rose-700"
            data-testid="enf-save"
          >
            {saveMutation.isPending ? "儲存中…" : "儲存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-600 mb-1 block">{label}</label>
      {children}
    </div>
  )
}
