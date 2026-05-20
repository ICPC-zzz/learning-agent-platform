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
import { ManualLearningCycleStatusPanel } from "./components/ManualLearningCycleStatusPanel";
import { LearningProblemAttemptSaveControls } from "./components/LearningProblemAttemptSaveControls";
import { LearningProblemAttemptSignalSummary } from "./components/LearningProblemAttemptSignalSummary";
import { LearningReadingProgressSignalSummary } from "./components/LearningReadingProgressSignalSummary";
import { LearningRecentProblemAttemptHistoryPanel } from "./components/LearningRecentProblemAttemptHistoryPanel";
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
  loadLearningRecommendationProblemAttemptStatusPreview,
} from "./recommendation-problem-attempt-status-loader";

export const dynamic = "force-dynamic";

const currentLimitations = [
  "当前没有登录或真实用户身份",
  "能力画像保存必须显式触发，且仅限演示用户",
  "每日推荐保存必须显式触发，且仅限演示用户",
  "ProblemAttempt 历史只会通过显式重新计算并保存的操作影响已保存快照",
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
          <p className="eyebrow">A22 数据库 + 引擎预览边界 MVP</p>
          <h1>学习仪表盘</h1>
          <p className="status">
            在数据库可用时读取演示学习数据，结合安全的内存态 learning-engine 预览；
            当数据库不可用时，回退到确定性的模拟数据。
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
