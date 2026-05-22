import {
  calculateAbilityProfile,
  getTargetDifficulty,
  getWeakAbilityDimensions,
  recommendDailyProblems,
  resolveRecommendationConfig,
} from "@learning-agent-platform/learning-engine";
import {
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaChapterQaFeedbackRepository,
  PrismaChapterQaHistoryRepository,
  PrismaLearningRepository,
  PrismaReadingProgressRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type {
  AbilityProfile,
  AbilityDimensionBreakdownMap,
  LearningEvent,
  ProblemDifficulty,
  RecommendationProblem,
  RecommendationWeakDimension,
  RecommendedProblem,
} from "@learning-agent-platform/learning-engine";
import type {
  AbilityProfileRecord,
  DailyRecommendationRecord,
  LearningRepository,
  ProblemDifficulty as DatabaseProblemDifficulty,
  ProblemRecord,
  ReadingProgressRecord,
} from "@learning-agent-platform/db";

import type {
  LearningAbilityProfileView,
  LearningDashboardFallbackReason,
  LearningDashboardPageData,
  LearningDashboardPartialReason,
  LearningRecommendationDisplaySource,
  LearningRecommendedProblemView,
} from "./learning-types";
import {
  createDimensionScores,
  summarizeLearningEvents,
  toLearningDashboardProblemView,
  toLearningRecommendedProblemView,
} from "./learning-view-model";
import {
  loadLearningQaFeedbackSignalPreviewForUser,
  withLearningQaFeedbackAbilityPreviewImpact,
} from "./learning-qa-feedback-signal-loader";
import type {
  LearningQaFeedbackSignalPreview,
} from "./learning-qa-feedback-signal-types";

const demoUserEmail = "demo@example.com";
const recommendationLookbackDays = 7;

interface LearningDashboardDatabaseReadResult {
  data: LearningDashboardPageData | null;
  fallbackReason?: LearningDashboardFallbackReason;
}

interface AbilityProfileBundle {
  profile: LearningAbilityProfileView | null;
  dimensionBreakdown?: AbilityDimensionBreakdownMap;
  scoringWarnings: readonly string[];
  partialReasons: readonly LearningDashboardPartialReason[];
}

interface RecommendationBundle {
  recommendedProblems: readonly LearningRecommendedProblemView[];
  recommendationSource: LearningRecommendationDisplaySource;
  recommendationSourceDetail: string;
  recommendationWarnings: readonly string[];
  targetDifficulty?: ProblemDifficulty;
  weakDimensions: readonly RecommendationWeakDimension[];
  partialReasons: readonly LearningDashboardPartialReason[];
}

type LearningDashboardReader = Pick<
  LearningRepository,
  "getAbilityProfile" | "getDailyRecommendations" | "listProblems"
>;

export async function getLearningDashboardDataFromDatabase(): Promise<LearningDashboardPageData | null> {
  const result = await getLearningDashboardDatabaseReadResult();

  return result.data;
}

export async function getLearningDashboardDatabaseReadResult(): Promise<LearningDashboardDatabaseReadResult> {
  const envStatus = getDatabaseEnvStatus();

  if (!envStatus.hasDatabaseUrl) {
    return {
      data: null,
      fallbackReason: "missing_database_url",
    };
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const learningRepository = new PrismaLearningRepository(prisma);
    const readingProgressRepository = new PrismaReadingProgressRepository(prisma);
    const qaHistoryRepository = new PrismaChapterQaHistoryRepository(prisma);
    const qaFeedbackRepository = new PrismaChapterQaFeedbackRepository(prisma);

    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return {
        data: null,
        fallbackReason: "no_demo_user_found",
      };
    }

    const referenceDate = new Date();
    const [
      storedAbilityProfile,
      savedRecommendations,
      candidateProblemRecords,
      readingProgressRecords,
      qaFeedbackSignalPreview,
    ] = await Promise.all([
      learningRepository.getAbilityProfile(demoUser.id),
      getRecentDailyRecommendations(
        learningRepository,
        demoUser.id,
        referenceDate,
      ),
      learningRepository.listProblems({ limit: 100 }),
      readingProgressRepository.listReadingProgress({
        userId: demoUser.id,
        limit: 50,
      }),
      loadLearningQaFeedbackSignalPreviewForUser({
        userId: demoUser.id,
        historyRepository: qaHistoryRepository,
        feedbackRepository: qaFeedbackRepository,
      }),
    ]);
    const readingEvents = mapReadingProgressEvents(readingProgressRecords);
    const qaFeedbackEvents = getQaFeedbackLearningEvents(
      qaFeedbackSignalPreview,
    );
    const abilityPreviewEvents =
      storedAbilityProfile === null
        ? [...readingEvents, ...qaFeedbackEvents]
        : readingEvents;
    const recentEvents = [...readingEvents, ...qaFeedbackEvents];
    const candidateProblems = candidateProblemRecords.map(
      mapDatabaseProblemToRecommendationProblem,
    );
    const abilityBundle = createAbilityProfileBundle({
      storedAbilityProfile,
      previewEvents: abilityPreviewEvents,
      includesReadingProgress: readingEvents.length > 0,
      includesQaFeedbackSignals:
        storedAbilityProfile === null && qaFeedbackEvents.length > 0,
    });
    const qaFeedbackSignalPreviewWithImpact =
      withLearningQaFeedbackAbilityPreviewImpact(
        qaFeedbackSignalPreview,
        createQaFeedbackAbilityPreviewImpact({
          hasStoredAbilityProfile: storedAbilityProfile !== null,
          includedInAbilityPreview:
            storedAbilityProfile === null && qaFeedbackEvents.length > 0,
          validSignalCount: qaFeedbackSignalPreview.validSignalCount,
        }),
      );
    const recommendationBundle = createRecommendationBundle({
      abilityProfile: abilityBundle.profile,
      savedRecommendations,
      candidateProblems,
      referenceDate,
    });
    const partialReasons = uniquePartialReasons([
      ...abilityBundle.partialReasons,
      ...recommendationBundle.partialReasons,
    ]);
    const source: "database" | "database_partial" =
      partialReasons.length === 0 ? "database" : "database_partial";
    const emptyStateMessages = createEmptyStateMessages({
      abilityProfile: abilityBundle.profile,
      recommendationBundle,
      recentEvents,
    });
    const baseData = {
      abilityProfile: abilityBundle.profile,
      dimensionScores:
        abilityBundle.profile === null
          ? []
          : createDimensionScores(
              abilityBundle.profile,
              abilityBundle.dimensionBreakdown,
            ),
      scoringWarnings: abilityBundle.scoringWarnings,
      recommendedProblems: recommendationBundle.recommendedProblems,
      recommendationSource: recommendationBundle.recommendationSource,
      recommendationSourceDetail: recommendationBundle.recommendationSourceDetail,
      recommendationWarnings: recommendationBundle.recommendationWarnings,
      candidateProblems: candidateProblems.map(toLearningDashboardProblemView),
      targetDifficulty: recommendationBundle.targetDifficulty,
      weakDimensions: recommendationBundle.weakDimensions,
      recentEventsSummary: summarizeLearningEvents(recentEvents),
      qaFeedbackSignalPreview: qaFeedbackSignalPreviewWithImpact,
      emptyStateMessages,
    };

    if (source === "database") {
      return {
        data: {
          ...baseData,
          source,
          partialReasons: [],
        },
      };
    }

    return {
      data: {
        ...baseData,
        source,
        partialReasons,
      },
    };
  } catch {
    return {
      data: null,
      fallbackReason: "database_read_failed",
    };
  }
}

