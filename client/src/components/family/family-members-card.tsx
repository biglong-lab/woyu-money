/**
 * 家庭成員管理 Card（階段 4.1 起步）
 * - 列出本家庭所有成員（含 pending 邀請）
 * - 邀請新成員（email + role）
 * - 取消尚未接受的邀請
 * - 暫不發 email、回傳邀請連結讓使用者手動轉發
 */
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import { UserPlus, Mail, Copy, X } from "lucide-react"

interface FamilyMember {
  id: number
  familyId: number
  userId: number | null
  email: string | null
  displayName: string | null
  role: "owner" | "parent" | "kid" | "viewer"
  status: "pending" | "active" | "inactive"
  inviteNote: string | null
  invitedAt: string
  joinedAt: string | null
  username: string | null
  userFullName: string | null
}

const ROLE_LABEL: Record<FamilyMember["role"], string> = {
  owner: "👑 擁有者",
  parent: "🧑‍💼 家長",
  kid: "🧒 小孩",
  viewer: "👀 訪客",
}

const STATUS_LABEL: Record<FamilyMember["status"], { text: string; color: string }> = {
  active: { text: "已加入", color: "bg-emerald-100 text-emerald-700" },
  pending: { text: "邀請中", color: "bg-amber-100 text-amber-700" },
  inactive: { text: "已停用", color: "bg-gray-100 text-gray-500" },
}

export function FamilyMembersCard() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState<FamilyMember["role"]>("parent")
  const [inviteNote, setInviteNote] = useState("")
  const [latestLink, setLatestLink] = useState<string | null>(null)

  const { data: members = [], isLoading } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family/members"],
  })

  const inviteMutation = useMutation<
    { id: number; inviteLink: string; email: string },
    Error,
    { email: string; displayName?: string; role: string; inviteNote?: string }
  >({
    mutationFn: (body) =>
      apiRequest("POST", "/api/family/members/invite", body) as Promise<{
        id: number
        inviteLink: string
        email: string
      }>,
    onSuccess: (d) => {
      toast({ title: "✅ 邀請已建立", description: `${d.email} · 複製連結傳給對方` })
      setLatestLink(d.inviteLink)
      setEmail("")
      setDisplayName("")
      setInviteNote("")
      queryClient.invalidateQueries({ queryKey: ["/api/family/members"] })
    },
    onError: (e) => {
      toast({ title: "邀請失敗", description: e.message, variant: "destructive" })
    },
  })

  const cancelMutation = useMutation<unknown, Error, number>({
    mutationFn: (id) => apiRequest("POST", `/api/family/members/${id}/cancel`),
    onSuccess: () => {
      toast({ title: "邀請已取消" })
      queryClient.invalidateQueries({ queryKey: ["/api/family/members"] })
    },
    onError: (e) => {
      toast({ title: "取消失敗", description: e.message, variant: "destructive" })
    },
  })

  const handleSubmit = () => {
    if (!email.trim()) {
      toast({ title: "請填 email", variant: "destructive" })
      return
    }
    inviteMutation.mutate({
      email: email.trim(),
      displayName: displayName.trim() || undefined,
      role,
      inviteNote: inviteNote.trim() || undefined,
    })
  }

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link).then(
      () => toast({ title: "已複製邀請連結" }),
      () => toast({ title: "複製失敗", variant: "destructive" })
    )
  }

  const activeCount = members.filter((m) => m.status === "active").length
  const pendingCount = members.filter((m) => m.status === "pending").length

  return (
    <Card className="border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">👨‍👩‍👧‍👦 家庭成員</CardTitle>
          <CardDescription>
            {activeCount} 位成員、{pendingCount} 邀請中
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <UserPlus className="w-4 h-4" />
              邀請成員
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>邀請新成員</DialogTitle>
              <DialogDescription>輸入 email + 角色、產出邀請連結傳給對方</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="invite-email">Email *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="someone@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-invite-email"
                />
              </div>
              <div>
                <Label htmlFor="invite-name">顯示名稱（選填）</Label>
                <Input
                  id="invite-name"
                  placeholder="小明媽媽"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="invite-role">角色</Label>
                <Select value={role} onValueChange={(v) => setRole(v as FamilyMember["role"])}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">🧑‍💼 家長</SelectItem>
                    <SelectItem value="kid">🧒 小孩</SelectItem>
                    <SelectItem value="viewer">👀 訪客（唯讀）</SelectItem>
                    <SelectItem value="owner">👑 擁有者</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="invite-note">備註（選填）</Label>
                <Input
                  id="invite-note"
                  placeholder="例如：今天加入家庭"
                  value={inviteNote}
                  onChange={(e) => setInviteNote(e.target.value)}
                />
              </div>
              {latestLink && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                  <div className="text-xs text-emerald-700 mb-1">最新邀請連結</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[10px] bg-white px-2 py-1 rounded truncate">
                      {latestLink}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copyLink(latestLink)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                關閉
              </Button>
              <Button onClick={handleSubmit} disabled={inviteMutation.isPending}>
                <Mail className="w-4 h-4 mr-1" />
                建立邀請
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="text-sm text-gray-500">載入中...</div>}
        {!isLoading && members.length === 0 && (
          <div className="text-sm text-gray-500 py-4 text-center">
            尚無成員、點上方「邀請成員」開始
          </div>
        )}
        {!isLoading && members.length > 0 && (
          <div className="space-y-2">
            {members.map((m) => {
              const sev = STATUS_LABEL[m.status]
              const displayLabel = m.userFullName || m.displayName || m.username || m.email || "—"
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between bg-white rounded-lg p-2 border"
                  data-testid={`family-member-${m.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{displayLabel}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {ROLE_LABEL[m.role]}
                      </Badge>
                      <Badge className={`text-[10px] ${sev.color}`}>{sev.text}</Badge>
                    </div>
                    {m.email && <div className="text-[10px] text-gray-500 truncate">{m.email}</div>}
                    {m.inviteNote && (
                      <div className="text-[10px] text-gray-400 mt-0.5">📝 {m.inviteNote}</div>
                    )}
                  </div>
                  {m.status === "pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => cancelMutation.mutate(m.id)}
                      disabled={cancelMutation.isPending}
                      title="取消邀請"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
