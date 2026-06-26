"use client";

/**
 * ReaderProgressSaveControlWrapper — bridges server-side guard status
 * to the client-side ReaderProgressSaveControl component.
 *
 * The server action is called directly from this client component via
 * the import. Save function re-exports the server action so the
 * component stays clean.
 *
 * @module ReaderProgressSaveControlWrapper
 * @previewOnly
 */

import { ReaderProgressSaveControl } from "./ReaderProgressSaveControl";
import { saveReaderProgressToDbAction, type ReaderProgressDbActionState } from "./reader-progress-db-server-action";
import type { ReaderProgressDbStatusForUi } from "./reader-progress-db-guard";

export interface ReaderProgressSaveControlWrapperProps {
  bookId: string;
  chapterId: string;
  progressRatio: number;
  dbStatus: ReaderProgressDbStatusForUi;
}

async function handleSave(
  bookId: string,
  chapterId: string,
  progressRatio: number,
): Promise<ReaderProgressDbActionState> {
  return saveReaderProgressToDbAction(bookId, chapterId, progressRatio);
}

export function ReaderProgressSaveControlWrapper({
  bookId,
  chapterId,
  progressRatio,
  dbStatus,
}: ReaderProgressSaveControlWrapperProps) {
  return (
    <ReaderProgressSaveControl
      bookId={bookId}
      chapterId={chapterId}
      progressRatio={progressRatio}
      dbStatus={dbStatus}
      onSave={handleSave}
    />
  );
}
