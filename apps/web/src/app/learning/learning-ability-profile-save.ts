import "server-only";

import {
  calculateAbilityProfile,
  type AbilityProfile,
  type AbilityScoringResult,
  type LearningEvent,
} from "@learning-agent-platform/learning-engine";
import {
  createAbilityProfileInputFromScoringResult,
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaChapterQaFeedbackRepository,
  PrismaChapterQaHistoryRepository,
  PrismaLearningRepository,
  PrismaProblemAttemptRepository,
  PrismaReadingProgressRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type { AbilityProfileRecord } from "@learning-agent-platform/db";

import { loadLearningQaFeedbackSignalPreviewForUser } from "../../lib/learning-qa-feedback-signal-loader";
import type { LearningAbilityProfileSaveResult } from "./learning-ability-profile-save-types";
import { loadLearningProblemAttemptSignalPreviewForUser } from "./problem-attempt-signal-loader";
import type { LearningProblemAttemptSignalStatus } from "./problem-attempt-signal-types";
import { loadLearningReadingProgressSignalPreviewForUser } from "./reading-progress-signal-loader";
import type { LearningReadingProgressSignalStatus } from "./reading-progress-signal-types";

const demoUserEmail = "demo@example.com";
const readingProgressLimit = 50;
const qaFeedbackHistoryLimit = 20;
const problemAttemptLimit = 20;

export async function recomputeAndSaveLearningAbilityProfile(): Promise<LearningAbilityProfileSaveResult> {
  if (!getDatabaseEnvStatus().hasDatabaseUrl) {
    return createSaveResult({
      status: "database_unavailable",
      message:
        "能力画像未保存，因为 DATABASE_URL 未配置。",
      readingProgressStatus: "database_unavailable",
      problemAttemptStatus: "database_unavailable",
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
          "能力画像未保存，因为未找到 demo@example.com。",
        readingProgressStatus: "demo_user_missing",
        problemAttemptStatus: "demo_user_missing",
      });
    }

    const [
      storedAbilityProfile,
      qaFeedbackPreview,
      readingProgressPreview,
      problemAttemptPreview,
    ] = await Promise.all([
      learningRepository.getAbilityProfile(demoUser.id),
      loadLearningQaFeedbackSignalPreviewForUser({
        userId: demoUser.id,
        historyRepository: qaHistoryRepository,
        feedbackRepository: qaFeedbackRepository,
        limit: qaFeedbackHistoryLimit,
      }),
      loadLearningReadingProgressSignalPreviewForUser({
        userId: demoUser.id,
        readingProgressRepository,
        previewAppliedToAbility: true,
        limit: readingProgressLimit,
      }),
      loadLearningProblemAttemptSignalPreviewForUser({
        userId: demoUser.id,
        problemAttemptRepository,
        previewAppliedToAbility: true,
        limit: problemAttemptLimit,
      }),
    ]);
    const qaFeedbackEvents =
      qaFeedbackPreview.status === "loaded" ? qaFeedbackPreview.learningEvents : [];
    const readingProgressEvents =
      readingProgressPreview.status === "progress_loaded"
        ? readingProgressPreview.learningEvents
        : [];
    const problemAttemptEvents =
      problemAttemptPreview.status === "attempts_loaded"
        ? problemAttemptPreview.learningEvents
        : [];
    const baseLearningEvents: readonly LearningEvent[] = [];
    const inputEvents: readonly LearningEvent[] = [
      ...baseLearningEvents,
      ...qaFeedbackEvents,
      ...readingProgressEvents,
      ...problemAttemptEvents,
    ];
    const qaFeedbackSignalCount = qaFeedbackEvents.length;
    const readingProgressSignalCount =
      readingProgressPreview.mappedSignalCount;
    const problemAttemptSignalCount =
      problemAttemptPreview.mappedSignalCount;
    const previewIncludedQaFeedbackSignals = qaFeedbackSignalCount > 0;
    const readingProgressAppliedToSavedProfile =
      readingProgressPreview.status === "progress_loaded" &&
      readingProgressSignalCount > 0;
    const problemAttemptAppliedToSavedProfile =
      problemAttemptPreview.status === "attempts_loaded" &&
      problemAttemptSignalCount > 0;

    if (inputEvents.length === 0) {
      return createSaveResult({
        status: "insufficient_data",
        message:
          "能力画像未保存，因为没有可用于评分的学习事件、问答反馈信号、ReadingProgress 信号或 ProblemAttempt 信号。",
        inputEventCount: 0,
        qaFeedbackSignalCount,
        readingProgressSignalCount,
        readingProgressAppliedToSavedProfile: false,
        readingProgressStatus: readingProgressPreview.status,
        problemAttemptSignalCount,
        problemAttemptAppliedToSavedProfile: false,
        problemAttemptStatus: problemAttemptPreview.status,
        previewIncludedQaFeedbackSignals,
      });
    }

    const scoringResult = calculateAbilityProfileSafely({
      events: inputEvents,
      previousProfile:
        mapStoredAbilityProfileToLearningProfile(storedAbilityProfile),
    });

    if (scoringResult === null || !isValidAbilityProfile(scoringResult.profile)) {
      return createSaveResult({
        status: "calculation_failed",
        message:
          "能力画像未保存，因为评分计算失败。",
        inputEventCount: inputEvents.length,
        qaFeedbackSignalCount,
        readingProgressSignalCount,
        readingProgressAppliedToSavedProfile: false,
        readingProgressStatus: readingProgressPreview.status,
        problemAttemptSignalCount,
        problemAttemptAppliedToSavedProfile: false,
        problemAttemptStatus: problemAttemptPreview.status,
        previewIncludedQaFeedbackSignals,
      });
    }

    if (scoringResult.eventCount === 0) {
      return createSaveResult({
        status: "insufficient_data",
        message:
          "能力画像未保存，因为评分输入不包含有效学习事件。",
        inputEventCount: 0,
        qaFeedbackSignalCount,
        readingProgressSignalCount,
        readingProgressAppliedToSavedProfile: false,
        readingProgressStatus: readingProgressPreview.status,
        problemAttemptSignalCount,
        problemAttemptAppliedToSavedProfile: false,
        problemAttemptStatus: problemAttemptPreview.status,
        previewIncludedQaFeedbackSignals,
      });
    }

    const scoringResultForSave = withSaveMetadata(scoringResult, {
      inputEventCount: scoringResult.eventCount,
      qaFeedbackSignalCount,
      readingProgressSignalCount,
      readingProgressAppliedToSavedProfile,
      readingProgressStatus: readingProgressPreview.status,
      problemAttemptSignalCount,
      problemAttemptAppliedToSavedProfile,
      problemAttemptStatus: problemAttemptPreview.status,
      previewIncludedQaFeedbackSignals,
      qaFeedbackSignalStatus: qaFeedbackPreview.status,
    });
    const savedProfile = await learningRepository.upsertAbilityProfile(
      createAbilityProfileInputFromScoringResult({
        userId: demoUser.id,
        scoringResult: scoringResultForSave,
      }),
    );

    return createSaveResult({
      status: "saved",
      message:
        "能力画像演示快照已保存。刷新页面即可在仪表盘中查看最新已保存快照；这不会启动自动画像闭环。",
      profileId: savedProfile.id,
      inputEventCount: scoringResult.eventCount,
      qaFeedbackSignalCount,
      readingProgressSignalCount,
      readingProgressAppliedToSavedProfile,
      readingProgressStatus: readingProgressPreview.status,
      problemAttemptSignalCount,
      problemAttemptAppliedToSavedProfile,
      problemAttemptStatus: problemAttemptPreview.status,
      savedAt: savedProfile.updatedAt.toISOString(),
      previewIncludedQaFeedbackSignals,
    });
  } catch {
    return createSaveResult({
      status: "save_failed",
      message:
        "能力画像未保存，因为数据库读取或写入失败。",
    });
  }
}

