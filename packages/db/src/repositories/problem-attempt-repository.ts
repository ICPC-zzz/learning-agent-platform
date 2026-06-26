import type {
  Prisma,
  PrismaClient,
  ProblemAttemptCorrectness,
  ProblemAttemptStatus,
  ProblemDifficulty,
} from "@prisma/client";

const defaultListProblemAttemptsLimit = 100;
const maxListProblemAttemptsLimit = 500;
const defaultRecentProblemAttemptsLimit = 20;
const maxRecentProblemAttemptsLimit = 100;
const defaultProblemAttemptSource = "manual";

const problemAttemptRecordInclude = {
  problem: true,
} satisfies Prisma.ProblemAttemptInclude;

export type ProblemAttemptRecord = Prisma.ProblemAttemptGetPayload<{
  include: typeof problemAttemptRecordInclude;
}>;

export type ProblemAttemptStatusInput =
  | ProblemAttemptStatus
  | "attempted"
  | "solved"
  | "failed"
  | "skipped";

export type ProblemAttemptCorrectnessInput =
  | ProblemAttemptCorrectness
  | "unknown"
  | "correct"
  | "incorrect"
  | "partial";

export type ProblemAttemptDifficultyInput =
  | ProblemDifficulty
  | "easy"
  | "medium"
  | "hard"
  | "challenge";

export interface CreateProblemAttemptInput {
  userId: string;
  problemId?: string | null;
  externalProblemId?: string | null;
  source?: string | null;
  status?: ProblemAttemptStatusInput;
  correctness?: ProblemAttemptCorrectnessInput;
  difficulty?: ProblemAttemptDifficultyInput | null;
  topicTags?: readonly string[];
  timeSpentSeconds?: number | null;
  attemptedAt?: Date;
  metadata?: Prisma.InputJsonValue;
}

export interface ListProblemAttemptsByUserOptions {
  limit?: number;
  problemId?: string;
  externalProblemId?: string;
  source?: string;
  status?: ProblemAttemptStatusInput;
  correctness?: ProblemAttemptCorrectnessInput;
}

export interface ProblemAttemptRepository {
  createProblemAttempt(
    input: CreateProblemAttemptInput,
  ): Promise<ProblemAttemptRecord>;

  listProblemAttemptsByUser(
    userId: string,
    options?: ListProblemAttemptsByUserOptions,
  ): Promise<ProblemAttemptRecord[]>;

  listRecentProblemAttemptsByUser(
    userId: string,
    limit?: number,
  ): Promise<ProblemAttemptRecord[]>;

  getProblemAttemptById(id: string): Promise<ProblemAttemptRecord | null>;
}

export class PrismaProblemAttemptRepository
  implements ProblemAttemptRepository
{
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createProblemAttempt(
    input: CreateProblemAttemptInput,
  ): Promise<ProblemAttemptRecord> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const problemId = normalizeOptionalText(input.problemId);
    const externalProblemId = normalizeOptionalText(input.externalProblemId);

    if (problemId === null && externalProblemId === null) {
      throw new Error(
        "Problem attempt requires either problemId or externalProblemId.",
      );
    }

    const status = normalizeProblemAttemptStatus(
      input.status,
      input.correctness,
    );
    const correctness = normalizeProblemAttemptCorrectness(
      input.correctness,
      status,
    );
    const data: Prisma.ProblemAttemptCreateInput = {
      user: { connect: { id: userId } },
      externalProblemId,
      source: normalizeProblemAttemptSource(input.source),
      status,
      correctness,
      topicTags: normalizeTopicTags(input.topicTags),
      attemptedAt: normalizeOptionalDate(
        input.attemptedAt,
        "Attempted at must be a valid Date.",
      ),
    };
    const difficulty = normalizeProblemAttemptDifficulty(input.difficulty);
    const timeSpentSeconds = normalizeOptionalNonNegativeInteger(
      input.timeSpentSeconds,
      "Problem attempt timeSpentSeconds must be a non-negative integer.",
    );

    if (problemId !== null) {
      data.problem = { connect: { id: problemId } };
    }

    if (difficulty !== null) {
      data.difficulty = difficulty;
    }

    if (timeSpentSeconds !== null) {
      data.timeSpentSeconds = timeSpentSeconds;
    }

    if (input.metadata !== undefined) {
      data.metadata = input.metadata;
    }

    return this.prisma.problemAttempt.create({
      data,
      include: problemAttemptRecordInclude,
    });
  }

  async listProblemAttemptsByUser(
    userId: string,
    options: ListProblemAttemptsByUserOptions = {},
  ): Promise<ProblemAttemptRecord[]> {
    const normalizedUserId = normalizeRequiredText(
      userId,
      "User id is required.",
    );
    const where: Prisma.ProblemAttemptWhereInput = {
      userId: normalizedUserId,
    };

    if (options.problemId !== undefined) {
      where.problemId = normalizeRequiredText(
        options.problemId,
        "Problem id filter cannot be empty.",
      );
    }

    if (options.externalProblemId !== undefined) {
      where.externalProblemId = normalizeRequiredText(
        options.externalProblemId,
        "External problem id filter cannot be empty.",
      );
    }

    if (options.source !== undefined) {
      where.source = normalizeRequiredText(
        options.source,
        "Problem attempt source filter cannot be empty.",
      );
    }

    if (options.status !== undefined) {
      where.status = normalizeProblemAttemptStatus(options.status);
    }

    if (options.correctness !== undefined) {
      where.correctness = normalizeProblemAttemptCorrectness(
        options.correctness,
      );
    }

    return this.prisma.problemAttempt.findMany({
      where,
      include: problemAttemptRecordInclude,
      take: normalizeLimit(
        options.limit,
        defaultListProblemAttemptsLimit,
        maxListProblemAttemptsLimit,
      ),
      orderBy: [
        { attemptedAt: "desc" },
        { createdAt: "desc" },
        { id: "asc" },
      ],
    });
  }

  async listRecentProblemAttemptsByUser(
    userId: string,
    limit?: number,
  ): Promise<ProblemAttemptRecord[]> {
    return this.listProblemAttemptsByUser(userId, {
      limit: normalizeLimit(
        limit,
        defaultRecentProblemAttemptsLimit,
        maxRecentProblemAttemptsLimit,
      ),
    });
  }

  async getProblemAttemptById(
    id: string,
  ): Promise<ProblemAttemptRecord | null> {
    const normalizedId = normalizeRequiredText(
      id,
      "Problem attempt id is required.",
    );

    return this.prisma.problemAttempt.findUnique({
      where: { id: normalizedId },
      include: problemAttemptRecordInclude,
    });
  }
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

