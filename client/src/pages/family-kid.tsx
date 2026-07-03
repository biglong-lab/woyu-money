/**
 * 家庭記帳：小孩專屬頁（/family/kid/:id）
 *
 * 2026-07-03 Phase 3.2：原 4,927 行拆分 — 元件移至
 * components/family/kid/kid-*.tsx、共用型別移至 family-shared.ts，
 * 本檔只留 PIN 驗證 → 儀表板的頁面組裝。
 */
import { useState } from "react"
import { useParams } from "wouter"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { KidDashboard, PinLogin } from "@/components/family/kid/kid-01-pin-login"

export default function FamilyKidPage() {
  const params = useParams<{ id: string }>()
  const kidId = parseInt(params.id ?? "0", 10)
  useDocumentTitle("我的記帳")
  const { toast } = useToast()
  const [authed, setAuthed] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)

  // 先要 PIN 才看資料
  if (!authed) {
    return <PinLogin kidId={kidId} onSuccess={() => setAuthed(true)} />
  }

  return (
    <KidDashboard
      kidId={kidId}
      onShowAddGoal={() => setShowAddGoal(true)}
      showAddGoal={showAddGoal}
      onCloseAddGoal={() => setShowAddGoal(false)}
      toast={toast}
    />
  )
}
