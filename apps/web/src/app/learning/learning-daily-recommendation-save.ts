import "server-only";

import {
  calculateAbilityProfile,
  recommendDailyProblems,
  type AbilityProfile,
  type LearningEvent,
  type ProblemDifficulty,
  type RecommendationProblem,
  type RecommendationResult,
  type RecentProblemAttempt,
} from "@learning-agent-platform/learning-engine";
import {
  createDailyRecommendationsInputFromRecommendationResult,
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaChapterQaFeedbackRepository,
  PrismaChapterQaHistoryRepository,
  PrismaLearningRepository,
  PrismaProblemAttemptRepository,
  PrismaReadingProgressRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type {
  AbilityProfileRecord,
  ProblemAttemptRepository,
  ProblemDifficulty as DatabaseProblemDifficulty,
  ProblemRecord,
  ReadingProgressRecord,
} from "@learning-agent-platform/db";

import { loadLearningQaFeedbackSignalPreviewForUser } from "../../lib/learning-qa-feedback-signal-loader";
import type {
  LearningDailyRecommendationAbilityProfileSource,
  LearningDailyRecommendationFallbackReason,
  LearningDailyRecommendationSaveResult,
} from "./learning-daily-recommendation-save-types";
import { mapProblemAttemptRecordsToRecommendationHistory } from "./problem-attempt-recommendation-history-mapper";
import type { LearningProblemAttemptSignalStatus } from "./problem-attempt-signal-types";

const demoUserEmail = "demo@example.com";
const candidateProblemLimit = 100;
const readingProgressLimit = 50;
const qaFeedbackHistoryLimit = 20;
const problemAttemptLimit = 20;

interface AbilityProfileForRecommendation {
  profile: AbilityProfile | null;
  source: LearningDailyRecommendationAbilityProfileSource;
  savedProfileAvailable: boolean;
  abilityProfileId?: string;
  abilityProfileUpdatedAt?: string;
  fallbackUsed: boolean;
  fallbackReason?: LearningDailyRecommendationFallbackReason;
  usedQaFeedbackSignals: boolean;
  qaFeedbackSignalCount: number;
}

interface ProblemAttemptHistoryForRecommendation {
  status: LearningProblemAttemptSignalStatus;
  recentAttempts: readonly RecentProblemAttempt[];
  recentProblemAttemptCount: number;
  recentProblemAttemptUsedForRecommendation: boolean;
  solvedProblemCount: number;
}

export async function recomputeAndSaveDailyRecommendation(): Promise<LearningDailyRecommendationSaveResult> {
  if (!getDatabaseEnvStatus().hasDatabaseUrl) {
      return createSaveResult({
        status: "database_unavailable",
        message:
          "每日推荐未保存，因为 DATABASE_URL 未配置。",
        fallbackReason: "database_unavailable",
        problemAttemptHistoryStatus: "database_unavailable",
      });
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const learningRepository = new PrismaLearningRepository(prisma);
    const readingProgressRepository = new PrismaReadingProgressRepository(prisma);
    const problemAttemptRepository = new PrismaProblemAttemptRepository(prisma);
    const qaHistoryRepository = new PrismaChapterQaHistoryRepository(prisma);
    const qaFeedbackRepository = new PrismaChapterQaFeedbackRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return createSaveResult({
        status: "demo_user_missing",
        message:
          "每日推荐未保存，因为未找到 demo@example.com。",
        fallbackReason: "demo_user_missing",
        problemAttemptHistoryStatus: "demo_user_missing",
      });
    }

    const [
      storedAbilityProfile,
      candidateProblemRecords,
      problemAttemptHistory,
    ] = await Promise.all([
      learningRepository.getAbilityProfile(demoUser.id),
      learningRepository.listProblems({ limit: candidateProblemLimit }),
      readProblemAttemptHistoryForRecommendation({
        userId: demoUser.id,
        problemAttemptRepository,
        limit: problemAttemptLimit,
      }),
    ]);
    const abilityProfileResult = await resolveAbilityProfileForRecommendation({
      storedAbilityProfile,
      userId: demoUser.id,
      readingProgressRepository,
      qaHistoryRepository,
      qaFeedbackRepository,
    });
    const candidateProblems = candidateProblemRecords.map(
      mapDatabaseProblemToRecommendationProblem,
    );
    const baseResult = {
      candidateProblemCount: candidateProblems.length,
      abilityProfileSource: abilityProfileResult.source,
      savedProfileAvailable: abilityProfileResult.savedProfileAvailable,
      abilityProfileId: abilityProfileResult.abilityProfileId,
      abilityProfileUpdatedAt: abilityProfileResult.abilityProfileUpdatedAt,
      fallbackUsed: abilityProfileResult.fallbackUsed,
      fallbackReason: abilityProfileResult.fallbackReason,
      usedQaFeedbackSignals: abilityProfileResult.usedQaFeedbackSignals,
      qaFeedbackSignalCount: abilityProfileResult.qaFeedbackSignalCount,
      problemAttemptHistoryStatus: problemAttemptHistory.status,
      recentProblemAttemptCount:
        problemAttemptHistory.recentProblemAttemptCount,
      recentProblemAttemptUsedForRecommendation:
        problemAttemptHistory.recentProblemAttemptUsedForRecommendation,
      solvedProblemCount: problemAttemptHistory.solvedProblemCount,
    };

    if (abilityProfileResult.profile === null) {
      return createSaveResult({
        ...baseResult,
        status: "missing_ability_profile",
        message:
          "每日推荐未保存，因为没有可用的已保存或预览能力画像。",
      });
    }

    if (candidateProblems.length === 0) {
      return createSaveResult({
        ...baseResult,
        status: "missing_candidate_problems",
        message:
          "每日推荐未保存，因为数据库中没有可用候选题目。",
      });
    }

    const recommendationDate = startOfLocalDay(new Date());
    const recommendationResult = recommendDailyProblemsSafely({
      abilityProfile: abilityProfileResult.profile,
      candidateProblems,
      recentAttempts: problemAttemptHistory.recentAttempts,
      targetDate: recommendationDate,
    });

    if (recommendationResult === null) {
      return createSaveResult({
        ...baseResult,
        status: "recommendation_failed",
        message:
          "每日推荐未保存，因为推荐计算失败。",
      });
    }

    if (recommendationResult.recommendedProblems.length === 0) {
      return createSaveResult({
        ...baseResult,
        status: "insufficient_data",
        message:
          "每日推荐未保存，因为推荐引擎没有返回题目。",
        recommendationCount: 0,
      });
    }

    const recommendationCount = recommendationResult.recommendedProblems.length;
    const savedRecommendations =
      await learningRepository.upsertDailyRecommendations(
        createDailyRecommendationsInputFromRecommendationResult({
          userId: demoUser.id,
          result: recommendationResult,
          recommendationDate,
          status: "pending",
        }),
      );

    if (savedRecommendations.length === 0) {
      return createSaveResult({
        ...baseResult,
        status: "save_failed",
        message:
          "每日推荐未保存，因为 repository 没有返回已保存记录。",
        recommendationCount,
      });
    }

    const recommendationIds = savedRecommendations.map(
      (recommendation) => recommendation.id,
    );

    return createSaveResult({
      ...baseResult,
      status: "saved",
      message: createSavedMessage(
        abilityProfileResult.source,
        problemAttemptHistory.recentProblemAttemptUsedForRecommendation,
      ),
      recommendationId: recommendationIds[0],
      recommendationIds,
      recommendationCount,
      recommendedProblemCount: recommendationCount,
      savedRecommendationCount: savedRecommendations.length,
      savedAt: getLatestUpdatedAt(savedRecommendations),
    });
  } catch {
    return createSaveResult({
      status: "save_failed",
      message:
        "每日推荐未保存，因为数据库读取或写入失败。",
    });
  }
}