function normalizeProblemAttemptSource(
  value: string | null | undefined,
): string {
  return normalizeOptionalText(value) ?? defaultProblemAttemptSource;
}

function normalizeProblemAttemptStatus(
  value?: ProblemAttemptStatusInput,
  correctness?: ProblemAttemptCorrectnessInput,
): ProblemAttemptStatus {
  if (value !== undefined) {
    switch (value) {
      case "attempted":
      case "ATTEMPTED":
        return "ATTEMPTED";
      case "solved":
      case "SOLVED":
        return "SOLVED";
      case "failed":
      case "FAILED":
        return "FAILED";
      case "skipped":
      case "SKIPPED":
        return "SKIPPED";
    }
  }

  if (correctness !== undefined) {
    const normalizedCorrectness =
      normalizeProblemAttemptCorrectness(correctness);

    if (normalizedCorrectness === "CORRECT") {
      return "SOLVED";
    }

    if (
      normalizedCorrectness === "INCORRECT" ||
      normalizedCorrectness === "PARTIAL"
    ) {
      return "FAILED";
    }
  }

  return "ATTEMPTED";
}

function normalizeProblemAttemptCorrectness(
  value?: ProblemAttemptCorrectnessInput,
  status?: ProblemAttemptStatus,
): ProblemAttemptCorrectness {
  if (value !== undefined) {
    switch (value) {
      case "unknown":
      case "UNKNOWN":
        return "UNKNOWN";
      case "correct":
      case "CORRECT":
        return "CORRECT";
      case "incorrect":
      case "INCORRECT":
        return "INCORRECT";
      case "partial":
      case "PARTIAL":
        return "PARTIAL";
    }
  }

  switch (status) {
    case "SOLVED":
      return "CORRECT";
    case "FAILED":
      return "INCORRECT";
    case "ATTEMPTED":
    case "SKIPPED":
    case undefined:
      return "UNKNOWN";
  }
}

function normalizeProblemAttemptDifficulty(
  value: ProblemAttemptDifficultyInput | null | undefined,
): ProblemDifficulty | null {
  if (value === undefined || value === null) {
    return null;
  }

  switch (value) {
    case "easy":
    case "EASY":
      return "EASY";
    case "medium":
    case "MEDIUM":
      return "MEDIUM";
    case "hard":
    case "HARD":
      return "HARD";
    case "challenge":
    case "CHALLENGE":
      return "CHALLENGE";
    default:
      throw new Error(`Unsupported problem attempt difficulty: ${String(value)}`);
  }
}

function normalizeTopicTags(tags: readonly string[] | undefined): string[] {
  if (tags === undefined) {
    return [];
  }

  if (!Array.isArray(tags)) {
    throw new Error("Problem attempt topicTags must be an array.");
  }

  return tags
    .map((tag) =>
      normalizeRequiredText(tag, "Problem attempt topicTags cannot be empty."),
    )
    .filter((tag, index, normalizedTags) => normalizedTags.indexOf(tag) === index);
}

function normalizeOptionalNonNegativeInteger(
  value: number | null | undefined,
  errorMessage: string,
): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(errorMessage);
  }

  return Math.trunc(value);
}

function normalizeOptionalDate(
  value: Date | undefined,
  errorMessage: string,
): Date {
  if (value === undefined) {
    return new Date();
  }

  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(errorMessage);
  }

  return value;
}

function normalizeLimit(
  limit: number | undefined,
  defaultLimit: number,
  maxLimit: number,
): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return defaultLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), maxLimit);
}
