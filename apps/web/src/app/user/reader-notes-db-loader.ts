/**
 * Reader Notes DB Loader — loads dev-only DB notes for the /user page.
 *
 * Reads the dev session cookie, evaluates the guard, and loads
 * notes from the DB when all guards pass.
 *
 * Falls back to empty result when guard is disabled or no session.
 *
 * @module reader-notes-db-loader
 * @previewOnly — dev-only; never production user system
 */

import {
  deserializeDevSession,
} from "../../lib/web-auth-dev-session";
import {
  evaluateReaderNotesDbGuard,
} from "./reader-notes-db-guard";
import {
  doListReaderNotesByOwner,
} from "./reader-notes-db-actions";
import type { ReaderNoteRecord } from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbReaderNoteView {
  id: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  noteText: string;
  noteTextPreview: string;
  excerptPreview: string | null;
  sourceType: string;
  ownerLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbReaderNotesLoadResult {
  guardEnabled: boolean;
  useDbNotes: boolean;
  hasSession: boolean;
  message: string;
  items: DbReaderNoteView[];
  notice: string;
}

// ---------------------------------------------------------------------------
// View builder
// ---------------------------------------------------------------------------

function toDbReaderNoteView(
  record: ReaderNoteRecord,
  ownerLabel: string,
): DbReaderNoteView {
  return {
    id: record.id,
    bookId: record.bookId,
    chapterId: record.chapterId,
    bookTitle: record.bookTitle,
    chapterTitle: record.chapterTitle,
    progressRatio: record.progressRatio,
    noteText: record.noteText,
    noteTextPreview: record.noteText.length > 80
      ? record.noteText.slice(0, 80) + "..."
      : record.noteText,
    excerptPreview: record.excerptPreview,
    sourceType: record.sourceType,
    ownerLabel,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function buildDbReaderNotesLoadResult(
  records: ReaderNoteRecord[],
  ownerLabel: string,
): DbReaderNotesLoadResult {
  const items = records.map((r) => toDbReaderNoteView(r, ownerLabel));
  return {
    guardEnabled: true,
    useDbNotes: true,
    hasSession: true,
    message: `已从开发 DB 加载 ${items.length} 条笔记。`,
    items,
    notice: "dev-only · 绑定 dev session · 未接生产同步",
  };
}

export function createEmptyDbReaderNotesLoadResult(
  guardEnabled: boolean,
  message: string,
): DbReaderNotesLoadResult {
  return {
    guardEnabled,
    useDbNotes: false,
    hasSession: false,
    message,
    items: [],
    notice: guardEnabled
      ? "dev-only · guard 已启用但无数据"
      : "DB guard 未启用 · 使用本地 fallback",
  };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load DB reader notes for the current dev session.
 */
export async function loadDbReaderNotes(
  cookieValue: string | undefined,
): Promise<DbReaderNotesLoadResult> {
  const guard = evaluateReaderNotesDbGuard(cookieValue);

  if (!guard.enabled) {
    return createEmptyDbReaderNotesLoadResult(
      false,
      guard.blockedReasons.length > 0
        ? `笔记 DB 持久化未启用：${guard.blockedReasons[0]}`
        : "笔记 DB 持久化默认关闭。使用本地笔记 fallback。",
    );
  }

  if (guard.sessionPayload === null) {
    return createEmptyDbReaderNotesLoadResult(
      true,
      "DB 笔记已启用但当前无开发会话。使用本地笔记 fallback。",
    );
  }

  const ownerId = guard.sessionPayload.userIdPreview;
  const ownerLabel = guard.sessionPayload.displayName;

  try {
    const records = await doListReaderNotesByOwner(ownerId, guard);
    return buildDbReaderNotesLoadResult(records, ownerLabel);
  } catch {
    return createEmptyDbReaderNotesLoadResult(
      true,
      "DB 笔记查询失败。本地笔记不受影响。",
    );
  }
}

/**
 * Check if the reader notes DB guard is enabled for the current request.
 */
export function getReaderNotesDbGuardEnabled(
  cookieValue: string | undefined,
): boolean {
  return evaluateReaderNotesDbGuard(cookieValue).enabled;
}