async function readProblemAttemptHistoryForRecommendation({
  userId,
  problemAttemptRepository,
  limit,
}: {
  userId: string;
  problemAttemptRepository: Pick<
    ProblemAttemptRepository,
    "listRecentProblemAttemptsByUser"
  >;
  limit: number;
}): Promise<ProblemAttemptHistoryForRecommendation> {
  try {
    const records =
      await problemAttemptRepository.listRecentProblemAttemptsByUser(
        userId,
        normalizeProblemAttemptLimit(limit),
      );

    if (records.length === 0) {
      return createProblemAttemptHistoryForRecommendation("attempts_empty");
    }

    const mappedHistory =
      mapProblemAttemptRecordsToRecommendationHistory(records);

    return {
      status: "attempts_loaded",
      recentAttempts: mappedHistory.recentAttempts,
      recentProblemAttemptCount: mappedHistory.recentProblemAttemptCount,
      recentProblemAttemptUsedForRecommendation:
        mappedHistory.recentProblemAttemptUsedForRecommendation,
      solvedProblemCount: mappedHistory.solvedProblemCount,
    };
  } catch {
    return createProblemAttemptHistoryForRecommendation("read_failed");
  }
}

function createProblemAttemptHistoryForRecommendation(
  status: LearningProblemAttemptSignalStatus,
): ProblemAttemptHistoryForRecommendation {
  return {
    status,
    recentAttempts: [],
    recentProblemAttemptCount: 0,
    recentProblemAttemptUsedForRecommendation: false,
    solvedProblemCount: 0,
  };
}

