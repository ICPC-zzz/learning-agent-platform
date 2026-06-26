/**
 * Codeforces Dashboard Loader — Server Component Data Fetching
 *
 * Loads Codeforces account data for the user center dashboard.
 * All data is read from the database snapshot (no live API calls).
 *
 * @serverOnly
 */

import { cookies } from "next/headers";
import { deserializeDevSession, getSafeSessionSummary } from "../../lib/web-auth-dev-session";
import {
  getPrismaClient,
  PrismaCodeforcesAccountRepository,
  type CodeforcesAccountRecord,
  type CodeforcesUserProblemStatRecord,
  type CodeforcesRatingChangeRecord,
  type CodeforcesAccountStats,
} from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Dashboard data type
// ---------------------------------------------------------------------------

export interface CodeforcesDashboardData {
  /** Whether the user has a bound CF account */
  hasAccount: boolean;
  /** Account profile (null if not bound) */
  account: CodeforcesAccountRecord | null;
  /** Aggregated stats (null if not bound or no sync data) */
  stats: CodeforcesAccountStats | null;
  /** Problem stats for charts (empty if not bound) */
  problemStats: CodeforcesUserProblemStatRecord[];
  /** Rating history for chart (empty if not bound) */
  ratingHistory: CodeforcesRatingChangeRecord[];
  /** Whether sync is currently in progress */
  isSyncing: boolean;
  /** Sync error if any */
  syncError: string | null;
}

// ---------------------------------------------------------------------------
// Loader (convenience — creates client and repository internally)
// ---------------------------------------------------------------------------

export async function loadCodeforcesDashboard(): Promise<CodeforcesDashboardData> {
  const prisma = getPrismaClient();
  const repository = new PrismaCodeforcesAccountRepository(prisma);

  // Get current user
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const payload = deserializeDevSession(raw);
    const summary = getSafeSessionSummary(payload);
    userId = summary.user?.userIdPreview ?? null;
  } catch {
    // Not logged in
  }

  if (!userId) {
    return {
      hasAccount: false,
      account: null,
      stats: null,
      problemStats: [],
      ratingHistory: [],
      isSyncing: false,
      syncError: null,
    };
  }

  const account = await repository.getAccountByUserId(userId);
  if (!account) {
    return {
      hasAccount: false,
      account: null,
      stats: null,
      problemStats: [],
      ratingHistory: [],
      isSyncing: false,
      syncError: null,
    };
  }

  // Fetch stats and rating history in parallel
  const [stats, problemStats, ratingHistory] = await Promise.all([
    repository.getAccountStats(account.id),
    repository.getProblemStatsByAccount(account.id),
    repository.getRatingHistory(account.id),
  ]);

  return {
    hasAccount: true,
    account,
    stats,
    problemStats,
    ratingHistory,
    isSyncing: account.syncStatus === "syncing",
    syncError: account.syncErrorCode ?? null,
  };
}
