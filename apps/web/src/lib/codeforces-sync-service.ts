/**
 * Codeforces User Data Sync Service
 *
 * Server-only service that orchestrates fetching Codeforces user data
 * (user.info, user.status, user.rating) and persisting to the database.
 *
 * Security:
 * - Server-only — never called from client components directly
 * - Never saves submission source code
 * - Never saves raw API responses
 * - API failures preserve old data (no clearing on error)
 * - Respects fixed page sizes and absolute submission limits
 *
 * @module codeforces-sync-service
 * @serverOnly
 */

import {
  fetchCodeforcesUserInfo,
  fetchCodeforcesUserStatus,
  fetchCodeforcesUserRating,
  type CodeforcesUserInfo,
} from "./codeforces-client.js";
import {
  createCodeforcesExternalId,
} from "./codeforces-metadata-sync.js";
import type {
  CodeforcesAccountRepository,
  CodeforcesAccountUpdateSyncInput,
  CodeforcesUserProblemStatUpsertInput,
  CodeforcesRecentSubmissionInput,
} from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum seconds between sync attempts for the same user. */
const SYNC_COOLDOWN_SECONDS = 60;
/** Maximum recent submissions to save per sync. */
const MAX_RECENT_SUBMISSIONS = 500;

// ---------------------------------------------------------------------------
// In-memory sync lock (prevents concurrent sync for same user)
// ---------------------------------------------------------------------------

const syncLocks = new Map<string, Promise<void>>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Perform a complete Codeforces user data sync:
 * 1. Fetch user.info → update account profile
 * 2. Fetch user.status → aggregate problem stats + save recent submissions
 * 3. Fetch user.rating → save rating history
 *
 * Returns the updated account record.
 */
export async function syncCodeforcesUserData(params: {
  userId: string;
  accountId: string;
  handle: string;
  repository: CodeforcesAccountRepository;
  fullSync?: boolean;
}): Promise<{
  success: boolean;
  accountUpdated: boolean;
  submissionsFetched: number;
  submissionsTruncated: boolean;
  ratingEntriesSaved: number;
  problemStatsUpserted: number;
  error?: string;
}> {
  const { userId, accountId, handle, repository, fullSync = false } = params;

  // Sync lock: prevent concurrent syncs for the same user
  const existingLock = syncLocks.get(userId);
  if (existingLock) {
    // Wait for the existing sync to complete
    try {
      await existingLock;
    } catch {
      // Previous sync failed — proceed with new sync
    }
  }

  let resolveLock: () => void;
  const lockPromise = new Promise<void>((resolve) => { resolveLock = resolve; });
  syncLocks.set(userId, lockPromise);

  try {
    const result = await doSync({ userId, accountId, handle, repository, fullSync });
    return result;
  } finally {
    resolveLock!();
    syncLocks.delete(userId);
  }
}

