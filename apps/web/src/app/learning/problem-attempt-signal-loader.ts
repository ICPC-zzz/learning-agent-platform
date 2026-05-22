import "server-only";

import {
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaProblemAttemptRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type { ProblemAttemptRepository } from "@learning-agent-platform/db";

import type { LearningDashboardFallbackReason } from "../../lib/learning-types";
import {
  mapProblemAttemptRecordsToLearningEvents,
  summarizeProblemAttemptRecords,
} from "./problem-attempt-signal-mapper";
import type {
  LearningProblemAttemptSignalPreview,
  LearningProblemAttemptSignalStatus,
} from "./problem-attempt-signal-types";

const demoUserEmail = "demo@example.com";
const defaultRecentProblemAttemptLimit = 20;

interface LoadLearningProblemAttemptSignalPreviewInput {
  previewAppliedToAbility: boolean;
  limit?: number;
}

interface LoadLearningProblemAttemptSignalPreviewForUserInput {
  userId: string;
  problemAttemptRepository: Pick<
    ProblemAttemptRepository,
    "listRecentProblemAttemptsByUser"
  >;
  previewAppliedToAbility: boolean;
  limit?: number;
}

export async function loadLearningProblemAttemptSignalPreview({
  previewAppliedToAbility,
  limit = defaultRecentProblemAttemptLimit,
}: LoadLearningProblemAttemptSignalPreviewInput): Promise<LearningProblemAttemptSignalPreview> {
  const envStatus = getDatabaseEnvStatus();

  if (!envStatus.hasDatabaseUrl) {
    return createLearningProblemAttemptSignalPreviewStatus({
      status: "database_unavailable",
      message:
        "ProblemAttempt 信号预览不可用，因为 DATABASE_URL 未配置。",
    });
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const problemAttemptRepository = new PrismaProblemAttemptRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return createLearningProblemAttemptSignalPreviewStatus({
        status: "demo_user_missing",
        message:
          "ProblemAttempt 信号预览无法在数据库中找到 demo@example.com。",
      });
    }

    return loadLearningProblemAttemptSignalPreviewForUser({
      userId: demoUser.id,
      problemAttemptRepository,
      previewAppliedToAbility,
      limit,
    });
  } catch {
    return createLearningProblemAttemptSignalPreviewStatus({
      status: "read_failed",
      message:
        "读取数据库时 ProblemAttempt 信号预览失败。仪表盘其余部分仍可渲染。",
    });
  }
}

export async function loadLearningProblemAttemptSignalPreviewForUser({
  userId,
  problemAttemptRepository,
  previewAppliedToAbility,
  limit = defaultRecentProblemAttemptLimit,
}: LoadLearningProblemAttemptSignalPreviewForUserInput): Promise<LearningProblemAttemptSignalPreview> {
  try {
    const attemptRecords =
      await problemAttemptRepository.listRecentProblemAttemptsByUser(
        userId,
        normalizeAttemptLimit(limit),
      );

    if (attemptRecords.length === 0) {
      return createLearningProblemAttemptSignalPreviewStatus({
        status: "attempts_empty",
        message:
          "演示用户没有可用的最近 ProblemAttempt 记录。空尝试不会被视为薄弱能力。",
      });
    }

    const learningEvents =
      mapProblemAttemptRecordsToLearningEvents(attemptRecords);
    const summary = summarizeProblemAttemptRecords(attemptRecords);

    return {
      status: "attempts_loaded",
      message: createLoadedMessage({
        attemptCount: summary.attemptCount,
        mappedSignalCount: learningEvents.length,
        attemptedOnlyCount: summary.attemptedOnlyCount,
        previewAppliedToAbility,
      }),
      attemptCount: summary.attemptCount,
      recentAttemptCount: summary.recentAttemptCount,
      solvedCount: summary.solvedCount,
      failedCount: summary.failedCount,
      attemptedOnlyCount: summary.attemptedOnlyCount,
      mappedSignalCount: learningEvents.length,
      latestAttemptAt: summary.latestAttemptAt,
      previewAppliedToAbility,
      learningEvents,
    };
  } catch {
    return createLearningProblemAttemptSignalPreviewStatus({
      status: "read_failed",
      message:
        "读取最近尝试时 ProblemAttempt 信号预览失败。能力与推荐保存不会改变。",
    });
  }
}

