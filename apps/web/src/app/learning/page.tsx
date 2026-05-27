import Link from "next/link";

import { AbilityBreakdown } from "../../components/learning/AbilityBreakdown";
import { AbilityScoreCard } from "../../components/learning/AbilityScoreCard";
import { LearningDashboardEmptyState } from "../../components/learning/LearningDashboardEmptyState";
import { LearningDataSourceNotice } from "../../components/learning/LearningDataSourceNotice";
import { LearningEventSummary } from "../../components/learning/LearningEventSummary";
import { LearningQaFeedbackSignalSummary } from "../../components/learning/LearningQaFeedbackSignalSummary";
import { getLearningDashboardPageData } from "../../lib/learning-dashboard";
import type {
  LearningDashboardDataSource,
  LearningDashboardPageData,
  LearningDashboardPartialReason,
} from "../../lib/learning-types";
import { LearningAbilityProfileSaveControls } from "./components/LearningAbilityProfileSaveControls";
import { LearningDailyRecommendationSaveControls } from "./components/LearningDailyRecommendationSaveControls";
import { LearningDailyRecommendationListWithAttemptStatus } from "./components/LearningDailyRecommendationListWithAttemptStatus";
import { LearningDailyTaskPanel } from "./components/LearningDailyTaskPanel";
import { LearningDailyTaskStatsPanel } from "./components/LearningDailyTaskStatsPanel";
import { LearningDailyTaskHistoryPanel } from "./components/LearningDailyTaskHistoryPanel";
import { LearningDailyTaskWeeklyReportPanel } from "./components/LearningDailyTaskWeeklyReportPanel";
import { LearningDailyTaskWeeklyReportExportPanel } from "./components/LearningDailyTaskWeeklyReportExportPanel";
import { ManualLearningCycleStatusPanel } from "./components/ManualLearningCycleStatusPanel";
import { LearningProblemAttemptSaveControls } from "./components/LearningProblemAttemptSaveControls";
import { LearningProblemAttemptSignalSummary } from "./components/LearningProblemAttemptSignalSummary";
import { LearningRecentReadingProgressPanel } from "./components/LearningRecentReadingProgressPanel";
import { createLearningDailyTaskViewModel } from "./learning-daily-task-mapper";
import { LearningNextStepSuggestionPanel } from "./components/LearningNextStepSuggestionPanel";
import { LearningReadingProgressSignalSummary } from "./components/LearningReadingProgressSignalSummary";
import { LearningRecentProblemAttemptHistoryPanel } from "./components/LearningRecentProblemAttemptHistoryPanel";
import { createLearningNextStepSuggestionViewModel } from "./learning-next-step-suggestion-mapper";
import type { LearningDailyRecommendationAbilityProfileSource } from "./learning-daily-recommendation-save-types";
import { createManualLearningCycleStatusViewModel } from "./manual-learning-cycle-status";
import { applyProblemAttemptSignalsToAbilityPreview } from "./problem-attempt-ability-preview";
import {
  loadLearningRecentProblemAttemptHistory,
} from "./problem-attempt-history-loader";
import {
  createLearningProblemAttemptSignalPreviewForFallbackReason,
  loadLearningProblemAttemptSignalPreview,
} from "./problem-attempt-signal-loader";
import {
  createLearningReadingProgressSignalPreviewForFallbackReason,
  loadLearningReadingProgressSignalPreview,
} from "./reading-progress-signal-loader";
import {
  loadLearningRecentReadingProgress,
} from "./recent-reading-progress-loader";
import {
  loadLearningRecommendationProblemAttemptStatusPreview,
} from "./recommendation-problem-attempt-status-loader";

export const dynamic = "force-dynamic";

const currentLimitations = [
  "当前没有登录或真实用户身份，页面只读取演示用户或模拟回退数据",
  "能力画像保存是开发环境演示快照，必须手动触发，未形成自动画像闭环",
  "每日推荐保存是开发环境演示快照，必须手动触发，不代表真实个性化推荐系统已上线",
  "ProblemAttempt 历史只作为预览信号显示；需要手动重新计算并保存后才会影响演示快照",
];

