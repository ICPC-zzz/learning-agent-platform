import type { PrismaClient } from "@prisma/client";

export interface CodeforcesAccountRecord {
  id: string;
  userId: string;
  canonicalHandle: string;
  normalizedHandle: string;
  currentRating: number | null;
  maxRating: number | null;
  rank: string | null;
  maxRank: string | null;
  contribution: number | null;
  friendOfCount: number | null;
  lastOnlineAt: Date | null;
  registrationAt: Date | null;
  lastSubmissionAt: Date | null;
  lastSyncedAt: Date | null;
  lastSyncedSubmissionId: number | null;
  syncStatus: string;
  syncErrorCode: string | null;
  dataTruncated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeforcesAccountCreateInput {
  userId: string;
  canonicalHandle: string;
  normalizedHandle: string;
  currentRating?: number | null;
  maxRating?: number | null;
  rank?: string | null;
  maxRank?: string | null;
  contribution?: number | null;
  friendOfCount?: number | null;
  lastOnlineAt?: Date | null;
  registrationAt?: Date | null;
  lastSubmissionAt?: Date | null;
}

export interface CodeforcesAccountUpdateSyncInput {
  currentRating?: number | null;
  maxRating?: number | null;
  rank?: string | null;
  maxRank?: string | null;
  contribution?: number | null;
  friendOfCount?: number | null;
  lastOnlineAt?: Date | null;
  registrationAt?: Date | null;
  lastSubmissionAt?: Date | null;
  lastSyncedAt: Date;
  lastSyncedSubmissionId?: number | null;
  syncStatus: string;
  syncErrorCode?: string | null;
  dataTruncated?: boolean;
}

export interface CodeforcesUserProblemStatRecord {
  id: string;
  accountId: string;
  problemKey: string;
  contestId: number;
  index: string;
  name: string;
  rating: number | null;
  tags: string[];
  attempts: number;
  accepted: boolean;
  firstSubmittedAt: Date | null;
  firstAcceptedAt: Date | null;
  lastSubmittedAt: Date | null;
  lastVerdict: string | null;
  lastSubmissionId: number | null;
}

export interface CodeforcesUserProblemStatUpsertInput {
  problemKey: string;
  contestId: number;
  index: string;
  name: string;
  rating?: number | null;
  tags?: string[];
  accepted: boolean;
  lastSubmissionId: number;
  lastVerdict: string;
  submissionTimeSeconds: number;
}

export interface CodeforcesRatingChangeRecord {
  id: string;
  accountId: string;
  contestId: number;
  contestName: string;
  rank: number | null;
  oldRating: number;
  newRating: number;
  ratingUpdateAt: Date;
}

export interface CodeforcesRecentSubmissionInput {
  submissionId: number;
  problemKey: string;
  contestId?: number | null;
  index?: string | null;
  name?: string | null;
  verdict: string;
  creationTimeSeconds: number;
  language?: string | null;
  passedTestCount?: number | null;
  timeConsumedMillis?: number | null;
  memoryConsumedBytes?: number | null;
}

export interface CodeforcesAccountStats {
  totalSubmissions: number;
  acceptedSubmissions: number;
  attemptedProblems: number;
  solvedProblems: number;
  unfinishedProblems: number;
  lastSubmissionAt: Date | null;
  verdictCounts: Record<string, number>;
}

export interface CodeforcesAccountRepository {
  createAccount(input: CodeforcesAccountCreateInput): Promise<CodeforcesAccountRecord>;
  getAccountByUserId(userId: string): Promise<CodeforcesAccountRecord | null>;
  getAccountByHandle(normalizedHandle: string): Promise<CodeforcesAccountRecord | null>;
  updateAccountSyncState(accountId: string, input: CodeforcesAccountUpdateSyncInput): Promise<CodeforcesAccountRecord>;
  deleteAccount(accountId: string): Promise<void>;
  upsertProblemStats(accountId: string, stats: CodeforcesUserProblemStatUpsertInput[]): Promise<number>;
  getProblemStatsByAccount(accountId: string): Promise<CodeforcesUserProblemStatRecord[]>;
  getProblemStat(accountId: string, problemKey: string): Promise<CodeforcesUserProblemStatRecord | null>;
  upsertRatingChanges(accountId: string, changes: Array<{
    contestId: number;
    contestName: string;
    rank: number | null;
    oldRating: number;
    newRating: number;
    ratingUpdateAt: Date;
  }>): Promise<number>;
  getRatingHistory(accountId: string): Promise<CodeforcesRatingChangeRecord[]>;
  upsertRecentSubmissions(accountId: string, submissions: CodeforcesRecentSubmissionInput[]): Promise<number>;
  getRecentSubmissions(accountId: string, limit?: number): Promise<CodeforcesRecentSubmissionInput[]>;
  getAccountStats(accountId: string): Promise<CodeforcesAccountStats>;
}

export class PrismaCodeforcesAccountRepository implements CodeforcesAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createAccount(input: CodeforcesAccountCreateInput): Promise<CodeforcesAccountRecord> {
    return this.prisma.codeforcesAccount.create({
      data: {
        userId: normalizeRequiredText(input.userId, "Codeforces account userId is required."),
        canonicalHandle: normalizeRequiredText(input.canonicalHandle, "Codeforces handle is required."),
        normalizedHandle: normalizeRequiredText(input.normalizedHandle, "Codeforces normalized handle is required."),
        currentRating: input.currentRating ?? null,
        maxRating: input.maxRating ?? null,
        rank: input.rank ?? null,
        maxRank: input.maxRank ?? null,
        contribution: input.contribution ?? null,
        friendOfCount: input.friendOfCount ?? null,
        lastOnlineAt: input.lastOnlineAt ?? null,
        registrationAt: input.registrationAt ?? null,
        lastSubmissionAt: input.lastSubmissionAt ?? null,
        syncStatus: "idle",
      },
    });
  }

