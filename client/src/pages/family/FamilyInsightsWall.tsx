/**
 * 家庭記帳家長主頁 — 洞察卡片牆（後半：今日任務列表 → 捐贈對象目錄）
 *
 * 2026-07 巨檔拆分：從 pages/family.tsx 原樣搬出、卡片渲染順序完全不變。
 * 只有 TaskCalendar 需要 tasks/kids props、其餘為自載入卡片。
 */
import {
  FamilyTopTaskEmojisCard,
  FamilyCommentInteractionCard,
  FamilyKindnessMilestoneCard,
  FamilyTopRecipientsCard,
  FamilyKindnessStoryCard,
} from "@/components/family/social-cards"
import {
  FamilyTodaySpendingFeedCard,
  FamilyTodayCheckinRosterCard,
  FamilyTodayTasksListCard,
} from "@/components/family/today-cards"
import {
  FamilyApprovalLeadTimeCard,
  FamilyMonthlyTaskCreationTrendCard,
  FamilyMonthlySpendingTrendCard,
  FamilyMonthlyGoalsTrendCard,
} from "@/components/family/stats-cards"
import {
  FamilyStreakRankingCard,
  FamilyBiggestSpendingsCard,
  FamilyBiggestWinsCard,
  FamilyWishesAgingCard,
} from "@/components/family/ranking-cards"
import { FamilyMembersCard } from "@/components/family/family-members-card"
import { FamilyCrossDomainCard } from "@/components/family/family-cross-domain-card"
import { FamilySavingsGoalsCard } from "@/components/family/family-savings-goals-card"
import { Kid, Task } from "@/components/family/family-shared"
import { CategoryStats, TaskCalendar } from "@/components/family/cards-01-comment-dialog"
import {
  DifficultyInsights,
  FamilyPotsManager,
  FamilyWeeklyHeatmap,
  MoodTrends,
  PotContributorsCard,
  RecipientsManager,
} from "@/components/family/cards-02-mood-trends"
import {
  CompletedGoalsHistory,
  FairnessCard,
  FamilyEducationReports,
  FamilyMilestonesCard,
  FamilyPeakWeekCard,
  FamilyWealthTrend,
  GoalAchieversCard,
  SiblingComparisonCard,
} from "@/components/family/cards-03-family-education-reports"
import {
  FamilyActivityFeed,
  FamilyCalendarHeatmap,
  FamilyEmojiCloudCard,
  FamilyGoalsBoard,
  FamilyMonthlyStats,
  FamilyMultiRankCard,
  KidsAttentionRadar,
  PopularTasksCard,
} from "@/components/family/cards-04-family-multi-rank-card"
import {
  FamilyAvgRewardByCategoryCard,
  FamilyCheckinStreakCard,
  FamilyDayOfWeekDistributionCard,
  FamilyKidsNeedingAttentionCard,
  FamilyRejectionRateCard,
  FamilySpendingSummaryCard,
  FamilyWishPriorityBreakdownCard,
  FamilyWishPromotionRateCard,
  ParentTodoList,
} from "@/components/family/cards-05-parent-todo-list"
import {
  FamilyCategoryBreakdownCard,
  FamilyProofImageWallCard,
  FamilyRecentBadgesCard,
  FamilySavingsSummaryCard,
  FamilyStalePendingTasksCard,
  FamilyTaskHourDistributionCard,
} from "@/components/family/cards-06-family-savings-summary-card"
import {
  FamilyMoodToday,
  FamilySearch,
  ParentReminders,
} from "@/components/family/cards-12-family-weekly-summary-card"

interface FamilyInsightsWallProps {
  /** 所有任務（給任務月曆用）*/
  allTasks: Task[]
  /** 小孩列表（給任務月曆用）*/
  kids: Kid[]
}

