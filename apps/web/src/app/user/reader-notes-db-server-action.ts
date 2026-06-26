"use server";

/**
 * Reader Notes DB Server Action — dev-only server actions for reader
 * notes DB persistence.
 *
 * These are "use server" functions callable from client components.
 * Each reads the dev session cookie, evaluates the guard, and performs
 * the requested operation.
 *
 * @module reader-notes-db-server-action
 * @previewOnly — dev-only; never production sync
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { evaluateReaderNotesDbGuard } from "./reader-notes-db-guard";
import {
  doAddReaderNote,
  doRemoveReaderNote,
  type ReaderNotesDbActionResult,
} from "./reader-notes-db-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddReaderNoteInput {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  noteText: string;
  excerptPreview?: string | null;
  sourceType: string;
}

export interface AddReaderNoteResult {
  success: boolean;
  devOnly: true;
  writesDatabase: boolean;
  noteId: string | null;
  bookId: string | null;
  chapterId: string | null;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
  uiMessage: string;
  noteTextPreview?: string;
}

export interface RemoveReaderNoteResult {
  success: boolean;
  devOnly: true;
  writesDatabase: boolean;
  noteId: string | null;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
  uiMessage: string;
}

// ---------------------------------------------------------------------------
// Action: Add reader note
// ---------------------------------------------------------------------------

/**
 * Add a reader note in the database.
 */
export async function addReaderNoteDbAction(
  input: AddReaderNoteInput,
): Promise<AddReaderNoteResult> {
  let cookieValue: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get("lap-web-dev-session")?.value;
  } catch {
    cookieValue = undefined;
  }

  const guard = evaluateReaderNotesDbGuard(cookieValue);

  if (!guard.enabled || guard.sessionPayload === null) {
    return {
      ...buildAddBlockedResult(guard, input.bookId, input.chapterId),
      uiMessage: buildBlockedUiMessage(guard),
    };
  }

  const ownerId = guard.sessionPayload.userIdPreview;

  const result = await doAddReaderNote(
    {
      bookId: input.bookId,
      chapterId: input.chapterId,
      bookTitle: input.bookTitle,
      chapterTitle: input.chapterTitle,
      progressRatio: input.progressRatio,
      noteText: input.noteText,
      excerptPreview: input.excerptPreview ?? null,
      sourceType: input.sourceType,
      ownerId,
    },
    guard,
  );

  if (result.success) {
    try {
      revalidatePath("/user");
      revalidatePath("/user/notes");
      revalidatePath("/reader");
    } catch {
      // best-effort
    }

    return {
      success: true,
      devOnly: true,
      writesDatabase: result.writesDatabase,
      noteId: result.noteId,
      bookId: result.bookId,
      chapterId: result.chapterId,
      reasonCode: result.reasonCode,
      blockedReasons: [],
      productionReady: false,
      uiMessage: "已添加到开发 DB 笔记（dev-only · 未接生产同步）",
      noteTextPreview: result.noteTextPreview,
    };
  }

  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    noteId: result.noteId,
    bookId: result.bookId,
    chapterId: result.chapterId,
    reasonCode: result.reasonCode,
    blockedReasons: "blockedReasons" in result ? result.blockedReasons : [],
    productionReady: false,
    uiMessage: "reasonCode" in result && result.reasonCode === "db-action-failed"
      ? (result as { message: string }).message
      : "笔记操作未完成。本地笔记不受影响。",
  };
}

// ---------------------------------------------------------------------------
// Action: Remove reader note
// ---------------------------------------------------------------------------

/**
 * Remove a reader note from the database.
 */
export async function removeReaderNoteDbAction(
  noteId: string,
): Promise<RemoveReaderNoteResult> {
  let cookieValue: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get("lap-web-dev-session")?.value;
  } catch {
    cookieValue = undefined;
  }

  const guard = evaluateReaderNotesDbGuard(cookieValue);

  if (!guard.enabled || guard.sessionPayload === null) {
    return {
      ...buildRemoveBlockedResult(guard, noteId),
      uiMessage: buildBlockedUiMessage(guard),
    };
  }

  const ownerId = guard.sessionPayload.userIdPreview;

  const result = await doRemoveReaderNote(noteId, ownerId, guard);

  if (result.success) {
    try {
      revalidatePath("/user");
      revalidatePath("/user/notes");
      revalidatePath("/reader");
    } catch {
      // best-effort
    }

    return {
      success: true,
      devOnly: true,
      writesDatabase: result.writesDatabase,
      noteId: result.noteId,
      reasonCode: result.reasonCode,
      blockedReasons: [],
      productionReady: false,
      uiMessage: "已从开发 DB 笔记中移除（dev-only · 未接生产同步）",
    };
  }

  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    noteId: result.noteId,
    reasonCode: result.reasonCode,
    blockedReasons: "blockedReasons" in result ? result.blockedReasons : [],
    productionReady: false,
    uiMessage: "reasonCode" in result && result.reasonCode === "db-action-failed"
      ? (result as { message: string }).message
      : "笔记操作未完成。本地笔记不受影响。",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAddBlockedResult(
  guard: ReturnType<typeof evaluateReaderNotesDbGuard>,
  bookId: string,
  chapterId: string,
): AddReaderNoteResult {
  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    noteId: null,
    bookId: bookId || null,
    chapterId: chapterId || null,
    reasonCode: "reader-notes-db-disabled-by-default",
    blockedReasons: [...guard.blockedReasons],
    productionReady: false,
    uiMessage: "",
  };
}

function buildRemoveBlockedResult(
  guard: ReturnType<typeof evaluateReaderNotesDbGuard>,
  noteId: string,
): RemoveReaderNoteResult {
  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    noteId: noteId || null,
    reasonCode: "reader-notes-db-disabled-by-default",
    blockedReasons: [...guard.blockedReasons],
    productionReady: false,
    uiMessage: "",
  };
}

function buildBlockedUiMessage(
  guard: ReturnType<typeof evaluateReaderNotesDbGuard>,
): string {
  if (guard.blockedReasons.length === 0) {
    return "阅读器笔记 DB 持久化未启用。使用本地笔记 fallback。";
  }
  return guard.blockedReasons[0];
}
