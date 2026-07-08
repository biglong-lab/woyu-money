/**
 * 家庭記帳家長主頁 — 家庭成員（小孩）列表區塊
 *
 * 2026-07 巨檔拆分：從 pages/family.tsx 原樣搬出、邏輯完全不變。
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Kid } from "@/components/family/family-shared"
import { KidCard } from "@/components/family/cards-13-family-monthly-summary"
import type { FamilyMutations } from "./hooks"

interface KidsSectionProps {
  kids: Kid[]
  /** 危險動作 PIN 驗證包裝（由主頁提供）*/
  requirePin: (action: () => void) => void
  /** 開啟編輯小孩 dialog */
  onEdit: (kid: Kid) => void
  deleteKidMutation: FamilyMutations["deleteKidMutation"]
  dailyMessageMutation: FamilyMutations["dailyMessageMutation"]
}

/** 小孩列表卡片（含編輯/停用/鼓勵動作）*/
export function KidsSection({
  kids,
  requirePin,
  onEdit,
  deleteKidMutation,
  dailyMessageMutation,
}: KidsSectionProps) {
  return (
    <Card>
      <CardHeader className="py-3 px-3 sm:px-4">
        <CardTitle className="text-base">家庭成員</CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3 sm:px-4">
        {kids.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-6">
            還沒新增小孩、點上方「新增小孩」開始
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {kids.map((kid) => (
              <KidCard
                key={kid.id}
                kid={kid}
                onEdit={() => requirePin(() => onEdit(kid))}
                onDelete={() =>
                  requirePin(() => {
                    if (confirm(`停用 ${kid.displayName}？（資料保留、可重新啟用）`)) {
                      deleteKidMutation.mutate(kid.id)
                    }
                  })
                }
                onEncourage={() => {
                  const msg = window.prompt(
                    `寫一句今天給 ${kid.displayName} 的鼓勵（會顯示在小孩首頁）：`,
                    ""
                  )
                  if (msg?.trim()) {
                    dailyMessageMutation.mutate({ kidId: kid.id, message: msg.trim() })
                  }
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
