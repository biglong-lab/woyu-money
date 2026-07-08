/**
 * 連結式子分頁列（泛用版）— 把相關的獨立頁面在 UI 上整合成同一區。
 * 各頁仍是獨立 lazy 路由（URL 不變、不重打包），模式同 overview/revenue tabs。
 * 自動依當前路徑高亮；alias 支援舊路由別名也高亮。
 */
import { Link, useLocation } from "wouter"

export interface LinkTab {
  href: string
  label: string
  /** 舊路由別名（如 /payment-reports → /payment/reports）也視為 active */
  aliases?: string[]
}

const ACCENTS = {
  blue: "border-blue-600 text-blue-700",
  green: "border-green-600 text-green-700",
  purple: "border-purple-600 text-purple-700",
  orange: "border-orange-600 text-orange-700",
} as const

export default function LinkTabs({
  tabs,
  accent = "blue",
}: {
  tabs: LinkTab[]
  accent?: keyof typeof ACCENTS
}) {
  const [loc] = useLocation()
  return (
    <div className="-mx-4 sm:mx-0 mb-2 overflow-x-auto">
      <div className="flex gap-1 px-4 sm:px-0 min-w-max border-b">
        {tabs.map((t) => {
          const active = loc === t.href || (t.aliases ?? []).includes(loc)
          return (
            <Link key={t.href} href={t.href}>
              <div
                className={`px-3.5 py-2 text-sm whitespace-nowrap cursor-pointer border-b-2 -mb-px transition ${
                  active
                    ? `${ACCENTS[accent]} font-semibold`
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t.label}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
