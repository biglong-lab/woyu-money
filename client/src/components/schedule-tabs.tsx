/**
 * 付款排程子分頁列 — 月份分攤規劃與逐筆日期計劃在 UI 上整合成一區。
 */
import LinkTabs from "./link-tabs"

const TABS = [
  { href: "/payment-planner", label: "月份分攤規劃" },
  { href: "/payment-schedule", label: "逐筆日期計劃" },
]

export default function ScheduleTabs() {
  return <LinkTabs tabs={TABS} accent="blue" />
}
