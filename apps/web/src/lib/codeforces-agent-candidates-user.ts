/**
 * Codeforces Agent Candidate Query — User-Scoped Wrapper
 *
 * Wraps the raw queryCodeforcesAgentCandidates with mandatory user-level
 * safety rules:
 *
 * 1. Only queries the local curated Codeforces problem pool.
 * 2. Automatically fetches the user's solvedProblemKeys from the database
 *    and passes them as excluded — caller cannot opt out.
 * 3. Returns only new_training candidates by default.
 * 4. Never calls Codeforces API or LLM.
 * 5. Read-only — no database writes.
 *
 * Future: a separate "review" mode may be added via explicit mode parameter
 * and a dedicated review-candidates function.
 *
 * @module codeforces-agent-candidates-user
 * @previewOnly — dev-only service, not for production Agent use
 */

import type { CodeforcesAccountRepository } from "@learning-agent-platform/db";
import {
  queryCodeforcesAgentCandidates,
  type AgentCandidateProblemRecord,
  type CodeforcesAgentCandidateQuery,
  type CodeforcesAgentCandidateResult,
} from "./codeforces-agent-candidates.ts";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type AgentTrainingMode = "new_training";

export interface UserCodeforcesCandidateQuery
  extends Omit<
    CodeforcesAgentCandidateQuery,
    "solvedProblemKeys" | "excludeProblemKeys"
  > {
  /**
   * Training mode. Currently only "new_training" is supported.
   * In this mode, all problems the user has already solved are forcibly excluded.
   */
  mode?: AgentTrainingMode;
}

export interface UserCodeforcesCandidateResult {
  candidates: CodeforcesAgentCandidateResult["candidates"];
  totalCandidates: number;
  querySummary: CodeforcesAgentCandidateResult["querySummary"] & {
    mode: AgentTrainingMode;
    solvedKeysExcluded: number;
  };
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Query the curated Codeforces problem pool for a specific user's training
 * candidates, with mandatory exclusion of already-solved problems.
 *
 * Rules enforced server-side (caller cannot bypass):
 * - Only problems from the local curated pool are returned.
 * - All problems the user has solved (per CodeforcesUserProblemStat) are excluded.
 * - Problems the user has attempted but not solved are still eligible.
 * - Wrong-book problems that are already solved are excluded (new_training).
 * - Never calls Codeforces API or LLM.
 * - Read-only.
 *
 * @param userId - The authenticated user's ID (validated by caller).
 * @param records - All curated Codeforces problems from the database.
 * @param query - Candidate selection criteria (without solvedProblemKeys).
 * @param repository - CodeforcesAccountRepository for fetching user stats.
 * @returns Filtered and sorted candidate list.
 */
export async function queryCodeforcesCandidatesForUser(
  userId: string,
  records: readonly AgentCandidateProblemRecord[],
  query: UserCodeforcesCandidateQuery,
  repository: CodeforcesAccountRepository,
): Promise<UserCodeforcesCandidateResult> {
  const mode: AgentTrainingMode = query.mode ?? "new_training";

  // Look up user's Codeforces account
  const account = await repository.getAccountByUserId(userId);

  // Collect solved problem keys
  let solvedProblemKeys: string[] = [];
  if (account) {
    const stats = await repository.getProblemStatsByAccount(account.id);
    solvedProblemKeys = stats
      .filter((s) => s.accepted)
      .map((s) => s.problemKey);
  }

  // Build the internal query — caller cannot override solvedProblemKeys
  const internalQuery: CodeforcesAgentCandidateQuery = {
    ...query,
    solvedProblemKeys,
    // Force exclude solved keys; caller cannot override the exclusion set.
    excludeProblemKeys: solvedProblemKeys,
  };

  // Reuse the existing read-only in-memory query
  const result = queryCodeforcesAgentCandidates(records, internalQuery);

  return {
    candidates: result.candidates,
    totalCandidates: result.totalCandidates,
    querySummary: {
      ...result.querySummary,
      mode,
      solvedKeysExcluded: solvedProblemKeys.length,
    },
  };
}

/**
 * Lightweight version: get only the solved problem keys for a user.
 * Used by tests and clients that only need the exclusion set.
 */
export async function getUserSolvedProblemKeys(
  userId: string,
  repository: CodeforcesAccountRepository,
): Promise<string[]> {
  const account = await repository.getAccountByUserId(userId);
  if (!account) return [];
  const stats = await repository.getProblemStatsByAccount(account.id);
  return stats.filter((s) => s.accepted).map((s) => s.problemKey);
}

/**
 * Validate that a user query is safe — no API keys, no LLM calls, read-only.
 */
export function validateUserCandidateQuery(
  query: UserCodeforcesCandidateQuery,
): string[] {
  const errors: string[] = [];

  // Only new_training is currently supported
  if (query.mode && query.mode !== "new_training") {
    errors.push(
      `Unsupported mode: ${query.mode}. Only "new_training" is currently available.`,
    );
  }

  // Ensure caller didn't try to sneak in solvedProblemKeys
  const raw = query as Record<string, unknown>;
  if ("solvedProblemKeys" in raw) {
    errors.push(
      "solvedProblemKeys must not be set by the caller — it is automatically derived from the user's account.",
    );
  }

  return errors;
}
