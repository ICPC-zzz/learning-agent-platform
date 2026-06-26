/**
 * Codeforces Account Service — Server-Side Binding
 *
 * Handles binding, unbinding, and validation of Codeforces handles.
 * The database is the single source of truth — localStorage is NOT authoritative.
 *
 * @module codeforces-account-service
 * @serverOnly
 */

import { fetchCodeforcesUserInfo } from "./codeforces-client.js";
import {
  syncCodeforcesUserData,
} from "./codeforces-sync-service.js";
import type {
  CodeforcesAccountRepository,
  CodeforcesAccountRecord,
} from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BindHandleResult {
  success: boolean;
  account?: CodeforcesAccountRecord;
  error?: string;
  errorCode?: "ALREADY_BOUND" | "HANDLE_NOT_FOUND" | "ALREADY_BOUND_OTHER_USER" | "API_ERROR" | "UNKNOWN";
}

export interface UnbindHandleResult {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Bind
// ---------------------------------------------------------------------------

/**
 * Bind a Codeforces handle to the current user.
 *
 * 1. Validates the handle exists via user.info
 * 2. Saves the canonical (case-correct) handle
 * 3. Stores binding in database (single source of truth)
 * 4. Triggers initial full sync
 */
export async function bindCodeforcesHandle(params: {
  userId: string;
  handle: string;
  repository: CodeforcesAccountRepository;
}): Promise<BindHandleResult> {
  const { userId, handle, repository } = params;

  // Check if user already has a bound account
  const existing = await repository.getAccountByUserId(userId);
  if (existing) {
    return {
      success: false,
      error: "此账号已绑定 Codeforces Handle，请先解绑再绑定新 Handle",
      errorCode: "ALREADY_BOUND",
    };
  }

  // Validate handle via Codeforces API
  const infoResult = await fetchCodeforcesUserInfo(handle);
  if (!infoResult.success || !infoResult.data) {
    if (infoResult.error?.includes("HANDLE_NOT_FOUND") || infoResult.error?.includes("not found")) {
      return {
        success: false,
        error: "未找到此 Codeforces Handle，请检查拼写",
        errorCode: "HANDLE_NOT_FOUND",
      };
    }
    return {
      success: false,
      error: "Codeforces API 暂时不可用，请稍后重试",
      errorCode: "API_ERROR",
    };
  }

  const userInfo = infoResult.data;
  const canonicalHandle = userInfo.handle;

  // Check if this handle is already bound to another user
  const normalized = canonicalHandle.toLowerCase().trim();
  const existingHandle = await repository.getAccountByHandle(normalized);
  if (existingHandle && existingHandle.userId !== userId) {
    return {
      success: false,
      error: "此 Handle 已被其他用户绑定",
      errorCode: "ALREADY_BOUND_OTHER_USER",
    };
  }

  // Create account
  const account = await repository.createAccount({
    userId,
    canonicalHandle,
    normalizedHandle: normalized,
    currentRating: userInfo.rating ?? null,
    maxRating: userInfo.maxRating ?? null,
    rank: userInfo.rank ?? null,
    maxRank: userInfo.maxRank ?? null,
  });

  // Trigger initial sync (fire-and-forget but we'll await for binding UX)
  try {
    await syncCodeforcesUserData({
      userId,
      accountId: account.id,
      handle: canonicalHandle,
      repository,
      fullSync: true,
    });
  } catch {
    // Sync failure doesn't block binding — user can sync later
  }

  return { success: true, account };
}

/**
 * Unbind the Codeforces handle from the current user.
 *
 * - Requires explicit confirmation (caller must handle this)
 * - Deletes the binding relationship
 * - Does NOT delete: wrong book, favorites, collections, articles, or other learning data
 * - Keeps historical CF snapshots per existing data policy
 */
export async function unbindCodeforcesHandle(params: {
  userId: string;
  repository: CodeforcesAccountRepository;
}): Promise<UnbindHandleResult> {
  const { userId, repository } = params;

  const existing = await repository.getAccountByUserId(userId);
  if (!existing) {
    return { success: false, error: "未找到绑定的 Codeforces 账号" };
  }

  await repository.deleteAccount(existing.id);
  // Cascade delete handles related records (problemStats, ratingChanges, recentSubmissions)

  return { success: true };
}

/**
 * Get the currently bound Codeforces account for a user.
 * Returns null if no account is bound.
 */
export async function getBoundAccount(
  userId: string,
  repository: CodeforcesAccountRepository,
): Promise<CodeforcesAccountRecord | null> {
  return repository.getAccountByUserId(userId);
}
