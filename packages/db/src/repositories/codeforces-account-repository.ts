import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  lastSubmittedAt?: Date | null;
}

export interface CodeforcesAccountUpdateSyncInput {
  currentRating?: number | null;
  maxRating?: number | null;
  rank?: string | null;
  maxRank?: string | null;
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

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface CodeforcesAccountRepository {
  // Account lifecycle
  createAccount(input: CodeforcesAccountCreateInput): Promise<CodeforcesAccountRecord>;
  getAccountByUserId(userId: string): Promise<CodeforcesAccountRecord | null>;
  getAccountByHandle(normalizedHandle: string): Promise<CodeforcesAccountRecord | null>;
  updateAccountSyncState(accountId: string, input: CodeforcesAccountUpdateSyncInput): Promise<CodeforcesAccountRecord>;
  deleteAccount(accountId: string): Promise<void>;

  // Problem stats
  upsertProblemStats(accountId: string, stats: CodeforcesUserProblemStatUpsertInput[]): Promise<number>;
  getProblemStatsByAccount(accountId: string): Promise<CodeforcesUserProblemStatRecord[]>;
  getProblemStat(accountId: string, problemKey: string): Promise<CodeforcesUserProblemStatRecord | null>;

  // Rating history
  upsertRatingChanges(accountId: string, changes: Array<{
    contestId: number;
    contestName: string;
    rank: number | null;
    oldRating: number;
    newRating: number;
    ratingUpdateAt: Date;
  }>): Promise<number>;
  getRatingHistory(accountId: string): Promise<CodeforcesRatingChangeRecord[]>;

  // Recent submissions
  upsertRecentSubmissions(accountId: string, submissions: CodeforcesRecentSubmissionInput[]): Promise<number>;
  getRecentSubmissions(accountId: string, limit?: number): Promise<CodeforcesRecentSubmissionInput[]>;

  // Stats
  getAccountStats(accountId: string): Promise<CodeforcesAccountStats>;
}

// ---------------------------------------------------------------------------
// Prisma implementation
// ---------------------------------------------------------------------------

export class PrismaCodeforcesAccountRepository implements CodeforcesAccountRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createAccount(input: CodeforcesAccountCreateInput): Promise<CodeforcesAccountRecord> {
    return this.prisma.codeforcesAccount.create({
      data: {
        userId: input.userId,
        canonicalHandle: input.canonicalHandle,
        normalizedHandle: input.normalizedHandle,
        currentRating: input.currentRating ?? null,
        maxRating: input.maxRating ?? null,
        rank: input.rank ?? null,
        maxRank: input.maxRank ?? null,
        syncStatus: "idle",
      },
    });
  }

  async getAccountByUserId(userId: string): Promise<CodeforcesAccountRecord | null> {
    return this.prisma.codeforcesAccount.findUnique({ where: { userId } });
  }

  async getAccountByHandle(normalizedHandle: string): Promise<CodeforcesAccountRecord | null> {
    return this.prisma.codeforcesAccount.findFirst({
      where: { normalizedHandle },
    });
  }

  async updateAccountSyncState(accountId: string, input: CodeforcesAccountUpdateSyncInput): Promise<CodeforcesAccountRecord> {
    return this.prisma.codeforcesAccount.update({
      where: { id: accountId },
      data: {
        currentRating: input.currentRating,
        maxRating: input.maxRating,
        rank: input.rank,
        maxRank: input.maxRank,
        lastSyncedAt: input.lastSyncedAt,
        lastSyncedSubmissionId: input.lastSyncedSubmissionId ?? null,
        syncStatus: input.syncStatus,
        syncErrorCode: input.syncErrorCode ?? null,
        dataTruncated: input.dataTruncated ?? false,
      },
    });
  }

  async deleteAccount(accountId: string): Promise<void> {
    await this.prisma.codeforcesAccount.delete({ where: { id: accountId } });
  }

  async upsertProblemStats(
    accountId: string,
    stats: CodeforcesUserProblemStatUpsertInput[],
  ): Promise<number> {
    let upserted = 0;
    // Process in batches to avoid huge transactions
    for (const stat of stats) {
      try {
        const existing = await this.prisma.codeforcesUserProblemStat.findUnique({
          where: { accountId_problemKey: { accountId, problemKey: stat.problemKey } },
        });

        if (existing) {
          const wasAccepted = existing.accepted;
          await this.prisma.codeforcesUserProblemStat.update({
            where: { id: existing.id },
            data: {
              name: stat.name,
              rating: stat.rating ?? existing.rating,
              tags: stat.tags ?? existing.tags,
              attempts: existing.attempts + 1,
              accepted: wasAccepted || stat.accepted,
              lastSubmittedAt: new Date(stat.submissionTimeSeconds * 1000),
              lastVerdict: stat.lastVerdict,
              lastSubmissionId: stat.lastSubmissionId,
              firstAcceptedAt:
                !wasAccepted && stat.accepted
                  ? new Date(stat.submissionTimeSeconds * 1000)
                  : existing.firstAcceptedAt,
            },
          });
        } else {
          await this.prisma.codeforcesUserProblemStat.create({
            data: {
              accountId,
              problemKey: stat.problemKey,
              contestId: stat.contestId,
              index: stat.index,
              name: stat.name,
              rating: stat.rating ?? null,
              tags: stat.tags ?? [],
              attempts: 1,
              accepted: stat.accepted,
              firstSubmittedAt: new Date(stat.submissionTimeSeconds * 1000),
              firstAcceptedAt: stat.accepted ? new Date(stat.submissionTimeSeconds * 1000) : null,
              lastSubmittedAt: new Date(stat.submissionTimeSeconds * 1000),
              lastVerdict: stat.lastVerdict,
              lastSubmissionId: stat.lastSubmissionId,
            },
          });
        }
        upserted += 1;
      } catch {
        // Log and continue with next stat
        continue;
      }
    }
    return upserted;
  }

