/**
 * 家庭記帳家長主頁 — 統計卡片牆（前半：今日重點 → 兒童任務重複率）
 *
 * 2026-07 巨檔拆分：從 pages/family.tsx 原樣搬出、卡片渲染順序完全不變。
 * 全部為無 props 的自載入卡片。
 */
import {
  FamilyAllGoalsEtaCard,
  FamilyFirstTaskTimelineCard,
  FamilyKidWeekendVsWeekdayCard,
  FamilyTaskRepeatByKidCard,
} from "@/components/family/cards-06-family-savings-summary-card"
import {
  FamilyDifficultyByKidCard,
  FamilyKidAvgRewardCard,
  FamilyKidDailyAvgTasksCard,
  FamilyKidFavoriteEmojiCard,
  FamilyKidLearningCurveCard,
  FamilyKidPeakHourCard,
  FamilyTaskCategoryByKidCard,
  FamilyTaskSpeedMvpCard,
  FamilyTodayLeaderboardCard,
  FamilyTodayVsYesterdayCard,
} from "@/components/family/cards-07-family-today-leaderboard-card"
import {
  FamilyBadgeLeaderboardCard,
  FamilyCategoryHeatTrendCard,
  FamilyGoalUrgencyRankCard,
  FamilyGoalsMonthlyCompletionCard,
  FamilyJarAllocationByKidCard,
  FamilyKidActiveDaysCard,
  FamilyKidEarningsTrendCard,
  FamilyKidSpendingHabitsCard,
  FamilyKidTaskCompletionRateCard,
  FamilyTaskMvpCard,
} from "@/components/family/cards-08-family-goal-urgency-rank-card"
import {
  FamilyCaptainCard,
  FamilyDeadlineHitRateCard,
  FamilyGoalAmountHistogramCard,
  FamilyGoalsProgressRankCard,
  FamilyMonthlyImprovementCard,
  FamilyPeakMomentCard,
  FamilySavingsVelocityRankCard,
  FamilySpendingTopItemsCard,
  FamilyTaskDurationCard,
  FamilyTaskMonthlyGrowthCard,
  FamilyTodayTipCard,
} from "@/components/family/cards-09-family-savings-velocity-rank-car"
import {
  FamilyApproveLatencyCard,
  FamilyFeedbackRateCard,
  FamilyGoalsCompletionRateCard,
  FamilyGoalsVsWishesCard,
  FamilyIncomeVsSpendingCard,
  FamilyInitiativeRateCard,
  FamilyJarsCurrentCard,
  FamilyRewardStatsCard,
  FamilyWeekendVsWeekdayCard,
} from "@/components/family/cards-10-family-goals-vs-wishes-card"
import {
  FamilyActivityStreakCard,
  FamilyDailyRecapCard,
  FamilyKidsLastActivityCard,
  FamilyMultiMonthTrendCard,
  FamilySavingsRetentionCard,
  FamilySpendingDailyCard,
  FamilyStoryCard,
  FamilyTaskCadenceCard,
  FamilyTimeOfDayCard,
} from "@/components/family/cards-11-family-spending-daily-card"
import {
  FamilyHealthDashboard,
  FamilyLifetimeCard,
  FamilyTodaySummary,
  FamilyWeeklySummaryCard,
} from "@/components/family/cards-12-family-weekly-summary-card"

