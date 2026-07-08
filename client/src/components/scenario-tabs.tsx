/**
 * 沙盤推演子分頁列 — 未來 12 月推演與下月精算在 UI 上整合成一區。
 */
import LinkTabs from "./link-tabs"

const TABS = [
  { href: "/scenario-planner", label: "未來 12 月推演" },
  { href: "/scenario-simulator", label: "下月精算" },
]

export default function ScenarioTabs() {
  return <LinkTabs tabs={TABS} accent="purple" />
}