async function resolveAbilityProfileForRecommendation({
  storedAbilityProfile,
  userId,
  readingProgressRepository,
  qaHistoryRepository,
  qaFeedbackRepository,
}: {
  storedAbilityProfile: AbilityProfileRecord | null;
  userId: string;
  readingProgressRepository: PrismaReadingProgressRepository;
  qaHistoryRepository: PrismaChapterQaHistoryRepository;
  qaFeedbackRepository: PrismaChapterQaFeedbackRepository;
}): Promise<AbilityProfileForRecommendation> {
  if (storedAbilityProfile !== null) {
    const profile = mapStoredAbilityProfileToLearningProfile(storedAbilityProfile);
    const abilityProfileUpdatedAt = getStoredAbilityProfileUpdatedAt(
      storedAbilityProfile,
    );

    if (!isValidAbilityProfile(profile)) {
      return {
        profile: null,
        source: "unavailable",
        savedProfileAvailable: true,
        abilityProfileId: storedAbilityProfile.id,
        abilityProfileUpdatedAt,
        fallbackUsed: false,
        fallbackReason: "invalid_saved_ability_profile",
        usedQaFeedbackSignals: false,
        qaFeedbackSignalCount: 0,
      };
    }

    return {
      profile,
      source: "database_saved",
      savedProfileAvailable: true,
      abilityProfileId: storedAbilityProfile.id,
      abilityProfileUpdatedAt,
      fallbackUsed: false,
      usedQaFeedbackSignals: false,
      qaFeedbackSignalCount: 0,
    };
  }

  return resolvePreviewAbilityProfileForRecommendation({
    userId,
    readingProgressRepository,
    qaHistoryRepository,
    qaFeedbackRepository,
  });
}

async function resolvePreviewAbilityProfileForRecommendation({
  userId,
  readingProgressRepository,
  qaHistoryRepository,
  qaFeedbackRepository,
}: {
  userId: string;
  readingProgressRepository: PrismaReadingProgressRepository;
  qaHistoryRepository: PrismaChapterQaHistoryRepository;
  qaFeedbackRepository: PrismaChapterQaFeedbackRepository;
}): Promise<AbilityProfileForRecommendation> {
  const [readingProgressRecords, qaFeedbackPreview] = await Promise.all([
    readingProgressRepository.listReadingProgress({
      userId,
      limit: readingProgressLimit,
    }),
    loadLearningQaFeedbackSignalPreviewForUser({
      userId,
      historyRepository: qaHistoryRepository,
      feedbackRepository: qaFeedbackRepository,
      limit: qaFeedbackHistoryLimit,
    }),
  ]);
  const qaFeedbackEvents =
    qaFeedbackPreview.status === "loaded" ? qaFeedbackPreview.learningEvents : [];
  const readingEvents =
    mapReadingProgressRecordsToLearningEvents(readingProgressRecords);
  const inputEvents: readonly LearningEvent[] = [
    ...readingEvents,
    ...qaFeedbackEvents,
  ];

  if (inputEvents.length === 0) {
    return {
      profile: null,
      source: "unavailable",
      savedProfileAvailable: false,
      fallbackUsed: true,
      fallbackReason: "no_preview_learning_events",
      usedQaFeedbackSignals: false,
      qaFeedbackSignalCount: qaFeedbackEvents.length,
    };
  }

  try {
    const scoringResult = calculateAbilityProfile({ events: inputEvents });
    const profile = scoringResult.eventCount > 0 ? scoringResult.profile : null;

    return {
      profile:
        profile !== null && isValidAbilityProfile(profile) ? profile : null,
      source:
        profile !== null && isValidAbilityProfile(profile)
          ? "engine_preview"
          : "unavailable",
      savedProfileAvailable: false,
      fallbackUsed: true,
      fallbackReason:
        profile !== null && isValidAbilityProfile(profile)
          ? "no_saved_ability_profile"
          : "preview_calculation_failed",
      usedQaFeedbackSignals: qaFeedbackEvents.length > 0,
      qaFeedbackSignalCount: qaFeedbackEvents.length,
    };
  } catch {
    return {
      profile: null,
      source: "unavailable",
      savedProfileAvailable: false,
      fallbackUsed: true,
      fallbackReason: "preview_calculation_failed",
      usedQaFeedbackSignals: false,
      qaFeedbackSignalCount: qaFeedbackEvents.length,
    };
  }
}

