import "server-only";

import {
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaReadingProgressRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type { ReadingProgressRepository } from "@learning-agent-platform/db";

import type { LearningDashboardFallbackReason } from "../../lib/learning-types";
import {
  mapReadingProgressRecordsToLearningEvents,
  summarizeReadingProgressRecords,
} from "./reading-progress-signal-mapper";
import type {
  LearningReadingProgressSignalPreview,
  LearningReadingProgressSignalStatus,
} from "./reading-progress-signal-types";

const demoUserEmail = "demo@example.com";
const defaultReadingProgressLimit = 50;

interface LoadLearningReadingProgressSignalPreviewInput {
  previewAppliedToAbility: boolean;
  limit?: number;
}

interface LoadLearningReadingProgressSignalPreviewForUserInput {
  userId: string;
  readingProgressRepository: Pick<
    ReadingProgressRepository,
    "listReadingProgress"
  >;
  previewAppliedToAbility: boolean;
  limit?: number;
}

export async function loadLearningReadingProgressSignalPreview({
  previewAppliedToAbility,
  limit = defaultReadingProgressLimit,
}: LoadLearningReadingProgressSignalPreviewInput): Promise<LearningReadingProgressSignalPreview> {
  const envStatus = getDatabaseEnvStatus();

  if (!envStatus.hasDatabaseUrl) {
    return createLearningReadingProgressSignalPreviewStatus({
      status: "database_unavailable",
      message:
        "ReadingProgress 信号预览不可用，因为 DATABASE_URL 未配置。",
    });
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const readingProgressRepository = new PrismaReadingProgressRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return createLearningReadingProgressSignalPreviewStatus({
        status: "demo_user_missing",
        message:
          "ReadingProgress 信号预览无法在数据库中找到 demo@example.com。",
      });
    }

    return loadLearningReadingProgressSignalPreviewForUser({
      userId: demoUser.id,
      readingProgressRepository,
      previewAppliedToAbility,
      limit,
    });
  } catch {
    return createLearningReadingProgressSignalPreviewStatus({
      status: "read_failed",
      message:
        "读取数据库时 ReadingProgress 信号预览失败。仪表盘其余部分仍可渲染。",
    });
  }
}

export async function loadLearningReadingProgressSignalPreviewForUser({
  userId,
  readingProgressRepository,
  previewAppliedToAbility,
  limit = defaultReadingProgressLimit,
}: LoadLearningReadingProgressSignalPreviewForUserInput): Promise<LearningReadingProgressSignalPreview> {
  try {
    const progressRecords =
      await readingProgressRepository.listReadingProgress({
        userId,
        limit: normalizeProgressLimit(limit),
      });

    if (progressRecords.length === 0) {
      return createLearningReadingProgressSignalPreviewStatus({
        status: "progress_empty",
        message:
          "演示用户没有可用的 ReadingProgress 记录。空进度不会被视为薄弱能力。",
      });
    }

    const learningEvents =
      mapReadingProgressRecordsToLearningEvents(progressRecords);
    const summary = summarizeReadingProgressRecords(progressRecords);

    return {
      status: "progress_loaded",
      message: createLoadedMessage({
        progressCount: summary.progressCount,
        mappedSignalCount: learningEvents.length,
        previewAppliedToAbility,
      }),
      progressCount: summary.progressCount,
      completedChapterCount: summary.completedChapterCount,
      activeBookCount: summary.activeBookCount,
      latestProgressUpdatedAt: summary.latestProgressUpdatedAt,
      mappedSignalCount: learningEvents.length,
      previewAppliedToAbility,
      learningEvents,
    };
  } catch {
    return createLearningReadingProgressSignalPreviewStatus({
      status: "read_failed",
      message:
        "读取数据库时 ReadingProgress 信号预览失败。AbilityProfile 保存仍可在不含这些信号的情况下继续。",
    });
  }
}

export function createLearningReadingProgressSignalPreviewForFallbackReason(
  reason: LearningDashboardFallbackReason,
): LearningReadingProgressSignalPreview {
  switch (reason) {
    case "missing_database_url":
      return createLearningReadingProgressSignalPreviewStatus({
        status: "database_unavailable",
        message:
          "ReadingProgress 信号预览不可用，因为 DATABASE_URL 未配置。",
      });
    case "no_demo_user_found":
      return createLearningReadingProgressSignalPreviewStatus({
        status: "demo_user_missing",
        message:
          "ReadingProgress 信号预览无法在数据库中找到 demo@example.com。",
      });
    case "database_read_failed":
      return createLearningReadingProgressSignalPreviewStatus({
        status: "read_failed",
        message:
          "ReadingProgress 信号预览不可用，因为仪表盘数据库读取失败。",
      });
    case "no_ability_profile_found":
    case "no_daily_recommendations_found":
      return createLearningReadingProgressSignalPreviewStatus({
        status: "unavailable",
        message:
          "仪表盘正在使用回退数据，ReadingProgress 信号预览不可用。",
      });
  }
}

function createLearningReadingProgressSignalPreviewStatus({
  status,
  message,
}: {
  status: LearningReadingProgressSignalStatus;
  message: string;
}): LearningReadingProgressSignalPreview {
  return {
    status,
    message,
    progressCount: 0,
    completedChapterCount: 0,
    activeBookCount: 0,
    mappedSignalCount: 0,
    previewAppliedToAbility: false,
    learningEvents: [],
  };
}

function createLoadedMessage({
  progressCount,
  mappedSignalCount,
  previewAppliedToAbility,
}: {
  progressCount: number;
  mappedSignalCount: number;
  previewAppliedToAbility: boolean;
}): string {
  const baseMessage = `已加载 ${progressCount} 条 ReadingProgress 记录，并映射 ${mappedSignalCount} 条 reading_progress 信号。`;

  if (previewAppliedToAbility) {
    return `${baseMessage} 这些信号已纳入本次渲染的内存态能力预览。`;
  }

  return `${baseMessage} 这些信号会单独汇总，不会替代已保存的数据库能力画像。`;
}

function normalizeProgressLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return defaultReadingProgressLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}