async function getRecentDailyRecommendations(
  learningRepository: Pick<LearningDashboardReader, "getDailyRecommendations">,
  userId: string,
  referenceDate: Date,
): Promise<DailyRecommendationRecord[]> {
  for (const recommendationDate of getRecentRecommendationDates(referenceDate)) {
    const recommendations = await learningRepository.getDailyRecommendations({
      userId,
      recommendationDate,
    });

    if (recommendations.length > 0) {
      return recommendations;
    }
  }

  return [];
}

function getRecentRecommendationDates(referenceDate: Date): readonly Date[] {
  const dates: Date[] = [];
  const seenTimestamps = new Set<number>();

  for (let dayOffset = 0; dayOffset < recommendationLookbackDays; dayOffset += 1) {
    const utcDate = addUtcDays(startOfUtcDay(referenceDate), -dayOffset);
    const localDate = addLocalDays(startOfLocalDay(referenceDate), -dayOffset);

    for (const date of [utcDate, localDate]) {
      const timestamp = date.getTime();

      if (!seenTimestamps.has(timestamp)) {
        seenTimestamps.add(timestamp);
        dates.push(date);
      }
    }
  }

  return dates;
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate() + days,
    ),
  );
}

function addLocalDays(value: Date, days: number): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
}

function createAbilityProfileBundle({
  storedAbilityProfile,
  previewEvents,
  includesReadingProgress,
  includesQaFeedbackSignals,
}: {
  storedAbilityProfile: AbilityProfileRecord | null;
  previewEvents: readonly LearningEvent[];
  includesReadingProgress: boolean;
  includesQaFeedbackSignals: boolean;
}): AbilityProfileBundle {
  if (storedAbilityProfile !== null) {
    return {
      profile: mapDatabaseAbilityProfile(storedAbilityProfile),
      scoringWarnings: [
        "数据库能力画像按演示用户已保存快照只读展示；此仪表盘展示不会持久化重新计算的分数。",
        "数据库能力画像快照暂未保存置信度；置信度显示为 0%。",
      ],
      partialReasons: [],
    };
  }

  if (previewEvents.length === 0) {
    return {
      profile: null,
      scoringWarnings: [
        "没有可用的已保存数据库能力画像快照或最近可读学习事件。",
      ],
      partialReasons: [
        "no_stored_ability_profile",
        "no_recent_learning_events",
      ],
    };
  }

  const scoringResult = calculateAbilityProfile({
    events: previewEvents,
  });
  const previewSources = [
    includesReadingProgress ? "数据库阅读进度" : undefined,
    includesQaFeedbackSignals ? "问答反馈信号" : undefined,
  ].filter(isDefined);

  return {
    profile: scoringResult.profile,
    dimensionBreakdown: scoringResult.dimensionBreakdown,
    scoringWarnings: [
      ...scoringResult.warnings,
      `能力画像是由 ${previewSources.join(
        " 和 ",
      )} 计算得到的内存态预览；它没有写入数据库，也不代表真实能力画像闭环已完成。`,
    ],
    partialReasons: uniquePartialReasons([
      "no_stored_ability_profile",
      includesReadingProgress
        ? "ability_profile_calculated_from_reading_progress"
        : undefined,
      includesQaFeedbackSignals
        ? "ability_profile_calculated_from_qa_feedback_signals"
        : undefined,
    ]),
  };
}