function recommendDailyProblemsSafely(input: {
  abilityProfile: AbilityProfile;
  candidateProblems: readonly RecommendationProblem[];
  recentAttempts: readonly RecentProblemAttempt[];
  targetDate: Date;
}): RecommendationResult | null {
  try {
    return recommendDailyProblems({
      abilityProfile: input.abilityProfile,
      candidateProblems: input.candidateProblems,
      recentAttempts: input.recentAttempts,
      targetDate: input.targetDate,
    });
  } catch {
    return null;
  }
}

function mapReadingProgressRecordsToLearningEvents(
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

function mapStoredAbilityProfileToLearningProfile(
  record: AbilityProfileRecord,
): AbilityProfile {
  return {
    overallScore: normalizeScore(record.overallScore),
    algorithmScore: normalizeScore(record.algorithmScore),
    debuggingScore: normalizeScore(record.debuggingScore),
    systemDesignScore: normalizeScore(record.systemDesignScore),
    readingScore: normalizeScore(record.languageFundamentalsScore),
    updatedAt: getStoredAbilityProfileUpdatedAt(record),
    confidence: 0,
  };
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

function isValidAbilityProfile(profile: AbilityProfile): boolean {
  return (
    isScore(profile.overallScore) &&
    isScore(profile.algorithmScore) &&
    isScore(profile.debuggingScore) &&
    isScore(profile.systemDesignScore) &&
    isScore(profile.readingScore) &&
    Number.isFinite(profile.confidence) &&
    profile.confidence >= 0 &&
    profile.confidence <= 1 &&
    profile.updatedAt.trim().length > 0
  );
}

function isScore(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function normalizeScore(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
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

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function normalizeProblemAttemptLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return problemAttemptLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

function getLatestUpdatedAt(
  records: readonly { updatedAt: Date }[],
): string | undefined {
  if (records.length === 0) {
    return undefined;
  }

  return new Date(
    Math.max(...records.map((record) => record.updatedAt.getTime())),
  ).toISOString();
}

function getStoredAbilityProfileUpdatedAt(record: AbilityProfileRecord): string {
  return (record.lastEvaluatedAt ?? record.updatedAt).toISOString();
}

function createSavedMessage(
  source: LearningDailyRecommendationAbilityProfileSource,
  usedProblemAttemptHistory: boolean,
): string {
  const historyMessage = usedProblemAttemptHistory
    ? " 已纳入最近 ProblemAttempt 历史。"
    : "";

  if (source === "database_saved") {
    return `已基于最新保存的 AbilityProfile 保存每日推荐。${historyMessage}刷新页面即可查看最新已保存推荐列表。`;
  }

  return `已基于可用的能力画像回退结果保存每日推荐。${historyMessage}刷新页面即可查看最新已保存推荐列表。`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createSaveResult(
  input: Partial<
    Pick<
      LearningDailyRecommendationSaveResult,
      | "recommendationId"
      | "recommendationIds"
      | "recommendationCount"
      | "recommendedProblemCount"
      | "savedRecommendationCount"
      | "candidateProblemCount"
      | "abilityProfileSource"
      | "savedProfileAvailable"
      | "abilityProfileId"
      | "abilityProfileUpdatedAt"
      | "fallbackUsed"
      | "fallbackReason"
      | "savedAt"
      | "usedQaFeedbackSignals"
      | "qaFeedbackSignalCount"
      | "problemAttemptHistoryStatus"
      | "recentProblemAttemptCount"
      | "recentProblemAttemptUsedForRecommendation"
      | "solvedProblemCount"
    >
  > &
    Pick<LearningDailyRecommendationSaveResult, "status" | "message">,
): LearningDailyRecommendationSaveResult {
  return {
    ...input,
    recommendationCount:
      input.recommendationCount ?? input.recommendedProblemCount ?? 0,
    recommendedProblemCount:
      input.recommendedProblemCount ?? input.recommendationCount ?? 0,
    savedRecommendationCount: input.savedRecommendationCount ?? 0,
    candidateProblemCount: input.candidateProblemCount ?? 0,
    abilityProfileSource: input.abilityProfileSource ?? "unavailable",
    savedProfileAvailable: input.savedProfileAvailable ?? false,
    fallbackUsed: input.fallbackUsed ?? false,
    usedQaFeedbackSignals: input.usedQaFeedbackSignals ?? false,
    qaFeedbackSignalCount: input.qaFeedbackSignalCount ?? 0,
    problemAttemptHistoryStatus:
      input.problemAttemptHistoryStatus ?? "unavailable",
    recentProblemAttemptCount: input.recentProblemAttemptCount ?? 0,
    recentProblemAttemptUsedForRecommendation:
      input.recentProblemAttemptUsedForRecommendation ?? false,
    solvedProblemCount: input.solvedProblemCount ?? 0,
  };
}