  async getAccountByUserId(userId: string): Promise<CodeforcesAccountRecord | null> {
    return this.prisma.codeforcesAccount.findUnique({
      where: { userId: normalizeRequiredText(userId, "Codeforces account userId is required.") },
    });
  }

  async getAccountByHandle(normalizedHandle: string): Promise<CodeforcesAccountRecord | null> {
    return this.prisma.codeforcesAccount.findFirst({
      where: { normalizedHandle: normalizeRequiredText(normalizedHandle, "Codeforces normalized handle is required.") },
    });
  }

  async updateAccountSyncState(accountId: string, input: CodeforcesAccountUpdateSyncInput): Promise<CodeforcesAccountRecord> {
    return this.prisma.codeforcesAccount.update({
      where: { id: normalizeRequiredText(accountId, "Codeforces account id is required.") },
      data: {
        currentRating: input.currentRating,
        maxRating: input.maxRating,
        rank: input.rank,
        maxRank: input.maxRank,
        contribution: input.contribution,
        friendOfCount: input.friendOfCount,
        lastOnlineAt: input.lastOnlineAt,
        registrationAt: input.registrationAt,
        lastSubmissionAt: input.lastSubmissionAt,
        lastSyncedAt: input.lastSyncedAt,
        lastSyncedSubmissionId: input.lastSyncedSubmissionId ?? null,
        syncStatus: input.syncStatus,
        syncErrorCode: input.syncErrorCode ?? null,
        dataTruncated: input.dataTruncated ?? false,
      },
    });
  }

  async deleteAccount(accountId: string): Promise<void> {
    await this.prisma.codeforcesAccount.delete({
      where: { id: normalizeRequiredText(accountId, "Codeforces account id is required.") },
    });
  }

  async upsertProblemStats(accountId: string, stats: CodeforcesUserProblemStatUpsertInput[]): Promise<number> {
    const normalizedAccountId = normalizeRequiredText(accountId, "Codeforces account id is required.");
    let upserted = 0;

    for (const stat of stats) {
      const submittedAt = new Date(stat.submissionTimeSeconds * 1000);
      const existing = await this.prisma.codeforcesUserProblemStat.findUnique({
        where: { accountId_problemKey: { accountId: normalizedAccountId, problemKey: stat.problemKey } },
      });

      if (existing) {
        await this.prisma.codeforcesUserProblemStat.update({
          where: { id: existing.id },
          data: {
            name: stat.name,
            rating: stat.rating ?? existing.rating,
            tags: stat.tags ?? existing.tags,
            attempts: existing.attempts + 1,
            accepted: existing.accepted || stat.accepted,
            lastSubmittedAt: submittedAt,
            lastVerdict: stat.lastVerdict,
            lastSubmissionId: stat.lastSubmissionId,
            firstAcceptedAt: !existing.accepted && stat.accepted ? submittedAt : existing.firstAcceptedAt,
          },
        });
      } else {
        await this.prisma.codeforcesUserProblemStat.create({
          data: {
            accountId: normalizedAccountId,
            problemKey: stat.problemKey,
            contestId: stat.contestId,
            index: stat.index,
            name: stat.name,
            rating: stat.rating ?? null,
            tags: stat.tags ?? [],
            attempts: 1,
            accepted: stat.accepted,
            firstSubmittedAt: submittedAt,
            firstAcceptedAt: stat.accepted ? submittedAt : null,
            lastSubmittedAt: submittedAt,
            lastVerdict: stat.lastVerdict,
            lastSubmissionId: stat.lastSubmissionId,
          },
        });
      }
      upserted += 1;
    }

    return upserted;
  }

  async getProblemStatsByAccount(accountId: string): Promise<CodeforcesUserProblemStatRecord[]> {
    return this.prisma.codeforcesUserProblemStat.findMany({
      where: { accountId: normalizeRequiredText(accountId, "Codeforces account id is required.") },
    });
  }

  async getProblemStat(accountId: string, problemKey: string): Promise<CodeforcesUserProblemStatRecord | null> {
    return this.prisma.codeforcesUserProblemStat.findUnique({
      where: {
        accountId_problemKey: {
          accountId: normalizeRequiredText(accountId, "Codeforces account id is required."),
          problemKey: normalizeRequiredText(problemKey, "Codeforces problem key is required."),
        },
      },
    });
  }