function createRecommendationBundle(input: {
  abilityProfile: AbilityProfile | null;
  savedRecommendations: readonly DailyRecommendationRecord[];
  candidateProblems: readonly RecommendationProblem[];
  referenceDate: Date;
}): RecommendationBundle {
  const recommendationConfig = resolveRecommendationConfig();
  const baseTargetDifficulty =
    input.abilityProfile === null
      ? undefined
      : getTargetDifficulty(input.abilityProfile, recommendationConfig);
  const baseWeakDimensions =
    input.abilityProfile === null
      ? []
      : getWeakAbilityDimensions(input.abilityProfile, recommendationConfig);

  if (input.savedRecommendations.length > 0) {
    return {
      recommendedProblems: input.savedRecommendations.map(
        mapDatabaseRecommendation,
      ),
      recommendationSource: "database_saved",
      recommendationSourceDetail:
        "推荐来自演示数据库中已保存的 DailyRecommendation 快照，只读展示。",
      recommendationWarnings: [
        "已保存的数据库推荐以只读方式展示；此仪表盘展示不会刷新或写入推荐记录。",
      ],
      targetDifficulty: baseTargetDifficulty,
      weakDimensions: baseWeakDimensions,
      partialReasons: [],
    };
  }

  if (input.abilityProfile !== null && input.candidateProblems.length > 0) {
    const recommendationResult = recommendDailyProblems({
      abilityProfile: input.abilityProfile,
      candidateProblems: input.candidateProblems,
      recentAttempts: [],
      targetDate: input.referenceDate,
    });

    return {
      recommendedProblems: recommendationResult.recommendedProblems.map(
        toLearningRecommendedProblemView,
      ),
      recommendationSource: "engine_preview",
      recommendationSourceDetail:
        "推荐是 learning-engine 的内存态预览，未保存到数据库，不代表真实个性化推荐系统已上线。",
      recommendationWarnings: recommendationResult.warnings,
      targetDifficulty: recommendationResult.targetDifficulty,
      weakDimensions: recommendationResult.weakDimensions,
      partialReasons: ["no_saved_daily_recommendations"],
    };
  }

  return {
    recommendedProblems: [],
    recommendationSource: "unavailable",
    recommendationSourceDetail:
      "演示数据库学习数据不足，无法展示已保存快照或预览推荐。",
    recommendationWarnings: createUnavailableRecommendationWarnings(input),
    targetDifficulty: baseTargetDifficulty,
    weakDimensions: baseWeakDimensions,
    partialReasons: uniquePartialReasons([
      "no_saved_daily_recommendations",
      input.candidateProblems.length === 0 ? "no_candidate_problems" : undefined,
      "recommendations_unavailable",
    ]),
  };
}

function createUnavailableRecommendationWarnings(input: {
  abilityProfile: AbilityProfile | null;
  candidateProblems: readonly RecommendationProblem[];
}): readonly string[] {
  const warnings: string[] = [
    "最近推荐窗口内未找到已保存的数据库推荐快照。",
  ];

  if (input.abilityProfile === null) {
    warnings.push("没有可用于引擎预览的能力画像。");
  }

  if (input.candidateProblems.length === 0) {
    warnings.push("没有可用于引擎预览的候选题目。");
  }

  return warnings;
}

