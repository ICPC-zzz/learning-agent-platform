import "server-only";

import {
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaReadingProgressRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type { ReadingProgressRepository } from "@learning-agent-platform/db";

import type {
  LearningDashboardDataSource,
  LearningDashboardFallbackReason,
} from "../../lib/learning-types";
import {
  createRecentReadingProgressStatusViewModel,
  createRecentReadingProgressViewModel,
} from "./recent-reading-progress-mapper";
import type { LearningRecentReadingProgressPanelViewModel } from "./recent-reading-progress-types";

const demoUserEmail = "demo@example.com";
const defaultRecentReadingProgressLimit = 3;

interface LoadLearningRecentReadingProgressInput {
  dashboardSource: LearningDashboardDataSource;
  fallbackReason?: LearningDashboardFallbackReason;
  limit?: number;
}

interface LoadLearningRecentReadingProgressForUserInput {
  userId: string;
  readingProgressRepository: Pick<
    ReadingProgressRepository,
    "listReadingProgress"
  >;
  limit?: number;
}

export async function loadLearningRecentReadingProgress({
  dashboardSource,
  fallbackReason,
  limit = defaultRecentReadingProgressLimit,
}: LoadLearningRecentReadingProgressInput): Promise<LearningRecentReadingProgressPanelViewModel> {
  const normalizedLimit = normalizeProgressLimit(limit);

  if (dashboardSource === "mock_fallback") {
    return createRecentReadingProgressStatusViewModel({
      status: getStatusForFallbackReason(fallbackReason),
      source: "fallback",
      message: getMessageForFallbackReason(fallbackReason),
      limit: normalizedLimit,
    });
  }

  if (!getDatabaseEnvStatus().hasDatabaseUrl) {
    return createRecentReadingProgressStatusViewModel({
      status: "database_unavailable",
      source: "fallback",
      message: "数据库不可用，显示 mock 回退。",
      limit: normalizedLimit,
    });
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const readingProgressRepository = new PrismaReadingProgressRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return createRecentReadingProgressStatusViewModel({
        status: "demo_user_missing",
        source: "fallback",
        message: "数据库不可用（缺少演示用户），显示 mock 回退。",
        limit: normalizedLimit,
      });
    }

    return loadLearningRecentReadingProgressForUser({
      userId: demoUser.id,
      readingProgressRepository,
      limit: normalizedLimit,
    });
  } catch {
    return createRecentReadingProgressStatusViewModel({
      status: "read_failed",
      source: "fallback",
      message: "读取数据库失败，显示 mock 回退。",
      limit: normalizedLimit,
    });
  }
}

export async function loadLearningRecentReadingProgressForUser({
  userId,
  readingProgressRepository,
  limit = defaultRecentReadingProgressLimit,
}: LoadLearningRecentReadingProgressForUserInput): Promise<LearningRecentReadingProgressPanelViewModel> {
  const normalizedLimit = normalizeProgressLimit(limit);

  try {
    const records = await readingProgressRepository.listReadingProgress({
      userId,
      limit: normalizedLimit,
    });

    return createRecentReadingProgressViewModel({
      records,
      limit: normalizedLimit,
    });
  } catch {
    return createRecentReadingProgressStatusViewModel({
      status: "read_failed",
      source: "fallback",
      message: "读取最近阅读进度失败，显示 mock 回退。",
      limit: normalizedLimit,
    });
  }
}

function getStatusForFallbackReason(
  reason: LearningDashboardFallbackReason | undefined,
) {
  switch (reason) {
    case "missing_database_url":
      return "database_unavailable" as const;
    case "no_demo_user_found":
      return "demo_user_missing" as const;
    case "database_read_failed":
      return "read_failed" as const;
    case "no_ability_profile_found":
    case "no_daily_recommendations_found":
    case undefined:
      return "unavailable" as const;
  }
}

function getMessageForFallbackReason(
  reason: LearningDashboardFallbackReason | undefined,
): string {
  switch (reason) {
    case "missing_database_url":
      return "数据库不可用，显示 mock 回退。";
    case "no_demo_user_found":
      return "缺少演示用户，显示 mock 回退。";
    case "database_read_failed":
      return "数据库读取失败，显示 mock 回退。";
    case "no_ability_profile_found":
    case "no_daily_recommendations_found":
    case undefined:
      return "当前仪表盘为回退数据，最近阅读进度仅显示预览状态。";
  }
}

function normalizeProgressLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return defaultRecentReadingProgressLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 5);
}
