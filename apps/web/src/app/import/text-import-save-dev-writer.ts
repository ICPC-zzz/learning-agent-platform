/**
 * Dev/test-only writer that converts a validated save request into
 * in-memory dev store entries.
 */

import type { TextImportSaveRequestPreview } from "./text-import-save-request.ts";
import {
  generateDevBookId,
  generateDevChapterId,
  generateDevChunkId,
  saveDevBook,
  type DevBookData,
} from "./text-import-save-dev-store.ts";

export interface TextImportSaveDevWriteResult {
  success: boolean;
  bookId: string | null;
  chapterIds: string[];
  reasonCode: string;
  message: string;
}

export function writeTextImportSaveToDevStore(
  saveRequest: TextImportSaveRequestPreview,
): TextImportSaveDevWriteResult {
  if (!saveRequest.saveReady) {
    return {
      success: false,
      bookId: null,
      chapterIds: [],
      reasonCode: "save-not-ready",
      message: "Save request is not ready; saveReady must be true.",
    };
  }

  if (saveRequest.blockedReasons.length > 0) {
    return {
      success: false,
      bookId: null,
      chapterIds: [],
      reasonCode: "save-blocked",
      message: "Save request has blocked reasons: " + saveRequest.blockedReasons.join("; "),
    };
  }

  if (!saveRequest.userExplicitlyConfirmed) {
    return {
      success: false,
      bookId: null,
      chapterIds: [],
      reasonCode: "user-confirmation-required",
      message: "User must explicitly confirm before saving.",
    };
  }

  if (saveRequest.effectiveChapterCount <= 0 || saveRequest.safeChapters.length === 0) {
    return {
      success: false,
      bookId: null,
      chapterIds: [],
      reasonCode: "no-chapters",
      message: "No valid chapters to save.",
    };
  }

  const bookId = generateDevBookId();
  const now = new Date().toISOString();
  const chapterIds = [];

  const devData: DevBookData = {
    book: {
      id: bookId,
      title: saveRequest.bookTitlePreview,
      author: "dev-import / no real user",
      sourceType: "dev-import",
      description: "Dev in-memory store / restart-lost / " + saveRequest.effectiveChapterCount + " chapters",
      tags: ["dev-import", "in-memory", "restart-lost"],
      createdAt: now,
      updatedAt: now,
    },
    chapters: [],
    chunks: [],
  };

  for (const safeChapter of saveRequest.safeChapters) {
    const chapterId = generateDevChapterId(bookId, safeChapter.order);
    chapterIds.push(chapterId);

    devData.chapters.push({
      id: chapterId,
      bookId,
      title: safeChapter.title,
      orderIndex: safeChapter.order - 1,
      level: 1,
      plainText: safeChapter.previewText,
    });

    devData.chunks.push({
      id: generateDevChunkId(chapterId, 0),
      bookId,
      chapterId,
      orderIndex: 0,
      plainText: safeChapter.previewText,
    });
  }

  saveDevBook(devData);

  return {
    success: true,
    bookId,
    chapterIds,
    reasonCode: "dev-store-saved",
    message: "Saved to dev in-memory store (restart-lost). Book ID: " + bookId + ", " + chapterIds.length + " chapters.",
  };
}