function mapReadingProgressEvents(
  records: readonly ReadingProgressRecord[],
): readonly LearningEvent[] {
  return records.map((record) => ({
    id: record.id,
    userId: record.userId,
    type: "reading_progress",
    bookId: record.bookId,
    chapterId: record.chapterId,
    progressRatio: record.progressRatio,
    occurredAt: record.updatedAt,
  }));
}

function mapDatabaseAbilityProfile(
  record: AbilityProfileRecord,
): LearningAbilityProfileView {
  const updatedAt = record.lastEvaluatedAt ?? record.updatedAt;

  return {
    overallScore: normalizeScore(record.overallScore),
    algorithmScore: normalizeScore(record.algorithmScore),
    debuggingScore: normalizeScore(record.debuggingScore),
    systemDesignScore: normalizeScore(record.systemDesignScore),
    readingScore: normalizeScore(record.languageFundamentalsScore),
    confidence: 0,
    updatedAt: updatedAt.toISOString(),
  };
}

function mapDatabaseRecommendation(
  record: DailyRecommendationRecord,
): LearningRecommendedProblemView {
  const problem = mapDatabaseProblemToRecommendationProblem(record.problem);
  const recommendedProblem: RecommendedProblem = {
    problem,
    score: 0,
    reasons: [
      {
          code: "stored_daily_recommendation",
          message: record.reason ?? "来自演示数据库的已保存每日推荐快照。",
      },
    ],
  };

  return toLearningRecommendedProblemView(recommendedProblem);
}

function mapDatabaseProblemToRecommendationProblem(
  record: ProblemRecord,
): RecommendationProblem {
  const problem: RecommendationProblem = {
    id: record.id,
    title: record.title,
    difficulty: mapDatabaseDifficulty(record.difficulty),
    tags: [...record.tags],
    source: record.source ?? "database",
  };
  const estimatedMinutes = readEstimatedMinutes(record.metadata);

  if (estimatedMinutes !== undefined) {
    problem.estimatedMinutes = estimatedMinutes;
  }

  return problem;
}

function mapDatabaseDifficulty(
  difficulty: DatabaseProblemDifficulty,
): ProblemDifficulty {
  switch (difficulty) {
    case "EASY":
      return "easy";
    case "MEDIUM":
      return "medium";
    case "HARD":
    case "CHALLENGE":
      return "hard";
  }
}

function createEmptyStateMessages(input: {
  abilityProfile: AbilityProfile | null;
  recommendationBundle: RecommendationBundle;
  recentEvents: readonly LearningEvent[];
}): readonly string[] {
  const messages: string[] = [];

  if (input.abilityProfile === null) {
    messages.push(
      "能力画像预览不可用，因为演示数据库中没有已保存画像快照或足够的最近学习事件。",
    );
  }

  if (input.recentEvents.length === 0) {
    messages.push("演示用户的最近学习事件摘要为空。");
  }

  if (input.recommendationBundle.recommendationSource === "unavailable") {
    messages.push(
      "在演示数据库拥有能力画像快照和候选题目，或拥有已保存推荐快照前，每日推荐预览不可用。",
    );
  }

  return messages;
}

function uniquePartialReasons(
  reasons: readonly (LearningDashboardPartialReason | undefined)[],
): readonly LearningDashboardPartialReason[] {
  return [...new Set(reasons.filter(isPartialReason))];
}

function isPartialReason(
  reason: LearningDashboardPartialReason | undefined,
): reason is LearningDashboardPartialReason {
  return reason !== undefined;
}

function getQaFeedbackLearningEvents(
  preview: LearningQaFeedbackSignalPreview,
): readonly LearningEvent[] {
  return preview.status === "loaded" ? preview.learningEvents : [];
}

function createQaFeedbackAbilityPreviewImpact(input: {
  hasStoredAbilityProfile: boolean;
  includedInAbilityPreview: boolean;
  validSignalCount: number;
}) {
  if (input.includedInAbilityPreview) {
    return {
      status: "included" as const,
      message:
        "问答反馈信号仅纳入本次渲染的内存态能力预览。没有写入数据库。",
    };
  }

  if (input.hasStoredAbilityProfile && input.validSignalCount > 0) {
    return {
      status: "not_included" as const,
      message:
        "已保存数据库能力画像快照以只读方式展示，因此问答反馈信号会单独汇总，不会替代已保存分数。",
    };
  }

  return {
    status: "not_included" as const,
    message:
      "本次仪表盘渲染没有将问答反馈信号纳入能力预览。",
  };
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function normalizeScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(Math.min(Math.max(value, 0), 100).toFixed(2));
}

function readEstimatedMinutes(metadata: unknown): number | undefined {
  if (!isRecord(metadata)) {
    return undefined;
  }

  const estimatedMinutes = metadata.estimatedMinutes;

  if (typeof estimatedMinutes !== "number" || !Number.isFinite(estimatedMinutes)) {
    return undefined;
  }

  return Math.max(1, Math.round(estimatedMinutes));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