export function createLearningProblemAttemptSignalPreviewForFallbackReason(
  reason: LearningDashboardFallbackReason,
): LearningProblemAttemptSignalPreview {
  switch (reason) {
    case "missing_database_url":
      return createLearningProblemAttemptSignalPreviewStatus({
        status: "database_unavailable",
        message:
          "ProblemAttempt 信号预览不可用，因为 DATABASE_URL 未配置。",
      });
    case "no_demo_user_found":
      return createLearningProblemAttemptSignalPreviewStatus({
        status: "demo_user_missing",
        message:
          "ProblemAttempt 信号预览无法在数据库中找到 demo@example.com。",
      });
    case "database_read_failed":
      return createLearningProblemAttemptSignalPreviewStatus({
        status: "read_failed",
        message:
          "ProblemAttempt 信号预览不可用，因为仪表盘数据库读取失败。",
      });
    case "no_ability_profile_found":
    case "no_daily_recommendations_found":
      return createLearningProblemAttemptSignalPreviewStatus({
        status: "unavailable",
        message:
          "仪表盘正在使用回退数据，ProblemAttempt 信号预览不可用。",
      });
  }
}

export function withLearningProblemAttemptSignalPreviewAbilityImpact(
  preview: LearningProblemAttemptSignalPreview,
  previewAppliedToAbility: boolean,
): LearningProblemAttemptSignalPreview {
  const applied =
    preview.status === "attempts_loaded" &&
    preview.mappedSignalCount > 0 &&
    previewAppliedToAbility;

  if (preview.status !== "attempts_loaded") {
    return {
      ...preview,
      previewAppliedToAbility: false,
    };
  }

  return {
    ...preview,
    previewAppliedToAbility: applied,
    message: createLoadedMessage({
      attemptCount: preview.attemptCount,
      mappedSignalCount: preview.mappedSignalCount,
      attemptedOnlyCount: preview.attemptedOnlyCount,
      previewAppliedToAbility: applied,
    }),
  };
}

function createLearningProblemAttemptSignalPreviewStatus({
  status,
  message,
}: {
  status: LearningProblemAttemptSignalStatus;
  message: string;
}): LearningProblemAttemptSignalPreview {
  return {
    status,
    message,
    attemptCount: 0,
    recentAttemptCount: 0,
    solvedCount: 0,
    failedCount: 0,
    attemptedOnlyCount: 0,
    mappedSignalCount: 0,
    previewAppliedToAbility: false,
    learningEvents: [],
  };
}

function createLoadedMessage({
  attemptCount,
  mappedSignalCount,
  attemptedOnlyCount,
  previewAppliedToAbility,
}: {
  attemptCount: number;
  mappedSignalCount: number;
  attemptedOnlyCount: number;
  previewAppliedToAbility: boolean;
}): string {
  const baseMessage = `已为演示用户读取 ${attemptCount} 条最近 ProblemAttempt 记录，并映射 ${mappedSignalCount} 条 problem_attempt 预览信号。`;
  const attemptedOnlyMessage =
    attemptedOnlyCount > 0
      ? ` ${attemptedOnlyCount} 条仅尝试记录的正确性未知，未映射为评分信号。`
      : "";

  if (previewAppliedToAbility) {
    return `${baseMessage}${attemptedOnlyMessage} 这些信号仅纳入本次渲染的内存态能力预览，不会写入数据库。`;
  }

  return `${baseMessage}${attemptedOnlyMessage} 这些信号会单独汇总，不会替代已保存的数据库能力画像，也不会触发自动反馈闭环。`;
}

function normalizeAttemptLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return defaultRecentProblemAttemptLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}
