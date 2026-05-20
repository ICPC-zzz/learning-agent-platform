import type { Prisma, PrismaClient } from "@prisma/client";

import type {
  AbilityProfileRecord,
  CreateDailyRecommendationsInput,
  CreateProblemInput,
  DailyRecommendationRecord,
  GetDailyRecommendationsInput,
  LearningRepository,
  ListProblemsInput,
  ProblemRecord,
  UpsertAbilityProfileInput,
} from "../types.js";

const defaultListProblemsLimit = 50;
const maxListProblemsLimit = 200;

export class PrismaLearningRepository implements LearningRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async upsertAbilityProfile(
    input: UpsertAbilityProfileInput,
  ): Promise<AbilityProfileRecord> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const scoreData = createAbilityProfileScoreData(input);

    return this.prisma.userAbilityProfile.upsert({
      where: { userId },
      create: {
        user: { connect: { id: userId } },
        ...scoreData.create,
      },
      update: scoreData.update,
    });
  }

  async getAbilityProfile(
    userId: string,
  ): Promise<AbilityProfileRecord | null> {
    const normalizedUserId = normalizeRequiredText(
      userId,
      "User id is required.",
    );

    return this.prisma.userAbilityProfile.findUnique({
      where: { userId: normalizedUserId },
    });
  }

  async createProblem(input: CreateProblemInput): Promise<ProblemRecord> {
    const title = normalizeRequiredText(input.title, "Problem title is required.");
    const tags = normalizeTags(input.tags);
    const id = normalizeOptionalText(input.id);

    const data: Prisma.ProblemCreateInput = {
      title,
      description: input.description ?? null,
      difficulty: input.difficulty,
      tags,
      source: input.source ?? null,
      sourceUrl: input.sourceUrl ?? null,
    };

    if (id !== null) {
      data.id = id;
    }

    if (input.metadata !== undefined) {
      data.metadata = input.metadata;
    }

    return this.prisma.problem.create({ data });
  }

  async getProblemById(problemId: string): Promise<ProblemRecord | null> {
    const normalizedProblemId = normalizeRequiredText(
      problemId,
      "Problem id is required.",
    );

    return this.prisma.problem.findUnique({
      where: { id: normalizedProblemId },
    });
  }

  async listProblems(input: ListProblemsInput = {}): Promise<ProblemRecord[]> {
    const limit = normalizeListProblemsLimit(input.limit);
    const where: Prisma.ProblemWhereInput = {};
    const tags = input.tags === undefined ? [] : normalizeTags(input.tags);

    if (input.difficulty !== undefined) {
      where.difficulty = input.difficulty;
    }

    if (input.source !== undefined) {
      where.source = normalizeOptionalText(input.source);
    }

    if (tags.length > 0) {
      where.tags = { hasEvery: tags };
    }

    return this.prisma.problem.findMany({
      where,
      take: limit,
      orderBy: [{ createdAt: "desc" }, { title: "asc" }, { id: "asc" }],
    });
  }

  async createDailyRecommendations(
    input: CreateDailyRecommendationsInput,
  ): Promise<DailyRecommendationRecord[]> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const recommendationDate = normalizeDate(
      input.recommendationDate,
      "Recommendation date must be a valid Date.",
    );

    if (input.recommendations.length === 0) {
      return [];
    }

    return this.prisma.$transaction(async (transaction) => {
      const records: DailyRecommendationRecord[] = [];

      for (const [inputIndex, recommendation] of input.recommendations.entries()) {
        const problemId = normalizeRequiredText(
          recommendation.problemId,
          `Recommendation at index ${inputIndex} must include a problem id.`,
        );

        const record = await transaction.dailyRecommendation.create({
          data: {
            user: { connect: { id: userId } },
            problem: { connect: { id: problemId } },
            recommendationDate,
            reason: recommendation.reason ?? null,
            status: recommendation.status ?? "PENDING",
          },
          include: { problem: true },
        });

        records.push(record);
      }

      return records;
    });
  }

  async upsertDailyRecommendations(
    input: CreateDailyRecommendationsInput,
  ): Promise<DailyRecommendationRecord[]> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const recommendationDate = normalizeDate(
      input.recommendationDate,
      "Recommendation date must be a valid Date.",
    );

    if (input.recommendations.length === 0) {
      return [];
    }

    return this.prisma.$transaction(async (transaction) => {
      const records: DailyRecommendationRecord[] = [];

      for (const [inputIndex, recommendation] of input.recommendations.entries()) {
        const problemId = normalizeRequiredText(
          recommendation.problemId,
          `Recommendation at index ${inputIndex} must include a problem id.`,
        );
        const record = await transaction.dailyRecommendation.upsert({
          where: {
            userId_problemId_recommendationDate: {
              userId,
              problemId,
              recommendationDate,
            },
          },
          create: {
            user: { connect: { id: userId } },
            problem: { connect: { id: problemId } },
            recommendationDate,
            reason: recommendation.reason ?? null,
            status: recommendation.status ?? "PENDING",
          },
          update: {
            reason: recommendation.reason ?? null,
            status: recommendation.status ?? "PENDING",
          },
          include: { problem: true },
        });

        records.push(record);
      }

      return records;
    });
  }

  async getDailyRecommendations(
    input: GetDailyRecommendationsInput,
  ): Promise<DailyRecommendationRecord[]> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const recommendationDate = normalizeDate(
      input.recommendationDate,
      "Recommendation date must be a valid Date.",
    );

    return this.prisma.dailyRecommendation.findMany({
      where: {
        userId,
        recommendationDate,
      },
      include: { problem: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}

function createAbilityProfileScoreData(input: UpsertAbilityProfileInput): {
  create: Prisma.UserAbilityProfileCreateWithoutUserInput;
  update: Prisma.UserAbilityProfileUpdateInput;
} {
  const languageFundamentalsScore = normalizeOptionalScore(
    input.languageFundamentalsScore ?? input.readingScore,
    "languageFundamentalsScore",
  );
  const engineeringPracticeScore = normalizeOptionalScore(
    input.engineeringPracticeScore,
    "engineeringPracticeScore",
  );

  const create: Prisma.UserAbilityProfileCreateWithoutUserInput = {
    overallScore: normalizeScore(input.overallScore, "overallScore"),
    algorithmScore: normalizeScore(input.algorithmScore, "algorithmScore"),
    debuggingScore: normalizeScore(input.debuggingScore, "debuggingScore"),
    systemDesignScore: normalizeScore(
      input.systemDesignScore,
      "systemDesignScore",
    ),
    lastEvaluatedAt: input.lastEvaluatedAt ?? new Date(),
  };
  const update: Prisma.UserAbilityProfileUpdateInput = {
    overallScore: create.overallScore,
    algorithmScore: create.algorithmScore,
    debuggingScore: create.debuggingScore,
    systemDesignScore: create.systemDesignScore,
    lastEvaluatedAt: create.lastEvaluatedAt,
  };

  if (languageFundamentalsScore !== undefined) {
    create.languageFundamentalsScore = languageFundamentalsScore;
    update.languageFundamentalsScore = languageFundamentalsScore;
  }

  if (engineeringPracticeScore !== undefined) {
    create.engineeringPracticeScore = engineeringPracticeScore;
    update.engineeringPracticeScore = engineeringPracticeScore;
  }

  return { create, update };
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(errorMessage);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function normalizeScore(value: number, fieldName: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number.`);
  }

  return Math.min(Math.max(value, 0), 100);
}

function normalizeOptionalScore(
  value: number | undefined,
  fieldName: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeScore(value, fieldName);
}

function normalizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) {
    throw new Error("Problem tags must be an array.");
  }

  return tags
    .map((tag) => normalizeRequiredText(tag, "Problem tags cannot be empty."))
    .filter((tag, index, normalizedTags) => normalizedTags.indexOf(tag) === index);
}

function normalizeListProblemsLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return defaultListProblemsLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), maxListProblemsLimit);
}

function normalizeDate(value: Date, errorMessage: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(errorMessage);
  }

  return value;
}