function calculateAbilityProfileSafely(input: {
  events: readonly LearningEvent[];
  previousProfile?: AbilityProfile;
}): AbilityScoringResult | null {
  try {
    return calculateAbilityProfile(input);
  } catch {
    return null;
  }
}

function mapStoredAbilityProfileToLearningProfile(
  record: AbilityProfileRecord | null,
): AbilityProfile | undefined {
  if (record === null) {
    return undefined;
  }

  const updatedAt = record.lastEvaluatedAt ?? record.updatedAt;

  return {
    overallScore: normalizeScore(record.overallScore),
    algorithmScore: normalizeScore(record.algorithmScore),
    debuggingScore: normalizeScore(record.debuggingScore),
    systemDesignScore: normalizeScore(record.systemDesignScore),
    readingScore: normalizeScore(record.languageFundamentalsScore),
    updatedAt: updatedAt.toISOString(),
    confidence: 0,
  };
}

function withSaveMetadata(
  scoringResult: AbilityScoringResult,
  metadata: {
    inputEventCount: number;
    qaFeedbackSignalCount: number;
    readingProgressSignalCount: number;
    readingProgressAppliedToSavedProfile: boolean;
    readingProgressStatus: LearningReadingProgressSignalStatus;
    problemAttemptSignalCount: number;
    problemAttemptAppliedToSavedProfile: boolean;
    problemAttemptStatus: LearningProblemAttemptSignalStatus;
    previewIncludedQaFeedbackSignals: boolean;
    qaFeedbackSignalStatus: string;
  },
): AbilityScoringResult {
  const profileMetadata: NonNullable<AbilityProfile["metadata"]> = {
    source: "learning_dashboard_ability_profile_save",
    inputEventCount: metadata.inputEventCount,
    qaFeedbackSignalCount: metadata.qaFeedbackSignalCount,
    readingProgressSignalCount: metadata.readingProgressSignalCount,
    readingProgressAppliedToSavedProfile:
      metadata.readingProgressAppliedToSavedProfile,
    readingProgressStatus: metadata.readingProgressStatus,
    problemAttemptSignalCount: metadata.problemAttemptSignalCount,
    problemAttemptAppliedToSavedProfile:
      metadata.problemAttemptAppliedToSavedProfile,
    problemAttemptStatus: metadata.problemAttemptStatus,
    previewIncludedQaFeedbackSignals:
      metadata.previewIncludedQaFeedbackSignals,
    qaFeedbackSignalStatus: metadata.qaFeedbackSignalStatus,
    scoringWarnings: [...scoringResult.warnings],
  };

  return {
    ...scoringResult,
    profile: {
      ...scoringResult.profile,
      metadata: profileMetadata,
    },
  };
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

function normalizeScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(Math.min(Math.max(value, 0), 100).toFixed(2));
}

