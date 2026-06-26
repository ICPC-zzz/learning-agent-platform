import "server-only";

import {
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaProblemAttemptRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type { ProblemAttemptRepository } from "@learning-agent-platform/db";

import type {
  LearningDashboardDataSource,
  LearningDashboardFallbackReason,
} from "../../lib/learning-types";
import {
  createRecentProblemAttemptHistoryStatusViewModel,
  createRecentProblemAttemptHistoryViewModel,
} from "./problem-attempt-history-mapper";
import type {
  LearningRecentProblemAttemptHistoryPanelViewModel,
  LearningRecentProblemAttemptHistoryStatus,
} from "./problem-attempt-history-types";

const demoUserEmail = "demo@example.com";
const defaultRecentProblemAttemptHistoryLimit = 5;

interface LoadLearningRecentProblemAttemptHistoryInput {
  dashboardSource: LearningDashboardDataSource;
  fallbackReason?: LearningDashboardFallbackReason;
  limit?: number;
}

interface LoadLearningRecentProblemAttemptHistoryForUserInput {
  userId: string;
  problemAttemptRepository: Pick<
    ProblemAttemptRepository,
    "listRecentProblemAttemptsByUser"
  >;
  limit?: number;
}

export async function loadLearningRecentProblemAttemptHistory({
  dashboardSource,
  fallbackReason,
  limit = defaultRecentProblemAttemptHistoryLimit,
}: LoadLearningRecentProblemAttemptHistoryInput): Promise<LearningRecentProblemAttemptHistoryPanelViewModel> {
  const normalizedLimit = normalizeAttemptLimit(limit);

  if (dashboardSource === "mock_fallback") {
    return createRecentProblemAttemptHistoryStatusViewModel({
      status: getStatusForFallbackReason(fallbackReason),
      message: getMessageForFallbackReason(fallbackReason),
      limit: normalizedLimit,
    });
  }

  if (!getDatabaseEnvStatus().hasDatabaseUrl) {
    return createRecentProblemAttemptHistoryStatusViewModel({
      status: "database_unavailable",
      message:
        "最近 ProblemAttempt 历史预览不可用，因为 DATABASE_URL 未配置。",
      limit: normalizedLimit,
    });
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const problemAttemptRepository = new PrismaProblemAttemptRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return createRecentProblemAttemptHistoryStatusViewModel({
        status: "demo_user_missing",
        message:
          "最近 ProblemAttempt 历史预览无法在数据库中找到演示用户 demo@example.com。",
        limit: normalizedLimit,
      });
    }

    return loadLearningRecentProblemAttemptHistoryForUser({
      userId: demoUser.id,
      problemAttemptRepository,
      limit: normalizedLimit,
    });
  } catch {
    return createRecentProblemAttemptHistoryStatusViewModel({
      status: "read_failed",
      message:
        "读取数据库时最近 ProblemAttempt 历史预览失败。仪表盘其余部分仍可渲染。",
      limit: normalizedLimit,
    });
  }
}

export async function loadLearningRecentProblemAttemptHistoryForUser({
  userId,
  problemAttemptRepository,
  limit = defaultRecentProblemAttemptHistoryLimit,
}: LoadLearningRecentProblemAttemptHistoryForUserInput): Promise<LearningRecentProblemAttemptHistoryPanelViewModel> {
  const normalizedLimit = normalizeAttemptLimit(limit);

  try {
    const records =
      await problemAttemptRepository.listRecentProblemAttemptsByUser(
        userId,
        normalizedLimit,
      );

    return createRecentProblemAttemptHistoryViewModel({
      records,
      limit: normalizedLimit,
    });
  } catch {
    return createRecentProblemAttemptHistoryStatusViewModel({
      status: "read_failed",
      message:
        "读取最近尝试时最近 ProblemAttempt 历史预览失败。",
      limit: normalizedLimit,
    });
  }
}

function getStatusForFallbackReason(
  reason: LearningDashboardFallbackReason | undefined,
): LearningRecentProblemAttemptHistoryStatus {
  switch (reason) {
    case "missing_database_url":
      return "database_unavailable";
    case "no_demo_user_found":
      return "demo_user_missing";
    case "database_read_failed":
      return "read_failed";
    case "no_ability_profile_found":
    case "no_daily_recommendations_found":
    case undefined:
      return "unavailable";
  }
}

function getMessageForFallbackReason(
  reason: LearningDashboardFallbackReason | undefined,
): string {
  switch (reason) {
    case "missing_database_url":
      return "最近 ProblemAttempt 历史预览不可用，因为 DATABASE_URL 未配置。";
    case "no_demo_user_found":
      return "最近 ProblemAttempt 历史预览不可用，因为未找到演示用户 demo@example.com。";
    case "database_read_failed":
      return "最近 ProblemAttempt 历史预览不可用，因为仪表盘数据库读取失败。";
    case "no_ability_profile_found":
    case "no_daily_recommendations_found":
    case undefined:
      return "仪表盘正在显示回退数据，最近 ProblemAttempt 历史预览不可用。";
  }
}

function normalizeAttemptLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return defaultRecentProblemAttemptHistoryLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 10);
}