async function doSync(params: {
  userId: string;
  accountId: string;
  handle: string;
  repository: CodeforcesAccountRepository;
  fullSync: boolean;
}): Promise<{
  success: boolean;
  accountUpdated: boolean;
  submissionsFetched: number;
  submissionsTruncated: boolean;
  ratingEntriesSaved: number;
  problemStatsUpserted: number;
  error?: string;
}> {
  const { accountId, handle, repository } = params;

  // Mark syncing
  await repository.updateAccountSyncState(accountId, { syncStatus: "syncing", lastSyncedAt: new Date() });

  // Step 1: Fetch user.info
  const userInfoResult = await fetchCodeforcesUserInfo(handle);
  if (!userInfoResult.success || !userInfoResult.data) {
    await repository.updateAccountSyncState(accountId, {
      syncStatus: "error",
      syncErrorCode: "USER_INFO_FAILED",
      lastSyncedAt: new Date(),
    });
    return {
      success: false,
      accountUpdated: false,
      submissionsFetched: 0,
      submissionsTruncated: false,
      ratingEntriesSaved: 0,
      problemStatsUpserted: 0,
      error: userInfoResult.error ?? "Failed to fetch user.info",
    };
  }

  const userInfo = userInfoResult.data;

  // Update account profile from user.info
  await repository.updateAccountSyncState(accountId, {
    currentRating: userInfo.rating ?? null,
    maxRating: userInfo.maxRating ?? null,
    rank: userInfo.rank ?? null,
    maxRank: userInfo.maxRank ?? null,
    syncStatus: "syncing",
    lastSyncedAt: new Date(),
  });

  // Step 2: Fetch user.status (submissions)
  let submissionsFetched = 0;
  let submissionsTruncated = false;
  let problemStatsUpserted = 0;
  let recentSubmissionsSaved = 0;

  try {
    const statusResult = await fetchCodeforcesUserStatus(handle);
    if (statusResult.success && statusResult.data) {
      submissionsFetched = statusResult.data.totalFetched;
      submissionsTruncated = statusResult.data.truncated;

      // Aggregate per-problem stats
      const problemStats = aggregateProblemStats(statusResult.data.submissions);
      if (problemStats.length > 0) {
        problemStatsUpserted = await repository.upsertProblemStats(accountId, problemStats);
      }

      // Save recent submissions (limited subset)
      const recentSubs = statusResult.data.submissions.slice(0, MAX_RECENT_SUBMISSIONS);
      const recentInputs: CodeforcesRecentSubmissionInput[] = recentSubs.map((s) => ({
        submissionId: s.id,
        problemKey: buildProblemKey(s.problem.contestId, s.problem.index),
        contestId: s.problem.contestId ?? null,
        index: s.problem.index,
        name: s.problem.name,
        verdict: s.verdict ?? "UNKNOWN",
        creationTimeSeconds: s.creationTimeSeconds,
        language: s.programmingLanguage,
        passedTestCount: s.passedTestCount,
        timeConsumedMillis: s.timeConsumedMillis,
        memoryConsumedBytes: s.memoryConsumedBytes,
      }));
      recentSubmissionsSaved = await repository.upsertRecentSubmissions(accountId, recentInputs);
    }
  } catch {
    // Submission fetch failure — continue with remaining steps
  }

  // Step 3: Fetch user.rating
  let ratingEntriesSaved = 0;
  try {
    const ratingResult = await fetchCodeforcesUserRating(handle);
    if (ratingResult.success && ratingResult.data) {
      const changes = ratingResult.data.map((r) => ({
        contestId: r.contestId,
        contestName: r.contestName,
        rank: r.rank ?? null,
        oldRating: r.oldRating,
        newRating: r.newRating,
        ratingUpdateAt: new Date(r.ratingUpdateTimeSeconds * 1000),
      }));
      ratingEntriesSaved = await repository.upsertRatingChanges(accountId, changes);
    }
  } catch {
    // Rating fetch failure — continue
  }

  // Mark sync complete
  const updateInput: CodeforcesAccountUpdateSyncInput = {
    currentRating: userInfo.rating ?? null,
    maxRating: userInfo.maxRating ?? null,
    rank: userInfo.rank ?? null,
    maxRank: userInfo.maxRank ?? null,
    lastSyncedAt: new Date(),
    syncStatus: "idle",
    syncErrorCode: null,
    dataTruncated: submissionsTruncated,
  };
  await repository.updateAccountSyncState(accountId, updateInput);

  return {
    success: true,
    accountUpdated: true,
    submissionsFetched,
    submissionsTruncated,
    ratingEntriesSaved,
    problemStatsUpserted,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProblemKey(contestId: number | undefined, index: string): string {
  if (contestId !== undefined && contestId > 0) {
    return createCodeforcesExternalId(contestId, index);
  }
  // Fallback for gym problems or problems without contestId
  return `codeforces:unknown:${index}`;
}

function aggregateProblemStats(
  submissions: Array<{
    id: number;
    contestId?: number;
    creationTimeSeconds: number;
    problem: {
      contestId?: number;
      index: string;
      name: string;
      rating?: number;
      tags: string[];
    };
    verdict?: string;
    passedTestCount: number;
  }>,
): CodeforcesUserProblemStatUpsertInput[] {
  // Group by problem key, keep only most recent submission per problem
  const byProblem = new Map<string, CodeforcesUserProblemStatUpsertInput>();

  for (const sub of submissions) {
    const key = buildProblemKey(sub.problem.contestId, sub.problem.index);

    const existing = byProblem.get(key);
    const verdict = sub.verdict ?? "UNKNOWN";
    const isAccepted = verdict === "OK";

    if (!existing) {
      byProblem.set(key, {
        problemKey: key,
        contestId: sub.problem.contestId ?? 0,
        index: sub.problem.index,
        name: sub.problem.name,
        rating: sub.problem.rating ?? null,
        tags: sub.problem.tags,
        accepted: isAccepted,
        lastSubmissionId: sub.id,
        lastVerdict: verdict,
        submissionTimeSeconds: sub.creationTimeSeconds,
      });
    } else {
      // Earlier submission in the list = more recent (newest first)
      // Keep the more recent verdict info but merge accepted state
      if (sub.creationTimeSeconds > existing.submissionTimeSeconds) {
        existing.lastSubmissionId = sub.id;
        existing.lastVerdict = verdict;
        existing.submissionTimeSeconds = sub.creationTimeSeconds;
      }
      if (isAccepted) {
        existing.accepted = true;
      }
      // We'll increment attempts count in the repository upsert
    }
  }

  return Array.from(byProblem.values());
}
