import "server-only";

import {
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaProblemAttemptRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";

import type {
  LearningDashboardDataSource,
  LearningDashboardFallbackReason,
  LearningRecommendedProblemView,
} from "../../lib/learning-types";
import {
  createRecommendationProblemAttemptStatusPreview,
  createRecommendationProblemAttemptStatusPreviewForReadStatus,
} from "./recommendation-problem-attempt-status-mapper";
import type { LearningRecommendationProblemAttemptStatusPreview } from "./recommendation-problem-attempt-status-types";
import type { LearningProblemAttemptSignalStatus } from "./problem-attempt-signal-types";

const demoUserEmail = "demo@example.com";
const defaultRecentProblemAttemptLimit = 20;

interface LoadLearningRecommendationProblemAttemptStatusPreviewInput {
  recommendedProblems: readonly LearningRecommendedProblemView[];
  dashboardSource: LearningDashboardDataSource;
  fallbackReason?: LearningDashboardFallbackReason;
  limit?: number;
}

export async function loadLearningRecommendationProblemAttemptStatusPreview({
  recommendedProblems,
  dashboardSource,
  fallbackReason,
  limit = defaultRecentProblemAttemptLimit,
}: LoadLearningRecommendationProblemAttemptStatusPreviewInput): Promise<LearningRecommendationProblemAttemptStatusPreview> {
  if (recommendedProblems.length === 0) {
    return createRecommendationProblemAttemptStatusPreviewForReadStatus({
      recommendedProblems,
      status: "unavailable",
      message:
        "没有可用推荐题目，因此未读取卡片级 ProblemAttempt 状态预览。",
    });
  }

  if (dashboardSource === "mock_fallback") {
    return createRecommendationProblemAttemptStatusPreviewForReadStatus({
      recommendedProblems,
      status: getStatusForFallbackReason(fallbackReason),
      message: getMessageForFallbackReason(fallbackReason),
    });
  }

  if (!getDatabaseEnvStatus().hasDatabaseUrl) {
    return createRecommendationProblemAttemptStatusPreviewForReadStatus({
      recommendedProblems,
      status: "database_unavailable",
      message:
        "ProblemAttempt 卡片状态预览不可用，因为 DATABASE_URL 未配置。",
    });
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const problemAttemptRepository = new PrismaProblemAttemptRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return createRecommendationProblemAttemptStatusPreviewForReadStatus({
        recommendedProblems,
        status: "demo_user_missing",
        message:
          "ProblemAttempt 卡片状态预览无法在数据库中找到演示用户 demo@example.com。",
      });
    }

    const records =
      await problemAttemptRepository.listRecentProblemAttemptsByUser(
        demoUser.id,
        normalizeAttemptLimit(limit),
      );

    return createRecommendationProblemAttemptStatusPreview({
      recommendedProblems,
      records,
    });
  } catch {
    return createRecommendationProblemAttemptStatusPreviewForReadStatus({
      recommendedProblems,
      status: "read_failed",
      message:
        "读取数据库时 ProblemAttempt 卡片状态预览失败。推荐预览仍可渲染。",
    });
  }
}

function getStatusForFallbackReason(
  reason: LearningDashboardFallbackReason | undefined,
): LearningProblemAttemptSignalStatus {
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
      return "ProblemAttempt 卡片状态预览不可用，因为 DATABASE_URL 未配置。";
    case "no_demo_user_found":
      return "ProblemAttempt 卡片状态预览不可用，因为未找到演示用户 demo@example.com。";
    case "database_read_failed":
      return "ProblemAttempt 卡片状态预览不可用，因为仪表盘数据库读取失败。";
    case "no_ability_profile_found":
    case "no_daily_recommendations_found":
    case undefined:
      return "仪表盘正在显示回退推荐，ProblemAttempt 卡片状态预览不可用。";
  }
}

function normalizeAttemptLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return defaultRecentProblemAttemptLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}
