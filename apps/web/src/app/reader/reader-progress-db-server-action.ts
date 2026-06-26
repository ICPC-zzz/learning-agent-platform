"use server";

/**
 * Reader Progress DB Server Action — dev-only server action for saving
 * reading progress to the database.
 *
 * Reads the dev session cookie, evaluates the guard, validates payload,
 * and writes through the DB writer. Safe to expose as a form action.
 *
 * @module reader-progress-db-server-action
 * @previewOnly — dev-only; never production sync
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { evaluateReaderProgressDbGuard } from "./reader-progress-db-guard";
import { writeReaderProgressToDb, type ReaderProgressDbWriteResult } from "./reader-progress-db-writer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReaderProgressDbActionState = ReaderProgressDbWriteResult & {
  /** Friendly message for UI display. */
  uiMessage: string;
};

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function saveReaderProgressToDbAction(
  bookId: string,
  chapterId: string,
  progressRatio: number,
  source?: string,
): Promise<ReaderProgressDbActionState> {
  let cookieValue: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get("lap-web-dev-session")?.value;
  } catch {
    cookieValue = undefined;
  }

  const guard = evaluateReaderProgressDbGuard(cookieValue);

  if (!guard.enabled || guard.sessionPayload === null) {
    return {
      ...(await buildBlockedResult(guard, bookId, chapterId)),
      uiMessage: buildUiMessageFromGuard(guard),
    };
  }

  const ownerId = guard.sessionPayload.userIdPreview;

  const result = await writeReaderProgressToDb(
    {
      bookId,
      chapterId,
      progressRatio,
      ownerId,
      source: source ?? "reader-dev-save",
    },
    guard,
  );

  if (result.success) {
    try {
      revalidatePath("/reader");
      revalidatePath(`/books/${bookId}`);
      revalidatePath("/user");
    } catch {
      // revalidation is best-effort
    }

    return {
      ...result,
      uiMessage: `阅读进度已保存到开发数据库（${Math.round(result.progressRatio * 100)}%）。dev-only · 未接生产同步 · 绑定 dev session 用户。`,
    };
  }

  return {
    ...result,
    uiMessage: result.reasonCode === "db-write-failed"
      ? (result as { message: string }).message
      : "阅读进度保存未完成。查看原因。",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildBlockedResult(
  guard: ReturnType<typeof evaluateReaderProgressDbGuard>,
  bookId: string,
  chapterId: string,
): Promise<ReaderProgressDbWriteResult> {
  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    callsRepository: false,
    bookId: bookId || null,
    chapterId: chapterId || null,
    reasonCode: "reader-progress-db-disabled-by-default",
    blockedReasons: [...guard.blockedReasons],
    productionReady: false,
  };
}

function buildUiMessageFromGuard(
  guard: ReturnType<typeof evaluateReaderProgressDbGuard>,
): string {
  if (guard.blockedReasons.length === 0) {
    return "阅读进度 DB 持久化未启用。";
  }
  return guard.blockedReasons[0];
}