/** 洞察卡片牆（後半段、順序照舊）*/
export function FamilyInsightsWall({ allTasks, kids }: FamilyInsightsWallProps) {
  return (
    <>
      {/* 家庭今日任務列表 */}
      <FamilyTodayTasksListCard />

      {/* 本週家庭善心故事 */}
      <FamilyKindnessStoryCard />

      {/* 跨領域整合視圖（階段 4.3） */}
      <FamilyCrossDomainCard />

      {/* 共同存錢目標（階段 4.4） */}
      <FamilySavingsGoalsCard />

      {/* 家庭成員管理（階段 4.1 邀請基底） */}
      <FamilyMembersCard />

      {/* 未批准提醒（家長忘記 approve）*/}
      <FamilyStalePendingTasksCard />

      {/* 證明照片牆 */}
      <FamilyProofImageWallCard />

      {/* 最常支持對象 ranking */}
      <FamilyTopRecipientsCard />

      {/* 行善里程碑 */}
      <FamilyKindnessMilestoneCard />

      {/* 任務類別分佈 */}
      <FamilyCategoryBreakdownCard />

      {/* 今日簽到名冊 */}
      <FamilyTodayCheckinRosterCard />

      {/* 最大獎勵 wins */}
      <FamilyBiggestWinsCard />

      {/* 任務時段熱力圖 */}
      <FamilyTaskHourDistributionCard />

      {/* 徽章時間軸 */}
      <FamilyRecentBadgesCard />

      {/* 家庭儲蓄總進度 */}
      <FamilySavingsSummaryCard />

      {/* 評論互動率 */}
      <FamilyCommentInteractionCard />

      {/* 家庭 reject 率 */}
      <FamilyRejectionRateCard />

      {/* 月度達標 trend */}
      <FamilyMonthlyGoalsTrendCard />

      {/* wish priority 分佈 */}
      <FamilyWishPriorityBreakdownCard />

      {/* 家庭打卡連續天數 */}
      <FamilyCheckinStreakCard />

      {/* 花費三罐分布 */}
      <FamilySpendingSummaryCard />

      {/* wish 升級率 */}
      <FamilyWishPromotionRateCard />

      {/* 週末/工作日分布 (按日 DOW) */}
      <FamilyDayOfWeekDistributionCard />

      {/* 家長關注度警示 */}
      <FamilyKidsNeedingAttentionCard />

      {/* 任務 emoji top 10 */}
      <FamilyTopTaskEmojisCard />

      {/* 願望年齡分布 */}
      <FamilyWishesAgingCard />

      {/* 月度花費走勢 */}
      <FamilyMonthlySpendingTrendCard />

      {/* 最大花費 list */}
      <FamilyBiggestSpendingsCard />

      {/* 類別平均獎金 */}
      <FamilyAvgRewardByCategoryCard />

      {/* 今日 spending feed */}
      <FamilyTodaySpendingFeedCard />

      {/* 月度派任務趨勢 */}
      <FamilyMonthlyTaskCreationTrendCard />

      {/* 批准延遲分析 */}
      <FamilyApprovalLeadTimeCard />

      {/* streak 排行 */}
      <FamilyStreakRankingCard />

      {/* 家庭今日氛圍 */}
      <FamilyMoodToday />

      {/* 家長待辦清單 */}
      <ParentTodoList />

      {/* 關心雷達（找需要關心的 kid）*/}
      <KidsAttentionRadar />

      {/* 跨域搜尋 */}
      <FamilySearch />

      {/* 全家月度統計 */}
      <FamilyMonthlyStats />

      {/* 家庭目標進度看板 */}
      <FamilyGoalsBoard />

      {/* 目標達成歷史 */}
      <CompletedGoalsHistory />

      {/* 目標達成者排行 */}
      <GoalAchieversCard />

      {/* 熱門任務 TOP 5 */}
      <PopularTasksCard />

      {/* 家庭 emoji 雲 */}
      <FamilyEmojiCloudCard />

      {/* 家庭日曆熱度 */}
      <FamilyCalendarHeatmap />

      {/* 多維排行榜 */}
      <FamilyMultiRankCard />

      {/* 家庭高潮週回顧 */}
      <FamilyPeakWeekCard />

      {/* 家庭財富趨勢（6 個月）*/}
      <FamilyWealthTrend />

      {/* 家庭里程碑紀錄 */}
      <FamilyMilestonesCard />

      {/* 兄弟姊妹比較 */}
      <SiblingComparisonCard />

      {/* 家事公平度分析 */}
      <FairnessCard />

      {/* 教育成果報告（每個 kid 一份）*/}
      <FamilyEducationReports />

      {/* 週曆熱度 */}
      <FamilyWeeklyHeatmap />

      {/* 全家活動 feed */}
      <FamilyActivityFeed />

      {/* 家長提醒中心 */}
      <ParentReminders />

      {/* 任務難度智能建議 */}
      <DifficultyInsights />

      {/* 家庭心情軌跡 */}
      <MoodTrends />

      {/* 任務分類分布 */}
      <CategoryStats />

      {/* 任務月曆視圖 */}
      <TaskCalendar tasks={allTasks} kids={kids} />

      {/* 家庭共同存錢罐 */}
      <FamilyPotsManager />

      {/* 家庭目標貢獻者排行 */}
      <PotContributorsCard />

      {/* 捐贈對象目錄 */}
      <RecipientsManager />
    </>
  )
}