/** 統計卡片牆（前半段、順序照舊）*/
export function FamilyStatsWall() {
  return (
    <>
      {/* 家庭今日重點（最頂部）*/}
      <FamilyTodaySummary />

      {/* 家庭健康儀表板 */}
      <FamilyHealthDashboard />

      {/* 家庭累計總成就 */}
      <FamilyLifetimeCard />

      {/* 全家本週摘要 vs 上週 */}
      <FamilyWeeklySummaryCard />

      {/* 家庭月度故事 */}
      <FamilyStoryCard />

      {/* 家庭一週日報 */}
      <FamilyDailyRecapCard />

      {/* 家庭多月趨勢 */}
      <FamilyMultiMonthTrendCard />

      {/* 家庭儲蓄留存率 */}
      <FamilySavingsRetentionCard />

      {/* 家庭最後活動追蹤 */}
      <FamilyKidsLastActivityCard />

      {/* 任務派發頻率 */}
      <FamilyTaskCadenceCard />

      {/* 家庭整體 streak */}
      <FamilyActivityStreakCard />

      {/* 家庭時段熱圖 */}
      <FamilyTimeOfDayCard />

      {/* 家庭花用每日線 */}
      <FamilySpendingDailyCard />

      {/* 家庭目標達成率 */}
      <FamilyGoalsCompletionRateCard />

      {/* 家庭三罐當前餘額 */}
      <FamilyJarsCurrentCard />

      {/* 家庭收入 vs 花用對比 */}
      <FamilyIncomeVsSpendingCard />

      {/* 家庭周末 vs 工作日 */}
      <FamilyWeekendVsWeekdayCard />

      {/* 家庭主動性比例 */}
      <FamilyInitiativeRateCard />

      {/* 家庭獎勵統計 */}
      <FamilyRewardStatsCard />

      {/* 家庭親子互動 */}
      <FamilyFeedbackRateCard />

      {/* 家庭批准延遲 */}
      <FamilyApproveLatencyCard />

      {/* 家庭目標 vs 願望 */}
      <FamilyGoalsVsWishesCard />

      {/* 家庭目標進度排名 */}
      <FamilyGoalsProgressRankCard />

      {/* 家庭高峰時刻 */}
      <FamilyPeakMomentCard />

      {/* 家庭今日提示 */}
      <FamilyTodayTipCard />

      {/* 家庭 deadline 達標率 */}
      <FamilyDeadlineHitRateCard />

      {/* 家庭月度進步榜 */}
      <FamilyMonthlyImprovementCard />

      {/* 家庭隊長 */}
      <FamilyCaptainCard />

      {/* 家庭花用 top 細項 */}
      <FamilySpendingTopItemsCard />

      {/* 家庭 task 處理時長 */}
      <FamilyTaskDurationCard />

      {/* 家庭目標金額直方圖 */}
      <FamilyGoalAmountHistogramCard />

      {/* 家庭月度任務成長率 */}
      <FamilyTaskMonthlyGrowthCard />

      {/* 家庭儲蓄速度排名 */}
      <FamilySavingsVelocityRankCard />

      {/* 家庭 jar 分配對比 */}
      <FamilyJarAllocationByKidCard />

      {/* 家庭兒童任務批准率 */}
      <FamilyKidTaskCompletionRateCard />

      {/* 家庭 task MVP */}
      <FamilyTaskMvpCard />

      {/* 家庭兒童活躍天數 */}
      <FamilyKidActiveDaysCard />

      {/* 家庭兒童花用習慣 */}
      <FamilyKidSpendingHabitsCard />

      {/* 家庭徽章排名 */}
      <FamilyBadgeLeaderboardCard />

      {/* 家庭分類熱度趨勢 */}
      <FamilyCategoryHeatTrendCard />

      {/* 家庭目標月度達成 */}
      <FamilyGoalsMonthlyCompletionCard />

      {/* 家庭兒童入帳趨勢 */}
      <FamilyKidEarningsTrendCard />

      {/* 家庭目標緊急度排名 */}
      <FamilyGoalUrgencyRankCard />

      {/* 家庭兒童分類偏好 */}
      <FamilyTaskCategoryByKidCard />

      {/* 家庭兒童每日平均任務 */}
      <FamilyKidDailyAvgTasksCard />

      {/* 家庭任務速度榮譽榜 */}
      <FamilyTaskSpeedMvpCard />

      {/* 家庭兒童難度分佈對比 */}
      <FamilyDifficultyByKidCard />

      {/* 家庭任務高峰小時 */}
      <FamilyKidPeakHourCard />

      {/* 家庭兒童最愛 emoji */}
      <FamilyKidFavoriteEmojiCard />

      {/* 家庭兒童學習曲線 */}
      <FamilyKidLearningCurveCard />

      {/* 家庭兒童獎勵平均 */}
      <FamilyKidAvgRewardCard />

      {/* 家庭今日 vs 昨日 */}
      <FamilyTodayVsYesterdayCard />

      {/* 家庭今日排行榜 */}
      <FamilyTodayLeaderboardCard />

      {/* 家庭所有目標 ETA */}
      <FamilyAllGoalsEtaCard />

      {/* 家庭兒童週末 vs 平日 */}
      <FamilyKidWeekendVsWeekdayCard />

      {/* 家庭首次任務時間軸 */}
      <FamilyFirstTaskTimelineCard />

      {/* 家庭兒童任務重複率 */}
      <FamilyTaskRepeatByKidCard />
    </>
  )
}