export default async function LearningPage() {
  const initialDashboardData = await getLearningDashboardPageData();
  const readingProgressSignalPreview =
    await getReadingProgressSignalPreview(initialDashboardData);
  const initialProblemAttemptSignalPreview =
    await getProblemAttemptSignalPreview(initialDashboardData);
  const {
    dashboardData,
    problemAttemptSignalPreview,
  } = applyProblemAttemptSignalsToAbilityPreview({
    dashboardData: initialDashboardData,
    readingProgressSignalPreview,
    problemAttemptSignalPreview: initialProblemAttemptSignalPreview,
  });
  const dailyRecommendationAbilityProfileSource =
    getDailyRecommendationAbilityProfileSource({
      source: dashboardData.source,
      partialReasons: dashboardData.partialReasons,
      hasAbilityProfile: dashboardData.abilityProfile !== null,
    });
  const recommendationProblemAttemptStatusPreview =
    await getRecommendationProblemAttemptStatusPreview(dashboardData);
  const recentReadingProgress = await getRecentReadingProgress(dashboardData);
  const nextStepSuggestion = createLearningNextStepSuggestionViewModel({
    recentReadingProgress,
  });
  const dailyTask = createLearningDailyTaskViewModel({
    recentReadingProgress,
    nextStepSuggestion,
  });
  const recentProblemAttemptHistory =
    await getRecentProblemAttemptHistory(dashboardData);
  const manualLearningCycleStatus =
    createManualLearningCycleStatusViewModel({
      dashboardData,
      readingProgressSignalPreview,
      problemAttemptSignalPreview,
    });

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">学习预览 / 演示数据边界</p>
          <h1>学习仪表盘预览</h1>
          <p className="status">
            在数据库可用时仅读取演示用户的开发数据，并结合内存态
            learning-engine 预览；当数据库不可用时，回退到确定性的模拟数据。
            本页不会调用真实 AI、不会自动生成学习闭环。
          </p>
        </div>
        <Link className="secondaryLink" href="/">
          返回首页
        </Link>
      </header>

      <LearningDataSourceNotice
        source={dashboardData.source}
        fallbackReason={dashboardData.fallbackReason}
        partialReasons={dashboardData.partialReasons}
      />

      <LearningDashboardEmptyState messages={dashboardData.emptyStateMessages} />

      <LearningAbilityProfileSaveControls
        source={dashboardData.source}
        fallbackReason={dashboardData.fallbackReason}
        inputEventCount={dashboardData.recentEventsSummary.totalEvents}
        qaFeedbackSignalCount={dashboardData.qaFeedbackSignalPreview.validSignalCount}
        readingProgressSignalCount={readingProgressSignalPreview.mappedSignalCount}
        readingProgressStatus={readingProgressSignalPreview.status}
        problemAttemptSignalCount={problemAttemptSignalPreview.mappedSignalCount}
        problemAttemptStatus={problemAttemptSignalPreview.status}
      />

      <LearningDailyRecommendationSaveControls
        source={dashboardData.source}
        fallbackReason={dashboardData.fallbackReason}
        hasAbilityProfile={dashboardData.abilityProfile !== null}
        initialAbilityProfileSource={dailyRecommendationAbilityProfileSource}
        candidateProblemCount={dashboardData.candidateProblems.length}
        qaFeedbackSignalCount={dashboardData.qaFeedbackSignalPreview.validSignalCount}
        problemAttemptHistoryStatus={problemAttemptSignalPreview.status}
        recentProblemAttemptCount={problemAttemptSignalPreview.recentAttemptCount}
        solvedProblemCount={problemAttemptSignalPreview.solvedCount}
      />

      <ManualLearningCycleStatusPanel status={manualLearningCycleStatus} />

      <div className="dashboardGrid">
        <AbilityScoreCard
          profile={dashboardData.abilityProfile}
          source={dashboardData.source}
        />
        <AbilityBreakdown dimensions={dashboardData.dimensionScores} />
        <LearningEventSummary
          summary={dashboardData.recentEventsSummary}
          warnings={dashboardData.scoringWarnings}
        />
        <LearningQaFeedbackSignalSummary
          preview={dashboardData.qaFeedbackSignalPreview}
        />
        <LearningReadingProgressSignalSummary
          preview={readingProgressSignalPreview}
        />
        <LearningRecentReadingProgressPanel progress={recentReadingProgress} />
        <LearningNextStepSuggestionPanel suggestion={nextStepSuggestion} />
        <LearningDailyTaskPanel dailyTask={dailyTask} />
        <LearningDailyTaskStatsPanel dailyTask={dailyTask} />
        <LearningDailyTaskHistoryPanel />
        <LearningDailyTaskWeeklyReportPanel />
        <LearningDailyTaskWeeklyReportExportPanel />
        <LearningProblemAttemptSignalSummary
          preview={problemAttemptSignalPreview}
        />
        <LearningRecentProblemAttemptHistoryPanel
          history={recentProblemAttemptHistory}
        />
        <LearningDailyRecommendationListWithAttemptStatus
          recommendedProblems={dashboardData.recommendedProblems}
          recommendationSource={dashboardData.recommendationSource}
          recommendationSourceDetail={dashboardData.recommendationSourceDetail}
          candidateProblemCount={dashboardData.candidateProblems.length}
          targetDifficulty={dashboardData.targetDifficulty}
          weakDimensions={dashboardData.weakDimensions}
          warnings={dashboardData.recommendationWarnings}
          problemAttemptStatusPreview={recommendationProblemAttemptStatusPreview}
        />
        <LearningProblemAttemptSaveControls
          recommendedProblems={dashboardData.recommendedProblems}
          recommendationSource={dashboardData.recommendationSource}
          fallbackReason={dashboardData.fallbackReason}
        />
      </div>

      <section className="learningPanel limitationPanel" aria-labelledby="limits-title">
        <h2 id="limits-title">当前限制</h2>
        <ul>
          {currentLimitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

async function getProblemAttemptSignalPreview(
  dashboardData: LearningDashboardPageData,
) {
  if (dashboardData.source === "mock_fallback") {
    return createLearningProblemAttemptSignalPreviewForFallbackReason(
      dashboardData.fallbackReason,
    );
  }

  return loadLearningProblemAttemptSignalPreview({
    previewAppliedToAbility: false,
  });
}

async function getReadingProgressSignalPreview(
  dashboardData: LearningDashboardPageData,
) {
  if (dashboardData.source === "mock_fallback") {
    return createLearningReadingProgressSignalPreviewForFallbackReason(
      dashboardData.fallbackReason,
    );
  }

  return loadLearningReadingProgressSignalPreview({
    previewAppliedToAbility: isReadingProgressAppliedToAbilityPreview(
      dashboardData.partialReasons,
    ),
  });
}

async function getRecommendationProblemAttemptStatusPreview(
  dashboardData: LearningDashboardPageData,
) {
  if (dashboardData.source === "mock_fallback") {
    return loadLearningRecommendationProblemAttemptStatusPreview({
      recommendedProblems: dashboardData.recommendedProblems,
      dashboardSource: dashboardData.source,
      fallbackReason: dashboardData.fallbackReason,
    });
  }

  return loadLearningRecommendationProblemAttemptStatusPreview({
    recommendedProblems: dashboardData.recommendedProblems,
    dashboardSource: dashboardData.source,
  });
}

async function getRecentProblemAttemptHistory(
  dashboardData: LearningDashboardPageData,
) {
  return loadLearningRecentProblemAttemptHistory({
    dashboardSource: dashboardData.source,
    fallbackReason:
      dashboardData.source === "mock_fallback"
        ? dashboardData.fallbackReason
        : undefined,
  });
}

async function getRecentReadingProgress(dashboardData: LearningDashboardPageData) {
  return loadLearningRecentReadingProgress({
    dashboardSource: dashboardData.source,
    fallbackReason:
      dashboardData.source === "mock_fallback"
        ? dashboardData.fallbackReason
        : undefined,
  });
}

function getDailyRecommendationAbilityProfileSource({
  source,
  partialReasons,
  hasAbilityProfile,
}: {
  source: LearningDashboardDataSource;
  partialReasons?: readonly LearningDashboardPartialReason[];
  hasAbilityProfile: boolean;
}): LearningDailyRecommendationAbilityProfileSource {
  if (source === "mock_fallback") {
    return "mock_fallback";
  }

  if (!hasAbilityProfile) {
    return "unavailable";
  }

  if (partialReasons?.includes("no_stored_ability_profile") === true) {
    return "engine_preview";
  }

  return "database_saved";
}

function isReadingProgressAppliedToAbilityPreview(
  partialReasons?: readonly LearningDashboardPartialReason[],
): boolean {
  return (
    partialReasons?.includes(
      "ability_profile_calculated_from_reading_progress",
    ) ?? false
  );
}