  async getProblemStatsByAccount(accountId: string): Promise<CodeforcesUserProblemStatRecord[]> {
    return this.prisma.codeforcesUserProblemStat.findMany({
      where: { accountId },
    });
  }

  async getProblemStat(accountId: string, problemKey: string): Promise<CodeforcesUserProblemStatRecord | null> {
    return this.prisma.codeforcesUserProblemStat.findUnique({
      where: { accountId_problemKey: { accountId, problemKey } },
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
    let upserted = 0;
    for (const change of changes) {
      try {
        await this.prisma.codeforcesRatingChange.upsert({
          where: { accountId_contestId: { accountId, contestId: change.contestId } },
          create: {
            accountId,
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
          },
        });
        upserted += 1;
      } catch {
        continue;
      }
    }
    return upserted;
  }

  async getRatingHistory(accountId: string): Promise<CodeforcesRatingChangeRecord[]> {
    return this.prisma.codeforcesRatingChange.findMany({
      where: { accountId },
      orderBy: { ratingUpdateAt: "asc" },
    });
  }

  async upsertRecentSubmissions(
    accountId: string,
    submissions: CodeforcesRecentSubmissionInput[],
  ): Promise<number> {
    let upserted = 0;
    for (const sub of submissions) {
      try {
        await this.prisma.codeforcesRecentSubmission.upsert({
          where: { accountId_submissionId: { accountId, submissionId: sub.submissionId } },
          create: {
            accountId,
            submissionId: sub.submissionId,
            problemKey: sub.problemKey,
            contestId: sub.contestId ?? null,
            index: sub.index ?? null,
            name: sub.name ?? null,
            verdict: sub.verdict,
            creationTimeSeconds: sub.creationTimeSeconds,
            language: sub.language ?? null,
            passedTestCount: sub.passedTestCount ?? null,
            timeConsumedMillis: sub.timeConsumedMillis ?? null,
            memoryConsumedBytes: sub.memoryConsumedBytes ?? null,
          },
          update: {}, // No update needed — submission is immutable
        });
        upserted += 1;
      } catch {
        continue;
      }
    }
    return upserted;
  }

  async getRecentSubmissions(accountId: string, limit: number = 50): Promise<CodeforcesRecentSubmissionInput[]> {
    const records = await this.prisma.codeforcesRecentSubmission.findMany({
      where: { accountId },
      orderBy: { creationTimeSeconds: "desc" },
      take: limit,
    });
    return records.map((r) => ({
      submissionId: r.submissionId,
      problemKey: r.problemKey,
      contestId: r.contestId,
      index: r.index,
      name: r.name,
      verdict: r.verdict ?? "UNKNOWN",
      creationTimeSeconds: r.creationTimeSeconds,
      language: r.language,
      passedTestCount: r.passedTestCount,
      timeConsumedMillis: r.timeConsumedMillis,
      memoryConsumedBytes: r.memoryConsumedBytes,
    }));
  }

  async getAccountStats(accountId: string): Promise<CodeforcesAccountStats> {
    const [stats, submissions] = await Promise.all([
      this.getProblemStatsByAccount(accountId),
      this.prisma.codeforcesRecentSubmission.findMany({
        where: { accountId },
        select: { verdict: true, creationTimeSeconds: true },
        orderBy: { creationTimeSeconds: "desc" },
        take: 1000,
      }),
    ]);

    const verdictCounts: Record<string, number> = {};
    for (const sub of submissions) {
      const v = sub.verdict ?? "UNKNOWN";
      verdictCounts[v] = (verdictCounts[v] ?? 0) + 1;
    }

    return {
      totalSubmissions: submissions.length,
      acceptedSubmissions: stats.filter((s) => s.accepted).length,
      attemptedProblems: stats.length,
      solvedProblems: stats.filter((s) => s.accepted).length,
      unfinishedProblems: stats.filter((s) => !s.accepted).length,
      lastSubmissionAt: submissions.length > 0 ? new Date(submissions[0].creationTimeSeconds * 1000) : null,
      verdictCounts,
    };
  }
}
