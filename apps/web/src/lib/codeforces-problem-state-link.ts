/**
 * Codeforces Problem State Linkage
 *
 * Maps CodeforcesUserProblemStat records to ProblemPracticeActivity statuses
 * for seamless UI display of practice states on /problems and detail pages.
 *
 * State semantics:
 * - No submissions → not-practiced (no ProblemPracticeActivity record)
 * - Has submissions, no OK → "practiced" (ProblemPracticeActivity with status "practiced")
 * - Has at least one OK → "completed" (ProblemPracticeActivity with status "completed")
 * - User manually added to wrong book → "needs-review" (ProblemWrongBook + ProblemPracticeActivity)
 *
 * This service is server-only and is called after a CF sync completes.
 *
 * @module codeforces-problem-state-link
 * @serverOnly
 */

import type { PrismaClient } from "@prisma/client";
import type {
  CodeforcesAccountRepository,
  CodeforcesUserProblemStatRecord,
} from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * After a CF sync, map the user's problem stats to ProblemPracticeActivity records.
 *
 * - Finds local problems matching the CF problem keys
 * - Upserts ProblemPracticeActivity with appropriate status
 * - Does NOT create practice records for problems not in the local pool
 * - Does NOT modify ProblemWrongBook entries
 * - Does NOT remove existing ProblemPracticeActivity for problems the user hasn't submitted
 *
 * Returns counts of created/updated records.
 */
export async function syncPracticeActivityFromCfStats(params: {
  userId: string;
  accountId: string;
  repository: CodeforcesAccountRepository;
  prisma: PrismaClient;
}): Promise<{
  practiceUpserted: number;
  practiceTotal: number;
}> {
  const { userId, accountId, repository, prisma } = params;

  // Get all CF problem stats for this account
  const stats = await repository.getProblemStatsByAccount(accountId);
  if (stats.length === 0) {
    return { practiceUpserted: 0, practiceTotal: 0 };
  }

  // Build a map of problemKey → stat
  const statByKey = new Map<string, CodeforcesUserProblemStatRecord>();
  for (const stat of stats) {
    statByKey.set(stat.problemKey, stat);
  }

  // Find all local problems
  const localProblems = await prisma.problem.findMany({
    where: { source: "codeforces" },
    select: { id: true, title: true, difficulty: true, tags: true, metadata: true },
  });

  // Map local problems to CF problem keys
  const localByKey = new Map<string, typeof localProblems[0]>();
  for (const problem of localProblems) {
    const keys = extractProblemKeys(problem);
    for (const key of keys) {
      if (statByKey.has(key) && !localByKey.has(key)) {
        localByKey.set(key, problem);
      }
    }
  }

  // Upsert ProblemPracticeActivity for matched problems
  let upserted = 0;
  for (const [key, stat] of statByKey) {
    const localProblem = localByKey.get(key);
    if (!localProblem) continue; // Skip non-local-pool problems for practice activity

    const status = stat.accepted ? "completed" : "practiced";

    try {
      // Use upsert pattern via findFirst + create/update
      const existing = await prisma.problemPracticeActivity.findFirst({
        where: { userId, problemId: localProblem.id },
      });

      if (existing) {
        // Don't downgrade status: completed stays completed
        const newStatus = existing.status === "completed" ? "completed" : status;
        if (existing.status !== newStatus || existing.problemTitle !== localProblem.title) {
          await prisma.problemPracticeActivity.update({
            where: { id: existing.id },
            data: {
              problemTitle: localProblem.title,
              difficulty: localProblem.difficulty,
              status: newStatus,
              tags: localProblem.tags,
            },
          });
          upserted += 1;
        }
      } else {
        await prisma.problemPracticeActivity.create({
          data: {
            userId,
            problemId: localProblem.id,
            problemTitle: localProblem.title,
            difficulty: localProblem.difficulty,
            status,
            tags: localProblem.tags,
          },
        });
        upserted += 1;
      }
    } catch {
      // Skip individual failures — don't block the batch
      continue;
    }
  }

  return { practiceUpserted: upserted, practiceTotal: stats.length };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractProblemKeys(problem: {
  metadata: unknown;
}): string[] {
  const keys = new Set<string>();

  if (!problem.metadata || typeof problem.metadata !== "object" || Array.isArray(problem.metadata)) {
    return [];
  }

  const meta = problem.metadata as Record<string, unknown>;
  const externalId = typeof meta.externalId === "string" ? meta.externalId : null;
  const externalProblemId = typeof meta.externalProblemId === "string" ? meta.externalProblemId : null;

  if (externalId?.startsWith("codeforces:")) {
    keys.add(externalId);
  }
  if (externalProblemId?.startsWith("codeforces:") && externalProblemId !== externalId) {
    keys.add(externalProblemId);
  }

  // Also try to build from contestId + index
  const contestId = typeof meta.contestId === "number" && meta.contestId > 0 ? meta.contestId : null;
  const index = typeof meta.index === "string" && meta.index.length > 0 ? meta.index : null;
  if (contestId !== null && index !== null) {
    keys.add(`codeforces:${contestId}:${index}`);
  }

  return Array.from(keys);
}

// ---------------------------------------------------------------------------
// Problem state query for UI
// ---------------------------------------------------------------------------

/**
 * Get practice states for a list of problem keys.
 * Used by the problem list and detail pages.
 *
 * Returns a map of problemKey → status, and whether the user has CF bound.
 */
export async function getProblemPracticeStates(params: {
  userId: string;
  problemKeys: string[];
  repository: CodeforcesAccountRepository;
  prisma: PrismaClient;
}): Promise<{
  hasCfBound: boolean;
  stateByProblemKey: Map<string, { status: string; attempts: number; accepted: boolean }>;
  wrongBookProblemKeys: Set<string>;
}> {
  const { userId, problemKeys, repository, prisma } = params;

  const account = await repository.getAccountByUserId(userId);
  if (!account) {
    return {
      hasCfBound: false,
      stateByProblemKey: new Map(),
      wrongBookProblemKeys: new Set(),
    };
  }

  // Get CF stats for requested problem keys
  const cfStates = new Map<string, { status: string; attempts: number; accepted: boolean }>();
  for (const key of problemKeys) {
    const stat = await repository.getProblemStat(account.id, key);
    if (stat) {
      cfStates.set(key, {
        status: stat.accepted ? "completed" : "practiced",
        attempts: stat.attempts,
        accepted: stat.accepted,
      });
    }
  }

  // Get wrong book keys
  const wrongBookEntries = await prisma.problemWrongBook.findMany({
    where: { ownerId: userId },
    select: { problemId: true },
  });
  const wrongBookProblemIds = new Set(wrongBookEntries.map((e) => e.problemId));

  return {
    hasCfBound: true,
    stateByProblemKey: cfStates,
    wrongBookProblemKeys: wrongBookProblemIds,
  };
}
