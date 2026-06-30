"use server";

/**
 * Codeforces Server Actions — Bind, Unbind, Sync
 *
 * Server-only actions called from client components.
 * All mutations go through the CodeforcesAccountRepository.
 *
 * @serverOnly
 */

import {
  getPrismaClient,
  PrismaCodeforcesAccountRepository,
} from "@learning-agent-platform/db";
import {
  bindCodeforcesHandle,
  unbindCodeforcesHandle,
} from "../../lib/codeforces-account-service";
import {
  syncCodeforcesUserData,
} from "../../lib/codeforces-sync-service";
import { revalidatePath } from "next/cache";
import { getCurrentAuthSession } from "../../lib/session/web-auth-session";

function getRepository(): PrismaCodeforcesAccountRepository {
  return new PrismaCodeforcesAccountRepository(getPrismaClient());
}

async function resolveUserId(): Promise<string | null> {
  const session = await getCurrentAuthSession();
  return session.hasSession ? session.userId : null;
}

// ---------------------------------------------------------------------------
// Bind action
// ---------------------------------------------------------------------------

export async function cfBindHandleAction(handle: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const userId = await resolveUserId();
  if (!userId) {
    return { success: false, error: "请先登录" };
  }

  const normalized = handle.trim();
  if (!normalized) {
    return { success: false, error: "请输入 Codeforces Handle" };
  }

  if (normalized.length > 24 || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(normalized)) {
    return { success: false, error: "Handle 格式无效" };
  }

  const repository = getRepository();
  const result = await bindCodeforcesHandle({ userId, handle: normalized, repository });

  if (result.success) {
    revalidatePath("/user/codeforces");
    revalidatePath("/problems");
  }

  return result;
}

// ---------------------------------------------------------------------------
// Unbind action
// ---------------------------------------------------------------------------

export async function cfUnbindHandleAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  const userId = await resolveUserId();
  if (!userId) {
    return { success: false, error: "请先登录" };
  }

  const repository = getRepository();
  const result = await unbindCodeforcesHandle({ userId, repository });

  if (result.success) {
    revalidatePath("/user/codeforces");
    revalidatePath("/problems");
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sync action
// ---------------------------------------------------------------------------

export async function cfSyncAction(): Promise<{
  success: boolean;
  submissionsFetched: number;
  submissionsTruncated: boolean;
  error?: string;
}> {
  const userId = await resolveUserId();
  if (!userId) {
    return { success: false, submissionsFetched: 0, submissionsTruncated: false, error: "请先登录" };
  }

  const repository = getRepository();
  const account = await repository.getAccountByUserId(userId);
  if (!account) {
    return { success: false, submissionsFetched: 0, submissionsTruncated: false, error: "未绑定 Codeforces 账号" };
  }

  const result = await syncCodeforcesUserData({
    userId,
    accountId: account.id,
    handle: account.canonicalHandle,
    repository,
    fullSync: false,
  });

  revalidatePath("/user/codeforces");
  revalidatePath("/problems");

  return {
    success: result.success,
    submissionsFetched: result.submissionsFetched,
    submissionsTruncated: result.submissionsTruncated,
    error: result.error,
  };
}