  async upsertRatingChanges(
    accountId: string,
    changes: Array<{
      contestId: number;
      contestName: string;
      rank: number | null;
      oldRating: number;
      newRating: number;
      ratingUpdateAt: Date;
    }>,
  ): Promise<number> {
    const normalizedAccountId = normalizeRequiredText(accountId, "Codeforces account id is required.");
    let upserted = 0;

    for (const change of changes) {
      await this.prisma.codeforcesRatingChange.upsert({
        where: { accountId_contestId: { accountId: normalizedAccountId, contestId: change.contestId } },
        create: {
          accountId: normalizedAccountId,
          contestId: change.contestId,
          contestName: change.contestName,
          rank: change.rank ?? null,
          oldRating: change.oldRating,
          newRating: change.newRating,
          ratingUpdateAt: change.ratingUpdateAt,
        },
        update: {
          contestName: change.contestName,
          rank: change.rank ?? null,
          oldRating: change.oldRating,
          newRating: change.newRating,
          ratingUpdateAt: change.ratingUpdateAt,
        },
      });
      upserted += 1;
    }

    return upserted;
  }

  async getRatingHistory(accountId: string): Promise<CodeforcesRatingChangeRecord[]> {
    return this.prisma.codeforcesRatingChange.findMany({
      where: { accountId: normalizeRequiredText(accountId, "Codeforces account id is required.") },
      orderBy: { ratingUpdateAt: "asc" },
    });
  }

  async upsertRecentSubmissions(accountId: string, submissions: CodeforcesRecentSubmissionInput[]): Promise<number> {
    const normalizedAccountId = normalizeRequiredText(accountId, "Codeforces account id is required.");
    let upserted = 0;

    for (const submission of submissions) {
      await this.prisma.codeforcesRecentSubmission.upsert({
        where: {
          accountId_submissionId: {
            accountId: normalizedAccountId,
            submissionId: submission.submissionId,
          },
        },
        create: {
          accountId: normalizedAccountId,
          submissionId: submission.submissionId,
          problemKey: submission.problemKey,
          contestId: submission.contestId ?? null,
          index: submission.index ?? null,
          name: submission.name ?? null,
          verdict: submission.verdict,
          creationTimeSeconds: submission.creationTimeSeconds,
          language: submission.language ?? null,
          passedTestCount: submission.passedTestCount ?? null,
          timeConsumedMillis: submission.timeConsumedMillis ?? null,
          memoryConsumedBytes: submission.memoryConsumedBytes ?? null,
        },
        update: {},
      });
      upserted += 1;
    }

    return upserted;
  }

  async getRecentSubmissions(accountId: string, limit = 50): Promise<CodeforcesRecentSubmissionInput[]> {
    const records = await this.prisma.codeforcesRecentSubmission.findMany({
      where: { accountId: normalizeRequiredText(accountId, "Codeforces account id is required.") },
      orderBy: { creationTimeSeconds: "desc" },
      take: normalizeLimit(limit),
    });

    return records.map((record) => ({
      submissionId: record.submissionId,
      problemKey: record.problemKey,
      contestId: record.contestId,
      index: record.index,
      name: record.name,
      verdict: record.verdict ?? "UNKNOWN",
      creationTimeSeconds: record.creationTimeSeconds,
      language: record.language,
      passedTestCount: record.passedTestCount,
      timeConsumedMillis: record.timeConsumedMillis,
      memoryConsumedBytes: record.memoryConsumedBytes,
    }));
  }

  async getAccountStats(accountId: string): Promise<CodeforcesAccountStats> {
    const normalizedAccountId = normalizeRequiredText(accountId, "Codeforces account id is required.");
    const [stats, submissions] = await Promise.all([
      this.getProblemStatsByAccount(normalizedAccountId),
      this.prisma.codeforcesRecentSubmission.findMany({
        where: { accountId: normalizedAccountId },
        select: { verdict: true, creationTimeSeconds: true },
        orderBy: { creationTimeSeconds: "desc" },
        take: 1000,
      }),
    ]);

    const verdictCounts: Record<string, number> = {};
    for (const submission of submissions) {
      const verdict = submission.verdict ?? "UNKNOWN";
      verdictCounts[verdict] = (verdictCounts[verdict] ?? 0) + 1;
    }

    return {
      totalSubmissions: submissions.length,
      acceptedSubmissions: stats.filter((stat) => stat.accepted).length,
      attemptedProblems: stats.length,
      solvedProblems: stats.filter((stat) => stat.accepted).length,
      unfinishedProblems: stats.filter((stat) => !stat.accepted).length,
      lastSubmissionAt: submissions.length > 0 ? new Date(submissions[0].creationTimeSeconds * 1000) : null,
      verdictCounts,
    };
  }
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(errorMessage);
  return normalized;
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 1000);
}