function createSaveResult(
  input: Omit<
    LearningAbilityProfileSaveResult,
    | "previewIncludedQaFeedbackSignals"
    | "readingProgressSignalCount"
    | "readingProgressAppliedToSavedProfile"
    | "readingProgressStatus"
    | "problemAttemptSignalCount"
    | "problemAttemptAppliedToSavedProfile"
    | "problemAttemptStatus"
  > & {
    previewIncludedQaFeedbackSignals?: boolean;
    readingProgressSignalCount?: number;
    readingProgressAppliedToSavedProfile?: boolean;
    readingProgressStatus?: LearningReadingProgressSignalStatus;
    problemAttemptSignalCount?: number;
    problemAttemptAppliedToSavedProfile?: boolean;
    problemAttemptStatus?: LearningProblemAttemptSignalStatus;
  },
): LearningAbilityProfileSaveResult {
  return {
    ...input,
    inputEventCount: input.inputEventCount ?? 0,
    qaFeedbackSignalCount: input.qaFeedbackSignalCount ?? 0,
    readingProgressSignalCount: input.readingProgressSignalCount ?? 0,
    readingProgressAppliedToSavedProfile:
      input.readingProgressAppliedToSavedProfile ?? false,
    readingProgressStatus: input.readingProgressStatus ?? "unavailable",
    problemAttemptSignalCount: input.problemAttemptSignalCount ?? 0,
    problemAttemptAppliedToSavedProfile:
      input.problemAttemptAppliedToSavedProfile ?? false,
    problemAttemptStatus: input.problemAttemptStatus ?? "unavailable",
    previewIncludedQaFeedbackSignals:
      input.previewIncludedQaFeedbackSignals ?? false,
  };
}
