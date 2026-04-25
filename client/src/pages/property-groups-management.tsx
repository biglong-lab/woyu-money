/**
 * 館別共用組管理（PR-1 收尾）
 *
 * 用途：管理「共用組」（如「輕旅櫃台組」），定義哪些 project 共用某些費用
 * 權限：admin
 */

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, Users, Edit, Save, X, Building2 } from "lucide-react"
import { friendlyApiError } from "@/lib/utils"

interface PropertyProject {
  id: number
  projectName: string
  projectType: string
  isActive: boolean
}

interface GroupMember {
  id: number
  groupId: number
  projectId: number
  projectName: string | null
  weight: string
  notes: string | null
}

interface PropertyGroup {
  id: number
  name: string
  description: string | null
  isActive: boolean
  members: GroupMember[]
}

export default function PropertyGroupsManagement() {
  useDocumentTitle("館別共用組管理")
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createDesc, setCreateDesc] = useState("")

  const [editingGroup, setEditingGroup] = useState<PropertyGroup | null>(null)
  const [addMemberFor, setAddMemberFor] = useState<PropertyGroup | null>(null)
  const [newMemberProject, setNewMemberProject] = useState<string>("")
  const [newMemberWeight, setNewMemberWeight] = useState<string>("1")

  // ── Queries ─────────────────────────────────────────
  const { data: groups = [], isLoading } = useQuery<PropertyGroup[]>({
    queryKey: ["/api/property-groups"],
  })

  const { data: projects = [] } = useQuery<PropertyProject[]>({
    queryKey: ["/api/payment/projects"],
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/property-groups"] })
  }

  // ── Mutations ───────────────────────────────────────
  const createGroup = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiRequest("POST", "/api/property-groups", data),
    onSuccess: () => {
      toast({ title: "共用組已建立" })
      setCreateOpen(false)
      setCreateName("")
      setCreateDesc("")
      refresh()
    },
    onError: (e: Error) =>
      toast({ title: "建立失敗", description: friendlyApiError(e), variant: "destructive" }),
  })

  const updateGroup = useMutation({
    mutationFn: (data: {
      id: number
      name?: string
      description?: string | null
      isActive?: boolean
    }) => apiRequest("PUT", `/api/property-groups/${data.id}`, data),
    onSuccess: () => {
      toast({ title: "已更新" })
      setEditingGroup(null)
      refresh()
    },
    onError: (e: Error) =>
      toast({ title: "更新失敗", description: friendlyApiError(e), variant: "destructive" }),
  })

  const deleteGroup = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/property-groups/${id}`),
    onSuccess: () => {
      toast({ title: "已刪除" })
      refresh()
    },
    onError: (e: Error) =>
      toast({ title: "刪除失敗", description: friendlyApiError(e), variant: "destructive" }),
  })

  const addMember = useMutation({
    mutationFn: (data: { groupId: number; projectId: number; weight: number }) =>
      apiRequest("POST", `/api/property-groups/${data.groupId}/members`, {
        projectId: data.projectId,
        weight: data.weight,
      }),
    onSuccess: () => {
      toast({ title: "已加入成員" })
      setAddMemberFor(null)
      setNewMemberProject("")
      setNewMemberWeight("1")
      refresh()
    },
    onError: (e: Error) =>
      toast({ title: "加入失敗", description: friendlyApiError(e), variant: "destructive" }),
  })

  const updateMember = useMutation({
    mutationFn: (data: { id: number; weight: number }) =>
      apiRequest("PUT", `/api/property-group-members/${data.id}`, { weight: data.weight }),
    onSuccess: () => refresh(),
    onError: (e: Error) =>
      toast({ title: "更新成員失敗", description: friendlyApiError(e), variant: "destructive" }),
  })

  const deleteMember = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/property-group-members/${id}`),
    onSuccess: () => {
      toast({ title: "已移除成員" })
      refresh()
    },
    onError: (e: Error) =>
      toast({ title: "移除失敗", description: friendlyApiError(e), variant: "destructive" }),
  })

  // ── Handlers ────────────────────────────────────────
  const handleDelete = (group: PropertyGroup) => {
    if (
      !confirm(
        `確定要刪除「${group.name}」？\n所有成員（${group.members.length} 個）也會被一併刪除。`
      )
    )
      return
    deleteGroup.mutate(group.id)
  }

  const handleAddMember = () => {
    if (!addMemberFor || !newMemberProject) return
    const weight = parseFloat(newMemberWeight) || 1
    addMember.mutate({
      groupId: addMemberFor.id,
      projectId: parseInt(newMemberProject),
      weight,
    })
  }

  // 過濾掉已是成員的專案（避免重複加）
  const availableProjects = (group: PropertyGroup) => {
    const memberIds = new Set(group.members.map((m) => m.projectId))
    return projects.filter((p) => p.isActive && !memberIds.has(p.id))
  }

  // ── Render ──────────────────────────────────────────
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-blue-600" />
            館別共用組管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            定義哪些館共用某些費用（如人事、洗滌），決定如何分攤
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="btn-create-group">
          <Plus className="h-4 w-4 mr-1" />
          新增共用組
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">載入中...</div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>還沒有共用組</p>
            <p className="text-sm mt-1">點右上角「新增」建立第一個</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <Users className="h-5 w-5 text-blue-600" />
                      {group.name}
                      {!group.isActive && <Badge variant="secondary">已停用</Badge>}
                      <Badge variant="outline">{group.members.length} 個成員</Badge>
                    </CardTitle>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingGroup(group)}
                      data-testid={`btn-edit-${group.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(group)}
                      data-testid={`btn-delete-${group.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.members.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">尚未加入成員</p>
                  ) : (
                    group.members.map((m) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        onUpdateWeight={(weight) => updateMember.mutate({ id: m.id, weight })}
                        onDelete={() => {
                          if (!confirm(`從「${group.name}」移除「${m.projectName}」？`)) return
                          deleteMember.mutate(m.id)
                        }}
                      />
                    ))
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setAddMemberFor(group)}
                    disabled={availableProjects(group).length === 0}
                    data-testid={`btn-add-member-${group.id}`}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {availableProjects(group).length === 0 ? "所有專案都已在此組" : "加入專案"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 新增共用組 dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增共用組</DialogTitle>
            <DialogDescription>
              建立一個新的「共用組」，例如「輕旅櫃台組」（共用人事、洗滌）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>群組名稱 *</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="例：輕旅櫃台組"
                autoFocus
              />
            </div>
            <div>
              <Label>說明（選填）</Label>
              <Input
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="例：3 館共用人事與洗滌"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() =>
                createGroup.mutate({
                  name: createName.trim(),
                  description: createDesc.trim() || undefined,
                })
              }
              disabled={!createName.trim() || createGroup.isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯共用組 dialog */}
      <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯共用組</DialogTitle>
          </DialogHeader>
          {editingGroup && (
            <EditGroupForm
              group={editingGroup}
              onSave={(data) => updateGroup.mutate({ id: editingGroup.id, ...data })}
              onCancel={() => setEditingGroup(null)}
              isSaving={updateGroup.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 加入成員 dialog */}
      <Dialog open={!!addMemberFor} onOpenChange={(open) => !open && setAddMemberFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>加入成員到「{addMemberFor?.name}」</DialogTitle>
          </DialogHeader>
          {addMemberFor && (
            <div className="space-y-3">
              <div>
                <Label>選擇專案 *</Label>
                <Select value={newMemberProject} onValueChange={setNewMemberProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇要加入的專案" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProjects(addMemberFor).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.projectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>分攤權重</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={newMemberWeight}
                  onChange={(e) => setNewMemberWeight(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  數字代表房數比例 / 手動權重。例：8 房 → 8；平均分攤時不影響
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberFor(null)}>
              取消
            </Button>
            <Button onClick={handleAddMember} disabled={!newMemberProject || addMember.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              加入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 子元件：成員列
// ─────────────────────────────────────────────────────

interface MemberRowProps {
  member: GroupMember
  onUpdateWeight: (weight: number) => void
  onDelete: () => void
}

function MemberRow({ member, onUpdateWeight, onDelete }: MemberRowProps) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(member.weight)

  const handleSave = () => {
    const w = parseFloat(weight)
    if (Number.isFinite(w) && w >= 0) {
      onUpdateWeight(w)
    }
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
      <span className="font-medium flex-1 min-w-0 truncate">{member.projectName}</span>
      {editing ? (
        <>
          <Input
            type="number"
            step="0.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-20 h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") {
                setWeight(member.weight)
                setEditing(false)
              }
            }}
            autoFocus
          />
          <Button variant="ghost" size="sm" onClick={handleSave}>
            <Save className="h-3 w-3" />
          </Button>
        </>
      ) : (
        <>
          <Badge variant="outline" className="cursor-pointer" onClick={() => setEditing(true)}>
            權重 {parseFloat(member.weight)}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Edit className="h-3 w-3" />
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="text-red-600 hover:text-red-700"
        onClick={onDelete}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 子元件：編輯共用組表單
// ─────────────────────────────────────────────────────

interface EditGroupFormProps {
  group: PropertyGroup
  onSave: (data: { name: string; description: string | null; isActive: boolean }) => void
  onCancel: () => void
  isSaving: boolean
}

function EditGroupForm({ group, onSave, onCancel, isSaving }: EditGroupFormProps) {
  const [name, setName] = useState(group.name)
  const [desc, setDesc] = useState(group.description ?? "")
  const [isActive, setIsActive] = useState(group.isActive)

  return (
    <>
      <div className="space-y-3">
        <div>
          <Label>名稱 *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>說明</Label>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <Label htmlFor="active" className="cursor-pointer">
            啟用
          </Label>
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button
          onClick={() =>
            onSave({
              name: name.trim(),
              description: desc.trim() || null,
              isActive,
            })
          }
          disabled={!name.trim() || isSaving}
        >
          <Save className="h-4 w-4 mr-1" />
          儲存
        </Button>
      </DialogFooter>
    </>
  )
}
