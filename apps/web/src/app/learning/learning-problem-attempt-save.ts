import "server-only";

import {
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaLearningRepository,
  PrismaProblemAttemptRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type { CreateProblemAttemptInput } from "@learning-agent-platform/db";

import type {
  LearningProblemAttemptFeedbackResult,
  LearningProblemAttemptRecommendationSource,
  LearningProblemAttemptSaveInput,
  LearningProblemAttemptSaveResult,
} from "./learning-problem-attempt-save-types";

const demoUserEmail = "demo@example.com";
const problemAttemptSource = "daily_recommendation" as const;

interface NormalizedProblemAttemptSaveInput {
  problemId: string | null;
  externalProblemId: string | null;
  problemTitle: string;
  difficulty: LearningProblemAttemptSaveInput["difficulty"];
  topicTags: readonly string[];
  recommendationSource: LearningProblemAttemptRecommendationSource;
  result: LearningProblemAttemptFeedbackResult;
}

export async function saveRecommendedProblemAttempt(
  input: LearningProblemAttemptSaveInput,
): Promise<LearningProblemAttemptSaveResult> {
  const normalizedInput = normalizeProblemAttemptSaveInput(input);

  if (normalizedInput === null) {
    return createSaveResult({
      status: "validation_error",
      message:
        "题目尝试未保存，因为提交的题目反馈无效。",
      saved: false,
    });
  }

  if (!isSaveableRecommendationSource(normalizedInput.recommendationSource)) {
    return createSaveResult({
      status: "recommendation_unavailable",
      message:
        "题目尝试未保存，因为当前推荐来源不可保存。",
      saved: false,
      problemId: normalizedInput.problemId ?? undefined,
      externalProblemId: normalizedInput.externalProblemId ?? undefined,
      problemTitle: normalizedInput.problemTitle,
      result: normalizedInput.result,
      correctness: mapFeedbackResultToCorrectness(normalizedInput.result),
    });
  }

  if (!getDatabaseEnvStatus().hasDatabaseUrl) {
    return createSaveResult({
      status: "database_unavailable",
      message:
        "题目尝试未保存，因为 DATABASE_URL 未配置。",
      saved: false,
      problemId: normalizedInput.problemId ?? undefined,
      externalProblemId: normalizedInput.externalProblemId ?? undefined,
      problemTitle: normalizedInput.problemTitle,
      result: normalizedInput.result,
      correctness: mapFeedbackResultToCorrectness(normalizedInput.result),
    });
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const learningRepository = new PrismaLearningRepository(prisma);
    const problemAttemptRepository = new PrismaProblemAttemptRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return createSaveResult({
        status: "demo_user_missing",
        message:
          "题目尝试未保存，因为未找到 demo@example.com。",
        saved: false,
        problemId: normalizedInput.problemId ?? undefined,
        externalProblemId: normalizedInput.externalProblemId ?? undefined,
        problemTitle: normalizedInput.problemTitle,
        result: normalizedInput.result,
        correctness: mapFeedbackResultToCorrectness(normalizedInput.result),
      });
    }

    const databaseProblem =
      normalizedInput.problemId === null
        ? null
        : await learningRepository.getProblemById(normalizedInput.problemId);

    if (normalizedInput.problemId !== null && databaseProblem === null) {
      return createSaveResult({
        status: "problem_unavailable",
        message:
          "题目尝试未保存，因为推荐题目已不在数据库中。",
        saved: false,
        problemId: normalizedInput.problemId,
        problemTitle: normalizedInput.problemTitle,
        result: normalizedInput.result,
        correctness: mapFeedbackResultToCorrectness(normalizedInput.result),
      });
    }

    const savedAttempt = await problemAttemptRepository.createProblemAttempt(
      createProblemAttemptInput({
        userId: demoUser.id,
        input: normalizedInput,
      }),
    );
    const displayProblemTitle =
      savedAttempt.problem?.title ?? normalizedInput.problemTitle;

    return createSaveResult({
      status: "saved",
      message:
        "题目尝试演示记录已保存。AbilityProfile 和 DailyRecommendation 未重新计算，也不会触发自动反馈闭环。",
      saved: true,
      attemptId: savedAttempt.id,
      problemId: savedAttempt.problemId ?? normalizedInput.problemId ?? undefined,
      externalProblemId:
        savedAttempt.externalProblemId ??
        normalizedInput.externalProblemId ??
        undefined,
      problemTitle: displayProblemTitle,
      result: normalizedInput.result,
      correctness: mapFeedbackResultToCorrectness(normalizedInput.result),
      savedAt: savedAttempt.createdAt.toISOString(),
    });
  } catch {
    return createSaveResult({
      status: "save_failed",
      message:
        "题目尝试未保存，因为数据库读取或写入失败。",
      saved: false,
      problemId: normalizedInput.problemId ?? undefined,
      externalProblemId: normalizedInput.externalProblemId ?? undefined,
      problemTitle: normalizedInput.problemTitle,
      result: normalizedInput.result,
      correctness: mapFeedbackResultToCorrectness(normalizedInput.result),
    });
  }
}

function createProblemAttemptInput({
  userId,
  input,
}: {
  userId: string;
  input: NormalizedProblemAttemptSaveInput;
}): CreateProblemAttemptInput {
  return {
    userId,
    problemId: input.problemId,
    externalProblemId: input.externalProblemId,
    source: problemAttemptSource,
    status: input.result,
    correctness: mapFeedbackResultToCorrectness(input.result),
    difficulty: input.difficulty,
    topicTags: input.topicTags,
    attemptedAt: new Date(),
  };
}

function normalizeProblemAttemptSaveInput(
  input: LearningProblemAttemptSaveInput,
): NormalizedProblemAttemptSaveInput | null {
  const problemId = normalizeOptionalText(input.problemId);
  const externalProblemId = normalizeOptionalText(input.externalProblemId);
  const problemTitle = normalizeOptionalText(input.problemTitle);
  const result = normalizeFeedbackResult(input.result);
  const topicTags = normalizeTopicTags(input.topicTags);

  if (
    problemTitle === null ||
    result === null ||
    topicTags === null ||
    (problemId === null && externalProblemId === null)
  ) {
    return null;
  }

  return {
    problemId,
    externalProblemId,
    problemTitle,
    difficulty: input.difficulty,
    topicTags,
    recommendationSource: input.recommendationSource,
    result,
  };
}

function normalizeOptionalText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function normalizeFeedbackResult(
  value: LearningProblemAttemptFeedbackResult,
): LearningProblemAttemptFeedbackResult | null {
  switch (value) {
    case "attempted":
    case "solved":
    case "failed":
      return value;
  }

  return null;
}

function normalizeTopicTags(tags: readonly string[]): readonly string[] | null {
  if (!Array.isArray(tags)) {
    return null;
  }

  const normalizedTags = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return [...new Set(normalizedTags)];
}

function isSaveableRecommendationSource(
  source: LearningProblemAttemptRecommendationSource,
): boolean {
  return source === "database_saved" || source === "engine_preview";
}

function mapFeedbackResultToCorrectness(
  result: LearningProblemAttemptFeedbackResult,
): "unknown" | "correct" | "incorrect" {
  switch (result) {
    case "attempted":
      return "unknown";
    case "solved":
      return "correct";
    case "failed":
      return "incorrect";
  }
}

function createSaveResult(
  input: Omit<LearningProblemAttemptSaveResult, "source">,
): LearningProblemAttemptSaveResult {
  return {
    ...input,
    source: problemAttemptSource,
  };
}
